import { eventBus } from '@/core/runtime/EventBus';
import {
  emitWorkflowUIEvent,
  buildWorkflowId,
  buildWidgetId,
  WorkflowCapabilityContract,
  WorkflowContext,
  WorkflowManifest,
  ApprovalWidgetPayload,
  ResultWidgetPayload,
  WidgetAction,
} from '@/core/workflow-ui';
import type { ExecutionConsoleWidgetPayload, ExecutionPhase } from '@/core/workflow-ui/types';

// ─── Manifest ─────────────────────────────────────────────────────────────────

const ENTERPRISE_APPROVAL_MANIFEST: WorkflowManifest = {
  id: 'ENTERPRISE_APPROVAL',
  version: '1.0',
  name: 'IT Access Provisioning',
  description: 'Enterprise IAM policy check, multi-level approval, and automated provisioning.',
  widgets: ['approval', 'result', 'execution_console', 'timeline'],
  permissions: ['IAM', 'AUDIT_LOG'],
  resumable: true,
  timeout: 300_000,
  cancellable: true,
  supportsNestedWorkflows: false,
  estimatedSteps: 5,
};

// ─── EnterpriseApprovalWorkflow ───────────────────────────────────────────────

export class EnterpriseApprovalWorkflow implements WorkflowCapabilityContract {
  readonly manifest = ENTERPRISE_APPROVAL_MANIFEST;

  private workflowId = '';
  private executionConsoleWidgetId = '';
  private timelineWidgetId = '';
  private approvalWidgetId = '';
  private resultWidgetId = '';
  private widgetIndex = 0;
  private unsubscribeFn?: () => void;
  private phaseStartTimes: Record<string, number> = {};
  
  // State
  private targetResource = '';

