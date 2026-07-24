export interface TraceLog {
  level: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  message: string;
  mission_id?: string;
  capability?: string;
  provider?: string;
  timestamp: string;
}

export interface TraceNode {
  id: string;
  title: string;
  description: string;
  status: "active" | "done" | "failed" | "partial";
  logs?: TraceLog[];
  payload?: {
    type: "markdown" | "datagrid" | "approval" | "empty";
    data: any;
  };
  mission_id?: string;
}

export interface ProviderAttempt {
  provider: string;
  outcome: "SUCCESS" | "EMPTY_POOL" | "RATE_LIMITED" | "HARD_FAILURE";
  contributed_count: number;
  retry_count: number;
  attempted_at: string;
}

export interface MissionProgressState {
  mission_id: string;
  capability: string;
  target_goal: number;
  accumulated_count: number;
  exclusion_list: string[];
  provider_attempts: ProviderAttempt[];
  status: "IN_PROGRESS" | "PARTIAL_SUCCESS" | "COMPLETE" | "REQUIRES_INTERVENTION";
  created_at: string;
  updated_at: string;
}
