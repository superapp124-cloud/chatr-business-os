/**
 * CHATR Kernel Runtime v2.0 — CallEngine
 * 
 * Manages the live, stateful call session, transcript streaming, and media metadata.
 * Implements a formal session state machine.
 */

import { IEngine, EngineHealth, EngineStatus } from '../runtime/types';
import { KernelAPI } from '../runtime/KernelAPI';

export type CallSessionState = 'Idle' | 'Connecting' | 'Ringing' | 'Connected' | 'Reconnecting' | 'Ending' | 'Ended' | 'Archived';

export interface CallSession {
  sessionId: string;
  state: CallSessionState;
  participants: string[];
  recording: boolean;
  startTime?: number;
  endTime?: number;
  transcriptId?: string;
}

export class CallEngineImpl implements IEngine {
  readonly id = 'CallEngine';
  readonly version = '2.0.0';
  readonly kernelCompatibility = '>=2.0.0';
  readonly dependsOn = ['TimelineEngine', 'MemoryEngine', 'RelationshipEngine'];

  private _status: EngineStatus = 'stopped';
  private kernel!: KernelAPI;
  
  // Currently active session (simplified to 1 active session for now)
  private activeSession: CallSession | null = null;
  private streamingBuffer: string[] = [];

  status(): EngineStatus { return this._status; }
  ready(): boolean { return this._status === 'ready'; }
  metrics(): Record<string, number> { 
    return {
      activeSessions: this.activeSession ? 1 : 0,
      bufferSize: this.streamingBuffer.length
    }; 
  }

  async health(): Promise<EngineHealth> {
    return { status: this._status, lastChecked: Date.now() };
  }

  async init(api: KernelAPI): Promise<void> {
    this._status = 'booting';
    this.kernel = api;

    // Register Call commands
    this.kernel.commands.register('INITIATE_CALL', async (cmd) => {
      return this.handleInitiateCall(cmd.payload as { contactId: string });
    });

    this.kernel.commands.register('END_CALL', async () => {
      return this.handleEndCall();
    });

    this.kernel.commands.register('STREAM_TRANSCRIPT_CHUNK', async (cmd) => {
      return this.handleTranscriptChunk(cmd.payload as { text: string; speaker: string });
    });

    this._status = 'ready';
  }

  private transitionState(newState: CallSessionState) {
    if (!this.activeSession) return;
    const oldState = this.activeSession.state;
    this.activeSession.state = newState;

    this.kernel.events.publish('CALL_STATE_CHANGED', {
      sessionId: this.activeSession.sessionId,
      oldState,
      newState
    });

    if (newState === 'Ended') {
      // Trigger Relationship Batch Update on call end
      this.kernel.commands.dispatch({
        id: crypto.randomUUID(),
        type: 'BATCH_UPDATE_RELATIONSHIP',
        payload: { sessionId: this.activeSession.sessionId },
        requestedBy: this.id,
        timestamp: Date.now()
      });
      this.transitionState('Archived');
    }
  }

  private async handleInitiateCall(payload: { contactId: string }) {
    if (this.activeSession && this.activeSession.state !== 'Archived') {
      throw new Error("A call is already active");
    }

    this.activeSession = {
      sessionId: crypto.randomUUID(),
      state: 'Idle',
      participants: [payload.contactId],
      recording: false
    };

    this.transitionState('Connecting');
    // Simulate immediate ringing/connection for now
    setTimeout(() => this.transitionState('Ringing'), 500);
    setTimeout(() => this.transitionState('Connected'), 1500);

    return { sessionId: this.activeSession.sessionId };
  }

  private async handleEndCall() {
    if (!this.activeSession) throw new Error("No active call");
    this.transitionState('Ending');
    this.activeSession.endTime = Date.now();
    this.transitionState('Ended');
    
    const session = { ...this.activeSession };
    this.activeSession = null;
    return session;
  }

  private async handleTranscriptChunk(payload: { text: string; speaker: string }) {
    if (!this.activeSession || this.activeSession.state !== 'Connected') {
      throw new Error("Cannot stream transcript: Call not connected");
    }

    this.streamingBuffer.push(payload.text);

    // Fire continuous events for downstream engines
    this.kernel.events.publish('TRANSCRIPT_CHUNK_RECEIVED', {
      sessionId: this.activeSession.sessionId,
      text: payload.text,
      speaker: payload.speaker
    }, { priority: 'high' });

    return { buffered: this.streamingBuffer.length };
  }

  async restart(): Promise<void> {
    this._status = 'recovering';
    // In a real recovery, we would hydrate state from indexedDB or Kernel Event replay
    this._status = 'ready';
  }

  async dispose(): Promise<void> {
    if (this.activeSession) {
      await this.handleEndCall();
    }
    this._status = 'stopped';
  }
}

export const callEngine = new CallEngineImpl();
