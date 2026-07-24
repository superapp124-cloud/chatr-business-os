/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Risk Management (Executive.RiskManagement)
 */

import { ICapabilityManifest } from '../types';

export const ExecutiveRiskManagementSDK: ICapabilityManifest = {
  id: 'Executive.RiskManagement',
  name: 'Risk Management',
  description: 'Enterprise risk register with impact/likelihood scoring, mitigation tracking, and executive risk dashboard.',
  department: 'Executive Office',
  category: 'Executive & Strategy',
  version: '1.3.0',
  maturity: 'L4',
  icon: '⚠️',
  rating: 4.7,
  installs: 6700,
  tags: ["risk","compliance","governance"],

  objects: [
    {
      name: 'Risk',
      pluralName: 'Risks',
      icon: '⚠️',
      titleField: 'Title',
      statusField: 'Status',
      fields: [
        {
                name: "Title",
                label: "Risk Title",
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
                        "Mitigating",
                        "Accepted",
                        "Closed"
                ],
                defaultValue: "Open",
                filterable: true,
                width: "half"
        },
        {
                name: "Impact",
                label: "Impact",
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
                name: "Likelihood",
                label: "Likelihood",
                type: "enum",
                options: [
                        "Rare",
                        "Unlikely",
                        "Possible",
                        "Likely",
                        "Almost Certain"
                ],
                filterable: true,
                width: "half"
        },
        {
                name: "Owner",
                label: "Risk Owner",
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
    { id: 'risk', label: 'Risks', icon: '⚠️', type: 'grid', object: 'Risk' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Risk Management AI',
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
        key: "risk_matrix_size",
        label: "Risk Matrix",
        type: "select",
        defaultValue: "5x5",
        options: [
            "3x3",
            "4x4",
            "5x5"
        ],
        group: "Matrix"
    }
],
  integrations: [],
  seed: { objects: [] }
};
