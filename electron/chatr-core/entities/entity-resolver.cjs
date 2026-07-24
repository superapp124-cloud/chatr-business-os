'use strict';

const crypto = require('crypto');
const { ENTITY } = require('../events/events.cjs');

const ABI = 'chatr.entity_graph.v0_9_rc';
const GRAPH_COLLECTION = 'kernel_entity_graphs_v0_9_rc';

const LEADING_ACTION_PATTERN = /\b(order|book|pay|renew|transfer|reserve|find|get|buy|select|compare|search)\b\s+(?:a\s+|an\s+|the\s+|some\s+)?([^,.;]+)/i;
const MONEY_PATTERN = /\b(?:inr|rs\.?|usd|\$)?\s*\d[\d,]*(?:\.\d{1,2})?\b/i;
const TEMPORAL_PATTERN = /\b(?:today|tomorrow|tonight|morning|afternoon|evening|weekend|next\s+week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const PLACE_PATTERN = /\b(to|from|in|at)\s+([A-Z][A-Za-z0-9 '&.-]{1,60})(?=\s|$|[,.;])/g;

class EntityResolver {
  constructor(options = {}) {
    this.persistence = options.persistence || getDefaultPersistence();
    this.bus = options.bus || getDefaultBus();
    this.now = normalizeNow(options.now);
    this.ontology = options.ontology || createDefaultOntology();
    this.graphs = new Map();
    this.loadFromDisk();
  }

  async resolve(input = {}) {
    const contextFrame = input.context_frame || input.contextFrame || null;
    const request = normalizeRequest(input, contextFrame);
    const goalId = input.goal_id || input.goalId || contextFrame?.goal_id || null;
    const contextRef = input.context_ref || input.contextRef || contextFrame?.context_id || null;
    const correlationId = input.correlation_id || input.correlationId || goalId || request.request_id;
    const resolvedAt = this.now();

    this.publish(ENTITY.RESOLVING, {
      goal_id: goalId,
      request_id: request.request_id,
      context_ref: contextRef,
      correlation_id: correlationId,
      source: 'EntityResolver',
    });

    const candidates = collectCandidates(request, input.extracted_entities || input.extractedEntities || []);
    const entities = [];

    for (let index = 0; index < candidates.length; index += 1) {
      entities.push(await this.resolveCandidate(candidates[index], {
        contextFrame,
        context_ref: contextRef,
        goal_id: goalId,
        request,
        index,
        resolved_at: resolvedAt,
      }));
    }

    const graph = {
      abi: ABI,
      graph_id: null,
      goal_id: goalId,
      request_id: request.request_id,
      context_ref: contextRef,
      resolved_at: resolvedAt,
      request,
      entities,
      edges: createEdges(entities),
      ambiguity: entities
        .filter((entity) => entity.confidence < 0.7 || entity.ontology.confidence < 0.7)
        .map((entity) => ({
          entity_id: entity.entity_id,
          reason: 'low_confidence',
          confidence: Math.min(entity.confidence, entity.ontology.confidence),
        })),
      provenance: {
        resolver: 'EntityResolver',
        ontology_source: getOntologySource(this.ontology),
        resolved_at: resolvedAt,
      },
    };

    graph.graph_id = createGraphId(graph);
    validateEntityGraph(graph);

    const immutableGraph = deepFreeze(graph);
    this.graphs.set(immutableGraph.graph_id, immutableGraph);
    this.persist();

    this.publish(ENTITY.RESOLVED, {
      goal_id: goalId,
      request_id: request.request_id,
      context_ref: contextRef,
      entity_graph_ref: immutableGraph.graph_id,
      graph: immutableGraph,
      correlation_id: correlationId,
      source: 'EntityResolver',
    });

    return immutableGraph;
  }

  async resolveCandidate(candidate, context) {
    const ontology = normalizeOntologyResult(
      await resolveOntology(this.ontology, candidate, context),
      candidate,
    );

    return {
      entity_id: createEntityId(candidate, context.request.request_id, context.index),
      text: candidate.text,
      normalized_text: normalizeText(candidate.text),
      canonical_name: ontology.canonical_name || candidate.text.trim(),
      role: candidate.role,
      span: candidate.span,
      confidence: candidate.confidence,
      ontology,
      constraints: candidate.constraints || {},
      provenance: {
        source: candidate.source,
        resolver: 'EntityResolver',
        context_ref: context.context_ref,
        resolved_at: context.resolved_at,
      },
    };
  }

  getGraph(graphId) {
    return this.graphs.get(graphId) || null;
  }

  listGraphs() {
    return Array.from(this.graphs.values());
  }

  loadFromDisk() {
    const stored = this.persistence.retrieve(GRAPH_COLLECTION);
    this.graphs.clear();

    for (const graph of stored?.graphs || []) {
      try {
        validateEntityGraph(graph);
        this.graphs.set(graph.graph_id, deepFreeze(graph));
      } catch {
        // Invalid persisted entity graphs are ignored during recovery.
      }
    }

    return this.listGraphs();
  }

  persist() {
    return this.persistence.store(GRAPH_COLLECTION, {
      abi: ABI,
      graphs: this.listGraphs(),
      updated_at: this.now(),
    });
  }

  publish(eventName, payload) {
    if (this.bus && typeof this.bus.publish === 'function') {
      this.bus.publish(eventName, payload);
    }
  }
}

let defaultEntityResolver = null;

function getEntityResolver() {
  if (!defaultEntityResolver) {
    defaultEntityResolver = new EntityResolver();
  }
  return defaultEntityResolver;
}

function normalizeNow(now) {
  if (typeof now === 'function') {
    return now;
  }
  return () => new Date().toISOString();
}

function normalizeRequest(input, contextFrame) {
  const request = input.request || contextFrame?.request || {};
  const rawText = String(
    request.raw_text
      || request.rawText
      || request.text
      || input.raw_text
      || input.rawText
      || input.text
      || '',
  );
  const normalizedText = String(request.normalized_text || request.normalizedText || rawText)
    .trim()
    .replace(/\s+/g, ' ');

  const normalized = {
    request_id: request.request_id || request.requestId || input.request_id || input.requestId || contextFrame?.request_id || null,
    raw_text: rawText,
    normalized_text: normalizedText,
    source: request.source || input.source || 'user',
    metadata: clonePlainObject(request.metadata || input.metadata || {}),
  };

  if (!normalized.request_id) {
    normalized.request_id = `request_${hashStable(normalized).slice(0, 32)}`;
  }

  return normalized;
}

function collectCandidates(request, extractedEntities) {
  const candidates = [];
  const text = request.raw_text || request.normalized_text || '';

  for (const entity of extractedEntities) {
    candidates.push(normalizeCandidate({
      text: entity.text || entity.value || entity.name,
      role: entity.role || 'explicit',
      confidence: entity.confidence ?? 0.9,
      source: entity.source || 'planner',
      span: entity.span || findSpan(text, entity.text || entity.value || entity.name),
      constraints: entity.constraints || {},
    }));
  }

  const leading = text.match(LEADING_ACTION_PATTERN);
  if (leading) {
    const leadingText = trimEntityPhrase(leading[2]);
    candidates.push(normalizeCandidate({
      text: leadingText,
      role: roleForLeadingPhrase(leadingText),
      confidence: 0.86,
      source: 'request_text',
      span: findSpan(text, leading[2]),
    }));
  }

  const money = text.match(MONEY_PATTERN);
  if (money) {
    candidates.push(normalizeCandidate({
      text: money[0],
      role: 'amount',
      confidence: 0.96,
      source: 'request_text',
      span: { start: money.index, end: money.index + money[0].length },
    }));
  }

  const temporal = text.match(TEMPORAL_PATTERN);
  if (temporal) {
    candidates.push(normalizeCandidate({
      text: temporal[0],
      role: 'time',
      confidence: 0.94,
      source: 'request_text',
      span: { start: temporal.index, end: temporal.index + temporal[0].length },
    }));
  }

  for (const match of text.matchAll(PLACE_PATTERN)) {
    candidates.push(normalizeCandidate({
      text: match[2],
      role: match[1].toLowerCase() === 'from' ? 'origin' : 'destination',
      confidence: 0.82,
      source: 'request_text',
      span: { start: match.index + match[1].length + 1, end: match.index + match[0].length },
    }));
  }

  return dedupeCandidates(candidates).filter((candidate) => candidate.text.length > 0);
}

function normalizeCandidate(candidate) {
  return {
    text: String(candidate.text || '').trim(),
    role: String(candidate.role || 'candidate').trim().toLowerCase(),
    confidence: clampConfidence(candidate.confidence),
    source: candidate.source || 'unknown',
    span: normalizeSpan(candidate.span),
    constraints: clonePlainObject(candidate.constraints || {}),
  };
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const output = [];

  for (const candidate of candidates) {
    const key = `${candidate.role}:${normalizeText(candidate.text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }

  return output;
}

async function resolveOntology(ontology, candidate, context) {
  if (ontology && typeof ontology.resolve === 'function') {
    return ontology.resolve(candidate, context);
  }
  if (typeof ontology === 'function') {
    return ontology(candidate, context);
  }
  return createDefaultOntology().resolve(candidate, context);
}

function createDefaultOntology() {
  return {
    source: 'kernel_shape',
    resolve(candidate) {
      const type = inferEntityType(candidate);
      return {
        canonical_name: candidate.text.trim(),
        type,
        lineage: ['Entity', type],
        confidence: candidate.confidence,
        source: 'kernel_shape',
      };
    },
  };
}

function inferEntityType(candidate) {
  if (candidate.role === 'amount' || MONEY_PATTERN.test(candidate.text)) {
    return 'Amount';
  }
  if (candidate.role === 'time' || TEMPORAL_PATTERN.test(candidate.text)) {
    return 'TemporalReference';
  }
  if (candidate.role === 'origin' || candidate.role === 'destination' || candidate.role === 'location') {
    return 'Place';
  }
  return 'Object';
}

function normalizeOntologyResult(result, candidate) {
  const fallbackType = inferEntityType(candidate);
  const value = result && typeof result === 'object' ? result : {};
  const type = String(value.type || fallbackType);
  const lineage = Array.isArray(value.lineage) && value.lineage.length > 0
    ? value.lineage.map(String)
    : ['Entity', type];

  return {
    canonical_name: value.canonical_name || value.canonicalName || candidate.text.trim(),
    type,
    lineage,
    confidence: clampConfidence(value.confidence ?? candidate.confidence),
    source: value.source || 'kernel_shape',
    matches: Array.isArray(value.matches) ? clonePlainObject(value.matches) : [],
  };
}

function createEdges(entities) {
  return entities.map((entity) => ({
    edge_id: `edge_${hashStable({ from: 'graph', to: entity.entity_id, type: 'CONTAINS_ENTITY' }).slice(0, 32)}`,
    from: 'graph',
    to: entity.entity_id,
    type: 'CONTAINS_ENTITY',
    confidence: entity.confidence,
  }));
}

function validateEntityGraph(graph) {
  if (!graph || typeof graph !== 'object') {
    throw new Error('EntityGraph must be an object');
  }
  if (graph.abi !== ABI) {
    throw new Error(`Invalid EntityGraph ABI: ${graph.abi}`);
  }
  if (!graph.graph_id || typeof graph.graph_id !== 'string') {
    throw new Error('EntityGraph requires graph_id');
  }
  if (!graph.request_id || typeof graph.request_id !== 'string') {
    throw new Error('EntityGraph requires request_id');
  }
  if (Number.isNaN(Date.parse(graph.resolved_at))) {
    throw new Error('EntityGraph requires resolved_at ISO timestamp');
  }
  if (!Array.isArray(graph.entities)) {
    throw new Error('EntityGraph requires entities array');
  }
  if (!Array.isArray(graph.edges)) {
    throw new Error('EntityGraph requires edges array');
  }
  if (!Array.isArray(graph.ambiguity)) {
    throw new Error('EntityGraph requires ambiguity array');
  }

  for (const entity of graph.entities) {
    validateEntity(entity);
  }

  return true;
}

function validateEntity(entity) {
  if (!entity.entity_id || typeof entity.entity_id !== 'string') {
    throw new Error('Entity requires entity_id');
  }
  if (!entity.text || typeof entity.text !== 'string') {
    throw new Error('Entity requires text');
  }
  if (!entity.normalized_text || typeof entity.normalized_text !== 'string') {
    throw new Error('Entity requires normalized_text');
  }
  if (!entity.role || typeof entity.role !== 'string') {
    throw new Error('Entity requires role');
  }
  if (!Number.isFinite(entity.confidence)) {
    throw new Error('Entity requires confidence');
  }
  if (!entity.ontology || typeof entity.ontology !== 'object') {
    throw new Error('Entity requires ontology');
  }
}

function createGraphId(graph) {
  const payload = clonePlainObject(graph);
  delete payload.graph_id;
  return `entity_graph_${hashStable(payload).slice(0, 32)}`;
}

function createEntityId(candidate, requestId, index) {
  return `entity_${hashStable({
    request_id: requestId,
    index,
    role: candidate.role,
    text: normalizeText(candidate.text),
  }).slice(0, 32)}`;
}

function trimEntityPhrase(value) {
  return String(value || '')
    .replace(/\s+\b(?:from|to|for|on|at|with|using|by)\b.*$/i, '')
    .trim();
}

function roleForLeadingPhrase(value) {
  const text = String(value || '').trim();
  if (MONEY_PATTERN.test(text) && text.replace(MONEY_PATTERN, '').trim().length === 0) {
    return 'amount';
  }
  if (TEMPORAL_PATTERN.test(text) && text.replace(TEMPORAL_PATTERN, '').trim().length === 0) {
    return 'time';
  }
  return 'target';
}

function findSpan(text, value) {
  const needle = String(value || '').trim();
  const start = needle ? String(text || '').toLowerCase().indexOf(needle.toLowerCase()) : -1;
  return start >= 0
    ? { start, end: start + needle.length }
    : { start: null, end: null };
}

function normalizeSpan(span) {
  if (!span || typeof span !== 'object') {
    return { start: null, end: null };
  }
  return {
    start: Number.isFinite(span.start) ? span.start : null,
    end: Number.isFinite(span.end) ? span.end : null,
  };
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (number > 1) return Math.max(0, Math.min(1, number / 100));
  return Math.max(0, Math.min(1, number));
}

function getOntologySource(ontology) {
  if (ontology?.source) return ontology.source;
  if (ontology?.name) return ontology.name;
  return 'kernel_shape';
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
  GRAPH_COLLECTION,
  EntityResolver,
  collectCandidates,
  createDefaultOntology,
  createGraphId,
  deepFreeze,
  getEntityResolver,
  normalizeRequest,
  validateEntityGraph,
};

Object.defineProperty(exported, 'entityResolver', {
  enumerable: true,
  get: getEntityResolver,
});

module.exports = exported;
