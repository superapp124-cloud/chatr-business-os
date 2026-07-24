/**
 * CHATR OS Scheduler Service
 * 
 * The single source of truth for all time-based commitments.
 * 
 * Architecture:
 *   Capability Executor
 *       ↓
 *   OSSchedulerService.schedule(entry)
 *       ↓
 *   Persisted to localStorage (survives refresh)
 *       ↓
 *   Boot-time hydration re-arms setTimeout for future entries
 *       ↓
 *   Timer fires → NotificationService.deliver() + eventBus.publish('chatr:timer-fired')
 *       ↓
 *   RealityEngine verifies → CommitmentRuntime transitions to completed
 * 
 * Daily Timeline simply reads: OSSchedulerService.getAll()
 */

import { v4 as uuidv4 } from 'uuid';
import { telemetry as TelemetryService } from './TelemetryService';
import { eventBus } from '@/core/runtime/EventBus';
import { notificationEngine } from './NotificationEngine';

export type ScheduleEntryType =
  | 'reminder'
  | 'meeting'
  | 'calendar_event'
  | 'task_due'
  | 'follow_up'
  | 'interview'
  | 'flight_checkin'
  | 'hotel_checkin'
  | 'medicine'
  | 'habit'
  | 'birthday';

export interface ScheduleEntry {
  id: string;                        // Maps to commitment.id
  capability: string;                // e.g. 'core.reminder'
  type: ScheduleEntryType;
  title: string;
  scheduledFor: string;              // ISO 8601 datetime
  createdAt: string;
  status: 'pending' | 'fired' | 'cancelled' | 'overdue';
  metadata?: {
    attendees?: string[];
    location?: string;
    notes?: string;
    calendarEventId?: string;        // External calendar ID (Google/Outlook)
    reminderMinutesBefore?: number;  // For events: remind N minutes before
    [key: string]: any;
  };
}

const STORAGE_KEY = 'chatr_os_scheduler_v1';

export class OSSchedulerServiceImpl {
  private static instance: OSSchedulerServiceImpl;
  private entries: Map<string, ScheduleEntry> = new Map();
  private activeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private constructor() {
    this.hydrate();
    this.armAllPendingTimers();
  }

  public static getInstance(): OSSchedulerServiceImpl {
    if (!OSSchedulerServiceImpl.instance) {
      OSSchedulerServiceImpl.instance = new OSSchedulerServiceImpl();
    }
    return OSSchedulerServiceImpl.instance;
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  private hydrate(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: ScheduleEntry[] = JSON.parse(saved);
        parsed.forEach(e => this.entries.set(e.id, e));
        console.log(`[OSScheduler] Hydrated ${parsed.length} scheduled entries from storage.`);
      }
    } catch (err) {
      console.warn('[OSScheduler] Failed to hydrate from localStorage:', err);
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.entries.values())));
    } catch (err) {
      console.warn('[OSScheduler] Failed to persist to localStorage:', err);
    }
  }

  // ─── Core API ────────────────────────────────────────────────────────────────

  public schedule(entry: Omit<ScheduleEntry, 'createdAt' | 'status'>): ScheduleEntry {
    const full: ScheduleEntry = {
      ...entry,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    // Cancel any existing timer for this ID before rescheduling
    this.cancel(entry.id, false);

    this.entries.set(full.id, full);
    this.persist();
    this.armTimer(full);

    console.log(`[OSScheduler] Scheduled "${full.title}" for ${full.scheduledFor}`);
    return full;
  }

  public cancel(id: string, persist = true): void {
    const timer = this.activeTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(id);
    }
    const entry = this.entries.get(id);
    if (entry) {
      entry.status = 'cancelled';
      this.entries.set(id, entry);
      if (persist) this.persist();
    }
  }

  public getEntry(id: string): ScheduleEntry | undefined {
    return this.entries.get(id);
  }

  /** Returns all non-cancelled entries, sorted ascending by scheduledFor */
  public getAll(): ScheduleEntry[] {
    return Array.from(this.entries.values())
      .filter(e => e.status !== 'cancelled')
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }

  /** Returns entries grouped by day (ISO date string keys) */
  public getGroupedByDay(): Record<string, ScheduleEntry[]> {
    const result: Record<string, ScheduleEntry[]> = {};
    this.getAll().forEach(entry => {
      const day = entry.scheduledFor.split('T')[0]; // 'YYYY-MM-DD'
      if (!result[day]) result[day] = [];
      result[day].push(entry);
    });
    return result;
  }

  /** Today's entries */
  public getToday(): ScheduleEntry[] {
    const today = new Date().toISOString().split('T')[0];
    return this.getAll().filter(e => e.scheduledFor.startsWith(today));
  }

  /** Overdue entries (scheduled in past, still pending) */
  public getOverdue(): ScheduleEntry[] {
    const now = Date.now();
    return this.getAll().filter(e => 
      e.status === 'pending' && new Date(e.scheduledFor).getTime() < now
    );
  }

  // ─── Timer Management ────────────────────────────────────────────────────────

  private armAllPendingTimers(): void {
    const now = Date.now();
    let armed = 0;
    let overdue = 0;

    this.entries.forEach(entry => {
      if (entry.status !== 'pending') return;
      const fireAt = new Date(entry.scheduledFor).getTime();

      if (fireAt <= now) {
        // Mark as overdue — don't fire automatically (user may have missed it)
        entry.status = 'overdue';
        overdue++;
      } else {
        this.armTimer(entry);
        armed++;
      }
    });

    if (overdue > 0) this.persist();
    console.log(`[OSScheduler] Boot: ${armed} timers armed, ${overdue} overdue entries.`);
  }

  private armTimer(entry: ScheduleEntry): void {
    const delay = new Date(entry.scheduledFor).getTime() - Date.now();
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      this.onTimerFired(entry.id);
    }, delay);

    this.activeTimers.set(entry.id, timer);
  }

  private onTimerFired(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;

    console.log(`[OSScheduler] Timer fired: "${entry.title}" (${entry.id})`);

    entry.status = 'fired';
    this.entries.set(id, entry);
    this.persist();
    this.activeTimers.delete(id);

    // 1. Deliver in-app notification
    this.deliverNotification(entry);

    // 2. Publish to event bus so RealityEngine can verify and complete the commitment
    eventBus.publish('chatr:timer-fired', {
      commitmentId: entry.id,
      title: entry.title,
      capability: entry.capability,
      entry,
    }, 'OSSchedulerService');
  }

  private deliverNotification(entry: ScheduleEntry): void {
    notificationEngine.deliver({
      id: entry.id,
      title: `⏰ ${entry.title}`,
      body: `Scheduled for ${new Date(entry.scheduledFor).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      channels: ['desktop']
    });
  }

  // ─── Statistics ──────────────────────────────────────────────────────────────

  public getStats(): { total: number; pending: number; fired: number; cancelled: number; overdue: number } {
    const all = Array.from(this.entries.values());
    return {
      total: all.length,
      pending: all.filter(e => e.status === 'pending').length,
      fired: all.filter(e => e.status === 'fired').length,
      cancelled: all.filter(e => e.status === 'cancelled').length,
      overdue: all.filter(e => e.status === 'overdue').length,
    };
  }
}

export const osScheduler = OSSchedulerServiceImpl.getInstance();
