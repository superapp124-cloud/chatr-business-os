/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Social Publishing (Marketing.SocialPublishing)
 */

import { ICapabilityManifest } from '../types';

export const MarketingSocialPublishingSDK: ICapabilityManifest = {
  id: 'Marketing.SocialPublishing',
  name: 'Social Publishing',
  description: 'Schedule and publish content across LinkedIn, Twitter/X, Instagram, and Facebook with unified analytics.',
  department: 'Marketing',
  category: 'Marketing',
  version: '1.4.0',
  maturity: 'L3',
  icon: '📱',
  rating: 4.4,
  installs: 11200,
  tags: ["social","content","scheduling","publishing"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Social Publishing AI',
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
