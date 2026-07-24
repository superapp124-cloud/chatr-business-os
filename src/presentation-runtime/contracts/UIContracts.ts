export type SyncState = 'idle' | 'syncing' | 'recovering' | 'offline' | 'replaying';

export interface SyncStatus {
    state: SyncState;
    progress?: number;
    lastSequence?: number;
    targetSequence?: number;
    message?: string;
}

export type ErrorCode = 
  | 'CONCURRENCY' 
  | 'VALIDATION' 
  | 'NETWORK' 
  | 'EVENTSTORE' 
  | 'PACK_NOT_FOUND' 
  | 'PACK_DISABLED' 
  | 'PERMISSION_DENIED'
  | 'UNKNOWN';

export type CommandResult<T = any> = 
  | {
      status: 'success';
      eventId: string;
      aggregateId: string;
      projectionVersion?: number;
    }
  | {
      status: 'concurrency_error';
      code: 'CONCURRENCY';
      message: string;
      latestState: T;
      projectionVersion?: number;
      retryable: true;
    }
  | {
      status: 'validation_error';
      code: 'VALIDATION';
      message: string;
      fieldErrors?: Record<string, string>;
      retryable: false;
    }
  | {
      status: 'infrastructure_error';
      code: ErrorCode;
      message: string;
      retryable: boolean;
      correlationId?: string;
    };
