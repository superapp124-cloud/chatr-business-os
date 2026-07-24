import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Finance.Expense',
  name: 'Expense Management',
  description: 'Employee expense tracking, approval workflows, reimbursement automation, and financial reporting.',
  department: 'Finance',
  category: 'Finance & Accounting',
  version: '1.0.0',
  maturity: 'L4',
  icon: '💰',
  rating: 4.6,
  installs: 9800,
  verbs: ['log', 'submit', 'approve', 'reject', 'reimburse'],
  nouns: ['expense', 'receipt', 'reimbursement', 'budget'],
  permissions: ['finance.expense.create', 'finance.expense.approve'],
  eventsProduced: ['ExpenseSubmitted', 'ExpenseApproved'],
  eventsConsumed: [],
  dependencies: [],
  search: ['title', 'amount', 'category', 'employee'],
  configSchema: [
    { key: 'approval_limit', label: 'Auto-Approval Limit ($)', type: 'number', defaultValue: 100, description: 'Expenses below this amount are auto-approved', group: 'Approvals' },
    { key: 'receipt_required', label: 'Receipt Required', type: 'boolean', defaultValue: true, description: 'Require receipt upload for all expenses', group: 'Policy' },
    { key: 'expense_categories', label: 'Expense Categories', type: 'multiselect', defaultValue: ['Travel', 'Meals', 'Software', 'Office Supplies', 'Training'], group: 'Categories' },
    { key: 'reimbursement_cycle', label: 'Reimbursement Cycle', type: 'select', defaultValue: 'Monthly', options: ['Weekly', 'Bi-weekly', 'Monthly'], group: 'Payroll' },
    { key: 'budget_alerts', label: 'Budget Alert Threshold (%)', type: 'number', defaultValue: 80, description: 'Alert when department budget reaches this %', group: 'Alerts' },
  ],
  tags: ['finance', 'expenses', 'reimbursement', 'accounting'],
};
export default manifest;
