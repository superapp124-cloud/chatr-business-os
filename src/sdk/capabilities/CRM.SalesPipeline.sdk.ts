/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Sales Pipeline (CRM.SalesPipeline)
 */

import { ICapabilityManifest } from '../types';

export const CRMSalesPipelineSDK: ICapabilityManifest = {
  id: 'CRM.SalesPipeline',
  name: 'Sales Pipeline',
  description: 'Visual pipeline management with drag-and-drop Kanban, velocity tracking, and bottleneck analysis.',
  department: 'Sales',
  category: 'CRM & Sales',
  version: '1.9.0',
  maturity: 'L5',
  icon: '🚀',
  rating: 4.9,
  installs: 29800,
  tags: ["pipeline","kanban","sales"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Sales Pipeline AI',
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
        key: "pipeline_view",
        label: "Default View",
        type: "select",
        defaultValue: "Kanban",
        options: [
            "Kanban",
            "List",
            "Forecast"
        ],
        group: "Display"
    }
],
  integrations: [],
  seed: { objects: [] }
};
