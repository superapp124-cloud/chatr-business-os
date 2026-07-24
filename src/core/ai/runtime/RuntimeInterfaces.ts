export interface AIGovernanceMetadata {
  provider: string;
  model: string;
  modelVersion: string;
  promptTemplate: string;
  schemaVersion?: string;
  contextSources: string[];
  executionTimeMs: number;
  confidence: number;
  repairCount: number;
  cacheHit: boolean;
  timestamp: number;
}

export interface ModelProfile {
  id: string; // e.g. "qwen3:8b"
  provider: string; // e.g. "ollama"
  capabilities: {
    reasoning: number;      // 0-100
    extraction: number;     // 0-100
    classification: number; // 0-100
    vision: boolean;
    multilingual: boolean;
    contextWindow: number;
  };
  metrics: {
    latency: 'low' | 'medium' | 'high';
    memoryRequirementsGb: number;
  };
}

export type AITaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface AITaskPolicy {
  maxRetries: number;
  timeoutMs: number;
  allowCloud: boolean;
  cacheAllowed: boolean;
}

export interface IAITask<TInput, TOutput> {
  id: string;
  type: string; // e.g. "extract", "reason"
  priority: AITaskPriority;
  policy: AITaskPolicy;
  
  execute(input: TInput, contextSources?: string[]): Promise<{
    result: TOutput;
    metadata: AIGovernanceMetadata;
  }>;
}

export interface IAIProviderResponse<T> {
  result: T;
  confidence: number;
  reasoning: string;
  warnings?: string[];
  missing_information?: string[];
  providerData?: {
    modelUsed: string;
    latencyMs: number;
  };
}
