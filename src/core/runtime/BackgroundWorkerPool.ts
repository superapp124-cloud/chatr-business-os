/**
 * CHATR Kernel Runtime v2.0 — BackgroundWorkerPool
 *
 * Layer 2 — Runtime Infrastructure
 *
 * Web Worker pool for CPU-intensive tasks that must not block the UI thread:
 * - Knowledge entity extraction from long documents
 * - Search index updates
 * - AI summary generation queue
 * - Embedding generation (future semantic search)
 * - Knowledge graph edge resolution
 *
 * Falls back to synchronous execution in environments where Workers
 * are unavailable (SSR, older browsers).
 */

import { EventPriority } from './types';

export interface WorkerTask<TInput = unknown, TOutput = unknown> {
  id: string;
  type: string;
  payload: TInput;
  priority: EventPriority;
  onComplete?: (result: TOutput) => void;
  onError?: (error: string) => void;
  timeoutMs?: number;
}

type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout';

interface TaskRecord {
  id: string;
  type: string;
  status: TaskStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
}

// ─── BackgroundWorkerPool ────────────────────────────────────────────────────

class BackgroundWorkerPoolImpl {
  private queue: WorkerTask[] = [];
  private running = new Map<string, WorkerTask>();
  private history: TaskRecord[] = [];
  private readonly MAX_HISTORY = 100;
  private readonly MAX_CONCURRENT = navigator.hardwareConcurrency
    ? Math.max(2, navigator.hardwareConcurrency - 2)
    : 2;
  private processing = false;

  // ── Submit ────────────────────────────────────────────────────────────────

  submit<TInput = unknown, TOutput = unknown>(
    task: Omit<WorkerTask<TInput, TOutput>, 'id'>
  ): string {
    const id = crypto.randomUUID();
    const fullTask: WorkerTask = { ...task, id } as WorkerTask;

    // Insert by priority: critical/high go to front
    if (task.priority === 'critical' || task.priority === 'high') {
      this.queue.unshift(fullTask);
    } else {
      this.queue.push(fullTask);
    }

    this.history.push({ id, type: task.type, status: 'queued' });
    this.trimHistory();
    this.processQueue();
    return id;
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  cancel(taskId: string): boolean {
    const idx = this.queue.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      this.updateHistory(taskId, { status: 'failed', error: 'Cancelled' });
      return true;
    }
    return false;
  }

  // ── Queue processing ──────────────────────────────────────────────────────

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.running.size < this.MAX_CONCURRENT) {
      const task = this.queue.shift()!;
      this.running.set(task.id, task);
      this.updateHistory(task.id, { status: 'running', startedAt: Date.now() });
      this.executeTask(task).finally(() => {
        this.running.delete(task.id);
      });
    }

    this.processing = false;
  }

  private async executeTask(task: WorkerTask): Promise<void> {
    const startedAt = Date.now();

    // Attempt true Web Worker execution; fall back to inline async
    const canUseWorker = typeof Worker !== 'undefined';

    if (canUseWorker && task.type === 'knowledge:extract') {
      await this.executeInWorker(task, startedAt);
    } else {
      // Inline fallback for tasks that don't have a dedicated worker file
      await this.executeInline(task, startedAt);
    }
  }

  private async executeInWorker(task: WorkerTask, startedAt: number): Promise<void> {
    // Workers require bundled worker files — use inline for now
    // This stub documents the interface for future worker file creation
    await this.executeInline(task, startedAt);
  }

  private async executeInline(task: WorkerTask, startedAt: number): Promise<void> {
    try {
      const timeoutPromise = task.timeoutMs
        ? new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Task timeout')), task.timeoutMs)
          )
        : null;

      // Inline task execution — tasks declare their own async logic
      const workPromise = this.runInlineTask(task);
      const result = timeoutPromise
        ? await Promise.race([workPromise, timeoutPromise])
        : await workPromise;

      const durationMs = Date.now() - startedAt;
      this.updateHistory(task.id, { status: 'completed', completedAt: Date.now(), durationMs });
      task.onComplete?.(result);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const isTimeout = error === 'Task timeout';
      this.updateHistory(task.id, {
        status: isTimeout ? 'timeout' : 'failed',
        error,
        completedAt: Date.now(),
        durationMs: Date.now() - startedAt,
      });
      task.onError?.(error);
    }

    // Process more tasks
    this.processQueue();
  }

  private async runInlineTask(task: WorkerTask): Promise<unknown> {
    // Each task type can be handled here.
    // This is the extension point — new task types register handlers.
    const handler = this.inlineHandlers.get(task.type);
    if (handler) {
      return handler(task.payload);
    }
    // Default: just return the payload unchanged
    return task.payload;
  }

  // ── Inline handler registry ───────────────────────────────────────────────

  private inlineHandlers = new Map<string, (payload: unknown) => Promise<unknown>>();

  registerHandler(type: string, handler: (payload: unknown) => Promise<unknown>): void {
    this.inlineHandlers.set(type, handler);
  }

  // ── History & Metrics ─────────────────────────────────────────────────────

  private updateHistory(id: string, update: Partial<TaskRecord>): void {
    const record = this.history.find(r => r.id === id);
    if (record) Object.assign(record, update);
  }

  private trimHistory(): void {
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY);
    }
  }

  get queueLength(): number { return this.queue.length; }
  get runningCount(): number { return this.running.size; }
  get maxConcurrent(): number { return this.MAX_CONCURRENT; }

  getHistory(): TaskRecord[] { return [...this.history]; }

  getStats() {
    const completed = this.history.filter(r => r.status === 'completed');
    const avgDuration = completed.length === 0
      ? 0
      : completed.reduce((s, r) => s + (r.durationMs ?? 0), 0) / completed.length;
    return {
      total: this.history.length,
      completed: completed.length,
      failed: this.history.filter(r => r.status === 'failed').length,
      timeout: this.history.filter(r => r.status === 'timeout').length,
      queued: this.queue.length,
      running: this.running.size,
      avgDurationMs: Math.round(avgDuration),
    };
  }
}

export const workerPool = new BackgroundWorkerPoolImpl();
export type { BackgroundWorkerPoolImpl };
