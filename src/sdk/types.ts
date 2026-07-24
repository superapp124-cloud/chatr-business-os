/**
 * CHATR OS — Capability SDK Type Definitions
 *
 * This is the complete TypeScript contract for the Capability SDK.
 * Every capability must implement ICapabilitySDK to be installable.
 * The runtime renders everything from these declarations — no per-capability React code.
 */

// ─── Field Types ──────────────────────────────────────────────────────────────

export type FieldType =
  | 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime'
  | 'enum' | 'multi-enum' | 'reference' | 'user' | 'email' | 'url'
  | 'phone' | 'currency' | 'percentage' | 'rating' | 'file' | 'rich-text';

export interface IFieldDefinition {
  name: string;           // internal key
  label: string;          // display label
  type: FieldType;
  required?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  readonly?: boolean;
  hidden?: boolean;       // hide from grid/form but store in DB
  defaultValue?: any;
  placeholder?: string;
  helpText?: string;
  width?: 'full' | 'half' | 'third' | 'quarter';
  options?: string[];     // for enum / multi-enum
  referenceTo?: string;   // for reference fields → object name
  displayFormat?: string; // 'currency', 'percentage', 'date:MMM DD YYYY'
  group?: string;         // form section grouping
  showInGrid?: boolean;   // default true
  showInDetail?: boolean; // default true
  showInForm?: boolean;   // default true
  showInKanban?: boolean; // show on kanban card
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

// ─── Object (Business Entity) ─────────────────────────────────────────────────

export interface IObjectDefinition {
  name: string;              // singular PascalCase: 'Lead'
  pluralName: string;        // plural: 'Leads'
  icon: string;              // emoji or lucide icon name
  description?: string;
  titleField: string;        // which field is the display name
  statusField?: string;      // which field drives Kanban/pipeline
  fields: IFieldDefinition[];
  relations?: IRelationDefinition[];
  features?: {
    comments?: boolean;
    attachments?: boolean;
    timeline?: boolean;
    aiSummary?: boolean;
    export?: boolean;
    import?: boolean;
    duplicate?: boolean;
    archive?: boolean;
  };
  defaultSort?: { field: string; direction: 'asc' | 'desc' };
  actions?: IActionDeclaration[]; // record-level actions
}

// ─── Relations ────────────────────────────────────────────────────────────────

export interface IRelationDefinition {
  type: 'belongs-to' | 'has-many' | 'many-to-many';
  object: string;      // related object name
  foreignKey?: string; // field name
  label: string;       // display label for related list
  icon?: string;
}

// ─── Actions (Toolbar Buttons) ────────────────────────────────────────────────

export interface IActionDeclaration {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  scope: 'list' | 'record' | 'both'; // where to show
  requiresSelection?: boolean;
  workflow?: string;  // triggers this workflow id
  confirmation?: string; // confirm dialog message
}

// ─── Views ────────────────────────────────────────────────────────────────────

export type ViewType = 'grid' | 'kanban' | 'calendar' | 'timeline' | 'detail' | 'form' | 'dashboard' | 'report';

export interface IViewDeclaration {
  id: string;
  label: string;
  icon: string;
  type: ViewType;
  object?: string;        // which object this view shows
  isDefault?: boolean;    // default selected view
  filters?: IFilterPreset[];
  columns?: string[];     // field names to show (grid)
  groupBy?: string;       // field to group by
}

export interface IFilterPreset {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'in' | 'notIn';
  value: any;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface INavItem {
  id: string;
  label: string;
  icon: string;
  viewId: string; // links to a view declaration
}

// ─── Dashboard Widgets ────────────────────────────────────────────────────────

export type WidgetType = 'metric' | 'bar-chart' | 'pie-chart' | 'line-chart' | 'list' | 'funnel' | 'progress';

export interface IDashboardWidget {
  id: string;
  type: WidgetType;
  label: string;
  icon?: string;
  object: string;          // which object to query
  metric?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  field?: string;          // for sum/avg/min/max
  filters?: IFilterPreset[];
  groupBy?: string;        // for charts
  limit?: number;          // for list widgets
  color?: string;          // accent color
  trend?: boolean;         // show vs last period
  size?: 'small' | 'medium' | 'large' | 'full';
  format?: 'number' | 'currency' | 'percentage';
}

export interface IDashboardDeclaration {
  id: string;
  label: string;
  description?: string;
  widgets: IDashboardWidget[];
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export type ReportType = 'bar' | 'line' | 'pie' | 'table' | 'funnel' | 'scatter';

export interface IReportDeclaration {
  id: string;
  label: string;
  icon?: string;
  type: ReportType;
  object: string;
  groupBy: string;
  metric: 'count' | 'sum' | 'avg';
  field?: string;
  filters?: IFilterPreset[];
  description?: string;
}

// ─── AI Skills ────────────────────────────────────────────────────────────────

export interface IAISkill {
  id: string;
  label: string;
  description: string;
  intent: string;       // maps to IntentKernel
  object?: string;      // which object it operates on
  promptTemplate: string;
  outputType: 'text' | 'json' | 'action';
  scope: 'record' | 'list' | 'global';
}

export interface IAIDeclaration {
  skills: IAISkill[];
  assistantName?: string;
  assistantDescription?: string;
}

// ─── Workflows ────────────────────────────────────────────────────────────────

export interface IWorkflowStep {
  id: string;
  type: 'action' | 'condition' | 'wait' | 'ai' | 'notification' | 'automation';
  label: string;
  config: Record<string, any>;
}

export interface IWorkflowDeclaration {
  id: string;
  label: string;
  description?: string;
  trigger: 'manual' | 'on-create' | 'on-update' | 'on-status-change' | 'scheduled';
  triggerObject?: string;
  triggerConditions?: IFilterPreset[];
  steps: IWorkflowStep[];
}

// ─── Automations ──────────────────────────────────────────────────────────────

export interface IAutomationRule {
  id: string;
  label: string;
  trigger: 'on-create' | 'on-update' | 'on-status-change' | 'scheduled';
  object: string;
  conditions?: IFilterPreset[];
  actions: IAutomationAction[];
  enabled: boolean;
}

export interface IAutomationAction {
  type: 'set-field' | 'send-notification' | 'create-record' | 'trigger-workflow' | 'assign-user';
  config: Record<string, any>;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface INotificationTemplate {
  id: string;
  label: string;
  trigger: string;          // event name
  channel: 'in-app' | 'email' | 'both';
  title: string;            // supports {{field}} interpolation
  body: string;
  recipientField?: string;  // field containing user reference
  recipientRole?: string;   // all users with this role
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export type Permission = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'import' | 'admin';

export interface IPermissionMatrix {
  [role: string]: Permission[];
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

export interface ISeedRecord {
  object: string;   // object name
  data: Record<string, any>[];
}

export interface ISeedData {
  objects: ISeedRecord[];
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface ISearchConfig {
  objects: {
    object: string;
    fields: string[];     // searchable field names
    titleField: string;
    subtitleField?: string;
    icon?: string;
  }[];
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface ISettingsField {
  key: string;
  label: string;
  type: FieldType;
  defaultValue?: any;
  options?: string[];
  description?: string;
  required?: boolean;
  group?: string;
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export interface IIntegrationConfig {
  id: string;
  label: string;
  type: 'csv-import' | 'rest-api' | 'webhook' | 'zapier' | 'mcp';
  description?: string;
  config?: Record<string, any>;
}

// ─── Kernel ABI v1.0 Types ────────────────────────────────────────────────────

export interface IStateMachine {
  objectId: string; // e.g., 'Candidate'
  initialState: string;
  states: Record<string, {
    transitions: Record<string, string>; // { 'Approve': 'Offer', 'Reject': 'Archived' }
    entryActions?: string[];
    exitActions?: string[];
  }>;
  validators?: string[];
}

export interface IPolicy {
  id: string;
  object: string;
  condition: string;
  decision: 'RequireApproval' | 'Block' | 'Allow' | 'Notify';
  effect: {
    role?: string;
    action?: string;
  };
}

export interface IAgentDeclaration {
  id: string;
  role: string;
  goal: string;
  memory: 'Conversation' | 'Business' | 'Organizational' | 'KnowledgeGraph' | 'None';
  permissions: string[];
  tools: string[];
  SOP: string;           // Derived from Business Object lifecycle
  policies: string[];
  workflows: string[];
  knowledge: string[];
  schedule?: string;
  cost?: 'low' | 'medium' | 'high';
  priority?: number;
  confidence?: number;
}

export interface IToolDeclaration {
  id: string;
  name: string;
  description: string;
  inputs: any;           // JSON Schema
  outputs: any;          // JSON Schema
  permissions: string[];
  cost?: number;
  timeout?: number;      // ms
  retry?: number;        // max retries
  sideEffects?: boolean;
  compensation?: string; // tool ID to call for rollback
}

export interface ICommandDeclaration {
  id: string;
  intent: string;
  description: string;
}

export interface IEventDeclaration {
  name: string;
  schema: any;
}

export interface IKnowledgeAdapter {
  id: string;
  type: 'confluence' | 'notion' | 'drive' | 'custom';
}

// ─── Full SDK ─────────────────────────────────────────────────────────────────

// ─── Full Manifest (ABI v1.0) ─────────────────────────────────────────────────

export interface ICapabilityManifest {
  // Core identity & Modularity
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
  tags: string[];
  dependsOn?: string[]; // Kernel ABI modularity

  // Business data
  objects: IObjectDefinition[];

  // Navigation & views
  views: IViewDeclaration[];
  nav?: INavItem[];         // sidebar sub-navigation (auto-generated if omitted)

  // Presentation
  dashboards: IDashboardDeclaration[];
  reports: IReportDeclaration[];

  // State & Rules
  stateMachines?: IStateMachine[];
  policies?: IPolicy[];
  
  // Processes
  workflows: IWorkflowDeclaration[];
  automations: IAutomationRule[];

  // Intelligence (ABI v1.0)
  ai?: IAIDeclaration; // Legacy fallback
  agents?: IAgentDeclaration[];
  tools?: IToolDeclaration[];
  
  // Universal Executive Intelligence (ABI v2.0)
  skills?: string[]; // Natural language skills (e.g. "Create Job", "Forecast Hiring")
  metrics?: string[]; // Business KPIs (e.g. "Time to Hire", "Pipeline Health")
  terminology?: Record<string, string>; // Department specific acronyms

  // Integration (ABI v1.0)
  eventsProduced?: IEventDeclaration[];
  eventsConsumed?: IEventDeclaration[];
  commands?: ICommandDeclaration[];

  // Users & Security
  permissions: IPermissionMatrix;
  notifications: INotificationTemplate[];

  // Data bootstrapping
  seed: ISeedData;

  // Discovery & Search
  search: ISearchConfig;
  knowledgeAdapters?: IKnowledgeAdapter[];

  // Configuration
  settings: ISettingsField[];
  integrations: IIntegrationConfig[];

  // Custom view escape hatch (for specialized UIs only)
  customViewComponent?: string; // component name — must be registered in ComponentRegistry
}

// ─── Universal Executive Runtime (v2.0) ───────────────────────────────────────

export interface IStructuredResponse {
  text: string;
  confidence: number;
  widgets?: {
    type: 'chart' | 'table' | 'form' | 'record' | 'metric';
    data: any;
    meta?: any;
  }[];
  actions?: {
    label: string;
    intent: string;
    variant?: 'primary' | 'secondary';
  }[];
  explanation?: string; // For the ExplanationEngine
}

export interface IUniversalExecutive {
  understand(query: string, context: any): Promise<any>;
  inform(query: string, context: any): Promise<IStructuredResponse>;
  act(query: string, context: any): Promise<IStructuredResponse>;
  analyze(query: string, context: any): Promise<IStructuredResponse>;
  advise(query: string, context: any): Promise<IStructuredResponse>;
  automate(query: string, context: any): Promise<IStructuredResponse>;
  generate(query: string, context: any): Promise<IStructuredResponse>;
  monitor(query: string, context: any): Promise<IStructuredResponse>;
  collaborate(query: string, context: any): Promise<IStructuredResponse>;
}

// Keep legacy alias for backward compatibility during migration
export type ICapabilitySDK = ICapabilityManifest;
