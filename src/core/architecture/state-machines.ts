/**
 * CHATR Intent OS - Phase 1.5A State Machines
 */

// ─── 15. CERTIFICATION STATE MACHINE ──────────────────────────────────────────
export type CertificationState = 
  | 'IDENTIFIED' 
  | 'NORMALIZED' 
  | 'CLASSIFIED' 
  | 'AUTHENTICATED' 
  | 'SECURITY_REVIEW' 
  | 'SANDBOX_TEST' 
  | 'PERFORMANCE_TEST' 
  | 'HEALTH_BASELINE' 
  | 'TRUST_BASELINE' 
  | 'POLICY_REVIEW' 
  | 'CERTIFIED' 
  | 'REJECTED';

export interface CertificationTransition {
  from: CertificationState;
  to: CertificationState;
  trigger: string;
  guard?: (context: any) => boolean;
}

export interface ICertificationStateMachine {
  currentState: CertificationState;
  transition(trigger: string, context: any): CertificationState;
  getHistory(): CertificationTransition[];
}

// ─── 16. DISCOVERY STATE MACHINE ──────────────────────────────────────────────
export type DiscoveryState = 
  | 'IDLE'
  | 'SCANNING_SOURCES'
  | 'FETCHING_MANIFESTS'
  | 'CALCULATING_DELTAS'
  | 'PUSHING_CANDIDATES'
  | 'COMPLETED'
  | 'FAILED';

export interface IDiscoveryStateMachine {
  currentState: DiscoveryState;
  startDiscoveryJob(jobId: string): void;
  reportProgress(jobId: string, state: DiscoveryState, metadata: any): void;
}
