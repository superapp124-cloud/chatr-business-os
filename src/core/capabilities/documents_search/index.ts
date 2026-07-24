import { Capability } from '../types';
import manifest from './manifest.json';
import { validate, execute } from './executor';

export const capability: Capability = {
  manifest: manifest as any,
  validate: validate,
  preview: (commitment) => ({
    title: 'Search Local Documents',
    lines: [
      { label: 'Query', value: commitment.entities?.query || commitment.parameters?.query || 'Recent files' }
    ],
    cta: 'Search'
  }),
  executor: execute,
  tests: async () => true,
  playbook: []
};
