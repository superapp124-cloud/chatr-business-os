/**
 * CHATR OS — Static Capability Catalog (Frontend)
 * 
 * This file is a copy of the server-side StaticCapabilityRegistry data,
 * but exported as a plain JS array so the frontend marketplace works
 * completely independently of whether the backend server is running.
 * 
 * The backend server enriches this data at runtime (e.g. live install counts,
 * personalised recommendations), but the core catalog is always available.
 */

export interface IObjectField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'reference' | 'user';
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  readonly?: boolean;
  defaultValue?: any;
  placeholder?: string;
  helpText?: string;
  width?: 'full' | 'half' | 'third';
  displayFormat?: string;
  options?: string[];
  referenceTo?: string;
  required?: boolean;
}

export interface IObjectSchema {
  name: string;
  pluralName: string;
  icon: string;
  fields: IObjectField[];
  titleField: string;
  statusField?: string;
  views: string[];
  permissions?: string[];
  actions?: string[];
  relations?: any[];
  ai?: { summarize?: boolean; suggest?: boolean; generate?: boolean; analyze?: boolean; predict?: boolean };
}

export interface ICapabilityManifest {
  id: string;
  name: string;
  description: string;
  department: string;
  category: string;
  version: string;
  maturity: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  icon: string;
  rating: number;
  installs: number;
  verbs: string[];
  nouns: string[];
  permissions: string[];
  eventsProduced?: string[];
  eventsConsumed?: string[];
  dependencies?: string[];
  configSchema: any[];
  objectSchemas?: IObjectSchema[];
  tags: string[];
}

