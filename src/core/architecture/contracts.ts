/**
 * CHATR Intent OS - Phase 1.5A Architecture Contracts
 * This file serves as the frozen specification for all public interfaces across the platform.
 * Modifying these interfaces requires an Architecture Decision Record (ADR).
 */

// ─── 3. PROVIDER MANIFEST V1 ──────────────────────────────────────────────────
export interface ProviderManifestV1 {
  id: string; // Immutable Fingerprint ID
  version: string;
  publisher: { identity: string; digitalSignature: string; checksum: string };
  compatibility: { abiVersion: string; manifestVersion: string; supportedPlatforms: string[] };
  industry: string;
  subIndustry: string;
  capabilities: CapabilitySpecification[];
  transport: TransportSpecification;
  authentication: AuthenticationSpecification;
  compliance: ComplianceSpecification;
  regions: RegionSpecification[];
  quality: QualitySpecification;
  health: HealthSpecification;
  confidence: number; // 0-100 (Separate from health)
  policies: string[];
  benchmark: BenchmarkSpecification;
  metadata: Record<string, any>;
}

// ─── 4. INDUSTRY MANIFEST ─────────────────────────────────────────────────────
export interface IndustryManifest {
  industryId: string;
  subIndustries: string[];
  canonicalCapabilities: string[]; // Layer 1 (Core) capabilities
  complianceDefaults: ComplianceSpecification;
  routingPolicies: string[];
  certificationRules: CertificationRule[];
  benchmarkProfiles: BenchmarkProfile[];
}

// ─── 5. CAPABILITY SPECIFICATION ──────────────────────────────────────────────
export interface CapabilitySpecification {
  id: string; // e.g., 'travel.flight.search'
  version: string; // e.g., 'v1'
  layer: 'CORE' | 'EXTENSION';
  confidence: number; // 0-100
  verified: boolean;
  verificationMethod: 'LIVE' | 'SANDBOX' | 'MANUAL';
  aliases?: string[];
  replacementCapability?: string;
  deprecationDate?: string;
}

// ─── 6. EVENT CONTRACTS ───────────────────────────────────────────────────────
export interface IEvent {
  eventId: string;
  timestamp: number;
  type: string;
  payload: any;
  source: string;
}

export interface IEventBus {
  publish(event: IEvent): void;
  subscribe(eventType: string, handler: (event: IEvent) => void): void;
}

// ─── 7. STORAGE CONTRACTS (ABI 1.0) ───────────────────────────────────────────
export interface IStorageAdapter {
  // Transaction Support
  transaction<T>(action: () => Promise<T>): Promise<T>;
  // Read
  get(collection: string, id: string): Promise<any>;
  query(collection: string, filter: any): Promise<any[]>;
  search(collection: string, fullTextQuery: string): Promise<any[]>;
  // Write (Append-only / Updates)
  insert(collection: string, record: any): Promise<void>;
  update(collection: string, id: string, delta: any): Promise<void>;
  softDelete(collection: string, id: string): Promise<void>;
  // Time Travel
  getSnapshot(collection: string, id: string, timestamp: number): Promise<any>;
}

// ─── 8. POLICY SPECIFICATION ──────────────────────────────────────────────────
export interface PolicySpecification {
  policyId: string;
  rule: (context: any, candidate: ProviderManifestV1) => boolean;
  enforcement: 'HARD' | 'SOFT'; // Hard = filter out, Soft = penalty to rank
}

// ─── 9. BENCHMARK SPECIFICATION ───────────────────────────────────────────────
export interface BenchmarkSpecification {
  responseTimeMs: number;
  reliabilityScore: number;
  throughput: number;
  costPerRequest: number;
  quotaEfficiency: number;
  authComplexity: number;
  lastBenchmarked: number;
}
export interface BenchmarkProfile { /* Domain specific rules */ }

