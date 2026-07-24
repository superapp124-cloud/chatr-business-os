import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Support.Ticketing',
  name: 'IT Service Desk',
  description: 'Help desk ticketing with SLA tracking, escalation rules, knowledge base, and customer satisfaction surveys.',
  department: 'Support',
  category: 'Customer Support',
  version: '1.0.0',
  maturity: 'L4',
  icon: '🎫',
  rating: 4.5,
  installs: 11200,
  verbs: ['create', 'assign', 'escalate', 'resolve', 'close'],
  nouns: ['ticket', 'issue', 'request', 'incident'],
  permissions: ['support.ticket.create', 'support.ticket.assign'],
  eventsProduced: ['TicketCreated', 'TicketResolved'],
  eventsConsumed: [],
  dependencies: [],
  search: ['title', 'description', 'assignee', 'status'],
  configSchema: [
    { key: 'sla_response_hours', label: 'SLA Response Time (hours)', type: 'number', defaultValue: 4, group: 'SLA' },
    { key: 'sla_resolution_hours', label: 'SLA Resolution Time (hours)', type: 'number', defaultValue: 24, group: 'SLA' },
    { key: 'priority_levels', label: 'Priority Levels', type: 'multiselect', defaultValue: ['Critical', 'High', 'Medium', 'Low'], group: 'Tickets' },
    { key: 'auto_assign_round_robin', label: 'Round-Robin Assignment', type: 'boolean', defaultValue: true, group: 'Routing' },
    { key: 'satisfaction_survey', label: 'Send Satisfaction Survey', type: 'boolean', defaultValue: true, group: 'Feedback' },
  ],
  tags: ['support', 'helpdesk', 'tickets', 'sla', 'itsm'],
};
export default manifest;
