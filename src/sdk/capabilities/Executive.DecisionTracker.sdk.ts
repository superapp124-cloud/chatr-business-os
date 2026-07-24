/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Decision Tracker (Executive.DecisionTracker)
 */

import { ICapabilityManifest } from '../types';

export const ExecutiveDecisionTrackerSDK: ICapabilityManifest = {
  id: 'Executive.DecisionTracker',
  name: 'Decision Tracker',
  description: 'Capture, log, and track strategic decisions with full audit trail, decision rationale, and outcome measurement.',
  department: 'Executive Office',
  category: 'Executive & Strategy',
  version: '1.1.0',
  maturity: 'L3',
  icon: '⚖️',
  rating: 4.5,
  installs: 4100,
  tags: ["decisions","governance","audit"],

  objects: [
    {
      name: 'Decision',
      pluralName: 'Decisions',
      icon: '⚖️',
      titleField: 'Title',
      statusField: 'Status',
      fields: [
        {
                name: "Title",
                label: "Decision",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Rationale",
                label: "Rationale",
                type: "string",
                width: "full"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Proposed",
                        "Approved",
                        "Rejected",
                        "Reversed"
                ],
                defaultValue: "Proposed",
                filterable: true,
                width: "half"
        },
        {
                name: "DecisionDate",
                label: "Decision Date",
                type: "date",
                sortable: true,
                width: "half"
        },
        {
                name: "Owner",
                label: "Decision Maker",
                type: "user",
                required: true,
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    }
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'decision', label: 'Decisions', icon: '⚖️', type: 'grid', object: 'Decision' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Decision Tracker AI',
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
