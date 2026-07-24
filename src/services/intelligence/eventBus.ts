/**
 * CHATR Intelligence Engine – Event Bus
 *
 * Decision 4: Event-driven architecture. No module communicates directly
 * with another module – everything flows through this bus.
 *
 * Design choices:
 *  - Synchronous subscriber dispatch (microtask-safe) for reliability.
 *  - Each topic is typed so TypeScript catches mismatches at compile time.
 *  - Dead-letter queue captures failed handler errors without crashing the bus.
 *  - All handlers are called in registration order; errors in one do not
 *    prevent later handlers from running.
 */

import type { CommunicationEvent } from './schema';

// ─────────────────────────────────────────────────────────────────────────────
// Event Topics
// ─────────────────────────────────────────────────────────────────────────────

export interface IntelligenceEventMap {
  /** A new raw event arrived from a plugin before any AI processing */
  'event:raw': CommunicationEvent;

  /** The threat engine has analysed the event */
  'event:threat_analysed': CommunicationEvent;

  /** Classification & entity extraction complete */
  'event:classified': CommunicationEvent;

  /** Relationship engine has scored the event */
  'event:relationship_scored': CommunicationEvent;

  /** Priority / attention score computed */
  'event:prioritised': CommunicationEvent;

  /** Suggested actions generated */
  'event:actions_generated': CommunicationEvent;

  /** Event fully processed and written to the timeline */
  'event:timeline_updated': CommunicationEvent;

  /** Notification engine has decided whether to alert the user */
  'event:notification_decided': CommunicationEvent;

  /** A pipeline step failed for this event */
  'event:pipeline_error': { event: CommunicationEvent; step: string; error: Error };

  /** The daily brief data changed */
  'brief:updated': void;

  /** Search index rebuilt */
  'search:indexed': { count: number };

  /** A plugin changed connection status */
  'plugin:status_changed': { source: string; connected: boolean };
}

export type IntelligenceTopic = keyof IntelligenceEventMap;

type Handler<T extends IntelligenceTopic> = (
  payload: IntelligenceEventMap[T]
) => void | Promise<void>;

interface Subscription {
  topic: IntelligenceTopic;
  handler: Handler<any>;
  once: boolean;
}

interface DeadLetterEntry {
  topic: IntelligenceTopic;
  error: Error;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bus Implementation
// ─────────────────────────────────────────────────────────────────────────────

class IntelligenceEventBus {
  private subscriptions: Subscription[] = [];
  private deadLetters: DeadLetterEntry[] = [];
  private readonly MAX_DEAD_LETTERS = 100;

  /**
   * Subscribe to a topic. Returns an unsubscribe function.
   */
  on<T extends IntelligenceTopic>(
    topic: T,
    handler: Handler<T>
  ): () => void {
    const sub: Subscription = { topic, handler, once: false };
    this.subscriptions.push(sub);
    return () => this.off(topic, handler);
  }

  /**
   * Subscribe for a single emission only.
   */
  once<T extends IntelligenceTopic>(
    topic: T,
    handler: Handler<T>
  ): () => void {
    const sub: Subscription = { topic, handler, once: true };
    this.subscriptions.push(sub);
    return () => this.off(topic, handler);
  }

  /**
   * Remove a previously registered handler.
   */
  off<T extends IntelligenceTopic>(
    topic: T,
    handler: Handler<T>
  ): void {
    this.subscriptions = this.subscriptions.filter(
      (s) => !(s.topic === topic && s.handler === handler)
    );
  }

  /**
   * Emit an event to all subscribers for the given topic.
   * Errors in individual handlers are caught, logged, and written to the
   * dead-letter queue so other handlers continue unaffected.
   */
  async emit<T extends IntelligenceTopic>(
    topic: T,
    payload: IntelligenceEventMap[T]
  ): Promise<void> {
    const toCall = this.subscriptions.filter((s) => s.topic === topic);

    // Remove once-subscriptions before calling handlers
    this.subscriptions = this.subscriptions.filter(
      (s) => !(s.topic === topic && s.once)
    );

    for (const sub of toCall) {
      try {
        await sub.handler(payload);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`[EventBus] Handler error on topic "${topic}":`, error);
        this.recordDeadLetter(topic, error);
      }
    }
  }

  /**
   * Returns a snapshot of the dead-letter queue for debugging.
   */
  getDeadLetters(): DeadLetterEntry[] {
    return [...this.deadLetters];
  }

  clearDeadLetters(): void {
    this.deadLetters = [];
  }

  /** How many handlers are registered across all topics */
  get subscriberCount(): number {
    return this.subscriptions.length;
  }

  private recordDeadLetter(topic: IntelligenceTopic, error: Error): void {
    this.deadLetters.push({
      topic,
      error,
      timestamp: new Date().toISOString(),
    });
    if (this.deadLetters.length > this.MAX_DEAD_LETTERS) {
      this.deadLetters.shift();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton export
// ─────────────────────────────────────────────────────────────────────────────

export const intelligenceBus = new IntelligenceEventBus();
