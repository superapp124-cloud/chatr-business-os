import { OutcomeCapability, Outcome, ValidationResult, Preview, ExecutionResult } from '../types';
import manifest from './manifest.json';
import { validate } from './validator';
import { execute, undo, complete, archive } from './executor';

export const CalendarCapability: OutcomeCapability = {
  manifest: manifest as any,
  validate,
  preview: (outcome: Outcome): Preview => {
    return {
      title: outcome.title,
      subtitle: outcome.description || '',
      actions: ['Confirm', 'Cancel']
    };
  },
  execute,
  undo,
  complete,
  archive
};
