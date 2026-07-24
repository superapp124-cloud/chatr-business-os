import { WorkflowCapabilityContract, WorkflowManifest, WorkflowContext, buildWorkflowId } from '@/core/workflow-ui';
import { BrowserAutomationProvider } from '@/core/providers/BrowserAutomationProvider';

export class TravelWorkflow implements WorkflowCapabilityContract {
  readonly manifest: WorkflowManifest = {
    id: 'TRAVEL_WORKFLOW',
    version: '1.0',
    name: 'Travel',
    description: 'Flights, Hotels, Bus, Train',
    widgets: ['progress', 'selection', 'confirmation', 'tracking', 'execution_console', 'timeline'],
    permissions: ['LOCATION', 'PAYMENTS'],
    resumable: true, timeout: 300_000, cancellable: true, supportsNestedWorkflows: false, estimatedSteps: 5,
  };

  private workflowId = '';

  async initialize(context: WorkflowContext): Promise<void> {
    this.workflowId = buildWorkflowId(context.conversationId, 'travel');
  }

  async execute(context: WorkflowContext): Promise<void> {
    await BrowserAutomationProvider.execute(this.workflowId, context, {
      targetDomain: 'Travel Provider',
      expectedResultType: 'selection'
    });
  }

  async pause() {}
  async resume() {}
  async cancel() {}
  async rollback() {}
  async complete() {}
}
