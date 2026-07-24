/**
 * CHATR Intelligence Engine – SMS Plugin
 *
 * Reads native SMS messages via the Capacitor native bridge and
 * translates them into canonical CommunicationEvents.
 *
 * Decision 6: Plugin architecture – standardised events only.
 *
 * Native SMS data comes from the Android `NativeSmsReceiver` which
 * broadcasts to the WebView via Capacitor's event channel.
 * We also support a pull-sync path using the SMS content provider
 * through a future CapacitorSMS plugin.
 */

import type {
  ICommunicationProvider,
  PluginCapabilities,
  PluginStatus,
} from '../providers';
import type { CommunicationEvent, CommunicationParty } from '../schema';

/** Shape of an SMS record from the native bridge / content provider */
interface NativeSMSRecord {
  id: string;
  address: string;         // sender phone number
  body: string;
  date: number;            // Unix ms
  type: 1 | 2;             // 1 = inbox, 2 = sent
  read: 0 | 1;
  thread_id: string;
  person?: string;         // contact display name if resolved by Android
}

function smsToEvent(sms: NativeSMSRecord): CommunicationEvent {
  const now = new Date().toISOString();
  const direction = sms.type === 1 ? 'inbound' : 'outbound';

  const sender: CommunicationParty = {
    raw: sms.address,
    canonical: sms.address.replace(/\D/g, '').replace(/^91/, ''),
    displayName: sms.person,
    verified: false,
  };

  return {
    id: `sms_${sms.id}`,
    source: 'sms',
    externalId: sms.id,
    direction,
    status: sms.read === 1 ? 'read' : 'received',
    sender: direction === 'inbound' ? sender : { raw: 'me', canonical: 'me', verified: true },
    recipients: direction === 'outbound' ? [sender] : [],
    timestamp: new Date(sms.date).toISOString(),
    ingestedAt: now,
    subject: undefined,
    content: sms.body,
    attachments: [],
    threadId: sms.thread_id,
    linkedEntityIds: [],
    relatedEventIds: [],
    metadata: { nativeId: sms.id, type: sms.type },
    isIndexed: false,
    isProcessed: false,
  };
}

export class SmsPlugin implements ICommunicationProvider {
  readonly source = 'sms' as const;
  readonly displayName = 'SMS';
  readonly capabilities: PluginCapabilities = {
    canSend: true,
    canReceive: true,
    canSearch: false,
    canSync: true,
    supportsAttachments: false,
    supportsThreads: true,
    requiresOAuth: false,
  };

  private connected = false;
  private handlers: ((event: CommunicationEvent) => void)[] = [];
  private nativeListener: ((data: any) => void) | null = null;

  async connect(): Promise<PluginStatus> {
    this.connected = true;

    // Listen for real-time SMS events pushed from native layer
    // (Android NativeSmsReceiver → Capacitor bridge → here)
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      const { Capacitor } = await import('@capacitor/core');
      this.nativeListener = (data: any) => {
        if (data?.sms) {
          const event = smsToEvent(data.sms as NativeSMSRecord);
          this.handlers.forEach((h) => h(event));
        }
      };
      // Future: Capacitor.addListener('chatr:sms_received', this.nativeListener);
    }

    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.handlers = [];
    this.nativeListener = null;
  }

  /**
   * Pull recent SMS messages from the native content provider.
   * On web/dev, returns an empty array — the native bridge handles
   * real delivery. A CapacitorSMS plugin call will be wired here in
   * Phase 2 when the plugin is installed.
   */
  async sync(_since?: string): Promise<CommunicationEvent[]> {
    if (!this.connected) return [];

    // Phase 2 TODO: call CapacitorSMS.getMessages({ limit: 100, since })
    // and map the results through smsToEvent().
    //
    // For now, return any events already waiting in the native queue
    // (real-time path via onEvent listener handles the rest).
    return [];
  }

  getStatus(): PluginStatus {
    return {
      connected: this.connected,
      displayName: 'SMS',
    };
  }

  onEvent(handler: (event: CommunicationEvent) => void): void {
    this.handlers.push(handler);
  }

  offEvent(handler: (event: CommunicationEvent) => void): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  /**
   * Called by the Android native bridge when a new SMS arrives.
   * Invoked directly from the Capacitor plugin bridge event.
   */
  handleNativeSMS(record: NativeSMSRecord): void {
    const event = smsToEvent(record);
    this.handlers.forEach((h) => h(event));
  }
}

export const smsPlugin = new SmsPlugin();
