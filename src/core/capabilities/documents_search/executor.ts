import { Capability, ExecutionResult, Provider } from '../types';

export const validate = (input: any): { valid: boolean; errors?: string[] } => {
  return { valid: true };
};

export async function execute(commitment: any, provider: Provider): Promise<ExecutionResult> {
  const query = commitment.entities?.query || commitment.parameters?.query || '';
  const limit = commitment.entities?.limit || commitment.parameters?.limit || 20;

  try {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.documents) {
      throw new Error('Local documents search is only available on desktop.');
    }

    const results = await electronAPI.documents.search(query, limit);
    return {
      success: true,
      commitmentId: commitment.id,
      providerData: { results }
    };
  } catch (error: any) {
    return {
      success: false,
      commitmentId: commitment.id,
      error: error.message
    };
  }
}
