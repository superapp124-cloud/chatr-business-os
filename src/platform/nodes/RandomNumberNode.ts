import { NodeDefinition } from '../contracts/NodeDefinition.abi';

export const RandomNumberNode: NodeDefinition = {
  type: 'core.random_number',
  
  manifest: {
    type: 'core.random_number',
    label: 'Random Number',
    description: 'Generates a random number within a specified range.',
    icon: 'Hash',
    category: 'utility',
    version: '1.0.0',
    isAddable: true,
    tags: ['math', 'random', 'number', 'utility']
  },

  inputSchema: {
    type: 'object',
    required: ['min', 'max'],
    properties: {
      min: { type: 'number', description: 'Minimum value (inclusive)' },
      max: { type: 'number', description: 'Maximum value (inclusive)' }
    }
  },

  outputSchema: {
    type: 'object',
    properties: {
      result: { type: 'number' }
    }
  },

  uiContract: {
    fields: [
      {
        key: 'min',
        label: 'Minimum Value',
        type: 'number',
        required: true,
        placeholder: '0'
      },
      {
        key: 'max',
        label: 'Maximum Value',
        type: 'number',
        required: true,
        placeholder: '100'
      }
    ]
  },

  capabilities: [],
  permissions: [],
  policies: [],
  tests: [],

  validate(config) {
    const errors = [];
    if (config.min === undefined) {
      errors.push({ field: 'min', message: 'Min is required', code: 'MISSING_REQUIRED_FIELD' });
    }
    if (config.max === undefined) {
      errors.push({ field: 'max', message: 'Max is required', code: 'MISSING_REQUIRED_FIELD' });
    }
    if (typeof config.min === 'number' && typeof config.max === 'number' && config.min > config.max) {
      errors.push({ field: 'max', message: 'Max must be >= Min', code: 'INVALID_RANGE' });
    }
    return { valid: errors.length === 0, errors };
  },

  async execute(config, context) {
    const min = Number(config.min || 0);
    const max = Number(config.max || 100);
    const result = Math.floor(Math.random() * (max - min + 1)) + min;
    
    return {
      output: { result }
    };
  },

  serialize(nodeId, config) {
    return {
      type: this.type,
      data: config,
      retry: 0,
      timeoutMs: 1000
    };
  }
};
