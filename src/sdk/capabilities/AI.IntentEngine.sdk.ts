/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Intent Engine (AI.IntentEngine)
 */

import { ICapabilityManifest } from '../types';

export const AIIntentEngineSDK: ICapabilityManifest = {
  id: 'AI.IntentEngine',
  name: 'Intent Engine',
  description: 'Natural language understanding engine that powers CHATR\'s universal command bar and intent resolution.',
  department: 'Enterprise Platform',
  category: 'AI & Automation',
  version: '3.0.0',
  maturity: 'L5',
  icon: '🧠',
  rating: 4.9,
  installs: 42100,
  tags: ["ai","nlp","intent","kernel"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Intent Engine AI',
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
        key: "confidence_threshold",
        label: "Min. Confidence Score",
        type: "number",
        defaultValue: 0.7,
        group: "Model"
    }
],
  integrations: [],
  seed: { objects: [] }
};
