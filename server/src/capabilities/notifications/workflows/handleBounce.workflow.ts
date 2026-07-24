import { ICapabilityWorkflow } from '../../../../types.js';

export const workflow: ICapabilityWorkflow = {
  id: 'System.HandleBounce',
  version: '1.0.0',
  plan: {
    id: 'System.HandleBounce.Plan',
    steps: [
      {
        id: 'step_1',
        idempotencyKey: 'system_bounce_deadletter',
        action: 'Database.Insert',
        component: 'BusinessObjectRepository',
        payload: { type: 'System.DeadLetter' }, // Validates dead-letter handling
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 5000
      },
      {
        id: 'step_2',
        idempotencyKey: 'system_bounce_publish',
        action: 'Publish',
        component: 'EventBus',
        payload: { eventType: 'NotificationBounced' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 2000
      }
    ]
  }
};

export default workflow;
