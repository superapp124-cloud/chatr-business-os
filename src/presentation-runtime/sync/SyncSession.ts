export interface SyncWatermark {
  clientSequence: number;
  serverSequence: number;
}

export interface SyncSession {
  /**
   * The current state of the connection to the remote server.
   */
  connectionState: 'online' | 'offline' | 'connecting' | 'reconnecting';

  /**
   * Explicitly models the difference between local and remote state.
   */
  watermark: SyncWatermark;

  /**
   * Number of commands currently queued waiting to be sent to the server.
   */
  queuedCommands: number;

  /**
   * Number of commands currently in-flight to the server.
   */
  pendingCommands: number;

  /**
   * Number of commands that have failed and are waiting for retry.
   */
  failedCommands: number;

  /**
   * Current retry backoff time in milliseconds.
   */
  retryBackoff: number;
}

export const INITIAL_SYNC_SESSION: SyncSession = {
  connectionState: 'offline',
  watermark: { clientSequence: 0, serverSequence: 0 },
  queuedCommands: 0,
  pendingCommands: 0,
  failedCommands: 0,
  retryBackoff: 0,
};

export function calculateSyncLag(session: SyncSession): number {
  return session.watermark.serverSequence - session.watermark.clientSequence;
}
