import { ProviderResolver } from './ProviderResolver';
import { ICapability, CapabilityExecutionRequest } from '../capabilities/types';
import { IProviderAdapter, ExecutionReceipt, IntentContext } from './types';

export class ExecutionRuntime {
  constructor(private resolver: ProviderResolver) {}

  /**
   * Executes a capability request with Self-Healing:
   * Retry -> Fallback -> Compensation -> Human Approval
   */
  public async execute(
    capability: ICapability, 
    request: CapabilityExecutionRequest, 
    context: IntentContext
  ): Promise<ExecutionReceipt> {
    
    let currentAdapter: IProviderAdapter | null = await this.resolver.resolve(capability, context);
    
    if (!currentAdapter) {
      throw new Error(`ExecutionRuntime: No healthy providers found for capability ${capability.id}`);
    }

    const maxRetries = 2;
    let attempts = 0;
    let lastError: any = null;

    // Self-Healing Loop
    while (attempts <= maxRetries) {
      try {
        attempts++;
        
        // 1. Execute via Adapter
        const receipt: ExecutionReceipt = await currentAdapter.execute(context, request.inputs);
        
        // Emitting Observability (Would be hooked into a real event bus)
        console.log(`[Observability] CapabilityStarted: ${capability.id} via ${currentAdapter.id}`);
        
        // 2. Verification Layer (Reality Verification)
        const verificationResult = await currentAdapter.verify(receipt.correlationId);
        
        if (verificationResult && receipt.status === 'Completed') {
          console.log(`[Observability] Completed & Verified: ${capability.id}`);
          receipt.retryCount = attempts - 1;
          return receipt;
        } else {
           throw new Error("Verification failed post-execution.");
        }

      } catch (error) {
        lastError = error;
        console.warn(`[Observability] ProviderFailed: ${currentAdapter.id}. Attempt ${attempts}/${maxRetries}`);
        
        if (attempts > maxRetries) {
           break; // Exhausted retries for this provider
        }
        // Small backoff could be added here
      }
    }

    // Fallback: If primary failed after retries, try to resolve a fallback provider
    console.log(`[Observability] Self-Healing: Triggering Fallback for ${capability.id}`);
    const fallbackAdapter = await this.resolver.resolve(capability, context);
    
    if (fallbackAdapter && fallbackAdapter.id !== currentAdapter.id) {
       console.log(`[Observability] ProviderChanged: Switching to ${fallbackAdapter.id}`);
       try {
         const fallbackReceipt = await fallbackAdapter.execute(context, request.inputs);
         fallbackReceipt.warnings.push(`Primary provider ${currentAdapter.id} failed. Executed via fallback.`);
         return fallbackReceipt;
       } catch (fallbackError) {
         lastError = fallbackError;
       }
    }

    // Compensation & Human Approval Logic
    console.error(`[Observability] Self-Healing Exhausted. Escaping to Human Approval for ${capability.id}`);
    
    return {
      intentId: context.correlationId,
      capabilityId: capability.id,
      providerId: currentAdapter.id,
      status: 'Failed',
      durationMs: 0,
      evidence: [],
      warnings: [`Self-healing exhausted. Error: ${lastError?.message}`],
      policyApplied: context.policyLevel,
      confidence: 0,
      retryCount: attempts,
      correlationId: context.correlationId,
      auditTrail: [`Execution failed after ${attempts} attempts. Requires Human Approval.`]
    };
  }
}
