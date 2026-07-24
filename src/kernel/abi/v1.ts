/**
 * CHATR Kernel ABI v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * The frozen contract for the Universal Intelligence OS.
 *
 * RULES:
 *   1. This file defines interfaces only. No implementations.
 *   2. Nothing in this file may reference AI, MCP, REST, LLM, cloud,
 *      or any current technology. Those are plugins.
 *   3. Fields may not be added to existing interfaces without a major version
 *      bump to KernelABI.version.
 *   4. All kernel subsystems communicate ONLY through KernelABI.
 *      Never through internal module imports.
 *   5. All third-party plugins communicate ONLY through @chatr/sdk,
 *      which wraps these interfaces.
 *
 * NORTH-STAR REFERENCE:
 *   Every concept here maps to the v2.0 physics model:
 *     Entity       → Object
 *     Intent       → Object { desiredFutureState }
 *     Capability   → computed: Object + Actions + Constraints
 *     Knowledge    → emergent: Relationships over Time
 *     Resource     → Object (measurable, consumable state)
 *     Policy       → Constraint (legal | organizational)
 *     Event        → Transition (from/to state, time, space, cost)
 *
 * @version 1.0.0
 * @since   2026-07-20
 */

// ─────────────────────────────────────────────────────────────────────────────
// § 0 — Scalar Types
// ─────────────────────────────────────────────────────────────────────────────

export type EntityId      = string & { readonly _brand: 'EntityId' };
export type IntentId      = string & { readonly _brand: 'IntentId' };
export type CapabilityId  = string & { readonly _brand: 'CapabilityId' };
export type KnowledgeId   = string & { readonly _brand: 'KnowledgeId' };
export type ResourceId    = string & { readonly _brand: 'ResourceId' };
export type PolicyId      = string & { readonly _brand: 'PolicyId' };
export type EventId       = string & { readonly _brand: 'EventId' };
export type ProcessId     = string & { readonly _brand: 'ProcessId' };
export type PluginId      = string & { readonly _brand: 'PluginId' };
export type TokenId       = string & { readonly _brand: 'TokenId' };
export type ScheduleId    = string & { readonly _brand: 'ScheduleId' };
export type EvidenceId    = string & { readonly _brand: 'EvidenceId' };
export type Timestamp     = number; // Unix ms
export type SemVer        = string; // "MAJOR.MINOR.PATCH"
export type JSONSchema    = Record<string, unknown>;
export type Opaque        = unknown; // Kernel does not interpret this

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — The Seven Kernel Primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PRIMITIVE 1: Entity
 * ───────────────────
 * Everything that exists.
 * Human, AI, device, org, robot, API, document, memory, process.
 *
 * The kernel makes no distinction between entity types.
 * "type" is an open string — the kernel never validates it.
 * Plugins may define their own type taxonomies.
 *
 * v2.0 mapping: Entity → Object
 */
export interface Entity {
  readonly id:         EntityId;
  readonly type:       string;         // Open. 'human' | 'ai' | 'device' | ...
  readonly createdAt:  Timestamp;
  identity?:           Identity;       // Optional — not all entities have identity
  capabilities:        CapabilityId[];
  trust:               TrustVector;
  state:               EntityState;
  health:              HealthStatus;   // Real-time health
  relationships:       Edge[];
  permissions:         PermissionSet;
  economy:             EconomyRecord;
  location?:           Location;
  metadata:            Opaque;
}

/** A CapabilitySource is any Entity that can fulfill a Capability. */
export type CapabilitySource = Entity;

/**
 * PRIMITIVE 2: Intent
 * ───────────────────
 * Everything that wants something.
 * Human request, automation trigger, system goal, sensor threshold.
 *
 * "goal" is opaque — the kernel does not parse it.
 * The registered Planner plugin interprets goal.
 *
 * v2.0 mapping: Intent → Object { desiredFutureState }
 */
export interface Intent {
  readonly id:         IntentId;
  readonly source:     EntityId;
  readonly createdAt:  Timestamp;
  goal:                Opaque;         // Kernel never reads this
  constraints:         Constraint[];
  priority:            Priority;       // 0.0–1.0
  deadline?:           Timestamp;
  state:               IntentState;
  context:             Context;
  evidence:            EvidenceId[];
}

/**
 * PRIMITIVE 3: Capability
 * ───────────────────────
 * Everything that can be done.
 * Described by a primitive operation and typed I/O schemas.
 *
 * v2.0 mapping: Capability → computed from Object + Actions + Constraints
 *               (stored in v1.0, emergent in v2.0)
 */
