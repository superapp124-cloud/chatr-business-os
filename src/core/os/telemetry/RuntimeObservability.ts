/**
 * CHATR Business OS v1.0 — Runtime Observability & Telemetry Subsystem
 *
 * Tracks live latency, call volumes, success rates, and execution status
 * across all core platform runtimes.
 *
 * Instrumentation entry points:
 *   - BusinessObjectStore (CRUD operations)
 *   - EventBus (Publish & Subscribe)
 *   - KnowledgeGraphIndexer (Node & Edge indexing)
 *   - Auth & API clients
 */

export interface CapabilityMetrics {
  capabilityId: string;
  name: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  successRatePercent: number;
  avgLatencyMs: number;
  lastExecutionAt: string | null;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'IDLE';
}

class RuntimeObservabilityMonitor {
  private metricsStore = new Map<string, CapabilityMetrics>();

  constructor() {
    this.initDefaultMetrics();
  }

  private initDefaultMetrics() {
    const capabilities = [
      { id: 'bos_store',          name: 'Business Object Store' },
      { id: 'event_bus',          name: 'Kernel EventBus Ledger' },
      { id: 'knowledge_graph',    name: 'Knowledge Graph Engine' },
      { id: 'auth_identity',      name: 'Identity & Auth Engine' },
      { id: 'communication_webrtc', name: 'WebRTC Calls & Media' },
      { id: 'calendar_service',   name: 'Calendar & Scheduling' },
      { id: 'crm_runtime',        name: 'CRM & Sales Runtime' },
      { id: 'hr_talent',          name: 'HR & Talent Operations' },
      { id: 'finance_ledger',     name: 'Finance & Ledger Engine' },
    ];

    capabilities.forEach(cap => {
      this.metricsStore.set(cap.id, {
        capabilityId: cap.id,
        name: cap.name,
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        successRatePercent: 100,
        avgLatencyMs: 0,
        lastExecutionAt: null,
        status: 'IDLE'
      });
    });
  }

  public recordCall(capabilityId: string, latencyMs: number, success: boolean) {
    let existing = this.metricsStore.get(capabilityId);
    if (!existing) {
      existing = {
        capabilityId,
        name: capabilityId,
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        successRatePercent: 100,
        avgLatencyMs: 0,
        lastExecutionAt: null,
        status: 'IDLE'
      };
    }

    const totalCalls = existing.totalCalls + 1;
    const successCount = existing.successCount + (success ? 1 : 0);
    const failureCount = existing.failureCount + (success ? 0 : 1);
    const successRatePercent = Number(((successCount / totalCalls) * 100).toFixed(1));
    const avgLatencyMs = existing.totalCalls === 0 
      ? Math.round(latencyMs) 
      : Math.round((existing.avgLatencyMs * existing.totalCalls + latencyMs) / totalCalls);
    
    const status = successRatePercent >= 95 ? 'HEALTHY' : successRatePercent >= 80 ? 'DEGRADED' : 'UNHEALTHY';

    this.metricsStore.set(capabilityId, {
      capabilityId,
      name: existing.name,
      totalCalls,
      successCount,
      failureCount,
      successRatePercent,
      avgLatencyMs,
      lastExecutionAt: new Date().toISOString(),
      status
    });
  }

  public getAllCapabilityMetrics(): CapabilityMetrics[] {
    return Array.from(this.metricsStore.values());
  }

  public getCapabilityMetric(capabilityId: string): CapabilityMetrics | undefined {
    return this.metricsStore.get(capabilityId);
  }

  public getSystemOverallScore(): number {
    const metrics = this.getAllCapabilityMetrics();
    const active = metrics.filter(m => m.totalCalls > 0);
    if (active.length === 0) return 100;
    const sum = active.reduce((acc, m) => acc + m.successRatePercent, 0);
    return Math.round(sum / active.length);
  }
}

export const runtimeObservability = new RuntimeObservabilityMonitor();
