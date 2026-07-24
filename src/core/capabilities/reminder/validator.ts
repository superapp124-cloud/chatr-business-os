import { Commitment, ValidationResult } from '../types';

export async function validate(commitment: Commitment): Promise<ValidationResult> {
  const errors: string[] = [];

  if (!commitment.title) {
    errors.push('Reminder title is required.');
  }

  // Accept time from either schedule.resolved OR entities.resolvedTime (set by playbook.resolve)
  const resolvedTime = commitment.schedule?.resolved || commitment.entities?.resolvedTime;

  if (!resolvedTime) {
    // We don't fail here — if there is no resolved time yet, the PlaybookEngine
    // will ask for it via getMissingFields(). Only fail if they gave us something invalid.
    // This allows the pipeline to proceed to the needs_input stage.
  } else {
    const scheduledTime = new Date(resolvedTime).getTime();
    if (isNaN(scheduledTime)) {
      errors.push('Invalid time format.');
    } else if (scheduledTime < Date.now() - 5000) {
      // Allow 5s grace period for processing time
      errors.push('Cannot schedule a reminder in the past.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
