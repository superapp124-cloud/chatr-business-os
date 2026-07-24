import { emitWorkflowUIEvent, buildWorkflowId, buildWidgetId } from '@/core/workflow-ui';
import { kernelBus } from '@/kernel/core/EventBus';

export async function triggerWeatherWorkflow(conversationId: string, parameters: { location: string }) {
  const workflowId = buildWorkflowId(conversationId, 'weather.current');

  // The Kernel Scheduler manages the UI Session lifecycle automatically based on IntentSubmitted.

  // Submit Intent to Kernel Execution Fabric
  await kernelBus.publish({
    eventId: `ui_req_${Date.now()}`,
    type: 'IntentSubmitted',
    timestamp: Date.now(),
    sourceService: 'UI',
    authority: 'User.Local',
    payload: { 
      intentId: workflowId,
      input: parameters.location,
      capability: 'weather.current',
      parameters: parameters,
    },
    version: '1.0'
  });

  return workflowId;
}
