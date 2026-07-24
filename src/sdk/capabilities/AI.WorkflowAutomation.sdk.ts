/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Workflow Automation (AI.WorkflowAutomation)
 */

import { ICapabilityManifest } from '../types';

export const AIWorkflowAutomationSDK: ICapabilityManifest = {
  id: 'AI.WorkflowAutomation',
  name: 'Workflow Automation',
  description: 'No-code automation builder with triggers, conditions, and actions across all installed capabilities.',
  department: 'Enterprise Platform',
  category: 'AI & Automation',
  version: '1.5.0',
  maturity: 'L4',
  icon: '⚡',
  rating: 4.8,
  installs: 19800,
  tags: ["automation","workflow","no-code","triggers"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Workflow Automation AI',
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
  settings: [],
  integrations: [],
  seed: { objects: [] }
};
