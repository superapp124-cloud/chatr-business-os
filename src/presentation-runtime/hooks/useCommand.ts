import { useCallback } from 'react';
import { useObjectRuntime, useQueryEngine } from '../providers/KernelProvider';
import { useSyncStatus } from './useSyncStatus';
import { useEventBus } from './useEventBus';
import { useTelemetrySink } from './useTelemetrySink';
import { CommandResult, ErrorCode } from '../contracts/UIContracts';

/**
 * Standard UI Resilience Contract Hook
 * Wraps object mutations, maps exceptions to deterministic results, handles optimistic state conflicts, and emits telemetry/events.
 */
export const useCommand = () => {
  const runtime = useObjectRuntime();
  const queryEngine = useQueryEngine();
  const syncStatus = useSyncStatus();
  const eventBus = useEventBus();
  const telemetry = useTelemetrySink();

  const execute = useCallback(async (
    command: { aggregateType: string; aggregateId: string; action: string; payload: any; expectedVersion?: number; correlationId?: string },
    actorId: string,
    tenantId: string
  ): Promise<CommandResult> => {
    const correlationId = command.correlationId || Math.random().toString(36).substring(2);
    const startTime = Date.now();

    telemetry.emit({
      type: 'CommandStarted',
      name: `${command.aggregateType}.${command.action}`,
      correlationId,
      timestamp: new Date()
    });

    try {
      // Emit CommandStarted so SyncEngine can pick it up and queue it
      eventBus.publish({ 
        type: 'CommandStarted', 
        correlationId, 
        command: { ...command, correlationId },
        actorId,
        tenantId 
      });

      // Optimistic Local Evaluation
      const event = await runtime.executeCommand({ ...command, correlationId }, actorId, tenantId);
      const durationMs = Date.now() - startTime;
      
      const successEvent = {
        type: 'CommandCompleted' as const,
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        durationMs,
        correlationId
      };
      eventBus.publish(successEvent);
      telemetry.emit({ ...successEvent, name: `${command.aggregateType}.${command.action}`, timestamp: new Date() });

      return {
        status: 'success',
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        projectionVersion: event.globalSequence
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      let result: CommandResult;

      if (err.name === 'ConcurrencyError') {
        const latestState = await queryEngine.get({ aggregateType: command.aggregateType, aggregateId: command.aggregateId, actorId });
        result = {
          status: 'concurrency_error',
          code: 'CONCURRENCY',
          message: err.message,
          latestState,
          retryable: true
        };
      } else if (err.message?.includes('Policy violation') || err.message?.includes('Invalid transition') || err.message?.includes('already exists') || err.message?.includes('does not exist')) {
        result = {
          status: 'validation_error',
          code: 'VALIDATION',
          message: err.message,
          retryable: false
        };
      } else {
        result = {
          status: 'infrastructure_error',
          code: 'EVENTSTORE', // or UNKNOWN based on error, assuming EVENTSTORE for now
          message: err.message,
          retryable: true,
          correlationId
        };
      }

      const errorEvent = {
        type: 'CommandFailed' as const,
        code: (result as any).code || 'UNKNOWN',
        message: result.message,
        durationMs,
        correlationId
      };
      eventBus.publish(errorEvent);
      telemetry.emit({ ...errorEvent, name: `${command.aggregateType}.${command.action}`, timestamp: new Date() });

      return result;
    }
  }, [runtime, queryEngine, syncStatus, eventBus, telemetry]);

  return execute;
};
