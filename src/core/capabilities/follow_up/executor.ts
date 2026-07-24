import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(`[core.follow_up] Executing commitment ${commitment.id}`);
  
  if (commitment.schedule && commitment.schedule.resolved) {
    const scheduledTime = new Date(commitment.schedule.resolved);
    
    // Get the universal system execution provider (SchedulerProvider)
    const providers = await providerRegistry.getHealthyProviders('storage', 'ExecutionProvider');
    if (providers.length === 0) throw new Error('No scheduler provider available');
    
    const scheduler = providers[0];
    if (!scheduler.create) throw new Error('Scheduler does not support create');
    
    const result = await scheduler.create({
      id: commitment.id,
      time: scheduledTime,
      title: `Follow up: ${commitment.title}`,
      capability: 'core.follow_up'
    });

    return { 
      success: true, 
      commitmentId: commitment.id,
      providerData: result 
    };
  }
  
  return { success: false, commitmentId: commitment.id, message: 'No valid time to schedule follow-up' };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  const providers = await providerRegistry.getHealthyProviders('storage', 'ExecutionProvider');
  if (providers.length === 0) return { verified: false, provider: 'Unknown', timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const scheduler = providers[0];
  if (!scheduler.verify) return { verified: false, provider: scheduler.name, timestamp: new Date().toISOString(), transactionId: '', evidence: {} };
  
  const result = await scheduler.verify(commitment.id);
  
  return {
    verified: result.verified,
    provider: scheduler.name,
    timestamp: new Date().toISOString(),
    transactionId: `FOLLOWUP-${commitment.id}`,
    evidence: result
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  const providers = await providerRegistry.getHealthyProviders('storage', 'ExecutionProvider');
  if (providers.length > 0) {
    const scheduler = providers[0] as any;
    if (scheduler.cancel) {
      scheduler.cancel(commitmentId);
    }
  }
}