  async initialize(context: WorkflowContext): Promise<void> {
    this.workflowId = buildWorkflowId(context.conversationId, 'enterprise-approval');
    this.targetResource = (context.entities?.resource as string) || 'Production Database';

    emitWorkflowUIEvent({
      event: 'WORKFLOW_STARTED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'CREATED',
      payload: { manifest: this.manifest },
    });

    // ── Execution Console ──
    this.executionConsoleWidgetId = buildWidgetId(this.workflowId, 'execution_console', this.widgetIndex++);
    const initialConsolePayload: ExecutionConsoleWidgetPayload = {
      aiMode: 'local',
      expanded: false,
      phases: this.executionPhases,
    };
    
    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.executionConsoleWidgetId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: initialConsolePayload,
    });

    // ── Timeline Widget ──
    this.timelineWidgetId = buildWidgetId(this.workflowId, 'timeline', this.widgetIndex++);
    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.timelineWidgetId,
      widgetType: 'timeline',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { title: 'Audit Trail', entries: [] },
    });

    this.unsubscribeFn = eventBus.on<WidgetAction>(
      'ENTERPRISE_APPROVAL.WIDGET_ACTION',
      (kernelEvent) => this.handleWidgetAction(kernelEvent.payload)
    );
  }

  async execute(context: WorkflowContext): Promise<void> {
    try {
      // 1. Intent Understood
      await this.updateExecutionPhase('intent', 'running');
      await this.delay(800);
      await this.updateExecutionPhase('intent', 'completed', `Identified request for ${this.targetResource} access`);
      
      // 2. Policy Check
      await this.updateExecutionPhase('policy_check', 'running');
      await this.delay(1500);
      await this.updateExecutionPhase('policy_check', 'completed', `IAM Rule 402: Requires Manager Approval (High Risk)`);

      // 3. Approval Gate
      await this.updateExecutionPhase('approval', 'running');
      await this.showApprovalWidget();

      // Auto-approve after a delay to simulate a manager acting in another chat
      this.simulateManagerApproval();
    } catch (err) {
      console.error('[EnterpriseApprovalWorkflow] Error in execute:', err);
    }
  }

  private async simulateManagerApproval(): Promise<void> {
    try {
      await this.delay(3500);
      console.log('[EnterpriseApprovalWorkflow] simulateManagerApproval running after 3.5s');

      emitWorkflowUIEvent({
        event: 'WIDGET_UPDATED',
        workflowId: this.workflowId,
        widgetId: this.approvalWidgetId,
        widgetType: 'approval',
        widgetVersion: '1.0',
        lifecycle: 'COMPLETED',
        payload: { 
          title: 'Manager Approved',
          description: 'Sarah Jenkins approved this request at ' + new Date().toLocaleTimeString(),
        },
      });

      await this.updateExecutionPhase('approval', 'completed', 'Approved by Sarah Jenkins (Manager)');
      await this.proceedToProvisioning();
    } catch (err) {
      console.error('[EnterpriseApprovalWorkflow] Error in simulateManagerApproval:', err);
    }
  }

  private async handleWidgetAction(action: WidgetAction): Promise<void> {
    console.log('[EnterpriseApprovalWorkflow] handleWidgetAction received:', action);
    if (action.workflowId !== this.workflowId) {
      console.log('[EnterpriseApprovalWorkflow] workflowId mismatch. Expected', this.workflowId, 'got', action.workflowId);
      return;
    }

    try {
      if (action.action === 'APPROVE' && action.widgetId === this.approvalWidgetId) {
        console.log('[EnterpriseApprovalWorkflow] Processing APPROVE action');
        emitWorkflowUIEvent({
          event: 'WIDGET_UPDATED',
          workflowId: this.workflowId,
          widgetId: this.approvalWidgetId,
          widgetType: 'approval',
          widgetVersion: '1.0',
          lifecycle: 'COMPLETED',
          payload: { 
            title: 'Manual Override Approved',
            description: 'You bypassed the manager approval.',
          },
        });

        await this.updateExecutionPhase('approval', 'completed', 'Manual Override Admin Approval');
        await this.proceedToProvisioning();
      }

      if (action.action === 'REJECT') {
        console.log('[EnterpriseApprovalWorkflow] Processing REJECT action');
        emitWorkflowUIEvent({
          event: 'WIDGET_UPDATED',
          workflowId: this.workflowId,
          widgetId: this.approvalWidgetId,
          widgetType: 'approval',
          widgetVersion: '1.0',
          lifecycle: 'COMPLETED',
          payload: { 
            title: 'Request Rejected',
            description: 'You rejected the access request.',
          },
        });

        await this.updateExecutionPhase('approval', 'failed', 'Rejected by Admin');
        this.complete();
      }
    } catch (err) {
      console.error('[EnterpriseApprovalWorkflow] Error in handleWidgetAction:', err);
    }
  }

  private async proceedToProvisioning(): Promise<void> {
    // 4. Provisioning
    await this.updateExecutionPhase('provisioning', 'running');
    await this.delay(2000); // Simulate API call to IAM / DB Vault
    await this.updateExecutionPhase('provisioning', 'completed', 'Temporary credentials generated');

    // 5. Audit
    await this.updateExecutionPhase('audit', 'running');
    await this.delay(500);
    await this.updateExecutionPhase('audit', 'completed', 'Logged to Enterprise SIEM (Log ID: SEC-9942)');

    this.showResultWidget();
    this.complete();
  }

  private async showApprovalWidget(): Promise<void> {
    this.approvalWidgetId = buildWidgetId(this.workflowId, 'approval', this.widgetIndex++);
    const payload: ApprovalWidgetPayload = {
      title: 'Manager Approval Required',
      description: `Requesting elevated access to: ${this.targetResource}`,
      riskLevel: 'high',
      details: [
        { label: 'Requestor', value: 'Current User' },
        { label: 'Role', value: 'Software Engineer' },
        { label: 'Environment', value: 'Production' },
        { label: 'Duration', value: '2 Hours (JIT)' },
      ],
      approver: 'Sarah Jenkins (Manager)'
    };

    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.approvalWidgetId,
      widgetType: 'approval',
      widgetVersion: '1.0',
      lifecycle: 'WAITING_USER',
      payload,
    });
  }

  private showResultWidget(): void {
    this.resultWidgetId = buildWidgetId(this.workflowId, 'result', this.widgetIndex++);
    
    const payload: ResultWidgetPayload = {
      title: 'Access Granted',
      subtitle: `You now have temporary access to ${this.targetResource}.`,
      status: 'success',
      details: [
        { label: 'Username', value: 'jit_user_8942' },
        { label: 'Password', value: '**********' },
        { label: 'Expires In', value: '1h 59m' },
        { label: 'Audit Log ID', value: 'SEC-9942' },
      ],
      actionLabel: 'Copy Credentials',
    };

    emitWorkflowUIEvent({
      event: 'WIDGET_CREATED',
      workflowId: this.workflowId,
      widgetId: this.resultWidgetId,
      widgetType: 'result',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload,
    });
  }

  // ─── Phase Tracking ───

  private executionPhases: ExecutionPhase[] = [
    { id: 'intent',       label: 'Intent Understood',  status: 'pending' },
    { id: 'policy_check', label: 'IAM Policy Check',   status: 'pending' },
    { id: 'approval',     label: 'Manager Approval',   status: 'pending' },
    { id: 'provisioning', label: 'JIT Provisioning',   status: 'pending' },
    { id: 'audit',        label: 'Security Audit Log', status: 'pending' },
  ];

  private async updateExecutionPhase(
    phaseId: string,
    status: 'running' | 'completed' | 'failed' | 'pending',
    detail?: string
  ): Promise<void> {
    if (status === 'running') {
      this.phaseStartTimes[phaseId] = Date.now();
    }
    
    let latencyMs: number | undefined;
    if (status === 'completed' || status === 'failed') {
      const start = this.phaseStartTimes[phaseId];
      if (start) {
        latencyMs = Date.now() - start;
      }
    }

    this.executionPhases = this.executionPhases.map(p => 
      p.id === phaseId ? { ...p, status, latencyMs, detail } : p
    );

    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: this.workflowId,
      widgetId: this.executionConsoleWidgetId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { phases: this.executionPhases },
    });
  }

  async pause(): Promise<void> {}
  async resume(): Promise<void> {}

  async cancel(): Promise<void> {
    this.cleanup();
    emitWorkflowUIEvent({
      event: 'WORKFLOW_CANCELLED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'CANCELLED',
      payload: {},
    });
  }

  async rollback(): Promise<void> {}

  async complete(): Promise<void> {
    this.cleanup();
    emitWorkflowUIEvent({
      event: 'WORKFLOW_COMPLETED',
      workflowId: this.workflowId,
      widgetId: this.workflowId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'COMPLETED',
      payload: {},
    });
  }

  private cleanup(): void {
    if (this.unsubscribeFn) this.unsubscribeFn();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export async function triggerEnterpriseApproval(conversationId: string, entities: Record<string, unknown> = {}): Promise<string> {
  const workflow = new EnterpriseApprovalWorkflow();
  const context: WorkflowContext = { conversationId, workflowId: '', intent: 'enterprise.access', entities };
  
  await workflow.initialize(context);
  workflow.execute(context).catch(console.error);
  
  return (workflow as any).workflowId;
}
