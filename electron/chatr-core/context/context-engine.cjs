'use strict';

const crypto = require('crypto');
const os = require('os');
const { CONTEXT } = require('../events/events.cjs');

const ABI = 'chatr.context_frame.v0_9_rc';
const FRAME_VERSION = 1;
const FRAME_COLLECTION = 'kernel_context_frames_v0_9_rc';

const SOURCE_KEYS = Object.freeze([
  'time',
  'gps',
  'network',
  'device',
  'identity',
  'permissions',
  'wallet',
  'preferences',
  'history',
  'execution_memory',
  'world_state_refs',
  'policy_refs',
  'active_environment',
]);

const SOURCE_CLASSIFICATION = Object.freeze({
  time: 'dynamic',
  gps: 'dynamic',
  network: 'dynamic',
  device: 'static',
  identity: 'static',
  permissions: 'policy',
  wallet: 'static',
  preferences: 'historical',
  history: 'historical',
  execution_memory: 'historical',
  world_state_refs: 'historical',
  policy_refs: 'policy',
  active_environment: 'dynamic',
});

class ContextEngine {
  constructor(options = {}) {
    this.persistence = options.persistence || getDefaultPersistence();
    this.bus = options.bus || getDefaultBus();
    this.now = normalizeNow(options.now);
    this.sources = {
      ...createDefaultSources(),
      ...(options.sources || {}),
    };
    this.frames = new Map();
    this.loadFromDisk();
  }

  async collect(input = {}) {
    const request = normalizeRequest(input);
    const goalId = input.goal_id || input.goalId || request.goal_id || null;
    const correlationId = input.correlation_id || input.correlationId || goalId || request.request_id;
    const collectedAt = this.now();

    try {
      this.publish(CONTEXT.COLLECTING, {
        goal_id: goalId,
        request_id: request.request_id,
        correlation_id: correlationId,
        collected_at: collectedAt,
        source: 'ContextEngine',
      });

      const resolved = await this.resolveSources({
        goal_id: goalId,
        request,
        collected_at: collectedAt,
        correlation_id: correlationId,
      });

      const frame = {
        abi: ABI,
        frame_version: FRAME_VERSION,
        context_id: null,
        context_hash: null,
        request_id: request.request_id,
        goal_id: goalId,
        collected_at: collectedAt,
        request,
        time: resolved.time.value,
        gps: resolved.gps.value,
        network: resolved.network.value,
        device: resolved.device.value,
        identity: resolved.identity.value,
        permissions: resolved.permissions.value,
        wallet: resolved.wallet.value,
        preferences: resolved.preferences.value,
        history: resolved.history.value,
        execution_memory: resolved.execution_memory.value,
        world_state_refs: resolved.world_state_refs.value,
        policy_refs: resolved.policy_refs.value,
        active_environment: resolved.active_environment.value,
        source_classification: createSourceClassification(),
        quality: createQuality(resolved),
        provenance: createProvenance(resolved, collectedAt),
      };

      frame.context_hash = createContextHash(frame);
      frame.context_id = createContextId(frame);
      validateContextFrame(frame);

      const immutableFrame = deepFreeze(frame);
      this.frames.set(immutableFrame.context_id, immutableFrame);
      this.persist();

      this.publish(CONTEXT.READY, {
        goal_id: goalId,
        request_id: request.request_id,
        context_ref: immutableFrame.context_id,
        context_hash: immutableFrame.context_hash,
        frame: immutableFrame,
        correlation_id: correlationId,
        source: 'ContextEngine',
      });

      return immutableFrame;
    } catch (error) {
      this.publish(CONTEXT.FAILED, {
        goal_id: goalId,
        request_id: request.request_id,
        correlation_id: correlationId,
        error: error.message,
        source: 'ContextEngine',
      });
      throw error;
    }
  }

  async resolveSources(context) {
    const resolved = {};

    for (const key of SOURCE_KEYS) {
      resolved[key] = await resolveSource(
        key,
        this.sources[key],
        context,
        defaultValueForSource(key, context),
      );
      this.publish(CONTEXT.SOURCE_LOADED, {
        goal_id: context.goal_id,
        request_id: context.request.request_id,
        source_key: key,
        source_class: SOURCE_CLASSIFICATION[key] || 'unknown',
        status: resolved[key].status,
        confidence: sourceConfidence(resolved[key].value, resolved[key].status),
        correlation_id: context.correlation_id || context.goal_id || context.request.request_id,
        source: 'ContextEngine',
      });
    }

    return resolved;
  }

  getFrame(contextId) {
    return this.frames.get(contextId) || null;
  }

  listFrames() {
    return Array.from(this.frames.values());
  }

