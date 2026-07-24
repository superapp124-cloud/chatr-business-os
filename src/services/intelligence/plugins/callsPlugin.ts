/**
 * CHATR Intelligence Engine – Calls Plugin
 *
 * Reads native call log records via the Capacitor bridge and
 * translates them into canonical CommunicationEvents.
 *
 * Call types: inbound (answered), missed, outbound, voicemail.
 */

import type {
  ICommunicationProvider,
  PluginCapabilities,
  PluginStatus,
} from '../providers';
import type { CommunicationEvent, CommunicationDirection, CommunicationParty } from '../schema';

/** Shape of a call log record from Android content provider */
interface NativeCallRecord {
  id: string;
  number: string;
  name?: string;
  type: 1 | 2 | 3 | 4 | 5;  // 1=incoming, 2=outgoing, 3=missed, 4=voicemail, 5=rejected
  date: number;               // Unix ms
  duration: number;           // seconds
  new: 0 | 1;                 // 1 = not yet seen
}

function callTypeToDirection(type: NativeCallRecord['type']): CommunicationDirection {
  if (type === 2) return 'outbound';
  if (type === 3) return 'missed';
  return 'inbound';
}

function callToEvent(call: NativeCallRecord): CommunicationEvent {
  const now = new Date().toISOString();
  const direction = callTypeToDirection(call.type);
  const source = call.type === 4 ? 'voicemail' : 'call';

  const remoteParty: CommunicationParty = {
    raw: call.number,
    canonical: call.number.replace(/\D/g, '').replace(/^91/, ''),
    displayName: call.name,
    verified: false,
  };

  return {
    id: `call_${call.id}`,
    source,
    externalId: call.id,
    direction,
    status: call.new === 0 ? 'read' : 'received',
    sender: direction !== 'outbound' ? remoteParty : { raw: 'me', canonical: 'me', verified: true },
    recipients: direction === 'outbound' ? [remoteParty] : [],
    timestamp: new Date(call.date).toISOString(),
    ingestedAt: now,
    durationSeconds: call.duration,
    subject: direction === 'missed'
      ? `Missed call from ${call.name ?? call.number}`
      : `${direction === 'outbound' ? 'Outgoing' : 'Incoming'} call${call.duration > 0 ? ` (${Math.ceil(call.duration / 60)}m)` : ''}`,
    content: direction === 'missed'
      ? `You missed a call from ${call.name ?? call.number}`
      : `${direction === 'outbound' ? 'Called' : 'Call from'} ${call.name ?? call.number}`,
    attachments: [],
    linkedEntityIds: [],
    relatedEventIds: [],
    metadata: { nativeId: call.id, callType: call.type, durationSeconds: call.duration },
    isIndexed: false,
    isProcessed: false,
  };
}

export class CallsPlugin implements ICommunicationProvider {
  readonly source = 'call' as const;
  readonly displayName = 'Calls';
  readonly capabilities: PluginCapabilities = {
    canSend: true,
    canReceive: true,
    canSearch: false,
    canSync: true,
    supportsAttachments: false,
    supportsThreads: false,
    requiresOAuth: false,
  };

  private connected = false;
  private handlers: ((event: CommunicationEvent) => void)[] = [];

  async connect(): Promise<PluginStatus> {
    this.connected = true;
    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.handlers = [];
  }

  /**
   * Pull call log from native content provider.
   * Phase 2 TODO: call a CapacitorCallLog plugin and map records through callToEvent().
   */
  async sync(_since?: string): Promise<CommunicationEvent[]> {
    return [];
  }

  getStatus(): PluginStatus {
    return { connected: this.connected, displayName: 'Calls' };
  }

  onEvent(handler: (event: CommunicationEvent) => void): void {
    this.handlers.push(handler);
  }

  offEvent(handler: (event: CommunicationEvent) => void): void {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  /** Called by the native CallStateReceiver when a call ends */
  handleNativeCall(record: NativeCallRecord): void {
    const event = callToEvent(record);
    this.handlers.forEach((h) => h(event));
  }
}

export const callsPlugin = new CallsPlugin();
