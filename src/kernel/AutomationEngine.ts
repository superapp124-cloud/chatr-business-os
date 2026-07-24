import { ExecutionContext } from './ExecutionContext';
import { EventBus } from './EventBus';
import { Logger } from '@/runtime/Logger';

interface Job {
  id: string;
  intent: any;
  context: ExecutionContext;
  status: 'pending' | 'running' | 'completed' | 'failed';
  retryCount: number;
}

export class AutomationEngineService {
  private queue: Job[] = [];

  /**
   * Decoupled Automation Engine.
   * Instead of depending on pg_cron, it exposes a Queue that can be processed by 
   * any external worker (Vercel Cron, GitHub Actions, Kubernetes, etc.)
   */
  async enqueueJob(intent: any, context: ExecutionContext) {
    const job: Job = {
      id: crypto.randomUUID(),
      intent,
      context,
      status: 'pending',
      retryCount: 0
    };
    this.queue.push(job);
    Logger.info(`Job enqueued: ${job.id}`, context);
    
    // Publish that a job was scheduled
    EventBus.publish('Automation.JobScheduled', { jobId: job.id, intent }, context);
  }

  /**
   * Processed by an external worker loop calling this endpoint.
   */
  async processNextBatch(batchSize: number = 10) {
    const pendingJobs = this.queue.filter(j => j.status === 'pending').slice(0, batchSize);
    
    for (const job of pendingJobs) {
      job.status = 'running';
      try {
        // Feed it back into the ExecutionKernel pipeline
        const { ExecutionKernel } = await import('./ExecutionKernel');
        await ExecutionKernel.execute(job.intent, job.context);
        
        job.status = 'completed';
        Logger.info(`Job completed: ${job.id}`, job.context);
      } catch (e) {
        job.status = 'failed';
        job.retryCount++;
        Logger.error(`Job failed: ${job.id}`, e as Error, job.context);
        
        // Re-queue logic would go here if retryCount < maxRetries
      }
    }
  }
}

export const AutomationEngine = new AutomationEngineService();