  loadFromDisk() {
    const stored = this.persistence.retrieve(FRAME_COLLECTION);
    this.frames.clear();

    for (const frame of stored?.frames || []) {
      try {
        validateContextFrame(frame);
        this.frames.set(frame.context_id, deepFreeze(frame));
      } catch {
        // Invalid persisted context is ignored instead of poisoning recovery.
      }
    }

    return this.listFrames();
  }

  persist() {
    return this.persistence.store(FRAME_COLLECTION, {
      abi: ABI,
      frames: this.listFrames(),
      updated_at: this.now(),
    });
  }

  publish(eventName, payload) {
    if (this.bus && typeof this.bus.publish === 'function') {
      this.bus.publish(eventName, payload);
    }
  }
}

let defaultContextEngine = null;

function getContextEngine() {
  if (!defaultContextEngine) {
    defaultContextEngine = new ContextEngine();
  }
  return defaultContextEngine;
}

function normalizeNow(now) {
  if (typeof now === 'function') {
    return now;
  }
  return () => new Date().toISOString();
}

function normalizeRequest(input) {
  const requestInput = input.request || {};
  const rawText = String(
    requestInput.raw_text
      || requestInput.rawText
      || requestInput.text
      || input.raw_text
      || input.rawText
      || input.text
      || input.prompt
      || '',
  );

  const request = {
    request_id: requestInput.request_id || requestInput.requestId || input.request_id || input.requestId || null,
    raw_text: rawText,
    normalized_text: String(requestInput.normalized_text || requestInput.normalizedText || rawText)
      .trim()
      .replace(/\s+/g, ' '),
    source: requestInput.source || input.source || 'user',
    user_id: requestInput.user_id || requestInput.userId || input.user_id || input.userId || null,
    conversation_id: requestInput.conversation_id || requestInput.conversationId || input.conversation_id || input.conversationId || null,
    locale: requestInput.locale || input.locale || null,
    metadata: clonePlainObject(requestInput.metadata || input.metadata || {}),
  };

  if (!request.request_id) {
    request.request_id = `request_${hashStable(request).slice(0, 32)}`;
  }

  return request;
}

async function resolveSource(key, source, context, fallback) {
  try {
    let value;
    if (typeof source === 'function') {
      value = await source(context);
    } else if (source !== undefined) {
      value = source;
    } else {
      value = fallback;
    }

    return {
      value: normalizeSourceValue(key, value, fallback),
      status: 'resolved',
    };
  } catch (error) {
    return {
      value: unavailableFallback(fallback, error),
      status: 'unavailable',
      error: error.message,
    };
  }
}

function normalizeSourceValue(key, value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if ((key === 'world_state_refs' || key === 'policy_refs') && !Array.isArray(value)) {
    return fallback;
  }

  if (Array.isArray(value)) {
    return clonePlainObject(value);
  }

  if (typeof value === 'object') {
    return clonePlainObject(value);
  }

  return value;
}

function unavailableFallback(fallback, error) {
  if (Array.isArray(fallback)) {
    return [];
  }
  if (fallback && typeof fallback === 'object') {
    return {
      ...clonePlainObject(fallback),
      status: 'unavailable',
      reason: error.message,
    };
  }
  return fallback;
}

function createDefaultSources() {
  return {
    time: ({ collected_at: collectedAt }) => {
      const date = new Date(collectedAt);
      return {
        status: 'available',
        iso: date.toISOString(),
        timestamp_ms: date.getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        offset_minutes: date.getTimezoneOffset(),
      };
    },
    gps: () => ({
      status: 'missing',
      permission: 'unknown',
      latitude: null,
      longitude: null,
      accuracy_meters: null,
      source: 'none',
    }),
    network: () => {
      const interfaces = os.networkInterfaces();
      const active_interfaces = Object.entries(interfaces)
        .flatMap(([name, entries]) => (entries || [])
          .filter((entry) => !entry.internal)
          .map((entry) => ({
            name,
            family: entry.family,
            mac: entry.mac,
          })));

      return {
        status: 'available',
        online: active_interfaces.length > 0,
        active_interfaces,
      };
    },
    device: () => ({
      status: 'available',
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpu_count: os.cpus().length,
      memory_total_bytes: os.totalmem(),
      memory_free_bytes: os.freemem(),
    }),
    identity: () => ({
      status: 'anonymous',
      user_id: null,
      account_id: null,
      auth_state: 'unknown',
    }),
    permissions: () => ({
      status: 'unknown',
      granted: [],
      denied: [],
      required: [],
      scopes: {},
    }),
    wallet: () => ({
      status: 'unavailable',
      default_payment_ref: null,
      payment_method_refs: [],
      currency: null,
    }),
    preferences: () => ({
      status: 'empty',
      values: {},
      source: 'none',
    }),
    history: () => ({
      status: 'empty',
      recent_goal_refs: [],
      recent_provider_refs: [],
    }),
    execution_memory: () => ({
      status: 'empty',
      preferred_provider_refs: [],
      preferred_payment_ref: null,
      previous_workflow_ref: null,
    }),
    world_state_refs: () => [],
    policy_refs: () => [],
    active_environment: () => ({
      status: 'available',
      runtime: 'node',
      node_version: process.version,
      pid: process.pid,
    }),
  };
}