// ─── 10. EXPLAINABILITY SPECIFICATION ─────────────────────────────────────────
export interface ExecutionTrace {
  traceId: string;
  intent: string;
  capabilityId: string;
  candidatesConsidered: string[];
  policyApplied: string[];
  benchmarkData: any;
  healthData: any;
  trustData: any;
  finalDecision: string;
  latencyMs: number;
}

// ─── 11. PROVIDER LIFECYCLE SPECIFICATION ─────────────────────────────────────
export type ProviderLifecycleState = 
  | 'DISCOVERED' | 'FETCHED' | 'IDENTIFIED' | 'NORMALIZED' 
  | 'CLASSIFIED' | 'AUTHENTICATED' | 'SECURITY_REVIEW' 
  | 'SANDBOX_TEST' | 'PERFORMANCE_TEST' | 'HEALTH_BASELINE' 
  | 'TRUST_BASELINE' | 'POLICY_REVIEW' | 'CERTIFIED' 
  | 'ACTIVE' | 'DEGRADED' | 'DEPRECATED' | 'DISABLED' | 'ARCHIVED';

// ─── OTHER SUBSIDIARY TYPES ───────────────────────────────────────────────────
export interface TransportSpecification { type: 'MCP' | 'REST' | 'GraphQL' | 'SDK' | 'BrowserAutomation'; endpoints: any; }
export interface AuthenticationSpecification { type: 'OAuth2' | 'API_KEY' | 'SESSION'; requiresUserAction: boolean; }
export interface ComplianceSpecification { gdpr: boolean; hipaa: boolean; soc2: boolean; iso27001: boolean; }
export interface RegionSpecification { country: string; states?: string[]; currencies: string[]; languages: string[]; }
export interface QualitySpecification { docCompleteness: number; activeMaintenance: boolean; communityAdoption: number; }
export interface HealthSpecification { uptime: number; latencyMs: number; successRate: number; lastVerified: number; }
export interface CertificationRule { ruleId: string; validate: (p: ProviderManifestV1) => boolean; }

// ─── 2. PUBLIC INTERFACES (THE CORE ENGINES) ──────────────────────────────────
export interface IProviderRegistry {
  register(manifest: ProviderManifestV1): Promise<void>;
  get(id: string): Promise<ProviderManifestV1>;
  findByCapability(capabilityId: string): Promise<ProviderManifestV1[]>;
}

export interface ICapabilityRegistry {
  getCanonicalCapabilities(industry: string): string[];
  validateCapability(capabilityId: string): boolean;
}

export interface IIndustryRegistry {
  getIndustryManifest(industryId: string): IndustryManifest;
}

export interface IDiscoveryEngine {
  runDiscovery(sources: string[]): Promise<ProviderManifestV1[]>; // Outputs to Candidate Queue
}

export interface ICertificationPipeline {
  processCandidate(candidate: ProviderManifestV1): Promise<ProviderLifecycleState>;
}

export interface IExecutionAdapter {
  execute(provider: ProviderManifestV1, payload: any): Promise<any>;
}

export interface IRankingEngine {
  rank(candidates: ProviderManifestV1[], context: any): Promise<ProviderManifestV1[]>;
}

export interface IPolicyEngine {
  evaluate(candidates: ProviderManifestV1[], context: any): Promise<ProviderManifestV1[]>;
}

export interface ICredentialVault {
  getSecret(key: string): Promise<string>;
}

export interface IBenchmarkEngine {
  runBenchmark(provider: ProviderManifestV1): Promise<BenchmarkSpecification>;
}

export interface IHealthEngine {
  ping(provider: ProviderManifestV1): Promise<HealthSpecification>;
}

export interface ITrustEngine {
  calculateTrust(provider: ProviderManifestV1): Promise<number>;
}

export interface IChangeIntelligence {
  detectDeltas(previous: ProviderManifestV1, current: ProviderManifestV1): Promise<any>;
}

export interface ITelemetryStore {
  recordTrace(trace: ExecutionTrace): Promise<void>;
}
