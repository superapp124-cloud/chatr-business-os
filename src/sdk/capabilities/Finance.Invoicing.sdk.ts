/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Invoicing (Finance.Invoicing)
 */

import { ICapabilityManifest } from '../types';

export const FinanceInvoicingSDK: ICapabilityManifest = {
  id: 'Finance.Invoicing',
  name: 'Invoicing',
  description: 'Professional invoicing with recurring billing, payment tracking, overdue reminders, and revenue recognition.',
  department: 'Finance',
  category: 'Finance',
  version: '1.8.0',
  maturity: 'L5',
  icon: '🧾',
  rating: 4.8,
  installs: 21400,
  tags: ["invoicing","billing","payments","revenue"],

  objects: [
    {
      name: 'Invoice',
      pluralName: 'Invoices',
      icon: '🧾',
      titleField: 'InvoiceNumber',
      statusField: 'Status',
      fields: [
        {
                name: "InvoiceNumber",
                label: "Invoice #",
                type: "string",
                required: true,
                searchable: true,
                readonly: true,
                width: "half"
        },
        {
                name: "Client",
                label: "Client",
                type: "reference",
                referenceTo: "Account",
                required: true,
                searchable: true,
                width: "half"
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
                name: "DueDate",
                label: "Due Date",
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
                        "Sent",
                        "Paid",
                        "Overdue",
                        "Cancelled"
                ],
                defaultValue: "Draft",
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
    { id: 'invoice', label: 'Invoices', icon: '🧾', type: 'grid', object: 'Invoice' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Invoicing AI',
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
        key: "payment_terms",
        label: "Default Payment Terms (days)",
        type: "number",
        defaultValue: 30,
        group: "Billing"
    },
    {
        key: "late_fee_percentage",
        label: "Late Fee (%)",
        type: "number",
        defaultValue: 1.5,
        group: "Policy"
    }
],
  integrations: [],
  seed: { objects: [] }
};
