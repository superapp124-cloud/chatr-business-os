/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Accounts (CRM.Accounts)
 */

import { ICapabilityManifest } from '../types';

export const CRMAccountsSDK: ICapabilityManifest = {
  id: 'CRM.Accounts',
  name: 'Accounts',
  description: 'Complete account management with company profiles, relationship mapping, and 360° account intelligence.',
  department: 'Sales',
  category: 'CRM & Sales',
  version: '2.0.0',
  maturity: 'L5',
  icon: '🏢',
  rating: 4.7,
  installs: 28900,
  tags: ["accounts","crm","companies","b2b"],

  objects: [
    {
      name: 'Account',
      pluralName: 'Accounts',
      icon: '🏢',
      titleField: 'Name',
      statusField: 'Status',
      fields: [
        {
                name: "Name",
                label: "Account Name",
                type: "string",
                required: true,
                searchable: true,
                sortable: true,
                width: "full"
        },
        {
                name: "Industry",
                label: "Industry",
                type: "enum",
                options: [
                        "Technology",
                        "Healthcare",
                        "Finance",
                        "Retail",
                        "Manufacturing",
                        "Other"
                ],
                filterable: true,
                width: "half"
        },
        {
                name: "Size",
                label: "Company Size",
                type: "enum",
                options: [
                        "1-10",
                        "11-50",
                        "51-200",
                        "201-1000",
                        "1000+"
                ],
                filterable: true,
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Prospect",
                        "Customer",
                        "Partner",
                        "Inactive"
                ],
                defaultValue: "Prospect",
                filterable: true,
                width: "half"
        },
        {
                name: "Owner",
                label: "Account Owner",
                type: "user",
                required: true,
                filterable: true,
                width: "half"
        },
        {
                name: "AnnualRevenue",
                label: "Annual Revenue ($)",
                type: "number",
                sortable: true,
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    }
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'account', label: 'Accounts', icon: '🏢', type: 'grid', object: 'Account' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Accounts AI',
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
        key: "account_enrichment",
        label: "Auto-Enrich from LinkedIn",
        type: "boolean",
        defaultValue: true,
        group: "Enrichment"
    }
],
  integrations: [],
  seed: { objects: [] }
};
