import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'System.Notifications',
  name: 'Omnichannel Notifications',
  description: 'Send notifications across email, SMS, push, Slack and WhatsApp with templates and delivery tracking.',
  department: 'System',
  category: 'Communication',
  version: '1.0.0',
  maturity: 'L4',
  icon: '🔔',
  rating: 4.7,
  installs: 18000,
  verbs: ['send', 'notify', 'alert', 'broadcast'],
  nouns: ['notification', 'alert', 'message', 'email'],
  permissions: ['system.notifications.send'],
  eventsProduced: ['NotificationSent'],
  eventsConsumed: ['*'],
  dependencies: [],
  search: ['recipient', 'channel', 'template'],
  configSchema: [
    { key: 'channels', label: 'Active Channels', type: 'multiselect', defaultValue: ['Email', 'Push'], options: ['Email', 'SMS', 'Push', 'Slack', 'WhatsApp'], group: 'Channels' },
    { key: 'from_email', label: 'From Email', type: 'email', defaultValue: 'noreply@company.com', required: true, group: 'Email' },
    { key: 'throttle_per_hour', label: 'Max Notifications/Hour', type: 'number', defaultValue: 100, group: 'Limits' },
    { key: 'quiet_hours', label: 'Quiet Hours', type: 'boolean', defaultValue: false, description: 'Suppress non-critical alerts at night', group: 'Schedule' },
  ],
  tags: ['notifications', 'email', 'sms', 'push', 'alerts'],
};
export default manifest;
