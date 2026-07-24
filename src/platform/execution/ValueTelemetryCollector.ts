import { OSEvent } from '../contracts/os/EventLog.abi';
import { supabase } from '@/integrations/supabase/client';

export class ValueTelemetryCollector {
  /**
   * Projects core OS events into pure business value metrics.
   * This is entirely decoupled from the Reality Graph.
   */
  async collect(events: OSEvent[]): Promise<void> {
    for (const event of events) {
      if (event.type === 'goal.completed') {
        await this.recordTimeSaved(event);
      } else if (event.type === 'operator.feedback_submitted') {
        await this.recordTrustMetric(event);
      } else if (event.type === 'execution.intervention_requested') {
        await this.recordIntervention(event);
      }
    }
  }

  private async recordTimeSaved(event: OSEvent) {
    const goalId = event.payload.goalId;
    const executionMs = event.metadata.timestamp - event.payload.startedAt;
    
    // Baseline mapped via Workflow manifest or Goal configuration
    const baselineMs = event.payload.baselineManualSeconds * 1000;
    
    await supabase.from('value_metrics').insert({
      tenant_id: event.metadata.tenantId || 'SYSTEM',
      workflow_id: event.payload.workflowId || '00000000-0000-0000-0000-000000000000',
      goal_id: goalId,
      baseline_manual_seconds: Math.round(baselineMs / 1000),
      autonomous_execution_seconds: Math.round(executionMs / 1000),
      attention_clicks_saved: event.payload.estimatedClicksSaved || 0
    });
  }

  private async recordTrustMetric(event: OSEvent) {
    await supabase.from('operator_trust').insert({
      tenant_id: event.metadata.tenantId || 'SYSTEM',
      goal_id: event.payload.goalId,
      operator_id: event.metadata.actorId,
      trust_level: event.payload.trustLevel,
      feedback_notes: event.payload.notes
    });
  }

  private async recordIntervention(event: OSEvent) {
    await supabase.from('intervention_log').insert({
      tenant_id: event.metadata.tenantId || 'SYSTEM',
      goal_id: event.payload.goalId,
      intervention_type: event.payload.interventionType,
      resolution_time_seconds: event.payload.resolutionDurationMs / 1000
    });
  }
}
