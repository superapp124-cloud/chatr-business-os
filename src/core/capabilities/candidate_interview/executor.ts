import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(`[core.interview] Executing commitment ${commitment.id}`);
  
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No calendar provider available');
  
  const calendar = providers[0];
  if (!calendar.create) throw new Error('Calendar provider does not support create');
  
  const result = await calendar.create({
    id: commitment.id,
    type: 'interview',
    title: `Interview with ${commitment.entities?.candidate}`,
    timeSlot: commitment.entities?.time
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const calendar = providers[0];
  if (!calendar.verify) return { verified: false, provider: calendar.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await calendar.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: calendar.name,
    timestamp: new Date().toISOString(),
    transactionId: `INT-${commitment.id}`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('calendar', 'ExecutionProvider');
  if (providers.length > 0) {
    const calendar = providers[0] as any;
    if (calendar.delete) calendar.delete(commitmentId);
  }
}
