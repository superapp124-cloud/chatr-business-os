/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Performance Reviews (HR.PerformanceReviews)
 */

import { ICapabilityManifest } from '../types';

export const HRPerformanceReviewsSDK: ICapabilityManifest = {
  id: 'HR.PerformanceReviews',
  name: 'Performance Reviews',
  description: '360° performance reviews with goal alignment, calibration, rating normalization, and review cycle management.',
  department: 'Human Resources',
  category: 'Recruitment & HR',
  version: '1.5.0',
  maturity: 'L4',
  icon: '⭐',
  rating: 4.6,
  installs: 11200,
  tags: ["performance","reviews","360","hr"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Performance Reviews AI',
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
        key: "review_cycle",
        label: "Review Cycle",
        type: "select",
        defaultValue: "Annual",
        options: [
            "Monthly",
            "Quarterly",
            "Semi-Annual",
            "Annual"
        ],
        group: "Schedule"
    }
],
  integrations: [],
  seed: { objects: [] }
};
