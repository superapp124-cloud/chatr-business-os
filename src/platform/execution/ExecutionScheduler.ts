/**
 * ExecutionScheduler — Phase A.5
 *
 * Responsible for: priority ordering, retry budget management, concurrency
 * control, cancellation, and task-level timeout enforcement.
 *
 * The Scheduler operates on PlannedTask[] from ExecutionPlanner.
 * It never executes nodes — it decides WHEN and in what ORDER they run.
 *
 * Plane: Execution Plane
 * Imports: platform/contracts, platform/execution/ExecutionPlanner
 */

import type { PlannedTask } from './ExecutionPlanner';

// ─── Scheduler config ─────────────────────────────────────────────────────────

export interface SchedulerConfig {
  /** Maximum number of nodes to execute in parallel. Default: 4 */
  maxConcurrency: number;
  /** Whether to stop all tasks if one fails. Default: true */
  failFast: boolean;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrency: 4,
  failFast: true,
};

// ─── Task runner interface — provided by ExecutionRuntime ─────────────────────

export type TaskRunner = (task: PlannedTask, attemptNumber: number) => Promise<void>;

// ─── Cancellation token ───────────────────────────────────────────────────────

export class CancellationToken {
  private _cancelled = false;

  cancel(): void {
    this._cancelled = true;
  }

  get isCancelled(): boolean {
    return this._cancelled;
  }
}

// ─── ExecutionScheduler ───────────────────────────────────────────────────────

export class ExecutionScheduler {
  private config: SchedulerConfig;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute all tasks in the plan in topological order.
   * Tasks at the same runOrder level are executed concurrently up to maxConcurrency.
   * Retries are applied per-task up to PlannedTask.retryCount.
   *
   * @param tasks - Ordered tasks from ExecutionPlanner.compile()
   * @param runner - Provided by ExecutionRuntime — runs a single task
   * @param token  - Optional cancellation token
   */
  async schedule(
    tasks: PlannedTask[],
    runner: TaskRunner,
    token?: CancellationToken,
  ): Promise<void> {
    // Group tasks by runOrder level for parallel batching
    const levels = new Map<number, PlannedTask[]>();
    for (const task of tasks) {
      if (!levels.has(task.runOrder)) {
        levels.set(task.runOrder, []);
      }
      levels.get(task.runOrder)!.push(task);
    }

    const sortedLevels = Array.from(levels.entries()).sort(([a], [b]) => a - b);

    for (const [, levelTasks] of sortedLevels) {
      if (token?.isCancelled) {
        break;
      }

      // Process tasks at this level in batches of maxConcurrency
      for (let i = 0; i < levelTasks.length; i += this.config.maxConcurrency) {
        const batch = levelTasks.slice(i, i + this.config.maxConcurrency);

        const results = await Promise.allSettled(
          batch.map(task => this.runWithRetry(task, runner, token)),
        );

        if (this.config.failFast) {
          const failure = results.find(r => r.status === 'rejected');
          if (failure) {
            throw (failure as PromiseRejectedResult).reason;
          }
        }
      }
    }
  }

  /**
   * Run a single task with retry logic.
   * Retries are attempted on failure up to task.retryCount times.
   * Each retry uses exponential backoff with a 500ms base.
   */
  private async runWithRetry(
    task: PlannedTask,
    runner: TaskRunner,
    token?: CancellationToken,
  ): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= task.retryCount; attempt++) {
      if (token?.isCancelled) return;

      try {
        await Promise.race([
          runner(task, attempt),
          this.timeout(task.timeoutMs, task.nodeId),
        ]);
        return; // Success
      } catch (err) {
        lastError = err;
        if (attempt < task.retryCount) {
          const backoffMs = Math.min(500 * Math.pow(2, attempt), 8000);
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }
    }

    throw lastError;
  }

  /** Rejects after timeoutMs — used in Promise.race against the task runner */
  private timeout(ms: number, nodeId: string): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Node "${nodeId}" timed out after ${ms}ms`)),
        ms,
      ),
    );
  }
}
