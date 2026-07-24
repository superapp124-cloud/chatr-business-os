/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Contacts (CRM.Contacts)
 */

import { ICapabilityManifest } from '../types';

export const CRMContactsSDK: ICapabilityManifest = {
  id: 'CRM.Contacts',
  name: 'Contacts',
  description: 'Unified contact database with interaction history, relationship scoring, and cross-app contact sync.',
  department: 'Sales',
  category: 'CRM & Sales',
  version: '2.0.0',
  maturity: 'L5',
  icon: '👤',
  rating: 4.8,
  installs: 35400,
  tags: ["contacts","crm","people"],

  objects: [
    {
      name: 'Contact',
      pluralName: 'Contacts',
      icon: '👤',
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
                label: "Email",
                type: "string",
                required: true,
                searchable: true,
                width: "half"
        },
        {
                name: "Phone",
                label: "Phone",
                type: "string",
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
                name: "Account",
                label: "Account",
                type: "reference",
                referenceTo: "Account",
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
    { id: 'contact', label: 'Contacts', icon: '👤', type: 'grid', object: 'Contact' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Contacts AI',
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
        key: "duplicate_detection",
        label: "Duplicate Detection",
        type: "boolean",
        defaultValue: true,
        group: "Data Quality"
    }
],
  integrations: [],
  seed: { objects: [] }
};
