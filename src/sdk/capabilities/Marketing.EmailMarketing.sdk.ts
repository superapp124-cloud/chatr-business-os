/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Email Marketing (Marketing.EmailMarketing)
 */

import { ICapabilityManifest } from '../types';

export const MarketingEmailMarketingSDK: ICapabilityManifest = {
  id: 'Marketing.EmailMarketing',
  name: 'Email Marketing',
  description: 'Drag-and-drop email builder, segmentation engine, A/B testing, and deliverability analytics.',
  department: 'Marketing',
  category: 'Marketing',
  version: '1.6.0',
  maturity: 'L4',
  icon: '📧',
  rating: 4.5,
  installs: 18700,
  tags: ["email","marketing","campaigns","ab-testing"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Email Marketing AI',
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
        key: "from_name",
        label: "Sender Name",
        type: "text",
        defaultValue: "Your Company",
        group: "Sender"
    },
    {
        key: "from_email",
        label: "From Email",
        type: "email",
        defaultValue: "hello@company.com",
        group: "Sender"
    }
],
  integrations: [],
  seed: { objects: [] }
};
