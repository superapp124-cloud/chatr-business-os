/**
 * CHATR Kernel Runtime v2.0 — Shared Type Contracts
 *
 * Layer 2 foundation. All runtime, engine, and service types live here.
 * No imports from outside this directory — this is the bottom of the dep graph.
 */

// ─── Engine ──────────────────────────────────────────────────────────────────

export type EngineStatus = 'booting' | 'ready' | 'degraded' | 'recovering' | 'failed' | 'stopped' | 'crashed';

export interface EngineHealth {
  status: EngineStatus;
  latencyMs?: number;
  memoryBytes?: number;
  lastChecked: number;
  error?: string;
}

export interface PerformanceBudget {
  kernelBootMs: number;
  engineBootMs: number;
  commandExecutionMs: number;
  eventDeliveryMs: number;
  stateUpdateMs: number;
  searchQueryMs: number;
}

export const TARGET_PERFORMANCE_BUDGET: PerformanceBudget = {
  kernelBootMs: 500,
  engineBootMs: 100,
  commandExecutionMs: 50,
  eventDeliveryMs: 5,
  stateUpdateMs: 16,
  searchQueryMs: 100,
};

/** Every engine must implement this interface. The RuntimeSupervisor uses it. */
export interface IEngine {
  readonly id: string;
  readonly version: string;
  /** Semver range of Kernel API versions this engine is compatible with */
  readonly kernelCompatibility: string; // e.g. ">=2.0 <3.0"
  /** Other engine IDs this engine depends on — used for boot-order resolution */
  readonly dependsOn: readonly string[];
  /** Service IDs needed from ServiceRegistry */
  readonly requiredServices?: readonly string[];

  status(): EngineStatus;
  ready(): boolean;
  health(): Promise<EngineHealth>;
  metrics(): Record<string, number>;
  
