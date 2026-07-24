import { Capability } from '../types';
import manifest from './manifest.json';
import { validate, execute } from './executor';

export const capability: Capability = {
  manifest: manifest as any,
  validate: validate,
  preview: (commitment) => ({
    title: 'Read Document',
    lines: [
      { label: 'File', value: commitment.entities?.filePath || commitment.parameters?.filePath || 'Unknown file' }
    ],
    cta: 'Read'
  }),
  executor: execute,
  tests: async () => true,
  playbook: []
};