export interface Capability {
  readonly id:         CapabilityId;
  readonly primitive:  Primitive;
  version:             SemVer;
  inputSchema:         JSONSchema;
  outputSchema:        JSONSchema;
  requiredPermissions: Permission[];
  requiredResources:   ResourceRequirement[];
  costEstimate:        ResourceCost;
  trustRequired:       number;         // 0.0–1.0
  certification:       CapabilityCertification;
  contract:            CapabilityContract;
}

/**
 * PRIMITIVE 4: Knowledge
 * ──────────────────────
 * Everything that is known.
 * Facts, rules, memories, evidence, policies, embeddings.
 *
 * "content" is opaque — the kernel stores it but never interprets it.
 * Reasoner plugins interpret knowledge.
 *
 * v2.0 mapping: Knowledge → emergent from Relationships over Time
 *               (stored in v1.0, emergent in v2.0)
 */
export interface Knowledge {
  readonly id:         KnowledgeId;
  readonly type:       KnowledgeType;
  readonly source:     EntityId;
  readonly createdAt:  Timestamp;
  content:             Opaque;         // Kernel never reads this
  confidence:          number;         // 0.0–1.0
  trust:               TrustVector;
  expiresAt?:          Timestamp;
  lineage:             KnowledgeId[];  // Derived from
}

/**
 * PRIMITIVE 5: Resource
 * ─────────────────────
 * Everything that is consumed.
 * CPU, money, tokens, human time, energy, API quota, attention.
 *
 * The Resource Scheduler treats all resource types identically.
 *
 * v2.0 mapping: Resource → Object (measurable, consumable state)
 */
export interface Resource {
  readonly id:         ResourceId;
  readonly type:       ResourceType;
  owner:               EntityId;
  total:               number;
  allocated:           number;
  consumed:            number;
  unit:                string;
  costPerUnit:         number;         // USD
  limit?:              number;
  priority:            Priority;
}

/**
 * PRIMITIVE 6: Policy
 * ───────────────────
 * Everything that constrains decisions.
 * Governance rules, permissions, compliance, budget caps.
 *
 * Policies are evaluated by the Governance Engine before any
 * capability invocation. The kernel does not execute policies —
 * the Policy Engine plugin does.
 *
 * v2.0 mapping: Policy → Constraint (legal | organizational subset)
 */
export interface Policy {
  readonly id:         PolicyId;
  readonly version:    SemVer;
  scope:               PolicyScope;
  conditions:          Condition[];
  effect:              'allow' | 'deny' | 'escalate';
  priority:            number;
  expiresAt?:          Timestamp;
  authority:           EntityId;
}

/**
 * PRIMITIVE 7: Event (Transition in v2.0)
 * ──────────────────
 * Everything that happens.
 * No special event types. One model for all occurrences.
 *
 * "payload" is opaque — the kernel routes events but never reads payload.
 * Subscribers interpret payload according to "type".
 */
export interface KernelEvent {
  readonly id:         EventId;
  readonly type:       string;         // Open. 'intent.completed' | ...
  readonly source:     EntityId;       // Where it originated
  readonly timestamp:  Timestamp;
  
  // Tracing & Causal Metadata
  correlationId?:      string;         // Links related events in a transaction
  causationId?:        string;         // ID of the event that triggered this one
  intentId?:           IntentId;       // Which intent this belongs to
  processId?:          ProcessId;      // Which execution process fired this
  traceId?:            string;         // Distributed tracing span ID
  
  target?:             EntityId;
  payload:             Opaque;         // Kernel never reads this
  trust:               TrustVector;
  cost:                ResourceCost;
  location?:           Location;
  
  priority:            EventPriority;
  schemaVersion:       SemVer;
}

export type EventPriority =
  | 'CRITICAL'    // System instability, security violation
  | 'HIGH'        // User intent execution, policy evaluation
  | 'NORMAL'      // Standard state transitions
  | 'LOW'         // Telemetry, non-blocking updates
  | 'BACKGROUND'; // Audit logging, archiving

/**
 * PRIMITIVE 8: Process (Execution Backbone)
 * ───────────────────
 * Everything that runs.
 * Jobs, Workflows, Actors, Daemons, Cron jobs.
 */
export type ProcessState =
  | 'SPAWNING'
  | 'DISCOVERING'
  | 'RANKING'
  | 'ALLOCATING'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type ProcessType =
  | 'Actor'
  | 'Workflow'
  | 'Job'
  | 'Session'
  | 'Daemon'
  | 'Thread'
  | 'Cron';