  // Kernel reference injected at init time — engines access other engines via KernelAPI only
  init(api: import('./KernelAPI').KernelAPI): Promise<void>;
  restart(): Promise<void>;
  dispose(): Promise<void>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export type ServiceStatus = 'ready' | 'unavailable' | 'initializing';

export interface ServiceHealth {
  status: ServiceStatus;
  latencyMs?: number;
  lastChecked: number;
  error?: string;
}

/** Every service registered in ServiceRegistry must implement this */
export interface IService {
  readonly id: string;
  readonly version: string;
  init(): Promise<void>;
  health(): Promise<ServiceHealth>;
  dispose(): Promise<void>;
}

// ─── Event Bus ───────────────────────────────────────────────────────────────

export type EventPriority = 'critical' | 'high' | 'normal' | 'background';

export interface CHATREvent<T = unknown> {
  readonly id: string;           // uuid
  readonly type: string;         // e.g. 'TASK_CREATED'
  readonly payload: T;
  readonly priority: EventPriority;
  readonly timestamp: number;
  readonly source: string;       // engine or service id that emitted it
  readonly persist: boolean;     // should this be written to IndexedDB?
  readonly correlationId?: string; // links back to originating command
  readonly causationId?: string; // links back to exact triggering event
  readonly workflowId?: string;  // links back to executing DAG
  readonly traceId?: string;     // links to distributed trace
  readonly tenantId?: string;
  readonly schemaVersion?: string;
}

export type EventHandler<T = unknown> = (event: CHATREvent<T>) => void | Promise<void>;

// ─── Command Bus ─────────────────────────────────────────────────────────────

export interface CHATRCommand<T = unknown> {
  readonly id: string;           // uuid — also becomes correlationId on resulting events
  readonly type: string;         // e.g. 'CREATE_TASK'
  readonly payload: T;
  readonly requestedBy: string;  // engine id or 'user'
  readonly timestamp: number;
  readonly requiresPermission?: string;
  rollback?: () => Promise<void>; // optional undo function
}

export type CommandResult<T = unknown> =
  | { success: true; data: T; correlationId: string }
  | { success: false; error: string; correlationId: string };

export type CommandHandler<TPayload = unknown, TResult = unknown> = (
  command: CHATRCommand<TPayload>
) => Promise<CommandResult<TResult>>;

// ─── State Store Domains ─────────────────────────────────────────────────────

export interface ChatDomain {
  activeConversationId: string | null;
  typingContactIds: string[];
  unreadCount: number;
}

export interface CallsDomain {
  activeCallId: string | null;
  callStatus: 'idle' | 'ringing' | 'active' | 'ended';
  callHistory: string[]; // ids
}

export interface ContactsDomain {
  activeContactId: string | null;
  searchQuery: string;
}

export interface WorkspaceDomain {
  activeWorkspaceId: string | null;
  activeModules: string[];
}

export interface MemoryDomain {
  workingEntities: Record<string, unknown[]>;
  sessionId: string;
}

export interface KnowledgeDomain {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  lastExtracted: number;
}

export interface KnowledgeNode {
  id: string;
  type: KnowledgeEntityType;
  label: string;
  confidence: number;
  source: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeEdge {
  id: string;
  from: string;    // node id
  to: string;      // node id
  relation: string; // e.g. "works at", "owned by", "due on", "involves"
  confidence: number;
}

export type KnowledgeEntityType =
  | 'person' | 'organization' | 'meeting' | 'deadline' | 'money'
  | 'project' | 'location' | 'file' | 'task' | 'email' | 'call'
  | 'document' | 'product' | 'risk' | 'goal' | 'decision'
  | 'commitment' | 'topic' | 'date' | 'company';

export interface SearchDomain {
  query: string;
  results: SearchResult[];
  indexStatus: 'idle' | 'indexing' | 'ready';
  lastIndexed: number;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  score: number;
  source: string;
  timestamp: number;
}

export interface SchedulerDomain {
  entries: TimelineEntry[];
  todayCount: number;
}

export interface TimelineEntry {
  id: string;
  type: 'past' | 'present' | 'future' | 'prediction';
  capability: string;
  title: string;
  scheduledFor: string; // ISO date string
  completedAt?: string;
  confidence?: number;
  relatedContacts: string[];
  relatedDocuments: string[];
  source: 'user' | 'ai' | 'system';
  persist: boolean;
}

export interface NotificationsDomain {
  unread: Notification[];
  read: Notification[];
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  priority: EventPriority;
  timestamp: number;
  read: boolean;
  action?: string;
}

export interface RuntimeDomain {
  kernelStatus: 'booting' | 'ready' | 'degraded' | 'crashed';
  engineStatuses: Record<string, EngineStatus>;
  serviceStatuses: Record<string, ServiceStatus>;
  runtimeMode: RuntimeMode;
  startedAt: number;
  apiVersion: string;
}

export type RuntimeMode = 'production' | 'developer' | 'offline' | 'enterprise' | 'guest' | 'demo';

// ─── Plugin System ────────────────────────────────────────────────────────────

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  kernelCompatibility: string;
  permissions: string[];
  dependencies: string[];     // other plugin ids
  targetPages?: string[];
  capabilities?: CapabilityDef[];
  commands?: string[];
  aiPrompts?: Record<string, string>;
}

export interface CapabilityDef {
  id: string;
  name: string;
  triggers: string[];
  requiredPermission?: string;
}

export type PluginStatus = 'installed' | 'enabled' | 'disabled' | 'error';

// ─── Permissions ─────────────────────────────────────────────────────────────

export type Permission =
  | 'read:contacts' | 'write:contacts'
  | 'read:files' | 'write:files'
  | 'read:calendar' | 'write:calendar'
  | 'execute:ai' | 'execute:calls'
  | 'read:messages' | 'write:messages'
  | 'access:crm' | 'access:financial'
  | 'access:health' | 'access:admin';

// ─── Feature Flags ────────────────────────────────────────────────────────────

export interface FeatureFlagDef {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  runtimeModes?: RuntimeMode[];  // only enabled in these modes if set
}

// ─── Runtime Manifest ────────────────────────────────────────────────────────

export interface RuntimeManifest {
  kernelVersion: string;
  apiVersion: string;
  runtimeMode: RuntimeMode;
  engines: string[];          // engine ids to boot, in order (Kernel resolves actual dep order)
  services: string[];         // service ids to register
  plugins: string[];          // plugin ids to enable
  featureFlags: Record<string, boolean>; // overrides
  telemetryEnabled: boolean;
  persistence: 'localStorage' | 'indexedDB' | 'sqlite';
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface RuntimeMetrics {
  engineStartupMs: Record<string, number>;
  memoryUsageBytes: number;
  slowQueries: Array<{ query: string; durationMs: number; timestamp: number }>;
  aiLatency: Array<{ prompt: string; durationMs: number; timestamp: number }>;
  pluginErrors: Array<{ pluginId: string; error: string; timestamp: number }>;
  eventThroughput: number; // events/sec, rolling 60s
  frameRate: number;
  cpuTimePerEngine: Record<string, number>;
}

// ─── Workflow ────────────────────────────────────────────────────────────────

export interface WorkflowDef {
  id: string;
  name: string;
  trigger: string;           // event type that starts this workflow
  steps: WorkflowStep[];
  requiredPermissions: string[];
}

export interface WorkflowStep {
  id: string;
  command: string;           // command type to dispatch
  payload?: Record<string, unknown>;
  dependsOn?: string[];      // step ids that must complete first
  condition?: string;        // simple expression e.g. "prev.success === true"
  onError: 'abort' | 'continue' | 'retry';
}

// ─── Security ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: number;
  actor: string;             // user id or engine id
  action: string;
  resource: string;
  outcome: 'allowed' | 'denied';
  details?: Record<string, unknown>;
}
