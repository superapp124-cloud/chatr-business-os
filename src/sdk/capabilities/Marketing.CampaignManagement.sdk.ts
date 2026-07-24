/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Campaign Management (Marketing.CampaignManagement)
 */

import { ICapabilityManifest } from '../types';

export const MarketingCampaignManagementSDK: ICapabilityManifest = {
  id: 'Marketing.CampaignManagement',
  name: 'Campaign Management',
  description: 'Multi-channel campaign planning, execution, and measurement with attribution modeling and ROI tracking.',
  department: 'Marketing',
  category: 'Marketing',
  version: '1.8.0',
  maturity: 'L4',
  icon: '📣',
  rating: 4.6,
  installs: 13400,
  tags: ["campaigns","marketing","roi","multi-channel"],

  objects: [
    {
      name: 'Campaign',
      pluralName: 'Campaigns',
      icon: '📣',
      titleField: 'Name',
      statusField: 'Status',
      fields: [
        {
                name: "Name",
                label: "Campaign Name",
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
                        "Planning",
                        "Active",
                        "Paused",
                        "Completed"
                ],
                defaultValue: "Planning",
                filterable: true,
                width: "half"
        },
        {
                name: "Budget",
                label: "Budget ($)",
                type: "number",
                required: true,
                width: "half"
        },
        {
                name: "Channel",
                label: "Primary Channel",
                type: "enum",
                options: [
                        "Email",
                        "Social",
                        "Paid",
                        "Content",
                        "Events",
                        "Multi"
                ],
                filterable: true,
                width: "half"
        },
        {
                name: "StartDate",
                label: "Start Date",
                type: "date",
                sortable: true,
                width: "half"
        },
        {
                name: "EndDate",
                label: "End Date",
                type: "date",
                sortable: true,
                width: "half"
        },
        {
                name: "Owner",
                label: "Campaign Manager",
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
    { id: 'campaign', label: 'Campaigns', icon: '📣', type: 'grid', object: 'Campaign' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Campaign Management AI',
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
        key: "attribution_model",
        label: "Attribution Model",
        type: "select",
        defaultValue: "Last Touch",
        options: [
            "First Touch",
            "Last Touch",
            "Linear",
            "Time Decay"
        ],
        group: "Analytics"
    }
],
  integrations: [],
  seed: { objects: [] }
};
