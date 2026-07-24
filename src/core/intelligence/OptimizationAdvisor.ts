import { performanceAnalyzer } from './PerformanceAnalyzer';
import { failureAnalyzer } from './FailureAnalyzer';
import { supabase } from '@/integrations/supabase/client';

export type AdvisorySeverity = 'info' | 'warning' | 'critical';

export interface AdvisoryMessage {
  id: string;
  severity: AdvisorySeverity;
  title: string;
  explanation: string;
  evidence: string;
  recommendation: string;
  workflow_id: string;
  created_at: string;
}

class OptimizationAdvisorImpl {
  /**
   * Generates proactive, explainable advisory messages for a workflow.
   * NEVER acts autonomously — only surfaces evidence and recommends.
   */
  async advise(workflowId: string): Promise<AdvisoryMessage[]> {
    const messages: AdvisoryMessage[] = [];
    const now = new Date().toISOString();
    let counter = 0;
    const id = () => `advisory-${workflowId}-${++counter}`;

    try {
      const [perfReport, failReport] = await Promise.all([
        performanceAnalyzer.analyze(workflowId),
        failureAnalyzer.analyze(workflowId),
      ]);

      // ── Performance bottlenecks ───────────────────────────────────────────
      for (const node of perfReport.bottleneck_nodes) {
        if (node.percentage_of_total >= 50) {
          messages.push({
            id: id(), workflow_id: workflowId, created_at: now,
            severity: 'warning',
            title: `Node '${node.node_id}' is a performance bottleneck`,
            explanation: `This node accounts for ${node.percentage_of_total}% of total workflow runtime on average.`,
            evidence: `Avg: ${node.avg_ms}ms | P80: ${node.p80_ms}ms | P95: ${node.p95_ms}ms (across ${perfReport.total_runs} runs)`,
            recommendation: 'Consider batching, parallelizing, or caching the output of this node to reduce overall workflow duration.',
          });
        }
        if (node.p95_ms > node.p80_ms * 3) {
          messages.push({
            id: id(), workflow_id: workflowId, created_at: now,
            severity: 'warning',
            title: `Node '${node.node_id}' has inconsistent latency`,
            explanation: `This node shows high variance between typical and worst-case execution times, indicating intermittent failures or resource contention.`,
            evidence: `P80: ${node.p80_ms}ms vs P95: ${node.p95_ms}ms — a ${Math.round(node.p95_ms / node.p80_ms)}x spike`,
            recommendation: 'Add retry logic with exponential backoff, and check for resource contention during peak usage.',
          });
        }
      }

      // ── High failure rate ─────────────────────────────────────────────────
      if (failReport.failure_rate_pct >= 15) {
        messages.push({
          id: id(), workflow_id: workflowId, created_at: now,
          severity: failReport.failure_rate_pct >= 30 ? 'critical' : 'warning',
          title: `High failure rate: ${failReport.failure_rate_pct}%`,
          explanation: `This workflow fails significantly more often than expected. A healthy workflow should fail less than 5% of the time.`,
          evidence: `${failReport.total_failures} failures out of ${failReport.total_runs} recent runs`,
          recommendation: 'Review the top error clusters below and add input validation or provider health checks.',
        });
      }

      // ── Top error cluster ─────────────────────────────────────────────────
      if (failReport.error_clusters.length > 0) {
        const top = failReport.error_clusters[0];
        messages.push({
          id: id(), workflow_id: workflowId, created_at: now,
          severity: top.count >= 5 ? 'critical' : 'warning',
          title: `Recurring error pattern (${top.count}x)`,
          explanation: `The same error signature is occurring repeatedly, suggesting a systematic problem rather than a transient failure.`,
          evidence: `Pattern: "${top.pattern.slice(0, 100)}" — first seen: ${new Date(top.first_seen).toLocaleDateString()}, last seen: ${new Date(top.last_seen).toLocaleDateString()}`,
          recommendation: top.pattern.toLowerCase().includes('timeout')
            ? 'Increase timeout limits for this provider or add a circuit breaker to prevent cascading failures.'
            : 'Add targeted error handling for this failure class and alert the operator when it recurs.',
        });
      }

      // ── Approval bottleneck ───────────────────────────────────────────────
      const { data: approvalRuns } = await supabase
        .from('workflow_runs')
        .select('approval_wait_ms')
        .eq('workflow_id', workflowId)
        .not('approval_wait_ms', 'is', null)
        .limit(20);

      if (approvalRuns && approvalRuns.length > 0) {
        const avgWait = Math.round(
          approvalRuns.reduce((s, r) => s + (r.approval_wait_ms ?? 0), 0) / approvalRuns.length
        );
        const avgHours = (avgWait / 3_600_000).toFixed(1);
        if (avgWait > 3_600_000) { // > 1 hour
          messages.push({
            id: id(), workflow_id: workflowId, created_at: now,
            severity: avgWait > 14_400_000 ? 'critical' : 'info', // >4h = critical
            title: `Approval bottleneck: avg wait ${avgHours} hours`,
            explanation: 'Human approval steps are significantly increasing total workflow completion time.',
            evidence: `Average approval wait: ${avgHours}h across ${approvalRuns.length} runs`,
            recommendation: 'Consider reducing the approval SLA deadline, enabling auto-approval for low-risk actions, or expanding the approver pool.',
          });
        }
      }

      // Sort: critical → warning → info
      const order = { critical: 0, warning: 1, info: 2 };
      messages.sort((a, b) => order[a.severity] - order[b.severity]);

    } catch (err: any) {
      console.error('[OptimizationAdvisor] advise failed:', err.message);
    }

    return messages;
  }
}

export const optimizationAdvisor = new OptimizationAdvisorImpl();