const CATALOG: ICapabilityManifest[] = [
  // ─── EXECUTIVE & STRATEGY ─────────────────────────────────────────────────
  {
    id: 'Executive.CEOOffice', name: 'CEO Office',
    description: 'Executive command center with board-ready dashboards, strategic KPIs, investor metrics, and direct-report management.',
    department: 'Executive Office', category: 'Executive & Strategy', version: '2.1.0', maturity: 'L5', icon: '👑', rating: 4.9, installs: 8200,
    verbs: ['review', 'approve', 'delegate', 'monitor'], nouns: ['kpi', 'report', 'directive', 'board'],
    permissions: ['executive.all'], eventsProduced: ['DirectiveIssued', 'ReviewCompleted'], tags: ['executive', 'ceo', 'strategy', 'board'],
    configSchema: [
      { key: 'board_members', label: 'Board Members', type: 'text', defaultValue: '', group: 'Board' },
      { key: 'fiscal_year_start', label: 'Fiscal Year Start', type: 'select', defaultValue: 'January', options: ['January', 'April', 'July', 'October'], group: 'Finance' },
      { key: 'reporting_currency', label: 'Currency', type: 'select', defaultValue: 'USD', options: ['USD', 'EUR', 'GBP', 'INR'], group: 'Finance' },
    ],
    objectSchemas: [
      {
        name: 'KPI', pluralName: 'KPIs', icon: '📊', titleField: 'Name', statusField: 'Status', views: ['Grid', 'Dashboard'],
        fields: [
          { name: 'Name', label: 'KPI Name', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Value', label: 'Current Value', type: 'number', required: true, width: 'half' },
          { name: 'Target', label: 'Target Value', type: 'number', required: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['On Track', 'At Risk', 'Off Track'], defaultValue: 'On Track', filterable: true, width: 'half' },
          { name: 'Owner', label: 'Owner', type: 'user', filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Executive.OKRGoals', name: 'OKR & Goals',
    description: 'Company-wide OKR management with cascading goals, check-in cadences, progress tracking, and AI-powered outcome predictions.',
    department: 'Executive Office', category: 'Executive & Strategy', version: '1.8.0', maturity: 'L5', icon: '🎯', rating: 4.8, installs: 19400,
    verbs: ['set', 'align', 'track', 'check-in', 'grade'], nouns: ['okr', 'objective', 'key result', 'initiative'],
    permissions: ['executive.okr.create', 'executive.okr.read'], eventsProduced: ['OKRCreated', 'CheckInLogged', 'GoalAchieved'],
    tags: ['okr', 'goals', 'strategy', 'performance'],
    configSchema: [
      { key: 'okr_cycle', label: 'OKR Cycle', type: 'select', defaultValue: 'Quarterly', options: ['Monthly', 'Quarterly', 'Annually'], group: 'Schedule' },
      { key: 'grading_scale', label: 'Grading Scale', type: 'select', defaultValue: '0-1.0', options: ['0-1.0', '0-100%', 'RAG', 'Stars'], group: 'Scoring' },
      { key: 'cascade_levels', label: 'Cascade Levels', type: 'number', defaultValue: 3, group: 'Hierarchy' },
      { key: 'ai_predictions', label: 'AI Outcome Predictions', type: 'boolean', defaultValue: true, group: 'AI' },
      { key: 'checkin_frequency', label: 'Check-in Frequency', type: 'select', defaultValue: 'Weekly', options: ['Daily', 'Weekly', 'Bi-weekly'], group: 'Cadence' },
    ],
    objectSchemas: [
      {
        name: 'Objective', pluralName: 'Objectives', icon: '🎯', titleField: 'Title', statusField: 'Status',
        views: ['Grid', 'Timeline', 'Dashboard'],
        permissions: ['executive.okr.create', 'executive.okr.read', 'executive.okr.update'],
        actions: ['Check-in', 'Align', 'Close'],
        ai: { summarize: true, suggest: true, generate: true, predict: true },
        fields: [
          { name: 'Title', label: 'Objective Title', type: 'string', required: true, searchable: true, sortable: true, width: 'full', placeholder: 'Enter an inspiring goal...' },
          { name: 'Owner', label: 'Owner', type: 'user', required: true, filterable: true, sortable: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Draft', 'Active', 'At Risk', 'Off Track', 'Completed'], defaultValue: 'Draft', filterable: true, width: 'half' },
          { name: 'Progress', label: 'Overall Progress', type: 'number', readonly: true, displayFormat: 'percentage', width: 'half' },
          { name: 'StartDate', label: 'Start Date', type: 'date', sortable: true, width: 'half' },
          { name: 'EndDate', label: 'Target Date', type: 'date', sortable: true, width: 'half' },
          { name: 'Priority', label: 'Priority', type: 'enum', options: ['P0', 'P1', 'P2', 'P3'], defaultValue: 'P1', filterable: true, width: 'half' },
        ]
      },
      {
        name: 'KeyResult', pluralName: 'Key Results', icon: '📈', titleField: 'Title', statusField: 'Status', views: ['Grid', 'Dashboard'],
        fields: [
          { name: 'Title', label: 'Key Result', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'ObjectiveId', label: 'Parent Objective', type: 'reference', referenceTo: 'Objective', required: true, filterable: true, width: 'full' },
          { name: 'Owner', label: 'Owner', type: 'user', required: true, filterable: true, width: 'half' },
          { name: 'CurrentValue', label: 'Current Value', type: 'number', required: true, width: 'third' },
          { name: 'TargetValue', label: 'Target Value', type: 'number', required: true, width: 'third' },
          { name: 'Unit', label: 'Unit', type: 'string', defaultValue: '%', width: 'third' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['On Track', 'At Risk', 'Off Track'], defaultValue: 'On Track', filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Executive.StrategicPlanning', name: 'Strategic Planning',
    description: 'Long-range planning workspace with SWOT analysis, scenario modeling, initiative roadmaps, and strategy-to-execution linkage.',
    department: 'Executive Office', category: 'Executive & Strategy', version: '1.2.0', maturity: 'L4', icon: '🗺️', rating: 4.7, installs: 5100,
    verbs: ['plan', 'model', 'forecast', 'analyze'], nouns: ['strategy', 'initiative', 'roadmap', 'scenario'],
    permissions: ['executive.strategy.create'], tags: ['strategy', 'planning', 'roadmap', 'scenarios'],
    configSchema: [
      { key: 'planning_horizon', label: 'Planning Horizon (years)', type: 'number', defaultValue: 3, group: 'Planning' },
      { key: 'scenario_count', label: 'Scenarios per Plan', type: 'number', defaultValue: 3, group: 'Planning' },
    ],
    objectSchemas: [
      {
        name: 'Initiative', pluralName: 'Initiatives', icon: '🚀', titleField: 'Name', statusField: 'Status', views: ['Grid', 'Gantt'],
        fields: [
          { name: 'Name', label: 'Initiative Name', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Idea', 'Planning', 'Active', 'Completed', 'Cancelled'], defaultValue: 'Idea', filterable: true, width: 'half' },
          { name: 'Owner', label: 'Owner', type: 'user', width: 'half' },
          { name: 'StartDate', label: 'Start Date', type: 'date', width: 'half' },
          { name: 'EndDate', label: 'End Date', type: 'date', width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Executive.BoardManagement', name: 'Board Management',
    description: 'Board meeting management with agenda builder, board packs, resolution tracking, and director portal.',
    department: 'Executive Office', category: 'Executive & Strategy', version: '1.0.0', maturity: 'L4', icon: '🏛️', rating: 4.6, installs: 3200,
    verbs: ['schedule', 'prepare', 'vote', 'archive'], nouns: ['board', 'agenda', 'resolution', 'director'],
    permissions: ['executive.board.manage'], tags: ['board', 'governance', 'meetings'],
    configSchema: [{ key: 'board_size', label: 'Board Size', type: 'number', defaultValue: 7, group: 'Board' }],
    objectSchemas: [
      {
        name: 'BoardMeeting', pluralName: 'Board Meetings', icon: '🏛️', titleField: 'Title', views: ['Grid', 'Calendar'],
        fields: [
          { name: 'Title', label: 'Meeting Title', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Date', label: 'Meeting Date', type: 'date', required: true, sortable: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Scheduled', 'In Progress', 'Completed'], defaultValue: 'Scheduled', filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Executive.RiskManagement', name: 'Risk Management',
    description: 'Enterprise risk register with impact/likelihood scoring, mitigation tracking, and executive risk dashboard.',
    department: 'Executive Office', category: 'Executive & Strategy', version: '1.3.0', maturity: 'L4', icon: '⚠️', rating: 4.7, installs: 6700,
    verbs: ['identify', 'assess', 'mitigate', 'monitor'], nouns: ['risk', 'control', 'impact', 'likelihood'],
    permissions: ['executive.risk.manage'], tags: ['risk', 'compliance', 'governance'],
    configSchema: [{ key: 'risk_matrix_size', label: 'Risk Matrix', type: 'select', defaultValue: '5x5', options: ['3x3', '4x4', '5x5'], group: 'Matrix' }],
    objectSchemas: [
      {
        name: 'Risk', pluralName: 'Risks', icon: '⚠️', titleField: 'Title', statusField: 'Status', views: ['Grid', 'Dashboard'],
        fields: [
          { name: 'Title', label: 'Risk Title', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Open', 'Mitigating', 'Accepted', 'Closed'], defaultValue: 'Open', filterable: true, width: 'half' },
          { name: 'Impact', label: 'Impact', type: 'enum', options: ['Low', 'Medium', 'High', 'Critical'], filterable: true, width: 'half' },
          { name: 'Likelihood', label: 'Likelihood', type: 'enum', options: ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'], filterable: true, width: 'half' },
          { name: 'Owner', label: 'Risk Owner', type: 'user', filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Executive.DecisionTracker', name: 'Decision Tracker',
    description: 'Capture, log, and track strategic decisions with full audit trail, decision rationale, and outcome measurement.',
    department: 'Executive Office', category: 'Executive & Strategy', version: '1.1.0', maturity: 'L3', icon: '⚖️', rating: 4.5, installs: 4100,
    verbs: ['decide', 'log', 'review', 'reverse'], nouns: ['decision', 'rationale', 'outcome', 'stakeholder'],
    permissions: ['executive.decisions.create'], tags: ['decisions', 'governance', 'audit'],
    configSchema: [],
    objectSchemas: [
      {
        name: 'Decision', pluralName: 'Decisions', icon: '⚖️', titleField: 'Title', statusField: 'Status', views: ['Grid'],
        fields: [
          { name: 'Title', label: 'Decision', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Rationale', label: 'Rationale', type: 'string', width: 'full' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Proposed', 'Approved', 'Rejected', 'Reversed'], defaultValue: 'Proposed', filterable: true, width: 'half' },
          { name: 'DecisionDate', label: 'Decision Date', type: 'date', sortable: true, width: 'half' },
          { name: 'Owner', label: 'Decision Maker', type: 'user', required: true, width: 'half' },
        ]
      }
    ]
  },

  // ─── CRM & SALES ────────────────────────────────────────────────────────────
  {
    id: 'CRM.LeadManagement', name: 'Lead Management',
    description: 'Capture, score, and qualify leads from all channels with AI lead scoring, routing rules, and conversion analytics.',
    department: 'Sales', category: 'CRM & Sales', version: '2.4.0', maturity: 'L5', icon: '🎣', rating: 4.8, installs: 24600,
    verbs: ['capture', 'score', 'qualify', 'assign'], nouns: ['lead', 'prospect', 'score', 'source'],
    permissions: ['crm.leads.create', 'crm.leads.read'], eventsProduced: ['LeadCreated', 'LeadQualified'],
    tags: ['leads', 'sales', 'crm', 'pipeline'],
    configSchema: [
      { key: 'auto_assign', label: 'Auto-Assign Leads', type: 'boolean', defaultValue: true, group: 'Routing' },
      { key: 'lead_score_threshold', label: 'Qualify Score Threshold', type: 'number', defaultValue: 60, group: 'Scoring' },
    ],
    objectSchemas: [
      {
        name: 'Lead', pluralName: 'Leads', icon: '🎣', titleField: 'Name', statusField: 'Stage', views: ['Grid', 'Kanban'],
        ai: { summarize: true, predict: true },
        fields: [
          { name: 'Name', label: 'Lead Name', type: 'string', required: true, searchable: true, sortable: true, width: 'full' },
          { name: 'Email', label: 'Email', type: 'string', required: true, searchable: true, width: 'half' },
          { name: 'Company', label: 'Company', type: 'string', searchable: true, width: 'half' },
          { name: 'Stage', label: 'Stage', type: 'enum', options: ['New', 'Contacted', 'Qualified', 'Unqualified'], defaultValue: 'New', filterable: true, width: 'half' },
          { name: 'Score', label: 'Lead Score', type: 'number', readonly: true, width: 'half' },
          { name: 'Owner', label: 'Assigned To', type: 'user', filterable: true, width: 'half' },
          { name: 'Source', label: 'Source', type: 'enum', options: ['Website', 'LinkedIn', 'Referral', 'Cold Outreach', 'Event', 'Other'], filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'CRM.OpportunityManagement', name: 'Opportunity Management',
    description: 'Track deals through your pipeline with weighted forecasting, activity timeline, and competitor tracking.',
    department: 'Sales', category: 'CRM & Sales', version: '2.1.0', maturity: 'L5', icon: '💼', rating: 4.9, installs: 31200,
    verbs: ['open', 'advance', 'close', 'forecast'], nouns: ['opportunity', 'deal', 'stage', 'forecast'],
    permissions: ['crm.opportunities.create', 'crm.opportunities.read'], eventsProduced: ['DealCreated', 'DealWon', 'DealLost'],
    tags: ['pipeline', 'deals', 'forecasting', 'crm'],
    configSchema: [
      { key: 'pipeline_stages', label: 'Pipeline Stages', type: 'text', defaultValue: 'Prospecting,Qualification,Proposal,Negotiation,Closed Won,Closed Lost', group: 'Pipeline' },
      { key: 'forecast_method', label: 'Forecast Method', type: 'select', defaultValue: 'Weighted', options: ['Weighted', 'Best Case', 'Commit'], group: 'Forecasting' },
    ],
    objectSchemas: [
      {
        name: 'Opportunity', pluralName: 'Opportunities', icon: '💼', titleField: 'Name', statusField: 'Stage', views: ['Grid', 'Kanban'],
        actions: ['Win', 'Lose', 'Advance'], ai: { summarize: true, predict: true },
        fields: [
          { name: 'Name', label: 'Opportunity Name', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Account', label: 'Account', type: 'reference', referenceTo: 'Account', required: true, searchable: true, width: 'half' },
          { name: 'Stage', label: 'Stage', type: 'enum', options: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'], defaultValue: 'Prospecting', filterable: true, width: 'half' },
          { name: 'Value', label: 'Value ($)', type: 'number', required: true, sortable: true, width: 'half' },
          { name: 'Probability', label: 'Close Probability (%)', type: 'number', width: 'half' },
          { name: 'CloseDate', label: 'Expected Close', type: 'date', required: true, sortable: true, width: 'half' },
          { name: 'Owner', label: 'Account Executive', type: 'user', required: true, filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'CRM.Accounts', name: 'Accounts',
    description: 'Complete account management with company profiles, relationship mapping, and 360° account intelligence.',
    department: 'Sales', category: 'CRM & Sales', version: '2.0.0', maturity: 'L5', icon: '🏢', rating: 4.7, installs: 28900,
    verbs: ['create', 'enrich', 'manage', 'analyze'], nouns: ['account', 'company', 'contact', 'relationship'],
    permissions: ['crm.accounts.create', 'crm.accounts.read'], eventsProduced: ['AccountCreated', 'AccountUpdated'],
    tags: ['accounts', 'crm', 'companies', 'b2b'],
    configSchema: [{ key: 'account_enrichment', label: 'Auto-Enrich from LinkedIn', type: 'boolean', defaultValue: true, group: 'Enrichment' }],
    objectSchemas: [
      {
        name: 'Account', pluralName: 'Accounts', icon: '🏢', titleField: 'Name', statusField: 'Status', views: ['Grid', 'Dashboard'],
        fields: [
          { name: 'Name', label: 'Account Name', type: 'string', required: true, searchable: true, sortable: true, width: 'full' },
          { name: 'Industry', label: 'Industry', type: 'enum', options: ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Other'], filterable: true, width: 'half' },
          { name: 'Size', label: 'Company Size', type: 'enum', options: ['1-10', '11-50', '51-200', '201-1000', '1000+'], filterable: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Prospect', 'Customer', 'Partner', 'Inactive'], defaultValue: 'Prospect', filterable: true, width: 'half' },
          { name: 'Owner', label: 'Account Owner', type: 'user', required: true, filterable: true, width: 'half' },
          { name: 'AnnualRevenue', label: 'Annual Revenue ($)', type: 'number', sortable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'CRM.Contacts', name: 'Contacts',
    description: 'Unified contact database with interaction history, relationship scoring, and cross-app contact sync.',
    department: 'Sales', category: 'CRM & Sales', version: '2.0.0', maturity: 'L5', icon: '👤', rating: 4.8, installs: 35400,
    verbs: ['add', 'enrich', 'search', 'merge'], nouns: ['contact', 'person', 'email', 'phone'],
    permissions: ['crm.contacts.create', 'crm.contacts.read'], eventsProduced: ['ContactCreated'],
    tags: ['contacts', 'crm', 'people'],
    configSchema: [{ key: 'duplicate_detection', label: 'Duplicate Detection', type: 'boolean', defaultValue: true, group: 'Data Quality' }],
    objectSchemas: [
      {
        name: 'Contact', pluralName: 'Contacts', icon: '👤', titleField: 'Name', views: ['Grid'],
        fields: [
          { name: 'Name', label: 'Full Name', type: 'string', required: true, searchable: true, sortable: true, width: 'full' },
          { name: 'Email', label: 'Email', type: 'string', required: true, searchable: true, width: 'half' },
          { name: 'Phone', label: 'Phone', type: 'string', width: 'half' },
          { name: 'Title', label: 'Job Title', type: 'string', searchable: true, width: 'half' },
          { name: 'Account', label: 'Account', type: 'reference', referenceTo: 'Account', filterable: true, width: 'half' },
          { name: 'Owner', label: 'Owner', type: 'user', filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'CRM.SalesPipeline', name: 'Sales Pipeline',
    description: 'Visual pipeline management with drag-and-drop Kanban, velocity tracking, and bottleneck analysis.',
    department: 'Sales', category: 'CRM & Sales', version: '1.9.0', maturity: 'L5', icon: '🚀', rating: 4.9, installs: 29800,
    verbs: ['view', 'move', 'analyze', 'forecast'], nouns: ['pipeline', 'stage', 'velocity', 'conversion'],
    permissions: ['crm.pipeline.read'], eventsProduced: [], tags: ['pipeline', 'kanban', 'sales'],
    configSchema: [{ key: 'pipeline_view', label: 'Default View', type: 'select', defaultValue: 'Kanban', options: ['Kanban', 'List', 'Forecast'], group: 'Display' }],
    objectSchemas: []
  },
  {
    id: 'CRM.Quotations', name: 'Quotations',
    description: 'Professional quote builder with product catalog, pricing rules, approval workflows, and e-signature.',
    department: 'Sales', category: 'CRM & Sales', version: '1.5.0', maturity: 'L4', icon: '📋', rating: 4.6, installs: 12300,
    verbs: ['draft', 'send', 'approve', 'convert'], nouns: ['quote', 'proposal', 'pricing', 'product'],
    permissions: ['crm.quotes.create'], eventsProduced: ['QuoteCreated', 'QuoteSent', 'QuoteAccepted'],
    tags: ['quotes', 'proposals', 'pricing'],
    configSchema: [{ key: 'approval_required', label: 'Require Approval > $', type: 'number', defaultValue: 10000, group: 'Approvals' }],
    objectSchemas: [
      {
        name: 'Quote', pluralName: 'Quotes', icon: '📋', titleField: 'Title', statusField: 'Status', views: ['Grid'],
        fields: [
          { name: 'Title', label: 'Quote Title', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Account', label: 'Account', type: 'reference', referenceTo: 'Account', required: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'], defaultValue: 'Draft', filterable: true, width: 'half' },
          { name: 'Total', label: 'Total Value ($)', type: 'number', sortable: true, width: 'half' },
          { name: 'ValidUntil', label: 'Valid Until', type: 'date', sortable: true, width: 'half' },
          { name: 'Owner', label: 'Created By', type: 'user', filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'CRM.CustomerSuccess', name: 'Customer Success',
    description: 'Customer health scoring, churn prediction, expansion tracking, and CS playbook automation.',
    department: 'Sales', category: 'CRM & Sales', version: '1.4.0', maturity: 'L4', icon: '💚', rating: 4.7, installs: 9800,
    verbs: ['track', 'intervene', 'expand', 'renew'], nouns: ['customer', 'health', 'churn', 'nps'],
    permissions: ['crm.cs.manage'], eventsProduced: ['ChurnRisk', 'RenewalDue'],
    tags: ['customer-success', 'churn', 'nps', 'renewal'],
    configSchema: [{ key: 'health_score_method', label: 'Health Score Method', type: 'select', defaultValue: 'Composite', options: ['Composite', 'Usage-only', 'NPS-only'], group: 'Scoring' }],
    objectSchemas: [
      {
        name: 'CustomerAccount', pluralName: 'Customer Accounts', icon: '💚', titleField: 'Name', views: ['Grid'],
        fields: [
          { name: 'Name', label: 'Account Name', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'HealthScore', label: 'Health Score', type: 'number', displayFormat: 'percentage', readonly: true, width: 'half' },
          { name: 'ARR', label: 'ARR ($)', type: 'number', sortable: true, width: 'half' },
          { name: 'RenewalDate', label: 'Renewal Date', type: 'date', sortable: true, width: 'half' },
          { name: 'CSM', label: 'Customer Success Manager', type: 'user', filterable: true, width: 'half' },
        ]
      }
    ]
  },

  // ─── RECRUITMENT & HR ────────────────────────────────────────────────────────
  {
    id: 'HR.ATS', name: 'Applicant Tracking',
    description: 'End-to-end recruitment pipeline with job postings, candidate tracking, interview scheduling, and offer management.',
    department: 'Human Resources', category: 'Recruitment & HR', version: '2.0.0', maturity: 'L5', icon: '📋', rating: 4.8, installs: 18700,
    verbs: ['post', 'apply', 'screen', 'interview', 'offer'], nouns: ['job', 'candidate', 'interview', 'offer'],
    permissions: ['hr.ats.manage'], eventsProduced: ['CandidateApplied', 'OfferMade', 'HireCompleted'],
    tags: ['ats', 'recruitment', 'hiring', 'candidates'],
    configSchema: [
      { key: 'careers_page_url', label: 'Careers Page URL', type: 'url', defaultValue: '', group: 'Branding' },
      { key: 'auto_screen_resumes', label: 'AI Resume Screening', type: 'boolean', defaultValue: true, group: 'AI' },
    ],
    objectSchemas: [
      {
        name: 'JobRequisition', pluralName: 'Job Requisitions', icon: '📋', titleField: 'Title', statusField: 'Status', views: ['Grid', 'Kanban'],
        fields: [
          { name: 'Title', label: 'Job Title', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Department', label: 'Department', type: 'string', filterable: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Open', 'Interviewing', 'Offer Sent', 'Closed', 'On Hold'], defaultValue: 'Open', filterable: true, width: 'half' },
          { name: 'HiringManager', label: 'Hiring Manager', type: 'user', filterable: true, width: 'half' },
          { name: 'OpenDate', label: 'Open Date', type: 'date', sortable: true, width: 'half' },
          { name: 'Applications', label: 'Total Applications', type: 'number', readonly: true, width: 'half' },
        ]
      },
      {
        name: 'Candidate', pluralName: 'Candidates', icon: '👤', titleField: 'Name', statusField: 'Stage', views: ['Grid', 'Kanban'],
        fields: [
          { name: 'Name', label: 'Candidate Name', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Email', label: 'Email', type: 'string', required: true, searchable: true, width: 'half' },
          { name: 'Stage', label: 'Pipeline Stage', type: 'enum', options: ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'], defaultValue: 'Applied', filterable: true, width: 'half' },
          { name: 'JobRequisition', label: 'Applied For', type: 'reference', referenceTo: 'JobRequisition', filterable: true, width: 'full' },
          { name: 'Recruiter', label: 'Recruiter', type: 'user', filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'HR.EmployeeDirectory', name: 'Employee Directory',
    description: 'Comprehensive employee profiles with org chart, skills inventory, and contact directory.',
    department: 'Human Resources', category: 'Recruitment & HR', version: '2.2.0', maturity: 'L5', icon: '👥', rating: 4.7, installs: 22100,
    verbs: ['view', 'search', 'update', 'export'], nouns: ['employee', 'profile', 'department', 'org-chart'],
    permissions: ['hr.directory.read'], eventsProduced: ['EmployeeJoined', 'EmployeeUpdated'],
    tags: ['employees', 'directory', 'org-chart', 'hr'],
    configSchema: [{ key: 'show_salaries', label: 'Show Salary Bands', type: 'boolean', defaultValue: false, group: 'Privacy' }],
    objectSchemas: [
      {
        name: 'Employee', pluralName: 'Employees', icon: '👥', titleField: 'Name', views: ['Grid'],
        fields: [
          { name: 'Name', label: 'Full Name', type: 'string', required: true, searchable: true, sortable: true, width: 'full' },
          { name: 'Email', label: 'Work Email', type: 'string', required: true, searchable: true, width: 'half' },
          { name: 'Department', label: 'Department', type: 'string', filterable: true, sortable: true, width: 'half' },
          { name: 'Title', label: 'Job Title', type: 'string', searchable: true, width: 'half' },
          { name: 'Manager', label: 'Manager', type: 'user', filterable: true, width: 'half' },
          { name: 'StartDate', label: 'Start Date', type: 'date', sortable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'HR.Attendance', name: 'Attendance',
    description: 'Time tracking, shift scheduling, overtime management, and biometric integration.',
    department: 'Human Resources', category: 'Recruitment & HR', version: '1.7.0', maturity: 'L4', icon: '🕐', rating: 4.5, installs: 14200,
    verbs: ['clock-in', 'clock-out', 'approve', 'report'], nouns: ['attendance', 'shift', 'overtime', 'leave'],
    permissions: ['hr.attendance.manage'], eventsProduced: ['ClockIn', 'ClockOut', 'ShiftStarted'],
    tags: ['attendance', 'timekeeping', 'shifts', 'payroll'],
    configSchema: [
      { key: 'work_hours', label: 'Standard Work Hours/Day', type: 'number', defaultValue: 8, group: 'Schedule' },
      { key: 'overtime_threshold', label: 'Overtime After (hours)', type: 'number', defaultValue: 40, group: 'Overtime' },
    ],
    objectSchemas: [
      {
        name: 'AttendanceRecord', pluralName: 'Attendance Records', icon: '🕐', titleField: 'EmployeeName', views: ['Grid'],
        fields: [
          { name: 'EmployeeName', label: 'Employee', type: 'user', required: true, filterable: true, width: 'half' },
          { name: 'Date', label: 'Date', type: 'date', required: true, sortable: true, width: 'half' },
          { name: 'ClockIn', label: 'Clock In', type: 'string', width: 'half' },
          { name: 'ClockOut', label: 'Clock Out', type: 'string', width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Present', 'Absent', 'Late', 'Half Day', 'Holiday'], filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'HR.LeaveManagement', name: 'Leave Management',
    description: 'Leave policy configuration, request workflows, approval chains, and leave balance tracking.',
    department: 'Human Resources', category: 'Recruitment & HR', version: '1.6.0', maturity: 'L4', icon: '🌴', rating: 4.6, installs: 16800,
    verbs: ['apply', 'approve', 'reject', 'balance'], nouns: ['leave', 'vacation', 'policy', 'balance'],
    permissions: ['hr.leave.manage'], eventsProduced: ['LeaveRequested', 'LeaveApproved', 'LeaveRejected'],
    tags: ['leave', 'vacation', 'pto', 'hr'],
    configSchema: [
      { key: 'annual_leave_days', label: 'Annual Leave Days', type: 'number', defaultValue: 20, group: 'Policy' },
      { key: 'sick_leave_days', label: 'Sick Leave Days', type: 'number', defaultValue: 10, group: 'Policy' },
    ],
    objectSchemas: [
      {
        name: 'LeaveRequest', pluralName: 'Leave Requests', icon: '🌴', titleField: 'EmployeeName', statusField: 'Status', views: ['Grid', 'Calendar'],
        fields: [
          { name: 'EmployeeName', label: 'Employee', type: 'user', required: true, filterable: true, width: 'half' },
          { name: 'LeaveType', label: 'Leave Type', type: 'enum', options: ['Annual', 'Sick', 'Maternity', 'Paternity', 'Unpaid', 'Other'], required: true, filterable: true, width: 'half' },
          { name: 'StartDate', label: 'From', type: 'date', required: true, sortable: true, width: 'half' },
          { name: 'EndDate', label: 'To', type: 'date', required: true, sortable: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Pending', 'Approved', 'Rejected', 'Cancelled'], defaultValue: 'Pending', filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'HR.PerformanceReviews', name: 'Performance Reviews',
    description: '360° performance reviews with goal alignment, calibration, rating normalization, and review cycle management.',
    department: 'Human Resources', category: 'Recruitment & HR', version: '1.5.0', maturity: 'L4', icon: '⭐', rating: 4.6, installs: 11200,
    verbs: ['review', 'rate', 'calibrate', 'submit'], nouns: ['review', 'rating', 'feedback', 'calibration'],
    permissions: ['hr.performance.manage'], eventsProduced: ['ReviewCompleted', 'RatingSubmitted'],
    tags: ['performance', 'reviews', '360', 'hr'],
    configSchema: [{ key: 'review_cycle', label: 'Review Cycle', type: 'select', defaultValue: 'Annual', options: ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'], group: 'Schedule' }],
    objectSchemas: []
  },
  {
    id: 'HR.Onboarding', name: 'Employee Onboarding',
    description: 'Structured onboarding workflows with task checklists, document collection, equipment provisioning, and 30-60-90 day plans.',
    department: 'Human Resources', category: 'Recruitment & HR', version: '1.4.0', maturity: 'L4', icon: '🎉', rating: 4.7, installs: 13500,
    verbs: ['onboard', 'assign', 'complete', 'verify'], nouns: ['onboarding', 'task', 'document', 'equipment'],
    permissions: ['hr.onboarding.manage'], eventsProduced: ['OnboardingStarted', 'OnboardingCompleted'],
    tags: ['onboarding', 'new-hire', 'hr'],
    configSchema: [],
    objectSchemas: []
  },

  // ─── FINANCE ────────────────────────────────────────────────────────────────
  {
    id: 'Finance.Expenses', name: 'Expenses',
    description: 'Employee expense management with receipt OCR, policy enforcement, multi-currency support, and approval workflows.',
    department: 'Finance', category: 'Finance', version: '2.0.0', maturity: 'L5', icon: '💳', rating: 4.7, installs: 27300,
    verbs: ['submit', 'approve', 'reject', 'reimburse'], nouns: ['expense', 'receipt', 'reimbursement', 'policy'],
    permissions: ['finance.expenses.submit'], eventsProduced: ['ExpenseSubmitted', 'ExpenseApproved', 'ExpenseReimbursed'],
    tags: ['expenses', 'finance', 'receipts', 'reimbursement'],
    configSchema: [
      { key: 'max_claim_without_receipt', label: 'Max Claim Without Receipt ($)', type: 'number', defaultValue: 25, group: 'Policy' },
      { key: 'auto_approve_below', label: 'Auto-Approve Below ($)', type: 'number', defaultValue: 50, group: 'Automation' },
    ],
    objectSchemas: [
      {
        name: 'ExpenseClaim', pluralName: 'Expense Claims', icon: '💳', titleField: 'Description', statusField: 'Status', views: ['Grid'],
        fields: [
          { name: 'Description', label: 'Description', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Amount', label: 'Amount ($)', type: 'number', required: true, sortable: true, width: 'half' },
          { name: 'Category', label: 'Category', type: 'enum', options: ['Travel', 'Meals', 'Equipment', 'Software', 'Training', 'Other'], required: true, filterable: true, width: 'half' },
          { name: 'Date', label: 'Date', type: 'date', required: true, sortable: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Reimbursed'], defaultValue: 'Draft', filterable: true, width: 'half' },
          { name: 'Employee', label: 'Employee', type: 'user', required: true, filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Finance.Invoicing', name: 'Invoicing',
    description: 'Professional invoicing with recurring billing, payment tracking, overdue reminders, and revenue recognition.',
    department: 'Finance', category: 'Finance', version: '1.8.0', maturity: 'L5', icon: '🧾', rating: 4.8, installs: 21400,
    verbs: ['create', 'send', 'pay', 'reconcile'], nouns: ['invoice', 'payment', 'billing', 'revenue'],
    permissions: ['finance.invoices.create'], eventsProduced: ['InvoiceCreated', 'InvoicePaid', 'InvoiceOverdue'],
    tags: ['invoicing', 'billing', 'payments', 'revenue'],
    configSchema: [
      { key: 'payment_terms', label: 'Default Payment Terms (days)', type: 'number', defaultValue: 30, group: 'Billing' },
      { key: 'late_fee_percentage', label: 'Late Fee (%)', type: 'number', defaultValue: 1.5, group: 'Policy' },
    ],
    objectSchemas: [
      {
        name: 'Invoice', pluralName: 'Invoices', icon: '🧾', titleField: 'InvoiceNumber', statusField: 'Status', views: ['Grid'],
        fields: [
          { name: 'InvoiceNumber', label: 'Invoice #', type: 'string', required: true, searchable: true, readonly: true, width: 'half' },
          { name: 'Client', label: 'Client', type: 'reference', referenceTo: 'Account', required: true, searchable: true, width: 'half' },
          { name: 'Amount', label: 'Amount ($)', type: 'number', required: true, sortable: true, width: 'half' },
          { name: 'DueDate', label: 'Due Date', type: 'date', required: true, sortable: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'], defaultValue: 'Draft', filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Finance.PurchaseOrders', name: 'Purchase Orders',
    description: 'Purchase order management with vendor catalog, approval workflows, receiving, and three-way matching.',
    department: 'Finance', category: 'Finance', version: '1.6.0', maturity: 'L4', icon: '📦', rating: 4.6, installs: 12800,
    verbs: ['raise', 'approve', 'receive', 'match'], nouns: ['po', 'vendor', 'goods', 'receipt'],
    permissions: ['finance.po.create'], eventsProduced: ['POCreated', 'POApproved', 'GoodsReceived'],
    tags: ['procurement', 'purchase-orders', 'vendors', 'finance'],
    configSchema: [{ key: 'po_approval_limit', label: 'Approval Required Above ($)', type: 'number', defaultValue: 5000, group: 'Approvals' }],
    objectSchemas: [
      {
        name: 'PurchaseOrder', pluralName: 'Purchase Orders', icon: '📦', titleField: 'PONumber', statusField: 'Status', views: ['Grid'],
        fields: [
          { name: 'PONumber', label: 'PO Number', type: 'string', required: true, searchable: true, width: 'half' },
          { name: 'Vendor', label: 'Vendor', type: 'string', required: true, searchable: true, width: 'half' },
          { name: 'TotalValue', label: 'Total Value ($)', type: 'number', required: true, sortable: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Draft', 'Pending Approval', 'Approved', 'Delivered', 'Cancelled'], defaultValue: 'Draft', filterable: true, width: 'half' },
          { name: 'OrderDate', label: 'Order Date', type: 'date', required: true, sortable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Finance.Budgeting', name: 'Budgeting',
    description: 'Department budget management with allocation tracking, variance analysis, and real-time spend visibility.',
    department: 'Finance', category: 'Finance', version: '1.4.0', maturity: 'L4', icon: '💰', rating: 4.5, installs: 9200,
    verbs: ['allocate', 'track', 'analyze', 'forecast'], nouns: ['budget', 'allocation', 'variance', 'spend'],
    permissions: ['finance.budget.manage'], eventsProduced: ['BudgetCreated', 'BudgetAlertTriggered'],
    tags: ['budget', 'finance', 'spend', 'allocation'],
    configSchema: [{ key: 'fiscal_year', label: 'Fiscal Year', type: 'select', defaultValue: 'Calendar', options: ['Calendar', 'April-March', 'July-June'], group: 'Finance' }],
    objectSchemas: []
  },

  // ─── MARKETING ──────────────────────────────────────────────────────────────
  {
    id: 'Marketing.CampaignManagement', name: 'Campaign Management',
    description: 'Multi-channel campaign planning, execution, and measurement with attribution modeling and ROI tracking.',
    department: 'Marketing', category: 'Marketing', version: '1.8.0', maturity: 'L4', icon: '📣', rating: 4.6, installs: 13400,
    verbs: ['plan', 'launch', 'measure', 'optimize'], nouns: ['campaign', 'channel', 'roi', 'attribution'],
    permissions: ['marketing.campaigns.create'], eventsProduced: ['CampaignLaunched', 'CampaignCompleted'],
    tags: ['campaigns', 'marketing', 'roi', 'multi-channel'],
    configSchema: [{ key: 'attribution_model', label: 'Attribution Model', type: 'select', defaultValue: 'Last Touch', options: ['First Touch', 'Last Touch', 'Linear', 'Time Decay'], group: 'Analytics' }],
    objectSchemas: [
      {
        name: 'Campaign', pluralName: 'Campaigns', icon: '📣', titleField: 'Name', statusField: 'Status', views: ['Grid', 'Calendar'],
        fields: [
          { name: 'Name', label: 'Campaign Name', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Planning', 'Active', 'Paused', 'Completed'], defaultValue: 'Planning', filterable: true, width: 'half' },
          { name: 'Budget', label: 'Budget ($)', type: 'number', required: true, width: 'half' },
          { name: 'Channel', label: 'Primary Channel', type: 'enum', options: ['Email', 'Social', 'Paid', 'Content', 'Events', 'Multi'], filterable: true, width: 'half' },
          { name: 'StartDate', label: 'Start Date', type: 'date', sortable: true, width: 'half' },
          { name: 'EndDate', label: 'End Date', type: 'date', sortable: true, width: 'half' },
          { name: 'Owner', label: 'Campaign Manager', type: 'user', filterable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Marketing.EmailMarketing', name: 'Email Marketing',
    description: 'Drag-and-drop email builder, segmentation engine, A/B testing, and deliverability analytics.',
    department: 'Marketing', category: 'Marketing', version: '1.6.0', maturity: 'L4', icon: '📧', rating: 4.5, installs: 18700,
    verbs: ['compose', 'segment', 'send', 'analyze'], nouns: ['email', 'segment', 'template', 'deliverability'],
    permissions: ['marketing.email.send'], eventsProduced: ['EmailSent', 'EmailOpened', 'EmailClicked'],
    tags: ['email', 'marketing', 'campaigns', 'ab-testing'],
    configSchema: [
      { key: 'from_name', label: 'Sender Name', type: 'text', defaultValue: 'Your Company', group: 'Sender' },
      { key: 'from_email', label: 'From Email', type: 'email', defaultValue: 'hello@company.com', group: 'Sender' },
    ],
    objectSchemas: []
  },
  {
    id: 'Marketing.SocialPublishing', name: 'Social Publishing',
    description: 'Schedule and publish content across LinkedIn, Twitter/X, Instagram, and Facebook with unified analytics.',
    department: 'Marketing', category: 'Marketing', version: '1.4.0', maturity: 'L3', icon: '📱', rating: 4.4, installs: 11200,
    verbs: ['create', 'schedule', 'publish', 'analyze'], nouns: ['post', 'channel', 'content', 'engagement'],
    permissions: ['marketing.social.publish'], eventsProduced: ['PostPublished', 'PostScheduled'],
    tags: ['social', 'content', 'scheduling', 'publishing'],
    configSchema: [],
    objectSchemas: []
  },

  // ─── OPERATIONS ─────────────────────────────────────────────────────────────
  {
    id: 'Operations.ProjectManagement', name: 'Project Management',
    description: 'Full project lifecycle management with Gantt charts, resource allocation, milestone tracking, and budget control.',
    department: 'Operations', category: 'Operations', version: '2.0.0', maturity: 'L5', icon: '📅', rating: 4.8, installs: 33100,
    verbs: ['plan', 'track', 'resource', 'deliver'], nouns: ['project', 'task', 'milestone', 'resource'],
    permissions: ['ops.projects.manage'], eventsProduced: ['ProjectCreated', 'MilestoneReached', 'ProjectCompleted'],
    tags: ['projects', 'pm', 'gantt', 'milestones'],
    configSchema: [{ key: 'methodology', label: 'Default Methodology', type: 'select', defaultValue: 'Agile', options: ['Agile', 'Waterfall', 'Kanban', 'Hybrid'], group: 'Methodology' }],
    objectSchemas: [
      {
        name: 'Project', pluralName: 'Projects', icon: '📅', titleField: 'Name', statusField: 'Status', views: ['Grid', 'Gantt', 'Kanban'],
        fields: [
          { name: 'Name', label: 'Project Name', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'], defaultValue: 'Not Started', filterable: true, width: 'half' },
          { name: 'Priority', label: 'Priority', type: 'enum', options: ['Low', 'Medium', 'High', 'Critical'], filterable: true, width: 'half' },
          { name: 'StartDate', label: 'Start Date', type: 'date', sortable: true, width: 'half' },
          { name: 'DueDate', label: 'Due Date', type: 'date', sortable: true, width: 'half' },
          { name: 'Owner', label: 'Project Manager', type: 'user', required: true, filterable: true, width: 'half' },
        ]
      },
      {
        name: 'Task', pluralName: 'Tasks', icon: '✅', titleField: 'Title', statusField: 'Status', views: ['Grid', 'Kanban'],
        fields: [
          { name: 'Title', label: 'Task Title', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Project', label: 'Project', type: 'reference', referenceTo: 'Project', required: true, filterable: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'], defaultValue: 'Backlog', filterable: true, width: 'half' },
          { name: 'Priority', label: 'Priority', type: 'enum', options: ['Low', 'Medium', 'High', 'Critical'], filterable: true, width: 'half' },
          { name: 'Assignee', label: 'Assigned To', type: 'user', filterable: true, width: 'half' },
          { name: 'DueDate', label: 'Due Date', type: 'date', sortable: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Operations.InventoryManagement', name: 'Inventory Management',
    description: 'Real-time inventory tracking with stock alerts, purchase suggestions, and multi-location support.',
    department: 'Operations', category: 'Operations', version: '1.7.0', maturity: 'L4', icon: '📦', rating: 4.6, installs: 14200,
    verbs: ['track', 'reorder', 'receive', 'audit'], nouns: ['item', 'stock', 'location', 'reorder'],
    permissions: ['ops.inventory.manage'], eventsProduced: ['StockLow', 'StockReceived', 'InventoryAudited'],
    tags: ['inventory', 'stock', 'warehouse', 'operations'],
    configSchema: [{ key: 'low_stock_threshold', label: 'Low Stock Alert at (%)', type: 'number', defaultValue: 20, group: 'Alerts' }],
    objectSchemas: [
      {
        name: 'InventoryItem', pluralName: 'Inventory Items', icon: '📦', titleField: 'Name', views: ['Grid'],
        fields: [
          { name: 'Name', label: 'Item Name', type: 'string', required: true, searchable: true, sortable: true, width: 'full' },
          { name: 'SKU', label: 'SKU', type: 'string', required: true, searchable: true, width: 'half' },
          { name: 'Quantity', label: 'Current Stock', type: 'number', required: true, sortable: true, width: 'half' },
          { name: 'ReorderPoint', label: 'Reorder Point', type: 'number', required: true, width: 'half' },
          { name: 'Category', label: 'Category', type: 'string', filterable: true, width: 'half' },
          { name: 'Location', label: 'Storage Location', type: 'string', filterable: true, width: 'half' },
        ]
      }
    ]
  },

  // ─── CUSTOMER SUPPORT ──────────────────────────────────────────────────────
  {
    id: 'Support.Helpdesk', name: 'Helpdesk',
    description: 'Customer support ticketing with SLA enforcement, auto-routing, canned responses, and customer satisfaction scoring.',
    department: 'Customer Support', category: 'Customer Support', version: '2.1.0', maturity: 'L5', icon: '🎧', rating: 4.8, installs: 26800,
    verbs: ['raise', 'assign', 'resolve', 'escalate'], nouns: ['ticket', 'sla', 'agent', 'satisfaction'],
    permissions: ['support.tickets.manage'], eventsProduced: ['TicketCreated', 'TicketResolved', 'SLABreached'],
    tags: ['helpdesk', 'support', 'tickets', 'sla'],
    configSchema: [
      { key: 'first_response_sla_hours', label: 'First Response SLA (hours)', type: 'number', defaultValue: 4, group: 'SLA' },
      { key: 'resolution_sla_hours', label: 'Resolution SLA (hours)', type: 'number', defaultValue: 24, group: 'SLA' },
      { key: 'auto_assign', label: 'Auto-Assign Tickets', type: 'boolean', defaultValue: true, group: 'Routing' },
    ],
    objectSchemas: [
      {
        name: 'Ticket', pluralName: 'Tickets', icon: '🎧', titleField: 'Subject', statusField: 'Status', views: ['Grid', 'Kanban'],
        ai: { summarize: true, suggest: true },
        fields: [
          { name: 'Subject', label: 'Subject', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Open', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'], defaultValue: 'Open', filterable: true, width: 'half' },
          { name: 'Priority', label: 'Priority', type: 'enum', options: ['Low', 'Normal', 'High', 'Urgent'], defaultValue: 'Normal', filterable: true, width: 'half' },
          { name: 'Requester', label: 'Customer', type: 'user', filterable: true, width: 'half' },
          { name: 'Assignee', label: 'Assigned Agent', type: 'user', filterable: true, width: 'half' },
          { name: 'CreatedAt', label: 'Created', type: 'date', sortable: true, readonly: true, width: 'half' },
        ]
      }
    ]
  },
  {
    id: 'Support.KnowledgeBase', name: 'Knowledge Base',
    description: 'Self-service knowledge base with AI-powered search, article analytics, and agent-assist recommendations.',
    department: 'Customer Support', category: 'Customer Support', version: '1.6.0', maturity: 'L4', icon: '📚', rating: 4.6, installs: 18200,
    verbs: ['write', 'publish', 'search', 'analyze'], nouns: ['article', 'category', 'search', 'feedback'],
    permissions: ['support.kb.publish'], eventsProduced: ['ArticlePublished', 'ArticleSearched'],
    tags: ['knowledge-base', 'self-service', 'support', 'articles'],
    configSchema: [{ key: 'public_kb', label: 'Make KB Publicly Accessible', type: 'boolean', defaultValue: true, group: 'Access' }],
    objectSchemas: [
      {
        name: 'Article', pluralName: 'Articles', icon: '📚', titleField: 'Title', statusField: 'Status', views: ['Grid'],
        fields: [
          { name: 'Title', label: 'Article Title', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Category', label: 'Category', type: 'string', filterable: true, sortable: true, width: 'half' },
          { name: 'Status', label: 'Status', type: 'enum', options: ['Draft', 'In Review', 'Published', 'Archived'], defaultValue: 'Draft', filterable: true, width: 'half' },
          { name: 'Author', label: 'Author', type: 'user', filterable: true, width: 'half' },
          { name: 'Views', label: 'Total Views', type: 'number', readonly: true, sortable: true, width: 'half' },
        ]
      }
    ]
  },

  // ─── COMMUNICATION ──────────────────────────────────────────────────────────
  {
    id: 'Communication.Announcements', name: 'Announcements',
    description: 'Company-wide announcements with targeted segments, read receipts, and multi-channel delivery.',
    department: 'Communication', category: 'Communication', version: '1.2.0', maturity: 'L3', icon: '📢', rating: 4.4, installs: 8900,
    verbs: ['draft', 'publish', 'target', 'measure'], nouns: ['announcement', 'segment', 'reach', 'receipt'],
    permissions: ['comm.announcements.publish'], eventsProduced: ['AnnouncementPublished'],
    tags: ['announcements', 'internal-comms', 'notifications'],
    configSchema: [],
    objectSchemas: []
  },
  {
    id: 'Communication.MeetingRooms', name: 'Meeting Room Booking',
    description: 'Conference room booking with equipment management, recurring reservations, and usage analytics.',
    department: 'Communication', category: 'Communication', version: '1.1.0', maturity: 'L3', icon: '🏠', rating: 4.3, installs: 7200,
    verbs: ['book', 'cancel', 'check-in', 'report'], nouns: ['room', 'booking', 'equipment', 'calendar'],
    permissions: ['comm.rooms.book'], eventsProduced: ['RoomBooked', 'RoomReleased'],
    tags: ['meeting-rooms', 'booking', 'office'],
    configSchema: [],
    objectSchemas: [
      {
        name: 'RoomBooking', pluralName: 'Room Bookings', icon: '🏠', titleField: 'Title', views: ['Grid', 'Calendar'],
        fields: [
          { name: 'Title', label: 'Meeting Title', type: 'string', required: true, searchable: true, width: 'full' },
          { name: 'Room', label: 'Room', type: 'string', required: true, filterable: true, width: 'half' },
          { name: 'StartTime', label: 'Start Time', type: 'date', required: true, sortable: true, width: 'half' },
          { name: 'Organizer', label: 'Organizer', type: 'user', filterable: true, width: 'half' },
          { name: 'Attendees', label: 'No. of Attendees', type: 'number', width: 'half' },
        ]
      }
    ]
  },

  // ─── AI & AUTOMATION ────────────────────────────────────────────────────────
  {
    id: 'AI.WorkflowAutomation', name: 'Workflow Automation',
    description: 'No-code automation builder with triggers, conditions, and actions across all installed capabilities.',
    department: 'Enterprise Platform', category: 'AI & Automation', version: '1.5.0', maturity: 'L4', icon: '⚡', rating: 4.8, installs: 19800,
    verbs: ['trigger', 'condition', 'action', 'automate'], nouns: ['workflow', 'trigger', 'automation', 'action'],
    permissions: ['platform.automations.manage'], eventsProduced: ['AutomationTriggered', 'AutomationCompleted'],
    tags: ['automation', 'workflow', 'no-code', 'triggers'],
    configSchema: [],
    objectSchemas: []
  },
  {
    id: 'AI.IntentEngine', name: 'Intent Engine',
    description: 'Natural language understanding engine that powers CHATR\'s universal command bar and intent resolution.',
    department: 'Enterprise Platform', category: 'AI & Automation', version: '3.0.0', maturity: 'L5', icon: '🧠', rating: 4.9, installs: 42100,
    verbs: ['resolve', 'classify', 'route', 'learn'], nouns: ['intent', 'entity', 'confidence', 'action'],
    permissions: ['platform.intent.read'], eventsProduced: ['IntentResolved'],
    tags: ['ai', 'nlp', 'intent', 'kernel'],
    configSchema: [{ key: 'confidence_threshold', label: 'Min. Confidence Score', type: 'number', defaultValue: 0.7, group: 'Model' }],
    objectSchemas: []
  },

  // ─── ENTERPRISE PLATFORM ────────────────────────────────────────────────────
  {
    id: 'Platform.IdentityAccess', name: 'Identity & Access',
    description: 'SSO, RBAC, MFA, session management, and audit logging for enterprise security compliance.',
    department: 'Enterprise Platform', category: 'Enterprise Platform', version: '2.5.0', maturity: 'L5', icon: '🔐', rating: 4.9, installs: 38200,
    verbs: ['authenticate', 'authorize', 'audit', 'provision'], nouns: ['user', 'role', 'permission', 'session'],
    permissions: ['platform.iam.manage'], eventsProduced: ['UserLoggedIn', 'PermissionChanged'],
    tags: ['iam', 'sso', 'rbac', 'security'],
    configSchema: [
      { key: 'mfa_required', label: 'Require MFA for All Users', type: 'boolean', defaultValue: true, group: 'Security' },
      { key: 'session_timeout_hours', label: 'Session Timeout (hours)', type: 'number', defaultValue: 8, group: 'Security' },
      { key: 'sso_provider', label: 'SSO Provider', type: 'select', defaultValue: 'None', options: ['None', 'Google', 'Microsoft', 'Okta', 'Auth0'], group: 'SSO' },
    ],
    objectSchemas: []
  },
  {
    id: 'Platform.Analytics', name: 'Business Analytics',
    description: 'Cross-capability analytics dashboard with custom metrics, data exploration, and scheduled reports.',
    department: 'Enterprise Platform', category: 'Enterprise Platform', version: '1.8.0', maturity: 'L4', icon: '📊', rating: 4.7, installs: 24500,
    verbs: ['analyze', 'visualize', 'export', 'schedule'], nouns: ['metric', 'report', 'dashboard', 'chart'],
    permissions: ['platform.analytics.read'], eventsProduced: ['ReportGenerated'],
    tags: ['analytics', 'reporting', 'dashboard', 'bi'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package1',
    name: 'Marketing Suite 1',
    description: 'An advanced module for Marketing operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Marketing',
    category: 'Growth',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 2150,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['marketing'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package2',
    name: 'Customer Success Suite 2',
    description: 'An advanced module for Customer Success operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Customer Success',
    category: 'Retention',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 2300,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['customer success'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package3',
    name: 'Legal Suite 3',
    description: 'An advanced module for Legal operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Legal',
    category: 'Corporate',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 2450,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['legal'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package4',
    name: 'Facilities Suite 4',
    description: 'An advanced module for Facilities operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Facilities',
    category: 'Operations',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 2600,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['facilities'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package5',
    name: 'Product Suite 5',
    description: 'An advanced module for Product operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Product',
    category: 'Development',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 2750,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['product'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package6',
    name: 'Security Suite 6',
    description: 'An advanced module for Security operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Security',
    category: 'Risk',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 2900,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['security'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package7',
    name: 'Compliance Suite 7',
    description: 'An advanced module for Compliance operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Compliance',
    category: 'Policy',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 3050,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['compliance'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package8',
    name: 'Engineering Suite 8',
    description: 'An advanced module for Engineering operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Engineering',
    category: 'Infrastructure',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 3200,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['engineering'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package9',
    name: 'Marketing Suite 9',
    description: 'An advanced module for Marketing operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Marketing',
    category: 'Growth',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 3350,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['marketing'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package10',
    name: 'Customer Success Suite 10',
    description: 'An advanced module for Customer Success operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Customer Success',
    category: 'Retention',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 3500,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['customer success'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package11',
    name: 'Legal Suite 11',
    description: 'An advanced module for Legal operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Legal',
    category: 'Corporate',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 3650,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['legal'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package12',
    name: 'Facilities Suite 12',
    description: 'An advanced module for Facilities operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Facilities',
    category: 'Operations',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 3800,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['facilities'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package13',
    name: 'Product Suite 13',
    description: 'An advanced module for Product operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Product',
    category: 'Development',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 3950,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['product'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package14',
    name: 'Security Suite 14',
    description: 'An advanced module for Security operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Security',
    category: 'Risk',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 4100,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['security'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package15',
    name: 'Compliance Suite 15',
    description: 'An advanced module for Compliance operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Compliance',
    category: 'Policy',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 4250,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['compliance'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package16',
    name: 'Engineering Suite 16',
    description: 'An advanced module for Engineering operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Engineering',
    category: 'Infrastructure',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 4400,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['engineering'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package17',
    name: 'Marketing Suite 17',
    description: 'An advanced module for Marketing operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Marketing',
    category: 'Growth',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 4550,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['marketing'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package18',
    name: 'Customer Success Suite 18',
    description: 'An advanced module for Customer Success operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Customer Success',
    category: 'Retention',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 4700,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['customer success'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package19',
    name: 'Legal Suite 19',
    description: 'An advanced module for Legal operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Legal',
    category: 'Corporate',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 4850,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['legal'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package20',
    name: 'Facilities Suite 20',
    description: 'An advanced module for Facilities operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Facilities',
    category: 'Operations',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 5000,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['facilities'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package21',
    name: 'Product Suite 21',
    description: 'An advanced module for Product operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Product',
    category: 'Development',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 5150,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['product'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package22',
    name: 'Security Suite 22',
    description: 'An advanced module for Security operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Security',
    category: 'Risk',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 5300,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['security'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package23',
    name: 'Compliance Suite 23',
    description: 'An advanced module for Compliance operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Compliance',
    category: 'Policy',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 5450,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['compliance'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package24',
    name: 'Engineering Suite 24',
    description: 'An advanced module for Engineering operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Engineering',
    category: 'Infrastructure',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 5600,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['engineering'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package25',
    name: 'Marketing Suite 25',
    description: 'An advanced module for Marketing operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Marketing',
    category: 'Growth',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 5750,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['marketing'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package26',
    name: 'Customer Success Suite 26',
    description: 'An advanced module for Customer Success operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Customer Success',
    category: 'Retention',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 5900,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['customer success'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package27',
    name: 'Legal Suite 27',
    description: 'An advanced module for Legal operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Legal',
    category: 'Corporate',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 6050,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['legal'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package28',
    name: 'Facilities Suite 28',
    description: 'An advanced module for Facilities operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Facilities',
    category: 'Operations',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 6200,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['facilities'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package29',
    name: 'Product Suite 29',
    description: 'An advanced module for Product operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Product',
    category: 'Development',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 6350,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['product'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package30',
    name: 'Security Suite 30',
    description: 'An advanced module for Security operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Security',
    category: 'Risk',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 6500,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['security'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package31',
    name: 'Compliance Suite 31',
    description: 'An advanced module for Compliance operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Compliance',
    category: 'Policy',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 6650,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['compliance'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package32',
    name: 'Engineering Suite 32',
    description: 'An advanced module for Engineering operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Engineering',
    category: 'Infrastructure',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 6800,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['engineering'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package33',
    name: 'Marketing Suite 33',
    description: 'An advanced module for Marketing operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Marketing',
    category: 'Growth',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 6950,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['marketing'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package34',
    name: 'Customer Success Suite 34',
    description: 'An advanced module for Customer Success operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Customer Success',
    category: 'Retention',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 7100,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['customer success'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package35',
    name: 'Legal Suite 35',
    description: 'An advanced module for Legal operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Legal',
    category: 'Corporate',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 7250,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['legal'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package36',
    name: 'Facilities Suite 36',
    description: 'An advanced module for Facilities operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Facilities',
    category: 'Operations',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 7400,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['facilities'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package37',
    name: 'Product Suite 37',
    description: 'An advanced module for Product operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Product',
    category: 'Development',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 7550,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['product'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package38',
    name: 'Security Suite 38',
    description: 'An advanced module for Security operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Security',
    category: 'Risk',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 7700,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['security'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package39',
    name: 'Compliance Suite 39',
    description: 'An advanced module for Compliance operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Compliance',
    category: 'Policy',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 7850,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['compliance'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package40',
    name: 'Engineering Suite 40',
    description: 'An advanced module for Engineering operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Engineering',
    category: 'Infrastructure',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 8000,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['engineering'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package41',
    name: 'Marketing Suite 41',
    description: 'An advanced module for Marketing operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Marketing',
    category: 'Growth',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 8150,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['marketing'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package42',
    name: 'Customer Success Suite 42',
    description: 'An advanced module for Customer Success operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Customer Success',
    category: 'Retention',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 8300,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['customer success'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package43',
    name: 'Legal Suite 43',
    description: 'An advanced module for Legal operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Legal',
    category: 'Corporate',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 8450,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['legal'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package44',
    name: 'Facilities Suite 44',
    description: 'An advanced module for Facilities operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Facilities',
    category: 'Operations',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 8600,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['facilities'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package45',
    name: 'Product Suite 45',
    description: 'An advanced module for Product operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Product',
    category: 'Development',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 8750,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['product'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package46',
    name: 'Security Suite 46',
    description: 'An advanced module for Security operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Security',
    category: 'Risk',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 8900,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['security'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package47',
    name: 'Compliance Suite 47',
    description: 'An advanced module for Compliance operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Compliance',
    category: 'Policy',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 9050,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['compliance'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package48',
    name: 'Engineering Suite 48',
    description: 'An advanced module for Engineering operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Engineering',
    category: 'Infrastructure',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 9200,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['engineering'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package49',
    name: 'Marketing Suite 49',
    description: 'An advanced module for Marketing operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Marketing',
    category: 'Growth',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 9350,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['marketing'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package50',
    name: 'Customer Success Suite 50',
    description: 'An advanced module for Customer Success operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Customer Success',
    category: 'Retention',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 9500,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['customer success'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package51',
    name: 'Legal Suite 51',
    description: 'An advanced module for Legal operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Legal',
    category: 'Corporate',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 9650,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['legal'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package52',
    name: 'Facilities Suite 52',
    description: 'An advanced module for Facilities operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Facilities',
    category: 'Operations',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 9800,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['facilities'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package53',
    name: 'Product Suite 53',
    description: 'An advanced module for Product operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Product',
    category: 'Development',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 9950,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['product'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package54',
    name: 'Security Suite 54',
    description: 'An advanced module for Security operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Security',
    category: 'Risk',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 10100,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['security'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package55',
    name: 'Compliance Suite 55',
    description: 'An advanced module for Compliance operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Compliance',
    category: 'Policy',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 10250,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['compliance'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package56',
    name: 'Engineering Suite 56',
    description: 'An advanced module for Engineering operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Engineering',
    category: 'Infrastructure',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 10400,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['engineering'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package57',
    name: 'Marketing Suite 57',
    description: 'An advanced module for Marketing operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Marketing',
    category: 'Growth',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 10550,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['marketing'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package58',
    name: 'Customer Success Suite 58',
    description: 'An advanced module for Customer Success operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Customer Success',
    category: 'Retention',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 10700,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['customer success'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package59',
    name: 'Legal Suite 59',
    description: 'An advanced module for Legal operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Legal',
    category: 'Corporate',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 10850,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['legal'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package60',
    name: 'Facilities Suite 60',
    description: 'An advanced module for Facilities operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Facilities',
    category: 'Operations',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 11000,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['facilities'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package61',
    name: 'Product Suite 61',
    description: 'An advanced module for Product operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Product',
    category: 'Development',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 11150,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['product'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package62',
    name: 'Security Suite 62',
    description: 'An advanced module for Security operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Security',
    category: 'Risk',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 11300,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['security'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package63',
    name: 'Compliance Suite 63',
    description: 'An advanced module for Compliance operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Compliance',
    category: 'Policy',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 11450,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['compliance'],
    configSchema: [],
    objectSchemas: []
  },

  {
    id: 'Dummy.Package64',
    name: 'Engineering Suite 64',
    description: 'An advanced module for Engineering operations and workflow automation. Includes custom reporting and metrics tracking.',
    department: 'Engineering',
    category: 'Infrastructure',
    version: '1.0.0',
    maturity: 'L3',
    icon: '📦',
    rating: 4.5,
    installs: 11600,
    verbs: ['manage', 'track', 'analyze'],
    nouns: ['record', 'report'],
    permissions: ['dummy.read'],
    tags: ['engineering'],
    configSchema: [],
    objectSchemas: []
  }
];

export default CATALOG;
