export interface IntentPlan {
  id: string;
  originalText: string;
  confidence: number;
  status: 'planning' | 'compiling' | 'ready';
  graph?: WorkflowGraph;
}

export interface WorkflowGraph {
  nodes: OSNode[];
  edges: OSEdge[];
}

export interface OSNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface OSEdge {
  id: string;
  source: string;
  target: string;
  metadata?: any;
}

export interface OSCommand {
  type: string;
  payload: any;
  timestamp: number;
}

export interface OSEvent {
  type: string;
  payload: any;
  timestamp: number;
  correlationId?: string;
}

export interface CapabilityManifest {
  id: string;
  label: string;
  icon: string; // string identifier for icon component
  description: string;
  category: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  propertySchema: any;
  runtimeRequirements?: any;
}
export interface ExecutionGraph {
  tasks: ExecutionTask[];
  dependencies: Record<string, string[]>; // Task ID -> Array of Task IDs it depends on
}

export interface ExecutionTask {
  id: string;
  nodeId: string;
  type: string;
  data: Record<string, any>;
  runOrder: number; // Topological sort order
}

export interface ExecutionContext {
  [nodeId: string]: {
    output: any;
    status: 'success' | 'failed';
  }
}

export interface AIContext {
  workflow: WorkflowGraph;
  selection: string[];
  variables: Record<string, any>;
  telemetry: any;
  history: OSEvent[];
  capabilities: CapabilityManifest[];
  permissions: any;
}

export interface MappingResult {
  confidence: number;
  reason: string;
  evidence: string;
  transformations: string[];
  status: 'auto' | 'manual_required';
}

export interface HealingRecommendation {
  confidence: number;
  reason: string;
  patch: any;
}

export interface ExecutionFailure {
  nodeId: string;
  error: string;
  context: any;
}
