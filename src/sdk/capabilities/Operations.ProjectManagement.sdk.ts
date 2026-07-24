/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Project Management (Operations.ProjectManagement)
 */

import { ICapabilityManifest } from '../types';

export const OperationsProjectManagementSDK: ICapabilityManifest = {
  id: 'Operations.ProjectManagement',
  name: 'Project Management',
  description: 'Full project lifecycle management with Gantt charts, resource allocation, milestone tracking, and budget control.',
  department: 'Operations',
  category: 'Operations',
  version: '2.0.0',
  maturity: 'L5',
  icon: '📅',
  rating: 4.8,
  installs: 33100,
  tags: ["projects","pm","gantt","milestones"],

  objects: [
    {
      name: 'Project',
      pluralName: 'Projects',
      icon: '📅',
      titleField: 'Name',
      statusField: 'Status',
      fields: [
        {
                name: "Name",
                label: "Project Name",
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
                        "Not Started",
                        "In Progress",
                        "On Hold",
                        "Completed",
                        "Cancelled"
                ],
                defaultValue: "Not Started",
                filterable: true,
                width: "half"
        },
        {
                name: "Priority",
                label: "Priority",
                type: "enum",
                options: [
                        "Low",
                        "Medium",
                        "High",
                        "Critical"
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
                name: "DueDate",
                label: "Due Date",
                type: "date",
                sortable: true,
                width: "half"
        },
        {
                name: "Owner",
                label: "Project Manager",
                type: "user",
                required: true,
                filterable: true,
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    },

    {
      name: 'Task',
      pluralName: 'Tasks',
      icon: '✅',
      titleField: 'Title',
      statusField: 'Status',
      fields: [
        {
                name: "Title",
                label: "Task Title",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Project",
                label: "Project",
                type: "reference",
                referenceTo: "Project",
                required: true,
                filterable: true,
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Backlog",
                        "To Do",
                        "In Progress",
                        "Review",
                        "Done"
                ],
                defaultValue: "Backlog",
                filterable: true,
                width: "half"
        },
        {
                name: "Priority",
                label: "Priority",
                type: "enum",
                options: [
                        "Low",
                        "Medium",
                        "High",
                        "Critical"
                ],
                filterable: true,
                width: "half"
        },
        {
                name: "Assignee",
                label: "Assigned To",
                type: "user",
                filterable: true,
                width: "half"
        },
        {
                name: "DueDate",
                label: "Due Date",
                type: "date",
                sortable: true,
                width: "half"
        }
],
      relations: [],
      features: { comments: true, timeline: true, attachments: true }
    }
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'project', label: 'Projects', icon: '📅', type: 'grid', object: 'Project' },
    { id: 'task', label: 'Tasks', icon: '✅', type: 'grid', object: 'Task' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Project Management AI',
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
        key: "methodology",
        label: "Default Methodology",
        type: "select",
        defaultValue: "Agile",
        options: [
            "Agile",
            "Waterfall",
            "Kanban",
            "Hybrid"
        ],
        group: "Methodology"
    }
],
  integrations: [],
  seed: { objects: [] }
};
