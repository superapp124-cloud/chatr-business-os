/**
 * CHATR Workflow UI SDK — Type Contracts
 *
 * Layer: UI Runtime (sits above the Execution Kernel)
 * Rule: Nothing in this file imports React. It is the pure data contract
 *       between the Workflow Execution Runtime and the Widget Renderer.
 *
 * Naming is OS-consistent with TaskRuntime, PipelineEngine, WorkflowStateStore.
 */

// ─── Widget Types (provider-independent) ────────────────────────────────────

/**
 * All widget types. Every type maps to exactly one React component in WidgetRegistry.
 * Designed to be reused across all capabilities — a SelectionWidget works equally
 * well for cabs, flights, restaurants, doctors, products, or insurance plans.
 */
export type WidgetType =
  | 'progress'           // Multi-step task tracker
  | 'selection'          // Generic option picker (replaces "ComparisonCard")
  | 'confirmation'       // Pre-action summary
  | 'tracking'           // Live map + status (driver, delivery, etc.)
  | 'route_picker'       // Map-based route or location selection
  | 'approval'           // Approval gate with accept/reject
  | 'payment'            // Payment method + summary
  | 'result'             // Final outcome (success / failure / info)
  | 'form'               // Dynamic field-driven form
  | 'action'             // Suggestion chips / quick action buttons
  | 'timeline'           // Chronological event list
  | 'execution_console'  // AI execution transparency panel (latency, provider, mode)
  | 'meeting_tracking';  // Live tracking for meeting RSVPs

// ─── Widget Lifecycle State Machine ──────────────────────────────────────────

/**
 * Every widget moves through this state machine.
 *
 * CREATED ──→ ACTIVE ──→ WAITING_USER ──→ EXECUTING ──→ COMPLETED
 *                │                                          │
 *                └─────────────────────────────────────── FAILED
 *                │                                          │
 *                └──────────────────────────────────── CANCELLED
 *                                                          │
 *                                                      ARCHIVED
 */
export type WidgetLifecycle =
  | 'CREATED'       // Widget spawned, not yet visible (skeleton)
  | 'ACTIVE'        // Displaying live data, auto-updating
  | 'WAITING_USER'  // Needs user action to continue (pulsing CTA)
  | 'EXECUTING'     // User acted, system working (spinner)
  | 'COMPLETED'     // Final success state
  | 'FAILED'        // Final error state
  | 'CANCELLED'     // Aborted by user or system
  | 'ARCHIVED';     // Collapsed into timeline history

// ─── Workflow Lifecycle ───────────────────────────────────────────────────────

export type WorkflowLifecycle =
  | 'CREATED'
  | 'ACTIVE'
  | 'WAITING_USER'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ARCHIVED';

// ─── Workflow UI Event Types ──────────────────────────────────────────────────

/**
 * The only events the AI/planner is allowed to emit.
 * These are plain JSON events — never React components.
 *
 * Rule: AI → JSON Event → WorkflowUIRuntime → WidgetRegistry → React
 */
export type WorkflowUIEventType =
  | 'WIDGET_CREATED'        // Push new widget into session
  | 'WIDGET_UPDATED'        // Patch existing widget payload or lifecycle
  | 'WIDGET_ACTION'         // User acted on a widget (→ re-emitted to workflow runtime)
  | 'WIDGET_LIFECYCLE'      // Transition lifecycle state only
  | 'WORKFLOW_STARTED'      // New workflow session created
  | 'WORKFLOW_RESUMED'      // Workflow restored from persisted state
  | 'WORKFLOW_COMPLETED'    // Workflow reached COMPLETED state
  | 'WORKFLOW_FAILED'       // Workflow reached FAILED state
  | 'WORKFLOW_CANCELLED';   // Workflow aborted

// ─── Hierarchical ID System ───────────────────────────────────────────────────

/**
 * IDs are hierarchical, not random UUIDs, for debuggability.
 *
 * Format: {conversationId}/{workflowType}/{subWorkflowType?}/{widgetType}-{index}
 * Example: "conv-43/cab-booking/progress-0"
 * Nested:  "conv-43/trip-booking/cab-booking/selection-1"
 */
export function buildWorkflowId(conversationId: string, workflowType: string): string {
  return `${conversationId}/${workflowType.toLowerCase().replace(/\s+/g, '-')}`;
}

