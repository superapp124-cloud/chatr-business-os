/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Board Management (Executive.BoardManagement)
 */

import { ICapabilityManifest } from '../types';

export const ExecutiveBoardManagementSDK: ICapabilityManifest = {
  id: 'Executive.BoardManagement',
  name: 'Board Management',
  description: 'Board meeting management with agenda builder, board packs, resolution tracking, and director portal.',
  department: 'Executive Office',
  category: 'Executive & Strategy',
  version: '1.0.0',
  maturity: 'L4',
  icon: '🏛️',
  rating: 4.6,
  installs: 3200,
  tags: ["board","governance","meetings"],

  objects: [
    {
      name: 'BoardMeeting',
      pluralName: 'Board Meetings',
      icon: '🏛️',
      titleField: 'Title',
      statusField: '',
      fields: [
        {
                name: "Title",
                label: "Meeting Title",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Date",
                label: "Meeting Date",
                type: "date",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Scheduled",
                        "In Progress",
                        "Completed"
                ],
                defaultValue: "Scheduled",
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
    { id: 'boardmeeting', label: 'Board Meetings', icon: '🏛️', type: 'grid', object: 'BoardMeeting' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Board Management AI',
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
        key: "board_size",
        label: "Board Size",
        type: "number",
        defaultValue: 7,
        group: "Board"
    }
],
  integrations: [],
  seed: { objects: [] }
};