export interface ProcessNode {
  readonly id:         ProcessId;
  readonly intentId:   IntentId;
  type:                ProcessType;
  state:               ProcessState;
  createdAt:           Timestamp;
  updatedAt:           Timestamp;
  completedAt?:        Timestamp;
  evidenceId?:         EvidenceId;
  error?:              string;
  maxRetries?:         number;
  retriesAttempted?:   number;
  // Type-specific metadata
  cronSchedule?:       string;
  actorState?:         any;
  workflowGraph?:      any;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Supporting Types
// ─────────────────────────────────────────────────────────────────────────────

/** 18 universal action primitives. All capabilities compose from these. */
export type Primitive =
  | 'OBSERVE'       // Perceive, detect, measure, sense
  | 'THINK'         // Reason, classify, infer, decide
  | 'LEARN'         // Adapt, train, improve, update
  | 'REMEMBER'      // Recall, store, archive, forget
  | 'COMMUNICATE'   // Send, receive, broadcast, notify
  | 'MOVE'          // Navigate, transport, deploy, relocate
  | 'CREATE'        // Generate, build, synthesize, compose
  | 'DESTROY'       // Delete, revoke, terminate, remove
  | 'PAY'           // Transfer value, invoice, reward
  | 'CONTROL'       // Authorize, restrict, delegate
  | 'VERIFY'        // Validate, sign, audit, certify
  | 'TRANSFORM'     // Convert, translate, normalize, encode
  | 'STORE'         // Persist, index, backup, cache
  | 'RETRIEVE'      // Search, query, stream, fetch
  | 'COORDINATE'    // Orchestrate, negotiate, synchronize
  | 'PREDICT'       // Forecast, simulate, model, estimate
  | 'SCHEDULE'      // Time, defer, repeat, prioritize
  | 'ALLOCATE';     // Assign resources, budget, quota

export type ResourceType =
  | 'compute'        // CPU / GPU time
  | 'memory'         // RAM
  | 'bandwidth'      // Network I/O
  | 'storage'        // Disk / cloud
  | 'money'          // USD
  | 'tokens'         // LLM context window
  | 'energy'         // Watts / carbon
  | 'human_time'     // Person-hours
  | 'robot_time'     // Machine-hours
  | 'attention'      // User focus slots
  | 'battery'        // Device power
  | 'api_quota'      // Rate-limited calls
  | string;          // Open — new resource types allowed

export type KnowledgeType =
  | 'fact'           // A truth about the world
  | 'rule'           // A conditional logic statement
  | 'ontology'       // A taxonomy or classification
  | 'embedding'      // A semantic vector
  | 'policy'         // A governance constraint (stored as knowledge)
  | 'memory'         // A remembered experience
  | 'evidence'       // A verified execution output
  | 'statistic'      // A measurement
  | 'model'          // A predictive or generative model reference
  | 'history'        // A temporal record
  | string;

export type IntentState =
  | 'received'       // Arrived, not yet parsed
  | 'understood'     // Parsed and classified
  | 'planned'        // Decomposed into tasks + capabilities
  | 'resolving'      // Finding providers
  | 'executing'      // Running
  | 'verifying'      // Checking results
  | 'completed'      // Succeeded
  | 'failed'         // Could not complete
  | 'cancelled'      // Stopped by entity or governance
  | 'learning';      // Updating knowledge from outcome

export type EntityState =
  | 'dormant'        // Registered, not yet active
  | 'active'         // Operational
  | 'suspended'      // Temporarily halted (resource / policy)
  | 'terminated'     // Permanently stopped
  | 'archived';      // History preserved, entity inactive

export type PolicyScope   = 'entity' | 'capability' | 'resource' | 'global';
export type Priority      = number;  // 0.0–1.0

export type HealthStatus = 
  | 'ONLINE' 
  | 'DEGRADED' 
  | 'OFFLINE' 
  | 'RATE_LIMITED' 
  | 'QUARANTINED';

export type CapabilityCertification =
  | 'DISCOVERED'
  | 'VERIFIED'
  | 'CERTIFIED'
  | 'PREFERRED'
  | 'DEPRECATED'
  | 'RETIRED';

export interface CapabilityContract {
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  version: SemVer;
  timeoutMs: number;
  cost: ResourceCost;
  permissions: Permission[];
  sideEffects: string[];
  retryPolicy: { maxRetries: number; backoffMs: number };
}

export interface TrustVector {
  // Original
  confidence:         number;        // 0–1: certainty in outputs
  reputation:         number;        // 0–1: historical track record
  verification:       number;        // 0–1: identity confirmed
  reliability:        number;        // 0–1: uptime + consistency
  security:           number;        // 0–1: vulnerability history
  compliance:         number;        // 0–1: policy adherence
  privacy:            number;        // 0–1: data handling
  // Expanded
  latency:            number;        // 0-1: speed score
  costEfficiency:     number;        // 0-1: value per dollar
  freshness:          number;        // 0-1: recent usage
  userRating:         number;        // 0-1: human feedback
  kernelConfidence:   number;        // 0-1: internal kernel metric
}

export interface Identity {
  id:                 string;
  type:               'verified' | 'anonymous' | 'delegated' | 'temporary' | 'collective' | 'synthetic';
  credentials:        Opaque[];
  authority:          EntityId;
  validFrom:          Timestamp;
  validUntil?:        Timestamp;
  scope:              string[];
}

export interface Location {
  type:               'physical' | 'digital' | 'virtual' | 'logical';
  coordinates?:       { lat: number; lng: number; alt?: number };
  network?:           string;
  jurisdiction?:      string;
  region?:            string;
  topology?:          string;
}

export interface Edge {
  id:                 string;
  from:               EntityId;
  to:                 EntityId;
  type:               string;        // Open. 'owns' | 'controls' | 'created' | ...
  strength:           number;        // 0.0–1.0
  validFrom:          Timestamp;
  validUntil?:        Timestamp;
}

export interface Context {
  entityId:           EntityId;
  location?:          Location;
  timestamp:          Timestamp;
  sessionId?:         string;
  organizationId?:    EntityId;
  locale?:            string;
  environment?:       'cloud' | 'edge' | 'mobile' | 'desktop' | 'embedded' | 'offline';
  metadata:           Opaque;
  abortSignal?:       AbortSignal;
}

export interface Constraint {
  type:               string;        // 'legal' | 'financial' | 'physical' | 'temporal' | ...
  description:        string;
  value:              Opaque;
  severity:           'hard' | 'soft';  // hard = cannot violate, soft = prefer not to
}

export interface Condition {
  field:              string;
  operator:           'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value:              Opaque;
}

export interface Permission {
  resource:           string;
  action:             string;
  scope:              'read' | 'write' | 'execute' | 'admin';
}

export interface PermissionSet {
  granted:            Permission[];
  denied:             Permission[];
}

export interface EconomyRecord {
  credits:            number;
  spent:              number;
  earned:             number;
  currency:           string;
  budget?:            number;
}

export interface ResourceRequirement {
  type:               ResourceType;
  amount:             number;
  unit:               string;
  priority:           Priority;
}

export interface ResourceCost {
  resources:          Array<{ type: ResourceType; amount: number; unit: string }>;
  totalUSD:           number;
}

export interface PolicyAction {
  actor:              EntityId;
  capability:         CapabilityId;
  target?:            EntityId;
  context:            Context;
  parameters:         Opaque;
}

export interface ExecutionPolicy {
  optimize:           'fastest' | 'cheapest' | 'highest_quality' | 'balanced' | 'enterprise' | 'offline' | 'private' | 'green';
  maxCostUSD?:        number;
  maxLatencyMs?:      number;
  minTrust?:          number;
  requiredCompliance?: string[];
  allowedRegions?:    string[];
}

export interface ResourceToken {
  id:                 string;
  intentId:           IntentId;
  resources:          ResourceId[];
  expiresAt:          Timestamp;
}

export interface CapabilityToken {
  readonly id:        TokenId;
  readonly entityId:  EntityId;
  readonly capability: CapabilityId;
  readonly issuedAt:  Timestamp;
  readonly expiresAt: Timestamp;
  readonly signature: string;
  readonly nonce:     string;          // Single-use
  scope:              Opaque;          // Allowed parameter bounds
}

export type TokenScope = Opaque;

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Plugin Manifest
// ─────────────────────────────────────────────────────────────────────────────

export interface PluginManifest {
  id:                 string;         // Unique, e.g. 'openmeteo.weather'
  type:               PluginType;
  version:            SemVer;
  name:               string;
  description:        string;
  author:             string;
  license:            string;

