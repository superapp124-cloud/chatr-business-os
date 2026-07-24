/**
 * CHATR OS — Auto-Generated Capability SDK
 * Capability: Identity & Access (Platform.IdentityAccess)
 */

import { ICapabilityManifest } from '../types';

export const PlatformIdentityAccessSDK: ICapabilityManifest = {
  id: 'Platform.IdentityAccess',
  name: 'Identity & Access',
  description: 'SSO, RBAC, MFA, session management, and audit logging for enterprise security compliance.',
  department: 'Enterprise Platform',
  category: 'Enterprise Platform',
  version: '2.5.0',
  maturity: 'L5',
  icon: '🔐',
  rating: 4.9,
  installs: 38200,
  tags: ["iam","sso","rbac","security"],

  objects: [
  ],

  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' }
  ],

  dashboards: [],
  reports: [],
  ai: {
    assistantName: 'Identity & Access AI',
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
        key: "mfa_required",
        label: "Require MFA for All Users",
        type: "boolean",
        defaultValue: true,
        group: "Security"
    },
    {
        key: "session_timeout_hours",
        label: "Session Timeout (hours)",
        type: "number",
        defaultValue: 8,
        group: "Security"
    },
    {
        key: "sso_provider",
        label: "SSO Provider",
        type: "select",
        defaultValue: "None",
        options: [
            "None",
            "Google",
            "Microsoft",
            "Okta",
            "Auth0"
        ],
        group: "SSO"
    }
],
  integrations: [],
  seed: { objects: [] }
};
