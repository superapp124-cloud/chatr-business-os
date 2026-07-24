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
        // CommandBus sends payload directly as the node data (type, position, etc.)
        this.state.nodes.push({
          id: `node-${Date.now()}`,
          type: event.payload.type || 'core.ai_agent',
          position: event.payload.position || { x: Math.random() * 400, y: Math.random() * 300 },
          data: event.payload.data || {}
        });
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
import { ActiveSelfHealingService } from './SelfHealingService';
// Keep service alive
(window as any)._selfHealingService = ActiveSelfHealingService;
