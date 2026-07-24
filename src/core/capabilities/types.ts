// CHATR Kernel ABI - Capability Registry (ADR-001)

export type MaturityLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type AutonomyLevel = 'FullyAutonomous' | 'ApprovalRequired' | 'Restricted';

export interface ICapability {
  id: string;          // e.g., 'core.communication.send_email'
  name: string;        // e.g., 'Send Email'
  version: string;     // e.g., '1.2.0'
  owner: string;       // Team or subsystem responsible
  maturity: MaturityLevel;
  autonomy: AutonomyLevel;
  
  description: string;
  
  // Data Schema
  inputsSchema: Record<string, any>; // JSON Schema defining required inputs
  outputsSchema: Record<string, any>; // JSON Schema defining expected outputs
  
  // Dependencies
  requiredProviders: string[]; // e.g., ['EmailProvider']
  fallbackProviders: string[]; // e.g., ['NotificationProvider']
  
  // Telemetry & Limits
  metrics: {
    avgLatencyMs: number;
    successRate: number;
  };
  
  // For Composition: A capability might be a chain of other capabilities
  composedOf?: string[]; // Array of capability IDs (e.g., ['Search', 'Email', 'ATS'])
}

export interface CapabilityExecutionRequest {
  capabilityId: string;
  version?: string; // If omitted, use latest
  inputs: Record<string, any>;
  contextId: string; // Refers to the IntentContext
}

export type CommitmentStatus = 
  | 'detected' 
  | 'understood' 
  | 'validated' 
  | 'permission_denied'
  | 'policy_blocked'
  | 'approval_required'
  | 'suggested' 
  | 'extracting'
  | 'needs_input'
  | 'searching'
  | 'results_ready'
  | 'preview_ready'
  | 'confirmed' 
  | 'executing' 
  | 'waiting' 
  | 'observed'
  | 'reality_verified' 
  | 'completed' 
  | 'learned'
  | 'archived'
  | 'canceled';

export type OutcomeType = 
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'SCHEDULE' | 'NOTIFY' 
  | 'COMMUNICATE' | 'ANALYZE' | 'RETRIEVE' | 'APPROVE' | 'PAY';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes?: number;
  source: 'upload' | 'cloud' | 'url';
  metadata?: any;
}

export interface Intent {
  action: string;
  confidence: number;
  entities?: Record<string, any>;
}

export interface Commitment {
  id: string;
  type?: string; 
  capability: string;
  title: string;
  description?: string;
  status: CommitmentStatus;
  confidence: number;
  createdAt?: number;
  participants?: any[];
  attachments?: Attachment[];
  schedule?: {
    relative?: string;
    resolved?: string;
    raw?: string;
  };
  metadata?: Record<string, any>;
  permissions?: string[];
  requiresApproval?: boolean;
  
  // Execution Context
  entities?: Record<string, any>;
  missingFields?: MissingField[];
  searchResults?: any[];
  selectedResult?: any;
  preview?: CommitmentPreview;
  
  // Verification Context
  realityVerified?: boolean;
  verificationDetails?: RealityVerificationResult;
  updatedAt?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

export interface Preview {
  title: string;
  subtitle: string;
  actions: string[];
  metadata?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  commitmentId: string;
  message?: string;
  providerData?: any; // Data from provider
}

export interface RealityVerificationResult {
  verified: boolean;
  provider: string; // e.g. "Amadeus"
  timestamp: string;
  transactionId: string; // e.g. "PNR123"
  evidence: any; // Raw auditable payload
}

export interface ExtractedEntities {
  [key: string]: any;
}

export interface ResolvedEntities extends ExtractedEntities {
  _resolved?: true;
}

export interface MissingField {
  key: string;           
  label: string;         
  type: 'text' | 'choice' | 'date';
  options?: string[];    
}

export interface CommitmentPreview {
  icon?: string;
  title: string;
  lines: { label: string; value: string }[];
  cta: string;           
}

export interface CapabilityPlaybook {
  extract(rawText: string): ExtractedEntities;
  resolve(entities: ExtractedEntities, context: any): Promise<ResolvedEntities>;
  getMissingFields(entities: ResolvedEntities): MissingField[];
  
  // Universal Playbook Contract Methods
  requiresSearch?(entities: ResolvedEntities): boolean;
  buildSearchQuery?(entities: ResolvedEntities): any;
  formatSearchResults?(results: any[]): any[];
  buildPreview(entities: ResolvedEntities, selectedResult?: any): CommitmentPreview;
  
