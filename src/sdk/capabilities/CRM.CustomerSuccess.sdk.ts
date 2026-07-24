/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Customer Success (CRM.CustomerSuccess)
 */

import { ICapabilityManifest } from '../types';

export const CRMCustomerSuccessSDK: ICapabilityManifest = {
  id: 'CRM.CustomerSuccess',
  name: 'Customer Success',
  description: 'Customer health scoring, churn prediction, expansion tracking, and CS playbook automation.',
  department: 'Sales',
  category: 'CRM & Sales',
  version: '1.4.0',
  maturity: 'L4',
  icon: '💚',
  rating: 4.7,
  installs: 9800,
  tags: ["customer-success","churn","nps","renewal"],

  objects: [
    {
      name: 'CustomerAccount',
      pluralName: 'Customer Accounts',
      icon: '💚',
      titleField: 'Name',
      statusField: '',
      fields: [
        {
                name: "Name",
                label: "Account Name",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "HealthScore",
                label: "Health Score",
                type: "number",
                displayFormat: "percentage",
                readonly: true,
                width: "half"
        },
        {
                name: "ARR",
                label: "ARR ($)",
                type: "number",
                sortable: true,
                width: "half"
        },
        {
                name: "RenewalDate",
                label: "Renewal Date",
                type: "date",
                sortable: true,
                width: "half"
        },
        {
                name: "CSM",
                label: "Customer Success Manager",
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
    { id: 'customeraccount', label: 'Customer Accounts', icon: '💚', type: 'grid', object: 'CustomerAccount' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Customer Success AI',
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
        key: "health_score_method",
        label: "Health Score Method",
        type: "select",
        defaultValue: "Composite",
        options: [
            "Composite",
            "Usage-only",
            "NPS-only"
        ],
        group: "Scoring"
    }
],
  integrations: [],
  seed: { objects: [] }
};
