import { NodeDefinition } from '../contracts/NodeDefinition.abi';

export const ConditionNode: NodeDefinition = {
  type: 'core.condition',
  
  manifest: {
    type: 'core.condition',
    label: 'Condition',
    description: 'Branches workflow execution based on a javascript expression.',
    icon: 'SplitSquareHorizontal',
    category: 'condition',
    version: '1.0.0',
    isAddable: true,
    tags: ['branch', 'if', 'else', 'condition']
  },

  inputSchema: {
    type: 'object',
    required: ['expression'],
    properties: {
      expression: { type: 'string', description: 'A JS expression returning boolean (e.g. outputs.email.status == 200)' }
    }
  },

  outputSchema: {
    type: 'object',
    properties: {
      result: { type: 'boolean' },
      branch: { type: 'string' }
    }
  },

  uiContract: {
    fields: [
      {
        key: 'expression',
        label: 'Condition Expression',
        type: 'expression',
        required: true,
        placeholder: 'e.g. true === true'
      }
    ]
  },

  capabilities: [],
  permissions: [],
  policies: [],
  tests: [],

  validate(config) {
    const errors = [];
    if (!config.expression || typeof config.expression !== 'string' || config.expression.trim() === '') {
      errors.push({ field: 'expression', message: 'Expression is required', code: 'MISSING_REQUIRED_FIELD' });
    }
    return { valid: errors.length === 0, errors };
  },

  async compile(config) {
    // Phase D requirement: parse and validate expression safety before runtime.
    const expression = config.expression as string;
    try {
       // Just a lightweight parse test for syntax
       const sanitized = expression.replace(/[^a-zA-Z0-9_.=!<>'"& |()]/g, '');
       new Function('return ' + sanitized);
    } catch (e: any) {
       throw new Error(`Expression compilation failed: ${e.message}`);
    }
  },

  async execute(config, context) {
    const expression = config.expression as string;
    const sanitized = expression.replace(/[^a-zA-Z0-9_.=!<>'"& |()]/g, '');
    let result = false;
    try { 
      result = Boolean(new Function('return ' + sanitized)()); 
    } catch { 
      result = false; 
    }
    
    return { 
      output: { 
        result, 
        branch: result ? 'true' : 'false' 
      } 
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
