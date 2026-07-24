/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Announcements (Communication.Announcements)
 */

import { ICapabilityManifest } from '../types';

export const CommunicationAnnouncementsSDK: ICapabilityManifest = {
  id: 'Communication.Announcements',
  name: 'Announcements',
  description: 'Company-wide announcements with targeted segments, read receipts, and multi-channel delivery.',
  department: 'Communication',
  category: 'Communication',
  version: '1.2.0',
  maturity: 'L3',
  icon: '📢',
  rating: 4.4,
  installs: 8900,
  tags: ["announcements","internal-comms","notifications"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Announcements AI',
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
