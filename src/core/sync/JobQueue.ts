import { storageEngine } from '../storage/StorageEngine';

export interface Job {
  id?: number;
  type: string;
  payload: string; // JSON string
  priority: number; // Lower is higher priority
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  nextRunAt: number;
  error?: string;
}

export type JobHandler = (payload: any) => Promise<void>;

export class JobQueue {
  private handlers = new Map<string, JobHandler>();
  private isProcessing = false;

  public async initializeSchema(): Promise<void> {
    const db = storageEngine.getAdapter();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS job_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        priority INTEGER DEFAULT 10,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        next_run_at INTEGER NOT NULL,
        error TEXT
      )
    `);
  }

  public registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  public async enqueue(type: string, payload: any, options?: { priority?: number, maxAttempts?: number, runAt?: number }): Promise<number> {
    const db = storageEngine.getAdapter();
    const id = await db.insert('job_queue', {
      type,
      payload: JSON.stringify(payload),
      priority: options?.priority || 10,
      status: 'pending',
      attempts: 0,
      max_attempts: options?.maxAttempts || 3,
      next_run_at: options?.runAt || Date.now(),
      error: null
    });
    
    // Asynchronously kick off processing if idle
    this.processNext().catch(console.error);
    
    return id as number;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const db = storageEngine.getAdapter();
      
      // Find highest priority pending job that is ready to run
      const rows = await db.query(
        `SELECT * FROM job_queue WHERE status = 'pending' AND next_run_at <= ? ORDER BY priority ASC, id ASC LIMIT 1`,
        [Date.now()]
      );

      if (rows.length === 0) {
        this.isProcessing = false;
        return;
      }

      const row = rows[0];
      const jobId = row.id;

      // Mark as running
      await db.update('job_queue', { status: 'running' }, { id: jobId });

      const handler = this.handlers.get(row.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${row.type}`);
      }

      try {
        await handler(JSON.parse(row.payload));
        // Success
        await db.update('job_queue', { status: 'completed' }, { id: jobId });
      } catch (err: any) {
        console.error(`[JobQueue] Job ${jobId} failed:`, err);
        const attempts = row.attempts + 1;
        const maxAttempts = row.max_attempts;

        if (attempts >= maxAttempts) {
          await db.update('job_queue', { 
            status: 'failed', 
            attempts,
            error: err.message
          }, { id: jobId });
        } else {
          // Exponential backoff
          const backoff = Math.pow(2, attempts) * 1000;
          await db.update('job_queue', { 
            status: 'pending', 
            attempts,
            next_run_at: Date.now() + backoff,
            error: err.message
          }, { id: jobId });
        }
      }

      // Loop to process next
      this.isProcessing = false;
      this.processNext().catch(console.error);

    } catch (err) {
      console.error('[JobQueue] Error in processing loop', err);
      this.isProcessing = false;
    }
  }
}

export const jobQueue = new JobQueue();
