import { supabase } from '@/integrations/supabase/client';

export interface ErrorCluster {
  pattern: string;
  count: number;
  example_run_ids: string[];
  first_seen: string;
  last_seen: string;
}

export interface FailureReport {
  workflow_id: string;
  analyzed_at: string;
  total_runs: number;
  total_failures: number;
  failure_rate_pct: number;
  error_clusters: ErrorCluster[];
  recommendations: string[];
}

class FailureAnalyzerImpl {
  async analyze(workflowId: string): Promise<FailureReport> {
    const report: FailureReport = {
      workflow_id: workflowId,
      analyzed_at: new Date().toISOString(),
      total_runs: 0,
      total_failures: 0,
      failure_rate_pct: 0,
      error_clusters: [],
      recommendations: [],
    };

    try {
      const { data: allRuns } = await supabase
        .from('workflow_runs')
        .select('id, status, error_log, started_at')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(100);

      if (!allRuns || allRuns.length === 0) return report;
      report.total_runs = allRuns.length;

      const failedRuns = allRuns.filter(r => r.status === 'failed');
      report.total_failures = failedRuns.length;
      report.failure_rate_pct = Math.round((failedRuns.length / allRuns.length) * 100);

      // Cluster errors by common substring patterns
      const clusterMap: Record<string, { runs: typeof failedRuns; first: string; last: string }> = {};

      for (const run of failedRuns) {
        const err = run.error_log ?? 'Unknown error';
        // Extract first 60 chars as the pattern key to group similar errors
        const pattern = err.slice(0, 80).replace(/[0-9a-f-]{8,}/gi, '<id>').trim();
        if (!clusterMap[pattern]) {
          clusterMap[pattern] = { runs: [], first: run.started_at, last: run.started_at };
        }
        clusterMap[pattern].runs.push(run);
        if (run.started_at < clusterMap[pattern].first) clusterMap[pattern].first = run.started_at;
        if (run.started_at > clusterMap[pattern].last) clusterMap[pattern].last = run.started_at;
      }

      report.error_clusters = Object.entries(clusterMap)
        .map(([pattern, { runs, first, last }]) => ({
          pattern,
          count: runs.length,
          example_run_ids: runs.slice(0, 3).map(r => r.id),
          first_seen: first,
          last_seen: last,
        }))
        .sort((a, b) => b.count - a.count);

      // Generate recommendations
      if (report.failure_rate_pct > 15) {
        report.recommendations.push(`High failure rate (${report.failure_rate_pct}%): This workflow fails significantly more than expected. Review provider health and input validation.`);
      }

      for (const cluster of report.error_clusters.slice(0, 3)) {
        if (cluster.pattern.toLowerCase().includes('timeout')) {
          report.recommendations.push(`Timeout errors cluster (${cluster.count}x): Check that Ollama is running and under 80% load. Consider increasing timeout limits.`);
        } else if (cluster.pattern.toLowerCase().includes('provider')) {
          report.recommendations.push(`Provider errors cluster (${cluster.count}x): The execution provider may be unavailable or misconfigured. Verify ProviderRegistry health.`);
        } else {
          report.recommendations.push(`Recurring error pattern (${cluster.count}x): "${cluster.pattern.slice(0, 60)}...". Add retry logic or input validation to this capability.`);
        }
      }
    } catch (err: any) {
      console.error('[FailureAnalyzer] analyze failed:', err.message);
    }

    return report;
  }
}

export const failureAnalyzer = new FailureAnalyzerImpl();
