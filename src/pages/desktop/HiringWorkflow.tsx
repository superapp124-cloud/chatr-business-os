import React, { useState, useRef, useEffect } from 'react';
import {
 Briefcase, Users, Mail, FileText, ChevronRight, ChevronDown, Plus, X, Check,
 Search, Star, Download, Upload, Eye, Edit3, Trash2, Clock, AlertCircle,
 CheckCircle2, Circle, ArrowRight, Sparkles, Phone, Video, MessageSquare,
 Settings, Filter, SortAsc, MoreHorizontal, UserPlus, Calendar, Send,
 Zap, Target, TrendingUp, Award, Building2, MapPin, DollarSign, Globe,
 Linkedin, Copy, ExternalLink, RefreshCw, ChevronUp, ListChecks, 
 PenLine, Bell, Layers, BarChart2, BookOpen, ClipboardList
} from 'lucide-react';
import { useQueryEngine, useObjectRuntime } from '../../presentation-runtime/providers/KernelProvider';
// ─── Types ─────────────────────────────────────────────────────────────────────

type Stage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

interface Candidate {
 id: string;
 name: string;
 email: string;
 phone: string;
 role: string;
 location: string;
 experience: string;
 skills: string[];
 source: string;
 stage: Stage;
 score: number;
 appliedAt: string;
 avatar: string;
 linkedin?: string;
 salary?: string;
 notes?: string;
 interviewDate?: string;
 interviewType?: 'phone' | 'video' | 'onsite';
 offerAmount?: string;
 tag?: string;
}

interface InterviewQuestion {
 id: string;
 category: string;
 question: string;
 timeAllowed: string;
}

interface EmailTemplate {
 id: string;
 trigger: string;
 subject: string;
 body: string;
 stage: Stage | 'all';
}

type ActiveTab = 'jd' | 'pipeline' | 'interviews' | 'applications' | 'emails' | 'analytics';

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const INITIAL_CANDIDATES: Candidate[] = [
 { id: 'c1', name: 'Arjun Mehta', email: 'arjun@techcorp.io', phone: '+91 9876543210', role: 'Sales Executive', location: 'Bangalore, IN', experience: '6 years', skills: ['B2B Sales', 'CRM', 'Negotiation', 'Lead Gen'], source: 'LinkedIn', stage: 'interview', score: 92, appliedAt: '2026-07-18', avatar: 'https://i.pravatar.cc/150?u=arjun', linkedin: 'linkedin.com/in/arjun', salary: '₹12 LPA', interviewDate: '2026-07-22', interviewType: 'video', tag: 'Top Pick' },
 { id: 'c2', name: 'Priya Sharma', email: 'priya@devworld.com', phone: '+91 8765432109', role: 'Sales Executive', location: 'Hyderabad, IN', experience: '5 years', skills: ['SaaS Sales', 'Cold Calling', 'Account Management'], source: 'Indeed', stage: 'screening', score: 87, appliedAt: '2026-07-17', avatar: 'https://i.pravatar.cc/150?u=priya', salary: '₹10 LPA', tag: 'Strong' },
 { id: 'c3', name: 'Rahul Verma', email: 'rahul@codesphere.dev', phone: '+91 7654321098', role: 'Sales Executive', location: 'Pune, IN', experience: '7 years', skills: ['Enterprise Sales', 'HubSpot', 'Closing'], source: 'AngelList', stage: 'offer', score: 94, appliedAt: '2026-07-15', avatar: 'https://i.pravatar.cc/150?u=rahul', salary: '₹15 LPA', offerAmount: '₹18 LPA', tag: 'Top Pick' },
 { id: 'c4', name: 'Neha Gupta', email: 'neha.g@outlook.com', phone: '+91 6543210987', role: 'Sales Executive', location: 'Chennai, IN', experience: '4 years', skills: ['Inside Sales', 'Prospecting', 'Salesforce'], source: 'Referral', stage: 'applied', score: 78, appliedAt: '2026-07-19', avatar: 'https://i.pravatar.cc/150?u=neha' },
 { id: 'c5', name: 'Vikram Singh', email: 'vikram@synergy.tech', phone: '+91 9123456780', role: 'Sales Executive', location: 'Delhi, IN', experience: '8 years', skills: ['Sales Strategy', 'Team Leadership', 'B2B'], source: 'LinkedIn', stage: 'hired', score: 96, appliedAt: '2026-07-10', avatar: 'https://i.pravatar.cc/150?u=vikram', salary: '₹20 LPA', tag: 'Top Pick' },
 { id: 'c6', name: 'Anjali Patel', email: 'anjali.p@gmail.com', phone: '+91 8012345679', role: 'Sales Executive', location: 'Mumbai, IN', experience: '3 years', skills: ['Direct Sales', 'Communication', 'Pitching'], source: 'Naukri', stage: 'rejected', score: 58, appliedAt: '2026-07-16', avatar: 'https://i.pravatar.cc/150?u=anjali' },
 { id: 'c7', name: 'Karan Joshi', email: 'karan@infrabuild.co', phone: '+91 7890123456', role: 'Sales Executive', location: 'Noida, IN', experience: '5 years', skills: ['Territory Mapping', 'Field Sales', 'CRM'], source: 'GitHub', stage: 'screening', score: 83, appliedAt: '2026-07-18', avatar: 'https://i.pravatar.cc/150?u=karan', salary: '₹11 LPA' },
 { id: 'c8', name: 'Divya Nair', email: 'divya@cloudnine.io', phone: '+91 9234567801', role: 'Sales Executive', location: 'Kochi, IN', experience: '6 years', skills: ['Client Relations', 'Contract Negotiation', 'Upselling'], source: 'LinkedIn', stage: 'interview', score: 89, appliedAt: '2026-07-17', avatar: 'https://i.pravatar.cc/150?u=divya', interviewDate: '2026-07-23', interviewType: 'video', salary: '₹14 LPA' },
];

const INITIAL_QUESTIONS: InterviewQuestion[] = [
 { id: 'q1', category: 'Technical', question: 'Describe your sales process from lead generation to closing a deal.', timeAllowed: '10 min' },
 { id: 'q2', category: 'Technical', question: 'How do you handle objections from a C-level executive?', timeAllowed: '8 min' },
 { id: 'q3', category: 'System Design', question: 'Walk me through a complex B2B enterprise deal you closed.', timeAllowed: '20 min' },
 { id: 'q4', category: 'Behavioural', question: 'Tell me about a time when you failed to hit your quota. What did you learn?', timeAllowed: '8 min' },
 { id: 'q5', category: 'Cultural Fit', question: 'How do you collaborate with marketing and product teams to drive sales?', timeAllowed: '5 min' },
];

