import { ICapabilityWorkflow } from '../../../../types.js';

export const workflow: ICapabilityWorkflow = {
  id: 'Finance.ApproveExpense',
  version: '1.0.0',
  plan: {
    id: 'Finance.ApproveExpense.Plan',
    steps: [
      {
        id: 'step_1',
        idempotencyKey: 'finance_approve_expense_resolve',
        action: 'Approval.Resolve',
        component: 'ApprovalEngine',
        payload: { status: 'Approved' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 1,
        timeoutMs: 5000
      },
      {
        id: 'step_2',
        idempotencyKey: 'finance_approve_expense_publish',
        action: 'Publish',
        component: 'EventBus',
        payload: { eventType: 'ExpenseApproved' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 2000
      }
    ]
  }
};

export default workflow;
