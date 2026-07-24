import { Commitment, ValidationResult } from '../types';

export const validate = async (commitment: Commitment): Promise<ValidationResult> => {
  if (!commitment.title) {
    return {
      isValid: false,
      errors: ['Task must have a title.']
    };
  }

  // Priority validation
  if (commitment.metadata?.priority) {
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(commitment.metadata.priority.toLowerCase())) {
      return {
        isValid: false,
        errors: [`Invalid priority: ${commitment.metadata.priority}. Must be low, medium, or high.`]
      };
    }
  }

  return { isValid: true };
};
