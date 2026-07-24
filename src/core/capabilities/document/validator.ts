import { Commitment, ValidationResult } from '../types';

export async function validate(commitment: Commitment): Promise<ValidationResult> {
  const errors: string[] = [];
  if (!commitment.title) {
    errors.push('Title is required.');
  }
  return { 
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