const INITIAL_TEMPLATES: EmailTemplate[] = [
 { id: 't1', trigger: 'Application Received', stage: 'applied', subject: 'We received your application – {role} at {company}', body: `Hi {name},\n\nThank you for applying for the {role} position at {company}. We're excited to review your profile!\n\nOur hiring team will go through your application and reach out within 3–5 business days.\n\nBest regards,\n{recruiter_name}\nTalent Team, {company}` },
 { id: 't2', trigger: 'Shortlisted for Screening', stage: 'screening', subject: "Great news! You've been shortlisted – {role}", body: `Hi {name},\n\nCongratulations! After reviewing your application for the {role} role, we'd love to schedule a quick 20-minute screening call.\n\nPlease use the link below to pick a slot that works for you:\n{calendar_link}\n\nLooking forward to speaking with you!\n\nWarm regards,\n{recruiter_name}` },
 { id: 't3', trigger: 'Interview Invitation', stage: 'interview', subject: 'Interview Invitation – {role} at {company}', body: `Hi {name},\n\nWe're pleased to invite you to a technical interview for the {role} position.\n\n📅 Date: {interview_date}\n⏰ Time: {interview_time}\n📍 Format: {interview_format}\n🔗 Link: {meeting_link}\n\nPlease confirm your availability by replying to this email.\n\nBest,\n{recruiter_name}` },
 { id: 't4', trigger: 'Offer Letter', stage: 'offer', subject: 'Offer Letter – Welcome to {company}!', body: `Dear {name},\n\nWe are delighted to offer you the position of {role} at {company}.\n\n💼 Role: {role}\n💰 Compensation: {offer_amount} per annum\n📅 Start Date: {start_date}\n\nPlease find the formal offer document attached. Kindly sign and return it within 5 business days.\n\nWelcome aboard!\n\n{ceo_name}\nCEO, {company}` },
 { id: 't5', trigger: 'Rejection', stage: 'rejected', subject: 'Your application update – {role} at {company}', body: `Hi {name},\n\nThank you sincerely for your interest in the {role} position and for taking the time to interview with us.\n\nAfter careful consideration, we've decided to move forward with another candidate whose experience more closely aligns with our current needs.\n\nWe were genuinely impressed and encourage you to apply again in the future.\n\nWishing you all the best,\n{recruiter_name}` },
];

// ─── Stage config ───────────────────────────────────────────────────────────────

