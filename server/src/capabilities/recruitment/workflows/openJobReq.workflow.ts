import { ICapabilityWorkflow } from '../../../../types.js';

export const workflow: ICapabilityWorkflow = {
  id: 'Recruitment.OpenJobReq',
  version: '1.0.0',
  plan: {
    id: 'Recruitment.OpenJobReq.Plan',
    steps: [
      {
        id: 'step_1',
        idempotencyKey: 'hr_open_job_db',
        action: 'Database.Insert',
        component: 'BusinessObjectRepository',
        payload: { type: 'Recruitment.JobReq' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 5000
      },
      {
        id: 'step_2',
        idempotencyKey: 'hr_open_job_publish',
        action: 'Publish',
        component: 'EventBus',
        payload: { eventType: 'JobReqOpened' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 2000
      }
    ]
  }
};

export default workflow;
