/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Knowledge Base (Support.KnowledgeBase)
 */

import { ICapabilityManifest } from '../types';

export const SupportKnowledgeBaseSDK: ICapabilityManifest = {
  id: 'Support.KnowledgeBase',
  name: 'Knowledge Base',
  description: 'Self-service knowledge base with AI-powered search, article analytics, and agent-assist recommendations.',
  department: 'Customer Support',
  category: 'Customer Support',
  version: '1.6.0',
  maturity: 'L4',
  icon: '📚',
  rating: 4.6,
  installs: 18200,
  tags: ["knowledge-base","self-service","support","articles"],

  objects: [
    {
      name: 'Article',
      pluralName: 'Articles',
      icon: '📚',
      titleField: 'Title',
      statusField: 'Status',
      fields: [
        {
                name: "Title",
                label: "Article Title",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Category",
                label: "Category",
                type: "string",
                filterable: true,
                sortable: true,
                width: "half"
        },
        {
                name: "Status",
                label: "Status",
                type: "enum",
                options: [
                        "Draft",
                        "In Review",
                        "Published",
                        "Archived"
                ],
                defaultValue: "Draft",
                filterable: true,
                width: "half"
        },
        {
                name: "Author",
                label: "Author",
                type: "user",
                filterable: true,
                width: "half"
        },
        {
                name: "Views",
                label: "Total Views",
                type: "number",
                readonly: true,
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
    { id: 'article', label: 'Articles', icon: '📚', type: 'grid', object: 'Article' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Knowledge Base AI',
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
        key: "public_kb",
        label: "Make KB Publicly Accessible",
        type: "boolean",
        defaultValue: true,
        group: "Access"
    }
],
  integrations: [],
  seed: { objects: [] }
};
