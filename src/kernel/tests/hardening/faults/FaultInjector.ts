import { IEventStore } from '../../../storage/EventStore';
import { ProjectionService } from '../../../projections/ProjectionService';
import { KernelEvent } from '../../../contracts/events/KernelEvent';

export class FaultInjector {
  constructor(
    private eventStore: IEventStore,
    private projectionService?: ProjectionService
  ) {}

  async injectDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  failNextAppend(error: Error = new Error('Injected Disk Failure')) {
    const originalAppend = this.eventStore.append.bind(this.eventStore);
    this.eventStore.append = async (streamId, events, expectedVersion) => {
      this.eventStore.append = originalAppend; // reset after throwing once
      throw error;
    };
  }

  failNextAppendAndDrop() {
    const originalAppend = this.eventStore.append.bind(this.eventStore);
    this.eventStore.append = async (streamId, events, expectedVersion) => {
      this.eventStore.append = originalAppend; 
      // Silently fail (dropped events)
      return; 
    };
  }

  crashProjectionAfterEvents(n: number) {
    if (!this.projectionService) throw new Error('No projection service bound to FaultInjector');
    const originalDispatch = (this.projectionService as any).dispatch.bind(this.projectionService);
    let count = 0;
    (this.projectionService as any).dispatch = async (event: KernelEvent) => {
      count++;
      if (count === n) {
        // We do not reset the method here, we leave it crashed until service is restarted
        throw new Error(`Injected Crash: ProjectionService died after ${n} events`);
      }
      return originalDispatch(event);
    };
  }

  // Forces the projection service to stop completely 
  killProjectionService() {
    if (!this.projectionService) throw new Error('No projection service');
    this.projectionService.stop();
  }
}
