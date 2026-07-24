/**
 * CHATR Business OS v1.0 — Evidence-Driven Governance Architecture
 *
 * 1. CapabilityEvidenceProvider — Interface implemented by subsystem providers
 * 2. Health vs Certification separation (Operational Health vs Release Gate Certification)
 * 3. Weighted Evidence Score Calculation:
 *      Database (25%), Runtime (20%), Events (15%), Security/RLS (15%), Connectors (15%), Telemetry (10%)
 */

export type OperationalHealth = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DOWN';
export type CertificationGate = 'Concept' | 'Prototype' | 'Integrated' | 'Operational' | 'Production' | 'Certified';

export interface StructuredEvidence {
  database: { status: 'Healthy' | 'Degraded' | 'Offline'; details: string };
  runtime: { status: 'Healthy' | 'Degraded' | 'Offline'; details: string };
  events: { status: 'Healthy' | 'Degraded' | 'Offline'; details: string };
  security: { status: 'RLS Enforced' | 'Warning' | 'Disabled'; details: string };
  connectors: { status: 'Connected' | 'Partial' | 'Not Connected'; details: string };
  telemetry: { status: 'Active' | 'Idle' | 'Disabled'; details: string };
}

export interface CapabilityHealthReport {
  capabilityId: string;
  name: string;
  category: 'Core OS' | 'Business Capability' | 'Platform Service';
  healthStatus: OperationalHealth;
  certificationGate: CertificationGate;
  weightedScore: number; // 0 - 100 calculated mathematically
  evidence: StructuredEvidence;
  metrics: {
    totalCalls: number;
    successRatePercent: number;
    avgLatencyMs: number;
    activeRecords: number;
    lastExecutionAt: string | null;
  };
}

export interface CapabilityEvidenceProvider {
  capabilityId: string;
  getEvidenceReport(): Promise<CapabilityHealthReport>;
}

/**
 * Calculates a weighted maturity score based on operational evidence
 */
export function calculateWeightedScore(evidence: StructuredEvidence, metrics: CapabilityHealthReport['metrics']): number {
  let dbScore = evidence.database.status === 'Healthy' ? 100 : evidence.database.status === 'Degraded' ? 50 : 0;
  let runtimeScore = evidence.runtime.status === 'Healthy' ? 100 : evidence.runtime.status === 'Degraded' ? 50 : 0;
  let eventsScore = evidence.events.status === 'Healthy' ? 100 : evidence.events.status === 'Degraded' ? 50 : 0;
  let securityScore = evidence.security.status === 'RLS Enforced' ? 100 : evidence.security.status === 'Warning' ? 50 : 0;
  let connectorsScore = evidence.connectors.status === 'Connected' ? 100 : evidence.connectors.status === 'Partial' ? 50 : 15;
  let telemetryScore = evidence.telemetry.status === 'Active' ? 100 : 40;

  // Apply failure rate penalty if telemetry is active
  if (metrics.totalCalls > 0 && metrics.successRatePercent < 95) {
    runtimeScore = Math.max(0, runtimeScore - (100 - metrics.successRatePercent) * 2);
  }

  // Weightings: DB (25%), Runtime (20%), Events (15%), Security (15%), Connectors (15%), Telemetry (10%)
  const weighted = 
    (dbScore * 0.25) +
    (runtimeScore * 0.20) +
    (eventsScore * 0.15) +
    (securityScore * 0.15) +
    (connectorsScore * 0.15) +
    (telemetryScore * 0.10);

  return Math.round(weighted);
}
