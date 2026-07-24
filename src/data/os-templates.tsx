import { 
 Store, Building2, Stethoscope, GraduationCap, Briefcase, Factory, Coffee, Landmark,
 LayoutGrid, Sparkles, Plus, Search, Settings, Shield, Bell, Database, Command, Users,
 CheckCircle2, Package
} from 'lucide-react';
import React from 'react';

export interface CapabilityModule {
 id: string;
 name: string;
 type: 'core' | 'scalable' | 'platform';
}

export interface Department {
 id: string;
 name: string;
 modules: CapabilityModule[];
 // Legacy fields for backward compatibility with older UI parts:
 agents?: number;
 packages?: number;
 status?: 'healthy' | 'warning';
}

export interface OSTemplate {
 id: string;
 name: string;
 keywords: string[];
 icon: any;
 color: string;
 bg: string;
 departments: Department[];
 packages: string[]; // Legacy
 superintendent: {
 name: string;
 description: string;
 iconColor: string;
 messages: {
 ai1: React.ReactNode;
 user1: React.ReactNode;
 ai2: React.ReactNode;
 };
 actions: { title: string; desc: string; status: string; icon: any }[];
 knowledgeGraph: string[];
 };
}

export const PLATFORM_SERVICES: CapabilityModule[] = [
 { id: 'work_object', name: 'Universal Work Object', type: 'platform' },
 { id: 'workflow_runtime', name: 'Workflow Runtime', type: 'platform' },
 { id: 'universal_timeline', name: 'Universal Timeline', type: 'platform' },
 { id: 'universal_search', name: 'Universal Search', type: 'platform' },
 { id: 'action_center', name: 'Action Center', type: 'platform' },
 { id: 'identity_access', name: 'Identity & Access', type: 'platform' },
 { id: 'knowledge_graph', name: 'Business Knowledge Graph', type: 'platform' },
 { id: 'observability', name: 'Observability Engine', type: 'platform' }
];

export const PACKAGES = [
 { id: 'pos', name: 'Smart POS', category: 'retail', maturity: 'L4', desc: 'Point of sale with UPI, inventory deduction & customer loyalty.' },
 { id: 'inventory', name: 'Inventory Engine', category: 'retail', maturity: 'L5', desc: 'Batch tracking, expiry alerts, and supplier auto-reorder.' },
 { id: 'loyalty', name: 'Loyalty Manager', category: 'retail', maturity: 'L3', desc: 'Points system, tier tracking, and promotional campaigns.' },
 { id: 'prescription', name: 'Prescription Sync', category: 'healthcare', maturity: 'L3', desc: 'OCR prescription reading and doctor compliance.' },
 { id: 'patient_crm', name: 'Patient CRM', category: 'healthcare', maturity: 'L4', desc: 'HIPAA compliant patient history and follow-up.' },
 { id: 'recruitment', name: 'Recruitment & ATS', category: 'professional', maturity: 'L4', desc: 'End-to-end applicant tracking, JD generation & interviews.' },
 { id: 'payroll', name: 'Global Payroll', category: 'professional', maturity: 'L2', desc: 'Multi-jurisdiction tax engine and direct deposits.' },
 { id: 'client_portal', name: 'Client Portal', category: 'professional', maturity: 'L3', desc: 'Secure document sharing and project status.' },
 { id: 'billable_hours', name: 'Billable Hours', category: 'professional', maturity: 'L5', desc: 'Time tracking, invoice generation, and margin analysis.' },
 { id: 'core_crm', name: 'Core CRM', category: 'generic', maturity: 'L5', desc: 'Universal sales pipeline and contact management.' },
 { id: 'core_hr', name: 'Core HR', category: 'generic', maturity: 'L5', desc: 'Employee database, leave management, and organizational charts.' },
];

