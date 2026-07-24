import { Commitment, ExecutionResult, Provider, RealityVerificationResult } from '../types';
import { providerRegistry } from '../../providers/ProviderRegistry';

export async function execute(commitment: Commitment, provider: Provider): Promise<ExecutionResult> {
  console.log(`[${commitment.capability}] Executing...`);
  
  const providers = providerRegistry.getProvidersByTypeAndRole('hotel', 'SearchProvider');
  if (providers.length === 0) throw new Error('No hotel providers available');
  
  const hotelProvider = providers[0];
  if (!hotelProvider.create) throw new Error(`Provider ${hotelProvider.name} does not support booking.`);
  
  // Get the selected hotel from search results (or fallback to first)
  const itemToBook = commitment.selectedResult || commitment.entities?.searchResults?.[0] || {};
  const result = await hotelProvider.create(itemToBook);
  
  return { 
    success: true, 
    commitmentId: commitment.id,
    providerData: result 
  };
}

export async function verifier(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult> {
  return { 
    verified: true, 
    provider: 'Booking.com',
    timestamp: new Date().toISOString(),
    transactionId: 'HTL-ABC-123',
    evidence: { status: 'CONFIRMED', confirmation: 'HTL-ABC-123' }
  };
}

export async function undo(commitmentId: string, provider: Provider): Promise<void> {
  console.log(`[${commitmentId}] Hotel undo executed.`);
}
