'use strict';

/**
 * CHATR Kernel — Provider Intelligence
 * Platform Milestone C — ABI v0.9 RC
 *
 * Input:  CapabilityRequest, ContextFrame
 *
 * Pipeline orchestration (Milestone C sequence):
 *   1. Strategy Resolver -> StrategySelection
 *   2. Policy Service -> PolicyDecision (abort if blocked)
 *   3. Trust Service -> TrustAssessment (per candidate)
 *   4. Provider Intelligence -> Score and Rank candidates
 *   5. Resource Manager -> ResourceLease (for the top candidate, owner: 'ProviderIntelligence')
 *
 * Output: ProviderSelection[] (abi: chatr.provider_selection.v0_9_rc)
 *         Ranked list of viable providers with acquired leases.
 *
 * Rules:
 *   - Scores via the 12-factor ABI formula.
 *   - Enforces execution mode order (API → Native App → Browser Runtime → Human Assist).
 *   - Does not bypass policy. Does not authenticate.
 */

const crypto = require('crypto');
const { PROVIDER } = require('../events/events.cjs');
const { getStrategyResolver } = require('./strategy-resolver.cjs');
const { getPolicyService }    = require('./policy-service.cjs');
const { getTrustService }     = require('./trust-service.cjs');
const { getResourceManager }  = require('./resource-manager.cjs');
const { getManifestLoader }   = require('./manifest-loader.cjs');
const { DiscoveryEngine }     = require('./discovery-engine.cjs');
const { ExecutionCache }      = require('./execution-cache.cjs');
const { ConnectorRegistry }   = require('../connectors/connector-registry.cjs');
const { ZomatoConnector }     = require('../connectors/providers/zomato-connector.cjs');
const { SwiggyConnector }     = require('../connectors/providers/swiggy-connector.cjs');
const { MakeMyTripConnector } = require('../connectors/providers/makemytrip-connector.cjs');
const { IRCTCConnector }      = require('../connectors/providers/irctc-connector.cjs');
const { UtilityConnector }    = require('../connectors/providers/utility-connector.cjs');
const { PassportSevaConnector } = require('../connectors/providers/passport-seva-connector.cjs');
const { RankingEngine }       = require('./ranking-engine.cjs');

const ABI               = 'chatr.provider_selection.v0_9_rc';
const COLLECTION        = 'kernel_provider_selections_v0_9_rc';
const SELECTION_VERSION = 1;

// ABI mandated execution mode order
const MODE_PRIORITY = {
  'api': 4,
  'native_app': 3,
  'browser_runtime': 2,
  'human_assist': 1,
};

class ProviderIntelligence {
  constructor(options = {}) {
    this._persistence = options.persistence || getDefaultPersistence();
    this._bus         = options.bus         || getDefaultBus();
    this._now         = normalizeNow(options.now);
    
    this._strategy    = options.strategy    || getStrategyResolver();
    this._policy      = options.policy      || getPolicyService();
    this._trust       = options.trust       || getTrustService();
    this._resources   = options.resources   || getResourceManager();
    this._manifests   = options.manifests   || getManifestLoader();
    
    this._executionCache = new ExecutionCache();
    
    // Static P1.2 Connector Registration
    this._registry = new ConnectorRegistry();
    this._registry.register(new ZomatoConnector());
    this._registry.register(new SwiggyConnector());
    this._registry.register(new MakeMyTripConnector());
    this._registry.register(new IRCTCConnector());
    this._registry.register(new UtilityConnector());
    this._registry.register(new PassportSevaConnector());

    this._discoveryEngine = new DiscoveryEngine(this._bus, this._executionCache, this._registry);
    this._rankingEngine = new RankingEngine();
    
    this._selections  = new Map();
    this._loadFromDisk();
  }

