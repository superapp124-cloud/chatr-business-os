import { ICapabilityWorkflow } from '../../../../types.js';

export const workflow: ICapabilityWorkflow = {
  id: 'Sales.QualifyLead',
  version: '1.0.0',
  plan: {
    id: 'Sales.QualifyLead.Plan',
    steps: [
      {
        id: 'step_1',
        idempotencyKey: 'sales_qualify_lead_db',
        action: 'Database.Update',
        component: 'BusinessObjectRepository',
        payload: { type: 'Sales.Lead', status: 'Qualified' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 5000
      },
      {
        id: 'step_2',
        idempotencyKey: 'sales_qualify_lead_publish',
        action: 'Publish',
        component: 'EventBus',
        payload: { eventType: 'LeadQualified' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 2000
      }
    ]
  }
};

export default workflow;
