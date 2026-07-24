import React, { useState, useEffect } from 'react';
import { 
 Store, Building2, Stethoscope, GraduationCap, Briefcase, Factory, Coffee, Landmark,
 LayoutGrid, Sparkles, Plus, Search, Settings, Shield, Bell, Database, Command, Users,
 ArrowRight, Loader2, CheckCircle2, Package, FileText, FolderOpen, Trash2, ShieldCheck, X, Star,
 Play, Cpu, ListTree, Zap, Activity,
 Menu, Monitor, Moon, Sun, Maximize, Minimize, Palette, Layers, ChevronLeft, ChevronRight
} from 'lucide-react';
import { LayoutEngine } from '@/components/ui/LayoutEngine';
import { SectionCard } from '@/components/ui/SectionCard';
import { KernelProvider } from '../../presentation-runtime/providers/KernelProvider';
import { ContextRuntime, ResolutionError } from '../../sdk/engines/ContextRuntime';
import { GoalPlanner, IExecutionGraph } from '../../sdk/engines/GoalPlanner';
import { ExecutionRuntime, AuthorizationError } from '../../sdk/engines/ExecutionRuntime';
import { BusinessObjectStore } from '../../sdk/engines/BusinessObjectStore';
import { IntentEngine, UnknownIntentError } from '../../sdk/engines/IntentEngine';
import { EventBus } from '../../sdk/engines/EventBus';
import { AutomationEngine } from '../../sdk/engines/AutomationEngine';
import { UniversalExecutiveRuntime } from '../../sdk/engines/UniversalExecutiveRuntime';
import { useDesignSystem } from '../../contexts/DesignSystemContext';
import HiringWorkflow from './HiringWorkflow';
import { OSTemplate, PACKAGES, TEMPLATES, resolveTemplate } from '../../data/os-templates';
import { useOSRealtime } from '../../hooks/useOSRealtime';
import { CapabilityWorkspaceView } from '../../components/desktop/universal/CapabilityWorkspaceView';
import { BusinessOSHome } from '../../components/desktop/universal/BusinessOSHome';
import CATALOG from '../../data/capability-catalog';
import { CapabilityInstaller, type IInstallProgress } from '../../sdk/CapabilityInstaller';
import { LeadManagementSDK } from '../../sdk/capabilities/LeadManagement.sdk';
import { OKRSDK } from '../../sdk/capabilities/OKR.sdk';
import { ExecutiveCEOOfficeSDK } from '../../sdk/capabilities/Executive.CEOOffice.sdk';
import { ExecutiveStrategicPlanningSDK } from '../../sdk/capabilities/Executive.StrategicPlanning.sdk';
import { ExecutiveBoardManagementSDK } from '../../sdk/capabilities/Executive.BoardManagement.sdk';
import { ExecutiveRiskManagementSDK } from '../../sdk/capabilities/Executive.RiskManagement.sdk';
import { ExecutiveDecisionTrackerSDK } from '../../sdk/capabilities/Executive.DecisionTracker.sdk';
import { CRMOpportunityManagementSDK } from '../../sdk/capabilities/CRM.OpportunityManagement.sdk';
import { CRMAccountsSDK } from '../../sdk/capabilities/CRM.Accounts.sdk';
import { CRMContactsSDK } from '../../sdk/capabilities/CRM.Contacts.sdk';
import { CRMSalesPipelineSDK } from '../../sdk/capabilities/CRM.SalesPipeline.sdk';
import { CRMQuotationsSDK } from '../../sdk/capabilities/CRM.Quotations.sdk';
import { CRMCustomerSuccessSDK } from '../../sdk/capabilities/CRM.CustomerSuccess.sdk';
import { HRATSSDK } from '../../sdk/capabilities/HR.ATS.sdk';
import { HREmployeeDirectorySDK } from '../../sdk/capabilities/HR.EmployeeDirectory.sdk';
import { HRAttendanceSDK } from '../../sdk/capabilities/HR.Attendance.sdk';
import { HRLeaveManagementSDK } from '../../sdk/capabilities/HR.LeaveManagement.sdk';
import { HRPerformanceReviewsSDK } from '../../sdk/capabilities/HR.PerformanceReviews.sdk';
import { HROnboardingSDK } from '../../sdk/capabilities/HR.Onboarding.sdk';
import { FinanceExpensesSDK } from '../../sdk/capabilities/Finance.Expenses.sdk';
import { FinanceInvoicingSDK } from '../../sdk/capabilities/Finance.Invoicing.sdk';
import { FinancePurchaseOrdersSDK } from '../../sdk/capabilities/Finance.PurchaseOrders.sdk';
import { FinanceBudgetingSDK } from '../../sdk/capabilities/Finance.Budgeting.sdk';
import { MarketingCampaignManagementSDK } from '../../sdk/capabilities/Marketing.CampaignManagement.sdk';
import { MarketingEmailMarketingSDK } from '../../sdk/capabilities/Marketing.EmailMarketing.sdk';
import { MarketingSocialPublishingSDK } from '../../sdk/capabilities/Marketing.SocialPublishing.sdk';
import { OperationsProjectManagementSDK } from '../../sdk/capabilities/Operations.ProjectManagement.sdk';
import { OperationsInventoryManagementSDK } from '../../sdk/capabilities/Operations.InventoryManagement.sdk';
import { SupportHelpdeskSDK } from '../../sdk/capabilities/Support.Helpdesk.sdk';
import { SupportKnowledgeBaseSDK } from '../../sdk/capabilities/Support.KnowledgeBase.sdk';
import { CommunicationAnnouncementsSDK } from '../../sdk/capabilities/Communication.Announcements.sdk';
import { CommunicationMeetingRoomsSDK } from '../../sdk/capabilities/Communication.MeetingRooms.sdk';
import { AIWorkflowAutomationSDK } from '../../sdk/capabilities/AI.WorkflowAutomation.sdk';
import { AIIntentEngineSDK } from '../../sdk/capabilities/AI.IntentEngine.sdk';
import { PlatformIdentityAccessSDK } from '../../sdk/capabilities/Platform.IdentityAccess.sdk';
import { PlatformAnalyticsSDK } from '../../sdk/capabilities/Platform.Analytics.sdk';

// SDK registry: maps capability id → full SDK object
const SDK_REGISTRY: Record<string, any> = {
 'CRM.LeadManagement': LeadManagementSDK,
 'Executive.OKRGoals': OKRSDK,
 'Executive.CEOOffice': ExecutiveCEOOfficeSDK,
 'Executive.StrategicPlanning': ExecutiveStrategicPlanningSDK,
 'Executive.BoardManagement': ExecutiveBoardManagementSDK,
 'Executive.RiskManagement': ExecutiveRiskManagementSDK,
 'Executive.DecisionTracker': ExecutiveDecisionTrackerSDK,
 'CRM.OpportunityManagement': CRMOpportunityManagementSDK,
 'CRM.Accounts': CRMAccountsSDK,
 'CRM.Contacts': CRMContactsSDK,
 'CRM.SalesPipeline': CRMSalesPipelineSDK,
 'CRM.Quotations': CRMQuotationsSDK,
 'CRM.CustomerSuccess': CRMCustomerSuccessSDK,
 'HR.ATS': HRATSSDK,
 'HR.EmployeeDirectory': HREmployeeDirectorySDK,
 'HR.Attendance': HRAttendanceSDK,
 'HR.LeaveManagement': HRLeaveManagementSDK,
 'HR.PerformanceReviews': HRPerformanceReviewsSDK,
 'HR.Onboarding': HROnboardingSDK,
 'Finance.Expenses': FinanceExpensesSDK,
 'Finance.Invoicing': FinanceInvoicingSDK,
 'Finance.PurchaseOrders': FinancePurchaseOrdersSDK,
 'Finance.Budgeting': FinanceBudgetingSDK,
 'Marketing.CampaignManagement': MarketingCampaignManagementSDK,
 'Marketing.EmailMarketing': MarketingEmailMarketingSDK,
 'Marketing.SocialPublishing': MarketingSocialPublishingSDK,
 'Operations.ProjectManagement': OperationsProjectManagementSDK,
 'Operations.InventoryManagement': OperationsInventoryManagementSDK,
 'Support.Helpdesk': SupportHelpdeskSDK,
 'Support.KnowledgeBase': SupportKnowledgeBaseSDK,
 'Communication.Announcements': CommunicationAnnouncementsSDK,
 'Communication.MeetingRooms': CommunicationMeetingRoomsSDK,
 'AI.WorkflowAutomation': AIWorkflowAutomationSDK,
 'AI.IntentEngine': AIIntentEngineSDK,
 'Platform.IdentityAccess': PlatformIdentityAccessSDK,
 'Platform.Analytics': PlatformAnalyticsSDK,
};

// Expose to window for Kernel Runtimes (StateMachine, PolicyEngine) to dynamically discover
(window as any).__CHATR_SDK_REGISTRY__ = SDK_REGISTRY;

type AppState = 'onboarding' | 'provisioning' | 'os';
type ViewMode = 'home' | 'recruitment' | 'marketplace' | 'knowledge' | 'settings' | 'ai_runtime' | 'organization' | 'package' | 'identity' | 'department';

// ─── Marketplace Industries Data ──────────────────────────────────────────────

