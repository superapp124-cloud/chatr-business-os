/**
 * CHATR Intelligence Engine – Gmail Plugin
 *
 * Wraps the existing GoogleAdapter and translates Gmail API payloads
 * into canonical CommunicationEvents for the Intelligence pipeline.
 *
 * Decision 6: Plugin architecture – this plugin emits standardised events.
 * OAuth remains strictly gmail.readonly (no contacts scopes).
 */

import { GoogleAdapter } from '../../mail/GoogleAdapter';
import type {
  ICommunicationProvider,
  PluginCapabilities,
  PluginStatus,
} from '../intelligence/providers';
import type { CommunicationEvent, CommunicationParty } from '../intelligence/schema';

function parseFrom(raw: string): CommunicationParty {
  // Parse "Display Name <email@example.com>" or "email@example.com"
  const match = raw.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    return {
      raw,
      canonical: match[2].toLowerCase().trim(),
      displayName: match[1].trim(),
      verified: false,
    };
  }
  return {
    raw,
    canonical: raw.toLowerCase().trim(),
    verified: false,
  };
}

export class GmailPlugin implements ICommunicationProvider {
  readonly source = 'mail' as const;
  readonly displayName = 'Gmail';
  readonly capabilities: PluginCapabilities = {
    canSend: false,
    canReceive: true,
    canSearch: false,
    canSync: true,
    supportsAttachments: false,  // Phase 1: metadata only
    supportsThreads: true,
    requiresOAuth: true,
  };

  private adapter = new GoogleAdapter();
  private accessToken: string | null = null;
  private accountId: string = '';
  private connected = false;
  private handlers: ((event: CommunicationEvent) => void)[] = [];

  async connect(options?: Record<string, unknown>): Promise<PluginStatus> {
    this.accessToken = (options?.accessToken as string) ?? null;
    this.accountId = (options?.accountId as string) ?? 'gmail';
    this.connected = !!this.accessToken;
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.connected = false;
    this.handlers = [];
  }

  async sync(since?: string): Promise<CommunicationEvent[]> {
    if (!this.connected || !this.accessToken) return [];

    const events: CommunicationEvent[] = [];

    try {
      const { messages } = await this.adapter.fetchPage(
        this.accountId,
        this.accessToken
      );

      for (const raw of messages) {
        const parsed = this.adapter.parseMessage(raw);
        const event = this.toEvent(parsed);
        events.push(event);

        // Notify real-time listeners
        this.handlers.forEach((h) => h(event));
      }
    } catch (err) {
      console.error('[GmailPlugin] Sync failed:', err);
    }

    return events;
  }

  getStatus(): PluginStatus {
    return {
      connected: this.connected,
      accountId: this.accountId,
      displayName: 'Gmail',
      lastSyncAt: new Date().toISOString(),
    };
  }

  onEvent(handler: (event: CommunicationEvent) => void): void {
    this.handlers.push(handler);
  }

  offEvent(handler: (event: CommunicationEvent) => void): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  // ── Translation ──────────────────────────────────────────────────────────

  private toEvent(parsed: {
    id: string;
    threadId: string;
    sender: string;
    subject: string;
    snippet: string;
    internalDate: string;
  }): CommunicationEvent {
    const now = new Date().toISOString();
    return {
      id: `gmail_${parsed.id}`,
      source: 'mail',
      externalId: parsed.id,
      direction: 'inbound',
      status: 'received',
      sender: parseFrom(parsed.sender),
      recipients: [],
      timestamp: new Date(parseInt(parsed.internalDate, 10)).toISOString(),
      ingestedAt: now,
      subject: parsed.subject,
      content: parsed.snippet,
      attachments: [],
      threadId: parsed.threadId,
      linkedEntityIds: [],
      relatedEventIds: [],
      metadata: { externalId: parsed.id },
      isIndexed: false,
      isProcessed: false,
    };
  }
}

export const gmailPlugin = new GmailPlugin();
