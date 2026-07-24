export type IntentState = 
  | 'idle'
  | 'resolving' // parallel resolution phase
  | 'results_ready'
  | 'connecting'
  | 'auth_required'
  | 'auth_complete'
  | 'review'
  | 'paying'
  | 'tracking'
  | 'completed'
  | 'failed';

export interface ProviderResult {
  id: string;
  name: string;
  badge?: string; // e.g. "Best Overall", "Fastest"
  price: string;
  deliveryTime: string;
  rating: string;
  tags?: string[];
  decisionReasons: string[];
}

export interface MetricEvent {
  stage: string;
  startedAt: number;
  finishedAt: number;
  latencyMs: number;
  slaMs: number;
}

export interface IntentContext {
  intent: string;
  location?: string;
  extractedEntities?: string[];
  providersSearched?: string[];
  resultsFound?: number;
  resultsEliminated?: number;
  topResults?: ProviderResult[];
  selectedResult?: ProviderResult;
  metrics?: Record<string, MetricEvent>;
  
  // Track parallel task completion
  tasksCompleted?: {
    understanding?: boolean;
    location?: boolean;
    providerSearch?: boolean;
    sessionCheck?: boolean;
    paymentReadiness?: boolean;
  };
}

export type KernelSessionEvent = 
  | { type: 'STATE_CHANGED', state: IntentState, context: IntentContext }
  | { type: 'METRIC_RECORDED', metric: MetricEvent, context: IntentContext }
  | { type: 'ERROR', message: string };

export interface KernelSession {
  /**
   * Submit a natural language intent to the OS.
   */
  submitIntent(intent: string): void;

  /**
   * Select an option from the generated results.
   */
  selectOption(resultId: string): void;

  /**
   * Complete an authentication challenge.
   */
  completeAuth(): void;

  /**
   * Confirm and pay for the order.
   */
  confirmAndPay(): void;

  /**
   * Subscribe to kernel state changes.
   */
  subscribe(callback: (event: KernelSessionEvent) => void): () => void;
}
