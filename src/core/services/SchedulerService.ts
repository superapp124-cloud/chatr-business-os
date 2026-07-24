type ScheduleCallback = (data: any) => Promise<void>;

export class SchedulerService {
  private static instance: SchedulerService;
  private jobs: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private constructor() {}

  public static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  /**
   * Schedule a job to run at a specific Date
   */
  public scheduleAt(id: string, date: Date, data: any, callback: ScheduleCallback): void {
    const delay = date.getTime() - Date.now();
    if (delay <= 0) {
      // Execute immediately if time is in the past
      callback(data).catch(console.error);
      return;
    }

    if (this.jobs.has(id)) {
      this.cancel(id);
    }

    const timerId = setTimeout(() => {
      this.jobs.delete(id);
      callback(data).catch(console.error);
    }, delay);

    this.jobs.set(id, timerId);
    console.log(`[Scheduler] Job ${id} scheduled to run in ${delay}ms`);
  }

  /**
   * Cancel a scheduled job
   */
  public cancel(id: string): void {
    const timerId = this.jobs.get(id);
    if (timerId) {
      clearTimeout(timerId);
      this.jobs.delete(id);
      console.log(`[Scheduler] Job ${id} cancelled`);
    }
  }

  /**
   * Schedule a recurring job (cron-like)
   * Simplified implementation for MVP
   */
  public scheduleRecurring(id: string, intervalMs: number, data: any, callback: ScheduleCallback): void {
    const run = async () => {
      try {
        await callback(data);
      } catch (err) {
        console.error(`[Scheduler] Recurring job ${id} failed:`, err);
      } finally {
        if (this.jobs.has(id)) {
          const timerId = setTimeout(run, intervalMs);
          this.jobs.set(id, timerId);
        }
      }
    };
    
    // Initial start
    const timerId = setTimeout(run, intervalMs);
    this.jobs.set(id, timerId);
  }
}

export const schedulerService = SchedulerService.getInstance();
