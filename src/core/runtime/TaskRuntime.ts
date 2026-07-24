import { eventBus } from './EventBus';

/**
 * Cancellation Token for cooperative task cancellation.
 */
export class CancellationToken {
  private isCancelled = false;
  private reason?: string;
  private listeners: Array<(reason?: string) => void> = [];

  public get cancelled(): boolean {
    return this.isCancelled;
  }

  public get cancellationReason(): string | undefined {
    return this.reason;
  }

  public cancel(reason?: string): void {
    if (this.isCancelled) return;
    this.isCancelled = true;
    this.reason = reason;
    this.listeners.forEach(l => l(reason));
  }

  public onCancel(listener: (reason?: string) => void): () => void {
    if (this.isCancelled) {
      listener(this.reason);
      return () => {};
    }
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public throwIfCancelled(): void {
    if (this.isCancelled) {
      throw new Error(`Task cancelled: ${this.reason || 'No reason provided'}`);
    }
  }
}

/**
 * Task Priorities
 */
export enum TaskPriority {
  CRITICAL = 0,    // Interactive / User-facing
  HIGH = 1,        // Fast pipelines
  NORMAL = 2,      // Standard workflows
  LOW = 3,         // Background syncs
  BATCH = 4        // Heavy batch jobs
}

export interface TaskMetadata {
  priority: TaskPriority;
  timeoutMs: number;
  maxRetries: number;
  estimatedCostMs?: number;
  domain?: string;
}

export type TaskStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/**
 * Generic Task Interface
 */
export interface ITask<TResult = any> {
  id: string;
  workflowId?: string; // Optional: ties back to a pipeline
  name: string;
  metadata: TaskMetadata;
  status: TaskStatus;
  
  execute(token: CancellationToken): Promise<TResult>;
  compensate?(): Promise<void>;
}

export interface TaskResult<T = any> {
  taskId: string;
  workflowId?: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  result?: T;
  error?: Error;
  latencyMs: number;
}

/**
 * The Task Runtime (Generic Execution Engine)
 * Owns concurrency, throttling, and task execution.
 */
export class TaskRuntime {
  private static instance: TaskRuntime;
  
  private queue: ITask[] = [];
  private activeWorkers = 0;
  
  // Adaptive scaling params
  private minWorkers = 2;
  private maxWorkers = 16;
  private targetWorkers = 4; // In real life, bound to `navigator.hardwareConcurrency`

  private constructor() {
    // Try to be hardware aware if available
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      this.targetWorkers = Math.max(this.minWorkers, Math.min(this.maxWorkers, navigator.hardwareConcurrency));
    }
    
    // Periodically assess if we need to wake up more workers
    setInterval(() => this.scaleWorkers(), 100);

    // Adaptive Memory Management
    eventBus.subscribe('MEMORY_WARNING', () => {
      console.warn('[TaskRuntime] Memory warning received. Shrinking worker pools.');
      this.maxWorkers = Math.max(this.minWorkers, Math.floor(this.maxWorkers / 2));
      this.targetWorkers = Math.max(this.minWorkers, Math.floor(this.targetWorkers / 2));
    });
  }

  public static getInstance(): TaskRuntime {
    if (!TaskRuntime.instance) {
      TaskRuntime.instance = new TaskRuntime();
    }
    return TaskRuntime.instance;
  }

  /**
   * Submit a task for scheduling.
   * Emits an event, no polling needed by the sender.
   */
  public submit(task: ITask): void {
    task.status = 'QUEUED';
    this.queue.push(task);
    
    // Sort by priority (0 is highest). Standard Priority Scheduler policy.
    this.queue.sort((a, b) => a.metadata.priority - b.metadata.priority);

    eventBus.publish('TASK_QUEUED', { taskId: task.id, queueDepth: this.queue.length });
    
    this.scaleWorkers();
  }

  /**
   * Determine if we need to spawn a new async worker loop.
   */
  private scaleWorkers() {
    if (this.queue.length === 0) return;

    // Scale up if we have pending work and haven't hit our concurrency limit
    // We dynamically decide max workers based on queue depth vs target (very crude adaptive)
    const allowedWorkers = this.queue.length > 50 ? this.maxWorkers : this.targetWorkers;

    while (this.activeWorkers < allowedWorkers && this.queue.length > 0) {
      this.activeWorkers++;
      this.runWorkerLoop();
    }
  }

  /**
   * The actual async worker execution loop.
   * Pulls tasks until the queue is empty, then spins down.
   */
  private async runWorkerLoop(): Promise<void> {
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      task.status = 'RUNNING';
      const startTime = performance.now();
      const token = new CancellationToken();
      
      let timeoutId: any;
      if (task.metadata.timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          token.cancel('Task Timeout Exceeded');
        }, task.metadata.timeoutMs);
      }

      eventBus.publish('TASK_STARTED', { taskId: task.id, name: task.name, workflowId: task.workflowId });

      try {
        let attempts = 0;
        let success = false;
        let finalResult: any;

        // Built-in Retry loop handled by the Worker, not the DAG owner
        while (attempts <= task.metadata.maxRetries && !success) {
          try {
            token.throwIfCancelled();
            finalResult = await task.execute(token);
            success = true;
          } catch (err: any) {
            attempts++;
            if (token.cancelled || attempts > task.metadata.maxRetries) {
              throw err;
            }
            // Exponential backoff could go here
            await new Promise(r => setTimeout(r, 100 * attempts));
          }
        }

        task.status = 'COMPLETED';
        const result: TaskResult = {
          taskId: task.id,
          workflowId: task.workflowId,
          status: 'COMPLETED',
          result: finalResult,
          latencyMs: Math.round(performance.now() - startTime)
        };
        eventBus.publish('TASK_COMPLETED', result);

      } catch (err: any) {
        task.status = token.cancelled ? 'CANCELLED' : 'FAILED';
        const result: TaskResult = {
          taskId: task.id,
          workflowId: task.workflowId,
          status: task.status as 'FAILED' | 'CANCELLED',
          error: err,
          latencyMs: Math.round(performance.now() - startTime)
        };
        eventBus.publish(token.cancelled ? 'TASK_CANCELLED' : 'TASK_FAILED', result);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    // Worker goes idle
    this.activeWorkers--;
  }

  // --- Diagnostics for Engine Health Dashboard ---
  public getMetrics() {
    return {
      queueDepth: this.queue.length,
      activeWorkers: this.activeWorkers,
      maxWorkers: this.maxWorkers,
      targetWorkers: this.targetWorkers
    };
  }
}

export const taskRuntime = TaskRuntime.getInstance();