const STAGES: { id: Stage; label: string; color: string; bg: string; border: string; dot: string }[] = [
 { id: 'applied', label: 'Applied', color: 'text-zinc-400', bg: 'bg-zinc-800/60', border: 'border-zinc-700', dot: 'bg-zinc-500' },
 { id: 'screening', label: 'Screening', color: 'text-blue-400', bg: 'bg-blue-950/40', border: 'border-blue-800', dot: 'bg-blue-400' },
 { id: 'interview', label: 'Interview', color: 'text-indigo-400', bg: 'bg-indigo-950/40', border: 'border-indigo-800', dot: 'bg-indigo-400' },
 { id: 'offer', label: 'Offer', color: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-800', dot: 'bg-amber-400' },
 { id: 'hired', label: 'Hired', color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800', dot: 'bg-emerald-400' },
 { id: 'rejected', label: 'Rejected', color: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-800', dot: 'bg-rose-400' },
];

const stageFor = (id: Stage) => STAGES.find(s => s.id === id)!;

// ─── Sub-components ────────────────────────────────────────────────────────────

const TabBtn = ({ id, label, icon: Icon, active, onClick, badge }: any) => (
 <button
 onClick={() => onClick(id)}
 className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-secondary font-medium transition-all whitespace-nowrap ${
 active
 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
 : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
 }`}
 >
 <Icon size={15} />
 {label}
 {badge !== undefined && (
 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
 {badge}
 </span>
 )}
 </button>
);

const ScoreBadge = ({ score }: { score: number }) => {
 const color = score >= 90 ? 'text-emerald-400 bg-emerald-400/10' : score >= 75 ? 'text-amber-400 bg-amber-400/10' : 'text-rose-400 bg-rose-400/10';
 return <span className={`text-label font-bold px-2 py-0.5 rounded-full ${color}`}>{score}</span>;
};

const StageBadge = ({ stage }: { stage: Stage }) => {
 const s = stageFor(stage);
 return (
 <span className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.color} ${s.bg} ${s.border}`}>
 <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
 {s.label}
 </span>
 );
};

// ─── JD Panel ─────────────────────────────────────────────────────────────────

const JDPanel = () => {
 const [jd, setJd] = useState({
 title: 'Sales Executive',
 department: 'Sales & Revenue',
 location: 'Remote / Mumbai, IN',
 type: 'Full-time',
 experience: '3+ Years',
 salaryMin: '₹10',
 salaryMax: '₹18',
 skills: ['B2B Sales', 'CRM', 'Lead Generation', 'Cold Calling', 'Negotiation', 'Account Management'],
 summary: 'We are looking for an ambitious Sales Executive to drive revenue growth. You will be responsible for full-cycle sales, from prospecting to closing deals with enterprise clients.',
 responsibilities: [
 'Manage the entire sales cycle from finding a client to securing a deal',
 'Unearth new sales opportunities through networking and cold calling',
 'Present products to prospective clients and negotiate contracts',
 'Collaborate with the marketing team on lead generation campaigns',
 'Maintain CRM records and forecast quarterly sales goals',
 ],
 requirements: [
 '3+ years of experience in B2B sales',
 'Proven track record of meeting or exceeding quotas',
 'Excellent communication and negotiation skills',
 'Experience with Salesforce, HubSpot, or similar CRMs',
 'Self-motivated with a results-driven approach',
 ],
 perks: ['Remote-first culture', 'ESOPs', 'Health insurance', 'Learning budget ₹1L/year', 'Flexible hours'],
 });
 const [newSkill, setNewSkill] = useState('');
 const [newPerk, setNewPerk] = useState('');
 const [editingResp, setEditingResp] = useState<number | null>(null);
 const [aiGenerating, setAiGenerating] = useState(false);

 const addSkill = () => { if (newSkill.trim()) { setJd(j => ({ ...j, skills: [...j.skills, newSkill.trim()] })); setNewSkill(''); } };
 const removeSkill = (s: string) => setJd(j => ({ ...j, skills: j.skills.filter(x => x !== s) }));
 const addPerk = () => { if (newPerk.trim()) { setJd(j => ({ ...j, perks: [...j.perks, newPerk.trim()] })); setNewPerk(''); } };
 const simulateAI = () => { 
 setAiGenerating(true); 
 setTimeout(() => {
 setJd(j => ({
 ...j,
 description: 'We are seeking a high-performing Sales Executive to spearhead our enterprise sales initiatives. The ideal candidate will have a proven ability to drive complex B2B sales cycles, foster strategic client relationships, and consistently exceed revenue targets. You will play a critical role in expanding our market presence and directly impacting our growth trajectory.',
 requirements: [
 ...j.requirements,
 'Demonstrated expertise in consultative selling and C-level stakeholder management',
 'Proficiency in leveraging data analytics for territory planning and pipeline optimization',
 ],
 perks: [
 ...j.perks,
 'Uncapped commissions',
 'Annual company retreat'
 ]
 }));
 setAiGenerating(false);
 }, 1500); 
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-workspace font-bold text-white">Job Description Builder</h2>
 <p className="text-secondary text-zinc-500 mt-0.5">Craft and publish your JD — AI suggestions available</p>
 </div>
 <div className="flex items-center gap-3">
 <button onClick={simulateAI} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 text-button transition-all">
 {aiGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
 {aiGenerating ? 'Generating...' : 'AI Enhance'}
 </button>
 <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-button font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20">
 <Send size={14} /> Publish JD
 </button>
 </div>
 </div>

 <div className="grid grid-cols-3 gap-6">
 {/* Left: Core fields */}
 <div className="col-span-2 space-y-5">
 {/* Basic Info */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
 <div className="flex items-center gap-2 text-secondary font-semibold text-zinc-300 mb-1">
 <Briefcase size={15} className="text-indigo-400" /> Basic Information
 </div>
 <div className="grid grid-cols-2 gap-4">
 {[
 { label: 'Job Title', key: 'title', full: true },
 { label: 'Department', key: 'department' },
 { label: 'Location', key: 'location' },
 { label: 'Employment Type', key: 'type' },
 { label: 'Experience Required', key: 'experience' },
 ].map(({ label, key, full }) => (
 <div key={key} className={full ? 'col-span-2' : ''}>
 <label className="text-label text-zinc-500 mb-1.5 block">{label}</label>
 <input
 className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-input text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
 value={(jd as any)[key]}
 onChange={e => setJd(j => ({ ...j, [key]: e.target.value }))}
 />
 </div>
 ))}
 <div>
 <label className="text-label text-zinc-500 mb-1.5 block">Salary Min (LPA)</label>
 <input className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-input text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all" value={jd.salaryMin} onChange={e => setJd(j => ({ ...j, salaryMin: e.target.value }))} />
 </div>
 <div>
 <label className="text-label text-zinc-500 mb-1.5 block">Salary Max (LPA)</label>
 <input className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-input text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all" value={jd.salaryMax} onChange={e => setJd(j => ({ ...j, salaryMax: e.target.value }))} />
 </div>
 </div>
 </div>

 {/* Summary */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
 <div className="flex items-center gap-2 text-secondary font-semibold text-zinc-300"><PenLine size={15} className="text-indigo-400" /> Role Summary</div>
 <textarea
 rows={3}
 className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-secondary text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
 value={jd.summary}
 onChange={e => setJd(j => ({ ...j, summary: e.target.value }))}
 />
 </div>

 {/* Responsibilities */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
 <div className="flex items-center gap-2 text-secondary font-semibold text-zinc-300"><ListChecks size={15} className="text-indigo-400" /> Responsibilities</div>
 <div className="space-y-2">
 {jd.responsibilities.map((r, i) => (
 <div key={i} className="flex items-start gap-2 group">
 <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 shrink-0" />
 {editingResp === i ? (
 <input
 autoFocus
 className="flex-1 bg-indigo-950/40 border border-indigo-500/40 rounded-lg px-2 py-1 text-input text-zinc-200 focus:outline-none"
 value={r}
 onChange={e => setJd(j => { const resp = [...j.responsibilities]; resp[i] = e.target.value; return { ...j, responsibilities: resp }; })}
 onBlur={() => setEditingResp(null)}
 />
 ) : (
 <span className="flex-1 text-secondary text-zinc-300 cursor-pointer hover:text-white" onClick={() => setEditingResp(i)}>{r}</span>
 )}
 <button onClick={() => setJd(j => ({ ...j, responsibilities: j.responsibilities.filter((_, idx) => idx !== i) }))} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all">
 <X size={13} />
 </button>
 </div>
 ))}
 <button onClick={() => setJd(j => ({ ...j, responsibilities: [...j.responsibilities, 'New responsibility'] }))} className="flex items-center gap-1.5 text-label text-indigo-400 hover:text-indigo-300 mt-2 transition-colors">
 <Plus size={13} /> Add responsibility
 </button>
 </div>
 </div>

 {/* Requirements */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
 <div className="flex items-center gap-2 text-secondary font-semibold text-zinc-300"><ClipboardList size={15} className="text-indigo-400" /> Requirements</div>
 <div className="space-y-2">
 {jd.requirements.map((r, i) => (
 <div key={i} className="flex items-start gap-2 group">
 <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
 <span className="flex-1 text-secondary text-zinc-300">{r}</span>
 <button onClick={() => setJd(j => ({ ...j, requirements: j.requirements.filter((_, idx) => idx !== i) }))} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all"><X size={13} /></button>
 </div>
 ))}
 <button onClick={() => setJd(j => ({ ...j, requirements: [...j.requirements, 'New requirement'] }))} className="flex items-center gap-1.5 text-label text-indigo-400 hover:text-indigo-300 mt-2 transition-colors">
 <Plus size={13} /> Add requirement
 </button>
 </div>
 </div>
 </div>

 {/* Right: Skills & Perks */}
 <div className="space-y-5">
 {/* Skills */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
 <div className="flex items-center gap-2 text-secondary font-semibold text-zinc-300"><Zap size={15} className="text-indigo-400" /> Required Skills</div>
 <div className="flex flex-wrap gap-2">
 {jd.skills.map(s => (
 <span key={s} className="flex items-center gap-1.5 bg-indigo-600/15 border border-indigo-500/25 text-indigo-300 text-label px-2.5 py-1 rounded-full">
 {s}
 <button onClick={() => removeSkill(s)} className="hover:text-rose-400 transition-colors"><X size={11} /></button>
 </span>
 ))}
 </div>
 <div className="flex gap-2">
 <input
 className="flex-1 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2 text-input text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all"
 placeholder="Add skill..."
 value={newSkill}
 onChange={e => setNewSkill(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && addSkill()}
 />
 <button onClick={addSkill} className="px-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors"><Plus size={15} /></button>
 </div>
 </div>

 {/* Perks */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
 <div className="flex items-center gap-2 text-secondary font-semibold text-zinc-300"><Award size={15} className="text-indigo-400" /> Perks & Benefits</div>
 <div className="space-y-2">
 {jd.perks.map((p, i) => (
 <div key={i} className="flex items-center gap-2 group">
 <Star size={12} className="text-amber-400 shrink-0" />
 <span className="flex-1 text-secondary text-zinc-300">{p}</span>
 <button onClick={() => setJd(j => ({ ...j, perks: j.perks.filter((_, idx) => idx !== i) }))} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all"><X size={13} /></button>
 </div>
 ))}
 <div className="flex gap-2 mt-2">
 <input className="flex-1 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2 text-input text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all" placeholder="Add perk..." value={newPerk} onChange={e => setNewPerk(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPerk()} />
 <button onClick={addPerk} className="px-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors"><Plus size={15} /></button>
 </div>
 </div>
 </div>

 {/* Preview */}
 <div className="bg-gradient-to-br from-indigo-950/40 to-zinc-900/60 border border-indigo-800/40 rounded-2xl p-5 space-y-3">
 <div className="flex items-center gap-2 text-secondary font-semibold text-indigo-300"><Eye size={15} /> Live Preview</div>
 <div className="space-y-2">
 <p className="text-white font-bold text-body">{jd.title}</p>
 <div className="flex flex-wrap gap-1.5 text-label text-zinc-400">
 <span className="flex items-center gap-1"><Building2 size={11} />{jd.department}</span>
 <span>·</span>
 <span className="flex items-center gap-1"><MapPin size={11} />{jd.location}</span>
 <span>·</span>
 <span className="flex items-center gap-1"><Clock size={11} />{jd.type}</span>
 </div>
 <div className="flex items-center gap-1 text-label text-emerald-400 ">
 <DollarSign size={11} />{jd.salaryMin}–{jd.salaryMax} LPA
 </div>
 <p className="text-label text-zinc-400 line-clamp-3">{jd.summary}</p>
 </div>
 <div className="flex gap-2 pt-1">
 <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-button text-zinc-300 transition-all">
 <Copy size={12} /> Copy Link
 </button>
 <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-button text-indigo-300 transition-all">
 <ExternalLink size={12} /> Share
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};

// ─── Candidate Pipeline Panel ──────────────────────────────────────────────────

const PipelinePanel = ({ candidates, onMove }: { candidates: Candidate[]; onMove: (id: string, stage: Stage) => void }) => {
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const [search, setSearch] = useState('');
 const selected = candidates.find(c => c.id === selectedId);

 const filtered = candidates.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.skills.some(s => s.toLowerCase().includes(search.toLowerCase())));

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-workspace font-bold text-white">Hiring Pipeline</h2>
 <p className="text-secondary text-zinc-500 mt-0.5">{candidates.length} candidates across {STAGES.length} stages</p>
 </div>
 <div className="flex items-center gap-3">
 <div className="relative">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
 <input className="bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-input text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 w-56 transition-all" placeholder="Search candidates..." value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-button hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20">
 <UserPlus size={14} /> Add Candidate
 </button>
 </div>
 </div>

 {/* Kanban Board */}
 <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
 {STAGES.map(stage => {
 const stageCands = filtered.filter(c => c.stage === stage.id);
 return (
 <div key={stage.id} className="flex-shrink-0 w-64">
 <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border-t border-x ${stage.border} ${stage.bg}`}>
 <div className="flex items-center gap-2">
 <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
 <span className={`text-label font-bold uppercase tracking-wider ${stage.color}`}>{stage.label}</span>
 </div>
 <span className={`text-label font-bold ${stage.color} bg-black/20 px-2 py-0.5 rounded-full`}>{stageCands.length}</span>
 </div>
 <div className={`min-h-48 border-b border-x ${stage.border} rounded-b-xl p-2 space-y-2`}>
 {stageCands.map(c => (
 <div
 key={c.id}
 onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
 className={`bg-zinc-900 rounded-xl p-3 cursor-pointer border transition-all hover:border-indigo-500/40 ${selectedId === c.id ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-zinc-800'}`}
 >
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-2">
 {c.avatar.startsWith('http') ? (
 <img src={c.avatar} alt={c.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
 ) : (
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${
 c.score >= 90 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
 c.score >= 75 ? 'bg-gradient-to-br from-indigo-500 to-purple-600' :
 'bg-gradient-to-br from-zinc-600 to-zinc-700'
 }`}>{c.avatar}</div>
 )}
 <div>
 <p className="text-label font-semibold text-white ">{c.name}</p>
 <p className="text-[10px] text-zinc-500 mt-0.5">{c.experience}</p>
 </div>
 </div>
 <ScoreBadge score={c.score} />
 </div>
 {c.tag && <span className="mt-2 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400">{c.tag}</span>}
 <div className="flex flex-wrap gap-1 mt-2">
 {c.skills.slice(0, 2).map(s => (
 <span key={s} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{s}</span>
 ))}
 {c.skills.length > 2 && <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">+{c.skills.length - 2}</span>}
 </div>
 {c.interviewDate && (
 <div className="flex items-center gap-1 mt-2 text-[10px] text-indigo-400">
 <Calendar size={10} /> {c.interviewDate}
 </div>
 )}
 </div>
 ))}
 {stageCands.length === 0 && (
 <div className="flex items-center justify-center h-20 text-[11px] text-zinc-700 border border-dashed border-zinc-800 rounded-xl">
 No candidates
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>

 {/* Side Detail Panel */}
 {selected && (
 <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-5">
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-4">
 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-section font-bold text-white ${selected.score >= 90 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>{selected.avatar}</div>
 <div>
 <h3 className="text-section font-bold text-white">{selected.name}</h3>
 <p className="text-secondary text-zinc-400">{selected.role}</p>
 <div className="flex items-center gap-3 mt-1">
 <StageBadge stage={selected.stage} />
 <ScoreBadge score={selected.score} />
 </div>
 </div>
 </div>
 <button onClick={() => setSelectedId(null)} className="text-zinc-600 hover:text-zinc-400"><X size={18} /></button>
 </div>

 <div className="grid grid-cols-3 gap-4 text-secondary">
 {[
 { label: 'Email', value: selected.email, icon: Mail },
 { label: 'Phone', value: selected.phone, icon: Phone },
 { label: 'Location', value: selected.location, icon: MapPin },
 { label: 'Experience', value: selected.experience, icon: Clock },
 { label: 'Source', value: selected.source, icon: Globe },
 { label: 'Expected', value: selected.salary || 'Open', icon: DollarSign },
 ].map(({ label, value, icon: Icon }) => (
 <div key={label} className="bg-zinc-800/40 rounded-xl p-3">
 <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-medium mb-1 uppercase tracking-wide"><Icon size={11} />{label}</div>
 <div className="text-secondary text-zinc-200 font-medium">{value}</div>
 </div>
 ))}
 </div>

 <div>
 <div className="text-label text-zinc-500 mb-2 uppercase tracking-wide">Skills</div>
 <div className="flex flex-wrap gap-2">
 {selected.skills.map(s => (
 <span key={s} className="bg-indigo-600/15 border border-indigo-500/25 text-indigo-300 text-label px-2.5 py-1 rounded-full">{s}</span>
 ))}
 </div>
 </div>

 {/* Move Stage */}
 <div>
 <div className="text-label text-zinc-500 mb-2 uppercase tracking-wide">Move to Stage</div>
 <div className="flex flex-wrap gap-2">
 {STAGES.filter(s => s.id !== selected.stage).map(stage => (
 <button
 key={stage.id}
 onClick={() => onMove(selected.id, stage.id)}
 className={`flex items-center gap-1.5 text-label px-3 py-1.5 rounded-full border transition-all hover:opacity-90 ${stage.color} ${stage.bg} ${stage.border}`}
 >
 → {stage.label}
 </button>
 ))}
 </div>
 </div>

 {/* Actions */}
 <div className="flex gap-3">
 <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-button rounded-xl hover:bg-indigo-500 transition-all">
 <Calendar size={14} /> Schedule Interview
 </button>
 <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 text-button rounded-xl hover:bg-zinc-700 transition-all">
 <Send size={14} /> Send Email
 </button>
 <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 text-button rounded-xl hover:bg-zinc-700 transition-all">
 <MessageSquare size={14} /> Add Note
 </button>
 </div>
 </div>
 )}
 </div>
 );
};

// ─── Interview Panel ───────────────────────────────────────────────────────────

const InterviewPanel = () => {
 const [questions, setQuestions] = useState<InterviewQuestion[]>(INITIAL_QUESTIONS);
 const [rounds, setRounds] = useState([
 { id: 'r1', name: 'HR Screening', duration: '20 min', type: 'Phone', interviewer: 'Talent Team', enabled: true },
 { id: 'r2', name: 'Technical Round 1', duration: '60 min', type: 'Video', interviewer: 'Engineering Lead', enabled: true },
 { id: 'r3', name: 'System Design', duration: '90 min', type: 'Video', interviewer: 'Principal Engineer', enabled: true },
 { id: 'r4', name: 'Culture & Values', duration: '30 min', type: 'Video', interviewer: 'HR Manager', enabled: true },
 { id: 'r5', name: 'CEO / Leadership', duration: '30 min', type: 'Video', interviewer: 'CEO', enabled: false },
 ]);
 const [newQ, setNewQ] = useState('');
 const [newQCat, setNewQCat] = useState('Technical');

 const addQ = () => {
 if (!newQ.trim()) return;
 setQuestions(q => [...q, { id: `q${Date.now()}`, category: newQCat, question: newQ.trim(), timeAllowed: '8 min' }]);
 setNewQ('');
 };

 const categories = ['Technical', 'System Design', 'Behavioural', 'Cultural Fit', 'Leadership'];
 const catColor: Record<string, string> = { Technical: 'text-indigo-400 bg-indigo-400/10', 'System Design': 'text-purple-400 bg-purple-400/10', Behavioural: 'text-amber-400 bg-amber-400/10', 'Cultural Fit': 'text-emerald-400 bg-emerald-400/10', Leadership: 'text-rose-400 bg-rose-400/10' };

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-workspace font-bold text-white">Interview Configuration</h2>
 <p className="text-secondary text-zinc-500 mt-0.5">Configure interview rounds, questions and scoring rubrics</p>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-6">
 {/* Rounds */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
 <div className="flex items-center gap-2 text-secondary font-semibold text-zinc-300"><Layers size={15} className="text-indigo-400" /> Interview Rounds</div>
 <div className="space-y-3">
 {rounds.map((r, i) => (
 <div key={r.id} className={`border rounded-xl p-3 transition-all ${r.enabled ? 'border-zinc-700 bg-zinc-800/40' : 'border-zinc-800 bg-zinc-900/30 opacity-50'}`}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-label font-bold flex items-center justify-center">{i + 1}</span>
 <span className="text-secondary font-semibold text-zinc-200">{r.name}</span>
 </div>
 <button
 onClick={() => setRounds(rds => rds.map(rd => rd.id === r.id ? { ...rd, enabled: !rd.enabled } : rd))}
 className={`w-9 h-5 rounded-full transition-all relative ${r.enabled ? 'bg-indigo-600' : 'bg-zinc-700'}`}
 >
 <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${r.enabled ? 'left-4' : 'left-0.5'}`} />
 </button>
 </div>
 <div className="flex items-center gap-3 mt-2 text-label text-zinc-500">
 <span className="flex items-center gap-1"><Clock size={11} />{r.duration}</span>
 <span className="flex items-center gap-1">{r.type === 'Video' ? <Video size={11} /> : <Phone size={11} />}{r.type}</span>
 <span className="flex items-center gap-1"><Users size={11} />{r.interviewer}</span>
 </div>
 </div>
 ))}
 <button onClick={() => setRounds(r => [...r, { id: `r${Date.now()}`, name: 'New Round', duration: '45 min', type: 'Video', interviewer: 'Hiring Manager', enabled: true }])} className="flex items-center gap-2 text-secondary text-indigo-400 hover:text-indigo-300 transition-colors">
 <Plus size={14} /> Add Round
 </button>
 </div>
 </div>

 {/* Question Bank */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
 <div className="flex items-center gap-2 text-secondary font-semibold text-zinc-300"><BookOpen size={15} className="text-indigo-400" /> Question Bank</div>
 <div className="space-y-2 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
 {questions.map(q => (
 <div key={q.id} className="group bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-3 space-y-1">
 <div className="flex items-center justify-between">
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catColor[q.category] || 'text-zinc-400 bg-zinc-800'}`}>{q.category}</span>
 <div className="flex items-center gap-2 text-zinc-600">
 <span className="text-[10px]">{q.timeAllowed}</span>
 <button onClick={() => setQuestions(qs => qs.filter(x => x.id !== q.id))} className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all"><X size={12} /></button>
 </div>
 </div>
 <p className="text-label text-zinc-300 ">{q.question}</p>
 </div>
 ))}
 </div>
 <div className="space-y-2 pt-2 border-t border-zinc-800">
 <div className="flex gap-2">
 <select className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2 text-secondary text-zinc-200 focus:outline-none focus:border-indigo-500/50 flex-shrink-0" value={newQCat} onChange={e => setNewQCat(e.target.value)}>
 {categories.map(c => <option key={c} value={c}>{c}</option>)}
 </select>
 </div>
 <div className="flex gap-2">
 <input className="flex-1 bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2 text-input text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all" placeholder="Add question..." value={newQ} onChange={e => setNewQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && addQ()} />
 <button onClick={addQ} className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 text-button transition-all">Add</button>
 </div>
 </div>
 </div>
 </div>

 {/* Scoring Rubric */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
 <div className="flex items-center gap-2 text-secondary font-semibold text-zinc-300 mb-4"><BarChart2 size={15} className="text-indigo-400" /> AI Scoring Rubric</div>
 <div className="grid grid-cols-4 gap-4">
 {[
 { label: 'Technical Skills', weight: 35, color: 'bg-indigo-500' },
 { label: 'Communication', weight: 25, color: 'bg-purple-500' },
 { label: 'Problem Solving', weight: 25, color: 'bg-amber-500' },
 { label: 'Culture Fit', weight: 15, color: 'bg-emerald-500' },
 ].map(item => (
 <div key={item.label} className="space-y-2">
 <div className="flex justify-between text-label">
 <span className="text-zinc-400">{item.label}</span>
 <span className="text-zinc-300 font-bold">{item.weight}%</span>
 </div>
 <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
 <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.weight}%` }} />
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
};

// ─── Applications Panel ────────────────────────────────────────────────────────

const ApplicationsPanel = ({ candidates }: { candidates: Candidate[] }) => {
 const [filter, setFilter] = useState<Stage | 'all'>('all');
 const [sort, setSort] = useState<'score' | 'date'>('score');
 const [search, setSearch] = useState('');

 const filtered = candidates
 .filter(c => filter === 'all' || c.stage === filter)
 .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
 .sort((a, b) => sort === 'score' ? b.score - a.score : b.appliedAt.localeCompare(a.appliedAt));

 return (
 <div className="space-y-5">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-workspace font-bold text-white">All Candidates</h2>
 <p className="text-secondary text-zinc-500 mt-0.5">{filtered.length} candidates • sorted by {sort}</p>
 </div>
 <div className="flex items-center gap-3">
 <div className="relative">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
 <input className="bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-input text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 w-52 transition-all" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <select className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-secondary text-zinc-200 focus:outline-none focus:border-indigo-500/50" value={sort} onChange={e => setSort(e.target.value as any)}>
 <option value="score">Sort: Score</option>
 <option value="date">Sort: Date</option>
 </select>
 <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-button text-zinc-300 hover:bg-zinc-700 transition-all">
 <Download size={14} /> Export
 </button>
 </div>
 </div>

 {/* Stage filter chips */}
 <div className="flex gap-2 flex-wrap">
 <button onClick={() => setFilter('all')} className={`text-label font-semibold px-3 py-1.5 rounded-full border transition-all ${filter === 'all' ? 'bg-zinc-200 text-zinc-900 border-zinc-200' : 'bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-600'}`}>All ({candidates.length})</button>
 {STAGES.map(s => (
 <button key={s.id} onClick={() => setFilter(s.id)} className={`text-label font-semibold px-3 py-1.5 rounded-full border transition-all ${filter === s.id ? `${s.bg} ${s.color} ${s.border}` : 'bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-600'}`}>
 {s.label} ({candidates.filter(c => c.stage === s.id).length})
 </button>
 ))}
 </div>

 {/* Table */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
 <table className="w-full text-secondary">
 <thead>
 <tr className="border-b border-zinc-800 text-label text-zinc-500 uppercase tracking-wider">
 {['Candidate', 'Stage', 'Score', 'Skills', 'Source', 'Experience', 'Expected', 'Applied', 'Actions'].map(h => (
 <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {filtered.map((c, i) => (
 <tr key={c.id} className={`border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-zinc-900/20'}`}>
 <td className="px-4 py-3">
 <div className="flex items-center gap-3">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${c.score >= 90 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : c.score >= 75 ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-zinc-600 to-zinc-700'}`}>{c.avatar}</div>
 <div>
 <div className="font-semibold text-white text-label">{c.name}</div>
 <div className="text-zinc-500 text-[10px]">{c.email}</div>
 </div>
 </div>
 </td>
 <td className="px-4 py-3"><StageBadge stage={c.stage} /></td>
 <td className="px-4 py-3"><ScoreBadge score={c.score} /></td>
 <td className="px-4 py-3">
 <div className="flex gap-1 flex-wrap">
 {c.skills.slice(0, 2).map(s => <span key={s} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{s}</span>)}
 {c.skills.length > 2 && <span className="text-[10px] text-zinc-600">+{c.skills.length - 2}</span>}
 </div>
 </td>
 <td className="px-4 py-3 text-zinc-400 text-table">{c.source}</td>
 <td className="px-4 py-3 text-zinc-400 text-table">{c.experience}</td>
 <td className="px-4 py-3 text-zinc-300 text-table font-medium">{c.salary || '—'}</td>
 <td className="px-4 py-3 text-zinc-500 text-table">{c.appliedAt}</td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <button className="text-zinc-600 hover:text-indigo-400 transition-colors"><Eye size={14} /></button>
 <button className="text-zinc-600 hover:text-amber-400 transition-colors"><Send size={14} /></button>
 <button className="text-zinc-600 hover:text-emerald-400 transition-colors"><Calendar size={14} /></button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 {filtered.length === 0 && (
 <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
 <Users size={32} className="mb-3 opacity-40" />
 <p className="text-secondary">No candidates match this filter</p>
 </div>
 )}
 </div>
 </div>
 );
};

// ─── Email Templates Panel ─────────────────────────────────────────────────────

const EmailPanel = () => {
 const [templates, setTemplates] = useState<EmailTemplate[]>(INITIAL_TEMPLATES);
 const [selected, setSelected] = useState<string>(templates[0].id);
 const current = templates.find(t => t.id === selected)!;

 const update = (field: keyof EmailTemplate, value: string) => {
 setTemplates(ts => ts.map(t => t.id === selected ? { ...t, [field]: value } : t));
 };

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-workspace font-bold text-white">Email Templates</h2>
 <p className="text-secondary text-zinc-500 mt-0.5">Customise automated emails for each hiring stage</p>
 </div>
 <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-button font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20">
 <Plus size={14} /> New Template
 </button>
 </div>

 <div className="grid grid-cols-3 gap-6">
 {/* Template list */}
 <div className="space-y-2">
 {templates.map(t => {
 const stage = STAGES.find(s => s.id === t.stage);
 return (
 <button
 key={t.id}
 onClick={() => setSelected(t.id)}
 className={`w-full text-left p-4 rounded-xl border transition-all ${selected === t.id ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'}`}
 >
 <div className="flex items-center gap-2 mb-1">
 {stage && <span className={`w-2 h-2 rounded-full ${stage.dot}`} />}
 <span className="text-label font-bold text-zinc-200">{t.trigger}</span>
 </div>
 <p className="text-label text-zinc-500 truncate">{t.subject}</p>
 </button>
 );
 })}
 </div>

 {/* Editor */}
 <div className="col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
 <div>
 <div className="flex items-center justify-between mb-3">
 <span className="text-secondary font-bold text-white">{current.trigger}</span>
 <div className="flex gap-2">
 <button className="flex items-center gap-1.5 text-button px-3 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 transition-all">
 <Sparkles size={12} /> AI Rewrite
 </button>
 <button className="flex items-center gap-1.5 text-button px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all">
 <Send size={12} /> Test Send
 </button>
 </div>
 </div>

 <label className="text-label text-zinc-500 mb-1.5 block ">Subject Line</label>
 <input
 className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-input text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all mb-4"
 value={current.subject}
 onChange={e => update('subject', e.target.value)}
 />

 <label className="text-label text-zinc-500 mb-1.5 block ">Email Body</label>
 <textarea
 rows={14}
 className="w-full bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-3 py-2.5 text-secondary text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none font-mono"
 value={current.body}
 onChange={e => update('body', e.target.value)}
 />
 </div>

 {/* Variables */}
 <div className="border-t border-zinc-800 pt-4">
 <div className="text-label text-zinc-500 mb-2">Available Variables</div>
 <div className="flex flex-wrap gap-2">
 {['{name}', '{role}', '{company}', '{recruiter_name}', '{calendar_link}', '{interview_date}', '{offer_amount}'].map(v => (
 <button key={v} className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-2 py-1 rounded-lg font-mono transition-colors" onClick={() => update('body', current.body + ` ${v}`)}>
 {v}
 </button>
 ))}
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};

// ─── Analytics Panel ───────────────────────────────────────────────────────────

const AnalyticsPanel = ({ candidates }: { candidates: Candidate[] }) => {
 const total = candidates.length;
 const hired = candidates.filter(c => c.stage === 'hired').length;
 const interviews = candidates.filter(c => c.stage === 'interview').length;
 const offers = candidates.filter(c => c.stage === 'offer').length;

 const stats = [
 { label: 'Total Applicants', value: total, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-400/10', delta: '+23%' },
 { label: 'In Interview', value: interviews, icon: Video, color: 'text-purple-400', bg: 'bg-purple-400/10', delta: '+15%' },
 { label: 'Offers Extended', value: offers, icon: FileText, color: 'text-amber-400', bg: 'bg-amber-400/10', delta: '+5%' },
 { label: 'Hired', value: hired, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', delta: '+100%' },
 { label: 'Avg. Score', value: Math.round(candidates.reduce((a, c) => a + c.score, 0) / total), icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10', delta: '+4pts' },
 { label: 'Time-to-hire', value: '12d', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-400/10', delta: '-3d vs avg' },
 ];

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-workspace font-bold text-white">Hiring Analytics</h2>
 <p className="text-secondary text-zinc-500 mt-0.5">Estimated value saved vs. manual hiring: <span className="text-emerald-400 font-semibold">$25,000/recruiter/year</span></p>
 </div>

 <div className="grid grid-cols-3 gap-4">
 {stats.map(s => (
 <div key={s.label} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
 <div className="flex items-center justify-between mb-3">
 <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
 <s.icon size={18} className={s.color} />
 </div>
 <span className="text-[11px] text-emerald-400 font-semibold">{s.delta}</span>
 </div>
 <div className="text-page font-bold text-white">{s.value}</div>
 <div className="text-label text-zinc-500 mt-0.5">{s.label}</div>
 </div>
 ))}
 </div>

 {/* Funnel */}
 <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
 <div className="text-secondary font-semibold text-zinc-300 mb-4">Candidate Funnel</div>
 <div className="space-y-3">
 {STAGES.filter(s => s.id !== 'rejected').map(stage => {
 const count = candidates.filter(c => c.stage === stage.id).length;
 const pct = Math.round((count / total) * 100);
 return (
 <div key={stage.id} className="space-y-1.5">
 <div className="flex items-center justify-between text-label">
 <span className={`font-semibold ${stage.color}`}>{stage.label}</span>
 <span className="text-zinc-400">{count} candidates ({pct}%)</span>
 </div>
 <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
 <div className={`h-full rounded-full ${stage.dot.replace('bg-', 'bg-')} transition-all`} style={{ width: `${pct}%` }} />
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Savings calculator */}
 <div className="bg-gradient-to-br from-emerald-950/40 to-zinc-900/60 border border-emerald-800/40 rounded-2xl p-5">
 <div className="flex items-center gap-2 text-secondary font-semibold text-emerald-300 mb-4"><TrendingUp size={15} /> ROI Calculator</div>
 <div className="grid grid-cols-3 gap-4 text-secondary">
 {[
 { label: 'Agency fees saved', value: '$8,000', desc: 'Avg 15–20% of salary' },
 { label: 'Recruiter hours saved', value: '120 hrs', desc: '~$9,600 @ $80/hr' },
 { label: 'Time-to-hire reduction', value: '40%', desc: 'vs. manual 20-day avg' },
 ].map(item => (
 <div key={item.label} className="bg-black/20 rounded-xl p-3 text-center">
 <div className="text-workspace font-bold text-emerald-400">{item.value}</div>
 <div className="text-label font-semibold text-zinc-200 mt-1">{item.label}</div>
 <div className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</div>
 </div>
 ))}
 </div>
 <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
 <span className="text-emerald-400 font-bold text-section">≈ $25,000 saved per recruiter per year</span>
 </div>
 </div>
 </div>
 );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function HiringWorkflow() {
 const [activeTab, setActiveTab] = useState<ActiveTab>('pipeline');
 const [candidates, setCandidates] = useState<Candidate[]>([]);
 const [loading, setLoading] = useState(true);

 // Kernel Hooks
 const queryEngine = useQueryEngine();
 const objectRuntime = useObjectRuntime();
 const actorId = 'urn:chatr:actor:employee:current_user';

 // Bootstrap mock candidates if empty
 useEffect(() => {
 async function bootstrap() {
 const results = await queryEngine.query({ actorId, aggregateType: 'Candidate' });
 if (results.length === 0) {
 console.log('[HiringWorkflow] Bootstrapping initial candidates into Kernel...');
 for (const mock of INITIAL_CANDIDATES) {
 await objectRuntime.executeCommand(
 {
 aggregateType: 'Candidate',
 aggregateId: mock.id,
 action: 'Create',
 payload: { ...mock, stage: mock.stage }
 },
 actorId,
 'tenant_1'
 );
 }
 await fetchCandidates();
 }
 }
 bootstrap();
 }, [queryEngine, objectRuntime]);

 async function fetchCandidates() {
 try {
 setLoading(true);
 const records = await queryEngine.query({ actorId, aggregateType: 'Candidate' });
 
 const mappedCandidates: Candidate[] = records.map((r: any) => ({
 id: r.id,
 name: r.name,
 email: r.email,
 phone: r.phone || '+1 (555) 000-0000',
 role: r.role || 'Sales Executive',
 location: r.location || 'Remote',
 experience: r.experience || '3 years',
 skills: r.skills || ['React', 'TypeScript', 'Node.js'],
 source: r.source || 'LinkedIn',
 stage: r.stage as Stage,
 score: r.score || 85,
 appliedAt: r.appliedAt || new Date().toLocaleDateString(),
 avatar: r.avatar || `https://i.pravatar.cc/150?u=${r.id}`
 }));
 setCandidates(mappedCandidates);
 } catch (err) {
 console.error('Failed to load semantic candidates from Kernel', err);
 } finally {
 setLoading(false);
 }
 }

 useEffect(() => {
 fetchCandidates();
 }, [queryEngine]);

 const moveCandidate = async (id: string, stage: Stage) => {
 // Optimistic UI update
 setCandidates(cs => cs.map(c => c.id === id ? { ...c, stage } : c));
 try {
 // Map UI stage to Event Type as defined in CandidateEDL
 let eventType = 'CandidateTransitioned';
 if (stage === 'screening') eventType = 'CandidateScreeningStarted';
 if (stage === 'interview') eventType = 'CandidateInterviewScheduled';
 if (stage === 'offer') eventType = 'CandidateOffered';
 if (stage === 'hired') eventType = 'CandidateHired';
 if (stage === 'rejected') eventType = 'CandidateRejected';

 await objectRuntime.executeCommand(
 {
 aggregateType: 'Candidate',
 aggregateId: id,
 action: 'Transition',
 payload: { stage: stage, targetState: stage, _lifecycleState: stage }
 },
 actorId,
 'tenant_1'
 );
 
 // Refresh to get absolute truth from Kernel
 await fetchCandidates();
 } catch (e) {
 console.error('Failed to execute Kernel command:', e);
 await fetchCandidates(); // Revert on failure
 }
 };

 const tabs = [
 { id: 'jd' as ActiveTab, label: 'Job Description', icon: FileText },
 { id: 'pipeline' as ActiveTab, label: 'Pipeline', icon: Layers, badge: candidates.length },
 { id: 'applications' as ActiveTab, label: 'All Candidates', icon: Users, badge: candidates.length },
 { id: 'interviews' as ActiveTab, label: 'Interviews', icon: Video },
 { id: 'emails' as ActiveTab, label: 'Email Templates', icon: Mail },
 { id: 'analytics' as ActiveTab, label: 'Analytics', icon: BarChart2 },
 ];

 const hiredCount = candidates.filter(c => c.stage === 'hired').length;
 const targetCount = 20;

 return (
 <div className="flex flex-col h-full w-full bg-[#09090b] text-zinc-300 overflow-hidden">
 {/* Top Header */}
 <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl px-6 py-4 flex-shrink-0">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
 <Briefcase size={20} className="text-white" />
 </div>
 <div>
 <h1 className="text-section font-bold text-white">Sales Executive — Hiring Campaign</h1>
 <div className="flex items-center gap-4 mt-0.5 text-label text-zinc-500">
 <span className="flex items-center gap-1"><Target size={11} /> Goal: {hiredCount}/{targetCount} hired</span>
 <span className="flex items-center gap-1"><Users size={11} /> {candidates.length} total applicants</span>
 <span className="flex items-center gap-1 text-emerald-400"><TrendingUp size={11} /> Est. $25K/yr saved</span>
 </div>
 </div>
 </div>
 {/* Progress bar */}
 <div className="flex items-center gap-4">
 <div className="w-48">
 <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
 <span>Hire Progress</span>
 <span className="text-emerald-400 font-bold">{Math.round((hiredCount / targetCount) * 100)}%</span>
 </div>
 <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all" style={{ width: `${(hiredCount / targetCount) * 100}%` }} />
 </div>
 </div>
 <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-button font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20">
 <Sparkles size={14} /> Auto-Fill Remaining
 </button>
 </div>
 </div>
 </header>

 {/* Tabs */}
 <div className="border-b border-zinc-800/60 bg-zinc-950/50 px-6 py-2 flex-shrink-0">
 <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
 {tabs.map(t => (
 <TabBtn key={t.id} {...t} active={activeTab === t.id} onClick={setActiveTab} />
 ))}
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto px-6 py-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>
 {/* Background glow */}
 <div className="fixed top-0 left-1/3 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
 <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-emerald-500/3 rounded-full blur-[100px] pointer-events-none" />
 
 {activeTab === 'jd' && <JDPanel />}
 {activeTab === 'pipeline' && <PipelinePanel candidates={candidates} onMove={moveCandidate} />}
 {activeTab === 'applications' && <ApplicationsPanel candidates={candidates} />}
 {activeTab === 'interviews' && <InterviewPanel />}
 {activeTab === 'emails' && <EmailPanel />}
 {activeTab === 'analytics' && <AnalyticsPanel candidates={candidates} />}
 </div>
 </div>
 );
}