const genericTemplate: OSTemplate = {
 id: 'generic',
 name: 'General Enterprise',
 keywords: ['business', 'company', 'startup', 'enterprise', 'general'],
 icon: Building2,
 color: 'text-zinc-400',
 bg: 'bg-zinc-400/10',
 packages: ['core_crm', 'core_hr', 'recruitment'],
 superintendent: {
 name: 'General Operations Superintendent',
 description: 'Core business management',
 iconColor: 'from-zinc-500 to-gray-600',
 messages: {
 ai1: <>System boot complete. All core HR and CRM modules are online.<br/><br/><strong className="text-white">Pipeline Summary:</strong> 14 new leads generated this week. Would you like me to run the qualification workflow on them?</>,
 user1: <>Yes, qualify them and assign the high-value ones to Sarah.</>,
 ai2: <><div className="flex items-center gap-2 text-emerald-400 font-medium"><CheckCircle2 size={16} /> 3 leads assigned to Sarah.</div><p className="mt-2">Notification sent via Slack.</p></>
 },
 actions: [
 { title: 'Lead Scoring', desc: 'Evaluating inbound traffic', status: 'Active', icon: Command },
 ],
 knowledgeGraph: ['Company Wiki', 'Sales Playbook', 'Leave Policy']
 },
 departments: [
 { id: 'dept-ops', name: 'Operations', modules: [], agents: 4, packages: 4, status: 'healthy' },
 { id: 'dept-it', name: 'Information Technology', modules: [], agents: 6, packages: 3, status: 'healthy' },
 { id: 'dept-finance', name: 'Corporate Finance', modules: [], agents: 3, packages: 2, status: 'healthy' }
 ]
};