function defaultValueForSource(key, context) {
  const defaults = createDefaultSources();
  const source = defaults[key];
  return typeof source === 'function' ? source(context) : source;
}

function createProvenance(resolved, collectedAt) {
  const sources = {};

  for (const [key, result] of Object.entries(resolved)) {
    sources[key] = {
      status: result.status,
      error: result.error || null,
      resolved_at: collectedAt,
    };
  }

  return {
    collected_at: collectedAt,
    sources,
  };
}

function createSourceClassification() {
  return clonePlainObject(SOURCE_CLASSIFICATION);
}

function createQuality(resolved) {
  const sourceConfidence = {};
  const missingSources = [];
  const unavailableSources = [];

  for (const [key, result] of Object.entries(resolved)) {
    sourceConfidence[key] = sourceConfidenceForResult(result);
    if (result.value?.status === 'missing') {
      missingSources.push(key);
    }
    if (result.status === 'unavailable' || result.value?.status === 'unavailable') {
      unavailableSources.push(key);
    }
  }

  const values = Object.values(sourceConfidence);
  const confidence = values.length > 0
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
    : 0;

  return {
    confidence,
    source_confidence: sourceConfidence,
    missing_sources: missingSources,
    unavailable_sources: unavailableSources,
  };
}

function sourceConfidenceForResult(result) {
  return sourceConfidence(result.value, result.status);
}

function sourceConfidence(value, status) {
  if (value && typeof value === 'object' && Number.isFinite(value.confidence)) {
    return clampConfidence(value.confidence);
  }
  if (status === 'unavailable') return 0;
  if (value?.status === 'unavailable') return 0;
  if (value?.status === 'missing') return 0;
  if (value?.status === 'unknown') return 0.5;
  if (value?.status === 'partial') return 0.7;
  if (status === 'resolved') return 1;
  return 0.5;
}

function validateContextFrame(frame) {
  if (!frame || typeof frame !== 'object') {
    throw new Error('ContextFrame must be an object');
  }
  if (frame.abi !== ABI) {
    throw new Error(`Invalid ContextFrame ABI: ${frame.abi}`);
  }
  if (frame.frame_version !== FRAME_VERSION) {
    throw new Error(`Invalid ContextFrame version: ${frame.frame_version}`);
  }
  if (!frame.context_id || typeof frame.context_id !== 'string') {
    throw new Error('ContextFrame requires context_id');
  }
  if (!frame.context_hash || typeof frame.context_hash !== 'string') {
    throw new Error('ContextFrame requires context_hash');
  }
  if (!frame.request_id || typeof frame.request_id !== 'string') {
    throw new Error('ContextFrame requires request_id');
  }
  if (Number.isNaN(Date.parse(frame.collected_at))) {
    throw new Error('ContextFrame requires collected_at ISO timestamp');
  }
  for (const key of ['request', 'time', 'gps', 'network', 'device', 'identity', 'permissions', 'wallet', 'preferences', 'history', 'execution_memory', 'active_environment', 'source_classification', 'quality', 'provenance']) {
    if (!frame[key] || typeof frame[key] !== 'object' || Array.isArray(frame[key])) {
      throw new Error(`ContextFrame requires object ${key}`);
    }
  }
  for (const key of ['world_state_refs', 'policy_refs']) {
    if (!Array.isArray(frame[key])) {
      throw new Error(`ContextFrame requires array ${key}`);
    }
  }
  return true;
}

function createContextId(frame) {
  return `context_${createContextHash(frame).slice(0, 32)}`;
}

function createContextHash(frame) {
  const payload = clonePlainObject(frame);
  delete payload.context_id;
  delete payload.context_hash;
  return hashStable(payload);
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (number > 1) return Math.max(0, Math.min(1, number / 100));
  return Math.max(0, Math.min(1, number));
}

function hashStable(value) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(value))
    .digest('hex');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function clonePlainObject(value) {
  return JSON.parse(JSON.stringify(value || (Array.isArray(value) ? [] : {})));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }

  return value;
}

function getDefaultPersistence() {
  return require('../db/persistence.cjs');
}

function getDefaultBus() {
  return require('../events/bus.cjs').bus;
}

const exported = {
  ABI,
  FRAME_COLLECTION,
  FRAME_VERSION,
  SOURCE_CLASSIFICATION,
  ContextEngine,
  createContextHash,
  createContextId,
  createDefaultSources,
  deepFreeze,
  getContextEngine,
  normalizeRequest,
  validateContextFrame,
};

Object.defineProperty(exported, 'contextEngine', {
  enumerable: true,
  get: getContextEngine,
});

module.exports = exported;
