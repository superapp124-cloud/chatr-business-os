/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Quotations (CRM.Quotations)
 */

import { ICapabilityManifest } from '../types';

export const CRMQuotationsSDK: ICapabilityManifest = {
  id: 'CRM.Quotations',
  name: 'Quotations',
  description: 'Professional quote builder with product catalog, pricing rules, approval workflows, and e-signature.',
  department: 'Sales',
  category: 'CRM & Sales',
  version: '1.5.0',
  maturity: 'L4',
  icon: '📋',
  rating: 4.6,
  installs: 12300,
  tags: ["quotes","proposals","pricing"],

  objects: [
    {
      name: 'Quote',
      pluralName: 'Quotes',
      icon: '📋',
      titleField: 'Title',
      statusField: 'Status',
      fields: [
        {
                name: "Title",
                label: "Quote Title",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Account",
                label: "Account",
                type: "reference",
                referenceTo: "Account",
                required: true,
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Draft",
                        "Sent",
                        "Accepted",
                        "Rejected",
                        "Expired"
                ],
                defaultValue: "Draft",
                filterable: true,
                width: "half"
        },
        {
                name: "Total",
                label: "Total Value ($)",
                type: "number",
                sortable: true,
                width: "half"
        },
        {
                name: "ValidUntil",
                label: "Valid Until",
                type: "date",
                sortable: true,
                width: "half"
        },
        {
                name: "Owner",
                label: "Created By",
                type: "user",
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
    { id: 'quote', label: 'Quotes', icon: '📋', type: 'grid', object: 'Quote' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Quotations AI',
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
        key: "approval_required",
        label: "Require Approval > $",
        type: "number",
        defaultValue: 10000,
        group: "Approvals"
    }
],
  integrations: [],
  seed: { objects: [] }
};
