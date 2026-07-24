import { ICapabilityWorkflow } from '../../../../types.js';

export const workflow: ICapabilityWorkflow = {
  id: 'System.SendNotification',
  version: '1.0.0',
  plan: {
    id: 'System.SendNotification.Plan',
    steps: [
      {
        id: 'step_1',
        idempotencyKey: 'system_notify_provider',
        action: 'Provider.Send', // Mock action for external provider
        component: 'NotificationProvider',
        payload: { type: 'email' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3, // Validates retry
        timeoutMs: 10000 
      },
      {
        id: 'step_2',
        idempotencyKey: 'system_notify_publish',
        action: 'Publish',
        component: 'EventBus',
        payload: { eventType: 'NotificationSent' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 2000
      }
    ]
  }
};

export default workflow;
