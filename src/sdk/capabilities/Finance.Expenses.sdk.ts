/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Expenses (Finance.Expenses)
 */

import { ICapabilityManifest } from '../types';

export const FinanceExpensesSDK: ICapabilityManifest = {
  id: 'Finance.Expenses',
  name: 'Expenses',
  description: 'Employee expense management with receipt OCR, policy enforcement, multi-currency support, and approval workflows.',
  department: 'Finance',
  category: 'Finance',
  version: '2.0.0',
  maturity: 'L5',
  icon: '💳',
  rating: 4.7,
  installs: 27300,
  tags: ["expenses","finance","receipts","reimbursement"],

  objects: [
    {
      name: 'ExpenseClaim',
      pluralName: 'Expense Claims',
      icon: '💳',
      titleField: 'Description',
      statusField: 'Status',
      fields: [
        {
                name: "Description",
                label: "Description",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Amount",
                label: "Amount ($)",
                type: "number",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "Category",
                label: "Category",
                type: "enum",
                options: [
                        "Travel",
                        "Meals",
                        "Equipment",
                        "Software",
                        "Training",
                        "Other"
                ],
                required: true,
                filterable: true,
                width: "half"
        },
        {
                name: "Date",
                label: "Date",
                type: "date",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Draft",
                        "Submitted",
                        "Approved",
                        "Rejected",
                        "Reimbursed"
                ],
                defaultValue: "Draft",
                filterable: true,
                width: "half"
        },
        {
                name: "Employee",
                label: "Employee",
                type: "user",
                required: true,
                filterable: true,
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    }
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'expenseclaim', label: 'Expense Claims', icon: '💳', type: 'grid', object: 'ExpenseClaim' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Expenses AI',
    skills: []
  },
  
  // ABI v1.0: Intelligence & Execution
  stateMachines: [],
  policies: [],
  agents: [],
  tools: [],
  workflows: [],
  automations: [],
  notifications: [],
  permissions: {},
  search: { objects: [] },
  settings: [
    {
        key: "max_claim_without_receipt",
        label: "Max Claim Without Receipt ($)",
        type: "number",
        defaultValue: 25,
        group: "Policy"
    },
    {
        key: "auto_approve_below",
        label: "Auto-Approve Below ($)",
        type: "number",
        defaultValue: 50,
        group: "Automation"
    }
],
  integrations: [],
  seed: { objects: [] }
};
