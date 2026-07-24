/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Strategic Planning (Executive.StrategicPlanning)
 */

import { ICapabilityManifest } from '../types';

export const ExecutiveStrategicPlanningSDK: ICapabilityManifest = {
  id: 'Executive.StrategicPlanning',
  name: 'Strategic Planning',
  description: 'Long-range planning workspace with SWOT analysis, scenario modeling, initiative roadmaps, and strategy-to-execution linkage.',
  department: 'Executive Office',
  category: 'Executive & Strategy',
  version: '1.2.0',
  maturity: 'L4',
  icon: '🗺️',
  rating: 4.7,
  installs: 5100,
  tags: ["strategy","planning","roadmap","scenarios"],

  objects: [
    {
      name: 'Initiative',
      pluralName: 'Initiatives',
      icon: '🚀',
      titleField: 'Name',
      statusField: 'Status',
      fields: [
        {
                name: "Name",
                label: "Initiative Name",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Idea",
                        "Planning",
                        "Active",
                        "Completed",
                        "Cancelled"
                ],
                defaultValue: "Idea",
                filterable: true,
                width: "half"
        },
        {
                name: "Owner",
                label: "Owner",
                type: "user",
                width: "half"
        },
        {
                name: "StartDate",
                label: "Start Date",
                type: "date",
                width: "half"
        },
        {
                name: "EndDate",
                label: "End Date",
                type: "date",
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    }
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'initiative', label: 'Initiatives', icon: '🚀', type: 'grid', object: 'Initiative' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Strategic Planning AI',
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
        key: "planning_horizon",
        label: "Planning Horizon (years)",
        type: "number",
        defaultValue: 3,
        group: "Planning"
    },
    {
        key: "scenario_count",
        label: "Scenarios per Plan",
        type: "number",
        defaultValue: 3,
        group: "Planning"
    }
],
  integrations: [],
  seed: { objects: [] }
};
