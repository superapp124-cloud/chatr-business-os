import { ICapabilityWorkflow } from '../../../../types.js';

export const workflow: ICapabilityWorkflow = {
  id: 'Support.EscalateTicket',
  version: '1.0.0',
  plan: {
    id: 'Support.EscalateTicket.Plan',
    steps: [
      {
        id: 'step_1',
        idempotencyKey: 'support_escalate_ticket_db',
        action: 'Database.Update',
        component: 'BusinessObjectRepository',
        payload: { type: 'Support.Ticket', priority: 'High', status: 'Escalated' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 5000
      },
      {
        id: 'step_2',
        idempotencyKey: 'support_escalate_ticket_publish',
        action: 'Publish',
        component: 'EventBus',
        payload: { eventType: 'TicketEscalated' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 2000
      }
    ]
  }
};

export default workflow;
