import { ICapabilityManifest } from '../../../types.js';
export const manifest: ICapabilityManifest = {
  id: 'Analytics.BusinessIntelligence',
  name: 'Business Intelligence',
  description: 'Real-time dashboards, KPI monitoring, custom reports, and data visualization across all departments.',
  department: 'Executive Office',
  category: 'Analytics & BI',
  version: '2.1.0',
  maturity: 'L5',
  icon: '📈',
  rating: 4.9,
  installs: 28000,
  verbs: ['analyze', 'report', 'visualize', 'export', 'schedule'],
  nouns: ['dashboard', 'report', 'metric', 'kpi', 'chart'],
  permissions: ['analytics.dashboard.view', 'analytics.report.create'],
  eventsProduced: ['ReportGenerated', 'AlertTriggered'],
  eventsConsumed: ['*'],
  dependencies: [],
  search: ['metric', 'department', 'period', 'type'],
  configSchema: [
    { key: 'refresh_interval', label: 'Dashboard Refresh (seconds)', type: 'number', defaultValue: 30, group: 'Performance' },
    { key: 'default_date_range', label: 'Default Date Range', type: 'select', defaultValue: 'Last 30 days', options: ['Last 7 days', 'Last 30 days', 'Last Quarter', 'YTD', 'Custom'], group: 'Display' },
    { key: 'export_formats', label: 'Export Formats', type: 'multiselect', defaultValue: ['PDF', 'Excel'], options: ['PDF', 'Excel', 'CSV', 'PNG'], group: 'Export' },
    { key: 'scheduled_reports', label: 'Enable Scheduled Reports', type: 'boolean', defaultValue: true, group: 'Automation' },
    { key: 'primary_color', label: 'Chart Primary Color', type: 'color', defaultValue: '#6366f1', group: 'Branding' },
  ],
  tags: ['analytics', 'bi', 'dashboards', 'reports', 'kpi'],
};
export default manifest;
