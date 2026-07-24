import { KernelSession, KernelSessionEvent, IntentContext } from './KernelSession';

declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, data: any) => void;
      invoke: (channel: string, data: any) => Promise<any>;
      on: (channel: string, func: (...args: any[]) => void) => () => void;
    };
  }
}

export class ElectronKernelSession implements KernelSession {
  private subscribers: Array<(event: KernelSessionEvent) => void> = [];
  private context: IntentContext;
  private goalId: string | null = null;
  private cleanupListeners: Array<() => void> = [];

  constructor() {
    this.context = { intent: '' };
  }

  subscribe(callback: (event: KernelSessionEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private emit(event: KernelSessionEvent) {
    this.subscribers.forEach(cb => cb(event));
  }

  private setupIPCListeners() {
    if (!window.electronAPI) return;

    const cleanup = window.electronAPI.on('kernel:session:event', (eventData: any) => {
      if (eventData.goalId !== this.goalId) return;

      // Map IPC KernelEvent to KernelSessionEvent
      if (eventData.stage === 'DISCOVERY_STARTED') {
        this.emit({ type: 'STATE_CHANGED', state: 'resolving', context: this.context });
      } else if (eventData.stage === 'METRIC') {
        const metric = {
          stage: eventData.payload.stageName,
          startedAt: eventData.startedAt,
          finishedAt: eventData.finishedAt,
          latencyMs: eventData.latency,
          slaMs: eventData.payload.slaMs || 500
        };
        
        if (!this.context.metrics) this.context.metrics = {};
        this.context.metrics[metric.stage] = metric;

        // Update tasksCompleted dynamically based on incoming metrics
        if (!this.context.tasksCompleted) this.context.tasksCompleted = {};
        
        const stageName = metric.stage.toLowerCase();
        if (stageName.includes('understanding')) this.context.tasksCompleted.understanding = true;
        if (stageName.includes('location')) this.context.tasksCompleted.location = true;
        if (stageName.includes('search')) this.context.tasksCompleted.providerSearch = true;
        if (stageName.includes('session')) this.context.tasksCompleted.sessionCheck = true;
        
        this.emit({ type: 'METRIC_RECORDED', metric, context: { ...this.context } });
      } else if (eventData.stage === 'RESULTS_READY') {
        this.context.topResults = eventData.payload.results;
        this.emit({ type: 'STATE_CHANGED', state: 'results_ready', context: { ...this.context } });
      } else if (eventData.stage === 'RECOVERY_PROPOSAL') {
        // Example handling for recovery
        console.warn('Recovery proposal received:', eventData.payload);
      }
    });

    this.cleanupListeners.push(cleanup);
  }

  async submitIntent(intent: string): Promise<void> {
    this.context = { intent, metrics: {}, tasksCompleted: {} };
    
    if (!window.electronAPI) {
      console.warn('ElectronAPI not found. Cannot submit real intent.');
      this.emit({ type: 'ERROR', message: 'Not running in Electron environment' });
      return;
    }

    try {
      const response = await window.electronAPI.invoke('kernel:intent:submit', { intent });
      this.goalId = response.goalId;
      this.setupIPCListeners();
      
      // Subscribe to this specific intent's streaming updates
      window.electronAPI.send('kernel:intent:subscribe', { goalId: this.goalId });
      
    } catch (err: any) {
      this.emit({ type: 'ERROR', message: err.message });
    }
  }

  async selectOption(resultId: string): Promise<void> {
    const selected = this.context.topResults?.find(r => r.id === resultId);
    if (selected) {
      this.context.selectedResult = selected;
    }
    
    this.emit({ type: 'STATE_CHANGED', state: 'connecting', context: { ...this.context } });

    if (window.electronAPI && this.goalId) {
      window.electronAPI.send('kernel:intent:select', { goalId: this.goalId, resultId });
    }
  }

  async completeAuth(): Promise<void> {
    if (window.electronAPI && this.goalId) {
      window.electronAPI.send('kernel:intent:auth_complete', { goalId: this.goalId });
    }
  }

  async confirmAndPay(): Promise<void> {
    if (window.electronAPI && this.goalId) {
      window.electronAPI.send('kernel:intent:pay', { goalId: this.goalId });
    }
  }

  destroy() {
    if (window.electronAPI && this.goalId) {
      window.electronAPI.send('kernel:intent:unsubscribe', { goalId: this.goalId });
    }
    this.cleanupListeners.forEach(cleanup => cleanup());
    this.cleanupListeners = [];
    this.subscribers = [];
    this.goalId = null;
  }
}
