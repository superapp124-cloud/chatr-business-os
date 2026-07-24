export interface JSONSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

export interface RelationshipSchema {
  targetObjectId: string;
  type: 'one_to_one' | 'one_to_many' | 'many_to_many';
  label: string;
}

export interface PermissionSchema {
  roles: string[];
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

export interface ValidationRule {
  field: string;
  rule: string;
  errorMessage: string;
}

export interface AutomationTrigger {
  event: string;
  conditions: Record<string, any>[];
  actions: Record<string, any>[];
}

export interface ViewDefinition {
  id: string;
  name: string;
  type: 'list' | 'kanban' | 'calendar' | 'timeline';
  filters: Record<string, any>[];
  columns: string[];
}

export interface LifecycleDefinition {
  states: string[];
  transitions: Record<string, string[]>;
  initialState: string;
}

export interface BusinessObjectDefinition {
  id: string;
  name: string;      // e.g., 'WorkItem', 'Asset', 'Employee'
  fields: JSONSchema;
  relationships: RelationshipSchema[];
  permissions: PermissionSchema;
  validation: ValidationRule[];
  automation: AutomationTrigger[];
  views: ViewDefinition[];
  lifecycle: LifecycleDefinition;
}

export interface BusinessObject {
  id: string;
  workspace_id: string;
  definition_id: string; // Links to BusinessObjectDefinition
  owner_id: string;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>; // System JSONB
}

export interface WorkItem extends BusinessObject {
  type_id: string;       // e.g., Incident, Request, Task, Leave
  workflow_id: string;   // Includes versioning (e.g., wf_leave_v2)
  status_id: string;
  priority_id: string;
  reporter_id: string;
  dynamic_data: Record<string, any>; // Dynamic Form JSONB
}
