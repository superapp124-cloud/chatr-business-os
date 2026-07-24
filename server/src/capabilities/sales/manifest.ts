import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Sales.LeadTracker',
  name: 'Lead Tracker',
  description: 'Full-cycle lead management with pipeline stages, scoring, and automated follow-ups.',
  department: 'Sales',
  category: 'CRM & Sales',
  version: '1.0.0',
  maturity: 'L4',
  icon: '🎯',
  rating: 4.8,
  installs: 12400,
  verbs: ['create', 'log', 'add', 'track', 'qualify'],
  nouns: ['lead', 'prospect', 'opportunity'],
  permissions: ['sales.lead.create', 'sales.lead.read', 'sales.lead.update'],
  eventsProduced: ['LeadCreated', 'LeadQualified'],
  eventsConsumed: [],
  dependencies: [],
  search: ['title', 'description', 'company', 'contact'],
  configSchema: [
    { key: 'pipeline_stages', label: 'Pipeline Stages', type: 'multiselect', defaultValue: ['New', 'Contacted', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost'], description: 'Define your sales pipeline stages', group: 'Pipeline' },
    { key: 'lead_score_threshold', label: 'Lead Score Threshold', type: 'number', defaultValue: 70, description: 'Minimum score to qualify a lead automatically', group: 'Scoring' },
    { key: 'auto_assign', label: 'Auto-assign Leads', type: 'boolean', defaultValue: true, description: 'Automatically assign leads to available reps', group: 'Automation' },
    { key: 'follow_up_days', label: 'Follow-up Reminder (days)', type: 'number', defaultValue: 3, description: 'Days before sending follow-up reminder', group: 'Automation' },
    { key: 'currency', label: 'Deal Currency', type: 'select', defaultValue: 'USD', options: ['USD', 'EUR', 'GBP', 'INR', 'AED'], group: 'General' },
  ],
  tags: ['crm', 'sales', 'leads', 'pipeline'],
};
export default manifest;
