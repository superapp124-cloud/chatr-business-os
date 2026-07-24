import { Capability, Commitment, ValidationResult, Preview } from '../types';
import manifest from './manifest.json';
import { validate } from './validator';
import { execute, undo, verifier } from './executor';
import { playbook } from './playbook';
import { runTests } from './tests';

export const capability: Capability = {
  manifest: manifest as any,
  validate,
  preview: (commitment: Commitment): Preview => ({
    title: commitment.title,
    subtitle: commitment.description || '',
    actions: ['Confirm', 'Cancel']
  }),
  executor: execute,
  verifier,
  undo,
  tests: runTests,
  playbook
};