  // Search Configuration for Universal Engine
  searchConfiguration?: {
    columns: { key: string; label: string; type?: 'currency' | 'time' | 'text' | 'boolean' }[];
    sortOptions?: { key: string; label: string; direction: 'asc' | 'desc' }[];
    primaryActionLabel?: string;
  };
}

export interface CapabilityManifest {
  // Identity
  id: string;
  name: string;
  version: string;
  category: string;
  outcomeType: OutcomeType;
  providerName?: string;
  
  // Constraints
  maxExecutionTime?: string;
  requiresNetwork: boolean;
  requiresAuthentication: boolean;
  supportsRetry: boolean;
  supportsOfflineQueue: boolean;
  estimatedLatency?: string;

  // Runtime
  maturity: 0 | 1 | 2 | 3 | 4 | 5;
  permissions: string[];
  executionPolicy: 'immediate' | 'confirmation_required' | 'biometric_confirmation' | 'confirmation_and_undo';
  
  // Versioning
  capabilityVersion: string;
  sdkVersion: string;
  minimumKernel: string;
  maximumTestedKernel?: string;
  migrationVersion?: string;

  // Product
  description: string;
  examples: string[];
  tags: string[];
  icon?: string;
  keywords: string[];

  // Graph Edges
  edges?: {
    type: 'suggests' | 'may_require' | 'followed_by';
    target: string;
  }[];
}

export interface Capability {
  manifest: CapabilityManifest;
  playbook?: CapabilityPlaybook;
  
  validate(commitment: Commitment): Promise<ValidationResult>;
  planner?(commitment: Commitment): Promise<any>;
  preview?(commitment: Commitment): Preview;
  executor(commitment: Commitment, provider: Provider): Promise<ExecutionResult>;
  verifier?(commitment: Commitment, provider: Provider): Promise<RealityVerificationResult>;
  undo?(commitmentId: string, provider: Provider): Promise<void>;
  tests?(): Promise<boolean>;
}

export interface Provider {
  id: string;
  name: string;
  type: string;
  authenticate(): Promise<boolean>;
  executeAction(action: string, payload: any): Promise<any>;
}

export interface UnderstandingService {
  resolve(text: string, context: any): Promise<Intent>;
}

export interface CommitmentPlanner {
  plan(intent: Intent): Promise<Commitment | null>;
}

export interface CommitmentRuntime {
  execute(commitment: Commitment): Promise<void>;
}

export interface RealityEngine {
  verify(commitment: Commitment, capability: Capability, provider: Provider): Promise<RealityVerificationResult>;
}

export interface LearningEngine {
  learn(commitment: Commitment): Promise<void>;
}

export type NotificationChannel = 'desktop' | 'push' | 'email' | 'sms' | 'slack';

export interface NotificationAction {
  id: string;
  label: string;
  intent: string;
  style?: 'primary' | 'secondary' | 'destructive';
}

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  severity?: 'info' | 'warning' | 'urgent';
  actionUrl?: string;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
  channels?: NotificationChannel[]; 
}

export interface ResolvedEntity<T> {
  entity: T;
  confidence: number;
  provider: string; // e.g. "Workday", "LDAP"
  source: string; // e.g. "HRMS", "Directory"
  timestamp: Date;
  resolvedBy: string; // e.g. "ContactResolver"
}

export interface EnterprisePerson {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  managerId?: string;
}

export interface EnterprisePolicy {
  id: string;
  topic: string;
  content: string;
  requiresApproval: boolean;
  approverRole?: string;
  maxAmount?: number;
}

export interface EnterpriseProject {
  id: string;
  name: string;
  leadId: string;
  members: string[];
}

export interface ResolvedContext {
  people: ResolvedEntity<EnterprisePerson>[];
  organizations: ResolvedEntity<any>[];
  policies: ResolvedEntity<EnterprisePolicy>[];
  documents: ResolvedEntity<any>[];
  calendar: ResolvedEntity<any>[];
  projects: ResolvedEntity<EnterpriseProject>[];
  permissions: ResolvedEntity<any>[];
  preferences: ResolvedEntity<any>[];
  locations: ResolvedEntity<any>[];
  knowledge: ResolvedEntity<any>[];
}

export interface IMemoryProvider {
  id: string;
  name: string;
  resolvePerson?(query: string): Promise<EnterprisePerson[]>;
  resolvePolicy?(topic: string): Promise<EnterprisePolicy[]>;
  resolveProject?(query: string): Promise<EnterpriseProject[]>;
  search?(query: string): Promise<any[]>;
}

export interface CapabilityContract {
  initialize(): Promise<void>;
  plan(intent: any): Promise<any>;
  execute(context: any): Promise<void>;
  pause(context: any): Promise<void>;
  resume(context: any): Promise<void>;
  cancel(context: any): Promise<void>;
  rollback(context: any): Promise<void>;
  exportArtifacts(): any[];
}
