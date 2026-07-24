import { ICapabilityWorkflow } from '../../../../types.js';

export const workflow: ICapabilityWorkflow = {
  id: 'Support.CreateTicket',
  version: '1.0.0',
  plan: {
    id: 'Support.CreateTicket.Plan',
    steps: [
      {
        id: 'step_1',
        idempotencyKey: 'support_create_ticket_db',
        action: 'Database.Insert',
        component: 'BusinessObjectRepository',
        payload: { type: 'Support.Ticket' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 5, // High retries to validate retry engine
        timeoutMs: 1000 // Tight deadline to validate timeout engine
      },
      {
        id: 'step_2',
        idempotencyKey: 'support_create_ticket_publish',
        action: 'Publish',
        component: 'EventBus',
        payload: { eventType: 'TicketCreated' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 2000
      }
    ]
  }
};

export default workflow;
