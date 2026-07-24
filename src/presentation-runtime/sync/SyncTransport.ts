import { Command } from '../../kernel/runtime/ObjectRuntime';
import { KernelEvent } from '../../kernel/storage/EventStore';

export interface CommandEnvelope {
  protocolVersion: number;
  commandId: string;
  correlationId: string;
  clientId: string;
  sessionId: string;
  payload: Command;
}

export interface SyncPullPayload {
  protocolVersion: number;
  sequence: number;
  clientId: string;
  sessionId: string;
}

export interface SyncTransport {
  /**
   * Sends a command to the remote server.
   */
  sendCommand(envelope: CommandEnvelope): Promise<KernelEvent[]>;

  /**
   * Pulls events from the remote server since a specific sequence number.
   */
  pullEventsSince(payload: SyncPullPayload): Promise<KernelEvent[]>;

  /**
   * Uploads telemetry events to the server.
   */
  uploadTelemetry(events: any[]): Promise<void>;
}
