export interface VerificationEvidence {
  method: 'api_response' | 'reality_graph_query' | 'human_confirmation' | 'sensor_reading';
  timestamp: string;           // ISO8601
  data: any;                   // e.g., the actual API response or the human's signature
  confidence: number;          // 0.0 - 1.0
}

export interface OutcomeABI {
  id: string;                  // UUID
  sourceExecutionId: string;   // Link to the workflow/execution that produced this outcome
  targetGoalId?: string;       // Link to the Goal this outcome serves (if any)
  
  expectedOutcome: {
    description: string;
    realityStateChange: Record<string, any>; // Expected diff in the Reality Graph
  };
  
  observedOutcome: {
    description: string;
    status: 'success' | 'partial' | 'failure' | 'unverified';
    realityStateChange?: Record<string, any>; // Actual diff observed
  };
  
  verificationEvidence: VerificationEvidence[];
  
  verifiedAt?: string;
}
