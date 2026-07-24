/**
 * CHATR OS — OKR & Goals Capability SDK
 *
 * Implements the 15 enterprise features for the OKR runtime:
 * Universal Forms, Detail, Dashboards, Relationships, AI, Timeline,
 * Search, Workflows, Permissions, Automation, and Seed Data.
 */

import { ICapabilityManifest } from '../types';

export const OKRSDK: ICapabilityManifest = {
  // ─── Identity ───────────────────────────────────────────────────────────────
  id: 'Executive.OKRGoals',
  name: 'OKR & Goals',
  description: 'Company-wide OKR management with cascading goals, check-in cadences, progress tracking, and AI-powered outcome predictions.',
  department: 'Executive',
  category: 'Executive & Strategy',
  version: '1.8.0',
  maturity: 'L5',
  icon: '🎯',
  rating: 4.8,
  installs: 19000,
  tags: ['okr', 'goals', 'strategy'],

  // ─── Business Objects ───────────────────────────────────────────────────────
  objects: [
    {
      name: 'Objective',
      pluralName: 'Objectives',
      icon: '🎯',
      description: 'A high-level qualitative goal.',
      titleField: 'Title',
      statusField: 'Status',
      defaultSort: { field: '_createdAt', direction: 'desc' },
      features: {
        comments: true,
        attachments: true,
        timeline: true,
        aiSummary: true,
      },
      fields: [
        { name: 'Title', label: 'Title', type: 'string', required: true, searchable: true, width: 'full', showInGrid: true },
        { name: 'Description', label: 'Description', type: 'text', width: 'full', showInGrid: false },
        { name: 'Owner', label: 'Owner', type: 'user', required: true, filterable: true, width: 'half', showInGrid: true },
        { name: 'Department', label: 'Department', type: 'enum', options: ['Engineering', 'Sales', 'Marketing', 'Executive', 'HR', 'Finance'], filterable: true, width: 'half', showInGrid: true },
        { name: 'Status', label: 'Status', type: 'enum', options: ['On Track', 'At Risk', 'Delayed', 'Completed', 'Archived'], defaultValue: 'On Track', filterable: true, width: 'half', showInGrid: true, showInKanban: true },
        { name: 'Priority', label: 'Priority', type: 'enum', options: ['Low', 'Medium', 'High', 'Critical'], defaultValue: 'Medium', filterable: true, width: 'half', showInGrid: true },
        { name: 'Progress', label: 'Progress %', type: 'percentage', defaultValue: 0, readonly: true, width: 'half', showInGrid: true },
        { name: 'StartDate', label: 'Start Date', type: 'date', required: true, sortable: true, width: 'half', showInGrid: false },
        { name: 'TargetDate', label: 'Target Date', type: 'date', required: true, sortable: true, width: 'half', showInGrid: true },
        { name: 'Weight', label: 'Weight', type: 'number', defaultValue: 1, width: 'half', showInGrid: false },
        { name: 'ParentObjective', label: 'Parent Objective', type: 'reference', referenceTo: 'Objective', filterable: true, width: 'full', showInGrid: false },
      ],
      actions: [
        { id: 'assign', label: 'Assign Owner', icon: 'User', variant: 'ghost', scope: 'both', requiresSelection: true },
        { id: 'archive', label: 'Archive', icon: 'Archive', variant: 'secondary', scope: 'both', requiresSelection: true },
        { id: 'export', label: 'Export PDF', icon: 'Download', variant: 'ghost', scope: 'list' },
      ],
      relations: [
        { type: 'has-many', object: 'KeyResult', foreignKey: 'ObjectiveId', label: 'Key Results', icon: '📈' },
      ],
    },
    {
      name: 'KeyResult',
      pluralName: 'Key Results',
      icon: '📈',
      description: 'A measurable outcome for an Objective.',
      titleField: 'Title',
      statusField: 'Status',
      features: { comments: true, timeline: true },
      fields: [
        { name: 'Title', label: 'Title', type: 'string', required: true, searchable: true, width: 'full', showInGrid: true },
        { name: 'ObjectiveId', label: 'Parent Objective', type: 'reference', referenceTo: 'Objective', required: true, filterable: true, width: 'full', showInGrid: true },
        { name: 'Owner', label: 'Owner', type: 'user', required: true, filterable: true, width: 'half', showInGrid: true },
        { name: 'Status', label: 'Status', type: 'enum', options: ['On Track', 'At Risk', 'Delayed', 'Achieved'], defaultValue: 'On Track', filterable: true, width: 'half', showInGrid: true },
        { name: 'MetricType', label: 'Metric Type', type: 'enum', options: ['Percentage', 'Currency', 'Number', 'Boolean'], required: true, width: 'half', showInGrid: false },
        { name: 'StartValue', label: 'Start Value', type: 'number', defaultValue: 0, width: 'third', showInGrid: true },
        { name: 'CurrentValue', label: 'Current Value', type: 'number', defaultValue: 0, width: 'third', showInGrid: true },
        { name: 'TargetValue', label: 'Target Value', type: 'number', required: true, width: 'third', showInGrid: true },
        { name: 'DueDate', label: 'Due Date', type: 'date', sortable: true, width: 'half', showInGrid: true },
      ],
      relations: [
        { type: 'has-many', object: 'CheckIn', foreignKey: 'KeyResultId', label: 'Check-ins', icon: '📝' },
      ],
    },
    {
      name: 'CheckIn',
      pluralName: 'Check-ins',
      icon: '📝',
      description: 'Weekly or monthly progress update.',
      titleField: 'Summary',
      fields: [
        { name: 'Summary', label: 'Update Summary', type: 'string', required: true, width: 'full', showInGrid: true },
        { name: 'KeyResultId', label: 'Key Result', type: 'reference', referenceTo: 'KeyResult', required: true, width: 'half', showInGrid: true },
        { name: 'NewValue', label: 'New Value', type: 'number', required: true, width: 'half', showInGrid: true },
        { name: 'Confidence', label: 'Confidence to Achieve', type: 'enum', options: ['High', 'Medium', 'Low'], width: 'half', showInGrid: true },
        { name: 'Blockers', label: 'Blockers', type: 'text', width: 'full', showInGrid: false },
      ],
    }
  ],

  // ─── Views ──────────────────────────────────────────────────────────────────
  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'objectives', label: 'Objectives', icon: '🎯', type: 'grid', object: 'Objective' },
    { id: 'kanban', label: 'Board', icon: '📋', type: 'kanban', object: 'Objective' },
    { id: 'key-results', label: 'Key Results', icon: '📈', type: 'grid', object: 'KeyResult' },
    { id: 'reports', label: 'Reports', icon: '📑', type: 'report' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' },
  ],

  // ─── Dashboards ─────────────────────────────────────────────────────────────
  dashboards: [
    {
      id: 'okr-overview',
      label: 'Company OKR Overview',
      widgets: [
        { id: 'total-obj', type: 'metric', label: 'Total Objectives', icon: '🎯', object: 'Objective', metric: 'count', color: 'indigo', size: 'small', format: 'number' },
        { id: 'completed-obj', type: 'metric', label: 'Completed', icon: '✅', object: 'Objective', metric: 'count', filters: [{ field: 'Status', operator: 'eq', value: 'Completed' }], color: 'emerald', size: 'small', format: 'number' },
        { id: 'at-risk', type: 'metric', label: 'At Risk', icon: '⚠️', object: 'Objective', metric: 'count', filters: [{ field: 'Status', operator: 'eq', value: 'At Risk' }], color: 'amber', size: 'small', format: 'number' },
        { id: 'delayed', type: 'metric', label: 'Delayed', icon: '⏰', object: 'Objective', metric: 'count', filters: [{ field: 'Status', operator: 'eq', value: 'Delayed' }], color: 'rose', size: 'small', format: 'number' },
        { id: 'obj-by-dept', type: 'bar-chart', label: 'Objectives by Department', object: 'Objective', groupBy: 'Department', metric: 'count', size: 'medium' },
        { id: 'obj-by-status', type: 'pie-chart', label: 'Objective Status', object: 'Objective', groupBy: 'Status', metric: 'count', size: 'medium' },
        { id: 'recent-checkins', type: 'list', label: 'Recent Check-ins', object: 'CheckIn', metric: 'count', limit: 5, size: 'full' },
      ],
    },
  ],

  // ─── Reports ────────────────────────────────────────────────────────────────
  reports: [
    { id: 'dept-progress', label: 'Department Progress', icon: '📊', type: 'bar', object: 'Objective', groupBy: 'Department', metric: 'avg', field: 'Progress' },
    { id: 'kr-completion', label: 'Key Result Completion', icon: '📉', type: 'pie', object: 'KeyResult', groupBy: 'Status', metric: 'count' },
  ],

  // ─── AI Skills ──────────────────────────────────────────────────────────────
  ai: {
    assistantName: 'Strategy AI',
    skills: [
      { id: 'summarize', label: 'Summarize Objective', description: 'Summary of goal and all key results', intent: 'summarize', object: 'Objective', scope: 'record', outputType: 'text', promptTemplate: 'Summarize the progress and blockers for Objective: {{Title}}.' },
      { id: 'find-blockers', label: 'Identify Blockers', description: 'Analyze check-ins for hidden risks', intent: 'analyze', object: 'Objective', scope: 'record', outputType: 'text', promptTemplate: 'Analyze all Key Results and Check-ins for {{Title}}. What are the main blockers?' },
      { id: 'suggest-kr', label: 'Suggest Key Results', description: 'AI generated key results', intent: 'suggest', object: 'Objective', scope: 'record', outputType: 'text', promptTemplate: 'Suggest 3 measurable Key Results for the Objective: {{Title}} in the {{Department}} department.' },
      { id: 'predict', label: 'Predict Completion', description: 'Forecast if goal will be met on time', intent: 'predict', object: 'Objective', scope: 'record', outputType: 'text', promptTemplate: 'Based on current progress ({{Progress}}%) and Target Date ({{TargetDate}}), predict the likelihood of completing {{Title}} on time.' },
    ],
  },

  // ─── Workflows & Automations ────────────────────────────────────────────────
  
  // ABI v1.0: Intelligence & Execution
  stateMachines: [],
  policies: [],
  agents: [],
  tools: [],
  workflows: [],
  automations: [
    {
      id: 'update-progress',
      label: 'Update Objective Progress',
      trigger: 'on-create',
      object: 'CheckIn',
      enabled: true,
      actions: [
        { type: 'trigger-workflow', config: { workflow: 'recalculate-objective-progress' } },
      ],
    },
    {
      id: 'notify-at-risk',
      label: 'Notify when At Risk',
      trigger: 'on-status-change',
      object: 'Objective',
      conditions: [{ field: 'Status', operator: 'eq', value: 'At Risk' }],
      enabled: true,
      actions: [
        { type: 'send-notification', config: { template: 'goal-at-risk' } },
      ],
    }
  ],

  // ─── Notifications ──────────────────────────────────────────────────────────
  notifications: [
    { id: 'goal-at-risk', label: 'Goal At Risk', trigger: 'StatusChanged', channel: 'both', title: 'Objective At Risk: {{Title}}', body: 'The objective "{{Title}}" has been marked as At Risk.', recipientRole: 'Executive' },
  ],

  // ─── Permissions ────────────────────────────────────────────────────────────
  permissions: {
    'Admin': ['view', 'create', 'edit', 'delete', 'export', 'admin'],
    'Executive': ['view', 'create', 'edit', 'delete', 'export'],
    'Manager': ['view', 'create', 'edit'],
    'Employee': ['view'],
  },

  // ─── Search ─────────────────────────────────────────────────────────────────
  search: {
    objects: [
      { object: 'Objective', fields: ['Title', 'Description', 'Department'], titleField: 'Title', subtitleField: 'Department', icon: '🎯' },
      { object: 'KeyResult', fields: ['Title'], titleField: 'Title', subtitleField: 'Status', icon: '📈' },
    ],
  },

  // ─── Settings ───────────────────────────────────────────────────────────────
  settings: [
    { key: 'okr_cycle', label: 'OKR Cycle', type: 'enum', options: ['Monthly', 'Quarterly', 'Annually'], defaultValue: 'Quarterly' },
    { key: 'reminder_frequency', label: 'Check-in Reminder Frequency', type: 'enum', options: ['Weekly', 'Bi-weekly', 'Monthly'], defaultValue: 'Weekly' },
  ],

  // ─── Integrations ───────────────────────────────────────────────────────────
  integrations: [],

  // ─── Seed Data ──────────────────────────────────────────────────────────────
  seed: {
    objects: [
      {
        object: 'Objective',
        data: [
          {
            Title: 'Increase Enterprise Revenue by 25%',
            Description: 'Expand our market share in the Fortune 500 segment by launching new enterprise features and building a dedicated outbound sales team.',
            Owner: 'Sarah (Chief Revenue Officer)',
            Department: 'Sales',
            Status: 'On Track',
            Priority: 'Critical',
            Progress: 65,
            StartDate: '2026-01-01',
            TargetDate: '2026-12-31',
          },
          {
            Title: 'Launch Mobile App V2',
            Description: 'Complete rewrite of the mobile app to achieve feature parity with desktop and reduce crash rate.',
            Owner: 'David (VP Engineering)',
            Department: 'Engineering',
            Status: 'Delayed',
            Priority: 'High',
            Progress: 40,
            StartDate: '2026-04-01',
            TargetDate: '2026-09-30',
          }
        ]
      },
    ]
  }
};
