import { NodeDefinition } from '../contracts/NodeDefinition.abi';

export const TriggerNode: NodeDefinition = {
  type: 'core.trigger',
  
  manifest: {
    type: 'core.trigger',
    label: 'Trigger',
    description: 'Starts the workflow when triggered.',
    icon: 'Zap',
    category: 'trigger',
    version: '1.0.0',
    isAddable: true,
    tags: ['start', 'trigger', 'webhook', 'schedule']
  },

  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: true
  },

  outputSchema: {
    type: 'object',
    properties: {
      triggered: { type: 'boolean' },
      timestamp: { type: 'number' },
      payload: { type: 'object' }
    }
  },

  uiContract: {
    fields: []
  },

  capabilities: [],
  permissions: [],
  policies: [],
  tests: [],

  validate(config) {
    return { valid: true, errors: [] };
  },

  async execute(config, context) {
    return {
      output: {
        triggered: true,
        timestamp: Date.now(),
        payload: config
      }
    };
  },

  serialize(nodeId, config) {
    return {
      type: this.type,
      data: config,
      retry: 0,
      timeoutMs: 5000
    };
  }
};