export function buildNestedWorkflowId(parentId: string, subType: string): string {
  return `${parentId}/${subType.toLowerCase().replace(/\s+/g, '-')}`;
}

export function buildWidgetId(workflowId: string, widgetType: WidgetType, index: number): string {
  return `${workflowId}/${widgetType}-${index}`;
}

// ─── Workflow Manifest ────────────────────────────────────────────────────────

/**
 * Every workflow declares itself via a manifest.
 * The runtime uses this to enforce permissions, timeouts, and capabilities.
 * Critical for future enterprise policy, security, and marketplace.
 */
export interface WorkflowManifest {
  /** Stable identifier, e.g. "CAB_BOOKING", "FOOD_ORDER", "FLIGHT_BOOKING" */
  id: string;
  /** Semver version string */
  version: string;
  /** Human-readable name */
  name: string;
  /** Short description */
  description?: string;
  /** Which widget types this workflow is allowed to use */
  widgets: WidgetType[];
  /** Permissions required from the OS */
  permissions: string[];
  /** Can this workflow be resumed after the app closes? */
  resumable: boolean;
  /** Maximum runtime in ms before auto-cancellation */
  timeout: number;
  /** Can the user abort this workflow mid-execution? */
  cancellable: boolean;
  /** Whether nested child workflows are expected */
  supportsNestedWorkflows?: boolean;
  /** Expected maximum number of steps shown to the user */
  estimatedSteps?: number;
  
  // ─── Experience Engine Telemetry (Delegation Metrics) ─────────────────────
  estimatedManualMinutes?: number;
  expectedQuestions?: number;
  expectedClicks?: number;
  expectedApplications?: number;
  expectedProviders?: number;
  expectedWaitingMinutes?: number;
  expectedMoneySaved?: number;
  expectedRiskReduction?: string;
}

// ─── Workflow Capability Contract ─────────────────────────────────────────────

/**
 * Standardized lifecycle contract every workflow must implement.
 * Replaces ad-hoc "CabBookingFlow" patterns with a consistent interface.
 * Makes analytics, debugging, retries, and persistence uniform.
 */
export interface WorkflowCapabilityContract {
  manifest: WorkflowManifest;

  /** Called once before the workflow starts. Setup and validation. */
  initialize(context: WorkflowContext): Promise<void>;

  /** Start execution. Emits WORKFLOW_UI_EVENTs via eventBus. */
  execute(context: WorkflowContext): Promise<void>;

  /** Pause execution (e.g. app backgrounded). Save mid-state. */
  pause(context: WorkflowContext): Promise<void>;

  /** Resume from paused state. Restore widgets and continue. */
  resume(context: WorkflowContext): Promise<void>;

  /** Cancel the workflow. Clean up resources. */
  cancel(context: WorkflowContext): Promise<void>;

  /** Undo completed actions (e.g. cancel a booked cab). */
  rollback(context: WorkflowContext): Promise<void>;

  /** Called when the workflow reaches COMPLETED state. Log, notify. */
  complete(context: WorkflowContext): Promise<void>;
}

/** Context passed to every WorkflowCapabilityContract method */
export interface WorkflowContext {
  workflowId: string;
  conversationId: string;
  intent: Record<string, unknown>;
  entities: Record<string, unknown>;
  userPreferences?: Record<string, unknown>;
  parentWorkflowId?: string;
}

// ─── The Core Event Shape ─────────────────────────────────────────────────────

/**
 * The single event shape emitted via eventBus.publish('WORKFLOW_UI_EVENT', ...).
 * This is the hard boundary between the Execution Runtime and the UI Runtime.
 *
 * The Execution Runtime produces this.
 * The WorkflowUIRuntime consumes it.
 * React never touches this directly.
 */
export interface WorkflowUIEvent {
  event: WorkflowUIEventType;
  /** Hierarchical workflow ID, e.g. "conv-43/cab-booking" */
  workflowId: string;
  /** Hierarchical widget ID, e.g. "conv-43/cab-booking/progress-0" */
  widgetId: string;
  widgetType: WidgetType;
  /** Semver version of the widget, e.g. "1.0" */
  widgetVersion: string;
  lifecycle: WidgetLifecycle;
  /** Widget-specific data (validated by Zod schema on receipt) */
  payload: unknown;
  parentWorkflowId?: string;
  /** "system" for execution engine events, "user" for widget interaction events */
  actor: 'system' | 'user';
  timestamp: number;
}

