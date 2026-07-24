import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(`[core.email] Executing commitment ${commitment.id}`);
  
  const providers = await providerRegistry.getHealthyProviders('execution', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No execution provider available in the OS registry');
  
  const executionBus = providers[0];
  if (!executionBus.create) throw new Error('Execution provider does not support enqueueing');
  
  const result = await executionBus.create({
    id: commitment.id,
    type: 'email', // Maps directly to execution_queue.capability
    recipient: commitment.entities?.contact,
    message: commitment.entities?.content,
    priority: 5 // Default priority for user-initiated emails
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('execution', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const executionBus = providers[0];
  if (!executionBus.verify) return { verified: false, provider: executionBus.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await executionBus.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: executionBus.name,
    timestamp: new Date().toISOString(),
    transactionId: `EXECUTION-${commitment.id}`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
}
