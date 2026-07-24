/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Helpdesk (Support.Helpdesk)
 */

import { ICapabilityManifest } from '../types';

export const SupportHelpdeskSDK: ICapabilityManifest = {
  id: 'Support.Helpdesk',
  name: 'Helpdesk',
  description: 'Customer support ticketing with SLA enforcement, auto-routing, canned responses, and customer satisfaction scoring.',
  department: 'Customer Support',
  category: 'Customer Support',
  version: '2.1.0',
  maturity: 'L5',
  icon: '🎧',
  rating: 4.8,
  installs: 26800,
  tags: ["helpdesk","support","tickets","sla"],

  objects: [
    {
      name: 'Ticket',
      pluralName: 'Tickets',
      icon: '🎧',
      titleField: 'Subject',
      statusField: 'Status',
      fields: [
        {
                name: "Subject",
                label: "Subject",
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
                        "Open",
                        "In Progress",
                        "Waiting on Customer",
                        "Resolved",
                        "Closed"
                ],
                defaultValue: "Open",
                filterable: true,
                width: "half"
        },
        {
                name: "Priority",
                label: "Priority",
                type: "enum",
                options: [
                        "Low",
                        "Normal",
                        "High",
                        "Urgent"
                ],
                defaultValue: "Normal",
                filterable: true,
                width: "half"
        },
        {
                name: "Requester",
                label: "Customer",
                type: "user",
                filterable: true,
                width: "half"
        },
        {
                name: "Assignee",
                label: "Assigned Agent",
                type: "user",
                filterable: true,
                width: "half"
        },
        {
                name: "CreatedAt",
                label: "Created",
                type: "date",
                sortable: true,
                readonly: true,
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    }
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'ticket', label: 'Tickets', icon: '🎧', type: 'grid', object: 'Ticket' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Helpdesk AI',
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
        key: "first_response_sla_hours",
        label: "First Response SLA (hours)",
        type: "number",
        defaultValue: 4,
        group: "SLA"
    },
    {
        key: "resolution_sla_hours",
        label: "Resolution SLA (hours)",
        type: "number",
        defaultValue: 24,
        group: "SLA"
    },
    {
        key: "auto_assign",
        label: "Auto-Assign Tickets",
        type: "boolean",
        defaultValue: true,
        group: "Routing"
    }
],
  integrations: [],
  seed: { objects: [] }
};
