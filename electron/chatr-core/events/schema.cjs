'use strict';

const crypto = require('crypto');

const EVENT_ABI = 'chatr.event.v1.0';
const EVENT_VERSION = '1.0';

const FORBIDDEN_EVENT_NAMESPACES = new Set([
  'banking',
  'finance',
  'flight',
  'food',
  'government',
  'healthcare',
  'hotel',
  'shopping',
  'ticketing',
  'transport',
  'travel',
]);

const ALLOWED_EVENT_NAMESPACES = new Set([
  'action',
  'ai',
  'audit',
  'automation',
  'background',
  'capability',
  'commitment',
  'connector',
  'connectivity',
  'context',
  'core',
  'decision',
  'entity',
  'execution',
  'goal',
  'input',
  'intelligence',
  'intent',
  'job',
  'journal',
  'kernel',
  'learning',
  'lifecycle',
  'memory',
  'model',
  'module',
  'notification',
  'observation',
  'persist',
  'policy',
  'provider',
  'reconciliation',
  'recovery',
  'request',
  'resource',
  'scheduler',
  'strategy',
  'stewardship',
  'stream',
  'suggestion',
  'telemetry',
  'test',
  'trust',
  'ui',
  'verification',
  'world',
  'world_state',
]);

const CORE_ALIASES = new Map([
  ['core.kernel.ready', 'kernel.ready'],
  ['core.module.registered', 'module.registered'],
  ['core.request.started', 'request.started'],
  ['core.request.normalized', 'request.normalized'],
  ['core.request.completed', 'request.completed'],
  ['core.request.failed', 'request.failed'],
  ['core.request.cancelled', 'request.cancelled'],
  ['core.context.resolving', 'context.resolving'],
  ['core.context.resolved', 'context.resolved'],
  ['core.provider.resolved', 'provider.resolved'],
  ['core.provider.started', 'provider.started'],
  ['core.provider.failed', 'provider.failed'],
  ['core.stream.started', 'stream.started'],
  ['core.stream.delta', 'stream.delta'],
  ['core.stream.completed', 'stream.completed'],
  ['core.stream.failed', 'stream.failed'],
  ['core.stream.cancelled', 'stream.cancelled'],
  ['core.persist.started', 'persist.started'],
  ['core.persist.completed', 'persist.completed'],
  ['core.persist.failed', 'persist.failed'],
  ['core.recovery.triggered', 'recovery.triggered'],
  ['core.recovery.completed', 'recovery.completed'],
  ['core.error', 'kernel.error'],
]);

function createEventEnvelope(eventName, payload = {}, options = {}) {
  const timestampMs = options.timestampMs || Date.now();
  const eventType = normalizeEventType(eventName);
  const clonedPayload = clonePlainObject(payload);
  const correlationId = clonedPayload.correlation_id || clonedPayload.correlationId || crypto.randomUUID();
  const causationId = clonedPayload.causation_id || clonedPayload.causationId || options.causationId || null;
  const eventId = options.eventId || crypto.randomUUID();
  const metadata = clonePlainObject(options.metadata || clonedPayload.metadata || {});

  const envelope = {
    abi: EVENT_ABI,
    version: EVENT_VERSION,
    event_id: eventId,
    event_type: eventType,
    source_event_name: eventName,
    timestamp: new Date(timestampMs).toISOString(),
    timestamp_ms: timestampMs,
    goal_id: clonedPayload.goal_id || clonedPayload.goalId || null,
    workflow_id: clonedPayload.workflow_id || clonedPayload.workflowId || null,
    source: clonedPayload.source || options.source || 'kernel',
    correlation_id: correlationId,
    causation_id: causationId,
    payload: clonedPayload,
    metadata,

    // Compatibility-layer fields for existing subscribers.
    id: eventId,
    kernelVersion: EVENT_VERSION,
    stage: eventType.split('.')[1] || 'unknown',
    scope: clonedPayload.scope || 'global',
    capability: clonedPayload.capability || 'core',
    correlationId,
  };

  validateEventEnvelope(envelope);
  return deepFreeze(envelope);
}

function validateEventEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Event envelope must be an object');
  }
  if (envelope.abi !== EVENT_ABI) {
    throw new Error(`Invalid event ABI: ${envelope.abi}`);
  }
  if (envelope.version !== EVENT_VERSION) {
    throw new Error(`Invalid event version: ${envelope.version}`);
  }
  if (!isUuid(envelope.event_id)) {
    throw new Error('Event envelope requires event_id uuid');
  }
  validateEventType(envelope.event_type);
  if (!Number.isFinite(envelope.timestamp_ms)) {
    throw new Error('Event envelope requires timestamp_ms');
  }
  if (Number.isNaN(Date.parse(envelope.timestamp))) {
    throw new Error('Event envelope requires ISO timestamp');
  }
  if (!envelope.payload || typeof envelope.payload !== 'object') {
    throw new Error('Event envelope requires object payload');
  }
  if (!envelope.source || typeof envelope.source !== 'string') {
    throw new Error('Event envelope requires source');
  }
  if (!envelope.correlation_id || typeof envelope.correlation_id !== 'string') {
    throw new Error('Event envelope requires correlation_id');
  }
  if (!Object.prototype.hasOwnProperty.call(envelope, 'causation_id')) {
    throw new Error('Event envelope requires causation_id');
  }
  if (!envelope.metadata || typeof envelope.metadata !== 'object') {
    throw new Error('Event envelope requires metadata');
  }
  return true;
}

function validateEventType(eventType) {
  if (typeof eventType !== 'string' || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(eventType)) {
    throw new Error(`Invalid event_type shape: ${eventType}`);
  }

  const namespace = eventType.split('.')[0];
  if (FORBIDDEN_EVENT_NAMESPACES.has(namespace)) {
    throw new Error(`Industry event namespace is forbidden: ${namespace}`);
  }
  if (!ALLOWED_EVENT_NAMESPACES.has(namespace)) {
    throw new Error(`Unknown event namespace: ${namespace}`);
  }

  return true;
}

function normalizeEventType(eventName) {
  const raw = String(eventName || '').trim();
  if (!raw) {
    throw new Error('Event name is required');
  }

  const normalized = raw
    .replace(/::/g, '.')
    .replace(/:/g, '.')
    .replace(/_/g, '.')
    .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');

  return CORE_ALIASES.get(normalized) || normalized;
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function clonePlainObject(value) {
  return JSON.parse(JSON.stringify(value || {}));
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

module.exports = {
  ALLOWED_EVENT_NAMESPACES,
  EVENT_ABI,
  EVENT_VERSION,
  FORBIDDEN_EVENT_NAMESPACES,
  createEventEnvelope,
  deepFreeze,
  normalizeEventType,
  validateEventEnvelope,
  validateEventType,
};