  requires: {
    abi:              string;         // Compatible ABI version range, e.g. '1.x'
    resources?:       string[];       // 'network' | 'compute' | ...
    permissions?:     Permission[];
  };

  provides: {
    capabilities?:    CapabilityManifest[];
    transports?:      TransportManifest[];
    planners?:        PlannerManifest[];
    knowledge?:       KnowledgeManifest[];
  };

  security: {
    sandboxed:        boolean;
    dataLeavesDevice: boolean;
    signature:        string;         // Publisher signature
    verifiedBy?:      string[];
  };

  cost: {
    model:            'free' | 'per_call' | 'subscription' | 'usage';
    amount?:          number;
    currency?:        string;
  };
}

export type PluginType =
  | 'capability'     // Adds new capabilities
  | 'transport'      // New execution protocol
  | 'planner'        // Intent decomposition engine
  | 'reasoner'       // Knowledge inference engine
  | 'memory'         // Memory module
  | 'experience'     // New UI surface
  | 'policy'         // Governance ruleset
  | 'knowledge'      // Domain knowledge pack
  | 'model'          // AI/ML model
  | 'security'       // Security module
  | 'economy'        // Billing / economy module
  | 'industry';      // Vertical capability pack

export interface CapabilityManifest {
  id:                 CapabilityId;
  primitive:          Primitive;
  version:            SemVer;
  inputSchema:        JSONSchema;
  outputSchema:       JSONSchema;
  trustRequired:      number;
  costEstimate:       ResourceCost;
}

export interface TransportManifest {
  id:                 string;         // 'REST' | 'MCP' | 'BROWSER' | ...
  version:            SemVer;
  protocols:          string[];
}

export interface PlannerManifest {
  id:                 string;
  version:            SemVer;
  supportedPrimitives: Primitive[];
}

export interface KnowledgeManifest {
  id:                 string;
  type:               KnowledgeType;
  domain:             string;
  version:            SemVer;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Draft Types (input to ABI calls)
// ─────────────────────────────────────────────────────────────────────────────

export type EntityManifest  = Omit<Entity, 'id' | 'createdAt'>;
export type IntentDraft     = Omit<Intent, 'id' | 'createdAt' | 'state' | 'evidence'>;
export type KnowledgeDraft  = Omit<Knowledge, 'id' | 'createdAt'>;
export type EventDraft      = Omit<KernelEvent, 'id' | 'timestamp' | 'schemaVersion'>;
export type PolicyDraft     = Omit<Policy, 'id'>;

export interface KnowledgeQuery {
  type?:              KnowledgeType;
  source?:            EntityId;
  minConfidence?:     number;
  maxAge?:            number;          // ms since creation
  relatedTo?:         KnowledgeId[];
  limit?:             number;
}

export interface EntityQuery {
  type?:              string;
  hasCapability?:     CapabilityId;
  minTrust?:          number;
  location?:          Partial<Location>;
  state?:             EntityState;
  limit?:             number;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — Process Model
// ─────────────────────────────────────────────────────────────────────────────

export type ProcessType =
  | 'job'            // Single execution, returns result
  | 'session'        // Interactive, entity-driven
  | 'workflow'       // Multi-step, long-running
  | 'actor'          // Autonomous, event-driven
  | 'daemon'         // Persistent background process
  | 'thread'         // Lightweight sub-process
  | 'cron';          // Scheduled repeating job

export type ProcessState =
  | 'created' | 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled';

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — The Kernel ABI Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KernelABI — The 25 syscalls.
 *
 * This is the ONLY interface through which anything communicates
 * with the kernel. Internal implementations are invisible.
 *
 * No implementation of this interface may:
 *   - Import from AI or LLM libraries directly
 *   - Reference MCP, REST, GraphQL, or any transport
 *   - Reference cloud providers (AWS, GCP, Supabase)
 *   - Reference business domains (recruitment, healthcare, etc.)
 *
 * All of the above are plugins that call THROUGH this interface.
 */
export interface KernelABI {