// ─── Widget Action (from Widget → Kernel) ────────────────────────────────────

/**
 * When a user interacts with a widget, the widget emits a WidgetAction.
 * The WorkflowRenderer publishes this as a WORKFLOW_UI_EVENT with type WIDGET_ACTION.
 * The workflow capability subscribes to this event to advance state.
 *
 * Rule: Widget → WidgetAction → Kernel Event → Workflow Runtime
 * Never: Widget → Workflow method call
 */
export interface WidgetAction {
  widgetId: string;
  workflowId: string;
  action: string;          // e.g. "SELECT", "CONFIRM", "REJECT", "SUBMIT", "CANCEL"
  data: Record<string, unknown>;
  timestamp: number;
}

// ─── Widget Instance (Runtime State) ─────────────────────────────────────────

/** Live state of a single widget in a workflow session */
export interface WidgetInstance {
  id: string;              // Hierarchical widget ID
  type: WidgetType;
  version: string;
  lifecycle: WidgetLifecycle;
  payload: unknown;
  workflowId: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Execution Timeline ───────────────────────────────────────────────────────

/**
 * Every WorkflowUIEvent automatically produces a TimelineEntry.
 * This becomes: audit log, debug panel, enterprise history, analytics.
 */
export interface TimelineEntry {
  id: string;
  workflowId: string;
  timestamp: number;
  /** Milliseconds since the workflow started */
  elapsed: number;
  event: WorkflowUIEventType;
  widgetType: WidgetType;
  lifecycle: WidgetLifecycle;
  /** Human-readable label, e.g. "User selected Ola Prime" */
  label: string;
  actor: 'system' | 'user';
  metadata?: Record<string, unknown>;
}

// ─── Workflow UI Session ──────────────────────────────────────────────────────

/** Complete in-memory state of one workflow's UI layer */
export interface WorkflowUISession {
  workflowId: string;
  parentWorkflowId?: string;
  manifest: WorkflowManifest;
  widgets: WidgetInstance[];
  timeline: TimelineEntry[];
  lifecycle: WorkflowLifecycle;
  createdAt: number;
  updatedAt: number;
  /** Phase 1: undefined. Phase 2: key for IWorkflowUIStore.load() */
  persistenceKey?: string;
}

// ─── Persistence Interface ────────────────────────────────────────────────────

/**
 * Storage adapter interface. Phase 1 uses MemoryWorkflowUIStore (in-memory).
 * Phase 2 swaps in SupabaseWorkflowUIStore — one line change via setWorkflowUIStore().
 * Mirrors the existing WorkflowStateStore pattern in core/runtime.
 */
export interface IWorkflowUIStore {
  save(session: WorkflowUISession): Promise<void>;
  load(workflowId: string): Promise<WorkflowUISession | null>;
  loadAll(): Promise<WorkflowUISession[]>;
  delete(workflowId: string): Promise<void>;
}

// ─── Widget Payload Schemas ───────────────────────────────────────────────────
// Each widget type has a typed payload. The Zod schemas in schema.ts validate these.

export interface ProgressStep {
  id: string;
  title: string;
  subtitle?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ProgressWidgetPayload {
  steps: ProgressStep[];
  title?: string;
  subtitle?: string;
  estimatedMs?: number;
  showSecureExecution?: boolean;
}

export interface SelectionOption {
  id: string;
  /** Values keyed to the column definitions */
  values: Record<string, unknown>;
  badge?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'info';
  icon?: string;         // emoji or URL
  recommended?: boolean;
  disabled?: boolean;
}

export interface SelectionColumn {
  key: string;
  label: string;
  type?: 'text' | 'currency' | 'duration' | 'rating' | 'badge' | 'time' | 'number';
  currencyCode?: string;
  primary?: boolean;     // highlighted in the UI
}

export interface SelectionWidgetPayload {
  title?: string;
  subtitle?: string;
  columns: SelectionColumn[];
  options: SelectionOption[];
  selectedId?: string;
  allowMultiple?: boolean;
  showMoreLabel?: string;
  totalCount?: number;
}

export interface ConfirmationLine {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface ConfirmationWidgetPayload {
  title?: string;
  subtitle?: string;
  lines: ConfirmationLine[];
  ctaLabel?: string;
  abortLabel?: string;
  warning?: string;
  selectedOption?: Record<string, unknown>;
}

export interface TrackingAction {
  id: string;
  label: string;
  icon?: string;
  variant?: 'default' | 'danger' | 'secondary';
}

export interface TrackingWidgetPayload {
  title?: string;
  status?: string;
  providerName?: string;
  agentName?: string;
  agentRating?: number;
  agentVehicle?: string;
  agentPlate?: string;
  agentAvatarUrl?: string;
  otp?: string;
  eta?: string;
  origin?: string;
  destination?: string;
  actions?: TrackingAction[];
  showMap?: boolean;
  /** 0.0 = driver at origin, 1.0 = driver arrived. Drives MiniMap dot position. */
  driverProgress?: number;
  /** Human-readable distance string, e.g. "2.1 km away" */
  driverDistance?: string;
}
export interface MeetingAttendee {
  name: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined';
  avatarUrl?: string;
}

export interface MeetingTrackingWidgetPayload {
  title: string;
  subtitle?: string;
  attendees: MeetingAttendee[];
  location?: string;
}

export interface ApprovalWidgetPayload {
  title?: string;
  description?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  details: Array<{ label: string; value: string }>;
  approveLabel?: string;
  rejectLabel?: string;
  requiredApproverRole?: string;
}

export interface PaymentBreakdownItem {
  label: string;
  amount: number;
  type?: 'subtotal' | 'fee' | 'discount' | 'total';
}

export interface PaymentMethod {
  id: string;
  label: string;
  icon?: string;
  isDefault?: boolean;
  balance?: number;
}

export interface PaymentWidgetPayload {
  title?: string;
  amount: number;
  currencyCode?: string;
  breakdown?: PaymentBreakdownItem[];
  methods?: PaymentMethod[];
  selectedMethodId?: string;
  ctaLabel?: string;
  checkoutUrl?: string; // Handoff URL for Live Execution
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'choice' | 'time' | 'textarea' | 'phone';
  placeholder?: string;
  options?: string[];
  required?: boolean;
  value?: unknown;
  hint?: string;
}

export interface FormWidgetPayload {
  title?: string;
  subtitle?: string;
  fields: FormField[];
  ctaLabel?: string;
}

export interface ActionItem {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** If set, tapping sends this text as a new message to the AI */
  prompt?: string;
}

export interface ActionWidgetPayload {
  message?: string;
  actions: ActionItem[];
  layout?: 'row' | 'grid';
}

export interface TimelineWidgetPayload {
  title?: string;
  entries: Array<{
    id: string;
    timestamp: number;
    label: string;
    detail?: string;
    status?: 'completed' | 'active' | 'pending' | 'failed';
    icon?: string;
  }>;
}

// ─── Execution Console Payload ────────────────────────────────────────────────

export type ExecutionPhaseStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ExecutionPhase {
  id: string;
  label: string;
  status: ExecutionPhaseStatus;
  latencyMs?: number;
  detail?: string;    // e.g. "Ola Prime selected"
}

export interface ExecutionConsoleWidgetPayload {
  phases: ExecutionPhase[];
  /** Which AI mode is active */
  aiMode: 'local' | 'cloud' | 'hybrid';
  /** Whether the console is expanded or collapsed */
  expanded?: boolean;
}

export interface ResultWidgetPayload {
  status: 'success' | 'failure' | 'info' | 'warning';
  title: string;
  message?: string;
  actions?: ActionItem[];
  metadata?: Array<{ label: string; value: string }>;
}

/** Discriminated union of all widget payloads — used in generic rendering */
export type AnyWidgetPayload =
  | ProgressWidgetPayload
  | SelectionWidgetPayload
  | ConfirmationWidgetPayload
  | TrackingWidgetPayload
  | RoutePickerWidgetPayload
  | ApprovalWidgetPayload
  | PaymentWidgetPayload
  | ResultWidgetPayload
  | FormWidgetPayload
  | ActionWidgetPayload
  | TimelineWidgetPayload
  | ExecutionConsoleWidgetPayload;

// ─── Widget Props (passed to every registered React component) ────────────────

export interface WidgetProps {
  instance: WidgetInstance;
  workflowId: string;
  /** Called by widgets when user interacts. Routes through Kernel. */
  onAction: (action: Omit<WidgetAction, 'timestamp'>) => void;
}