  /**
   * Run the full Resolution Pipeline for a capability request.
   *
   * @param {object} input
   * @param {object} input.capability_request
   * @param {object} [input.context_frame]
   * @param {object} [input.constraints]
   */
  resolveProvider(input = {}) {
    const capReq = input.capability_request || input.capabilityRequest;
    const ctx    = input.context_frame || input.contextFrame || {};
    const cons   = input.constraints || {};
    const goalId = input.goal_id || input.goalId || capReq?.goal_id;
    const corrId = input.correlation_id || input.correlationId || goalId;
    const dryRun = !!input.dry_run;

    this._publish(PROVIDER.RANKING, { goal_id: goalId, capability: capReq?.capability, correlation_id: corrId });

    try {
      // 1. Strategy
      const strategySel = this._strategy.resolve({
        capability_request: capReq,
        context_frame: ctx,
        constraints: cons,
        goal_id: goalId,
        correlation_id: corrId,
        dry_run: dryRun,
      });

      // 2. Policy
      const policyDec = this._policy.evaluate({
        capability_request: capReq,
        context_frame: ctx,
        goal_id: goalId,
        correlation_id: corrId,
        dry_run: dryRun,
      });

      if (policyDec.decision === 'block') {
        throw new Error(`Policy blocked capability ${capReq.capability}. Reasons: ${policyDec.reasons.join(', ')}`);
      }

      // 3. Find candidates
      const allManifests = this._manifests.getAll();
      const candidates = [];

      for (const manifest of allManifests) {
        const capDef = manifest.capabilities?.find(c => c.capability === capReq.capability);
        if (!capDef) continue; // Provider doesn't support this capability

        // Check if strategy is supported by this capability contract
        if (!capDef.strategy_support?.includes(strategySel.strategy)) continue;

        // 4. Trust Service (evaluates provider)
        const trustAss = this._trust.assess({
          provider_id: manifest.provider_id,
          manifest: manifest,
          goal_id: goalId,
          correlation_id: corrId,
          dry_run: dryRun,
        });

        // If trust requires approval but policy didn't ask for it, we might skip or demote.
        // For Milestone C, we just include trust in the score.

        candidates.push({ manifest, capDef, trustAss });
      }

      if (candidates.length === 0) {
        throw new Error(`No viable providers found for capability ${capReq.capability} and strategy ${strategySel.strategy}`);
      }

      // 5. Score and Rank candidates
      // 4. Discovery Engine (New in Milestone P1)
      // This will run concurrently to fetch live data (e.g., Zomato menus, ETAs)
      // For now, it runs asynchronously and triggers bus events, but for the ABI
      // we still synchronously rank based on the strategy candidate list to not break the ABI immediately.
      // In full P1, this will block and await discovery results.
      this._discoveryEngine.discover(strategySel, ctx).then(discoveryResults => {
         const rankedOptions = this._rankingEngine.rank(discoveryResults, 3);
         this._bus.publish('kernel.ranking.completed', {
            goal_id: goalId,
            topResults: rankedOptions
         });
      }).catch(err => {
         console.error('Discovery Engine failed:', err);
      });

      // For backward compatibility of ABI, we currently return empty candidate lists here,
      // as the real output is streamed asynchronously.
      const rankedOptions = [];
      for (const cand of candidates) {
        // Expand into multiple options if provider supports multiple execution modes
        const modes = cand.capDef.execution_modes || [];
        for (const mode of modes) {
          // Trust service restricts native_app for untrusted
          if (!cand.trustAss.execution_permissions.includes(mode)) continue;

          const scoreData = this._scoreCandidate(cand, mode, capReq, strategySel, policyDec, cons);
          rankedOptions.push(scoreData);
        }
      }

      rankedOptions.sort((a, b) => b.score - a.score);

      if (rankedOptions.length === 0) {
        throw new Error(`Providers found, but no valid execution modes permitted by Trust/Policy.`);
      }

      // 6. Lease resources for the top choices until one succeeds
      const finalSelections = [];
      for (const opt of rankedOptions) {
        let leaseRef = null;
        const requiredRes = opt.capDef.resource_profile?.requires || [];
        
        try {
          if (!dryRun && requiredRes.includes('browser_session') && opt.execution_mode === 'browser_runtime') {
            const lease = this._resources.lease({
              goal_id: goalId,
              resource: 'browser_session',
              owner: 'ProviderIntelligence',
              ttl_ms: 30000,
              renewable: true,
            });
            leaseRef = lease.lease_id;
          } else if (!dryRun && requiredRes.includes('network')) {
            const lease = this._resources.lease({
              goal_id: goalId,
              resource: 'network_slot',
              owner: 'ProviderIntelligence',
              ttl_ms: 10000,
              renewable: true,
            });
            leaseRef = lease.lease_id;
          }

          // Build final ABI object
          const sel = buildProviderSelection({
            opt,
            goalId,
            strategySel,
            policyDec,
            leaseRef,
            selectedAt: this._now(),
          });
          
          validateProviderSelection(sel);
          const immutable = deepFreeze(sel);

          if (!dryRun) {
            this._selections.set(immutable.provider_selection_id, immutable);
          }
          
          finalSelections.push(immutable);
          
          // Stop after successfully acquiring a top choice.
          // (In a full implementation, we might return top N so the Workflow Generator can try fallbacks).
          if (finalSelections.length >= 1) break;

        } catch (leaseErr) {
          // If we couldn't lease, this option is skipped due to resource exhaustion.
          continue;
        }
      }

      if (finalSelections.length === 0) {
        throw new Error(`Failed to acquire resources for any viable provider.`);
      }

      if (!dryRun) this._persist();

      this._publish(PROVIDER.SELECTED, {
        goal_id:               goalId,
        provider_selection_id: finalSelections[0].provider_selection_id,
        provider_id:           finalSelections[0].provider_id,
        execution_mode:        finalSelections[0].execution_mode,
        correlation_id:        corrId,
        source:                'ProviderIntelligence',
      });

      return finalSelections;
    } catch (error) {
      this._publish(PROVIDER.FAILED, {
        goal_id:        goalId,
        capability:     capReq?.capability,
        error:          error.message,
        correlation_id: corrId,
        source:         'ProviderIntelligence',
      });
      throw error;
    }
  }

