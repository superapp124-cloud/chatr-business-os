import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Executive.DecisionTracker',
  name: 'Decision Tracker',
  description: 'Log, track, and audit strategic decisions with rationale, stakeholders, and outcome monitoring.',
  department: 'Executive Office',
  category: 'Strategy & Planning',
  version: '1.0.0',
  maturity: 'L4',
  icon: '⚡',
  rating: 4.9,
  installs: 5200,
  verbs: ['log', 'record', 'track', 'review'],
  nouns: ['decision', 'strategy', 'policy', 'okr'],
  permissions: ['executive.decision.create', 'executive.decision.read'],
  eventsProduced: ['DecisionLogged', 'DecisionReviewed'],
  eventsConsumed: [],
  dependencies: [],
  search: ['title', 'rationale', 'stakeholders'],
  configSchema: [
    { key: 'decision_categories', label: 'Decision Categories', type: 'multiselect', defaultValue: ['Strategic', 'Operational', 'Financial', 'HR', 'Product'], group: 'Classification' },
    { key: 'review_frequency', label: 'Review Frequency', type: 'select', defaultValue: 'Quarterly', options: ['Monthly', 'Quarterly', 'Annually'], group: 'Reviews' },
    { key: 'require_rationale', label: 'Require Rationale', type: 'boolean', defaultValue: true, group: 'Policy' },
    { key: 'notify_stakeholders', label: 'Notify Stakeholders', type: 'boolean', defaultValue: true, group: 'Notifications' },
  ],
  tags: ['executive', 'decisions', 'strategy', 'governance'],
};
export default manifest;
