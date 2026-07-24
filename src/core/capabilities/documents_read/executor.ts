import { Capability, ExecutionResult, Provider } from '../types';

export const validate = (input: any): { valid: boolean; errors?: string[] } => {
  if (!input?.filePath && !input?.entities?.filePath) {
    return { valid: false, errors: ['filePath is required'] };
  }
  return { valid: true };
};

export async function execute(commitment: any, provider: Provider): Promise<ExecutionResult> {
  const filePath = commitment.entities?.filePath || commitment.parameters?.filePath;

  try {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.documents) {
      throw new Error('Local documents read is only available on desktop.');
    }

    const result = await electronAPI.documents.read(filePath);
    return {
      success: true,
      commitmentId: commitment.id,
      providerData: result
    };
  } catch (error: any) {
    return {
      success: false,
      commitmentId: commitment.id,
      error: error.message
    };
  }
}
