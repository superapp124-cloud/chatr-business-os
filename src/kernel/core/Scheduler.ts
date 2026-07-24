import { kernelBus } from './EventBus';
import { kernel } from '../abi';
import { CapabilityId, Context, EntityId } from '../abi/v1';
import { emitWorkflowUIEvent, buildWidgetId } from '@/core/workflow-ui';

/**
 * KernelScheduler
 * Listens for policy-approved processes and allocates resources.
 */
export class KernelScheduler {
  constructor() {
    kernelBus.subscribe('process.policy_checked', this.handlePolicyChecked.bind(this));
  }

  private async handlePolicyChecked(event: any): Promise<void> {
    const { processId, intentId, targetCapability, providerEntity } = event.payload;
    const authority = event.authority || 'system';

    const consoleId = buildWidgetId(intentId, 'execution_console', 0);
    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: intentId,
      widgetId: consoleId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { phaseUpdate: { id: 'allocation', status: 'running', message: 'Allocating resources...' } },
    });

    // In a real system, the Scheduler tracks user quota and deducts resources here.
    // For now, we instantly approve the allocation.
    
    // Resource allocation successful
    emitWorkflowUIEvent({
      event: 'WIDGET_UPDATED',
      workflowId: intentId,
      widgetId: consoleId,
      widgetType: 'execution_console',
      widgetVersion: '1.0',
      lifecycle: 'ACTIVE',
      payload: { phaseUpdate: { id: 'allocation', status: 'completed', message: 'Resources allocated' } },
    });

    // 2. Emit process.resources_allocated
    await kernelBus.publish({
      eventId: `evt_${Date.now()}`,
      type: 'process.resources_allocated',
      timestamp: Date.now(),
      sourceService: 'KernelScheduler',
      authority,
      payload: { processId, intentId, targetCapability, providerEntity },
      version: '1.0'
    });
  }
}

export const kernelScheduler = new KernelScheduler();
