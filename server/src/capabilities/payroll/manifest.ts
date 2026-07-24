import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'HR.Payroll',
  name: 'Payroll Engine',
  description: 'Automated payroll processing with tax calculations, payslip generation, and compliance reporting.',
  department: 'HR',
  category: 'HR & People',
  version: '1.0.0',
  maturity: 'L4',
  icon: '💵',
  rating: 4.5,
  installs: 6200,
  verbs: ['process', 'generate', 'approve', 'export'],
  nouns: ['payroll', 'salary', 'payslip', 'tax', 'deduction'],
  permissions: ['hr.payroll.process', 'hr.payroll.view'],
  eventsProduced: ['PayrollProcessed', 'PayslipGenerated'],
  eventsConsumed: [],
  dependencies: ['HR.Attendance'],
  search: ['employee', 'period', 'amount', 'status'],
  configSchema: [
    { key: 'pay_cycle', label: 'Pay Cycle', type: 'select', defaultValue: 'Monthly', options: ['Weekly', 'Bi-weekly', 'Monthly'], group: 'Schedule' },
    { key: 'tax_regime', label: 'Tax Regime', type: 'select', defaultValue: 'Standard', options: ['Standard', 'New', 'Flat Rate'], group: 'Tax' },
    { key: 'include_allowances', label: 'Include Allowances', type: 'boolean', defaultValue: true, group: 'Components' },
    { key: 'auto_pf', label: 'Auto-calculate PF', type: 'boolean', defaultValue: true, group: 'Compliance' },
  ],
  tags: ['hr', 'payroll', 'salary', 'compliance'],
};
export default manifest;
