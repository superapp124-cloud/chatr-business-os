import { Capability, CommitmentPreview } from '../types';
import manifest from './manifest.json';
import { validate } from './validator';
import { execute, verifier, undo } from './executor';
import { playbook } from './playbook';
import { runTests } from './tests';

export const capability: Capability = {
  manifest: manifest as any,
  validate: validate,
  preview: (commitment) => ({
    title: commitment.title,
    lines: [{ label: 'Details', value: commitment.description || '' }],
    cta: 'Confirm'
  }),
  executor: execute,
  verifier,
  undo,
  tests: runTests,
  playbook
};
