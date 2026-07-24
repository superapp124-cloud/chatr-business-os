/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Opportunity Management (CRM.OpportunityManagement)
 */

import { ICapabilityManifest } from '../types';

export const CRMOpportunityManagementSDK: ICapabilityManifest = {
  id: 'CRM.OpportunityManagement',
  name: 'Opportunity Management',
  description: 'Track deals through your pipeline with weighted forecasting, activity timeline, and competitor tracking.',
  department: 'Sales',
  category: 'CRM & Sales',
  version: '2.1.0',
  maturity: 'L5',
  icon: '💼',
  rating: 4.9,
  installs: 31200,
  tags: ["pipeline","deals","forecasting","crm"],

  objects: [
    {
      name: 'Opportunity',
      pluralName: 'Opportunities',
      icon: '💼',
      titleField: 'Name',
      statusField: 'Stage',
      fields: [
        {
                name: "Name",
                label: "Opportunity Name",
                type: "string",
                required: true,
                searchable: true,
                width: "full"
        },
        {
                name: "Account",
                label: "Account",
                type: "reference",
                referenceTo: "Account",
                required: true,
                searchable: true,
                width: "half"
        },
        {
                name: "Stage",
                label: "Stage",
                type: "enum",
                options: [
                        "Prospecting",
                        "Qualification",
                        "Proposal",
                        "Negotiation",
                        "Closed Won",
                        "Closed Lost"
                ],
                defaultValue: "Prospecting",
                filterable: true,
                width: "half"
        },
        {
                name: "Value",
                label: "Value ($)",
                type: "number",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "Probability",
                label: "Close Probability (%)",
                type: "number",
                width: "half"
        },
        {
                name: "CloseDate",
                label: "Expected Close",
                type: "date",
                required: true,
                sortable: true,
                width: "half"
        },
        {
                name: "Owner",
                label: "Account Executive",
                type: "user",
                required: true,
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
    { id: 'opportunity', label: 'Opportunities', icon: '💼', type: 'grid', object: 'Opportunity' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Opportunity Management AI',
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
        key: "pipeline_stages",
        label: "Pipeline Stages",
        type: "text",
        defaultValue: "Prospecting,Qualification,Proposal,Negotiation,Closed Won,Closed Lost",
        group: "Pipeline"
    },
    {
        key: "forecast_method",
        label: "Forecast Method",
        type: "select",
        defaultValue: "Weighted",
        options: [
            "Weighted",
            "Best Case",
            "Commit"
        ],
        group: "Forecasting"
    }
],
  integrations: [],
  seed: { objects: [] }
};
