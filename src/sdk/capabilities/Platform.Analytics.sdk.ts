/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Business Analytics (Platform.Analytics)
 */

import { ICapabilityManifest } from '../types';

export const PlatformAnalyticsSDK: ICapabilityManifest = {
  id: 'Platform.Analytics',
  name: 'Business Analytics',
  description: 'Cross-capability analytics dashboard with custom metrics, data exploration, and scheduled reports.',
  department: 'Enterprise Platform',
  category: 'Enterprise Platform',
  version: '1.8.0',
  maturity: 'L4',
  icon: '📊',
  rating: 4.7,
  installs: 24500,
  tags: ["analytics","reporting","dashboard","bi"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Business Analytics AI',
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
