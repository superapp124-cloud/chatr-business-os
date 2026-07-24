import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(`[core.expense] Executing commitment ${commitment.id}`);
  
  const providers = await providerRegistry.getHealthyProviders('storage', 'ExecutionProvider');
  if (providers.length === 0) throw new Error('No storage provider available');
  
  const storage = providers[0];
  if (!storage.create) throw new Error('Storage provider does not support create');
  
  const result = await storage.create({
    id: commitment.id,
    type: 'expense',
    description: commitment.entities?.description,
    amount: commitment.entities?.amount
  });

  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('storage', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const storage = providers[0];
  if (!storage.verify) return { verified: false, provider: storage.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await storage.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: storage.name,
    timestamp: new Date().toISOString(),
    transactionId: `EXP-${commitment.id}`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('storage', 'ExecutionProvider');
  if (providers.length > 0) {
    const storage = providers[0] as any;
    if (storage.delete) storage.delete(commitmentId);
  }
}
