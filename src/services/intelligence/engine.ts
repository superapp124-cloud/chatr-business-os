/**
 * CHATR Intelligence Engine – Central Ingest & Routing Pipeline
 *
 * This is the single entry point for all communication events.
 * Every plugin calls `intelligenceEngine.ingest(event)` and the engine
 * fans the event through the bus in the correct order:
 *
 *   raw → threat → classified → relationship_scored
 *       → prioritised → actions_generated → timeline_updated
 *       → notification_decided
 *
 * Decision 4:  Event-driven – modules subscribe to the bus, not each other.
 * Decision 11: Cloud AI never runs automatically.
 * Decision 6:  Plugin registry for registering/unregistering providers.
 */

import { intelligenceBus } from './eventBus';
import { db } from './repository';
import { communicationGraph } from './communicationGraph';
import { localAIPipeline } from './localPipeline';
import { gmailPlugin } from './plugins/gmailPlugin';
import { smsPlugin } from './plugins/smsPlugin';
import { callsPlugin } from './plugins/callsPlugin';
import type { CommunicationEvent } from './schema';
import type { ICommunicationProvider } from './providers';

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Registry
// ─────────────────────────────────────────────────────────────────────────────

class IntelligenceEngine {
  private providers = new Map<string, ICommunicationProvider>();
  private initialised = false;

  /**
   * Initialise storage and wire up the event-bus pipeline.
   * Call once at app startup.
   */
  async init(): Promise<void> {
    if (this.initialised) return;
    await db.init();
    this.wirePipeline();

    // Register built-in plugins – every communication source enters the same pipeline
    this.registerPlugin(gmailPlugin);
    this.registerPlugin(smsPlugin);
    this.registerPlugin(callsPlugin);

    this.initialised = true;
    console.info('[IntelligenceEngine] Initialised ✓');
  }

  // ── Plugin management ────────────────────────────────────────────────────

  registerPlugin(provider: ICommunicationProvider): void {
    this.providers.set(provider.source, provider);

    // Forward real-time events from the plugin into the pipeline
    provider.onEvent((event) => {
      this.ingest(event).catch((err) =>
        console.error(`[IntelligenceEngine] Plugin event error (${provider.source}):`, err)
      );
    });

    intelligenceBus.emit('plugin:status_changed', {
      source: provider.source,
      connected: provider.getStatus().connected,
    });
    console.info(`[IntelligenceEngine] Plugin registered: ${provider.displayName}`);
  }

  async syncPlugin(source: string, since?: string): Promise<number> {
    const provider = this.providers.get(source);
    if (!provider) throw new Error(`No plugin registered for source: ${source}`);

    const events = await provider.sync(since);
    for (const event of events) {
      await this.ingest(event);
    }
    return events.length;
  }

  getPluginStatus(source: string) {
    return this.providers.get(source)?.getStatus() ?? null;
  }

  // ── Main ingest ──────────────────────────────────────────────────────────

  /**
   * Ingest a canonical CommunicationEvent into the pipeline.
   * Idempotent – if the event already exists it is updated rather than duplicated.
   */
  async ingest(event: CommunicationEvent): Promise<void> {
    if (!this.initialised) await this.init();

    try {
      // Persist raw event immediately so it is never lost
      await db.saveEvent(event);

      // Announce raw arrival
      await intelligenceBus.emit('event:raw', event);
    } catch (err) {
      console.error('[IntelligenceEngine] Ingest error:', err);
    }
  }

  // ── Query helpers ────────────────────────────────────────────────────────

  async getTimeline(options?: {
    source?: CommunicationEvent['source'];
    limit?: number;
    offset?: number;
    orderBy?: 'timestamp' | 'attention';
  }) {
    return db.queryEvents({
      ...options,
      orderBy: options?.orderBy ?? 'attention',
      orderDir: 'desc',
    });
  }

  async getEntityTimeline(entityId: string, limit = 50) {
    return communicationGraph.getEntityTimeline(entityId, limit);
  }

  async search(query: string, limit = 20) {
    return db.searchEvents({ query, limit });
  }

  async getDailyBrief() {
    return db.getDailyBriefStats();
  }

  // ── Pipeline wiring (event-driven) ─────────────────────────────────────

  private wirePipeline(): void {
    // Stage 1 → Run threat detection + classification (AI pipeline)
    intelligenceBus.on('event:raw', async (event) => {
      try {
        const aiResults = await localAIPipeline.process(event);
        await db.updateAIResults(event.id, aiResults);

        // Merge results back onto the event object in memory
        const updated = { ...event, aiResults, isProcessed: true };
        await intelligenceBus.emit('event:threat_analysed', updated);
      } catch (err) {
        await intelligenceBus.emit('event:pipeline_error', {
          event,
          step: 'threat_analysis',
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    });

    // Stage 2 → Emit classification complete
    intelligenceBus.on('event:threat_analysed', async (event) => {
      await intelligenceBus.emit('event:classified', event);
    });

    // Stage 3 → Communication graph: resolve entities + update relationships
    intelligenceBus.on('event:classified', async (event) => {
      try {
        await communicationGraph.processEvent(event);
        await intelligenceBus.emit('event:relationship_scored', event);
      } catch (err) {
        await intelligenceBus.emit('event:pipeline_error', {
          event,
          step: 'relationship_scoring',
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    });

    // Stage 4 → Prioritised (attention score already inside aiResults)
    intelligenceBus.on('event:relationship_scored', async (event) => {
      await intelligenceBus.emit('event:prioritised', event);
    });

    // Stage 5 → Actions already generated inside AI pipeline; emit next
    intelligenceBus.on('event:prioritised', async (event) => {
      await intelligenceBus.emit('event:actions_generated', event);
    });

    // Stage 6 → Timeline update
    intelligenceBus.on('event:actions_generated', async (event) => {
      await intelligenceBus.emit('event:timeline_updated', event);
    });

    // Stage 7 → Notification decision
    intelligenceBus.on('event:timeline_updated', async (event) => {
      const shouldNotify =
        (event.aiResults?.attention.overall ?? 0) >= 60 ||
        event.aiResults?.threat.detected;

      if (shouldNotify) {
        // Future: dispatch a native push notification here
        console.info(
          `[IntelligenceEngine] Notify → "${event.subject ?? event.content.slice(0, 40)}" (priority ${event.aiResults?.attention.overall ?? '?'})`
        );
      }

      await intelligenceBus.emit('event:notification_decided', event);

      // Refresh the daily brief after every fully-processed event
      await intelligenceBus.emit('brief:updated', undefined as void);
    });

    // Pipeline errors – log and surface to dev tools
    intelligenceBus.on('event:pipeline_error', ({ event, step, error }) => {
      console.error(`[IntelligenceEngine] Pipeline error at step "${step}" for event ${event.id}:`, error);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton export
// ─────────────────────────────────────────────────────────────────────────────

export const intelligenceEngine = new IntelligenceEngine();
