import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'HR.Performance',
  name: 'Performance Management',
  description: 'OKR setting, 360-degree reviews, continuous feedback, and performance improvement plans.',
  department: 'HR',
  category: 'HR & People',
  version: '1.0.0',
  maturity: 'L4',
  icon: '🏆',
  rating: 4.6,
  installs: 7100,
  verbs: ['set', 'review', 'rate', 'feedback', 'approve'],
  nouns: ['okr', 'goal', 'review', 'rating', 'feedback'],
  permissions: ['hr.performance.view', 'hr.performance.review'],
  eventsProduced: ['ReviewCompleted', 'GoalAchieved'],
  eventsConsumed: [],
  dependencies: [],
  search: ['employee', 'period', 'rating', 'goal'],
  configSchema: [
    { key: 'review_cycle', label: 'Review Cycle', type: 'select', defaultValue: 'Quarterly', options: ['Monthly', 'Quarterly', 'Bi-Annually', 'Annually'], group: 'Schedule' },
    { key: 'rating_scale', label: 'Rating Scale', type: 'select', defaultValue: '5-point', options: ['3-point', '5-point', '10-point'], group: 'Scoring' },
    { key: 'peer_reviews', label: 'Enable Peer Reviews', type: 'boolean', defaultValue: true, group: 'Features' },
    { key: 'self_assessment', label: 'Enable Self Assessment', type: 'boolean', defaultValue: true, group: 'Features' },
  ],
  tags: ['hr', 'performance', 'okr', 'reviews', 'feedback'],
};
export default manifest;