  _scoreCandidate(cand, mode, capReq, strategySel, policyDec, constraints) {
    let score = 0;
    const breakdown = {};

    // Base capability match
    breakdown.capability_match = 1.0;
    score += breakdown.capability_match;

    // Strategy fit (e.g. if fastest, reward low latency)
    let strategyFit = 0;
    if (strategySel.strategy === 'fastest') {
      const p95 = cand.capDef.latency?.p95_ms || 5000;
      strategyFit = p95 < 2000 ? 1.0 : (p95 < 5000 ? 0.5 : 0.0);
    } else if (strategySel.strategy === 'most_trusted') {
      strategyFit = cand.trustAss.trust_score;
    } else if (strategySel.strategy === 'cheapest') {
      strategyFit = cand.capDef.cost?.model === 'free' ? 1.0 : 0.0;
    } else {
      strategyFit = 0.5;
    }
    breakdown.strategy_fit = strategyFit;
    score += strategyFit;

    // Trust Score (direct)
    breakdown.trust_score = cand.trustAss.trust_score;
    score += cand.trustAss.trust_score;

    // Reliability
    const rel = cand.capDef.reliability?.declared_success_rate || 0.5;
    breakdown.reliability = rel;
    score += rel;

    // Execution Mode Priority
    const modePriority = MODE_PRIORITY[mode] || 0;
    breakdown.mode_priority = modePriority * 0.2; // weight
    score += breakdown.mode_priority;

    // Penalties
    let latencyPenalty = 0;
    const p50 = cand.capDef.latency?.p50_ms || 2000;
    if (p50 > 3000) latencyPenalty = 0.5;
    breakdown.latency_penalty = -latencyPenalty;
    score -= latencyPenalty;

    return {
      provider_id: cand.manifest.provider_id,
      execution_mode: mode,
      score,
      breakdown,
      capDef: cand.capDef,
      manifest: cand.manifest,
      trustAss: cand.trustAss,
    };
  }

