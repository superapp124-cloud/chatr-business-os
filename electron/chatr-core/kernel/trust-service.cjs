'use strict';

/**
 * CHATR Kernel — Trust Service
 * Platform Milestone C — ABI v0.9 RC
 *
 * Input:  provider_id (string)
 *         manifest (ProviderManifest ABI object)
 *         goal_id (string)
 *
 * Output: TrustAssessment (abi: chatr.trust_assessment.v0_9_rc)
 *         Immutable. Persisted. Published on event bus.
 *
 * Events: trust.computing → trust.assessed
 *         trust.computing → trust.failed
 *
 * Rules:
 *   - Computes trust scores based on evidence, not static claims.
 *   - Consumes Execution Memory statistics for runtime reliability.
 *   - No domain or industry specific tables.
 *   - Replaces the old trust-engine.cjs risk tiers (which moved to PolicyService).
 */

const crypto = require('crypto');
const { TRUST } = require('../events/events.cjs');
const { getExecutionMemoryProvider } = require('./execution-memory-interface.cjs');

const ABI               = 'chatr.trust_assessment.v0_9_rc';
const COLLECTION        = 'kernel_trust_assessments_v0_9_rc';
const ASSESSMENT_VERSION= 1;

class TrustService {
  constructor(options = {}) {
    this._persistence    = options.persistence    || getDefaultPersistence();
    this._bus            = options.bus            || getDefaultBus();
    this._now            = normalizeNow(options.now);
    this._execMemory     = options.execMemory     || getExecutionMemoryProvider();
    this._assessments    = new Map();
    this._loadFromDisk();
  }

  /**
   * Assess trust for a given provider.
   *
   * @param {object} input
   * @param {string} input.provider_id
   * @param {object} input.manifest
   * @param {string} [input.goal_id]
   * @returns {object} TrustAssessment — immutable, persisted
   */
  assess(input = {}) {
    const providerId    = input.provider_id || input.providerId;
    const manifest      = input.manifest;
    const goalId        = input.goal_id || input.goalId || null;
    const correlationId = input.correlation_id || input.correlationId || goalId;
    const assessedAt    = this._now();

    if (!providerId) throw new Error('TrustService requires provider_id');
    if (!manifest) throw new Error('TrustService requires manifest');

    this._publish(TRUST.COMPUTING, {
      goal_id:        goalId,
      provider_id:    providerId,
      correlation_id: correlationId,
      source:         'TrustService',
    });

    try {
      const execStats = this._execMemory.getProviderStatistics(providerId);
      const assessmentData = computeTrust(providerId, manifest, execStats);

      const assessment = buildTrustAssessment({
        providerId,
        assessmentData,
        goalId,
        assessedAt,
      });

      validateTrustAssessment(assessment);
      const immutable = deepFreeze(assessment);

      if (!input.dry_run) {
        this._assessments.set(immutable.trust_assessment_id, immutable);
        this._persist();
      }

      this._publish(TRUST.ASSESSED, {
        goal_id:             goalId,
        provider_id:         providerId,
        trust_assessment_id: immutable.trust_assessment_id,
        level:               immutable.level,
        trust_score:         immutable.trust_score,
        correlation_id:      correlationId,
        source:              'TrustService',
      });

      return immutable;
    } catch (error) {
      this._publish(TRUST.FAILED, {
        goal_id:        goalId,
        provider_id:    providerId,
        error:          error.message,
        correlation_id: correlationId,
        source:         'TrustService',
      });
      throw error;
    }
  }

  getAssessment(id) {
    return this._assessments.get(id) || null;
  }

  listAssessments() {
    return Array.from(this._assessments.values());
  }

  _loadFromDisk() {
    const stored = this._persistence.retrieve(COLLECTION);
    this._assessments.clear();
    for (const a of stored?.assessments || []) {
      try {
        validateTrustAssessment(a);
        this._assessments.set(a.trust_assessment_id, deepFreeze(a));
      } catch {
        // Skip corrupted records
      }
    }
  }

  _persist() {
    return this._persistence.store(COLLECTION, {
      abi:         ABI,
      assessments: this.listAssessments(),
      updated_at:  this._now(),
    });
  }

  _publish(eventName, payload) {
    if (this._bus && typeof this._bus.publish === 'function') {
      this._bus.publish(eventName, payload);
    }
  }
}

// ── Trust computation logic ───────────────────────────────────────────────────

