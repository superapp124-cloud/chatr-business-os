export type GoalStatus = 'draft' | 'active' | 'suspended' | 'completed' | 'failed' | 'abandoned';

export interface Objective {
  id: string;
  description: string;
  successCriteria: string;     // Measurable threshold
  isMet: boolean;
}

export interface GoalABI {
  id: string;                  // UUID
  description: string;         // e.g., 'Hire 10 Java developers'
  status: GoalStatus;
  
  ownerEntityId: string;       // Reality Graph Entity ID (Person or Team)
  
  objectives: Objective[];     // Breakdown of the goal
  
  constraints: {
    budget?: number;
    timelineEnd?: string;      // ISO8601
    mandatoryPolicies: string[]; 
  };
  
  lifecycle: {
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    lastEvaluatedAt?: string;
  };
}
