import { IProvider, ProviderCapabilities, ProviderState, providerRegistry, ProviderRole } from './ProviderRegistry';
import { eventBus } from '@/core/runtime/EventBus';

export class SchedulerProviderImpl implements IProvider {
  id = 'sys.scheduler.local';
  name = 'Local System Scheduler';
  type = 'system';
  role: ProviderRole = 'ExecutionProvider';
  
  private activeTimers: Map<string, any> = new Map();

  capabilities(): ProviderCapabilities {
    return { canSearch: false, canBook: true, canCancel: true, canVerify: true };
  }
  
  async health(): Promise<ProviderState> {
    return { isHealthy: true, lastChecked: Date.now() };
  }

  async authenticate() { return true; }

  async create(payload: any): Promise<any> {
    console.log(`[SchedulerProvider] Scheduling timer:`, payload);
    const { id, time, title, capability } = payload;
    
    const delay = new Date(time).getTime() - Date.now();
    if (delay <= 0) throw new Error('Cannot schedule in the past');
    
    const timerId = setTimeout(() => {
      console.log(`[SchedulerProvider] Timer fired for ${id}`);
      this.activeTimers.delete(id);
      eventBus.publish('chatr:timer-fired', { commitmentId: id, title, capability }, this.id);
    }, delay);
    
    this.activeTimers.set(id, timerId);
    
    return {
      success: true,
      transactionId: `TIMER-${id}`,
      scheduledFor: new Date(time).toISOString(),
      _provider: this.name
    };
  }

  async verify(id: string): Promise<any> {
    // If it's no longer in activeTimers, it either fired or was cancelled.
    // For a robust system we'd check a history DB.
    const isPending = this.activeTimers.has(id);
    return { verified: !isPending, status: isPending ? 'PENDING' : 'COMPLETED' };
  }
  
  cancel(id: string): void {
    if (this.activeTimers.has(id)) {
      clearTimeout(this.activeTimers.get(id));
      this.activeTimers.delete(id);
      console.log(`[SchedulerProvider] Timer cancelled for ${id}`);
    }
  }
}

const schedulerProvider = new SchedulerProviderImpl();
providerRegistry.register(schedulerProvider);
