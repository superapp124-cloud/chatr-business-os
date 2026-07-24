import { ICapabilityWorkflow } from '../../../../types.js';

export const workflow: ICapabilityWorkflow = {
  id: 'Finance.SubmitExpense',
  version: '1.0.0',
  plan: {
    id: 'Finance.SubmitExpense.Plan',
    steps: [
      {
        id: 'step_1',
        idempotencyKey: 'finance_submit_expense_db',
        action: 'Database.Insert',
        component: 'BusinessObjectRepository',
        payload: { type: 'Finance.Expense' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 5000
      },
      {
        id: 'step_2',
        idempotencyKey: 'finance_submit_expense_approval',
        action: 'Approval.Request',
        component: 'ApprovalEngine',
        payload: { role: 'Manager' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 1,
        timeoutMs: 86400000 // 24 hours
      },
      {
        id: 'step_3',
        idempotencyKey: 'finance_submit_expense_publish',
        action: 'Publish',
        component: 'EventBus',
        payload: { eventType: 'ExpenseSubmitted' },
        status: 'Pending',
        retryCount: 0,
        maxAttempts: 3,
        timeoutMs: 2000
      }
    ]
  }
};

export default workflow;
