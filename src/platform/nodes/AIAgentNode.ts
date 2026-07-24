import { NodeDefinition } from '../contracts/NodeDefinition.abi';
import { ProviderResolver } from '../execution/ProviderResolver';

export const AIAgentNode: NodeDefinition = {
  type: 'core.ai_agent',
  
  manifest: {
    type: 'core.ai_agent',
    label: 'AI Agent',
    description: 'Generates text or structured data using a language model.',
    icon: 'Sparkles',
    category: 'ai',
    version: '1.0.0',
    isAddable: true,
    tags: ['ai', 'llm', 'generate', 'text'],
    requiredPermissions: ['provider.ai']
  },

  inputSchema: {
    type: 'object',
    required: ['prompt'],
    properties: {
      prompt: { type: 'string', description: 'The instructions for the AI' },
      model: { type: 'string', description: 'Preferred model (optional)' }
    }
  },

  outputSchema: {
    type: 'object',
    properties: {
      response: { type: 'string' },
      model: { type: 'string' },
      success: { type: 'boolean' }
    }
  },

  uiContract: {
    fields: [
      {
        key: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
        placeholder: 'Enter instructions for the AI...'
      },
      {
        key: 'model',
        label: 'Model Preference',
        type: 'select',
        options: [
          { label: 'Auto (Recommended)', value: 'auto' },
          { label: 'GPT-4o', value: 'gpt-4o' },
          { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet' }
        ]
      }
    ]
  },

  capabilities: ['chatr.ai.generate'],
  permissions: [],
  policies: [
    {
      policyType: 'rate_limit',
      description: 'AI usage is subject to tenant rate limits',
      enforced: true
    }
  ],
  tests: [],

  validate(config) {
    const errors = [];
    if (!config.prompt || typeof config.prompt !== 'string' || config.prompt.trim() === '') {
      errors.push({ field: 'prompt', message: 'Prompt is required', code: 'MISSING_REQUIRED_FIELD' });
    }
    return { valid: errors.length === 0, errors };
  },

  async compile(config) {
    // Phase D requirement: validate expensive things once.
    // E.g. we could parse the prompt template for variable substitutions here to ensure they exist in context.
  },

  async execute(config, context) {
    // 1. Capability Resolution & Permission Enforcement (Phase E.5)
    context.capabilities.request('provider.ai');
    const provider = await ProviderResolver.resolve('chatr.ai.generate', context);
    
    // 2. Execution (In a real system, provider implements a standard interface)
    // For Phase D we will stub the provider's execution internally
    const prompt = (config.prompt || 'Process the workflow step.') as string;
    
    // Mock the provider generating
    const response = await provider.execute({ prompt });
    
    return {
      output: { response: response.data, model: provider.id, success: true },
      providerUsed: provider.id,
      capabilityId: 'chatr.ai.generate',
      tokensUsed: 150,
      costUsd: 0.001
    };
  },

  serialize(nodeId, config) {
    return {
      type: this.type,
      data: config,
      retry: 2,
      timeoutMs: 30000
    };
  }
};
