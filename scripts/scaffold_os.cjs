const fs = require('fs');
const path = require('path');

const osDir = path.join(__dirname, '../src/platform/AutomationOS');

const files = {
  'Types.ts': `
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
`,

  'CapabilityRegistry.ts': `
import { CapabilityManifest } from './Types';

class Registry {
  private capabilities: Map<string, CapabilityManifest> = new Map();

  register(manifest: CapabilityManifest) {
    this.capabilities.set(manifest.id, manifest);
    console.log(\`[CapabilityRegistry] Registered capability: \${manifest.id}\`);
  }

  get(id: string): CapabilityManifest | undefined {
    return this.capabilities.get(id);
  }

  getAll(): CapabilityManifest[] {
    return Array.from(this.capabilities.values());
  }
}

export const CapabilityRegistry = new Registry();

// Register Default Mock Capabilities
CapabilityRegistry.register({
  id: 'core.trigger', label: 'Trigger', icon: 'zap', category: 'Core', description: 'Starts a workflow', inputs: {}, outputs: { payload: 'any' }, propertySchema: {}
});
CapabilityRegistry.register({
  id: 'core.ai_agent', label: 'AI Agent', icon: 'bot', category: 'AI', description: 'Executes an AI prompt', inputs: { prompt: 'string' }, outputs: { response: 'string' }, propertySchema: {}
});
CapabilityRegistry.register({
  id: 'core.email', label: 'Send Email', icon: 'mail', category: 'Communication', description: 'Sends an email', inputs: { to: 'string', subject: 'string', body: 'string' }, outputs: { status: 'boolean' }, propertySchema: {}
});
`,

  'EventBus.ts': `
import { OSEvent } from './Types';

type EventListener = (event: OSEvent) => void;

class Bus {
  private listeners: EventListener[] = [];
  private history: OSEvent[] = [];

  subscribe(listener: EventListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  publish(event: OSEvent) {
    this.history.push(event);
    console.log(\`[EventBus] [\${new Date(event.timestamp).toISOString()}] \${event.type}\`, event.payload);
    this.listeners.forEach(l => l(event));
  }

  getHistory() {
    return this.history;
  }
}

export const EventBus = new Bus();
`,

  'KernelStore.ts': `
import { OSNode, OSEdge, OSEvent } from './Types';
import { EventBus } from './EventBus';

interface StoreState {
  nodes: OSNode[];
  edges: OSEdge[];
  activeWorkflowId: string | null;
  compilationStatus: 'idle' | 'compiling' | 'success' | 'error';
}

class Store {
  private state: StoreState = {
    nodes: [],
    edges: [],
    activeWorkflowId: null,
    compilationStatus: 'idle'
  };
  private listeners: (() => void)[] = [];

  constructor() {
    EventBus.subscribe(this.handleEvent.bind(this));
  }

  private handleEvent(event: OSEvent) {
    let changed = false;
    
    switch (event.type) {
      case 'NODE_MOVED':
        const node = this.state.nodes.find(n => n.id === event.payload.id);
        if (node) {
          node.position = event.payload.position;
          changed = true;
        }
        break;
      case 'NODE_CREATED':
        this.state.nodes.push(event.payload.node);
        changed = true;
        break;
      case 'EDGE_CREATED':
        this.state.edges.push(event.payload.edge);
        changed = true;
        break;
      case 'WORKFLOW_LOADED':
        this.state.nodes = event.payload.nodes || [];
        this.state.edges = event.payload.edges || [];
        this.state.activeWorkflowId = event.payload.workflowId;
        changed = true;
        break;
      case 'WORKFLOW_COMPILED':
        this.state.compilationStatus = 'success';
        changed = true;
        break;
    }

    if (changed) {
      this.notify();
    }
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  getState() {
    return this.state;
  }
}

export const KernelStore = new Store();

// --- Query Layer (Selectors) ---
export const Selectors = {
  getNodes: () => KernelStore.getState().nodes,
  getEdges: () => KernelStore.getState().edges,
  getNodeById: (id: string) => KernelStore.getState().nodes.find(n => n.id === id),
  getCompilationStatus: () => KernelStore.getState().compilationStatus
};
`,

  'CommandBus.ts': `
import { OSCommand } from './Types';
import { EventBus } from './EventBus';

class Bus {
  dispatch(command: OSCommand) {
    console.log(\`[CommandBus] Received: \${command.type}\`, command.payload);
    
    // Command Handler logic (in a real OS this would be a separate layer of Handlers)
    // Here we directly translate Commands to Events for the prototype
    switch (command.type) {
      case 'MOVE_NODE':
        EventBus.publish({ type: 'NODE_MOVED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'CREATE_NODE':
        EventBus.publish({ type: 'NODE_CREATED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'CREATE_EDGE':
        // Mock AI Schema Analyzer logic goes here
        const edge = command.payload.edge;
        edge.metadata = { confidence: 0.96, reason: "Matched by semantic similarity (AI Auto-mapped)", mappedFields: 2, status: 'auto' };
        EventBus.publish({ type: 'EDGE_CREATED', payload: { edge }, timestamp: Date.now() });
        EventBus.publish({ type: 'SCHEMA_MAPPED', payload: { edgeId: edge.id, metadata: edge.metadata }, timestamp: Date.now() });
        break;
      case 'LOAD_WORKFLOW':
        EventBus.publish({ type: 'WORKFLOW_LOADED', payload: command.payload, timestamp: Date.now() });
        break;
      case 'COMPILE_WORKFLOW':
        EventBus.publish({ type: 'WORKFLOW_COMPILED', payload: { plan: 'v1.0' }, timestamp: Date.now() });
        break;
      case 'RUN_WORKFLOW':
        EventBus.publish({ type: 'EXECUTION_STARTED', payload: { workflowId: command.payload.workflowId }, timestamp: Date.now() });
        // Trigger mock telemetry stream
        setTimeout(() => EventBus.publish({ type: 'NODE_STARTED', payload: { nodeId: 'header' }, timestamp: Date.now() }), 500);
        setTimeout(() => EventBus.publish({ type: 'NODE_COMPLETED', payload: { nodeId: 'header' }, timestamp: Date.now() }), 1000);
        break;
    }
  }
}

export const CommandBus = new Bus();
`,

  'Telemetry.ts': `
import { EventBus } from './EventBus';
import { OSEvent } from './Types';

export interface TelemetryEvent {
  timestamp: number;
  workflowId: string;
  nodeId?: string;
  type: string;
  duration?: number;
  runtime?: string;
  memoryUsage?: number;
  cost?: number;
  aiOptimization?: string;
}

class Stream {
  private events: TelemetryEvent[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    EventBus.subscribe(this.handleEvent.bind(this));
  }

  private handleEvent(event: OSEvent) {
    if (['EXECUTION_STARTED', 'NODE_STARTED', 'NODE_COMPLETED', 'NODE_FAILED'].includes(event.type)) {
      this.events.push({
        timestamp: event.timestamp,
        workflowId: event.payload.workflowId || 'unknown',
        nodeId: event.payload.nodeId,
        type: event.type,
        runtime: 'edge-us-east',
        memoryUsage: Math.floor(Math.random() * 50) + 10,
        cost: 0.0001
      });
      this.notify();
    }
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  getEvents() {
    return this.events;
  }
}

export const TelemetryStream = new Stream();
`,

  'PresenceManager.ts': `
import { EventBus } from './EventBus';

export interface Cursor {
  userId: string;
  x: number;
  y: number;
  color: string;
  name: string;
}

class Manager {
  private cursors: Map<string, Cursor> = new Map();
  private listeners: (() => void)[] = [];

  constructor() {
    // Inject mock users
    this.cursors.set('u1', { userId: 'u1', x: 200, y: 150, color: '#f43f5e', name: 'Sarah' });
    this.cursors.set('u2', { userId: 'u2', x: 400, y: 300, color: '#0ea5e9', name: 'David' });
    
    // Simulate cursor movement
    setInterval(() => {
      this.cursors.forEach(c => {
        c.x += (Math.random() - 0.5) * 20;
        c.y += (Math.random() - 0.5) * 20;
      });
      this.notify();
    }, 1000);
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  getCursors(): Cursor[] {
    return Array.from(this.cursors.values());
  }
}

export const PresenceManager = new Manager();
`
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(osDir, filename), content.trim());
}

console.log('OS Scaffold complete.');
