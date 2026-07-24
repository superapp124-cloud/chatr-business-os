import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Marketing.CampaignManager',
  name: 'Campaign Manager',
  description: 'Plan, execute, and measure multi-channel marketing campaigns with ROI tracking and A/B testing.',
  department: 'Marketing',
  category: 'Marketing',
  version: '1.2.0',
  maturity: 'L4',
  icon: '📣',
  rating: 4.6,
  installs: 11300,
  verbs: ['create', 'launch', 'pause', 'analyze', 'optimize'],
  nouns: ['campaign', 'audience', 'email', 'ad', 'landing page'],
  permissions: ['marketing.campaign.create', 'marketing.campaign.launch'],
  eventsProduced: ['CampaignLaunched', 'CampaignCompleted'],
  eventsConsumed: ['ContactCreated'],
  dependencies: ['System.Notifications', 'CRM.ContactManager'],
  search: ['name', 'channel', 'status', 'audience'],
  configSchema: [
    { key: 'channels', label: 'Marketing Channels', type: 'multiselect', defaultValue: ['Email', 'Social'], options: ['Email', 'SMS', 'Social', 'PPC', 'Content'], group: 'Channels' },
    { key: 'ab_testing', label: 'A/B Testing', type: 'boolean', defaultValue: true, group: 'Optimization' },
    { key: 'utm_auto_tag', label: 'Auto UTM Tagging', type: 'boolean', defaultValue: true, group: 'Tracking' },
    { key: 'unsubscribe_method', label: 'Unsubscribe Method', type: 'select', defaultValue: 'One-Click', options: ['One-Click', 'Confirm Page'], group: 'Compliance' },
  ],
  tags: ['marketing', 'campaigns', 'email', 'automation'],
};
export default manifest;
