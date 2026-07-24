import { supabase } from '@/integrations/supabase/client';

export interface BottleneckNode {
  node_id: string;
  avg_ms: number;
  p80_ms: number;
  p95_ms: number;
  percentage_of_total: number;
}

export interface PerformanceReport {
  workflow_id: string;
  analyzed_at: string;
  total_runs: number;
  avg_duration_ms: number;
  bottleneck_nodes: BottleneckNode[];
  recommendations: string[];
}

class PerformanceAnalyzerImpl {
  async analyze(workflowId: string): Promise<PerformanceReport> {
    const report: PerformanceReport = {
      workflow_id: workflowId,
      analyzed_at: new Date().toISOString(),
      total_runs: 0,
      avg_duration_ms: 0,
      bottleneck_nodes: [],
      recommendations: [],
    };

    try {
      const { data: runs } = await supabase
        .from('workflow_runs')
        .select('duration_ms, node_durations')
        .eq('workflow_id', workflowId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(50);

      if (!runs || runs.length === 0) return report;
      report.total_runs = runs.length;

      const totalDurations = runs.map(r => r.duration_ms ?? 0).filter(d => d > 0);
      report.avg_duration_ms = totalDurations.length
        ? Math.round(totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length)
        : 0;

      // Aggregate per-node durations across all runs
      const nodeData: Record<string, number[]> = {};
      for (const run of runs) {
        const nd = run.node_durations as Record<string, number> | null;
        if (!nd) continue;
        for (const [nodeId, ms] of Object.entries(nd)) {
          if (!nodeData[nodeId]) nodeData[nodeId] = [];
          nodeData[nodeId].push(ms);
        }
      }

      const percentile = (arr: number[], p: number) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, idx)];
      };

      for (const [nodeId, durations] of Object.entries(nodeData)) {
        const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        const p80 = Math.round(percentile(durations, 80));
        const p95 = Math.round(percentile(durations, 95));
        const pct = report.avg_duration_ms > 0 ? Math.round((avg / report.avg_duration_ms) * 100) : 0;

        report.bottleneck_nodes.push({ node_id: nodeId, avg_ms: avg, p80_ms: p80, p95_ms: p95, percentage_of_total: pct });
      }

      report.bottleneck_nodes.sort((a, b) => b.percentage_of_total - a.percentage_of_total);

      // Generate plain-English recommendations
      for (const node of report.bottleneck_nodes) {
        if (node.percentage_of_total >= 50) {
          report.recommendations.push(`Node '${node.node_id}' accounts for ${node.percentage_of_total}% of total runtime (avg ${node.avg_ms}ms). Consider batching or parallelizing this step.`);
        }
        if (node.p95_ms > node.p80_ms * 3) {
          report.recommendations.push(`Node '${node.node_id}' has high latency variance (p80: ${node.p80_ms}ms, p95: ${node.p95_ms}ms). Check for intermittent provider timeouts.`);
        }
      }
    } catch (err: any) {
      console.error('[PerformanceAnalyzer] analyze failed:', err.message);
    }

    return report;
  }
}

export const performanceAnalyzer = new PerformanceAnalyzerImpl();
