/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Budgeting (Finance.Budgeting)
 */

import { ICapabilityManifest } from '../types';

export const FinanceBudgetingSDK: ICapabilityManifest = {
  id: 'Finance.Budgeting',
  name: 'Budgeting',
  description: 'Department budget management with allocation tracking, variance analysis, and real-time spend visibility.',
  department: 'Finance',
  category: 'Finance',
  version: '1.4.0',
  maturity: 'L4',
  icon: '💰',
  rating: 4.5,
  installs: 9200,
  tags: ["budget","finance","spend","allocation"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Budgeting AI',
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
        key: "fiscal_year",
        label: "Fiscal Year",
        type: "select",
        defaultValue: "Calendar",
        options: [
            "Calendar",
            "April-March",
            "July-June"
        ],
        group: "Finance"
    }
],
  integrations: [],
  seed: { objects: [] }
};
