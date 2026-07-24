/**
 * CHATR OS — Lead Management Capability SDK
 *
 * The complete reference implementation of a full Capability SDK.
 * Every other capability follows this exact same pattern.
 *
 * Installing this capability automatically creates:
 * ✓ Database Objects (Lead, Activity)
 * ✓ Grid View with all fields
 * ✓ Kanban Board (by Stage)
 * ✓ Detail Pages
 * ✓ Dashboard (5 widgets)
 * ✓ Reports (3 reports)
 * ✓ AI Skills (4 skills)
 * ✓ Automations (3 rules)
 * ✓ Notifications (2 templates)
 * ✓ Seed Data (3 sample leads)
 * ✓ Search index
 * ✓ Permissions
 * ✓ Settings
 */

import { ICapabilitySDK } from '../sdk/types';

export const LeadManagementSDK: ICapabilityManifest = {
  // ─── Identity ───────────────────────────────────────────────────────────────
  id: 'CRM.LeadManagement',
  name: 'Lead Management',
  description: 'Capture, score, and qualify leads from all channels with AI lead scoring, routing rules, and conversion analytics.',
  department: 'Sales',
  category: 'CRM & Sales',
  version: '2.4.0',
  maturity: 'L5',
  icon: '🎣',
  rating: 4.8,
  installs: 24600,
  tags: ['leads', 'sales', 'crm', 'pipeline'],

  // ─── Business Objects ───────────────────────────────────────────────────────
  objects: [
    {
      name: 'Lead',
      pluralName: 'Leads',
      icon: '🎣',
      description: 'A prospective customer who has shown interest.',
      titleField: 'Name',
      statusField: 'Stage',
      defaultSort: { field: '_createdAt', direction: 'desc' },
      features: {
        comments: true,
        attachments: true,
        timeline: true,
        aiSummary: true,
        export: true,
        import: true,
        duplicate: true,
        archive: true,
      },
      fields: [
        { name: 'Name', label: 'Lead Name', type: 'string', required: true, searchable: true, sortable: true, width: 'full', placeholder: 'Full name or company name', showInGrid: true },
        { name: 'Email', label: 'Email', type: 'email', required: true, searchable: true, width: 'half', placeholder: 'email@example.com', showInGrid: true },
        { name: 'Phone', label: 'Phone', type: 'phone', searchable: true, width: 'half', placeholder: '+1 (555) 000-0000', showInGrid: false },
        { name: 'Company', label: 'Company', type: 'string', searchable: true, sortable: true, width: 'half', placeholder: 'Company name', showInGrid: true },
        { name: 'Title', label: 'Job Title', type: 'string', searchable: true, width: 'half', placeholder: 'CEO, VP Sales...', showInGrid: false },
        {
          name: 'Stage',
          label: 'Stage',
          type: 'enum',
          options: ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
          defaultValue: 'New',
          filterable: true,
          sortable: true,
          width: 'half',
          showInGrid: true,
          showInKanban: true,
        },
        {
          name: 'Source',
          label: 'Lead Source',
          type: 'enum',
          options: ['Website', 'LinkedIn', 'Referral', 'Cold Outreach', 'Event', 'Google Ads', 'Facebook', 'Partner', 'Other'],
          defaultValue: 'Website',
          filterable: true,
          width: 'half',
          showInGrid: true,
        },
        {
          name: 'Priority',
          label: 'Priority',
          type: 'enum',
          options: ['Low', 'Medium', 'High', 'Urgent'],
          defaultValue: 'Medium',
          filterable: true,
          width: 'half',
          showInGrid: false,
        },
        { name: 'Score', label: 'Lead Score', type: 'number', readonly: true, defaultValue: 0, width: 'quarter', displayFormat: 'number', showInGrid: true, helpText: 'AI-calculated lead quality score (0-100)' },
        { name: 'Owner', label: 'Assigned To', type: 'user', filterable: true, sortable: true, width: 'half', showInGrid: true },
        { name: 'Value', label: 'Estimated Value ($)', type: 'currency', sortable: true, width: 'half', showInGrid: false, displayFormat: 'currency' },
        { name: 'ExpectedClose', label: 'Expected Close', type: 'date', sortable: true, width: 'half', showInGrid: false },
        { name: 'Notes', label: 'Notes', type: 'text', width: 'full', showInGrid: false, showInKanban: false },
        { name: 'Website', label: 'Website', type: 'url', width: 'half', showInGrid: false },
      ],
      actions: [
        { id: 'qualify', label: 'Mark Qualified', icon: 'CheckCircle', variant: 'primary', scope: 'record', workflow: 'qualifyLead' },
        { id: 'convert', label: 'Convert to Opportunity', icon: 'ArrowRight', variant: 'secondary', scope: 'record', workflow: 'convertLead', confirmation: 'Convert this lead to an Opportunity? This will create a new Opportunity record.' },
        { id: 'assign', label: 'Assign Owner', icon: 'User', variant: 'ghost', scope: 'both', requiresSelection: true },
        { id: 'import', label: 'Import CSV', icon: 'Upload', variant: 'ghost', scope: 'list' },
        { id: 'export', label: 'Export', icon: 'Download', variant: 'ghost', scope: 'list' },
        { id: 'merge', label: 'Merge Duplicates', icon: 'GitMerge', variant: 'ghost', scope: 'list', requiresSelection: true },
      ],
      relations: [
        { type: 'has-many', object: 'Activity', foreignKey: 'LeadId', label: 'Activities', icon: '🔄' },
      ],
    },
    {
      name: 'Activity',
      pluralName: 'Activities',
      icon: '🔄',
      description: 'A logged interaction with a lead.',
      titleField: 'Subject',
      statusField: 'Status',
      fields: [
        { name: 'Subject', label: 'Subject', type: 'string', required: true, searchable: true, width: 'full', showInGrid: true },
        { name: 'LeadId', label: 'Lead', type: 'reference', referenceTo: 'Lead', required: true, filterable: true, width: 'half', showInGrid: true },
        { name: 'Type', label: 'Activity Type', type: 'enum', options: ['Call', 'Email', 'Meeting', 'Demo', 'Follow-up', 'Task', 'Note'], required: true, filterable: true, width: 'half', showInGrid: true },
        { name: 'Status', label: 'Status', type: 'enum', options: ['Planned', 'Completed', 'Cancelled'], defaultValue: 'Planned', filterable: true, width: 'half', showInGrid: true },
        { name: 'DueDate', label: 'Due Date', type: 'datetime', sortable: true, width: 'half', showInGrid: true },
        { name: 'Owner', label: 'Owner', type: 'user', filterable: true, width: 'half', showInGrid: true },
        { name: 'Notes', label: 'Notes', type: 'text', width: 'full', showInGrid: false },
      ],
    },
  ],

  // ─── Views ──────────────────────────────────────────────────────────────────
  views: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
    { id: 'leads-grid', label: 'Leads', icon: '🎣', type: 'grid', object: 'Lead' },
    { id: 'leads-kanban', label: 'Pipeline', icon: '📋', type: 'kanban', object: 'Lead' },
    { id: 'activities', label: 'Activities', icon: '🔄', type: 'grid', object: 'Activity' },
    { id: 'reports', label: 'Reports', icon: '📈', type: 'report' },
    { id: 'settings', label: 'Settings', icon: '⚙️', type: 'form' },
  ],

  // ─── Sidebar Nav ────────────────────────────────────────────────────────────
  nav: [
    { id: 'nav-dashboard', label: 'Dashboard', icon: '📊', viewId: 'dashboard' },
    { id: 'nav-leads', label: 'Leads', icon: '🎣', viewId: 'leads-grid' },
    { id: 'nav-pipeline', label: 'Pipeline', icon: '📋', viewId: 'leads-kanban' },
    { id: 'nav-activities', label: 'Activities', icon: '🔄', viewId: 'activities' },
    { id: 'nav-reports', label: 'Reports', icon: '📈', viewId: 'reports' },
  ],

  // ─── Dashboards ─────────────────────────────────────────────────────────────
  dashboards: [
    {
      id: 'lead-dashboard',
      label: 'Lead Management Overview',
      description: 'Real-time snapshot of your lead pipeline',
      widgets: [
        { id: 'total-leads', type: 'metric', label: 'Total Leads', icon: '🎣', object: 'Lead', metric: 'count', color: 'indigo', trend: true, size: 'small', format: 'number' },
        { id: 'new-this-week', type: 'metric', label: 'New This Week', icon: '📅', object: 'Lead', metric: 'count', filters: [{ field: 'Stage', operator: 'eq', value: 'New' }], color: 'emerald', trend: true, size: 'small', format: 'number' },
        { id: 'qualified-leads', type: 'metric', label: 'Qualified', icon: '✅', object: 'Lead', metric: 'count', filters: [{ field: 'Stage', operator: 'eq', value: 'Qualified' }], color: 'violet', size: 'small', format: 'number' },
        { id: 'pipeline-value', type: 'metric', label: 'Pipeline Value', icon: '💰', object: 'Lead', metric: 'sum', field: 'Value', color: 'amber', trend: true, size: 'small', format: 'currency' },
        { id: 'leads-by-stage', type: 'bar-chart', label: 'Leads by Stage', object: 'Lead', groupBy: 'Stage', metric: 'count', size: 'medium' },
        { id: 'leads-by-source', type: 'pie-chart', label: 'Leads by Source', object: 'Lead', groupBy: 'Source', metric: 'count', size: 'medium' },
        { id: 'recent-leads', type: 'list', label: 'Recent Leads', object: 'Lead', metric: 'count', limit: 5, size: 'full' },
      ],
    },
  ],

  // ─── Reports ────────────────────────────────────────────────────────────────
  reports: [
    { id: 'pipeline-by-stage', label: 'Pipeline by Stage', icon: '📊', type: 'bar', object: 'Lead', groupBy: 'Stage', metric: 'count', description: 'Count of leads at each pipeline stage' },
    { id: 'leads-by-source', label: 'Leads by Source', icon: '🔵', type: 'pie', object: 'Lead', groupBy: 'Source', metric: 'count', description: 'Distribution of leads across acquisition channels' },
    { id: 'conversion-funnel', label: 'Conversion Funnel', icon: '📉', type: 'funnel', object: 'Lead', groupBy: 'Stage', metric: 'count', description: 'Visual funnel of lead conversion through pipeline' },
  ],

  // ─── AI Skills ──────────────────────────────────────────────────────────────
  ai: {
    assistantName: 'Sales AI',
    assistantDescription: 'Your AI-powered sales assistant for leads and pipeline management.',
    skills: [
      {
        id: 'summarize-lead',
        label: 'Summarize Lead',
        description: 'Generate a concise summary of a lead record',
        intent: 'summarize',
        object: 'Lead',
        scope: 'record',
        outputType: 'text',
        promptTemplate: 'Summarize this lead: {{Name}} from {{Company}}, Stage: {{Stage}}, Source: {{Source}}. Include key talking points and recommended next actions.',
      },
      {
        id: 'score-lead',
        label: 'Score Lead',
        description: 'AI-calculate lead quality score based on available data',
        intent: 'score',
        object: 'Lead',
        scope: 'record',
        outputType: 'json',
        promptTemplate: 'Score this lead 0-100 based on: Company: {{Company}}, Stage: {{Stage}}, Source: {{Source}}, Value: {{Value}}. Return JSON with score and reasoning.',
      },
      {
        id: 'suggest-followup',
        label: 'Suggest Follow-up',
        description: 'Recommend the best next action for a lead',
        intent: 'suggest',
        object: 'Lead',
        scope: 'record',
        outputType: 'text',
        promptTemplate: 'What is the best next action for this lead: {{Name}}, Stage: {{Stage}}, last activity: {{_updatedAt}}?',
      },
      {
        id: 'generate-email',
        label: 'Generate Outreach Email',
        description: 'Write a personalized outreach email for this lead',
        intent: 'generate',
        object: 'Lead',
        scope: 'record',
        outputType: 'text',
        promptTemplate: 'Write a personalized sales outreach email for {{Name}} at {{Company}} ({{Title}}). The email should be professional, concise, and focus on value.',
      },
    ],
  },

  // ─── Workflows ──────────────────────────────────────────────────────────────
  workflows: [
    {
      id: 'createLead',
      label: 'Create Lead',
      trigger: 'manual',
      triggerObject: 'Lead',
      steps: [
        { id: 's1', type: 'action', label: 'Create lead record', config: { action: 'create', object: 'Lead' } },
        { id: 's2', type: 'automation', label: 'Run assignment rules', config: { automation: 'auto-assign' } },
        { id: 's3', type: 'notification', label: 'Notify assignee', config: { template: 'lead-assigned' } },
      ],
    },
    {
      id: 'qualifyLead',
      label: 'Qualify Lead',
      trigger: 'manual',
      triggerObject: 'Lead',
      steps: [
        { id: 's1', type: 'action', label: 'Set stage to Qualified', config: { action: 'update', field: 'Stage', value: 'Qualified' } },
        { id: 's2', type: 'action', label: 'Create follow-up activity', config: { action: 'create', object: 'Activity', data: { Type: 'Follow-up', Status: 'Planned' } } },
        { id: 's3', type: 'notification', label: 'Notify manager', config: { template: 'lead-qualified', recipient: 'Sales Manager' } },
      ],
    },
    {
      id: 'convertLead',
      label: 'Convert Lead to Opportunity',
      trigger: 'manual',
      triggerObject: 'Lead',
      steps: [
        { id: 's1', type: 'action', label: 'Create Opportunity', config: { action: 'create', object: 'Opportunity', mapFields: { Name: 'Name', Company: 'Account', Value: 'Value' } } },
        { id: 's2', type: 'action', label: 'Archive lead', config: { action: 'update', field: 'Stage', value: 'Won' } },
      ],
    },
  ],

  // ─── Automations ────────────────────────────────────────────────────────────
  automations: [
    {
      id: 'auto-assign',
      label: 'Auto-Assign New Leads',
      trigger: 'on-create',
      object: 'Lead',
      conditions: [],
      enabled: true,
      actions: [
        { type: 'set-field', config: { field: 'Owner', value: 'Auto-Assigned' } },
        { type: 'send-notification', config: { message: 'New lead assigned to you', template: 'lead-assigned' } },
      ],
    },
    {
      id: 'score-on-create',
      label: 'Score Lead on Creation',
      trigger: 'on-create',
      object: 'Lead',
      conditions: [],
      enabled: true,
      actions: [
        { type: 'set-field', config: { field: 'Score', value: 50 } },
      ],
    },
    {
      id: 'followup-reminder',
      label: 'Follow-up Reminder',
      trigger: 'on-status-change',
      object: 'Lead',
      conditions: [{ field: 'Stage', operator: 'eq', value: 'Contacted' }],
      enabled: true,
      actions: [
        { type: 'send-notification', config: { message: 'Reminder: Follow up with your lead', template: 'followup-reminder' } },
      ],
    },
  ],

  // ─── Notifications ──────────────────────────────────────────────────────────
  notifications: [
    {
      id: 'lead-assigned',
      label: 'Lead Assigned',
      trigger: 'LeadCreated',
      channel: 'in-app',
      title: 'New Lead Assigned: {{Name}}',
      body: '{{Name}} from {{Company}} has been assigned to you. Stage: {{Stage}}.',
      recipientField: 'Owner',
    },
    {
      id: 'lead-qualified',
      label: 'Lead Qualified',
      trigger: 'LeadQualified',
      channel: 'both',
      title: 'Lead Qualified: {{Name}}',
      body: '{{Name}} from {{Company}} has been marked as Qualified.',
      recipientRole: 'Sales Manager',
    },
  ],

  // ─── Permissions ────────────────────────────────────────────────────────────
  permissions: {
    'Admin': ['view', 'create', 'edit', 'delete', 'export', 'import', 'admin'],
    'Sales Manager': ['view', 'create', 'edit', 'delete', 'export', 'import'],
    'Sales Rep': ['view', 'create', 'edit', 'export'],
    'Viewer': ['view'],
  },

  // ─── Seed Data ──────────────────────────────────────────────────────────────
  seed: {
    objects: [
      {
        object: 'Lead',
        data: [
          {
            Name: 'Sarah Johnson',
            Email: 'sarah.johnson@techinnovate.com',
            Phone: '+1 (415) 555-0142',
            Company: 'TechInnovate Corp',
            Title: 'VP of Engineering',
            Stage: 'Qualified',
            Source: 'LinkedIn',
            Priority: 'High',
            Score: 78,
            Owner: 'Alex (Sales Rep)',
            Value: 45000,
            Notes: 'Expressed strong interest in enterprise plan. Has budget approval. Follow up needed after their board meeting.',
          },
          {
            Name: 'Marcus Chen',
            Email: 'mchen@globalretail.io',
            Phone: '+1 (212) 555-0198',
            Company: 'Global Retail Solutions',
            Title: 'Chief Digital Officer',
            Stage: 'Proposal',
            Source: 'Referral',
            Priority: 'Urgent',
            Score: 92,
            Owner: 'Alex (Sales Rep)',
            Value: 120000,
            Notes: 'Hot prospect. Referred by Acme Corp. Needs custom integration with their ERP. Demo scheduled for next week.',
          },
          {
            Name: 'Priya Nair',
            Email: 'priya.nair@growfast.in',
            Phone: '+91 98765 43210',
            Company: 'GrowFast Ventures',
            Title: 'Founder & CEO',
            Stage: 'New',
            Source: 'Website',
            Priority: 'Medium',
            Score: 41,
            Owner: null,
            Value: 15000,
            Notes: 'Downloaded our whitepaper. Startup in Series A. Evaluating multiple solutions.',
          },
        ],
      },
      {
        object: 'Activity',
        data: [
          {
            Subject: 'Discovery Call with Sarah Johnson',
            LeadId: null, // will be linked after seed
            Type: 'Call',
            Status: 'Completed',
            Notes: 'Discussed pain points with current CRM. Very interested in automation features.',
          },
          {
            Subject: 'Send proposal to Marcus Chen',
            LeadId: null,
            Type: 'Task',
            Status: 'Planned',
            Notes: 'Prepare custom proposal with ERP integration pricing.',
          },
        ],
      },
    ],
  },

  // ─── Search Config ──────────────────────────────────────────────────────────
  search: {
    objects: [
      {
        object: 'Lead',
        fields: ['Name', 'Email', 'Company', 'Phone', 'Title'],
        titleField: 'Name',
        subtitleField: 'Company',
        icon: '🎣',
      },
      {
        object: 'Activity',
        fields: ['Subject', 'Notes'],
        titleField: 'Subject',
        subtitleField: 'Type',
        icon: '🔄',
      },
    ],
  },

  // ─── Settings Schema ────────────────────────────────────────────────────────
  settings: [
    { key: 'lead_sources', label: 'Lead Sources', type: 'multi-enum', defaultValue: ['Website', 'LinkedIn', 'Referral', 'Cold Outreach', 'Event', 'Google Ads', 'Facebook', 'Partner', 'Other'], group: 'Data' },
    { key: 'pipeline_stages', label: 'Pipeline Stages', type: 'multi-enum', defaultValue: ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'], group: 'Pipeline' },
    { key: 'auto_assign', label: 'Auto-Assign Leads', type: 'boolean', defaultValue: true, description: 'Automatically assign new leads to available sales reps', group: 'Automation' },
    { key: 'lead_score_threshold', label: 'Qualify Score Threshold', type: 'number', defaultValue: 60, description: 'Auto-qualify leads scoring above this value', group: 'Scoring' },
    { key: 'duplicate_detection', label: 'Duplicate Detection', type: 'boolean', defaultValue: true, description: 'Flag potential duplicate leads based on email match', group: 'Data Quality' },
    { key: 'ai_scoring', label: 'AI Lead Scoring', type: 'boolean', defaultValue: true, description: 'Use AI to automatically score incoming leads', group: 'AI' },
  ],

  // ─── Integrations ───────────────────────────────────────────────────────────
  integrations: [
    { id: 'csv-import', label: 'CSV Import', type: 'csv-import', description: 'Bulk import leads from a CSV file' },
    { id: 'rest-api', label: 'REST API', type: 'rest-api', description: 'Access lead data via REST API endpoints' },
    { id: 'webhook', label: 'Webhooks', type: 'webhook', description: 'Send lead events to external systems' },
    { id: 'zapier', label: 'Zapier', type: 'zapier', description: 'Connect Lead Management to 5000+ apps via Zapier' },
  ],
};