  /** ABI version. Plugins check compatibility against this. */
  readonly version: '1.0.0';

  // ── Entity Syscalls ─────────────────────────────────────────────────────

  /** Register an entity with the kernel. Returns immutable EntityId. */
  registerEntity(manifest: EntityManifest): Promise<EntityId>;

  /** Resolve entities by query. */
  resolveEntity(query: EntityQuery): Promise<Entity[]>;

  /** Update mutable entity fields. Immutable fields (id, type, createdAt) cannot change. */
  updateEntity(id: EntityId, delta: Partial<Omit<Entity, 'id' | 'type' | 'createdAt'>>): Promise<void>;

  // ── Intent Syscalls ─────────────────────────────────────────────────────

  /** Submit intent to the kernel. Routed to the registered Planner plugin. */
  submitIntent(intent: IntentDraft): Promise<IntentId>;

  /** Query intent state. */
  queryIntent(id: IntentId): Promise<Intent>;

  /** Cancel a running intent. */
  cancelIntent(id: IntentId, reason: string): Promise<void>;

  // ── Process Syscalls ────────────────────────────────────────────────────

  /** Spawn an execution process for an Intent */
  spawnProcess(intentId: IntentId, type: ProcessType): Promise<ProcessId>;

  /** Query process state */
  queryProcess(id: ProcessId): Promise<ProcessNode>;

