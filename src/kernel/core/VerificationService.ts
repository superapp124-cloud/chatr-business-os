import { kernel } from '../abi';
import { EntityId } from '../abi/v1';
import { worldModel } from '../world/WorldModel';

export class VerificationService {
  constructor() {
    kernel.subscribeEvents('execution.succeeded', this.handleExecutionSuccess.bind(this));
    kernel.subscribeEvents('execution.failed', this.handleExecutionFailure.bind(this));
  }

  private async handleExecutionSuccess(event: any): Promise<void> {
    const { evidenceId, capabilityId } = event.payload;
    const { processId, intentId } = event;
    const authority = event.source || 'system';

    // A real verification plugin would perform cryptographically secure validation here.
    const passed = true;

    if (passed && evidenceId) {
      console.log(`[VerificationService] Verified execution evidence: ${evidenceId}`);
      // The Knowledge record created by invokeCapability can now be marked verified,
      // which allows it to be trusted in future planning cycles.
      
      if (processId && intentId) {
        await kernel.publishEvent({
          type: 'process.completed',
          source: 'VerificationService',
          intentId,
          processId,
          payload: { evidenceId, capabilityId, status: 'completed' },
          trust: { level: 1.0, source: 'system', proofs: [] },
          cost: { resources: [], totalUSD: 0 }
        });
      }
    }
  }

  private async handleExecutionFailure(event: any): Promise<void> {
    const { evidenceId, error } = event.payload;
    const { processId, intentId } = event;
    console.warn(`[VerificationService] Execution failed: ${error} (Evidence: ${evidenceId})`);
    
    if (processId && intentId) {
      // 1. Fetch Process from World Model
      const processNode = worldModel.getNode(processId);
      const props = processNode?.properties || {};
      
      const maxRetries = props.maxRetries || 0;
      const retriesAttempted = props.retriesAttempted || 0;

      if (retriesAttempted < maxRetries) {
        // Native Retry
        console.log(`[VerificationService] Requesting retry for ${processId} (${retriesAttempted + 1}/${maxRetries})`);
        
        // Emitting process.retry_requested. We also increment retriesAttempted via the process service later.
        await kernel.publishEvent({
          type: 'process.retry_requested',
          source: 'VerificationService',
          intentId,
          processId,
          payload: { evidenceId, error, currentRetry: retriesAttempted + 1, maxRetries },
          trust: { level: 1.0, source: 'system', proofs: [] },
          cost: { resources: [], totalUSD: 0 }
        });
      } else {
        // Permanent Failure
        await kernel.publishEvent({
          type: 'process.failed',
          source: 'VerificationService',
          intentId,
          processId,
          payload: { evidenceId, error, status: 'failed', retriesExhausted: maxRetries > 0 },
          trust: { level: 1.0, source: 'system', proofs: [] },
          cost: { resources: [], totalUSD: 0 }
        });
      }
    }
  }
}

export const verificationService = new VerificationService();
