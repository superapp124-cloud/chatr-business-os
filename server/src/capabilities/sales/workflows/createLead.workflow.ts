import { ICapabilityWorkflow } from '../../../../types.js';

export const workflow: ICapabilityWorkflow = {
  id: 'Sales.CreateLead',
  version: '1.0.0',
  plan: {
    id: 'Sales.CreateLead.Plan',
    steps: [
      {
        id: 'step_1',
        idempotencyKey: 'sales_create_lead_db',
        action: 'Database.Insert',
        component: 'BusinessObjectRepository',
        payload: { type: 'Sales.Lead' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 5000
      },
      {
        id: 'step_2',
        idempotencyKey: 'sales_create_lead_publish',
        action: 'Publish',
        component: 'EventBus',
        payload: { eventType: 'LeadCreated' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 2000
      }
    ]
  }
};

export default workflow;