  /** Kill an active process */
  killProcess(id: ProcessId, reason: string): Promise<void>;

  // ── Capability Syscalls ─────────────────────────────────────────────────

  /** Register a capability. Called by provider plugins on install. */
  registerCapability(cap: CapabilityManifest): Promise<CapabilityId>;

  /**
   * Resolve which entities can fulfill a capability.
   * Returns ranked candidates: trust × cost × policy × context.
   */
  resolveCapability(
    id: CapabilityId,
    context: Context,
    policy?: ExecutionPolicy
  ): Promise<Entity[]>;

  /**
   * Invoke a capability on a specific entity.
   * Requires a valid CapabilityToken.
   * Returns an EvidenceId when complete.
   */
  invokeCapability(
    capabilityId: CapabilityId,
    entityId: EntityId,
    params: Opaque,
    token: CapabilityToken,
    context: Context
  ): Promise<EvidenceId>;

  // ── Knowledge Syscalls ──────────────────────────────────────────────────

  /** Store a knowledge node. */
  storeKnowledge(node: KnowledgeDraft): Promise<KnowledgeId>;

  /** Query knowledge nodes. */
  queryKnowledge(query: KnowledgeQuery): Promise<Knowledge[]>;

  /** Verify and sign a knowledge node. Increases its trust score. */
  verifyKnowledge(id: KnowledgeId, verifier: EntityId): Promise<void>;

  // ── Resource Syscalls ───────────────────────────────────────────────────

  /**
   * Allocate resources for an intent.
   * Returns a ResourceToken used to release on completion.
   */
  allocateResources(
    intentId: IntentId,
    requirements: ResourceRequirement[]
  ): Promise<ResourceToken>;

  /** Release resources back to the pool. */
  releaseResources(token: ResourceToken): Promise<void>;

  /** Query current resource availability. */
  queryResources(type?: ResourceType): Promise<Resource[]>;

  // ── Policy Syscalls ─────────────────────────────────────────────────────

  /** Register a governance policy. */
  registerPolicy(policy: PolicyDraft): Promise<PolicyId>;

  /**
   * Evaluate all applicable policies for a proposed action.
   * Must be called before any capability invocation.
   */
  evaluatePolicies(action: PolicyAction): Promise<'allow' | 'deny' | 'escalate'>;

  // ── Event Syscalls ──────────────────────────────────────────────────────

  /** Publish an event to the Intelligence Bus. */
  publishEvent(event: EventDraft): Promise<EventId>;

  /**
   * Subscribe to events matching a type pattern.
   * Supports wildcards: 'intent.*', 'capability.resolved', etc.
   * Returns an unsubscribe function.
   */
  subscribeEvents(
    pattern: string,
    handler: (event: KernelEvent) => void
  ): () => void;

  // ── Plugin Syscalls ─────────────────────────────────────────────────────

  /** Install a plugin from a manifest. */
  installPlugin(manifest: PluginManifest): Promise<PluginId>;

  /** Register a transport adapter (called by transport plugins). */
  registerTransport(transport: TransportManifest): Promise<void>;

  /**
   * Register a planner plugin.
   * The planner handles intent decomposition.
   * Only one planner is active at a time.
   */
  registerPlanner(planner: PlannerManifest): Promise<void>;

  // ── Security Syscalls ───────────────────────────────────────────────────

  /**
   * Issue a capability token for a specific entity + capability pair.
   * Required before invokeCapability.
   * Tokens are single-use and expire.
   */
  issueCapabilityToken(
    entityId: EntityId,
    capabilityId: CapabilityId,
    scope: TokenScope
  ): Promise<CapabilityToken>;

  /** Verify a capability token. Returns false if expired, used, or invalid. */
  verifyCapabilityToken(token: CapabilityToken): Promise<boolean>;
}
