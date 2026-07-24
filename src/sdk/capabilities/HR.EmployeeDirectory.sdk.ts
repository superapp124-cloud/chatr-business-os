/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Employee Directory (HR.EmployeeDirectory)
 */

import { ICapabilityManifest } from '../types';

export const HREmployeeDirectorySDK: ICapabilityManifest = {
  id: 'HR.EmployeeDirectory',
  name: 'Employee Directory',
  description: 'Comprehensive employee profiles with org chart, skills inventory, and contact directory.',
  department: 'Human Resources',
  category: 'Recruitment & HR',
  version: '2.2.0',
  maturity: 'L5',
  icon: '👥',
  rating: 4.7,
  installs: 22100,
  tags: ["employees","directory","org-chart","hr"],

  objects: [
    {
      name: 'Employee',
      pluralName: 'Employees',
      icon: '👥',
      titleField: 'Name',
      statusField: '',
      fields: [
        {
                name: "Name",
                label: "Full Name",
                type: "string",
                required: true,
                searchable: true,
                sortable: true,
                width: "full"
        },
        {
                name: "Email",
                label: "Work Email",
                type: "string",
                required: true,
                searchable: true,
                width: "half"
        },
        {
                name: "Department",
                label: "Department",
                type: "string",
                filterable: true,
                sortable: true,
                width: "half"
        },
        {
                name: "Title",
                label: "Job Title",
                type: "string",
                searchable: true,
                width: "half"
        },
        {
                name: "Manager",
                label: "Manager",
                type: "user",
                filterable: true,
                width: "half"
        },
        {
                name: "StartDate",
                label: "Start Date",
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
    { id: 'employee', label: 'Employees', icon: '👥', type: 'grid', object: 'Employee' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Employee Directory AI',
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
        key: "show_salaries",
        label: "Show Salary Bands",
        type: "boolean",
        defaultValue: false,
        group: "Privacy"
    }
],
  integrations: [],
  seed: { objects: [] }
};
