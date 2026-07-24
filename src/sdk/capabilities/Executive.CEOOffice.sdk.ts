/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: CEO Office (Executive.CEOOffice)
 */

import { ICapabilityManifest } from '../types';

export const ExecutiveCEOOfficeSDK: ICapabilityManifest = {
  id: 'Executive.CEOOffice',
  name: 'CEO Office',
  description: 'Executive command center with board-ready dashboards, strategic KPIs, investor metrics, and direct-report management.',
  department: 'Executive Office',
  category: 'Executive & Strategy',
  version: '2.1.0',
  maturity: 'L5',
  icon: '👑',
  rating: 4.9,
  installs: 8200,
  tags: ["executive","ceo","strategy","board"],

  objects: [
    {
      name: 'KPI',
      pluralName: 'KPIs',
      icon: '📊',
      titleField: 'Name',
      statusField: 'Status',
      fields: [
        {
                name: "Name",
                label: "KPI Name",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Value",
                label: "Current Value",
                type: "number",
                required: true,
                width: "half"
        },
        {
                name: "Target",
                label: "Target Value",
                type: "number",
                required: true,
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "On Track",
                        "At Risk",
                        "Off Track"
                ],
                defaultValue: "On Track",
                filterable: true,
                width: "half"
        },
        {
                name: "Owner",
                label: "Owner",
                type: "user",
                filterable: true,
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    }
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'kpi', label: 'KPIs', icon: '📊', type: 'grid', object: 'KPI' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'CEO Office AI',
    skills: []
  },
  agents: [
    {
      id: 'agent_ceo_briefing',
      role: 'Executive Briefing Agent',
      permissions: ['*'], // Has OS-wide read access
      tools: ['SAR.getAttentionItems', 'SAR.generateBriefing'],
      policies: [],
      goals: ['Assess OS-wide situation and generate a daily briefing for the CEO.'],
      schedule: '0 8 * * *', // Run every day at 8 AM
      knowledge: ['Strategy', 'Finance', 'Operations', 'HR']
    }
  ],
  workflows: [],
  automations: [],
  notifications: [],
  permissions: {},
  search: { objects: [] },
  settings: [
    {
        key: "board_members",
        label: "Board Members",
        type: "text",
        defaultValue: "",
        group: "Board"
    },
    {
        key: "fiscal_year_start",
        label: "Fiscal Year Start",
        type: "select",
        defaultValue: "January",
        options: [
            "January",
            "April",
            "July",
            "October"
        ],
        group: "Finance"
    },
    {
        key: "reporting_currency",
        label: "Currency",
        type: "select",
        defaultValue: "USD",
        options: [
            "USD",
            "EUR",
            "GBP",
            "INR"
        ],
        group: "Finance"
    }
],
  integrations: [],
  seed: { objects: [] }
};
