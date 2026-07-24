import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(`[core.call] Executing commitment ${commitment.id}`);
  
  const providers = await providerRegistry.getHealthyProviders('communication', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No communication provider available');
  
  const comms = providers[0];
  if (!comms.create) throw new Error('Communication provider does not support create');
  
  const result = await comms.create({
    id: commitment.id,
    type: 'call',
    recipient: commitment.entities?.contact,
    message: ''
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('communication', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const comms = providers[0];
  if (!comms.verify) return { verified: false, provider: comms.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await comms.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: comms.name,
    timestamp: new Date().toISOString(),
    transactionId: `CALL-${commitment.id}`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  // Calls generally can't be undone once dispatched
}