const INDUSTRIES = [
 { id: 'retail', name: 'Retail & Local', icon: Store, color: 'text-amber-400', bg: 'bg-amber-400/10' },
 { id: 'healthcare', name: 'Healthcare', icon: Stethoscope, color: 'text-rose-400', bg: 'bg-rose-400/10' },
 { id: 'education', name: 'Education', icon: GraduationCap, color: 'text-blue-400', bg: 'bg-blue-400/10' },
 { id: 'professional', name: 'Professional Services', icon: Briefcase, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
 { id: 'manufacturing', name: 'Manufacturing', icon: Factory, color: 'text-orange-400', bg: 'bg-orange-400/10' },
 { id: 'hospitality', name: 'Hospitality', icon: Coffee, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
 { id: 'finance', name: 'Finance & Banking', icon: Landmark, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
];

// ─── Onboarding Component ─────────────────────────────────────────────────────

const AIBusinessSetup = ({ onComplete }: { onComplete: (template: OSTemplate, profile: any) => void }) => {
 const [phase, setPhase] = useState<'welcome' | 'identity' | 'structure' | 'tech' | 'review' | 'provisioning' | 'complete'>('welcome');
 const [messages, setMessages] = useState<{role: 'ai'|'user', content: React.ReactNode}[]>([
 { role: 'ai', content: <><div className="font-bold text-indigo-400 mb-1">Phase 1: Company Identity</div><p>Welcome to CHATR Business OS.</p><p className="mt-2">Before we build your company's operating system, I'd like to understand how your business works so I can recommend the right organization, workflows, and automations.</p><p className="mt-2">To start, <strong>what is your company name and what do you do?</strong></p></> }
 ]);
 const [inputValue, setInputValue] = useState('');
 const [profile, setProfile] = useState({ name: '', industry: '', dept: [] as string[], tech: [] as string[], teamSize: '', location: '' });
 const [activeField, setActiveField] = useState<string | null>(null);
 
 const completionPercent = Math.round(
 ((profile.name ? 1 : 0) + 
 (profile.industry ? 1 : 0) + 
 (profile.dept.length > 0 ? 1 : 0) + 
 (profile.teamSize ? 1 : 0) + 
 (profile.location ? 1 : 0)) / 5 * 100
 );
 
 // Track metrics
 const [metrics, setMetrics] = useState({
 understanding: 10,
 confidence: 15,
 recommendations: 0,
 accepted: 0
 });

 const [resolvedTemplate, setResolvedTemplate] = useState<OSTemplate | null>(null);
 const [provisioningStep, setProvisioningStep] = useState(0);

 useEffect(() => {
 if (phase === 'provisioning') {
 let step = 0;
 const interval = setInterval(() => {
 step++;
 setProvisioningStep(step);
 if (step >= 8) {
 clearInterval(interval);
 setTimeout(() => {
 setPhase('complete');
 setTimeout(() => onComplete(resolvedTemplate || TEMPLATES[3], profile), 2000);
 }, 1000);
 }
 }, 500);
 return () => clearInterval(interval);
 }
 }, [phase, resolvedTemplate, onComplete]);

 const handleSend = (e: React.FormEvent) => {
 e.preventDefault();
 if (!inputValue.trim() || phase === 'review' || phase === 'provisioning') return;
 
 const userText = inputValue;
 setMessages(prev => [...prev, { role: 'user', content: userText }]);
 setInputValue('');

 setTimeout(() => {
 if (phase === 'identity') {
 const tpl = resolveTemplate(userText);
 setResolvedTemplate(tpl);
 
 let companyName = userText.trim();
 const match = userText.match(/(?:company|name) is ([\w\s]+?)(?: and|,|\.|$)/i) || userText.match(/called ([\w\s]+?)(?: and|,|\.|$)/i);
 if (match) companyName = match[1].trim();
 else if (companyName.split(' ').length > 3) companyName = companyName.split(' ').slice(0, 2).join(' ') + ' Inc';

 const suggestedDepts = tpl.departments.map(d => d.name).slice(0, 4);
 setProfile(p => ({ ...p, name: companyName, industry: tpl.name, dept: suggestedDepts }));
 setMetrics(m => ({ ...m, understanding: 40, confidence: 55, recommendations: 4 }));
 
 setMessages(prev => [...prev, { role: 'ai', content: <><div className="font-bold text-indigo-400 mb-1">Recommendation #1: Organization Design</div><p>Based on your <strong>{tpl.name}</strong> business, I recommend starting with these core departments:</p><div className="flex flex-wrap gap-2 mt-3 mb-3">{suggestedDepts.map(d => <span key={d} className="px-2 py-1 bg-zinc-800 border border-zinc-700/50 rounded text-label ">{d}</span>)}</div><p>Would you like to keep these, remove any, or add more?</p></> }]);
 setPhase('structure');
 } else if (phase === 'structure') {
 let currentDept = [...profile.dept];
 const lower = userText.toLowerCase();
 if (lower.includes('marketing')) currentDept.push('Marketing');
 if (lower.includes('finance')) currentDept.push('Finance');
 if (lower.includes('legal')) currentDept.push('Legal');
 if (lower.includes('remove hr') || lower.includes('no hr')) currentDept = currentDept.filter(d => d !== 'HR');
 
 setProfile(p => ({ ...p, dept: currentDept }));
 setMetrics(m => ({ ...m, understanding: 70, confidence: 85, accepted: m.accepted + 3 }));

 setMessages(prev => [...prev, { role: 'ai', content: <><div className="font-bold text-indigo-400 mb-1">Phase 3: Existing Software Stack</div><p>Perfect, I've finalized the org chart. To ensure CHATR connects seamlessly with your existing workflows, <strong>which software tools do you currently use?</strong> (e.g., Microsoft 365, Slack, Salesforce, GitHub)</p></> }]);
 setPhase('tech');
 } else if (phase === 'tech') {
 let techList = userText.split(',').map(s => s.trim()).filter(Boolean);
 if (techList.length === 0 || techList.length === 1 && techList[0].split(' ').length > 2) techList = [userText.trim()];
 
 setProfile(p => ({ ...p, tech: techList }));
 setMetrics(m => ({ ...m, understanding: 100, confidence: 98 }));

 setMessages(prev => [...prev, { role: 'ai', content: <><div className="font-bold text-emerald-400 mb-1">Consultation Complete</div><p>Excellent. I have completed my business analysis. Please review the Executive Summary below.</p></> }]);
 setPhase('review');
 }
 }, 1000);
 };

 return (
 <div className="flex-1 flex flex-col items-center justify-center bg-[#09090b] relative overflow-hidden h-full">
 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#09090b] to-[#09090b]" />
 
 {phase === 'welcome' ? (
 <div className="w-full h-full flex flex-col p-8 relative z-10 animate-in fade-in duration-700 max-w-[1400px] mx-auto overflow-y-auto">
 
 {/* Top Section: Hero & Illustration */}
 <div className="flex items-center justify-between mb-8">
 {/* Left: Text & Buttons */}
 <div className="max-w-2xl">
 <h2 className="text-indigo-400 font-semibold mb-1 text-secondary lg:text-body">Good Afternoon, Arshid! 👋</h2>
 <h1 className="text-display lg:text-display font-extrabold text-white tracking-tight mb-2">
 Welcome to CHATR<br/>Business OS
 </h1>
 <p className="text-zinc-400 text-secondary lg:text-body mb-6 max-w-lg">
 Your all-in-one operating system for managing, automating, and growing your business.
 </p>
 <div className="flex gap-3">
 <button onClick={() => setPhase('identity')} className="px-5 py-2.5 text-secondary bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center gap-2">
 Start Setup <ArrowRight size={16} />
 </button>
 <button className="px-5 py-2.5 text-button bg-[#111113] border border-zinc-800 text-white rounded-xl hover:bg-zinc-800 transition-all flex items-center gap-2">
 <FolderOpen size={16} className="text-zinc-400" /> Import Company
 </button>
 </div>
 </div>

 {/* Right: Illustration */}
 <div className="relative w-72 h-72 lg:w-80 lg:h-80 flex items-center justify-center shrink-0 hidden lg:flex mr-8">
 {/* Background Glow */}
 <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full" />
 
 {/* Center Cube */}
 <div className="relative w-32 h-32 lg:w-40 lg:h-40 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl rotate-12 shadow-[0_0_50px_rgba(99,102,241,0.5)] flex items-center justify-center border border-white/20">
 <Sparkles size={36} className="text-white" />
 </div>

 {/* Floating Icons */}
 <div className="absolute top-12 left-12 w-12 h-12 bg-[#111113] border border-zinc-800 rounded-xl flex items-center justify-center shadow-xl">
 <Users size={20} className="text-indigo-400" />
 </div>
 <div className="absolute top-8 right-16 w-12 h-12 bg-emerald-900/30 border border-emerald-500/30 rounded-xl flex items-center justify-center shadow-xl">
 <ListTree size={20} className="text-emerald-400" />
 </div>
 <div className="absolute bottom-28 right-4 w-14 h-14 bg-amber-900/30 border border-amber-500/30 rounded-xl flex items-center justify-center shadow-xl">
 <Zap size={24} className="text-amber-400" />
 </div>
 <div className="absolute bottom-12 left-32 w-12 h-12 bg-blue-900/30 border border-blue-500/30 rounded-xl flex items-center justify-center shadow-xl">
 <Shield size={20} className="text-blue-400" />
 </div>
 
 {/* Orbit Rings */}
 <div className="absolute inset-0 border border-white/5 rounded-full rotate-45 scale-110" />
 <div className="absolute inset-8 border border-white/5 rounded-full -rotate-12 scale-105" />
 </div>
 </div>

 {/* Middle Section: Cards */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
 {/* Card 1: Health Assessment */}
 <div className="bg-[#111113] border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden">
 <div className="flex items-start gap-3 mb-5">
 <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
 <Stethoscope size={20} className="text-indigo-400" />
 </div>
 <div>
 <h3 className="text-body font-bold text-white mb-1">Business Health Assessment</h3>
 <p className="text-zinc-400 text-[11px] leading-snug">Our intelligence engine analyzes your inputs to identify key insights and opportunities.</p>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-5">
 {[
 { title: 'Missing Departments', desc: '3 critical departments missing' },
 { title: 'Operational Bottlenecks', desc: '4 bottlenecks detected' },
 { title: 'Reporting Gaps', desc: '2 reporting gaps identified' },
 { title: 'Digital Opportunities', desc: '6 growth opportunities' },
 { title: 'Automation Processes', desc: '5 automation opportunities' },
 { title: 'Organizational Risks', desc: '3 potential risks found' }
 ].map(item => (
 <div key={item.title} className="flex items-start gap-3">
 <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
 <div>
 <div className="text-white text-secondary font-medium">{item.title}</div>
 <div className="text-zinc-500 text-label mt-0.5">{item.desc}</div>
 </div>
 </div>
 ))}
 </div>
 <button className="px-5 py-2.5 bg-[#111113] hover:bg-zinc-800 text-white text-button rounded-lg border border-zinc-700 transition-all flex items-center gap-2">
 View Full Analysis <ArrowRight size={16} />
 </button>
 </div>

 {/* Card 2: After Setup */}
 <div className="bg-[#111113] border border-zinc-800/80 rounded-2xl p-5">
 <div className="flex items-start gap-3 mb-5">
 <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center shrink-0">
 <Zap size={20} className="text-purple-400" />
 </div>
 <div>
 <h3 className="text-body font-bold text-white mb-1">What Happens After Setup</h3>
 <p className="text-zinc-400 text-[11px] leading-snug">Your business OS will be ready in a few simple steps.</p>
 </div>
 </div>
 
 <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:h-full before:w-[1px] before:bg-zinc-800">
 {[
 { step: 'Step 1', title: "Today's Consultation", desc: "We'll understand your business in detail", icon: <LayoutGrid size={14} className="text-emerald-400"/>, ring: 'border-emerald-500/30 bg-emerald-500/10' },
 { step: 'Step 2', title: 'Business Analysis', desc: 'Our AI analyzes data and generates insights', icon: <ListTree size={14} className="text-purple-400"/>, ring: 'border-purple-500/30 bg-purple-500/10' },
 { step: 'Step 3', title: 'Business OS Generated', desc: 'Your tailored Business OS is ready', icon: <Package size={14} className="text-amber-400"/>, ring: 'border-amber-500/30 bg-amber-500/10' },
 { step: 'Step 4', title: 'CEO Dashboard Ready', desc: 'Real-time overview of your business', icon: <LayoutGrid size={14} className="text-blue-400"/>, ring: 'border-blue-500/30 bg-blue-500/10' },
 { step: 'Step 5', title: 'Ready for Operations', desc: "You're all set to operate and grow", icon: <CheckCircle2 size={14} className="text-emerald-400"/>, ring: 'border-emerald-500/30 bg-emerald-500/10' }
 ].map((s, i) => (
 <div key={s.title} className="relative flex items-center justify-between group pl-10">
 <div className="absolute left-0 w-6 h-6 bg-[#111113] flex items-center justify-center z-10 -ml-1.5">
 <div className="w-2 h-2 rounded-full border border-zinc-500 bg-transparent" />
 </div>
 
 <div className="flex items-center gap-3">
 <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${s.ring}`}>
 {s.icon}
 </div>
 <div>
 <div className="text-white text-secondary font-medium">{s.title}</div>
 <div className="text-zinc-500 text-label mt-0.5">{s.desc}</div>
 </div>
 </div>
 
 <div className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wide uppercase ${s.step === 'Step 1' || s.step === 'Step 5' ? 'bg-emerald-500/10 text-emerald-400' : s.step === 'Step 2' ? 'bg-purple-500/10 text-purple-400' : s.step === 'Step 3' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
 {s.step}
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Bottom Section: Metrics */}
 <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] gap-3 mb-2">
 <div className="bg-[#111113] border border-zinc-800/80 rounded-xl p-4 flex items-center justify-between">
 <div>
 <h3 className="text-white font-bold text-label">At a Glance</h3>
 <p className="text-zinc-400 text-[10px] mt-1 leading-tight">Real-time overview<br/>of your business</p>
 </div>
 <ArrowRight size={14} className="text-zinc-600" />
 </div>
 
 <div className="bg-[#111113] border border-zinc-800/80 rounded-xl px-4 py-4 flex items-center justify-center gap-3">
 <LayoutGrid size={20} className="text-blue-400" />
 <div><div className="text-white font-bold text-section ">12</div><div className="text-zinc-500 text-[10px]">Departments</div></div>
 </div>
 
 <div className="bg-[#111113] border border-zinc-800/80 rounded-xl px-4 py-4 flex items-center justify-center gap-3">
 <ListTree size={20} className="text-emerald-400" />
 <div><div className="text-white font-bold text-section ">48</div><div className="text-zinc-500 text-[10px]">Workflows</div></div>
 </div>
 
 <div className="bg-[#111113] border border-zinc-800/80 rounded-xl px-4 py-4 flex items-center justify-center gap-3">
 <Zap size={20} className="text-purple-400" />
 <div><div className="text-white font-bold text-section ">128</div><div className="text-zinc-500 text-[10px]">Automations</div></div>
 </div>
 
 <div className="bg-[#111113] border border-zinc-800/80 rounded-xl px-4 py-4 flex items-center justify-center gap-3">
 <Cpu size={20} className="text-amber-400" />
 <div><div className="text-white font-bold text-section ">24</div><div className="text-zinc-500 text-[10px]">Integrations</div></div>
 </div>

 <div className="bg-[#111113] border border-zinc-800/80 rounded-xl px-4 py-4 flex items-center justify-center gap-3">
 <div className="relative w-8 h-8">
 <svg className="w-8 h-8 transform -rotate-90">
 <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-zinc-800" />
 <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray="87.92" strokeDashoffset="3.51" className="text-emerald-500" />
 </svg>
 </div>
 <div><div className="text-white font-bold text-section ">96%</div><div className="text-zinc-500 text-[10px]">Health</div></div>
 </div>
 </div>

 {/* FAB */}
 <div className="fixed bottom-8 right-8 z-50">
 <button className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:scale-105 transition-transform text-white">
 <Sparkles size={24} />
 </button>
 </div>
 </div>
 ) : phase !== 'provisioning' && phase !== 'complete' ? (
 <div className="w-full max-w-[1400px] mx-auto px-6 flex gap-6 h-[85vh] relative z-10 animate-in fade-in duration-700 pb-8">
 
 {/* Left Column: Business Profile & Score */}
 <div className="w-80 flex flex-col gap-6 shrink-0">
 {/* Business Health Score Card */}
 <div className="bg-[#111113] border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden">
 <h3 className="text-white font-bold mb-6 text-secondary flex items-center gap-2"><Activity size={16} className="text-indigo-400" /> Business Health Score</h3>
 
 <div className="flex items-center gap-6 mb-6">
 <div className="relative w-24 h-24 shrink-0">
 <svg className="w-24 h-24 transform -rotate-90">
 <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zinc-800" />
 <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="251.2" strokeDashoffset="37.68" className="text-indigo-500" />
 </svg>
 <div className="absolute inset-0 flex items-center justify-center flex-col">
 <span className="text-page font-bold text-white ">85</span>
 <span className="text-zinc-500 text-[10px]">/100</span>
 </div>
 </div>
 
 <div className="flex-1 space-y-4">
 <div>
 <div className="flex justify-between text-label mb-1 ">
 <span className="text-zinc-400">Understanding</span>
 <span className="text-white">90%</span>
 </div>
 <div className="w-full bg-zinc-800 rounded-full h-1"><div className="bg-indigo-500 h-1 rounded-full w-[90%]"></div></div>
 </div>
 <div>
 <div className="flex justify-between text-label mb-1 ">
 <span className="text-zinc-400">Confidence</span>
 <span className="text-white">85%</span>
 </div>
 <div className="w-full bg-zinc-800 rounded-full h-1"><div className="bg-emerald-500 h-1 rounded-full w-[85%]"></div></div>
 </div>
 </div>
 </div>

 <div className="border-t border-zinc-800/50 pt-4 flex items-center justify-between">
 <div>
 <div className="text-label text-zinc-500 mb-1">Business Maturity</div>
 <div className="flex items-center gap-1 text-amber-400">
 <Star size={14} fill="currentColor" />
 <Star size={14} fill="currentColor" />
 <Star size={14} fill="currentColor" />
 <Star size={14} fill="currentColor" className="opacity-40" />
 <Star size={14} fill="currentColor" className="opacity-20" />
 </div>
 </div>
 <span className="text-secondary font-bold text-white">4.0</span>
 </div>
 <div className="text-[10px] text-zinc-600 mt-6">Last updated: 22 Jul 2026, 01:45 PM</div>
 </div>

 {/* Business Profile Card */}
 <div className="bg-[#111113] border border-zinc-800/80 rounded-2xl p-6 flex-1 flex flex-col">
 <h3 className="text-white font-bold mb-6 text-secondary flex items-center gap-2"><Building2 size={16} className="text-indigo-400" /> Business Profile</h3>
 
 <div className="space-y-5 text-secondary flex-1">
 <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
 <span className="text-zinc-400">Company</span>
 {activeField === 'company' ? (
 <input autoFocus type="text" className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-input text-white outline-none w-32 text-right" defaultValue={profile.name} onBlur={(e) => { setProfile(p => ({...p, name: e.target.value})); setActiveField(null); }} onKeyDown={(e) => { if(e.key === 'Enter') e.currentTarget.blur(); }} />
 ) : (
 <span onClick={() => setActiveField('company')} className="text-zinc-300 flex items-center gap-1 cursor-pointer hover:text-white">{profile.name || 'Add your company name'} <ArrowRight size={12}/></span>
 )}
 </div>
 <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
 <span className="text-zinc-400">Industry</span>
 {activeField === 'industry' ? (
 <select autoFocus className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-label text-white outline-none w-32" defaultValue={profile.industry} onBlur={(e) => { setProfile(p => ({...p, industry: e.target.value})); setActiveField(null); }} onChange={(e) => { setProfile(p => ({...p, industry: e.target.value})); setActiveField(null); }}>
 <option value="">Select</option>
 {INDUSTRIES.map(ind => <option key={ind.id} value={ind.name}>{ind.name}</option>)}
 </select>
 ) : (
 <span onClick={() => setActiveField('industry')} className="text-zinc-300 flex items-center gap-1 cursor-pointer hover:text-white">{profile.industry || 'Select industry'} <ArrowRight size={12}/></span>
 )}
 </div>
 <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
 <span className="text-zinc-400">Department</span>
 {activeField === 'dept' ? (
 <input autoFocus type="text" placeholder="e.g. Sales, HR" className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-input text-white outline-none w-32 text-right" defaultValue={profile.dept.join(', ')} onBlur={(e) => { setProfile(p => ({...p, dept: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})); setActiveField(null); }} onKeyDown={(e) => { if(e.key === 'Enter') e.currentTarget.blur(); }} />
 ) : (
 <span onClick={() => setActiveField('dept')} className="text-zinc-300 flex items-center gap-1 cursor-pointer hover:text-white">{profile.dept.length > 0 ? `${profile.dept.length} Identified` : 'Add departments'} <ArrowRight size={12}/></span>
 )}
 </div>
 <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
 <span className="text-zinc-400">Team Size</span>
 {activeField === 'teamSize' ? (
 <select autoFocus className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-label text-white outline-none w-32" defaultValue={profile.teamSize} onBlur={(e) => { setProfile(p => ({...p, teamSize: e.target.value})); setActiveField(null); }} onChange={(e) => { setProfile(p => ({...p, teamSize: e.target.value})); setActiveField(null); }}>
 <option value="">Select</option>
 <option value="1-10">1-10</option>
 <option value="11-50">11-50</option>
 <option value="51-200">51-200</option>
 <option value="201-500">201-500</option>
 <option value="500+">500+</option>
 </select>
 ) : (
 <span onClick={() => setActiveField('teamSize')} className="text-zinc-300 flex items-center gap-1 cursor-pointer hover:text-white">{profile.teamSize || 'Add team size'} <ArrowRight size={12}/></span>
 )}
 </div>
 <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3">
 <span className="text-zinc-400">Location</span>
 {activeField === 'location' ? (
 <input autoFocus type="text" className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-input text-white outline-none w-32 text-right" defaultValue={profile.location} onBlur={(e) => { setProfile(p => ({...p, location: e.target.value})); setActiveField(null); }} onKeyDown={(e) => { if(e.key === 'Enter') e.currentTarget.blur(); }} />
 ) : (
 <span onClick={() => setActiveField('location')} className="text-zinc-300 flex items-center gap-1 cursor-pointer hover:text-white">{profile.location || 'Add location'} <ArrowRight size={12}/></span>
 )}
 </div>
 </div>

 <div className="mt-6 pt-4">
 <div className="flex justify-between text-label mb-2 ">
 <span className="text-zinc-400">Profile Completion</span>
 <span className="text-white">{completionPercent}%</span>
 </div>
 <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-2"><div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${completionPercent}%` }}></div></div>
 <p className="text-[10px] text-zinc-500">Complete your profile to get better insights</p>
 </div>
 </div>
 </div>

 {/* Center Column: Business Setup Chat */}
 <div className="flex-1 flex flex-col bg-[#111113] border border-zinc-800/80 rounded-3xl overflow-hidden shadow-xl">
 <div className="p-6 border-b border-zinc-800/50 bg-zinc-950/30">
 <div className="flex items-center gap-4 mb-8 text-center justify-center">
 <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
 <Sparkles size={20} className="text-indigo-400" />
 </div>
 <div className="text-left">
 <h2 className="text-white font-bold text-section">Business Setup</h2>
 <div className="text-label text-zinc-400">Guided setup in progress</div>
 </div>
 </div>
 
 {/* Stepper */}
 <div className="flex items-center justify-between max-w-[280px] mx-auto relative before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:h-[2px] before:bg-zinc-800 before:z-0 px-2">
 <div className="w-8 h-8 rounded-full bg-[#111113] border border-indigo-500/50 text-indigo-400 flex items-center justify-center relative z-10 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
 <Sparkles size={14} />
 </div>
 <div className="w-8 h-8 rounded-full bg-[#111113] border border-zinc-700 text-zinc-500 flex items-center justify-center relative z-10">
 <Building2 size={14} />
 </div>
 <div className="w-8 h-8 rounded-full bg-[#111113] border border-zinc-700 text-zinc-500 flex items-center justify-center relative z-10">
 <CheckCircle2 size={14} />
 </div>
 </div>
 </div>
 
 <div className="flex-1 overflow-y-auto p-8 space-y-6" style={{ scrollbarWidth: 'none' }}>
 <div className="max-w-xl mx-auto">
 <div className="text-label text-indigo-400 font-bold tracking-wide uppercase mb-2">Phase 1 • Company Identity</div>
 <h1 className="text-page font-bold text-white mb-4">Welcome to CHATR Business OS</h1>
 <p className="text-zinc-400 text-secondary mb-8">Before we build your company's operating system, I'd like to understand how your business works so I can recommend the right organization, workflows, and automations.</p>
 
 {messages.length === 0 && <p className="text-white text-body font-medium mb-6">To start, what is your company name and what do you do?</p>}
 
 {phase === 'identity' && messages.length === 0 && (
 <div className="space-y-3 mb-8">
 {[
 { icon: <Briefcase size={16}/>, label: 'We provide IT services' },
 { icon: <Factory size={16}/>, label: 'We run a manufacturing business' },
 { icon: <Store size={16}/>, label: 'We are a consulting firm' },
 { icon: <CheckCircle2 size={16}/>, label: "Other (I'll describe)" }
 ].map((opt, i) => (
 <button key={i} onClick={() => { setInputValue(opt.label); handleSend({ preventDefault: () => {} } as any); }} className="w-full flex items-center gap-3 p-4 rounded-xl border border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700 text-zinc-300 text-secondary transition-all text-left">
 <span className="text-zinc-500">{opt.icon}</span>
 {opt.label}
 </button>
 ))}
 </div>
 )}
 
 {messages.map((msg, i) => (
 <div key={i} className={`flex gap-4 mb-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
 <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-[#111113] border-zinc-800'}`}>
 {msg.role === 'user' ? <span className="text-indigo-400 font-bold text-label">YOU</span> : <Sparkles size={16} className="text-zinc-400" />}
 </div>
 <div className={`p-4 text-secondary max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' : 'bg-[#111113] border border-zinc-800/80 text-zinc-300 rounded-2xl rounded-tl-sm'}`}>
 {msg.content}
 </div>
 </div>
 ))}

 {phase === 'review' && (
 <div className="bg-[#111113] border border-indigo-500/30 rounded-2xl p-6 mt-8">
 <h3 className="text-white font-bold mb-4 flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-400" /> Executive Summary</h3>
 <div className="grid grid-cols-2 gap-y-6 gap-x-8 text-secondary">
 <div>
 <span className="text-zinc-500 block text-label mb-1">Company Profile</span>
 <span className="text-zinc-200 font-medium">{profile.name || 'Acme Corp'} ({profile.industry || 'IT Services'})</span>
 </div>
 <div>
 <span className="text-zinc-500 block text-label mb-1">Departments</span>
 <span className="text-zinc-200 font-medium">{profile.dept.length} Detected, 2 Missing</span>
 </div>
 <div>
 <span className="text-zinc-500 block text-label mb-1 flex items-center gap-1"><Shield size={12} className="text-rose-400"/> Critical Risks</span>
 <span className="text-rose-400 font-medium">1 identified (Knowledge Silos)</span>
 </div>
 <div>
 <span className="text-zinc-500 block text-label mb-1 flex items-center gap-1"><Sparkles size={12} className="text-indigo-400"/> Automation Opportunities</span>
 <span className="text-indigo-400 font-bold">45 Automated Workflows</span>
 </div>
 </div>
 <div className="mt-6 pt-6 border-t border-zinc-800/80 flex items-center justify-between">
 <div>
 <div className="text-label text-zinc-400 mb-1">Estimated Productivity Improvement</div>
 <div className="text-workspace font-bold text-emerald-400">22–35%</div>
 </div>
 <button onClick={() => setPhase('provisioning')} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20">
 Build Business OS
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 
 {phase !== 'review' && (
 <div className="p-6">
 <form onSubmit={handleSend} className="max-w-xl mx-auto flex gap-3 mb-4">
 <input 
 autoFocus
 value={inputValue}
 onChange={e => setInputValue(e.target.value)}
 placeholder="Type your response..."
 className="flex-1 bg-[#111113] border border-zinc-800/80 rounded-xl px-5 py-4 text-secondary text-white focus:outline-none focus:border-indigo-500/50"
 />
 <button type="submit" disabled={!inputValue.trim()} className="px-6 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-all flex items-center justify-center">
 <ArrowRight size={18} />
 </button>
 </form>
 <div className="max-w-xl mx-auto flex items-center justify-between text-label">
 <span className="text-zinc-500"><span className="text-zinc-300 font-medium">Why I'm asking:</span> {phase === 'identity' ? "This helps personalize your Business OS" : phase === 'structure' ? "Departments determine how work flows through your organization." : "This allows CHATR to connect with your existing tools."}</span>
 {phase === 'identity' && <span className="text-zinc-500"><span className="text-zinc-300 font-medium">Example:</span> "Acme Corp, IT Services"</span>}
 </div>
 </div>
 )}
 </div>

 {/* Right Column: Dynamic Assistant */}
 <div className="w-80 flex flex-col gap-6 shrink-0">
 <div className="bg-[#111113] border border-zinc-800/80 rounded-2xl p-6 flex-1 flex flex-col">
 <h3 className="text-white font-bold mb-6 text-secondary flex items-center gap-2">
 <div className="bg-indigo-500/20 text-indigo-400 p-1.5 rounded"><Sparkles size={14}/></div> 
 Dynamic Assistant
 </h3>
 
 <div className="space-y-6 flex-1">
 <div className="animate-in fade-in slide-in-from-right-4">
 <h4 className="text-zinc-300 font-medium text-secondary mb-2 flex items-center gap-2"><Sparkles size={12} className="text-indigo-400" /> {phase === 'identity' ? 'Why company name?' : phase === 'structure' ? 'Why departments?' : 'Why existing software?'}</h4>
 <p className="text-secondary text-zinc-400 ">{phase === 'identity' ? 'Your company name personalizes your Business OS, dashboards, reports, digital assistants, and better integrations.' : phase === 'structure' ? 'Departments become the foundation for teams, approvals, business logic, and reporting.' : 'Allows CHATR to connect with your CRM, accounting, HR, and project management tools instead of replacing them.'}</p>
 </div>

 <div className="mt-8">
 <h4 className="text-zinc-300 font-bold text-secondary mb-4">Need help? Ask anything.</h4>
 <div className="space-y-3">
 {[
 'What is a Business OS?',
 'Why do I need departments?',
 'What is a business workflow?',
 'Explain workflows.',
 'How is my data used?'
 ].map((q, i) => (
 <button key={i} className="w-full text-left p-3.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-800/80 border border-zinc-800 text-button text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-3">
 <span className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-bold">?</span>
 {q}
 </button>
 ))}
 </div>
 </div>
 </div>
 
 <div className="mt-6 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 rounded-xl p-5 relative overflow-hidden group cursor-pointer">
 <div className="absolute right-[-10px] bottom-[-10px] opacity-20 transform group-hover:scale-110 transition-transform">
 <Sparkles size={80} className="text-purple-400" />
 </div>
 <h4 className="text-white font-bold mb-1">CHATR AI</h4>
 <p className="text-label text-indigo-200/70 relative z-10">Your intelligent business companion.<br/>Always here to help you grow.</p>
 <div className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 group-hover:translate-x-1 transition-transform">
 <Sparkles size={20} />
 </div>
 </div>
 </div>
 </div>

 </div>
 ) : phase === 'provisioning' ? (
 <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800 rounded-2xl p-8 relative z-10 animate-in slide-in-from-bottom-10 duration-500 shadow-2xl">
 <div className="flex items-center gap-3 mb-6">
 <Loader2 size={24} className="text-indigo-400 animate-spin" />
 <h2 className="text-workspace font-bold text-white">Live Provisioning</h2>
 </div>
 <div className="space-y-4 font-mono text-label">
 {[
 'Creating Company Profile...',
 'Building Organization Graph...',
 'Creating Departments...',
 'Designing Workflows...',
 'Configuring Business Logic...',
 'Generating Dashboards...',
 'Building Knowledge Base...',
 'Business OS Ready.'
 ].map((stepText, i) => (
 <div key={i} className={`flex items-center gap-3 ${provisioningStep > i ? 'text-zinc-200' : provisioningStep === i ? 'text-indigo-400 font-bold' : 'text-zinc-700'}`}>
 {provisioningStep > i ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <div className={`w-3.5 h-3.5 rounded-full border ${provisioningStep === i ? 'border-indigo-400 bg-indigo-500/20' : 'border-zinc-700'}`} />}
 <span>{stepText}</span>
 {provisioningStep === i && <span className="ml-auto text-indigo-400 animate-pulse">Running</span>}
 {provisioningStep > i && <span className="ml-auto text-emerald-500">Done</span>}
 </div>
 ))}
 </div>
 </div>
 ) : (
 <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800 rounded-2xl p-8 relative z-10 animate-in slide-in-from-bottom-10 duration-500 shadow-2xl">
 <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mb-6 mx-auto">
 <CheckCircle2 size={24} />
 </div>
 <h2 className="text-workspace font-bold text-white text-center mb-6">OS Successfully Provisioned</h2>
 <div className="space-y-4">
 {[
 { label: 'Organization Graph', count: 'Created', icon: Database },
 { label: 'Capabilities', count: '31 Mapped', icon: Command },
 { label: 'Domain Superintendent', count: 'Online', icon: Sparkles },
 ].map((step, i) => (
 <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50 animate-in slide-in-from-right-4 fade-in fill-mode-both" style={{ animationDelay: `${i * 200}ms`}}>
 <div className="flex items-center gap-3">
 <step.icon size={16} className="text-zinc-400" />
 <span className="text-secondary font-medium text-zinc-200">{step.label}</span>
 </div>
 <span className="text-label font-bold text-indigo-400">{step.count}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
};

// ─── App Config Modal ────────────────────────────────────────────────────────

const AppConfigModal = ({ pkg, onClose, onSave }: { pkg: any, onClose: () => void, onSave: (config: Record<string, any>) => void }) => {
 const [config, setConfig] = useState<Record<string, any>>(() => {
 const defaults: Record<string, any> = {};
 (pkg.configSchema || []).forEach((f: any) => { defaults[f.key] = f.defaultValue ?? ''; });
 return defaults;
 });
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);

 const groups = [...new Set((pkg.configSchema || []).map((f: any) => f.group || 'General'))];

 const handleSave = async () => {
 setSaving(true);
 // Simulate config save to OS Kernel
 setTimeout(() => {
 setSaved(true);
 onSave(config);
 setTimeout(() => { setSaved(false); onClose(); }, 1000);
 setSaving(false);
 }, 600);
 };

 return (
 <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
 <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b border-zinc-800">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-page">{pkg.icon}</div>
 <div>
 <h2 className="text-section font-bold text-white">{pkg.name}</h2>
 <p className="text-label text-zinc-500">{pkg.category} • {pkg.maturity}</p>
 </div>
 </div>
 <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
 <X size={16} />
 </button>
 </div>

 {/* Config Body */}
 <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}>
 {groups.map(group => {
 const fields = (pkg.configSchema || []).filter((f: any) => (f.group || 'General') === group);
 return (
 <div key={group}>
 <h3 className="text-label font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
 <span className="w-4 h-px bg-zinc-700" />{group}
 </h3>
 <div className="space-y-4">
 {fields.map((field: any) => (
 <div key={field.key}>
 <div className="flex items-center justify-between mb-1.5">
 <label className="text-secondary font-medium text-zinc-300">{field.label}</label>
 {field.required && <span className="text-[10px] text-amber-400 font-bold">REQUIRED</span>}
 </div>
 {field.description && <p className="text-label text-zinc-500 mb-2">{field.description}</p>}

 {field.type === 'boolean' && (
 <button
 onClick={() => setConfig(c => ({ ...c, [field.key]: !c[field.key] }))}
 className={`relative w-12 h-6 rounded-full transition-all ${config[field.key] ? 'bg-indigo-500' : 'bg-zinc-700'}`}
 >
 <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${config[field.key] ? 'left-7' : 'left-1'}`} />
 </button>
 )}
 {(field.type === 'text' || field.type === 'email' || field.type === 'url') && (
 <input
 type={field.type}
 value={config[field.key]}
 onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))}
 className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-secondary text-white focus:outline-none focus:border-indigo-500/70 transition-colors"
 placeholder={`Enter ${field.label.toLowerCase()}...`}
 />
 )}
 {field.type === 'number' && (
 <input
 type="number"
 value={config[field.key]}
 onChange={e => setConfig(c => ({ ...c, [field.key]: Number(e.target.value) }))}
 className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-secondary text-white focus:outline-none focus:border-indigo-500/70 transition-colors"
 />
 )}
 {field.type === 'color' && (
 <div className="flex items-center gap-3">
 <input type="color" value={config[field.key]} onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))} className="w-10 h-10 rounded-lg cursor-pointer border border-zinc-700 bg-transparent" />
 <span className="text-secondary text-zinc-400 font-mono">{config[field.key]}</span>
 </div>
 )}
 {field.type === 'select' && (
 <select
 value={config[field.key]}
 onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))}
 className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-secondary text-white focus:outline-none focus:border-indigo-500/70 transition-colors"
 >
 {(field.options || []).map((opt: string) => (
 <option key={opt} value={opt}>{opt}</option>
 ))}
 </select>
 )}
 {field.type === 'multiselect' && (
 <div className="flex flex-wrap gap-2">
 {(field.options || field.defaultValue || []).map((opt: string) => {
 const selected = Array.isArray(config[field.key]) ? config[field.key].includes(opt) : (config[field.key] || '').includes(opt);
 return (
 <button
 key={opt}
 onClick={() => {
 const cur = Array.isArray(config[field.key]) ? [...config[field.key]] : [];
 setConfig(c => ({ ...c, [field.key]: selected ? cur.filter(v => v !== opt) : [...cur, opt] }));
 }}
 className={`px-3 py-1.5 rounded-lg text-label border transition-all ${selected ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500'}`}
 >{opt}</button>
 );
 })}
 </div>
 )}
 </div>
 ))}
 </div>
 </div>
 );
 })}
 {(!pkg.configSchema || pkg.configSchema.length === 0) && (
 <div className="text-center py-8 text-zinc-500 text-secondary">
 <Settings size={24} className="mx-auto mb-3 text-zinc-700" />
 This capability uses default settings. No additional configuration required.
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between p-5 border-t border-zinc-800 bg-zinc-950/50">
 <button onClick={onClose} className="px-5 py-2 text-button text-zinc-400 hover:text-white transition-colors">Cancel</button>
 <button
 onClick={handleSave}
 disabled={saving}
 className={`px-6 py-2.5 rounded-xl text-secondary font-bold transition-all flex items-center gap-2 ${saved ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
 >
 {saved ? <><CheckCircle2 size={15} /> Saved!</> : saving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : <><Settings size={15} /> Save Configuration</>}
 </button>
 </div>
 </div>
 </div>
 );
};

// ─── Marketplace Component ────────────────────────────────────────────────────

const CATEGORIES = [
 'All',
 'Executive & Strategy',
 'CRM & Sales',
 'Marketing',
 'Recruitment & HR',
 'Finance',
 'Operations',
 'Customer Support',
 'Communication',
 'AI & Automation',
 'Enterprise Platform',
];

const MATURITY_COLORS: Record<string, string> = {
 L5: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
 L4: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
 L3: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
 L2: 'bg-zinc-700 text-zinc-400',
 L1: 'bg-zinc-800 text-zinc-500',
};

const MarketplaceView = ({ installedPackages, onInstall }: { installedPackages: string[], onInstall: (id: string, manifest: any) => void }) => {
 const [installingId, setInstallingId] = useState<string | null>(null);
 const [allPackages, setAllPackages] = useState<any[]>(CATALOG); // ← Load static catalog immediately
 const [loading, setLoading] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const [activeCategory, setActiveCategory] = useState('All');
 const [configPkg, setConfigPkg] = useState<any | null>(null);
 const [localInstalled, setLocalInstalled] = useState<string[]>(installedPackages);

 useEffect(() => { setLocalInstalled(installedPackages); }, [installedPackages]);

 // Load live data from server (optional enhancement — catalog works statically without it)
 const filtered = allPackages.filter(pkg => {
 const q = searchQuery.toLowerCase();
 const matchesSearch = !q || pkg.name?.toLowerCase().includes(q) || pkg.description?.toLowerCase().includes(q) || pkg.category?.toLowerCase().includes(q) || (pkg.tags || []).some((t: string) => t.toLowerCase().includes(q));
 const matchesCat = activeCategory === 'All' || pkg.category === activeCategory;
 return matchesSearch && matchesCat;
 });

 const featured = filtered.filter((p: any) => (p.installs || 0) > 15000);
 const rest = filtered.filter((p: any) => (p.installs || 0) <= 15000);

 const handleInstall = async (id: string) => {
 setInstallingId(id);
 const manifest = allPackages.find((p: any) => p.id === id);
 try {
 // Execute the SDK installation pipeline passed from parent
 await onInstall(id, manifest);
 setLocalInstalled(p => [...p, id]);
 } catch (err) { console.error(err); }
 finally { setInstallingId(null); }
 };

 const PackageCard = ({ pkg }: { pkg: any }) => {
 const isInstalled = localInstalled.includes(pkg.id);
 const isInstalling = installingId === pkg.id;
 return (
 <div className="group p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all duration-200 flex flex-col h-full">
 {/* Top Row */}
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 flex items-center justify-center text-page group-hover:scale-105 transition-transform">
 {pkg.icon || '📦'}
 </div>
 <div>
 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">{pkg.category}</span>
 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block ${MATURITY_COLORS[pkg.maturity] || MATURITY_COLORS.L3}`}>
 {pkg.maturity}
 </span>
 </div>
 </div>
 {isInstalled && (
 <button
 onClick={() => setConfigPkg(pkg)}
 className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all opacity-0 group-hover:opacity-100"
 >
 <Settings size={14} />
 </button>
 )}
 </div>

 {/* Name & Description */}
 <h3 className="text-secondary font-bold text-white mb-2 ">{pkg.name}</h3>
 <p className="text-label text-zinc-500 flex-1 line-clamp-3">{pkg.description}</p>

 {/* Stats */}
 <div className="flex items-center gap-3 mt-4 mb-4">
 <div className="flex items-center gap-1">
 <Star size={11} className="text-amber-400 fill-amber-400" />
 <span className="text-label text-zinc-400 ">{(pkg.rating || 4.5).toFixed(1)}</span>
 </div>
 <span className="text-zinc-700">·</span>
 <span className="text-label text-zinc-500">{pkg.installs ? `${(pkg.installs / 1000).toFixed(0)}k` : '1k'} installs</span>
 {pkg.version && <><span className="text-zinc-700">·</span><span className="text-label text-zinc-500">v{pkg.version}</span></>}
 </div>

 {/* Tags */}
 <div className="flex flex-wrap gap-1 mb-4">
 {(pkg.tags || []).slice(0, 3).map((tag: string) => (
 <span key={tag} className="px-2 py-0.5 bg-zinc-800/80 text-zinc-500 text-[10px] rounded-full border border-zinc-700/50">{tag}</span>
 ))}
 </div>

 {/* Actions */}
 <div className="flex gap-2">
 <button
 onClick={() => !isInstalled && !isInstalling && handleInstall(pkg.id)}
 disabled={isInstalled || isInstalling}
 className={`flex-1 py-2 rounded-xl font-bold text-label transition-all flex items-center justify-center gap-1.5 ${
 isInstalled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
 : isInstalling ? 'bg-indigo-600/10 text-indigo-400 cursor-wait opacity-70'
 : 'bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/25 border border-indigo-500/20'
 }`}
 >
 {isInstalled ? <><CheckCircle2 size={13} /> Installed</> : isInstalling ? <><Loader2 size={13} className="animate-spin" /> Installing...</> : <>Install</>}
 </button>
 <button
 onClick={() => setConfigPkg(pkg)}
 className="px-3 py-2 rounded-xl bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 text-label transition-all flex items-center gap-1 border border-zinc-700/50"
 >
 <Settings size={12} />
 </button>
 </div>
 </div>
 );
 };

 return (
 <div className="flex flex-1 h-full w-full overflow-hidden bg-[#09090b]">
 {/* Config Modal */}
 {configPkg && (
 <AppConfigModal
 pkg={configPkg}
 onClose={() => setConfigPkg(null)}
 onSave={(cfg) => {
 localStorage.setItem(`chatr_marketplace_config_${configPkg.id}`, JSON.stringify(cfg));
 setConfigPkg(null);
 }}
 />
 )}

 {/* Left: Category Sidebar */}
 <div className="w-52 flex-shrink-0 border-r border-zinc-800/60 bg-zinc-950/60 p-4 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
 <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 px-2">Categories</div>
 <div className="space-y-0.5">
 {CATEGORIES.map(cat => (
 <button
 key={cat}
 onClick={() => setActiveCategory(cat)}
 className={`w-full text-left px-3 py-2 rounded-xl text-label transition-all ${activeCategory === cat ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
 >
 {cat}
 {cat !== 'All' && (
 <span className="float-right text-zinc-700 text-[10px]">
 {allPackages.filter(p => p.category === cat).length}
 </span>
 )}
 </button>
 ))}
 </div>
 </div>

 {/* Right: Main content */}
 <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}>
 <div className="p-8 max-w-6xl mx-auto space-y-10">

 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-display font-extrabold text-white tracking-tight">Marketplace Ecosystem</h1>
 <p className="text-zinc-400 mt-1">
 {loading ? 'Loading apps...' : `${allPackages.length} capability packages • ${localInstalled.length} installed`}
 </p>
 </div>
 <div className="relative">
 <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
 <input
 type="text"
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 placeholder="Search apps, categories, tags..."
 className="w-80 bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-secondary text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
 />
 </div>
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-20">
 <div className="text-center">
 <Loader2 size={36} className="text-indigo-400 animate-spin mx-auto mb-4" />
 <p className="text-zinc-500 text-secondary">Loading marketplace apps from kernel...</p>
 </div>
 </div>
 ) : filtered.length === 0 ? (
 <div className="text-center py-20 text-zinc-600">
 <Package size={40} className="mx-auto mb-4 text-zinc-800" />
 <p className="font-medium text-zinc-500">No apps found</p>
 <p className="text-secondary mt-1">Try adjusting your search or category filter</p>
 </div>
 ) : (
 <>
 {/* Featured (high-installs) */}
 {featured.length > 0 && (
 <div>
 <div className="flex items-center gap-3 mb-5">
 <span className="text-label font-bold text-zinc-500 uppercase tracking-widest">⭐ Featured Apps</span>
 <div className="flex-1 h-px bg-zinc-800/60" />
 <span className="text-label text-zinc-600">{featured.length} apps</span>
 </div>
 <div className="grid grid-cols-3 gap-5">
 {featured.map(pkg => <PackageCard key={pkg.id} pkg={pkg} />)}
 </div>
 </div>
 )}

 {/* All Other Apps */}
 {rest.length > 0 && (
 <div>
 <div className="flex items-center gap-3 mb-5">
 <span className="text-label font-bold text-zinc-500 uppercase tracking-widest">{activeCategory === 'All' ? 'All Apps' : activeCategory}</span>
 <div className="flex-1 h-px bg-zinc-800/60" />
 <span className="text-label text-zinc-600">{rest.length} apps</span>
 </div>
 <div className="grid grid-cols-3 gap-5">
 {rest.map(pkg => <PackageCard key={pkg.id} pkg={pkg} />)}
 </div>
 </div>
 )}
 </>
 )}
 </div>
 </div>
 </div>
 );
};


// ─── Domain Superintendent View ────────────────────────────────────────────────

const DomainSuperintendentView = ({ template }: { template: OSTemplate }) => {
 const [messages, setMessages] = useState<any[]>([]);
 const [inputValue, setInputValue] = useState('');
 const [actions, setActions] = useState(template.superintendent.actions);

 useEffect(() => {
 setMessages([
 { role: 'ai', content: template.superintendent.messages.ai1 },
 { role: 'user', content: template.superintendent.messages.user1 },
 { role: 'ai', content: template.superintendent.messages.ai2 }
 ]);
 setActions(template.superintendent.actions);
 }, [template]);

 const [isTyping, setIsTyping] = useState(false);

 const handleSend = async () => {
 if (!inputValue.trim()) return;
 const userText = inputValue;
 setMessages(prev => [...prev, { role: 'user', content: userText }]);
 setInputValue('');
 setIsTyping(true);
 
 try {
 // Phase 7C/7D: Real Execution Pipeline
 
 // 1. Intent Runtime (Mocked parsing for demo)
 const intent = { intent: 'prepare_offer', entity: 'Candidate', target: userText };
 
 // 2. Context Runtime (The Moat)
 const context = ContextRuntime.buildContext(intent);
 
 // 3. Goal Planner
 const plan = GoalPlanner.createPlan(context);
 
 // Visualizer
 setMessages(prev => [...prev, { 
 role: 'ai', 
 content: (
 <div>
 <div className="flex items-center gap-2 text-indigo-400 font-medium mb-3">
 <ListTree size={16} /> Generated Execution Graph (DAG)
 </div>
 <div className="text-secondary text-zinc-400 mb-4">
 I have analyzed your intent and built the following execution graph across your installed business capabilities.
 </div>
 <div className="space-y-3">
 {plan.nodes.map(node => (
 <div key={node.id} className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl relative">
 <div className="flex items-start justify-between">
 <div>
 <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 mr-2 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{node.type}</span>
 <span className="font-bold text-white text-secondary">{node.name}</span>
 <p className="text-label text-zinc-500 mt-1.5">{node.description}</p>
 </div>
 </div>
 {node.dependencies.length > 0 && (
 <div className="mt-2 text-[10px] text-zinc-600 font-mono bg-zinc-900 inline-block px-2 py-0.5 rounded">
 Depends on: {node.dependencies.join(', ')}
 </div>
 )}
 </div>
 ))}
 </div>
 <button 
 onClick={() => handleExecuteGraph(plan)}
 className="mt-5 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl text-secondary flex items-center gap-2 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)]"
 >
 <Play size={16} fill="currentColor" /> Authorize Execution
 </button>
 </div>
 )
 }]);
 } catch (err) {
 console.error(err);
 setMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error planning that request.' }]);
 } finally {
 setIsTyping(false);
 }
 };

 const handleExecuteGraph = async (plan: IExecutionGraph) => {
 setMessages(prev => [...prev, {
 role: 'ai',
 content: <div className="flex items-center gap-2 text-emerald-400"><Loader2 size={16} className="animate-spin" /> Executing Business Graph...</div>
 }]);

 // 4. Execution Runtime
 const result = await ExecutionRuntime.execute(plan);

 setMessages(prev => [...prev, {
 role: 'ai',
 content: (
 <div>
 <div className="flex items-center gap-2 text-emerald-400 font-medium mb-3">
 <CheckCircle2 size={16} /> Execution Completed
 </div>
 <div className="p-3 bg-zinc-950 rounded-lg text-label font-mono text-zinc-400 border border-zinc-800 h-32 overflow-y-auto">
 {result.logs.map((log, i) => <div key={i}>{log}</div>)}
 </div>
 <p className="text-secondary text-zinc-300 mt-3">The graph has finished executing. 1 item requires your human approval (Policy Enforcement).</p>
 </div>
 )
 }]);
 };

 const handleApproveAction = (idx: number) => {
 if (actions[idx].status !== 'Pending Approval') return;
 const updated = [...actions];
 updated[idx] = { ...updated[idx], status: 'Active' };
 setActions(updated);

 setMessages(prev => [...prev, { 
 role: 'ai', 
 content: <><div className="flex items-center gap-2 text-emerald-400 font-medium"><CheckCircle2 size={16} /> Action Approved: {updated[idx].title}</div><p className="mt-2">Executing automation workflow immediately.</p></>
 }]);
 };

 return (
 <div className="flex-1 overflow-y-auto p-10 bg-[#09090b] h-full relative" style={{ scrollbarWidth: 'none' }}>
 {/* Ambient Glow */}
 <div className={`absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br ${template.superintendent.iconColor} opacity-10 rounded-full blur-[120px] pointer-events-none`} />
 
 <div className="max-w-6xl mx-auto space-y-8 relative z-10">
 <div className="flex items-center justify-between border-b border-zinc-800/80 pb-6">
 <div className="flex items-center gap-5">
 <div className={`w-16 h-16 bg-gradient-to-br ${template.superintendent.iconColor} rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.3)] border border-white/10`}>
 <Sparkles size={28} className="text-white" />
 </div>
 <div>
 <h1 className="text-display font-extrabold text-white tracking-tight">{template.superintendent.name}</h1>
 <div className="flex items-center gap-3 mt-2">
 <span className="flex items-center gap-1.5 text-label font-bold px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg">
 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active
 </span>
 <span className="text-secondary text-zinc-400 font-medium">{template.superintendent.description}</span>
 </div>
 </div>
 </div>
 <button className="px-5 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-2">
 <Settings size={16} /> Configure AI
 </button>
 </div>

 <div className="grid grid-cols-3 gap-6">
 {/* Main Chat Interface */}
 <div className="col-span-2 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-1 flex flex-col h-[600px] backdrop-blur-xl shadow-2xl">
 <div className="flex-1 overflow-y-auto p-6 space-y-6">
 {messages.map((msg, i) => (
 <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-indigo-500/20 border-indigo-500/30'}`}>
 {msg.role === 'user' ? <span className="text-emerald-400 font-bold text-secondary">You</span> : <Sparkles size={20} className="text-indigo-400" />}
 </div>
 <div className={`p-4 rounded-2xl text-secondary shadow-sm ${msg.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 rounded-tl-sm space-y-3'}`}>
 {msg.content}
 </div>
 </div>
 ))}
 </div>
 
 <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/50 rounded-b-2xl">
 <div className="relative">
 <input 
 type="text" 
 value={inputValue}
 onChange={e => setInputValue(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && handleSend()}
 placeholder="Ask Superintendent to execute workflows, query data, or change policies..." 
 className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl py-3 pl-4 pr-12 text-secondary text-white focus:outline-none focus:border-indigo-500/50 shadow-inner" 
 />
 <button onClick={handleSend} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center hover:bg-indigo-500 transition-colors">
 <ArrowRight size={16} className="text-white" />
 </button>
 </div>
 </div>
 </div>

 {/* Right Sidebar */}
 <div className="space-y-6">
 <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 backdrop-blur-xl">
 <h3 className="text-label font-bold text-zinc-500 uppercase tracking-widest mb-4">Autonomous Actions</h3>
 <div className="space-y-3">
 {actions.map((action, idx) => (
 <div 
 key={action.title} 
 onClick={() => handleApproveAction(idx)}
 className={`flex items-start gap-3 p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-xl ${action.status === 'Pending Approval' ? 'cursor-pointer hover:border-amber-500/50 hover:bg-zinc-900/80 transition-colors group' : ''}`}
 >
 <action.icon size={16} className="text-indigo-400 shrink-0 mt-0.5" />
 <div className="flex-1">
 <div className="text-secondary font-bold text-zinc-200">{action.title}</div>
 <div className="text-[10px] text-zinc-500 mt-0.5">{action.desc}</div>
 <div className="flex justify-between items-center mt-2">
 <div className={`text-[9px] font-bold inline-block px-1.5 py-0.5 rounded ${action.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20'}`}>
 {action.status}
 </div>
 {action.status === 'Pending Approval' && (
 <div className="text-[9px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
 Click to Approve
 </div>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 backdrop-blur-xl">
 <h3 className="text-label font-bold text-zinc-500 uppercase tracking-widest mb-4">Semantic Graph Access</h3>
 <div className="flex flex-wrap gap-2">
 {template.superintendent.knowledgeGraph.map(node => (
 <span key={node} className="px-2 py-1 bg-zinc-800 text-zinc-300 text-label rounded border border-zinc-700">{node}</span>
 ))}
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};

// ─── Organization View ────────────────────────────────────────────────────────

const OrganizationView = ({ template }: { template: OSTemplate }) => {
 const [departments, setDepartments] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 // Generate actual organization map from SDK Registry
 const registry = (window as any).__CHATR_SDK_REGISTRY__ || {};
 const deptsMap: Record<string, any> = {};

 Object.keys(registry).forEach(pkgId => {
 const [domain] = pkgId.split('.');
 if (!domain) return;

 if (!deptsMap[domain]) {
 deptsMap[domain] = {
 id: domain,
 name: domain,
 status: 'healthy',
 agents: 0,
 packages: 0
 };
 }
 deptsMap[domain].packages += 1;
 if (registry[pkgId].agents) {
 deptsMap[domain].agents += registry[pkgId].agents.length;
 }
 });

 setDepartments(Object.values(deptsMap));
 setLoading(false);
 }, []);

 return (
 <div className="flex-1 overflow-y-auto p-10 bg-[#09090b] h-full relative" style={{ scrollbarWidth: 'none' }}>
 <div className="max-w-6xl mx-auto">
 <div className="mb-10">
 <h1 className="text-display font-extrabold text-white tracking-tight">Organization Structure</h1>
 <p className="text-secondary text-zinc-400 mt-2">Manage your departments, packages, and AI agents mapped across the {template.name} semantic object.</p>
 </div>

 {loading ? (
 <div className="flex items-center justify-center p-20">
 <Loader2 size={32} className="text-indigo-400 animate-spin" />
 </div>
 ) : (
 <LayoutEngine workspaceType="dashboard" className="mb-0">
 {departments.map(dept => (
 <div key={dept.id} className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl flex flex-col h-full group hover:border-zinc-700 transition-colors">
 <div className="flex items-center justify-between mb-4">
 <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
 <Building2 size={18} className="text-zinc-300 group-hover:text-white transition-colors" />
 </div>
 <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${dept.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
 {(dept.status || 'healthy').toUpperCase()}
 </span>
 </div>
 <h3 className="text-section font-bold text-white mb-6">{dept.name}</h3>
 
 <div className="mt-auto space-y-3">
 <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
 <div className="flex items-center gap-2 text-secondary text-zinc-400">
 <Sparkles size={14} className="text-indigo-400" /> Active Agents
 </div>
 <span className="font-bold text-white">{dept.agents || 0}</span>
 </div>
 <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
 <div className="flex items-center gap-2 text-secondary text-zinc-400">
 <Package size={14} className="text-zinc-500" /> Packages Installed
 </div>
 <span className="font-bold text-white">{dept.packages || 0}</span>
 </div>
 </div>
 </div>
 ))}
 
 {/* Placeholder for Add Department */}
 <div className="bg-zinc-900/20 border-2 border-dashed border-zinc-800/80 rounded-2xl p-6 flex flex-col items-center justify-center h-full hover:bg-zinc-900/40 hover:border-zinc-700 transition-colors cursor-pointer group min-h-[250px]">
 <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-zinc-700 transition-colors">
 <Plus size={20} className="text-zinc-400 group-hover:text-white" />
 </div>
 <h3 className="text-secondary font-bold text-zinc-400 group-hover:text-white">Add Department</h3>
 </div>
 </LayoutEngine>
 )}
 </div>
 </div>
 );
};

// ─── Enterprise Knowledge Fabric ──────────────────────────────────────────────

const KnowledgeFabricView = ({ template }: { template: OSTemplate }) => {
 const [stats, setStats] = useState<any>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 // Generate live knowledge stats from the SDK objects
 const registry = (window as any).__CHATR_SDK_REGISTRY__ || {};
 let docs = 0;
 
 Object.keys(registry).forEach(pkgId => {
 const sdk = registry[pkgId];
 if (sdk.objects) {
 sdk.objects.forEach((obj: any) => {
 const records = BusinessObjectStore.list(pkgId, obj.name);
 docs += records.length;
 });
 }
 });

 setStats({
 indexedDocuments: docs,
 vectorEmbeddings: docs * 15, // Mock average embeddings per doc
 integrations: [
 { name: 'Google Workspace', desc: 'Drive, Docs, Sheets', type: 'google', status: 'Connected' },
 { name: 'Slack', desc: 'Channels and DMs', type: 'slack', status: 'Connected' },
 { name: 'Notion', desc: 'Team Wikis', type: 'notion', status: 'Active' },
 { name: 'Local File System', desc: 'Desktop Sync', type: 'local', status: 'Disconnected' }
 ]
 });
 setLoading(false);
 }, []);

 return (
 <div className="flex-1 overflow-y-auto p-10 bg-[#09090b] h-full relative" style={{ scrollbarWidth: 'none' }}>
 <div className="max-w-5xl mx-auto">
 <div className="mb-10">
 <h1 className="text-display font-extrabold text-white tracking-tight">Enterprise Knowledge Fabric</h1>
 <p className="text-secondary text-zinc-400 mt-2">Connect your data sources. The AI Semantic Engine will automatically index and map these to the {template.name} graph.</p>
 </div>

 {loading ? (
 <div className="flex items-center justify-center p-20">
 <Loader2 size={32} className="text-indigo-400 animate-spin" />
 </div>
 ) : (
 <>
 <LayoutEngine workspaceType="dashboard" className="mb-10">
 <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl">
 <div className="text-display font-extrabold text-white mb-1">{stats?.indexedDocuments?.toLocaleString() || 0}</div>
 <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Indexed Documents</div>
 </div>
 <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl">
 <div className="text-display font-extrabold text-white mb-1">{stats?.vectorEmbeddings?.toLocaleString() || 0}</div>
 <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Vector Embeddings</div>
 </div>
 <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl">
 <div className="text-display font-extrabold text-emerald-400 mb-1">Active</div>
 <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Sync Status</div>
 </div>
 </LayoutEngine>

 <h2 className="text-label font-bold text-zinc-500 uppercase tracking-widest mb-4">Semantic Graph Nodes</h2>
 <div className="flex flex-wrap gap-3 mb-12">
 {template.superintendent.knowledgeGraph.map(node => (
 <div key={node} className="px-4 py-2 bg-indigo-500/10 text-indigo-300 font-medium rounded-xl border border-indigo-500/20 flex items-center gap-2">
 <Database size={14} /> {node}
 </div>
 ))}
 <div className="px-4 py-2 bg-zinc-900/50 text-zinc-400 font-medium rounded-xl border border-zinc-800 border-dashed cursor-pointer hover:text-white transition-colors">
 + Add Custom Node
 </div>
 </div>

 <h2 className="text-label font-bold text-zinc-500 uppercase tracking-widest mb-4">Data Integrations</h2>
 <div className="grid grid-cols-2 gap-4">
 {(stats?.integrations || []).map((int: any) => (
 <div key={int.name} className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between group hover:border-zinc-700 transition-colors">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
 {int.type === 'google' && <Database size={20} className="text-blue-400" />}
 {int.type === 'notion' && <FileText size={20} className="text-white" />}
 {int.type === 'slack' && <Users size={20} className="text-rose-400" />}
 {int.type === 'local' && <FolderOpen size={20} className="text-emerald-400" />}
 </div>
 <div>
 <h3 className="font-bold text-white text-secondary">{int.name}</h3>
 <p className="text-label text-zinc-500 mt-0.5">{int.desc}</p>
 </div>
 </div>
 <button className={`px-4 py-2 rounded-xl text-label font-bold transition-colors ${int.status === 'Connected' || int.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
 {int.status}
 </button>
 </div>
 ))}
 </div>
 </>
 )}
 </div>
 </div>
 );
};

// ─── Platform Settings ────────────────────────────────────────────────────────

const PlatformSettingsView = ({ template }: { template: OSTemplate }) => (
 <div className="flex-1 overflow-y-auto p-10 bg-[#09090b] h-full relative" style={{ scrollbarWidth: 'none' }}>
 <div className="max-w-4xl mx-auto">
 <div className="mb-10">
 <h1 className="text-display font-extrabold text-white tracking-tight">Platform Settings</h1>
 <p className="text-secondary text-zinc-400 mt-2">Configure AI parameters, automation guardrails, and system preferences.</p>
 </div>

 <div className="space-y-10">
 <div>
 <h2 className="text-label font-bold text-zinc-500 uppercase tracking-widest mb-4">AI Engine Configuration</h2>
 <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl">
 <div className="flex items-center justify-between mb-6 border-b border-zinc-800/60 pb-6">
 <div>
 <div className="font-bold text-white mb-1">Local Edge Intelligence</div>
 <div className="text-secondary text-zinc-500">Run Llama 3 locally for maximum privacy and zero latency.</div>
 </div>
 <div className="w-12 h-6 bg-indigo-500 rounded-full relative cursor-pointer">
 <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
 </div>
 </div>
 <div className="flex items-center justify-between">
 <div>
 <div className="font-bold text-white mb-1">Cloud Intelligence (GPT-4)</div>
 <div className="text-secondary text-zinc-500">Fallback to OpenAI for complex reasoning tasks.</div>
 </div>
 <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
 <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
 </div>
 </div>
 </div>
 </div>

 <div>
 <h2 className="text-label font-bold text-zinc-500 uppercase tracking-widest mb-4">Automation Guardrails</h2>
 <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-xl space-y-4">
 {[
 { label: 'Require human approval for payments over $500', enabled: true },
 { label: 'Allow AI to automatically email external clients', enabled: false },
 { label: 'Auto-provision employee accounts on onboarding', enabled: true },
 { label: 'Self-healing workflows on task failure', enabled: true },
 ].map((rule, i) => (
 <div key={i} className="flex items-center justify-between p-3.5 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
 <span className="text-secondary text-zinc-300 font-medium">{rule.label}</span>
 <div className={`w-10 h-5 rounded-full relative cursor-pointer ${rule.enabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
 <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${rule.enabled ? 'right-1' : 'left-1'}`} />
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 </div>
);

// ─── Identity & Access System ──────────────────────────────────────────────────

const IdentityAccessView = () => {
 const users = [
 { name: 'Sarah Chen', role: 'Domain Superintendent', dept: 'All', access: ['Recruitment', 'Core CRM', 'Client Portal'] },
 { name: 'Marcus Johnson', role: 'HR Manager', dept: 'HR', access: ['Recruitment', 'Core HR'] },
 { name: 'Elena Rodriguez', role: 'Sales Lead', dept: 'Sales', access: ['Core CRM'] },
 { name: 'AI Engine', role: 'System Autonomous', dept: 'System', access: ['All Packages'] }
 ];

 return (
 <div className="flex-1 overflow-hidden bg-[#09090b] flex w-full h-full relative" style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}>
 <div className="max-w-6xl mx-auto space-y-8">
 <div className="flex items-end justify-between">
 <div>
 <h1 className="text-display font-extrabold text-white tracking-tight">Identity & Access</h1>
 <p className="text-zinc-400 mt-2 text-section">Manage RBAC policies, user roles, and AI execution permissions.</p>
 </div>
 <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold text-button rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20">
 <Plus size={16} /> Create Role
 </button>
 </div>

 <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="border-b border-zinc-800 bg-zinc-950/50">
 <th className="px-6 py-4 text-table font-bold text-zinc-500 uppercase tracking-widest">User / Identity</th>
 <th className="px-6 py-4 text-table font-bold text-zinc-500 uppercase tracking-widest">Role</th>
 <th className="px-6 py-4 text-table font-bold text-zinc-500 uppercase tracking-widest">Department</th>
 <th className="px-6 py-4 text-table font-bold text-zinc-500 uppercase tracking-widest">Package Access</th>
 <th className="px-6 py-4 text-table font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-zinc-800/60">
 {users.map((u, i) => (
 <tr key={i} className="hover:bg-zinc-800/20 transition-colors">
 <td className="px-6 py-4">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-label font-bold text-white">
 {u.name.charAt(0)}
 </div>
 <span className="font-medium text-white">{u.name}</span>
 </div>
 </td>
 <td className="px-6 py-4">
 <span className={`px-2 py-1 rounded-md text-[11px] font-bold ${u.name === 'AI Engine' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-800 text-zinc-300'}`}>
 {u.role}
 </span>
 </td>
 <td className="px-6 py-4 text-table text-zinc-400">{u.dept}</td>
 <td className="px-6 py-4">
 <div className="flex flex-wrap gap-1.5">
 {u.access.map(pkg => (
 <span key={pkg} className="text-[10px] bg-zinc-900 border border-zinc-700/50 text-zinc-400 px-2 py-0.5 rounded">
 {pkg}
 </span>
 ))}
 </div>
 </td>
 <td className="px-6 py-4 text-right">
 <button className="text-zinc-500 hover:text-white transition-colors"><Settings size={15} /></button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 );
};

// ─── Generic Package Dashboard ───────────────────────────────────────────────


// ─── Category-aware workspace sections ────────────────────────────────────────

const WORKSPACE_SECTIONS: Record<string, { label: string; icon: string; emptyTitle: string; emptyDesc: string; actions: string[] }[]> = {
 'Executive & Strategy': [
 { label: 'Objectives', icon: '🎯', emptyTitle: 'No objectives yet', emptyDesc: 'Create your first company-level objective to start tracking strategic progress.', actions: ['+ New Objective'] },
 { label: 'Key Results', icon: '📊', emptyTitle: 'No key results defined', emptyDesc: 'Add key results to your objectives to measure progress quantitatively.', actions: ['+ Add Key Result'] },
 { label: 'Initiatives', icon: '🚀', emptyTitle: 'No initiatives linked', emptyDesc: 'Link strategic initiatives to your key results to drive execution.', actions: ['+ New Initiative'] },
 { label: 'Check-ins', icon: '✅', emptyTitle: 'No check-ins logged', emptyDesc: 'Schedule your first check-in to update progress on key results.', actions: ['+ Schedule Check-in'] },
 ],
 'CRM & Sales': [
 { label: 'Records', icon: '📋', emptyTitle: 'No records yet', emptyDesc: 'Add your first record to start tracking this capability.', actions: ['+ New Record'] },
 { label: 'Activities', icon: '📞', emptyTitle: 'No activities logged', emptyDesc: 'Log calls, emails, and meetings to track engagement history.', actions: ['+ Log Activity'] },
 { label: 'Pipeline', icon: '📈', emptyTitle: 'Pipeline is empty', emptyDesc: 'Add items to your pipeline to track them through stages.', actions: ['+ Add to Pipeline'] },
 { label: 'Reports', icon: '📉', emptyTitle: 'No data to report', emptyDesc: 'Reports will populate as you add and progress records.', actions: [] },
 ],
 'Finance': [
 { label: 'Transactions', icon: '💳', emptyTitle: 'No transactions yet', emptyDesc: 'Create your first transaction to start tracking financial data.', actions: ['+ New Transaction'] },
 { label: 'Pending Approvals', icon: '⏳', emptyTitle: 'Nothing pending approval', emptyDesc: 'Submitted items waiting for approval will appear here.', actions: [] },
 { label: 'Reports', icon: '📊', emptyTitle: 'No financial data yet', emptyDesc: 'Financial reports will generate automatically as data is added.', actions: [] },
 { label: 'Budgets', icon: '💰', emptyTitle: 'No budgets configured', emptyDesc: 'Set up budgets to track and control spending by department.', actions: ['+ Create Budget'] },
 ],
 'Recruitment & HR': [
 { label: 'Active Records', icon: '👤', emptyTitle: 'No records yet', emptyDesc: 'Add your first record to begin tracking this HR capability.', actions: ['+ New Record'] },
 { label: 'Workflows', icon: '🔄', emptyTitle: 'No workflows running', emptyDesc: 'Automated workflows will appear here when triggered.', actions: [] },
 { label: 'Pending Actions', icon: '📌', emptyTitle: 'No pending actions', emptyDesc: 'Actions requiring your attention will surface here.', actions: [] },
 { label: 'Analytics', icon: '📈', emptyTitle: 'No data yet', emptyDesc: 'Analytics will populate as you use this capability.', actions: [] },
 ],
 'Operations': [
 { label: 'Active Items', icon: '⚙️', emptyTitle: 'No items yet', emptyDesc: 'Create your first item to start using this capability.', actions: ['+ Create Item'] },
 { label: 'In Progress', icon: '🔄', emptyTitle: 'Nothing in progress', emptyDesc: 'Items currently being worked on will appear here.', actions: [] },
 { label: 'Completed', icon: '✅', emptyTitle: 'Nothing completed yet', emptyDesc: 'Completed items will appear here for record keeping.', actions: [] },
 { label: 'Analytics', icon: '📊', emptyTitle: 'No analytics data', emptyDesc: 'Usage analytics will populate automatically.', actions: [] },
 ],
 'Marketing': [
 { label: 'Active Campaigns', icon: '📣', emptyTitle: 'No campaigns running', emptyDesc: 'Create your first campaign to start reaching your audience.', actions: ['+ New Campaign'] },
 { label: 'Drafts', icon: '✏️', emptyTitle: 'No drafts saved', emptyDesc: 'Drafts you save will appear here for later publishing.', actions: ['+ Start Draft'] },
 { label: 'Analytics', icon: '📈', emptyTitle: 'No performance data', emptyDesc: 'Campaign performance metrics will appear once campaigns are live.', actions: [] },
 { label: 'Audience', icon: '👥', emptyTitle: 'No audience segments', emptyDesc: 'Create audience segments to target your campaigns more effectively.', actions: ['+ New Segment'] },
 ],
 'Customer Support': [
 { label: 'Open Items', icon: '🔔', emptyTitle: 'No open items', emptyDesc: 'Open support items will appear here as they are created.', actions: ['+ New Item'] },
 { label: 'In Progress', icon: '⏳', emptyTitle: 'Nothing in progress', emptyDesc: 'Items being worked on will show here.', actions: [] },
 { label: 'Resolved', icon: '✅', emptyTitle: 'Nothing resolved yet', emptyDesc: 'Resolved items will be archived here.', actions: [] },
 { label: 'SLA Status', icon: '⏱️', emptyTitle: 'SLA tracking will begin', emptyDesc: 'SLA tracking starts as soon as items are created.', actions: [] },
 ],
 'Communication': [
 { label: 'Recent', icon: '💬', emptyTitle: 'No recent activity', emptyDesc: 'Recent communications will appear here.', actions: ['+ New'] },
 { label: 'Scheduled', icon: '📅', emptyTitle: 'Nothing scheduled', emptyDesc: 'Schedule communications in advance and they will appear here.', actions: ['+ Schedule'] },
 { label: 'Templates', icon: '📝', emptyTitle: 'No templates created', emptyDesc: 'Create reusable templates to save time on recurring communications.', actions: ['+ New Template'] },
 { label: 'Analytics', icon: '📊', emptyTitle: 'No communication data yet', emptyDesc: 'Engagement analytics will populate as you communicate.', actions: [] },
 ],
 'AI & Automation': [
 { label: 'Active', icon: '🤖', emptyTitle: 'No automations active', emptyDesc: 'Deploy your first automation to start saving time.', actions: ['+ New Automation'] },
 { label: 'Runs', icon: '▶️', emptyTitle: 'No runs yet', emptyDesc: 'Automation execution history will appear here.', actions: [] },
 { label: 'Templates', icon: '📋', emptyTitle: 'No templates', emptyDesc: 'Pre-built automation templates will help you get started faster.', actions: ['+ Browse Templates'] },
 { label: 'Analytics', icon: '📈', emptyTitle: 'No performance data', emptyDesc: 'Time saved and runs completed will be tracked here.', actions: [] },
 ],
 'Enterprise Platform': [
 { label: 'Configuration', icon: '⚙️', emptyTitle: 'Not configured yet', emptyDesc: 'Configure this capability to activate it for your organization.', actions: ['Configure Now'] },
 { label: 'Activity Log', icon: '📋', emptyTitle: 'No activity yet', emptyDesc: 'All activity related to this platform service will be logged here.', actions: [] },
 { label: 'Users & Access', icon: '🔐', emptyTitle: 'No users assigned', emptyDesc: 'Assign users and roles to control who can access this capability.', actions: ['+ Assign Users'] },
 { label: 'Analytics', icon: '📊', emptyTitle: 'No data yet', emptyDesc: 'Usage metrics will appear here as the platform is used.', actions: [] },
 ],
};

const DEFAULT_SECTIONS = [
 { label: 'Overview', icon: '📋', emptyTitle: 'No data yet', emptyDesc: 'Data will appear here as you use this capability.', actions: ['+ Get Started'] },
 { label: 'Activity', icon: '🔄', emptyTitle: 'No activity yet', emptyDesc: 'Activity will be logged here automatically.', actions: [] },
 { label: 'Settings', icon: '⚙️', emptyTitle: 'Not configured', emptyDesc: 'Use the Configure button above to set up this capability.', actions: ['Configure'] },
 { label: 'Analytics', icon: '📈', emptyTitle: 'No analytics yet', emptyDesc: 'Analytics will appear as data is added.', actions: [] },
];




const MODULE_TO_PACKAGE_MAP: Record<string, string> = {
 // Executive
 'ceo_dash': 'Executive.CEOOffice',
 'strategy_okrs': 'Executive.StrategicPlanning',
 'exec_reports': 'Executive.RiskManagement',
 'decision_tracker': 'Executive.DecisionTracker',
 
 // Sales
 'leads': 'CRM.LeadManagement',
 'accounts': 'CRM.Accounts',
 'opportunities': 'CRM.OpportunityManagement',
 'pipeline': 'CRM.SalesPipeline',
 'quotes': 'CRM.Quotations',
 'contracts': 'Operations.ProjectManagement',
 'forecasting': 'Platform.Analytics',
 
 // Recruitment
 'requisitions': 'HR.ATS',
 'candidates': 'HR.EmployeeDirectory',
 'ai_matching': 'HR.ATS',
 'interview_sched': 'HR.Onboarding',
 'offers': 'HR.ATS',
 'bench': 'HR.EmployeeDirectory',

 // Delivery
 'resource_alloc': 'Operations.ProjectManagement',
 'project_staffing': 'Operations.ProjectManagement',
 'sla_tracking': 'Operations.ProjectManagement',

 // Operations
 'task_mgmt': 'Operations.ProjectManagement',
 'process_builder': 'AI.WorkflowAutomation',
 'capacity_plan': 'Operations.ProjectManagement',

 // Finance
 'invoices': 'Finance.Invoicing',
 'receivables': 'Finance.Invoicing',
 'payables': 'Finance.Expenses',
 'profit_loss': 'Finance.Budgeting',

 // Communication
 'chat': 'Communication.Announcements',
 'video': 'Communication.MeetingRooms',
 'channels': 'Communication.Announcements',

 // Knowledge
 'wiki': 'Support.KnowledgeBase',
 'sops': 'Support.KnowledgeBase',
 'policies': 'Support.KnowledgeBase',
};

const DepartmentWorkspace = ({ template, deptId, onNavigateToPackage }: { template: OSTemplate, deptId: string, onNavigateToPackage: (pkgId: string) => void }) => {
 const dept = template.departments.find(d => d.id === deptId);
 const [chatHistory, setChatHistory] = React.useState<any[]>([]);
 const [intentInput, setIntentInput] = React.useState('');
 const [isExecuting, setIsExecuting] = React.useState(false);

 // 1. Initial Load
 React.useEffect(() => {
 // Load existing history if any
 setChatHistory([...UniversalExecutiveRuntime.getConversationHistory(deptId)]);
 }, [deptId]);

 // 2. Realtime Event Bus Subscription (No more manual polling)
 useOSRealtime('WorkObjectCreated', (payload) => {
 // We could push a silent notification or update widgets here
 });

 if (!dept) return null;

 const handleExecuteIntent = async (overrideIntent?: string) => {
 const input = overrideIntent || intentInput;
 if (!input.trim()) return;
 
 setIsExecuting(true);
 setIntentInput('');
 
 // Optimistic UI for user message
 const newHistory = [...UniversalExecutiveRuntime.getConversationHistory(deptId), { role: 'user', text: input }];
 setChatHistory(newHistory);
 
 try {
 const response = await UniversalExecutiveRuntime.processCommand(input, dept.id, deptId);
 setChatHistory([...UniversalExecutiveRuntime.getConversationHistory(deptId)]);
 } catch (err: any) {
 console.error('[Command Center] Execution Failed', err);
 } finally {
 setIsExecuting(false);
 }
 };

 return (
 <div className="flex-1 h-full w-full overflow-hidden p-8 relative flex gap-8">
 <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
 
 {/* Main Conversation Column */}
 <div className="flex-1 flex flex-col relative z-10 max-w-4xl mx-auto h-full overflow-hidden">
 
 {/* Header */}
 <div className="flex items-center justify-between mb-6 shrink-0">
 <div>
 <h1 className="text-display font-extrabold text-white tracking-tight flex items-center gap-3">
 <Sparkles className="text-indigo-400" size={28} /> Priyanka
 </h1>
 <p className="text-zinc-400 mt-2 text-secondary">Your intelligent operating brain for all {dept.name} operations.</p>
 </div>
 </div>

 {/* Chat History */}
 <div className="flex-1 overflow-y-auto space-y-6 mb-6 pr-4" style={{ scrollbarWidth: 'none' }}>
 {chatHistory.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full text-zinc-500">
 <Command size={48} className="mb-4 opacity-20" />
 <p>Hi, I am Priyanka. How can I help you today?</p>
 </div>
 ) : (
 chatHistory.map((msg, i) => (
 <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
 <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' : 'bg-zinc-900/80 border border-zinc-800/80 text-zinc-200 rounded-2xl rounded-tl-sm backdrop-blur-xl'} p-5 shadow-lg`}>
 {msg.role === 'user' ? (
 <p className="text-secondary">{msg.text}</p>
 ) : (
 <div className="space-y-4">
 {/* Text */}
 <p className="text-secondary whitespace-pre-wrap">{msg.response.text}</p>
 
 {/* Widgets */}
 {msg.response.widgets?.map((widget: any, wIndex: number) => (
 <div key={wIndex} className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800/50">
 {widget.type === 'record' && (
 <div>
 <div className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Record Generated</div>
 <div className="text-emerald-400 font-medium text-secondary">{widget.data.Title || widget.data.id}</div>
 <div className="text-label text-zinc-500 mt-1">Status: {widget.data.Status || 'Draft'}</div>
 </div>
 )}
 {widget.type === 'table' && (
 <div>
 <div className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Data Aggregate</div>
 {widget.data.map((row: any, rIdx: number) => (
 <div key={rIdx} className="text-label text-zinc-300 border-b border-zinc-800/50 py-2 last:border-0 flex justify-between">
 <span>{row.object}</span>
 <span className="font-bold">{row.count}</span>
 </div>
 ))}
 </div>
 )}
 </div>
 ))}

 {/* Explanation */}
 {msg.response.explanation && (
 <div className="text-[11px] text-zinc-500 italic mt-2 border-l-2 border-zinc-800 pl-2">
 Why? {msg.response.explanation}
 </div>
 )}

 {/* Actions */}
 {msg.response.actions && msg.response.actions.length > 0 && (
 <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-800/50">
 {msg.response.actions.map((action: any, aIndex: number) => (
 <button
 key={aIndex}
 onClick={() => handleExecuteIntent(action.intent)}
 className={`px-3 py-1.5 text-label font-bold rounded-lg transition-all ${
 action.variant === 'primary' 
 ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20' 
 : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
 }`}
 >
 {action.label}
 </button>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 ))
 )}
 {isExecuting && (
 <div className="flex justify-start">
 <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl rounded-tl-sm p-5 shadow-lg flex items-center gap-3 text-zinc-400 text-secondary">
 <Loader2 size={16} className="animate-spin text-indigo-400" /> Thinking...
 </div>
 </div>
 )}
 </div>

 {/* Chat Input */}
 <div className="shrink-0">
 <div className="relative">
 <input 
 type="text" 
 value={intentInput}
 onChange={(e) => setIntentInput(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleExecuteIntent()}
 placeholder={`Ask anything about ${dept.name} or tell me what you'd like to do...`}
 className="w-full bg-zinc-900/80 border border-zinc-700/80 rounded-2xl px-6 py-5 text-secondary text-white focus:outline-none focus:border-indigo-500/50 transition-colors shadow-2xl backdrop-blur-xl"
 />
 <button 
 onClick={() => handleExecuteIntent()}
 disabled={isExecuting || !intentInput.trim()}
 className="absolute right-3 top-3 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-label font-bold rounded-xl transition-colors flex items-center gap-2"
 >
 Send
 </button>
 </div>
 
 {/* Quick Suggestions */}
 <div className="flex gap-2 mt-4 px-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
 <span className="text-label font-bold text-zinc-600 uppercase tracking-widest py-1.5 shrink-0">Suggestions:</span>
 {['How are we doing?', 'Create a new position', 'Generate a report', 'Schedule interviews'].map(suggestion => (
 <button 
 key={suggestion}
 onClick={() => handleExecuteIntent(suggestion)}
 className="shrink-0 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-label rounded-lg transition-colors border border-zinc-800/50"
 >
 {suggestion}
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* Right Sidebar: Active Capabilities */}
 <div className="w-80 shrink-0 border-l border-zinc-800/60 pl-8 h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
 <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6">Installed Modules</h2>
 <div className="space-y-4">
 {dept.modules.map(mod => (
 <div 
 key={mod.id} 
 onClick={() => {
 const targetPkg = MODULE_TO_PACKAGE_MAP[mod.id];
 if (targetPkg) onNavigateToPackage(targetPkg);
 }}
 className="bg-zinc-900/40 border border-zinc-800/60 hover:bg-zinc-900/80 transition-all cursor-pointer rounded-xl p-4 flex items-center gap-4 group"
 >
 <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center border border-zinc-700/50 group-hover:border-indigo-500/50 transition-colors">
 <Package size={16} className="text-zinc-400 group-hover:text-indigo-400 transition-colors" />
 </div>
 <div>
 <h3 className="text-white font-bold text-secondary mb-0.5">{mod.name}</h3>
 <span className="text-[9px] uppercase font-bold text-zinc-500">{mod.type} Module</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
};

export default function BusinessOS() {
 const { theme, density, uiScale, setTheme, setDensity, setUiScale } = useDesignSystem();
 const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
 const [isSidebarHovered, setIsSidebarHovered] = useState(false);

 React.useEffect(() => {
 AutomationEngine.initialize();
 }, []);

 const [appState, setAppState] = useState<AppState>('onboarding');
 const [activeView, setActiveView] = useState<ViewMode>('home');
 const [activeTemplate, setActiveTemplate] = useState<OSTemplate | null>(null);
 const [activeProfile, setActiveProfile] = useState<any>(null);
 const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
 const [installedPackages, setInstalledPackages] = useState<string[]>(
 () => CapabilityInstaller.getInstalledIds()
 );
 const [installedManifests, setInstalledManifests] = useState<any[]>([]);
 const [installProgress, setInstallProgress] = useState<IInstallProgress | null>(null);
 const [installingId, setInstallingId] = useState<string | null>(null);

 // Keep installedManifests in sync with installedPackages
 // Prefers full SDK data, falls back to CATALOG manifest
 useEffect(() => {
 const manifests = installedPackages.map(id => {
 const sdk = SDK_REGISTRY[id];
 return sdk || CATALOG.find(c => c.id === id);
 }).filter(Boolean);
 setInstalledManifests(manifests);
 }, [installedPackages]);

 // Install handler — runs 10-step pipeline
 const handleInstallCapability = async (id: string) => {
 setInstallingId(id);
 const sdk = SDK_REGISTRY[id];
 const catalogItem = CATALOG.find(c => c.id === id);
 
 // Build a minimal SDK from catalog if no full SDK exists
 const sdkToInstall = sdk || {
 id,
 name: catalogItem?.name || id,
 description: catalogItem?.description || '',
 department: catalogItem?.department || '',
 category: catalogItem?.category || '',
 version: catalogItem?.version || '1.0.0',
 maturity: catalogItem?.maturity || 'L3',
 icon: catalogItem?.icon || '📦',
 rating: catalogItem?.rating || 4.0,
 installs: catalogItem?.installs || 0,
 tags: catalogItem?.tags || [],
 objects: (catalogItem as any)?.objectSchemas?.map((s: any) => ({
 name: s.name,
 pluralName: s.pluralName,
 icon: s.icon,
 titleField: s.titleField,
 statusField: s.statusField,
 fields: s.fields || [],
 relations: [],
 features: {},
 })) || [],
 views: [
 { id: 'dashboard', label: 'Dashboard', icon: '📊', type: 'dashboard', isDefault: true },
 ...((catalogItem as any)?.objectSchemas || []).map((s: any) => ({
 id: s.name.toLowerCase(),
 label: s.pluralName || s.name,
 icon: s.icon || '📋',
 type: 'grid',
 object: s.name,
 })),
 ],
 dashboards: [],
 reports: [],
 ai: { skills: [] },
 workflows: [],
 automations: [],
 permissions: {},
 notifications: [],
 seed: { objects: [] },
 search: { objects: [] },
 settings: catalogItem?.configSchema || [],
 integrations: [],
 };

 const result = await CapabilityInstaller.install(sdkToInstall, (progress) => {
 setInstallProgress(progress);
 });
 
 if (result.success) {
 setInstalledPackages(CapabilityInstaller.getInstalledIds());
 }
 setInstallProgress(null);
 setInstallingId(null);
 };

 // Uninstall handler
 const handleUninstallCapability = (id: string) => {
 CapabilityInstaller.uninstall(id);
 setInstalledPackages(CapabilityInstaller.getInstalledIds());
 if (selectedPackage === id) setSelectedPackage(null);
 setActiveView('marketplace');
 };

 if (appState === 'onboarding') {
 return <AIBusinessSetup onComplete={(template, profile) => {
 setActiveTemplate(template);
 setActiveProfile(profile);
 setAppState('os');
 }} />;
 }

 if (appState === 'os') {
 return (
 <KernelProvider useInMemory={false}>
 <div className="flex w-full h-full bg-[#09090b] overflow-hidden font-sans">
 
 {/* Universal Sidebar - Collapsible with Hover-to-Expand */}
 <div 
 className={`${isSidebarExpanded || isSidebarHovered ? 'w-64' : 'w-20'} bg-zinc-950/80 border-r border-zinc-800/60 flex flex-col h-full flex-shrink-0 relative z-20 backdrop-blur-xl transition-all duration-300 ease-in-out`}
 onMouseEnter={() => !isSidebarExpanded && setIsSidebarHovered(true)}
 onMouseLeave={() => !isSidebarExpanded && setIsSidebarHovered(false)}
 >
 
 {/* Toggle Sidebar Button */}
 <button 
 onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
 className="absolute -right-3 top-6 w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors shadow-md z-30"
 >
 {isSidebarExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
 </button>

 {/* Tenant Header */}
 <div className="h-16 flex items-center px-5 border-b border-zinc-800/60 shrink-0 bg-transparent transition-all duration-300">
 <div className="flex items-center gap-3 w-full">
 <div className="flex items-center justify-center shrink-0">
 <img src="/chatr-logo.png" alt="CHATR" className="h-6 w-auto object-contain filter invert opacity-90" />
 </div>
 {(isSidebarExpanded || isSidebarHovered) && (
 <div className="overflow-hidden transition-all duration-300 opacity-100">
 <div className="font-bold text-secondary text-white tracking-wide truncate w-40">{activeProfile?.name || 'CHATR Business OS'}</div>
 <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest mt-0.5 whitespace-nowrap">{activeTemplate?.name} Template</div>
 </div>
 )}
 </div>
 </div>

 <div className="flex-1 overflow-y-auto py-5 px-3 space-y-8 overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
 
 {/* Platform Services */}
 <div>
 {(isSidebarExpanded || isSidebarHovered) && <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-3">Platform</div>}
 <div className="space-y-1">
 <button onClick={() => setActiveView('home')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-secondary transition-all ${activeView === 'home' ? 'bg-indigo-600/10 text-indigo-400 font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium'}`} title="Home">
 <LayoutGrid size={15} className={`shrink-0 ${activeView === 'home' ? 'text-indigo-400' : 'text-zinc-500'}`} /> 
 {(isSidebarExpanded || isSidebarHovered) && <span className="truncate">Home</span>}
 </button>
 
 <button onClick={() => setActiveView('marketplace')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-secondary transition-all ${activeView === 'marketplace' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium'}`} title="Marketplace Ecosystem">
 <LayoutGrid size={15} className={`shrink-0 ${activeView === 'marketplace' ? 'text-white' : 'text-zinc-500'}`} /> 
 {(isSidebarExpanded || isSidebarHovered) && <span className="truncate">Marketplace Ecosystem</span>}
 </button>
 <button onClick={() => setActiveView('knowledge')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-secondary transition-all ${activeView === 'knowledge' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium'}`} title="Enterprise Knowledge Fabric">
 <Database size={15} className={`shrink-0 ${activeView === 'knowledge' ? 'text-white' : 'text-zinc-500'}`} /> 
 {(isSidebarExpanded || isSidebarHovered) && <span className="truncate">Enterprise Knowledge Fabric</span>}
 </button>
 <button onClick={() => setActiveView('organization')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-secondary transition-all ${activeView === 'organization' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium'}`} title="Organization Structure">
 <Building2 size={15} className={`shrink-0 ${activeView === 'organization' ? 'text-white' : 'text-zinc-500'}`} /> 
 {(isSidebarExpanded || isSidebarHovered) && <span className="truncate">Organization Structure</span>}
 </button>
 <button onClick={() => setActiveView('ai_runtime')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-secondary transition-all ${activeView === 'ai_runtime' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium'}`} title="Domain Superintendents">
 <Sparkles size={15} className={`shrink-0 ${activeView === 'ai_runtime' ? 'text-white' : 'text-zinc-500'}`} /> 
 {(isSidebarExpanded || isSidebarHovered) && <span className="truncate">Domain Superintendents</span>}
 </button>
 <button onClick={() => setActiveView('identity')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-secondary transition-all ${activeView === 'identity' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium'}`} title="Identity & Access">
 <ShieldCheck size={15} className={`shrink-0 ${activeView === 'identity' ? 'text-white' : 'text-zinc-500'}`} /> 
 {(isSidebarExpanded || isSidebarHovered) && <span className="truncate">Identity & Access</span>}
 </button>
 </div>
 </div>

 {/* Departments */}
 <div>
 <div className="flex items-center justify-between mb-3 px-3">
 {(isSidebarExpanded || isSidebarHovered) && <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Departments</div>}
 </div>
 <div className="space-y-1">
 {activeTemplate?.departments.filter(d => d.id !== 'platform').map(dept => {
 const isActive = activeView === 'department' && selectedPackage === dept.id;
 return (
 <button 
 key={dept.id} 
 onClick={() => { setActiveView('department'); setSelectedPackage(dept.id); }}
 className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-secondary transition-all group ${isActive ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium'}`}
 title={dept.name}
 >
 <div className="flex items-center gap-3">
 <Building2 size={15} className={`shrink-0 ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-indigo-400 transition-colors'}`} /> 
 {(isSidebarExpanded || isSidebarHovered) && <span className="truncate">{dept.name}</span>}
 </div>
 </button>
 );
 })}
 </div>
 </div>

 {/* Installed Packages */}
 <div>
 <div className="flex items-center justify-between mb-3 px-3">
 {(isSidebarExpanded || isSidebarHovered) && <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Installed Packages</div>}
 {(isSidebarExpanded || isSidebarHovered) && <button onClick={() => setActiveView('marketplace')} className="text-zinc-500 hover:text-white transition-colors" title="Browse Marketplace"><Plus size={12} /></button>}
 </div>
 <div className="space-y-1">
 {/* The Flagship Package always pinned at top */}
 <button onClick={() => setActiveView('recruitment')} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-secondary transition-all group ${activeView === 'recruitment' ? 'bg-indigo-600/10 text-indigo-400 font-semibold border border-indigo-500/20' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium border border-transparent'}`} title="Recruitment & HR">
 <div className="flex items-center gap-3">
 <Users size={15} className={`shrink-0 ${activeView === 'recruitment' ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-indigo-400 transition-colors'}`} /> 
 {(isSidebarExpanded || isSidebarHovered) && <span className="truncate">Recruitment & HR</span>}
 </div>
 {(isSidebarExpanded || isSidebarHovered) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">L4</span>}
 </button>
 {/* Marketplace-installed packages — rendered directly from manifest data */}
 {installedManifests.map(manifest => {
 const isActive = activeView === 'package' && selectedPackage === manifest.id;
 return (
 <button
 key={manifest.id}
 onClick={() => { setActiveView('package'); setSelectedPackage(manifest.id); }}
 className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-secondary transition-all group ${
 isActive ? 'bg-emerald-600/10 text-emerald-400 font-semibold border border-emerald-500/20' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 font-medium border border-transparent'
 }`}
 title={manifest.name}
 >
 <div className="flex items-center gap-3">
 <span className="text-body shrink-0">{manifest.icon || '📦'}</span>
 {(isSidebarExpanded || isSidebarHovered) && <span className="truncate max-w-[120px]">{manifest.name}</span>}
 </div>
 {(isSidebarExpanded || isSidebarHovered) && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-500 flex-shrink-0">{manifest.maturity || 'L3'}</span>}
 </button>
 );
 })}
 {installedManifests.length === 0 && (
 <p className="text-[11px] text-zinc-600 px-3 py-2 italic">No packages installed yet. Browse the marketplace above.</p>
 )}
 </div>
 </div>

 </div>
 </div>

 {/* Main Content Area */}
 <div className="flex-1 flex flex-col relative min-w-0 overflow-hidden bg-background">
 {/* Action Bar (Top Toolbar) */}
 <div className="h-14 border-b border-zinc-800/60 flex items-center justify-between px-6 bg-zinc-950/30 backdrop-blur-md shrink-0 z-10">
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-label text-zinc-400 w-96 shadow-inner focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
 <Search size={13} />
 <input type="text" placeholder="Enterprise Query: Search records, documents, or execute capabilities..." className="bg-transparent border-none focus:outline-none w-full placeholder:text-zinc-600 text-white" />
 </div>
 </div>
 <div className="flex items-center gap-4">
 {/* Design System Toggles */}
 <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
 <select 
 value={theme}
 onChange={(e) => setTheme(e.target.value as any)}
 className="bg-transparent text-label text-zinc-400 border-none outline-none px-2 py-1 cursor-pointer hover:text-zinc-200"
 >
 <option value="default">Premium Dark</option>
 <option value="enterprise">Enterprise</option>
 <option value="midnight">Midnight</option>
 <option value="neon">Neon</option>
 </select>
 <div className="w-px h-4 bg-zinc-800 mx-1"></div>
 <select 
 value={density}
 onChange={(e) => setDensity(e.target.value as any)}
 className="bg-transparent text-label text-zinc-400 border-none outline-none px-2 py-1 cursor-pointer hover:text-zinc-200"
 >
 <option value="comfortable">Comfortable</option>
 <option value="compact">Compact</option>
 <option value="spacious">Spacious</option>
 </select>
 </div>
 
 <span className="text-label font-bold text-zinc-500 px-3 py-1 bg-zinc-900 rounded-md border border-zinc-800">{activeTemplate?.name}</span>
 <Bell size={16} className="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors" />
 <Settings size={16} className="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors" />
 </div>
 </div>

 {/* View Router */}
 <div className="flex-1 flex overflow-hidden relative w-full">
 {activeView === 'home' && (
 <BusinessOSHome onNavigateToRecord={(capId, objName, recId) => {
 setSelectedPackage(capId);
 setActiveView('package');
 }} />
 )}
 {activeView === 'marketplace' && <MarketplaceView installedPackages={installedPackages} onInstall={(id, _manifest) => { handleInstallCapability(id); }} />}
 {activeView === 'recruitment' && <HiringWorkflow />}
 {activeView === 'ai_runtime' && activeTemplate && <DomainSuperintendentView template={activeTemplate} />}
 {activeView === 'organization' && activeTemplate && <OrganizationView template={activeTemplate} />}
 {activeView === 'knowledge' && activeTemplate && <KnowledgeFabricView template={activeTemplate} />}
 {activeView === 'settings' && activeTemplate && <PlatformSettingsView template={activeTemplate} />}
 {activeView === 'identity' && <IdentityAccessView />}
 {activeView === 'department' && activeTemplate && selectedPackage && (
 <DepartmentWorkspace 
 template={activeTemplate} 
 deptId={selectedPackage} 
 onNavigateToPackage={(pkgId) => {
 if (installedPackages.includes(pkgId)) {
 setActiveView('package');
 setSelectedPackage(pkgId);
 } else {
 if (window.confirm(`This module requires the '${pkgId}' capability. Would you like to install it now?`)) {
 handleInstallCapability(pkgId).then(() => {
 setActiveView('package');
 setSelectedPackage(pkgId);
 });
 }
 }
 }}
 />
 )}
 {activeView === 'package' && selectedPackage && installedManifests.find(m => m.id === selectedPackage) && (
 <CapabilityWorkspaceView 
 sdk={SDK_REGISTRY[selectedPackage]}
 manifest={installedManifests.find(m => m.id === selectedPackage)} 
 onUninstall={handleUninstallCapability}
 />
 )}
 </div>
 </div>
 </div>
 </KernelProvider>
 );
 }
}
