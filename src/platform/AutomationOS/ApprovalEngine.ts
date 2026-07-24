import { supabase } from '@/integrations/supabase/client';

export interface ApprovalRequest {
  run_id: string;
  workflow_id: string;
  node_id: string;
  correlation_id: string;
  routing_type: 'single' | 'multi_step' | 'parallel' | 'majority' | 'role_based' | 'escalation';
  assigned_to: string[]; // User IDs or role names
  required_approvers?: number;
  sla_hours?: number;
  escalation_target?: string;
  tenant_id?: string;
}

export type ApprovalResolution = 'approved' | 'rejected' | 'overridden';

class ApprovalEngineImpl {
  /**
   * Creates a new approval gate. Suspends the workflow_run until resolved.
   */
  async requestApproval(request: ApprovalRequest): Promise<string | null> {
    try {
      const sla_deadline = request.sla_hours
        ? new Date(Date.now() + request.sla_hours * 3_600_000).toISOString()
        : null;

      const { data, error } = await supabase
        .from('workflow_approvals')
        .insert({
          run_id: request.run_id,
          workflow_id: request.workflow_id,
          node_id: request.node_id,
          correlation_id: request.correlation_id,
          routing_type: request.routing_type,
          assigned_to: request.assigned_to,
          required_approvers: request.required_approvers ?? 1,
          sla_deadline,
          escalation_target: request.escalation_target ?? null,
          tenant_id: request.tenant_id ?? null,
          status: 'pending'
        })
        .select('id')
        .single();

      if (error) throw error;

      // Suspend the workflow run
      await supabase
        .from('workflow_runs')
        .update({ status: 'waiting_approval' })
        .eq('id', request.run_id);

      return data.id;
    } catch (err: any) {
      console.error('[ApprovalEngine] requestApproval failed:', err.message);
      return null;
    }
  }

  /**
   * Resolves an approval. If approved, resumes the suspended workflow_run.
   */
  async resolve(
    approvalId: string,
    resolution: ApprovalResolution,
    actorId: string,
    comment?: string
  ): Promise<void> {
    try {
      const { data: approval, error } = await supabase
        .from('workflow_approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (error || !approval) throw new Error('Approval not found');

      // Append to history
      const history = approval.approval_history ?? [];
      history.push({
        actor: actorId,
        action: resolution,
        comment: comment ?? null,
        timestamp: new Date().toISOString()
      });

      await supabase
        .from('workflow_approvals')
        .update({
          status: resolution,
          resolved_by: actorId,
          resolved_at: new Date().toISOString(),
          resolution_comment: comment ?? null,
          approval_history: history
        })
        .eq('id', approvalId);

      // Resume or cancel the workflow run
      await supabase
        .from('workflow_runs')
        .update({
          status: resolution === 'approved' || resolution === 'overridden' ? 'running' : 'cancelled'
        })
        .eq('id', approval.run_id);

    } catch (err: any) {
      console.error('[ApprovalEngine] resolve failed:', err.message);
    }
  }

  /**
   * Escalates expired SLA approvals — intended to be called by a Scheduler job.
   */
  async processSlaExpirations(): Promise<void> {
    try {
      const { data: expired } = await supabase
        .from('workflow_approvals')
        .select('*')
        .eq('status', 'pending')
        .lt('sla_deadline', new Date().toISOString());

      if (!expired || expired.length === 0) return;

      for (const approval of expired) {
        if (approval.escalation_target) {
          // Escalate
          await supabase
            .from('workflow_approvals')
            .update({
              status: 'escalated',
              delegated_to: approval.escalation_target
            })
            .eq('id', approval.id);
        } else {
          // Auto-reject
          await this.resolve(approval.id, 'rejected', 'system', 'Auto-rejected: SLA expired');
        }
      }
    } catch (err: any) {
      console.error('[ApprovalEngine] processSlaExpirations failed:', err.message);
    }
  }
}

export const ApprovalEngine = new ApprovalEngineImpl();