  getSelection(id) {
    return this._selections.get(id) || null;
  }

  listSelections() {
    return Array.from(this._selections.values());
  }

  _loadFromDisk() {
    const stored = this._persistence.retrieve(COLLECTION);
    this._selections.clear();
    for (const s of stored?.selections || []) {
      try {
        validateProviderSelection(s);
        this._selections.set(s.provider_selection_id, deepFreeze(s));
      } catch {}
    }
  }

  _persist() {
    return this._persistence.store(COLLECTION, {
      abi:        ABI,
      selections: this.listSelections(),
      updated_at: this._now(),
    });
  }

  _publish(eventName, payload) {
    if (this._bus && typeof this._bus.publish === 'function') {
      this._bus.publish(eventName, payload);
    }
  }
}

// ── ABI object construction ───────────────────────────────────────────────────

function buildProviderSelection({ opt, goalId, strategySel, policyDec, leaseRef, selectedAt }) {
  const sel = {
    abi:                    ABI,
    selection_version:      SELECTION_VERSION,
    provider_selection_id:  null,
    selection_hash:         null,
    goal_id:                goalId,
    capability:             strategySel.capability,
    provider_id:            opt.provider_id,
    execution_mode:         opt.execution_mode,
    score:                  opt.score,
    score_breakdown:        clonePlainObject(opt.breakdown),
    strategy_selection_ref: strategySel.strategy_selection_id,
    policy_decision_ref:    policyDec.policy_decision_id,
    trust_assessment_ref:   opt.trustAss.trust_assessment_id,
    resource_lease_ref:     leaseRef,
    selected_at:            selectedAt,
  };

  sel.selection_hash        = hashStable(buildHashPayload(sel));
  sel.provider_selection_id = `prov_sel_${sel.selection_hash.slice(0, 32)}`;
  return sel;
}

function buildHashPayload(s) {
  return {
    goal_id:                s.goal_id,
    capability:             s.capability,
    provider_id:            s.provider_id,
    execution_mode:         s.execution_mode,
    strategy_selection_ref: s.strategy_selection_ref,
    policy_decision_ref:    s.policy_decision_ref,
    trust_assessment_ref:   s.trust_assessment_ref,
    selected_at:            s.selected_at,
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateProviderSelection(s) {
  if (!s || typeof s !== 'object') throw new Error('ProviderSelection must be an object');
  if (s.abi !== ABI) throw new Error(`Invalid ABI: ${s.abi}`);
  if (!s.provider_selection_id) throw new Error('Missing provider_selection_id');
  if (!s.provider_id) throw new Error('Missing provider_id');
  if (!s.execution_mode) throw new Error('Missing execution_mode');
  if (typeof s.score !== 'number') throw new Error('Score must be a number');
  if (!s.strategy_selection_ref) throw new Error('Missing strategy_selection_ref');
  if (!s.policy_decision_ref) throw new Error('Missing policy_decision_ref');
  if (!s.trust_assessment_ref) throw new Error('Missing trust_assessment_ref');
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

function clonePlainObject(v) {
  return JSON.parse(JSON.stringify(v ?? (Array.isArray(v) ? [] : {})));
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

function getProviderIntelligence() {
  if (!_default) _default = new ProviderIntelligence();
  return _default;
}

const exported = {
  ABI,
  ProviderIntelligence,
  validateProviderSelection,
  getProviderIntelligence,
};

Object.defineProperty(exported, 'providerIntelligence', {
  enumerable: true,
  get: getProviderIntelligence,
});

module.exports = exported;