export const TEMPLATES: OSTemplate[] = [
 // Professional
 {
 id: 'professional',
 name: 'Professional Services',
 keywords: ['agency', 'consulting', 'law', 'design', 'software', 'service', 'freelance', 'b2b', 'marketing', 'staffing', 'recruiting', 'hr', 'headhunting', 'it', 'tech', 'technology', 'professional'],
 icon: Briefcase,
 color: 'text-indigo-400',
 bg: 'bg-indigo-400/10',
 packages: ['recruitment', 'client_portal', 'billable_hours'],
 superintendent: {
 name: 'Services Superintendent',
 description: 'Optimizing billable utilization and recruitment',
 iconColor: 'from-blue-500 to-indigo-600',
 messages: {
 ai1: <>Weekly sprint analysis complete.<br/><br/><strong className="text-white">Utilization Warning:</strong> The design team is currently at 115% utilization for the upcoming week. The "Acme Rebrand" project is at risk of missing its deadline.<br/><br/>Should I spin up a new Recruitment workflow to hire a freelance designer?</>,
 user1: <>Yes, create a job description for a Senior UI Freelancer and post it. Budget is $80/hr.</>,
 ai2: <><div className="flex items-center gap-2 text-emerald-400 font-medium"><CheckCircle2 size={16} /> Job Requisition created in ATS.</div><p className="mt-2">I have posted the role to LinkedIn and Upwork matching your budget constraints.</p></>
 },
 actions: [
 { title: 'Invoice Generation', desc: 'Drafted 14 invoices for end of month', status: 'Pending Approval', icon: Command },
 { title: 'Timesheet Chaser', desc: 'Reminded 3 employees', status: 'Active', icon: Bell },
 ],
 knowledgeGraph: ['Client Contracts', 'Rate Cards', 'SOWs', 'Employee Handbook']
 },
 departments: [
 {
 id: 'executive',
 name: 'Executive Office',
 modules: [
 { id: 'ceo_dash', name: 'CEO Dashboard', type: 'core' },
 { id: 'strategy_okrs', name: 'Strategy & OKRs', type: 'core' },
 { id: 'exec_reports', name: 'Executive Reports', type: 'scalable' },
 { id: 'decision_tracker', name: 'Decision Tracker', type: 'core' }
 ],
 agents: 2, packages: 4, status: 'healthy'
 },
 {
 id: 'sales',
 name: 'Sales',
 modules: [
 { id: 'leads', name: 'Leads', type: 'core' },
 { id: 'accounts', name: 'Accounts', type: 'core' },
 { id: 'opportunities', name: 'Opportunities', type: 'core' },
 { id: 'pipeline', name: 'Sales Pipeline', type: 'core' },
 { id: 'quotes', name: 'Quotes', type: 'core' },
 { id: 'contracts', name: 'Contracts', type: 'scalable' },
 { id: 'forecasting', name: 'Sales Forecasting', type: 'scalable' }
 ],
 agents: 4, packages: 7, status: 'healthy'
 },
 {
 id: 'recruitment',
 name: 'Recruitment',
 modules: [
 { id: 'requisitions', name: 'Job Requisitions', type: 'core' },
 { id: 'candidates', name: 'Candidate Database', type: 'core' },
 { id: 'ai_matching', name: 'AI Matching', type: 'scalable' },
 { id: 'interview_sched', name: 'Interview Scheduling', type: 'core' },
 { id: 'offers', name: 'Offer Management', type: 'core' },
 { id: 'bench', name: 'Bench Management', type: 'scalable' }
 ],
 agents: 5, packages: 6, status: 'healthy'
 },
 {
 id: 'delivery',
 name: 'Delivery',
 modules: [
 { id: 'resource_alloc', name: 'Resource Allocation', type: 'core' },
 { id: 'project_staffing', name: 'Project Staffing', type: 'core' },
 { id: 'sla_tracking', name: 'SLA Tracking', type: 'scalable' }
 ],
 agents: 3, packages: 3, status: 'healthy'
 },
 {
 id: 'operations',
 name: 'Operations',
 modules: [
 { id: 'task_mgmt', name: 'Task Management', type: 'core' },
 { id: 'process_builder', name: 'Process Builder', type: 'scalable' },
 { id: 'capacity_plan', name: 'Capacity Planning', type: 'scalable' }
 ],
 agents: 3, packages: 3, status: 'healthy'
 },
 {
 id: 'finance',
 name: 'Finance & Accounts',
 modules: [
 { id: 'invoices', name: 'Invoices', type: 'core' },
 { id: 'receivables', name: 'Receivables', type: 'core' },
 { id: 'payables', name: 'Payables', type: 'core' },
 { id: 'profit_loss', name: 'Profit & Loss', type: 'scalable' }
 ],
 agents: 2, packages: 4, status: 'healthy'
 },
 {
 id: 'communication',
 name: 'Communication',
 modules: [
 { id: 'chat', name: 'Team Chat', type: 'core' },
 { id: 'video', name: 'Video Meetings', type: 'core' },
 { id: 'channels', name: 'Channels', type: 'core' }
 ],
 agents: 2, packages: 3, status: 'healthy'
 },
 {
 id: 'knowledge',
 name: 'Knowledge',
 modules: [
 { id: 'wiki', name: 'Wiki', type: 'core' },
 { id: 'sops', name: 'SOPs', type: 'core' },
 { id: 'policies', name: 'Policies', type: 'scalable' }
 ],
 agents: 1, packages: 3, status: 'healthy'
 },
 {
 id: 'platform',
 name: 'Platform Services',
 modules: PLATFORM_SERVICES,
 agents: 12, packages: 8, status: 'healthy'
 }
 ]
 },
 genericTemplate,
 { ...genericTemplate, id: 'retail', name: 'Retail & Local', keywords: ['retail', 'shop', 'store', 'local', 'commerce', 'ecommerce'], icon: Store, color: 'text-amber-400', bg: 'bg-amber-400/10' },
 { ...genericTemplate, id: 'healthcare', name: 'Healthcare', keywords: ['health', 'medical', 'clinic', 'hospital', 'doctor', 'care'], icon: Stethoscope, color: 'text-rose-400', bg: 'bg-rose-400/10' },
 { ...genericTemplate, id: 'education', name: 'Education', keywords: ['education', 'school', 'university', 'college', 'teaching', 'learning'], icon: GraduationCap, color: 'text-blue-400', bg: 'bg-blue-400/10' },
 { ...genericTemplate, id: 'manufacturing', name: 'Manufacturing', keywords: ['manufacturing', 'factory', 'production', 'maker', 'industrial'], icon: Factory, color: 'text-orange-400', bg: 'bg-orange-400/10' },
 { ...genericTemplate, id: 'hospitality', name: 'Hospitality', keywords: ['hospitality', 'hotel', 'restaurant', 'cafe', 'food', 'dining'], icon: Coffee, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
 { ...genericTemplate, id: 'finance', name: 'Finance & Banking', keywords: ['finance', 'bank', 'investing', 'capital', 'accounting', 'wealth'], icon: Landmark, color: 'text-cyan-400', bg: 'bg-cyan-400/10' }
];

export function resolveTemplate(prompt: string): OSTemplate {
 const p = prompt.toLowerCase();
 
 for (const template of TEMPLATES) {
 if (template.id === 'generic') continue; // Skip generic, use as fallback
 if (template.keywords.some(kw => p.includes(kw))) {
 return template;
 }
 }
 
 // Fallback
 return TEMPLATES.find(t => t.id === 'generic') || TEMPLATES[0];
}
