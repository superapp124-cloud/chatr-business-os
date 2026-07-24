export type QueryIntent =
  | "shopping"
  | "comparison"
  | "research"
  | "news"
  | "coding"
  | "bharat"
  | "general";

export interface IntentResult {
  intent: QueryIntent;
  expandedQueries: string[];
  commerceIntentScore: number;
}

export interface RawSource {
  title: string;
  url: string;
  snippet: string;
}

export interface RankedSource extends RawSource {
  trustScore: number;
  relevanceScore: number;
  freshnessScore: number;
  contentDepthScore: number;
  compositeScore: number;
  isTrusted: boolean;
}

export interface RetrievalLog {
  query: string;
  expandedQueries: string[];
  selectedSources: string[];
  rejectedSources: string[];
  scores: Record<string, number>;
  providerUsed: string;
  latencyMs: number;
  synthesisLatencyMs?: number;
}

// ─── OS KERNEL TYPES (Phase A) ──────────────────────────────────────────────

export interface IWorkObject {
  id: string;
  type: string; // e.g., 'decision', 'okr', 'lead', 'ticket'
  departmentId?: string;
  capabilityId?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  ownerId?: string;
  workflowId?: string;
  timelineId?: string;
  permissions: Record<string, any>;
  knowledgeLinks: any[];
  attachments: any[];
  metadata: Record<string, any>; // Domain specific data goes here
  tenantId: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ISystemEvent {
  id?: string;
  eventType: string; // e.g., 'WorkObjectCreated', 'IntentResolved'
  payload: Record<string, any>;
  source: string; // The service or module that emitted this
  actorId?: string;
  tenantId: string;
  createdAt?: string;
}

export interface IConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'color' | 'email' | 'url';
  defaultValue?: any;
  options?: string[];
  description?: string;
  required?: boolean;
  group?: string;
}

export interface IObjectField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'reference' | 'user';
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  readonly?: boolean;
  defaultValue?: any;
  validation?: any;
  placeholder?: string;
  helpText?: string;
  group?: string;
  section?: string;
  width?: 'full' | 'half' | 'third';
  displayFormat?: string;
  options?: string[]; // Used for enum types
  referenceTo?: string; // e.g., 'Employee', 'Company' for relations
  required?: boolean;
}

export type ViewType = 'Grid' | 'Kanban' | 'Calendar' | 'Timeline' | 'Gallery' | 'Dashboard' | 'Hierarchy' | 'Map' | 'Gantt';

export interface IObjectSchema {
  name: string; // Internal noun identifier e.g., 'Objective'
  pluralName: string; // e.g., 'Objectives'
  icon: string;
  fields: IObjectField[];
  titleField: string; // Which field serves as the primary identifier
  statusField?: string; // Which field dictates the pipeline/status
  views: ViewType[];
  permissions?: string[];
  actions?: string[];
  relations?: any[];
  ai?: {
    summarize?: boolean;
    suggest?: boolean;
    generate?: boolean;
    analyze?: boolean;
    predict?: boolean;
  };
}

export interface ICapabilityManifest {
  id: string;
  name: string;
  description: string;
  department: string;
  category: string;
  version: string;
  maturity: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  icon: string;
  rating: number;
  installs: number;
  verbs: string[];
  nouns: string[];
  permissions: string[];
  eventsProduced: string[];
  eventsConsumed: string[];
  dependencies: string[];
  search: string[];
  configSchema: IConfigField[];
  objectSchemas?: IObjectSchema[];
  tags: string[];
}

export interface ICapabilityWorkflow {
  id: string;
  version: string;
  requiredEntities?: string[];
  plan: ExecutionPlan;
}

export interface ICapabilityPackage {
  manifest: ICapabilityManifest;
  workflows: ICapabilityWorkflow[];
}

// ─── OS KERNEL TYPES (V1.0 Enterprise Intent Pipeline) ────────────────────────

export type IntentLifecycleState = 
  | 'Received'
  | 'Parsed'
  | 'Resolved'
  | 'Planned'
  | 'Authorized'
  | 'Executing'
  | 'Waiting'
  | 'WaitingForClarification'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'
  | 'Learned';

export interface ResolvedIntent {
  action: string; // Extracted action (e.g. CreateLead)
  entities: Record<string, any>; // Extracted payload/variables
  confidence: number;
  ambiguity: boolean;
  reasoning: string;
  sourceResolver?: string;
}

export type StepState = 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Skipped' | 'TimedOut';

export interface ExecutionPlanStep {
  id: string;
  idempotencyKey: string;
  action: string;
  component: string;
  payload: Record<string, any>;
  
  status: StepState;
  startedAt?: string;
  finishedAt?: string;
  
  retryCount: number;
  maxAttempts: number;
  timeoutMs: number;
}

export interface ExecutionPlan {
  id: string;
  steps: ExecutionPlanStep[];
}

export interface ObservationRecord {
  timestamp: string;
  type: 'duration' | 'bottleneck' | 'policy_violation' | 'success';
  component: string;
  details: string;
}

export interface TenantCapability {
  id: string;
  version: string;
  enabled: boolean;
  beta?: boolean;
  rollout?: number; // percentage (0-100)
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  correlationId: string;
}

export interface TenantQuotas {
  concurrentWorkflows: number;
  intentsPerMinute: number;
  eventsPerSecond: number;
  storageGb: number;
  aiTokensPerDay: number;
  mcpRequestsPerDay: number;
}

export interface TenantContext {
  tenantId: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  plan: 'Starter' | 'Business' | 'Enterprise';
  quotas: TenantQuotas;
  enabledCapabilities: TenantCapability[]; // List of capabilities and config for this tenant
}

export interface ExecutionContext {
  id: string; // The OS Context ID
  trace: TraceContext; // Distributed Tracing
  rawInput: string;
  tenant: TenantContext;
  departmentId?: string;
  locale: string;
  timezone: string;
  state: 'Created' | 'Parsed' | 'Resolved' | 'Authorized' | 'Executing' | 'Waiting' | 'Completed' | 'Learned' | 'Failed';
  resolvedIntent?: ResolvedIntent;
  executionPlan?: ExecutionPlan;
  completedSteps: string[];
  observations: ObservationRecord[];
  metadata: Record<string, any>;
}

export interface IPlanner {
  generatePlan(context: ExecutionContext): Promise<ExecutionPlan>;
}

export interface IExecutionStore {
  saveCheckpoint(context: ExecutionContext): Promise<void>;
  loadExecution(contextId: string): Promise<ExecutionContext | null>;
  completeExecution(contextId: string): Promise<void>;
}

export interface StoredEvent {
  id: string; // UUID
  version: number;
  eventType: string; // e.g. intent.created
  streamId: string; // Aggregate/Intent ID
  sequence: number; 
  payload: Record<string, unknown>;
  metadata: {
    actorId: string;
    tenantId: string;
    source: string;
    timestamp: string;
    correlationId: string;
    causationId?: string;
  };
}

export interface IEventStore {
  append(streamId: string, event: StoredEvent): Promise<void>;
  readStream(streamId: string): Promise<StoredEvent[]>;
  readCategory(category: string): Promise<StoredEvent[]>;
}