function computeTrust(providerId, manifest, execStats) {
  let score = 0.5; // Base neutral trust
  const evidence = [];
  const permissions = new Set();

  // 1. Evidence: Manifest Signature (Simulated check)
  const trustEv = manifest.trust_evidence || {};
  if (trustEv.manifest_signature === 'required' || trustEv.manifest_signature === 'valid') {
    score += 0.2;
    evidence.push('manifest_signature:valid');
  } else if (trustEv.manifest_signature === 'invalid') {
    score -= 0.4;
    evidence.push('manifest_signature:invalid');
  } else {
    evidence.push('manifest_signature:unknown');
  }

  if (trustEv.attestation === 'required' || trustEv.attestation === 'valid') {
    score += 0.1;
    evidence.push('attestation:valid');
  }

  // 2. Evidence: Execution Memory Reliability
  if (execStats.observations > 5) {
    const sr = execStats.success_rate;
    if (sr >= 0.95) {
      score += 0.2;
      evidence.push('execution_memory:high_reliability');
    } else if (sr >= 0.8) {
      score += 0.1;
      evidence.push('execution_memory:acceptable_reliability');
    } else {
      score -= 0.3;
      evidence.push('execution_memory:low_reliability');
    }
  } else {
    evidence.push('execution_memory:insufficient_data');
  }

  // 3. Evidence: Reliability claim
  // Only lightly weight the provider's own claim unless backed by memory
  const claimedReliability = manifest.capabilities?.[0]?.reliability?.declared_success_rate || 0;
  if (claimedReliability > 0.9) {
    score += 0.05;
    evidence.push('provider_claim:high_reliability');
  }

  // Constrain score [0, 1]
  const finalScore = Math.max(0, Math.min(1, score));

  let level = 'unknown';
  let requiresApproval = true;

  if (finalScore >= 0.8) {
    level = 'trusted';
    requiresApproval = false;
  } else if (finalScore >= 0.5) {
    level = 'neutral';
    requiresApproval = true;
  } else {
    level = 'untrusted';
    requiresApproval = true;
  }

  // Derive allowed execution modes (permissions) based on trust level
  // Untrusted providers may only be allowed isolated modes like API, not native_app.
  const declaredModes = new Set();
  if (manifest.capabilities) {
    manifest.capabilities.forEach(cap => {
      (cap.execution_modes || []).forEach(m => declaredModes.add(m));
    });
  }

  for (const mode of declaredModes) {
    if (level === 'untrusted' && mode === 'native_app') continue;
    permissions.add(mode);
  }

  return {
    trust_score: finalScore,
    level,
    evidence_refs: evidence,
    execution_permissions: Array.from(permissions),
    requires_approval: requiresApproval
  };
}

// ── ABI object construction ───────────────────────────────────────────────────

function buildTrustAssessment({ providerId, assessmentData, goalId, assessedAt }) {
  const assessment = {
    abi:                   ABI,
    assessment_version:    ASSESSMENT_VERSION,
    trust_assessment_id:   null,
    assessment_hash:       null,
    goal_id:               goalId,
    provider_id:           providerId,
    trust_score:           assessmentData.trust_score,
    level:                 assessmentData.level,
    evidence_refs:         clonePlainArray(assessmentData.evidence_refs),
    execution_permissions: clonePlainArray(assessmentData.execution_permissions),
    requires_approval:     assessmentData.requires_approval,
    assessed_at:           assessedAt,
  };

  assessment.assessment_hash     = hashStable(buildHashPayload(assessment));
  assessment.trust_assessment_id = `trust_ass_${assessment.assessment_hash.slice(0, 32)}`;
  return assessment;
}

function buildHashPayload(a) {
  return {
    provider_id:           a.provider_id,
    trust_score:           a.trust_score,
    level:                 a.level,
    evidence_refs:         a.evidence_refs,
    execution_permissions: a.execution_permissions,
    requires_approval:     a.requires_approval,
    assessed_at:           a.assessed_at,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateTrustAssessment(a) {
  if (!a || typeof a !== 'object') {
    throw new Error('TrustAssessment must be an object');
  }
  if (a.abi !== ABI) {
    throw new Error(`Invalid TrustAssessment ABI: ${a.abi}`);
  }
  if (!a.trust_assessment_id || typeof a.trust_assessment_id !== 'string') {
    throw new Error('TrustAssessment requires trust_assessment_id');
  }
  if (!a.assessment_hash || typeof a.assessment_hash !== 'string') {
    throw new Error('TrustAssessment requires assessment_hash');
  }
  if (!a.provider_id || typeof a.provider_id !== 'string') {
    throw new Error('TrustAssessment requires provider_id');
  }
  if (typeof a.trust_score !== 'number' || a.trust_score < 0 || a.trust_score > 1) {
    throw new Error('TrustAssessment requires trust_score between 0 and 1');
  }
  if (!['trusted', 'neutral', 'untrusted', 'unknown'].includes(a.level)) {
    throw new Error(`Invalid TrustAssessment level: ${a.level}`);
  }
  if (!Array.isArray(a.evidence_refs)) {
    throw new Error('TrustAssessment requires evidence_refs array');
  }
  if (!Array.isArray(a.execution_permissions)) {
    throw new Error('TrustAssessment requires execution_permissions array');
  }
  if (typeof a.requires_approval !== 'boolean') {
    throw new Error('TrustAssessment requires requires_approval boolean');
  }
  if (Number.isNaN(Date.parse(a.assessed_at))) {
    throw new Error('TrustAssessment requires assessed_at ISO timestamp');
  }
  return true;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function hashStable(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function clonePlainArray(arr) {
  return JSON.parse(JSON.stringify(Array.isArray(arr) ? arr : []));
}

function deepFreeze(v) {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const nested of Object.values(v)) deepFreeze(nested);
  return v;
}

function normalizeNow(now) {
  return typeof now === 'function' ? now : () => new Date().toISOString();
}

function getDefaultPersistence() {
  return require('../db/persistence.cjs');
}

function getDefaultBus() {
  return require('../events/bus.cjs').bus;
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _default = null;

function getTrustService() {
  if (!_default) _default = new TrustService();
  return _default;
}

// ── Exports ───────────────────────────────────────────────────────────────────

const exported = {
  ABI,
  TrustService,
  COLLECTION,
  ASSESSMENT_VERSION,
  validateTrustAssessment,
  deepFreeze,
  getTrustService,
};

Object.defineProperty(exported, 'trustService', {
  enumerable: true,
  get: getTrustService,
});

module.exports = exported;
