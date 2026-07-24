export enum CommunicationEvent {
  CALL_STARTED = 'CALL_STARTED',
  CALL_RINGING = 'CALL_RINGING',
  CALL_CONNECTED = 'CALL_CONNECTED',
  CALL_FAILED = 'CALL_FAILED',
  CALL_ENDED = 'CALL_ENDED',
  NETWORK_CHANGED = 'NETWORK_CHANGED',
  AUDIO_DEVICE_CHANGED = 'AUDIO_DEVICE_CHANGED',
  VIDEO_DEVICE_CHANGED = 'VIDEO_DEVICE_CHANGED',
  REMOTE_STREAM_READY = 'REMOTE_STREAM_READY',
  LOCAL_STREAM_READY = 'LOCAL_STREAM_READY',
  // Group call room events
  ROOM_PARTICIPANT_JOINED = 'ROOM_PARTICIPANT_JOINED',  // payload: { userId: string, stream: MediaStream }
  ROOM_PARTICIPANT_LEFT = 'ROOM_PARTICIPANT_LEFT',      // payload: { userId: string }
}

type EventCallback = (payload: any) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<CommunicationEvent, Set<EventCallback>> = new Map();

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe(event: CommunicationEvent, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  public emit(event: CommunicationEvent, payload?: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(payload);
        } catch (e) {
          console.error(`Error in EventBus listener for ${event}:`, e);
        }
      });
    }
  }
}
