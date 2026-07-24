/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Employee Onboarding (HR.Onboarding)
 */

import { ICapabilityManifest } from '../types';

export const HROnboardingSDK: ICapabilityManifest = {
  id: 'HR.Onboarding',
  name: 'Employee Onboarding',
  description: 'Structured onboarding workflows with task checklists, document collection, equipment provisioning, and 30-60-90 day plans.',
  department: 'Human Resources',
  category: 'Recruitment & HR',
  version: '1.4.0',
  maturity: 'L4',
  icon: '🎉',
  rating: 4.7,
  installs: 13500,
  tags: ["onboarding","new-hire","hr"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Employee Onboarding AI',
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
