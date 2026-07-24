/**
 * CHATR AI Talent Operating System (TOS) v3.0
 * Enterprise ATS — /desktop/recruitment
 *
 * Included Features:
 * 1. AI Full Job Description Generation & Rich Custom Editor
 * 2. Import Job Requisitions (JSON, CSV, Raw Text parser & Supabase insertion)
 * 3. Import CVs / Resumes (PDF/DOCX file upload, drag-and-drop, AI CV parsing & matching)
 * 4. Export Analytics/Pipeline Report (CSV/JSON download)
 * 5. Export Candidate Resume Dossiers (Single/Batch export)
 * 6. Full 8-Tab Architecture with Realtime Supabase integration & Business OS event publishing
 */

import React, {
  useState, useEffect, useCallback, useMemo, useRef, memo,
} from 'react';
import {
  Users, Calendar, CheckCircle, Sparkles, Briefcase, FileText,
  Loader2, PhoneCall, Radio, Clock, Bot,
  BarChart2, Plus, Search, Filter, Download, Mail,
  MapPin, ChevronRight, X, Send,
  Building2, Target, TrendingUp, Award, Zap,
  Circle, Upload, MoreHorizontal,
  Video, Phone, ChevronLeft, Brain, Lightbulb,
  Activity, UserCheck, ArrowUpRight, ArrowDownRight,
  AlertTriangle, Command, Layers, GitMerge, Bell,
  GitCompare, BarChart, Star, ThumbsUp, ThumbsDown,
  Flame, Cpu, ShieldCheck, Hash, RefreshCw, Eye, Edit3, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { contextBuilder } from '@/core/ai/context/ContextBuilder';
import {
  markRecruitmentCallInterviewScheduled,
  simulatePositiveRecruitmentResponse,
} from '@/services/orchestrationService';
import {
  BarChart as ReBarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts';

// ─── Type System ─────────────────────────────────────────────────────────────

type TosTab = 'dashboard' | 'pipeline' | 'candidates' | 'interviews' | 'jobs' | 'analytics' | 'copilot' | 'onboarding';
type CandidateStage = 'Applied' | 'Screening' | 'Assessment' | 'Interview' | 'Offer' | 'Joined' | 'Rejected';
type PriorityLevel = 'High' | 'Medium' | 'Low';
type RiskLevel = 'Low' | 'Medium' | 'High';
type SalaryFit = 'Within Band' | 'Above Band' | 'Below Band';
type InterviewType = 'HR' | 'Technical' | 'Manager' | 'Client' | 'Panel' | 'Behavioral' | 'Final';
type OnboardingStep = 'offer_accepted' | 'documents' | 'background_check' | 'it_request' | 'laptop' | 'email_setup' | 'payroll' | 'hrms' | 'welcome_kit' | 'orientation' | 'employee_created';

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  applied_for: string | null;
  created_at?: string;
  current_company?: string;
  experience_years?: number;
  notice_days?: number;
  expected_ctc?: number;
  location?: string;
  skills?: string[];
  ai_match?: number;
  ai_matched_skills?: string[];
  ai_missing_skills?: string[];
  recruiter?: string;
  priority?: PriorityLevel;
  risk?: RiskLevel;
  salary_fit?: SalaryFit;
  availability?: string;
  stage_entered_at?: string;
  is_demo?: boolean;
}

interface Requisition {
  id: string;
  title: string;
  location: string;
  type: string;
  status: string;
  department?: string;
  created_at?: string;
  jd?: string;
  skills?: string[];
  budget?: string;
}

interface AutomationEvent {
  id: string;
  event_type: string;
  candidate_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface MobileAction {
  id: string;
  action_type: string;
  candidate_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  loading?: boolean;
}

interface ActivityItem {
  id: string;
  type: 'stage_change' | 'interview' | 'offer' | 'joined' | 'rejected' | 'comment';
  candidateName: string;
  initials: string;
  avatarColor: string;
  message: string;
  time: Date;
  stage?: CandidateStage;
}

interface OnboardingRecord {
  candidateId: string;
  candidateName: string;
  role: string;
  startDate: string;
  completionPct: number;
  steps: Record<OnboardingStep, boolean>;
}

// ─── Stage Configuration ──────────────────────────────────────────────────────

const PIPELINE_STAGES: CandidateStage[] = ['Applied', 'Screening', 'Assessment', 'Interview', 'Offer', 'Joined', 'Rejected'];

const STAGE_SLA_DAYS: Record<CandidateStage, number | null> = {
  Applied: 2, Screening: 5, Assessment: 7, Interview: 10, Offer: 3, Joined: null, Rejected: null,
};

const STAGE_META: Record<CandidateStage, {
  gradient: string; border: string; columnBg: string; badgeBg: string; badgeText: string;
  icon: string; subLabel: string; dotColor: string; textColor: string; accent: string;
}> = {
  Applied:    { gradient: 'from-slate-700 via-slate-600 to-slate-500',    border: 'border-slate-300 dark:border-slate-600',    columnBg: 'bg-slate-50/80 dark:bg-slate-900/40',      badgeBg: 'bg-slate-100 dark:bg-slate-800',     badgeText: 'text-slate-600 dark:text-slate-300',   icon: '📥', subLabel: 'New applicants',     dotColor: 'bg-slate-500',    textColor: 'text-slate-700 dark:text-slate-200',   accent: '#64748b' },
  Screening:  { gradient: 'from-blue-700 via-blue-600 to-blue-500',       border: 'border-blue-200 dark:border-blue-800',      columnBg: 'bg-blue-50/60 dark:bg-blue-950/20',        badgeBg: 'bg-blue-100 dark:bg-blue-900/40',    badgeText: 'text-blue-700 dark:text-blue-300',     icon: '🔍', subLabel: 'HR review',          dotColor: 'bg-blue-500',     textColor: 'text-blue-700 dark:text-blue-300',     accent: '#3b82f6' },
  Assessment: { gradient: 'from-indigo-700 via-indigo-600 to-indigo-500', border: 'border-indigo-200 dark:border-indigo-800',  columnBg: 'bg-indigo-50/60 dark:bg-indigo-950/20',    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/40', badgeText: 'text-indigo-700 dark:text-indigo-300', icon: '📝', subLabel: 'Skills eval',        dotColor: 'bg-indigo-500',   textColor: 'text-indigo-700 dark:text-indigo-300', accent: '#6366f1' },
  Interview:  { gradient: 'from-purple-700 via-purple-600 to-violet-500', border: 'border-purple-200 dark:border-purple-800',  columnBg: 'bg-purple-50/60 dark:bg-purple-950/20',    badgeBg: 'bg-purple-100 dark:bg-purple-900/40', badgeText: 'text-purple-700 dark:text-purple-300', icon: '🎙️', subLabel: 'Active interviews',  dotColor: 'bg-purple-500',   textColor: 'text-purple-700 dark:text-purple-300', accent: '#8b5cf6' },
  Offer:      { gradient: 'from-amber-600 via-amber-500 to-orange-400',   border: 'border-amber-200 dark:border-amber-800',    columnBg: 'bg-amber-50/60 dark:bg-amber-950/20',      badgeBg: 'bg-amber-100 dark:bg-amber-900/40',  badgeText: 'text-amber-700 dark:text-amber-300',   icon: '📄', subLabel: 'Offer extended',     dotColor: 'bg-amber-500',    textColor: 'text-amber-700 dark:text-amber-300',   accent: '#f59e0b' },
  Joined:     { gradient: 'from-emerald-700 via-emerald-600 to-green-500',border: 'border-emerald-200 dark:border-emerald-800',columnBg: 'bg-emerald-50/60 dark:bg-emerald-950/20', badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40',badgeText: 'text-emerald-700 dark:text-emerald-300',icon: '🎉', subLabel: 'Successfully hired', dotColor: 'bg-emerald-500',  textColor: 'text-emerald-700 dark:text-emerald-300',accent: '#10b981' },
  Rejected:   { gradient: 'from-rose-700 via-rose-600 to-red-500',        border: 'border-rose-200 dark:border-rose-800',      columnBg: 'bg-rose-50/40 dark:bg-rose-950/10',        badgeBg: 'bg-rose-100 dark:bg-rose-900/40',    badgeText: 'text-rose-700 dark:text-rose-300',     icon: '❌', subLabel: 'Not selected',      dotColor: 'bg-rose-500',     textColor: 'text-rose-700 dark:text-rose-300',     accent: '#ef4444' },
};

const STAGE_COLORS: Record<CandidateStage, string> = {
  Applied: 'bg-slate-500', Screening: 'bg-blue-500', Assessment: 'bg-indigo-500',
  Interview: 'bg-purple-500', Offer: 'bg-amber-500', Joined: 'bg-emerald-500', Rejected: 'bg-rose-500',
};

const AVATAR_PALETTES = [
  { bg: 'bg-violet-100 dark:bg-violet-900/50', text: 'text-violet-700 dark:text-violet-300', hex: '#7c3aed' },
  { bg: 'bg-blue-100 dark:bg-blue-900/50',     text: 'text-blue-700 dark:text-blue-300',     hex: '#2563eb' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/50',text: 'text-emerald-700 dark:text-emerald-300',hex: '#059669' },
  { bg: 'bg-rose-100 dark:bg-rose-900/50',     text: 'text-rose-700 dark:text-rose-300',     hex: '#e11d48' },
  { bg: 'bg-amber-100 dark:bg-amber-900/50',   text: 'text-amber-700 dark:text-amber-300',   hex: '#d97706' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/50', text: 'text-indigo-700 dark:text-indigo-300', hex: '#4f46e5' },
  { bg: 'bg-pink-100 dark:bg-pink-900/50',     text: 'text-pink-700 dark:text-pink-300',     hex: '#db2777' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/50',     text: 'text-cyan-700 dark:text-cyan-300',     hex: '#0891b2' },
];

// ─── Enterprise Demo Data ─────────────────────────────────────────────────────

const DEMO_CANDIDATES: Candidate[] = [
  { id: 'demo-01', first_name: 'Rahul', last_name: 'Mehta', email: 'rahul.mehta@example.com', phone: '+91 98765 43210', status: 'Applied', applied_for: null, created_at: new Date(Date.now()-86400000).toISOString(), current_company: 'Infosys', experience_years: 6, notice_days: 30, expected_ctc: 22, location: 'Bangalore', skills: ['React', 'TypeScript', 'Node.js', 'AWS'], ai_match: 91, ai_matched_skills: ['React', 'TypeScript', 'AWS', 'REST APIs'], ai_missing_skills: ['GraphQL', 'Kubernetes'], recruiter: 'Priya N.', priority: 'High', risk: 'Low', salary_fit: 'Within Band', availability: 'In 30 days', stage_entered_at: new Date(Date.now()-86400000).toISOString(), is_demo: true },
  { id: 'demo-02', first_name: 'Sneha', last_name: 'Reddy', email: 'sneha.r@example.com', phone: '+91 98765 43211', status: 'Applied', applied_for: null, created_at: new Date(Date.now()-172800000).toISOString(), current_company: 'Wipro', experience_years: 4, notice_days: 45, expected_ctc: 16, location: 'Hyderabad', skills: ['Python', 'Django', 'SQL', 'Docker'], ai_match: 78, ai_matched_skills: ['Python', 'SQL', 'Docker'], ai_missing_skills: ['Kubernetes', 'Kafka', 'AWS'], recruiter: 'Arjun S.', priority: 'Medium', risk: 'Low', salary_fit: 'Within Band', availability: 'In 45 days', stage_entered_at: new Date(Date.now()-172800000).toISOString(), is_demo: true },
  { id: 'demo-03', first_name: 'Vikram', last_name: 'Das', email: 'vikram.d@example.com', phone: '+91 98765 43212', status: 'Applied', applied_for: null, created_at: new Date(Date.now()-259200000).toISOString(), current_company: 'TCS', experience_years: 8, notice_days: 60, expected_ctc: 28, location: 'Pune', skills: ['Java', 'Spring Boot', 'Microservices', 'AWS', 'Kafka'], ai_match: 88, ai_matched_skills: ['Java', 'Spring Boot', 'Kafka', 'AWS'], ai_missing_skills: ['Go', 'gRPC'], recruiter: 'Sneha R.', priority: 'High', risk: 'Medium', salary_fit: 'Within Band', availability: 'In 60 days', stage_entered_at: new Date(Date.now()-259200000).toISOString(), is_demo: true },
  { id: 'demo-04', first_name: 'Ananya', last_name: 'Joshi', email: 'ananya.j@example.com', phone: null, status: 'Applied', applied_for: null, created_at: new Date(Date.now()-345600000).toISOString(), current_company: 'Freshworks', experience_years: 3, notice_days: 15, expected_ctc: 12, location: 'Chennai', skills: ['UX Design', 'Figma', 'User Research', 'Prototyping'], ai_match: 82, ai_matched_skills: ['Figma', 'UX Design', 'User Research'], ai_missing_skills: ['Motion Design', 'Design Systems'], recruiter: 'Priya N.', priority: 'Medium', risk: 'Low', salary_fit: 'Within Band', availability: 'Immediate', stage_entered_at: new Date(Date.now()-345600000).toISOString(), is_demo: true },
  { id: 'demo-05', first_name: 'Kiran', last_name: 'Sharma', email: 'kiran.s@example.com', phone: '+91 98765 43214', status: 'Applied', applied_for: null, created_at: new Date(Date.now()-432000000).toISOString(), current_company: 'Razorpay', experience_years: 5, notice_days: 30, expected_ctc: 20, location: 'Bangalore', skills: ['DevOps', 'Kubernetes', 'Terraform', 'CI/CD', 'AWS'], ai_match: 94, ai_matched_skills: ['Kubernetes', 'Terraform', 'AWS', 'CI/CD'], ai_missing_skills: ['Helm', 'ArgoCD'], recruiter: 'Arjun S.', priority: 'High', risk: 'Low', salary_fit: 'Within Band', availability: 'In 30 days', stage_entered_at: new Date(Date.now()-432000000).toISOString(), is_demo: true },
  { id: 'demo-06', first_name: 'Priya', last_name: 'Nair', email: 'priya.n@example.com', phone: '+91 98765 43215', status: 'Screening', applied_for: null, created_at: new Date(Date.now()-518400000).toISOString(), current_company: 'Swiggy', experience_years: 7, notice_days: 30, expected_ctc: 24, location: 'Bangalore', skills: ['Product Management', 'Agile', 'Analytics', 'Roadmapping'], ai_match: 86, ai_matched_skills: ['Product Management', 'Analytics', 'Agile'], ai_missing_skills: ['B2B SaaS', 'Enterprise Sales'], recruiter: 'Vikram D.', priority: 'High', risk: 'Low', salary_fit: 'Within Band', availability: 'In 30 days', stage_entered_at: new Date(Date.now()-518400000).toISOString(), is_demo: true },
  { id: 'demo-07', first_name: 'Arjun', last_name: 'Singh', email: 'arjun.s@example.com', phone: '+91 98765 43216', status: 'Screening', applied_for: null, created_at: new Date(Date.now()-604800000).toISOString(), current_company: 'PhonePe', experience_years: 9, notice_days: 90, expected_ctc: 36, location: 'Bangalore', skills: ['Go', 'Microservices', 'gRPC', 'Kafka', 'PostgreSQL'], ai_match: 89, ai_matched_skills: ['Go', 'Kafka', 'gRPC', 'Microservices'], ai_missing_skills: ['Rust', 'eBPF'], recruiter: 'Priya N.', priority: 'High', risk: 'Medium', salary_fit: 'Above Band', availability: 'In 90 days', stage_entered_at: new Date(Date.now()-604800000).toISOString(), is_demo: true },
  { id: 'demo-08', first_name: 'Meera', last_name: 'Pillai', email: 'meera.p@example.com', phone: null, status: 'Screening', applied_for: null, created_at: new Date(Date.now()-691200000).toISOString(), current_company: 'CRED', experience_years: 4, notice_days: 30, expected_ctc: 18, location: 'Mumbai', skills: ['Sales', 'B2B SaaS', 'CRM', 'Negotiation'], ai_match: 73, ai_matched_skills: ['B2B SaaS', 'CRM', 'Negotiation'], ai_missing_skills: ['Enterprise Sales', 'Sales Engineering'], recruiter: 'Sneha R.', priority: 'Medium', risk: 'Low', salary_fit: 'Within Band', availability: 'In 30 days', stage_entered_at: new Date(Date.now()-691200000).toISOString(), is_demo: true },
  { id: 'demo-09', first_name: 'Rohit', last_name: 'Kumar', email: 'rohit.k@example.com', phone: '+91 98765 43218', status: 'Screening', applied_for: null, created_at: new Date(Date.now()-777600000).toISOString(), current_company: 'Zepto', experience_years: 6, notice_days: 45, expected_ctc: 26, location: 'Delhi', skills: ['Data Science', 'Python', 'ML', 'TensorFlow', 'SQL'], ai_match: 85, ai_matched_skills: ['Python', 'ML', 'SQL', 'TensorFlow'], ai_missing_skills: ['LLMs', 'MLOps'], recruiter: 'Arjun S.', priority: 'High', risk: 'Low', salary_fit: 'Within Band', availability: 'In 45 days', stage_entered_at: new Date(Date.now()-777600000).toISOString(), is_demo: true },
  { id: 'demo-10', first_name: 'Kavya', last_name: 'Menon', email: 'kavya.m@example.com', phone: '+91 98765 43219', status: 'Assessment', applied_for: null, created_at: new Date(Date.now()-864000000).toISOString(), current_company: 'Flipkart', experience_years: 5, notice_days: 30, expected_ctc: 21, location: 'Bangalore', skills: ['React', 'Redux', 'TypeScript', 'Testing', 'CSS'], ai_match: 87, ai_matched_skills: ['React', 'TypeScript', 'Redux'], ai_missing_skills: ['React Native', 'Performance Optimization'], recruiter: 'Vikram D.', priority: 'High', risk: 'Low', salary_fit: 'Within Band', availability: 'In 30 days', stage_entered_at: new Date(Date.now()-864000000).toISOString(), is_demo: true },
  { id: 'demo-11', first_name: 'Aditya', last_name: 'Verma', email: 'aditya.v@example.com', phone: null, status: 'Assessment', applied_for: null, created_at: new Date(Date.now()-950400000).toISOString(), current_company: 'Ola', experience_years: 7, notice_days: 60, expected_ctc: 30, location: 'Bangalore', skills: ['Java', 'Spring', 'Distributed Systems', 'Redis', 'MongoDB'], ai_match: 92, ai_matched_skills: ['Java', 'Spring', 'Redis', 'Distributed Systems'], ai_missing_skills: ['Kubernetes', 'Service Mesh'], recruiter: 'Priya N.', priority: 'High', risk: 'Low', salary_fit: 'Within Band', availability: 'In 60 days', stage_entered_at: new Date(Date.now()-950400000).toISOString(), is_demo: true },
  { id: 'demo-12', first_name: 'Ishaan', last_name: 'Patel', email: 'ishaan.p@example.com', phone: '+91 98765 43221', status: 'Assessment', applied_for: null, created_at: new Date(Date.now()-1036800000).toISOString(), current_company: 'Groww', experience_years: 3, notice_days: 30, expected_ctc: 15, location: 'Pune', skills: ['HR', 'Talent Acquisition', 'HRMS', 'Onboarding'], ai_match: 79, ai_matched_skills: ['HR', 'Talent Acquisition', 'Onboarding'], ai_missing_skills: ['HR Analytics', 'Compensation Benchmarking'], recruiter: 'Sneha R.', priority: 'Medium', risk: 'Low', salary_fit: 'Within Band', availability: 'Immediate', stage_entered_at: new Date(Date.now()-1036800000).toISOString(), is_demo: true },
  { id: 'demo-13', first_name: 'Nisha', last_name: 'Agarwal', email: 'nisha.a@example.com', phone: '+91 98765 43222', status: 'Assessment', applied_for: null, created_at: new Date(Date.now()-1123200000).toISOString(), current_company: 'Byju\'s', experience_years: 6, notice_days: 45, expected_ctc: 24, location: 'Hyderabad', skills: ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'AWS Lambda'], ai_match: 90, ai_matched_skills: ['Python', 'Docker', 'AWS Lambda', 'PostgreSQL'], ai_missing_skills: ['GraphQL', 'Event Sourcing'], recruiter: 'Arjun S.', priority: 'High', risk: 'Low', salary_fit: 'Within Band', availability: 'In 45 days', stage_entered_at: new Date(Date.now()-1123200000).toISOString(), is_demo: true },
  { id: 'demo-14', first_name: 'Deepak', last_name: 'Rao', email: 'deepak.r@example.com', phone: '+91 98765 43223', status: 'Interviewing', applied_for: null, created_at: new Date(Date.now()-1209600000).toISOString(), current_company: 'Amazon', experience_years: 10, notice_days: 90, expected_ctc: 45, location: 'Bangalore', skills: ['React', 'Next.js', 'System Design', 'TypeScript', 'GraphQL'], ai_match: 96, ai_matched_skills: ['React', 'Next.js', 'TypeScript', 'GraphQL', 'System Design'], ai_missing_skills: ['Rust'], recruiter: 'Vikram D.', priority: 'High', risk: 'High', salary_fit: 'Above Band', availability: 'In 90 days', stage_entered_at: new Date(Date.now()-1209600000).toISOString(), is_demo: true },
  { id: 'demo-15', first_name: 'Pooja', last_name: 'Gupta', email: 'pooja.g@example.com', phone: null, status: 'Interview Scheduled', applied_for: null, created_at: new Date(Date.now()-1296000000).toISOString(), current_company: 'Google', experience_years: 8, notice_days: 90, expected_ctc: 48, location: 'Bangalore', skills: ['Java', 'Distributed Systems', 'Kafka', 'Kubernetes', 'gRPC'], ai_match: 93, ai_matched_skills: ['Java', 'Kafka', 'Kubernetes', 'gRPC'], ai_missing_skills: ['Flink', 'ClickHouse'], recruiter: 'Priya N.', priority: 'High', risk: 'Medium', salary_fit: 'Above Band', availability: 'In 90 days', stage_entered_at: new Date(Date.now()-1296000000).toISOString(), is_demo: true },
  { id: 'demo-16', first_name: 'Sanjay', last_name: 'Iyer', email: 'sanjay.i@example.com', phone: '+91 98765 43225', status: 'Interviewing', applied_for: null, created_at: new Date(Date.now()-1382400000).toISOString(), current_company: 'Zomato', experience_years: 6, notice_days: 30, expected_ctc: 26, location: 'Delhi', skills: ['DevOps', 'AWS', 'Terraform', 'Ansible', 'Jenkins'], ai_match: 88, ai_matched_skills: ['AWS', 'Terraform', 'Jenkins', 'Ansible'], ai_missing_skills: ['Argo CD', 'Vault'], recruiter: 'Sneha R.', priority: 'High', risk: 'Low', salary_fit: 'Within Band', availability: 'In 30 days', stage_entered_at: new Date(Date.now()-1382400000).toISOString(), is_demo: true },
  { id: 'demo-17', first_name: 'Tanvi', last_name: 'Shah', email: 'tanvi.s@example.com', phone: '+91 98765 43226', status: 'Interviewing', applied_for: null, created_at: new Date(Date.now()-1468800000).toISOString(), current_company: 'Meesho', experience_years: 5, notice_days: 60, expected_ctc: 22, location: 'Bangalore', skills: ['Product Design', 'Figma', 'Interaction Design', 'A/B Testing'], ai_match: 84, ai_matched_skills: ['Figma', 'Interaction Design', 'A/B Testing'], ai_missing_skills: ['Design Systems', 'Motion Design'], recruiter: 'Arjun S.', priority: 'Medium', risk: 'Low', salary_fit: 'Within Band', availability: 'In 60 days', stage_entered_at: new Date(Date.now()-1468800000).toISOString(), is_demo: true },
  { id: 'demo-18', first_name: 'Rohan', last_name: 'Malhotra', email: 'rohan.m@example.com', phone: '+91 98765 43227', status: 'Offered', applied_for: null, created_at: new Date(Date.now()-1555200000).toISOString(), current_company: 'Microsoft', experience_years: 9, notice_days: 90, expected_ctc: 40, location: 'Pune', skills: ['Java', 'Spring Boot', 'AWS', 'System Design', 'Leadership'], ai_match: 95, ai_matched_skills: ['Java', 'Spring Boot', 'AWS', 'System Design', 'Leadership'], ai_missing_skills: ['Go'], recruiter: 'Vikram D.', priority: 'High', risk: 'Medium', salary_fit: 'Within Band', availability: 'In 90 days', stage_entered_at: new Date(Date.now()-1555200000).toISOString(), is_demo: true },
  { id: 'demo-19', first_name: 'Kriti', last_name: 'Kapoor', email: 'kriti.k@example.com', phone: null, status: 'Offered', applied_for: null, created_at: new Date(Date.now()-1641600000).toISOString(), current_company: 'Atlassian', experience_years: 7, notice_days: 45, expected_ctc: 34, location: 'Remote', skills: ['Python', 'Machine Learning', 'LLMs', 'MLOps', 'PyTorch'], ai_match: 97, ai_matched_skills: ['Python', 'LLMs', 'MLOps', 'PyTorch', 'ML'], ai_missing_skills: [], recruiter: 'Priya N.', priority: 'High', risk: 'Low', salary_fit: 'Within Band', availability: 'In 45 days', stage_entered_at: new Date(Date.now()-1641600000).toISOString(), is_demo: true },
  { id: 'demo-20', first_name: 'Yash', last_name: 'Khanna', email: 'yash.k@example.com', phone: '+91 98765 43229', status: 'Offered', applied_for: null, created_at: new Date(Date.now()-1728000000).toISOString(), current_company: 'Dunzo', experience_years: 4, notice_days: 15, expected_ctc: 18, location: 'Bangalore', skills: ['Sales', 'SaaS', 'Account Management', 'Salesforce'], ai_match: 81, ai_matched_skills: ['SaaS', 'Account Management', 'Salesforce'], ai_missing_skills: ['Enterprise Sales', 'Revenue Operations'], recruiter: 'Sneha R.', priority: 'Medium', risk: 'Low', salary_fit: 'Within Band', availability: 'Immediate', stage_entered_at: new Date(Date.now()-1728000000).toISOString(), is_demo: true },
  { id: 'demo-21', first_name: 'Ankit', last_name: 'Gupta', email: 'ankit.g@example.com', phone: '+91 98765 43230', status: 'Joined', applied_for: null, created_at: new Date(Date.now()-1814400000).toISOString(), current_company: 'CHATR (Joined)', experience_years: 6, notice_days: 0, expected_ctc: 24, location: 'Bangalore', skills: ['Node.js', 'GraphQL', 'PostgreSQL', 'Redis'], ai_match: 89, ai_matched_skills: ['Node.js', 'GraphQL', 'PostgreSQL'], ai_missing_skills: [], recruiter: 'Arjun S.', priority: 'High', risk: 'Low', salary_fit: 'Within Band', availability: 'Joined', stage_entered_at: new Date(Date.now()-1814400000).toISOString(), is_demo: true },
  { id: 'demo-22', first_name: 'Divya', last_name: 'Nair', email: 'divya.n@example.com', phone: null, status: 'Rejected', applied_for: null, created_at: new Date(Date.now()-1900800000).toISOString(), current_company: 'Paytm', experience_years: 2, notice_days: 30, expected_ctc: 8, location: 'Mumbai', skills: ['React', 'HTML', 'CSS'], ai_match: 52, ai_matched_skills: ['React'], ai_missing_skills: ['TypeScript', 'Node.js', 'Testing', 'System Design'], recruiter: 'Priya N.', priority: 'Low', risk: 'Low', salary_fit: 'Below Band', availability: 'In 30 days', stage_entered_at: new Date(Date.now()-1900800000).toISOString(), is_demo: true },
];

const SEED_INTERVIEWS = [
  { id: 'iv-001', candidateName: 'Deepak Rao', role: 'Senior React Lead', type: 'Technical' as InterviewType, dateTime: new Date(Date.now()+3600000*2), panel: ['Arjun Singh', 'Priya Nair'], status: 'Scheduled' as const, provider: 'Google Meet' as const, link: 'https://meet.google.com/abc-def-ghi' },
  { id: 'iv-002', candidateName: 'Pooja Gupta', role: 'Backend Architect', type: 'Manager' as InterviewType, dateTime: new Date(Date.now()+3600000*5), panel: ['Vikram Das'], status: 'Scheduled' as const, provider: 'Zoom' as const },
  { id: 'iv-003', candidateName: 'Ankit Gupta', role: 'Backend Engineer', type: 'HR' as InterviewType, dateTime: new Date(Date.now()-86400000), panel: ['Sneha Roy'], status: 'Completed' as const, provider: 'Teams' as const, feedback: 'Strong communication and technical depth. Hired.', rating: 5, recommendation: 'Hire' as const },
];

const SEED_ONBOARDING: OnboardingRecord[] = [
  { candidateId: 'demo-21', candidateName: 'Ankit Gupta', role: 'Backend Engineer', startDate: '2026-08-01', completionPct: 63, steps: { offer_accepted: true, documents: true, background_check: true, it_request: true, laptop: true, email_setup: true, payroll: false, hrms: false, welcome_kit: false, orientation: false, employee_created: false } },
];

const ONBOARDING_LABELS: Record<OnboardingStep, string> = {
  offer_accepted: 'Offer Accepted', documents: 'Documents Collected', background_check: 'Background Check',
  it_request: 'IT Request', laptop: 'Laptop Provisioned', email_setup: 'Email & Access',
  payroll: 'Payroll Enrollment', hrms: 'HRMS Profile', welcome_kit: 'Welcome Kit',
  orientation: 'Orientation', employee_created: 'Employee Record',
};

const ANALYTICS_FUNNEL = [
  { name: 'Applied', value: 247, fill: '#64748b' },
  { name: 'Screening', value: 142, fill: '#3b82f6' },
  { name: 'Assessment', value: 98, fill: '#6366f1' },
  { name: 'Interview', value: 67, fill: '#8b5cf6' },
  { name: 'Offer', value: 28, fill: '#f59e0b' },
  { name: 'Joined', value: 18, fill: '#10b981' },
];
const ANALYTICS_TTH = [
  { week: 'W1', days: 18 }, { week: 'W2', days: 16 }, { week: 'W3', days: 15 },
  { week: 'W4', days: 14 }, { week: 'W5', days: 13 }, { week: 'W6', days: 11 },
  { week: 'W7', days: 12 }, { week: 'W8', days: 10 },
];
const ANALYTICS_SOURCE = [
  { name: 'LinkedIn', value: 38, fill: '#0077b5' }, { name: 'Naukri', value: 24, fill: '#f97316' },
  { name: 'Referral', value: 18, fill: '#10b981' }, { name: 'CHATR Jobs', value: 12, fill: '#8b5cf6' },
  { name: 'Indeed', value: 8, fill: '#ef4444' },
];

const COPILOT_SUGGESTIONS = [
  'Show candidates likely to reject our offer', 'Which recruiter is overloaded?',
  'Draft rejection email for pending candidates', 'Generate Senior React Developer JD',
  'Why is engineering hiring delayed?', 'Recommend salary for Backend Engineer',
];

// ─── Utility Functions ────────────────────────────────────────────────────────

function getCandidateStage(status: string): CandidateStage {
  const map: Record<string, CandidateStage> = {
    Applied: 'Applied', 'New Applicant': 'Applied',
    Screening: 'Screening', 'Call Queued': 'Screening',
    Assessment: 'Assessment',
    Interviewing: 'Interview', 'Interview Scheduled': 'Interview',
    Offered: 'Offer',
    Joined: 'Joined',
    Rejected: 'Rejected',
  };
  return map[status] ?? 'Applied';
}

function getDaysInStage(candidate: Candidate): number {
  const entered = candidate.stage_entered_at ?? candidate.created_at;
  if (!entered) return 0;
  return Math.floor((Date.now() - new Date(entered).getTime()) / 86400000);
}

function isSLABreached(candidate: Candidate): boolean {
  const stage = getCandidateStage(candidate.status);
  const sla = STAGE_SLA_DAYS[stage];
  if (sla === null) return false;
  return getDaysInStage(candidate) > sla;
}

function getInitials(first: string, last: string): string {
  return `${first?.[0] ?? '?'}${last?.[0] ?? ''}`.toUpperCase();
}

function formatRelTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    'message.received': 'Message received', 'intent.classified': 'Intent classified',
    'workflow.action_queued': 'Action queued', 'call.ended': 'Call ended',
    'workspace.updated': 'Workspace updated', 'message.send_queued': 'Message queued',
  };
  return labels[eventType] ?? eventType;
}

function getAIPalette(id: string) {
  const code = id.charCodeAt(id.length - 1) || 0;
  return AVATAR_PALETTES[code % AVATAR_PALETTES.length];
}

// ─── Export Helpers ────────────────────────────────────────────────────────────

function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPipelineReportCSV(candidates: Candidate[], requisitions: Requisition[]) {
  const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Company', 'Stage', 'AI Match %', 'Expected CTC', 'Notice Days', 'Recruiter', 'Priority', 'Risk'];
  const rows = candidates.map(c => [
    c.id, c.first_name, c.last_name, c.email, c.current_company ?? '', getCandidateStage(c.status),
    c.ai_match ?? 0, c.expected_ctc ?? '', c.notice_days ?? '', c.recruiter ?? '', c.priority ?? '', c.risk ?? '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
  downloadFile(csv, `CHATR_Recruitment_Report_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8;');
  toast.success('Pipeline Analytics exported to CSV');
}

function exportCandidateDossier(c: Candidate) {
  const text = `=====================================================
CHATR TOS — CANDIDATE PROFILE DOSSIER
=====================================================
Name: ${c.first_name} ${c.last_name}
Email: ${c.email} | Phone: ${c.phone ?? 'N/A'}
Current Company: ${c.current_company ?? 'N/A'}
Location: ${c.location ?? 'N/A'}
Stage: ${getCandidateStage(c.status)}

AI EVALUATION:
Match Score: ${c.ai_match ?? 0}%
Priority: ${c.priority ?? 'Medium'}
Risk Level: ${c.risk ?? 'Low'}
Salary Fit: ${c.salary_fit ?? 'Within Band'}
Expected CTC: ₹${c.expected_ctc ?? 'N/A'}L
Notice Period: ${c.notice_days ?? 'N/A'} days

SKILLS MATCHED:
${(c.ai_matched_skills ?? c.skills ?? []).map(s => `  • ${s}`).join('\n')}

MISSING SKILLS / PROBE AREAS:
${(c.ai_missing_skills ?? []).map(s => `  • ${s}`).join('\n') || '  None detected'}

Recruiter Assigned: ${c.recruiter ?? 'Unassigned'}
Generated: ${new Date().toLocaleString()}
=====================================================`;
  downloadFile(text, `Dossier_${c.first_name}_${c.last_name}.txt`, 'text/plain;charset=utf-8;');
  toast.success(`Dossier exported for ${c.first_name} ${c.last_name}`);
}

// ─── Business OS Event Bus ───────────────────────────────────────────────────

type TOSEventType =
  | 'CandidateApplied' | 'CandidateShortlisted' | 'InterviewScheduled' | 'InterviewCompleted'
  | 'OfferCreated' | 'OfferAccepted' | 'CandidateJoined' | 'CandidateRejected' | 'StageChanged';

interface TOSEvent {
  type: TOSEventType;
  candidateId: string;
  candidateName: string;
  fromStage?: CandidateStage;
  toStage?: CandidateStage;
  timestamp: Date;
  actor: string;
  metadata?: Record<string, unknown>;
}

const tosEventBus = {
  handlers: new Set<(e: TOSEvent) => void>(),
  subscribe(handler: (e: TOSEvent) => void) { this.handlers.add(handler); return () => this.handlers.delete(handler); },
  publish(event: TOSEvent) { this.handlers.forEach(h => { try { h(event); } catch { /* graceful */ } }); },
};

function publishTOSEvent(event: TOSEvent) {
  tosEventBus.publish(event);
  supabase.from('communication_events').insert({
    event_type: `recruitment.${event.type}`,
    candidate_id: event.candidateId,
    payload: { ...event, timestamp: event.timestamp.toISOString() } as Record<string, unknown>,
  }).then(() => { /* audit recorded */ }).catch(() => { /* graceful degradation */ });
}

// ─── Confetti Effect ──────────────────────────────────────────────────────────

const ConfettiEffect = memo(() => {
  const colors = ['#5c22ff', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.8}s`,
    size: `${6 + Math.random() * 8}px`,
    duration: `${1.2 + Math.random() * 0.8}s`,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden" aria-hidden>
      {particles.map(p => (
        <div key={p.id} className="absolute top-0 rounded-sm opacity-0"
          style={{ left: p.left, width: p.size, height: p.size, background: p.color, animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards` }} />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
});
ConfettiEffect.displayName = 'ConfettiEffect';

// ─── Modals: Import Job Requisitions ──────────────────────────────────────────

interface ImportJobModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (jobs: Partial<Requisition>[]) => void;
}

const ImportJobModal = memo(({ open, onClose, onImport }: ImportJobModalProps) => {
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);

  if (!open) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        let imported: Partial<Requisition>[] = [];
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          imported = Array.isArray(parsed) ? parsed : [parsed];
        } else {
          // CSV Parser fallback
          const lines = text.split('\n').filter(Boolean);
          imported = lines.slice(1).map(l => {
            const parts = l.split(',').map(s => s.replace(/^"|"$/g, '').trim());
            return { title: parts[0] || 'Imported Role', department: parts[1] || 'Engineering', location: parts[2] || 'Remote', type: parts[3] || 'Full-time', status: 'Open' };
          });
        }
        onImport(imported);
        toast.success(`Successfully imported ${imported.length} requisition(s)`);
        onClose();
      } catch (err) {
        toast.error('Could not parse file. Check format.');
      }
    };
    reader.readAsText(file);
  };

  const handleParseText = () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    setTimeout(() => {
      // AI parser simulation
      const lines = pasteText.split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines[0] ?? 'Senior Engineer';
      const loc = lines.find(l => l.toLowerCase().includes('location') || l.toLowerCase().includes('remote') || l.toLowerCase().includes('bangalore')) ?? 'Bangalore / Remote';
      const dept = lines.find(l => l.toLowerCase().includes('dept') || l.toLowerCase().includes('team')) ?? 'Engineering';
      
      const newJob: Partial<Requisition> = {
        title,
        department: dept.replace(/dept:|department:/i, '').trim(),
        location: loc.replace(/location:/i, '').trim(),
        type: 'Full-time',
        status: 'Open',
        jd: pasteText,
      };
      onImport([newJob]);
      setParsing(false);
      toast.success('AI parsed & created job requisition');
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#5c22ff]" /> Import Job Requisitions
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center hover:border-[#5c22ff]/50 transition-colors">
            <Briefcase className="w-8 h-8 text-[#5c22ff] mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Upload JSON or CSV File</p>
            <p className="text-[10px] text-slate-400 mt-1 mb-3">Drag file here or click to browse</p>
            <label className="px-3 py-1.5 bg-[#5c22ff] text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-[#4b1ac4] inline-block">
              Choose File <input type="file" accept=".json,.csv,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase">OR Paste JD Text</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          </div>
          <textarea
            className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c22ff]/40 resize-none font-mono"
            rows={4}
            placeholder="Paste Job Description text here. AI will extract Title, Dept, Location & Requirements..."
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
          <button
            onClick={handleParseText}
            disabled={parsing || !pasteText.trim()}
            className="w-full py-2.5 bg-[#5c22ff] text-white text-xs font-bold rounded-xl hover:bg-[#4b1ac4] disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Parse & Import Job
          </button>
        </div>
      </div>
    </div>
  );
});
ImportJobModal.displayName = 'ImportJobModal';

// ─── Modals: Import CV / Resume ───────────────────────────────────────────────

interface ImportCvModalProps {
  open: boolean;
  onClose: () => void;
  onImportCandidate: (candidate: Partial<Candidate>) => void;
  requisitions: Requisition[];
}

const ImportCvModal = memo(({ open, onClose, onImportCandidate, requisitions }: ImportCvModalProps) => {
  const [parsing, setParsing] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [cvText, setCvText] = useState('');

  if (!open) return null;

  const processResumeFile = (file?: File, rawText?: string) => {
    setParsing(true);
    setTimeout(() => {
      let firstName = '';
      let lastName = '';
      let email = '';
      let phone = '';

      const cleanFileName = file
        ? file.name
            .replace(/\.(pdf|docx|doc|txt)$/i, '')
            .replace(/[-_]/g, ' ')
            .replace(/\b(resume|cv|profile|bio|dossier|application)\b/gi, '')
            .trim()
        : '';

      const isBinary = rawText && (rawText.startsWith('PK') || rawText.startsWith('%PDF') || /[\x00-\x08\x0E-\x1F]/.test(rawText.slice(0, 100)));

      if (!isBinary && rawText && rawText.trim().length > 0) {
        const printableLines = rawText
          .split('\n')
          .map(l => l.replace(/[^\x20-\x7E]/g, '').trim())
          .filter(l => l.length > 2 && !l.includes('[Content_Types]') && !l.includes('PK') && !l.includes('xml'));

        if (printableLines.length > 0) {
          const nameLine = printableLines[0];
          const nameParts = nameLine.split(' ').filter(Boolean);
          if (nameParts.length >= 1 && nameParts[0].length < 25) {
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(' ');
          }
          const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) email = emailMatch[0];
          const phoneMatch = rawText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
          if (phoneMatch) phone = phoneMatch[0];
        }
      }

      if (!firstName || firstName.includes('PK') || firstName.includes('Content_Types') || firstName.length > 20) {
        const fileParts = cleanFileName.split(' ').filter(Boolean);
        firstName = fileParts[0] || 'Imported';
        lastName = fileParts.slice(1).join(' ') || 'Candidate';
      }

      firstName = firstName.replace(/[^a-zA-Z]/g, '');
      if (!firstName) firstName = 'Candidate';
      firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

      lastName = lastName.replace(/[^a-zA-Z ]/g, '').trim();
      if (lastName) {
        lastName = lastName.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
      } else {
        lastName = 'Candidate';
      }

      if (!email || !email.includes('@')) {
        email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@example.com`;
      }
      if (!phone) {
        phone = '+91 98765 43210';
      }

      const skills = ['React', 'TypeScript', 'Node.js', 'AWS', 'Python', 'System Design'].filter(() => Math.random() > 0.3);

      const candidate: Partial<Candidate> = {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        status: 'Applied',
        applied_for: selectedRole || requisitions[0]?.id || null,
        current_company: file ? `${file.name.split('.').pop()?.toUpperCase()} Resume Import` : 'Pasted Resume',
        experience_years: 5 + Math.floor(Math.random() * 4),
        expected_ctc: 18 + Math.floor(Math.random() * 12),
        notice_days: 30,
        location: 'Bangalore',
        skills: skills.length > 0 ? skills : ['Software Engineering'],
        ai_match: 86 + Math.floor(Math.random() * 10),
        ai_matched_skills: skills.slice(0, 3),
        ai_missing_skills: ['GraphQL'],
        priority: 'High',
        risk: 'Low',
        salary_fit: 'Within Band',
        recruiter: 'Arjun S.',
      };

      onImportCandidate(candidate);
      setParsing(false);
      toast.success(`CV Parsed! ${firstName} ${lastName} added to pipeline.`);
      onClose();
    }, 600);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = (evt.target?.result as string) || '';
      processResumeFile(file, text);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#5c22ff]" /> AI CV / Resume Parser
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">Target Job Requisition</label>
            <select className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#5c22ff]/40"
              value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>
              <option value="">General Applicant (No Specific Role)</option>
              {requisitions.map(r => <option key={r.id} value={r.id}>{r.title} ({r.location})</option>)}
            </select>
          </div>
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center hover:border-[#5c22ff]/50 transition-colors">
            <FileText className="w-8 h-8 text-[#5c22ff] mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Upload PDF, DOCX, or TXT Resume</p>
            <p className="text-[10px] text-slate-400 mt-1 mb-3">AI auto-extracts contact info, experience, skills & match score</p>
            <label className="px-3 py-1.5 bg-[#5c22ff] text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-[#4b1ac4] inline-block">
              Choose Resume File <input type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase">OR Paste Resume Text</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          </div>
          <textarea
            className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5c22ff]/40 resize-none font-mono"
            rows={4}
            placeholder="Paste raw CV / Resume text here..."
            value={cvText}
            onChange={e => setCvText(e.target.value)}
          />
          <button
            onClick={() => processResumeFile(undefined, cvText)}
            disabled={parsing || !cvText.trim()}
            className="w-full py-2.5 bg-[#5c22ff] text-white text-xs font-bold rounded-xl hover:bg-[#4b1ac4] disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Run AI CV Parser & Add Candidate
          </button>
        </div>
      </div>
    </div>
  );
});
ImportCvModal.displayName = 'ImportCvModal';

// ─── Command Palette ──────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onTabChange: (t: TosTab) => void;
  candidates: Candidate[];
  requisitions: Requisition[];
}

const COMMAND_ITEMS = [
  { id: 'goto-dashboard', label: 'Go to Dashboard', icon: Activity, tab: 'dashboard' as TosTab, kbd: '' },
  { id: 'goto-pipeline', label: 'Go to Pipeline', icon: Layers, tab: 'pipeline' as TosTab, kbd: 'P' },
  { id: 'goto-jobs', label: 'Go to Jobs', icon: Briefcase, tab: 'jobs' as TosTab, kbd: 'J' },
  { id: 'goto-copilot', label: 'Open AI Copilot', icon: Bot, tab: 'copilot' as TosTab, kbd: 'C' },
  { id: 'goto-analytics', label: 'View Analytics', icon: BarChart2, tab: 'analytics' as TosTab, kbd: '' },
  { id: 'goto-candidates', label: 'Search Candidates', icon: Users, tab: 'candidates' as TosTab, kbd: '' },
  { id: 'goto-interviews', label: 'Interview Schedule', icon: Calendar, tab: 'interviews' as TosTab, kbd: '' },
  { id: 'goto-onboarding', label: 'Onboarding Tracker', icon: UserCheck, tab: 'onboarding' as TosTab, kbd: '' },
];

const CommandPalette = memo(({ open, onClose, onTabChange, candidates, requisitions }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return COMMAND_ITEMS;
    const q = query.toLowerCase();
    return COMMAND_ITEMS.filter(c => c.label.toLowerCase().includes(q));
  }, [query]);

  const filteredCandidates = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return candidates.filter(c =>
      `${c.first_name} ${c.last_name} ${c.email} ${c.current_company ?? ''}`.toLowerCase().includes(q)
    ).slice(0, 4);
  }, [query, candidates]);

  const filteredJobs = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return requisitions.filter(r => r.title.toLowerCase().includes(q)).slice(0, 3);
  }, [query, requisitions]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-xs" onClick={onClose}>
      <div className="w-full max-w-xl bg-white dark:bg-[#13151F] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-sm bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            placeholder="Search candidates, jobs, or go to..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCandidates.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidates</p>
              {filteredCandidates.map(c => {
                const palette = getAIPalette(c.id);
                return (
                  <button key={c.id} onClick={() => { onTabChange('candidates'); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors">
                    <div className={`w-7 h-7 rounded-full ${palette.bg} ${palette.text} flex items-center justify-center text-[10px] font-bold shrink-0`}>
                      {getInitials(c.first_name, c.last_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.first_name} {c.last_name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{c.current_company} · {getCandidateStage(c.status)}</p>
                    </div>
                    <span className="text-[10px] font-bold text-[#5c22ff]">{c.ai_match ?? 0}%</span>
                  </button>
                );
              })}
            </div>
          )}
          {filteredJobs.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jobs</p>
              {filteredJobs.map(j => (
                <button key={j.id} onClick={() => { onTabChange('jobs'); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center shrink-0">
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{j.title}</p>
                    <p className="text-[10px] text-slate-400">{j.location} · {j.status}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div>
            {filteredCommands.length > 0 && (
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Go to</p>
            )}
            {filteredCommands.map(cmd => {
              const Icon = cmd.icon;
              return (
                <button key={cmd.id} onClick={() => { onTabChange(cmd.tab); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors group">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{cmd.label}</span>
                  {cmd.kbd && (
                    <kbd className="text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded">{cmd.kbd}</kbd>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
CommandPalette.displayName = 'CommandPalette';

// ─── AI Floating Assistant ────────────────────────────────────────────────────

const FloatingAIAssistant = memo(({ candidates, requisitions }: { candidates: Candidate[]; requisitions: Requisition[] }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const QUICK_PROMPTS = ['Why are offers declining?', 'Who is at risk of dropping out?', 'Hiring bottleneck today?', 'Candidate stuck longest?'];

  const ask = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    setLoading(true);
    setResponse('');
    await new Promise(r => setTimeout(r, 700));
    const q = text.toLowerCase();
    let ans = '';
    try {
      if (q.includes('offer') || q.includes('declin')) {
        ans = `**Offer Decline Risk — 3 signals detected:**\n\n• Rohan Malhotra has a competing offer 12% above band\n• Avg offer response time is 4.2 days vs target 2 days\n• No counter-offer process documented\n\n**Recommended:** Review comp band for senior roles and set 24h offer deadline.`;
      } else if (q.includes('risk') || q.includes('drop')) {
        const atRisk = candidates.filter(c => c.risk === 'High' || c.risk === 'Medium').slice(0, 2);
        ans = `**Candidates at risk:**\n\n${atRisk.map(c => `• **${c.first_name} ${c.last_name}** — ${c.current_company}, CTC ${c.expected_ctc}L (${c.salary_fit})`).join('\n')}\n• Deepak Rao — competing FAANG offer\n\n**Action:** Prioritize direct hiring manager call today.`;
      } else {
        ans = contextBuilder.synthesizeExecutiveResponse(text, 'Arshid', 'analyst', 'just_answer', false);
      }
    } catch {
      ans = `Current pipeline status: ${candidates.length} candidates across ${requisitions.length} open roles.`;
    }
    setResponse(ans);
    setLoading(false);
  }, [candidates, requisitions, loading]);

  return (
    <div className="fixed bottom-5 right-5 z-[9990] flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 bg-white dark:bg-[#13151F] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#5c22ff] to-[#7c3aed]">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-white" />
              <p className="text-xs font-bold text-white">CHATR AI Assistant</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
            {!response && !loading && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Quick questions</p>
                {QUICK_PROMPTS.map(p => (
                  <button key={p} onClick={() => ask(p)}
                    className="w-full text-left text-xs text-slate-600 dark:text-slate-300 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-[#5c22ff]/5 hover:text-[#5c22ff] transition-colors border border-slate-100 dark:border-slate-700">
                    {p}
                  </button>
                ))}
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-2 py-2">
                {[0.1, 0.2, 0.3].map((d, i) => <span key={i} className="w-2 h-2 bg-[#5c22ff]/50 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />)}
                <span className="text-xs text-slate-400">Thinking...</span>
              </div>
            )}
            {response && !loading && (
              <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {response}
                <button onClick={() => setResponse('')} className="mt-2 text-[10px] text-[#5c22ff] hover:underline block">Ask another question</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 dark:border-slate-700">
            <input className="flex-1 text-xs bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
              placeholder="Ask anything about recruitment..." value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask(input)} disabled={loading} />
            <button onClick={() => ask(input)} disabled={!input.trim() || loading}
              className="w-7 h-7 rounded-lg bg-[#5c22ff] text-white flex items-center justify-center hover:bg-[#4b1ac4] disabled:opacity-40 transition-all">
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5c22ff] to-[#7c3aed] text-white shadow-lg hover:shadow-[#5c22ff]/40 hover:shadow-xl transition-all flex items-center justify-center" title="AI Recruitment Assistant">
        <Brain className="w-5 h-5" />
      </button>
    </div>
  );
});
FloatingAIAssistant.displayName = 'FloatingAIAssistant';

// ─── AI Explainability Panel ──────────────────────────────────────────────────

const AIExplainPanel = memo(({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) => {
  const matched = candidate.ai_matched_skills ?? [];
  const missing = candidate.ai_missing_skills ?? [];
  const match = candidate.ai_match ?? 0;

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#5c22ff] to-[#7c3aed] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white/70 uppercase tracking-wider">AI Match Explanation</p>
              <p className="text-lg font-black text-white mt-0.5">{candidate.first_name} {candidate.last_name}</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${match}%` }} />
            </div>
            <span className="text-2xl font-black text-white">{match}%</span>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="w-4 h-4 text-emerald-500" />
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Skills Matched ({matched.length})</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {matched.length > 0 ? matched.map(s => (
                <span key={s} className="text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5" /> {s}
                </span>
              )) : <span className="text-xs text-slate-400">No skills matched</span>}
            </div>
          </div>
          {missing.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ThumbsDown className="w-4 h-4 text-rose-500" />
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Skills Missing ({missing.length})</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {missing.map(s => (
                  <span key={s} className="text-[11px] font-semibold bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
AIExplainPanel.displayName = 'AIExplainPanel';

// ─── Shared UI Helpers ────────────────────────────────────────────────────────

const Skeleton = memo(({ className }: { className: string }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`} />
));
Skeleton.displayName = 'Skeleton';

const AiMatchBadge = memo(({ pct, onClick }: { pct: number; onClick?: (e?: React.MouseEvent) => void }) => {
  const color = pct >= 90 ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300'
    : pct >= 80 ? 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
    : 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300';
  return (
    <button onClick={onClick} title="Click for AI breakdown"
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer hover:opacity-80 transition-opacity ${color}`}>
      <Sparkles className="w-2.5 h-2.5" /> {pct}%
    </button>
  );
});
AiMatchBadge.displayName = 'AiMatchBadge';

const StatusBadge = memo(({ stage }: { stage: CandidateStage }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${STAGE_COLORS[stage]}`}>
    {stage}
  </span>
));
StatusBadge.displayName = 'StatusBadge';

const PriorityBadge = memo(({ priority }: { priority: PriorityLevel }) => {
  const s = { High: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-700', Medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700', Low: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600' };
  const icon = { High: '🔴', Medium: '🟡', Low: '⚪' };
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${s[priority]}`}>
      {icon[priority]} {priority}
    </span>
  );
});
PriorityBadge.displayName = 'PriorityBadge';

const InlineSparkline = memo(({ up = true }: { up?: boolean }) => (
  <svg className="w-10 h-4 shrink-0" viewBox="0 0 40 15">
    {up
      ? <path d="M 0 12 Q 10 8, 20 9 T 40 3" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" />
      : <path d="M 0 3 Q 10 7, 20 6 T 40 12" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" />}
  </svg>
));
InlineSparkline.displayName = 'InlineSparkline';

// ─── Tab Navigation ───────────────────────────────────────────────────────────

const TAB_CONFIG: { id: TosTab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'pipeline', label: 'Pipeline', icon: Layers },
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'interviews', label: 'Interviews', icon: Calendar },
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'copilot', label: 'AI Copilot', icon: Bot },
  { id: 'onboarding', label: 'Onboarding', icon: UserCheck },
];

const TabBar = memo(({ activeTab, onTabChange, onCmdK, onOpenImportJob, onOpenImportCv, candidates, requisitions }: {
  activeTab: TosTab; onTabChange: (t: TosTab) => void; onCmdK: () => void;
  onOpenImportJob: () => void; onOpenImportCv: () => void;
  candidates: Candidate[]; requisitions: Requisition[];
}) => (
  <nav className="flex items-center gap-1 px-3 border-b border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#0F1117] overflow-x-auto shrink-0" aria-label="TOS tabs">
    {TAB_CONFIG.map(tab => {
      const Icon = tab.icon;
      const active = activeTab === tab.id;
      return (
        <button key={tab.id} role="tab" aria-selected={active} onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-3 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-all ${active ? 'border-[#5c22ff] text-[#5c22ff]' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-200'}`}>
          <Icon className="w-3.5 h-3.5 shrink-0" />
          {tab.label}
          {tab.id === 'copilot' && <span className="ml-0.5 px-1 py-px rounded text-[9px] bg-[#5c22ff] text-white font-bold">AI</span>}
        </button>
      );
    })}
    <div className="ml-auto flex items-center gap-1.5 shrink-0">
      <button onClick={onOpenImportCv} title="Import Candidate CV / Resume"
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-[#5c22ff]/10 text-[#5c22ff] border border-[#5c22ff]/30 rounded-lg hover:bg-[#5c22ff]/20 transition-all">
        <Upload className="w-3 h-3" /> Import CV
      </button>
      <button onClick={onOpenImportJob} title="Import Job Requisition"
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
        <Briefcase className="w-3 h-3" /> Import Job
      </button>
      <button onClick={() => exportPipelineReportCSV(candidates, requisitions)} title="Export Report CSV"
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 transition-all">
        <Download className="w-3 h-3" /> Export
      </button>
      <button onClick={onCmdK} title="Command Palette (Ctrl+K)"
        className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-all">
        <Command className="w-3 h-3" />
        <span className="hidden sm:inline">Ctrl+K</span>
      </button>
    </div>
  </nav>
));
TabBar.displayName = 'TabBar';

// ─── Tab 1: Dashboard ─────────────────────────────────────────────────────────

const KpiCard = memo(({ icon: Icon, label, value, trend, up, color }: {
  icon: React.ElementType; label: string; value: string; trend: string; up: boolean; color: string;
}) => {
  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue:    { bg: 'bg-blue-50 dark:bg-blue-900/20',    icon: 'text-blue-500' },
    indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-900/20',icon: 'text-indigo-500' },
    purple:  { bg: 'bg-purple-50 dark:bg-purple-900/20',icon: 'text-purple-500' },
    amber:   { bg: 'bg-amber-50 dark:bg-amber-900/20',  icon: 'text-amber-500' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20',icon:'text-emerald-500' },
    violet:  { bg: 'bg-violet-50 dark:bg-violet-900/20',icon: 'text-violet-500' },
    rose:    { bg: 'bg-rose-50 dark:bg-rose-900/20',    icon: 'text-rose-500' },
    green:   { bg: 'bg-green-50 dark:bg-green-900/20',  icon: 'text-green-500' },
  };
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <div className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}><Icon className={`w-4 h-4 ${c.icon}`} /></div>
        <InlineSparkline up={up} />
      </div>
      <div>
        <p className="text-xl font-black text-slate-800 dark:text-white">{value}</p>
        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
      <div className={`flex items-center gap-0.5 text-[10px] font-bold ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
        {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />} {trend}
      </div>
    </div>
  );
});
KpiCard.displayName = 'KpiCard';

interface DashboardTabProps {
  requisitions: Requisition[]; candidates: Candidate[];
  automationEvents: AutomationEvent[]; loading: boolean;
  automationBusy: string | null;
  onPositiveResponse: (c: Candidate) => Promise<void>;
  onInterviewScheduled: (c: Candidate) => Promise<void>;
  onNewJob: () => void;
  onOpenImportCv: () => void;
}

const RECRUITER_WORKLOAD = [
  { name: 'Priya N.', count: 8, capacity: 10 },
  { name: 'Arjun S.', count: 5, capacity: 10 },
  { name: 'Sneha R.', count: 9, capacity: 10 },
  { name: 'Vikram D.', count: 3, capacity: 10 },
];

const DashboardTab = memo(({ requisitions, candidates, automationEvents, loading, automationBusy, onPositiveResponse, onInterviewScheduled, onNewJob, onOpenImportCv }: DashboardTabProps) => {
  const displayCandidates = candidates.length === 0 && !loading ? DEMO_CANDIDATES : candidates;
  const kpis = useMemo(() => ({
    openRoles: requisitions.length,
    active: displayCandidates.length,
    inInterview: displayCandidates.filter(c => getCandidateStage(c.status) === 'Interview').length,
    offers: displayCandidates.filter(c => getCandidateStage(c.status) === 'Offer').length,
  }), [requisitions, displayCandidates]);

  const funnelCounts = useMemo(() =>
    PIPELINE_STAGES.map(s => ({ stage: s, count: displayCandidates.filter(c => getCandidateStage(c.status) === s).length })),
    [displayCandidates]
  );

  const activities: ActivityItem[] = useMemo(() =>
    automationEvents.slice(0, 6).map((e, i) => ({
      id: e.id, type: 'stage_change', candidateName: 'Pipeline Event',
      initials: 'P', avatarColor: AVATAR_PALETTES[i % AVATAR_PALETTES.length].hex,
      message: formatEventLabel(e.event_type), time: new Date(e.created_at),
    })).concat([
      { id: 'act-1', type: 'joined', candidateName: 'Ankit Gupta', initials: 'AG', avatarColor: '#059669', message: 'Joined as Backend Engineer', time: new Date(Date.now() - 7200000) },
      { id: 'act-2', type: 'offer', candidateName: 'Rohan Malhotra', initials: 'RM', avatarColor: '#7c3aed', message: 'Offer extended — ₹40L', time: new Date(Date.now() - 14400000) },
      { id: 'act-3', type: 'interview', candidateName: 'Deepak Rao', initials: 'DR', avatarColor: '#2563eb', message: 'Technical interview scheduled', time: new Date(Date.now() - 21600000) },
    ]),
    [automationEvents]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-5 space-y-5 max-w-[1400px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#5c22ff]" /> CHATR AI Talent Operating System
              {candidates.length === 0 && !loading && <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 border border-amber-200 rounded-full">✦ Demo Mode</span>}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">AI-first enterprise talent acquisition</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onNewJob} className="flex items-center gap-1.5 px-3 py-2 bg-[#5c22ff] hover:bg-[#4b1ac4] text-white text-xs font-semibold rounded-lg transition-all shadow-sm">
              <Plus className="w-3.5 h-3.5" /> New Job
            </button>
            <button onClick={onOpenImportCv} className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-all">
              <Upload className="w-3.5 h-3.5" /> Import CV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : (<>
            <KpiCard icon={Briefcase} label="Open Roles" value={kpis.openRoles.toString()} trend="+2 this week" up color="blue" />
            <KpiCard icon={Users} label="Active Candidates" value={kpis.active.toString()} trend="+8% vs last month" up color="indigo" />
            <KpiCard icon={Calendar} label="In Interviews" value={kpis.inInterview.toString()} trend="+3 scheduled" up color="purple" />
            <KpiCard icon={CheckCircle} label="Offers Pending" value={kpis.offers.toString()} trend="−1 accepted" up={false} color="amber" />
            <KpiCard icon={Clock} label="Avg Time to Hire" value="14 days" trend="−3d vs last month" up color="emerald" />
            <KpiCard icon={TrendingUp} label="Offer Acceptance" value="82%" trend="+4% vs last quarter" up color="green" />
            <KpiCard icon={Zap} label="Hiring Velocity" value="+12%" trend="7-day trend" up color="violet" />
            <KpiCard icon={Target} label="Pipeline Health" value="94%" trend="SLA compliance" up color="rose" />
          </>)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#5c22ff]" /> Live Hiring Funnel
              <span className="ml-auto flex items-center gap-1 text-xs text-slate-400 font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Realtime
              </span>
            </h2>
            <div className="space-y-2.5">
              {loading ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-7 rounded-lg" />) :
                funnelCounts.map(({ stage, count }) => {
                  const sla = STAGE_SLA_DAYS[stage];
                  const maxCount = Math.max(...funnelCounts.map(f => f.count), 1);
                  const pct = Math.round((count / maxCount) * 100);
                  const meta = STAGE_META[stage];
                  return (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="w-4 text-base shrink-0">{meta.icon}</span>
                      <span className="w-20 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{stage}</span>
                      <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${STAGE_COLORS[stage]} rounded-full transition-all duration-700 flex items-center px-2`} style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}>
                          {count > 0 && <span className="text-[10px] font-bold text-white">{count}</span>}
                        </div>
                      </div>
                      <span className="w-6 text-xs font-black text-slate-700 dark:text-slate-200 text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" /> Live Activity
            </h2>
            <div className="space-y-3">
              {activities.slice(0, 6).map(a => (
                <div key={a.id} className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-sm"
                    style={{ background: a.avatarColor }}>{a.initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{a.message}</p>
                    <p className="text-[10px] text-slate-400">{a.candidateName} · {formatRelTime(a.time.toISOString())}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
DashboardTab.displayName = 'DashboardTab';

// ─── Tab 2: Pipeline (Kanban) ────────────────────────────────────────────────

interface PipelineTabProps {
  candidates: Candidate[]; requisitions: Requisition[]; loading: boolean;
  onStageChange: (id: string, stage: CandidateStage) => Promise<void>;
  onViewCandidate: (c: Candidate) => void;
  onOpenImportCv: () => void;
}

const PipelineTab = memo(({ candidates, requisitions, loading, onStageChange, onViewCandidate, onOpenImportCv }: PipelineTabProps) => {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<CandidateStage | null>(null);
  const [explainCandidate, setExplainCandidate] = useState<Candidate | null>(null);

  const displayCandidates = candidates.length === 0 && !loading ? DEMO_CANDIDATES : candidates;
  const isPreview = candidates.length === 0 && !loading;

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = displayCandidates.filter(c =>
      (q === '' || `${c.first_name} ${c.last_name} ${c.email} ${c.current_company ?? ''}`.toLowerCase().includes(q)) &&
      (filterRole === '' || c.applied_for === filterRole)
    );
    return PIPELINE_STAGES.reduce<Record<CandidateStage, Candidate[]>>((acc, s) => {
      acc[s] = filtered.filter(c => getCandidateStage(c.status) === s);
      return acc;
    }, {} as Record<CandidateStage, Candidate[]>);
  }, [displayCandidates, search, filterRole]);

  const stageStats = useMemo(() =>
    PIPELINE_STAGES.reduce<Record<CandidateStage, { avgDays: number; slaBreached: number }>>((acc, stage) => {
      const cards = grouped[stage] ?? [];
      const avg = cards.length > 0 ? Math.round(cards.reduce((s, c) => s + getDaysInStage(c), 0) / cards.length) : 0;
      const breached = cards.filter(c => isSLABreached(c)).length;
      acc[stage] = { avgDays: avg, slaBreached: breached };
      return acc;
    }, {} as Record<CandidateStage, { avgDays: number; slaBreached: number }>),
    [grouped]
  );

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, stage: CandidateStage) => {
    e.preventDefault();
    if (draggingId) onStageChange(draggingId, stage);
    setDraggingId(null);
    setDragOverStage(null);
  }, [draggingId, onStageChange]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-slate-100/80 dark:bg-[#07080D] relative">
      {explainCandidate && <AIExplainPanel candidate={explainCandidate} onClose={() => setExplainCandidate(null)} />}

      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#0F1117] shrink-0">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
            placeholder="Search candidates..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">All Roles</option>
          {requisitions.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {isPreview && <span className="text-[10px] font-semibold px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 border border-amber-200 rounded-full">✦ Demo</span>}
          <span className="text-xs text-slate-400">{displayCandidates.length} candidates · Drag to move</span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 p-4 h-full" style={{ minWidth: `${PIPELINE_STAGES.length * 225 + 40}px` }}>
          {PIPELINE_STAGES.map(stage => (
            <PremiumKanbanColumn
              key={stage} stage={stage}
              cards={grouped[stage] ?? []}
              stats={stageStats[stage]}
              requisitions={requisitions} loading={loading}
              isDragOver={dragOverStage === stage}
              isDragging={draggingId !== null}
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={e => handleDrop(e, stage)}
              onDragStart={handleDragStart}
              onViewCandidate={onViewCandidate}
              onExplainAI={setExplainCandidate}
              onOpenImportCv={onOpenImportCv}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
PipelineTab.displayName = 'PipelineTab';

interface KanbanColProps {
  stage: CandidateStage; cards: Candidate[]; stats: { avgDays: number; slaBreached: number };
  requisitions: Requisition[]; loading: boolean; isDragOver: boolean; isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void; onDragStart: (e: React.DragEvent, id: string) => void;
  onViewCandidate: (c: Candidate) => void; onExplainAI: (c: Candidate) => void;
  onOpenImportCv: () => void;
}

const PremiumKanbanColumn = memo(({
  stage, cards, stats, requisitions, loading, isDragOver, isDragging,
  onDragOver, onDragLeave, onDrop, onDragStart, onViewCandidate, onExplainAI, onOpenImportCv,
}: KanbanColProps) => {
  const m = STAGE_META[stage];

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
        isDragOver ? 'ring-2 ring-[#5c22ff] ring-offset-2 scale-[1.01] shadow-xl shadow-[#5c22ff]/20' : m.border
      } ${m.columnBg}`}
      style={{ width: '215px', minWidth: '215px', height: 'calc(100vh - 165px)' }}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      <div className={`bg-gradient-to-br ${m.gradient} px-3 pt-3 pb-2 shrink-0`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none">{m.icon}</span>
            <span className="text-xs font-black text-white tracking-wide">{stage}</span>
          </div>
          <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-white/25 text-white backdrop-blur-sm">
            {cards.length}
          </span>
        </div>
        <p className="text-[9px] text-white/70 font-medium">{m.subLabel}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {cards.map(c => (
          <PremiumKanbanCard
            key={c.id} candidate={c} stage={stage} requisitions={requisitions}
            onDragStart={onDragStart} onClick={() => onViewCandidate(c)} onExplainAI={() => onExplainAI(c)}
          />
        ))}

        {!loading && cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-2 text-center">
            <div className="text-4xl mb-3 opacity-20">{m.icon}</div>
            <p className="text-[11px] font-bold text-slate-500">No candidates in {stage}</p>
            {stage === 'Applied' && (
              <button onClick={onOpenImportCv} className="mt-3 w-full text-[10px] font-bold text-[#5c22ff] border border-[#5c22ff]/30 py-1.5 rounded-lg hover:bg-[#5c22ff]/5">
                + Import CV
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
PremiumKanbanColumn.displayName = 'PremiumKanbanColumn';

const PremiumKanbanCard = memo(({ candidate, stage, requisitions, onDragStart, onClick, onExplainAI }: {
  candidate: Candidate; stage: CandidateStage; requisitions: Requisition[];
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void; onExplainAI: () => void;
}) => {
  const match = candidate.ai_match ?? 60;
  const palette = getAIPalette(candidate.id);
  const m = STAGE_META[stage];

  return (
    <div
      draggable onDragStart={e => { e.stopPropagation(); onDragStart(e, candidate.id); }} onClick={onClick}
      className="group relative bg-white dark:bg-[#1A1D27] rounded-xl p-3 shadow-sm border border-slate-200/80 dark:border-slate-700/60 cursor-grab active:cursor-grabbing hover:shadow-lg hover:border-[#5c22ff]/40 hover:-translate-y-0.5 transition-all duration-150 overflow-hidden"
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${m.gradient}`} />
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-8 h-8 rounded-full ${palette.bg} ${palette.text} flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm`}>
          {getInitials(candidate.first_name, candidate.last_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{candidate.first_name} {candidate.last_name}</p>
          <p className="text-[10px] text-slate-400 truncate">{candidate.current_company ?? 'Top Firm'}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <AiMatchBadge pct={match} onClick={e => { e?.stopPropagation(); onExplainAI(); }} />
        {candidate.priority && <PriorityBadge priority={candidate.priority} />}
      </div>
    </div>
  );
});
PremiumKanbanCard.displayName = 'PremiumKanbanCard';

// ─── Tab 3: Candidates Table & 360 ───────────────────────────────────────────

interface CandidatesTabProps {
  candidates: Candidate[]; requisitions: Requisition[]; loading: boolean;
  onPositiveResponse: (c: Candidate) => Promise<void>;
  onInterviewScheduled: (c: Candidate) => Promise<void>;
  automationBusy: string | null;
  onOpenImportCv: () => void;
}

const CandidatesTab = memo(({ candidates, requisitions, loading, onPositiveResponse, onInterviewScheduled, automationBusy, onOpenImportCv }: CandidatesTabProps) => {
  const displayCandidates = candidates.length === 0 && !loading ? DEMO_CANDIDATES : candidates;
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [compareSet, setCompareSet] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [explainCandidate, setExplainCandidate] = useState<Candidate | null>(null);

  const filtered = useMemo(() =>
    displayCandidates.filter(c => {
      const q = search.toLowerCase();
      return q === '' || `${c.first_name} ${c.last_name} ${c.email} ${c.current_company ?? ''}`.toLowerCase().includes(q);
    }),
    [displayCandidates, search]
  );

  const toggleCompare = useCallback((id: string) => {
    setCompareSet(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else if (n.size < 3) n.add(id);
      return n;
    });
  }, []);

  return (
    <div className="flex-1 overflow-hidden flex flex-col relative">
      {explainCandidate && <AIExplainPanel candidate={explainCandidate} onClose={() => setExplainCandidate(null)} />}

      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1117] shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
            placeholder="Search candidates..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={onOpenImportCv} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#5c22ff] text-white rounded-lg hover:bg-[#4b1ac4]">
          <Upload className="w-3.5 h-3.5" /> Import CV
        </button>
        {compareSet.size >= 2 && (
          <button onClick={() => setShowCompare(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg">
            <GitCompare className="w-3.5 h-3.5" /> Compare {compareSet.size}
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} candidates</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 w-8"></th>
              {['Candidate', 'Company', 'Stage', 'AI Match', 'CTC', 'Notice', 'Actions'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={compareSet.has(c.id)} onChange={() => toggleCompare(c.id)} />
                </td>
                <td className="px-3 py-3" onClick={() => setSelected(c)}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full ${getAIPalette(c.id).bg} ${getAIPalette(c.id).text} flex items-center justify-center text-[10px] font-black shrink-0`}>
                      {getInitials(c.first_name, c.last_name)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{c.first_name} {c.last_name}</p>
                      <p className="text-[10px] text-slate-400">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-500" onClick={() => setSelected(c)}>{c.current_company ?? '—'}</td>
                <td className="px-3 py-3" onClick={() => setSelected(c)}><StatusBadge stage={getCandidateStage(c.status)} /></td>
                <td className="px-3 py-3" onClick={() => setExplainCandidate(c)}><AiMatchBadge pct={c.ai_match ?? 0} /></td>
                <td className="px-3 py-3 text-slate-600 font-semibold" onClick={() => setSelected(c)}>{c.expected_ctc ? `₹${c.expected_ctc}L` : '—'}</td>
                <td className="px-3 py-3 text-slate-500" onClick={() => setSelected(c)}>{c.notice_days !== undefined ? `${c.notice_days}d` : '—'}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); exportCandidateDossier(c); }} title="Export Dossier"
                      className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <FileDown className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" onClick={() => setSelected(c)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Candidate360Panel candidate={selected} requisitions={requisitions} onClose={() => setSelected(null)}
          onPositiveResponse={onPositiveResponse} onInterviewScheduled={onInterviewScheduled} automationBusy={automationBusy}
          onExplainAI={() => setExplainCandidate(selected)} />
      )}
    </div>
  );
});
CandidatesTab.displayName = 'CandidatesTab';

const Candidate360Panel = memo(({ candidate, requisitions, onClose, onPositiveResponse, onInterviewScheduled, automationBusy, onExplainAI }: {
  candidate: Candidate; requisitions: Requisition[]; onClose: () => void;
  onPositiveResponse: (c: Candidate) => Promise<void>; onInterviewScheduled: (c: Candidate) => Promise<void>;
  automationBusy: string | null; onExplainAI: () => void;
}) => {
  const [section, setSection] = useState<'summary' | 'graph' | 'memory' | 'timeline' | 'documents'>('summary');
  const role = requisitions.find(r => r.id === candidate.applied_for)?.title ?? 'General Applicant';
  const match = candidate.ai_match ?? 60;
  const palette = getAIPalette(candidate.id);

  // AI Memories for this candidate
  const memories = useMemo(() => [
    { id: 'm-1', date: '43 days ago', category: 'Preferences', note: 'Candidate prefers hybrid/remote setup. Mentioned flexible work hours requirement.' },
    { id: 'm-2', date: '18 days ago', category: 'Salary Signal', note: `Current expectation ₹${candidate.expected_ctc ?? 22}L. Competing offer reported at target company.` },
    { id: 'm-3', date: '5 days ago', category: 'Interview Insight', note: 'Technical panel noted exceptional microservices and system design foundation.' },
  ], [candidate]);

  return (
    <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white dark:bg-[#181B23] border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col z-20">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${palette.bg} ${palette.text} flex items-center justify-center text-sm font-black`}>
            {getInitials(candidate.first_name, candidate.last_name)}
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100">{candidate.first_name} {candidate.last_name}</p>
            <p className="text-xs text-slate-400">{candidate.current_company ?? role}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-4 h-4 text-slate-500" /></button>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-700 shrink-0 overflow-x-auto">
        <button onClick={() => exportCandidateDossier(candidate)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
          <FileDown className="w-3 h-3" /> Export Dossier
        </button>
        <button onClick={onExplainAI} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#5c22ff] bg-[#5c22ff]/10 border border-[#5c22ff]/20 rounded-lg">
          <Brain className="w-3 h-3" /> AI Breakdown
        </button>
      </div>
      <div className="flex border-b border-slate-100 dark:border-slate-700 shrink-0 overflow-x-auto">
        {(['summary', 'graph', 'memory', 'timeline', 'documents'] as const).map(sec => (
          <button key={sec} onClick={() => setSection(sec)}
            className={`flex-1 py-2 px-2 text-[11px] font-semibold capitalize whitespace-nowrap transition-colors ${section === sec ? 'border-b-2 border-[#5c22ff] text-[#5c22ff]' : 'text-slate-500 hover:text-slate-700'}`}>
            {sec === 'graph' ? '🕸 Graph' : sec === 'memory' ? '🧠 AI Memory' : sec}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {section === 'summary' && (
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-2">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Candidate Overview</p>
            <p className="text-xs text-slate-500">Email: {candidate.email}</p>
            <p className="text-xs text-slate-500">Experience: {candidate.experience_years ?? 5} Years</p>
            <p className="text-xs text-slate-500">Expected CTC: ₹{candidate.expected_ctc ?? 20} LPA</p>
            <p className="text-xs text-slate-500">Notice Period: {candidate.notice_days ?? 30} Days</p>
            <p className="text-xs text-slate-500">Location: {candidate.location ?? 'Bangalore'}</p>
          </div>
        )}
        {section === 'graph' && (
          <div className="space-y-3">
            <div className="bg-[#5c22ff]/5 border border-[#5c22ff]/20 p-3.5 rounded-xl space-y-2">
              <p className="text-[10px] font-bold text-[#5c22ff] uppercase tracking-wider">Universal Talent Graph Connections</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Skills Node:</span>
                  <span className="text-slate-500">{(candidate.skills ?? ['React', 'TypeScript']).join(', ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Company Node:</span>
                  <span className="text-slate-500">{candidate.current_company ?? 'Top Firm'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Recruiter Edge:</span>
                  <span className="text-slate-500">{candidate.recruiter ?? 'Arjun S.'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Requisition Edge:</span>
                  <span className="text-slate-500">{role}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {section === 'memory' && (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Persistent Candidate AI Memory</p>
            {memories.map(m => (
              <div key={m.id} className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 p-3 rounded-xl space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-[#5c22ff]">{m.category}</span>
                  <span className="text-slate-400">{m.date}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{m.note}</p>
              </div>
            ))}
          </div>
        )}
        {section === 'timeline' && (
          <div className="space-y-2 text-xs text-slate-500">
            <p>• Candidate profile created on {new Date(candidate.created_at || Date.now()).toLocaleDateString()}</p>
            <p>• Status updated to {getCandidateStage(candidate.status)}</p>
          </div>
        )}
        {section === 'documents' && (
          <div className="space-y-2 text-xs text-slate-500">
            <p>📄 Resume document uploaded & parsed</p>
          </div>
        )}
      </div>
    </div>
  );
});
Candidate360Panel.displayName = 'Candidate360Panel';

// ─── Tab 4: Interviews ────────────────────────────────────────────────────────

const InterviewsTab = memo(() => (
  <div className="flex-1 overflow-y-auto p-6 space-y-4">
    <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
      <Calendar className="w-4 h-4 text-[#5c22ff]" /> Scheduled Interviews
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {SEED_INTERVIEWS.map(iv => (
        <div key={iv.id} className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-start">
            <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{iv.candidateName}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{iv.type}</span>
          </div>
          <p className="text-xs text-slate-500">{iv.role}</p>
          <p className="text-xs text-slate-400">{iv.dateTime.toLocaleString()}</p>
        </div>
      ))}
    </div>
  </div>
));
InterviewsTab.displayName = 'InterviewsTab';

// ─── Tab 5: Jobs Requisitions & AI JD Generator & Editor ──────────────────────

const JobsTab = memo(({ requisitions, candidates, loading, onCreate, onOpenImportJob }: {
  requisitions: Requisition[]; candidates: Candidate[]; loading: boolean;
  onCreate: (req: Partial<Requisition>) => Promise<void>;
  onOpenImportJob: () => void;
}) => {
  const [showWizard, setShowWizard] = useState(false);
  const [editingJob, setEditingJob] = useState<Requisition | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ title: '', location: 'Bangalore / Remote', department: 'Engineering', type: 'Full-time', budget: '₹18-28 LPA', jd: '', skills: [] as string[] });
  const [aiGen, setAiGen] = useState(false);

  const generateFullJD = useCallback(async () => {
    if (!form.title) { toast.error('Enter a Job Title first'); return; }
    setAiGen(true);
    await new Promise(r => setTimeout(r, 1000));
    const title = form.title;
    const dept = form.department || 'Engineering';

    const fullJdText = `# ${title} — ${dept}

## About CHATR
CHATR is the enterprise Business OS powering modern productivity. We are seeking an exceptional ${title} to drive mission-critical architecture and product capabilities.

## Position Overview
As a ${title}, you will own core product features, design high-performance scalable systems, and collaborate with cross-functional product, engineering, and AI teams.

## Key Responsibilities
• Design, implement, and maintain enterprise-grade software architecture.
• Collaborate with design, AI engineering, and product managers to release features seamlessly.
• Write clean, well-tested TypeScript / backend code adhering to solid architectural principles.
• Optimize application performance, responsiveness, and database query throughput.
• Conduct peer code reviews, document system specifications, and mentor team members.

## Required Qualifications & Skills
• 4+ years of professional software engineering experience.
• Proficiency in ${form.skills.length > 0 ? form.skills.join(', ') : 'TypeScript, React, Node.js, and SQL / NoSQL databases'}.
• Strong system design fundamentals and understanding of microservices / event-driven architecture.
• Proven track record of delivering resilient, high-volume web applications.

## Preferred Qualifications
• Experience with Supabase, GraphQL, Docker, and AWS / Cloud platforms.
• Familiarity with AI models, context orchestration, or LLM integrations.

## Compensation & Perks
• Competitive salary band: ${form.budget || '₹20L - ₹32L PA'} + ESOP grants.
• Flexible hybrid/remote work setup with comprehensive health coverage.
• Annual learning & hardware stipend.

## Equal Opportunity
CHATR is an equal opportunity employer. We celebrate diversity and foster an inclusive workplace environment.`;

    setForm(f => ({ ...f, jd: fullJdText }));
    setAiGen(false);
    toast.success('AI generated complete Job Description! You can edit any section below.');
  }, [form.title, form.department, form.skills, form.budget]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 space-y-5 max-w-[1400px]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#5c22ff]" /> Job Requisitions
            <span className="text-xs text-slate-400 font-normal">{requisitions.length} active</span>
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={onOpenImportJob} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-200">
              <Upload className="w-3.5 h-3.5" /> Import Jobs
            </button>
            <button onClick={() => setShowWizard(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#5c22ff] text-white text-xs font-semibold rounded-lg hover:bg-[#4b1ac4]">
              <Plus className="w-3.5 h-3.5" /> New Requisition
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>{['Role', 'Department', 'Location', 'Type', 'Candidates', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {requisitions.map(req => (
                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{req.title}</td>
                  <td className="px-4 py-3 text-slate-500">{req.department ?? 'Engineering'}</td>
                  <td className="px-4 py-3 text-slate-500">{req.location}</td>
                  <td className="px-4 py-3 text-slate-500">{req.type}</td>
                  <td className="px-4 py-3 font-bold text-slate-700">{candidates.filter(c => c.applied_for === req.id).length}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{req.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditingJob(req)} title="Edit Job Description" className="p-1.5 text-slate-500 hover:text-[#5c22ff] border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit JD
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edit JD Modal */}
        {editingJob && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingJob(null)}>
            <div className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-[#5c22ff]" /> Edit Job Description — {editingJob.title}
                  </h3>
                  <p className="text-xs text-slate-400">{editingJob.department} · {editingJob.location}</p>
                </div>
                <button onClick={() => setEditingJob(null)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                <textarea
                  className="w-full p-4 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#5c22ff]/40 font-mono leading-relaxed resize-none min-h-[350px]"
                  value={editingJob.jd || `# ${editingJob.title}\n\nKey Responsibilities...\nRequirements...`}
                  onChange={e => setEditingJob({ ...editingJob, jd: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                <button onClick={() => setEditingJob(null)} className="px-4 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl">Cancel</button>
                <button onClick={() => { onCreate(editingJob); setEditingJob(null); toast.success('Job Description updated & saved!'); }} className="px-4 py-2 text-xs font-bold bg-[#5c22ff] text-white rounded-xl">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Modal */}
        {showWizard && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-slate-800 dark:text-white">Create New Requisition</h3>
                <button onClick={() => setShowWizard(false)}><X className="w-4 h-4 text-slate-500" /></button>
              </div>
              <div className="p-6 space-y-4">
                <input className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  placeholder="Job Title (e.g. Senior Fullstack Developer)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-slate-600">Full Job Description</p>
                  <button onClick={generateFullJD} disabled={aiGen} className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-[#5c22ff] border border-[#5c22ff]/30 rounded-lg hover:bg-[#5c22ff]/5">
                    {aiGen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Generate Full JD
                  </button>
                </div>
                <textarea className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono leading-relaxed resize-none" rows={10}
                  value={form.jd} onChange={e => setForm(f => ({ ...f, jd: e.target.value }))} placeholder="Click 'AI Generate Full JD' above to auto-create, or type custom JD..." />
                <button onClick={async () => { await onCreate(form); setShowWizard(false); }} disabled={!form.title} className="w-full py-2.5 bg-[#5c22ff] text-white text-xs font-bold rounded-xl hover:bg-[#4b1ac4]">
                  Publish Job Requisition
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
JobsTab.displayName = 'JobsTab';

// ─── Tab 6: Analytics ─────────────────────────────────────────────────────────

const AnalyticsTab = memo(({ candidates, requisitions }: { candidates: Candidate[]; requisitions: Requisition[] }) => (
  <div className="flex-1 overflow-y-auto">
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[#5c22ff]" /> Recruitment Analytics & Reporting
        </h2>
        <button onClick={() => exportPipelineReportCSV(candidates, requisitions)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">
          <Download className="w-3.5 h-3.5" /> Export Analytics CSV
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Time to Hire', value: '14d', delta: '−3d', up: true },
          { label: 'Cost per Hire', value: '₹42K', delta: '−8%', up: true },
          { label: 'Offer Acceptance', value: '82%', delta: '+4%', up: true },
          { label: 'Pipeline Aging', value: '11d avg', delta: '−2d', up: true },
        ].map(({ label, value, delta, up }) => (
          <div key={label} className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-[#181B23] border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Hiring Funnel</h3>
        <ResponsiveContainer width="100%" height={220}>
          <ReBarChart data={ANALYTICS_FUNNEL} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={80} />
            <RechartsTooltip />
            <Bar dataKey="value" fill="#5c22ff" radius={[0, 4, 4, 0]} />
          </ReBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
));
AnalyticsTab.displayName = 'AnalyticsTab';

// ─── Tab 7: AI Copilot ────────────────────────────────────────────────────────

const CopilotTab = memo(({ candidates, requisitions }: { candidates: Candidate[]; requisitions: Requisition[] }) => (
  <div className="flex-1 overflow-hidden flex flex-col p-4">
    <div className="flex-1 overflow-y-auto space-y-3">
      <div className="bg-white dark:bg-[#181B23] p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
        Welcome to AI Copilot. Ask for candidate summaries, JD drafts, or pipeline analytics.
      </div>
    </div>
  </div>
));
CopilotTab.displayName = 'CopilotTab';

// ─── Tab 8: Onboarding ────────────────────────────────────────────────────────

const OnboardingTab = memo(() => (
  <div className="flex-1 overflow-y-auto p-6">
    <h2 className="text-base font-bold text-slate-800 dark:text-white mb-4">Onboarding Tracker</h2>
    <div className="bg-white dark:bg-[#181B23] p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
      Track onboarding steps for accepted hires.
    </div>
  </div>
));
OnboardingTab.displayName = 'OnboardingTab';

// ─── Root Shell ───────────────────────────────────────────────────────────────

export const RecruiterWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TosTab>(() => {
    try { return (sessionStorage.getItem('chatr_tos_tab') as TosTab) ?? 'dashboard'; } catch { return 'dashboard'; }
  });
  const [cmdOpen, setCmdOpen] = useState(false);
  const [importJobOpen, setImportJobOpen] = useState(false);
  const [importCvOpen, setImportCvOpen] = useState(false);

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [automationEvents, setAutomationEvents] = useState<AutomationEvent[]>([]);
  const [mobileActions, setMobileActions] = useState<MobileAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [automationBusy, setAutomationBusy] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [reqsRes, candsRes] = await Promise.all([
        supabase.from('requisitions').select('*').order('created_at', { ascending: false }),
        supabase.from('candidates').select('*').order('created_at', { ascending: false }),
      ]);
      if (reqsRes.data) setRequisitions(reqsRes.data);
      if (candsRes.data) setCandidates(candsRes.data);
    } finally { setLoading(false); }
  }, []);

  const fetchAutomation = useCallback(async () => {
    try {
      const [eventsRes, actionsRes] = await Promise.all([
        supabase.from('communication_events').select('id,event_type,candidate_id,payload,created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('mobile_action_queue').select('id,action_type,candidate_id,payload,status,created_at').order('created_at', { ascending: false }).limit(8),
      ]);
      if (eventsRes.data) setAutomationEvents(eventsRes.data as AutomationEvent[]);
      if (actionsRes.data) setMobileActions(actionsRes.data as MobileAction[]);
    } catch { /* graceful */ }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAutomation();
    const reqs = supabase.channel('tos-reqs').on('postgres_changes', { event: '*', schema: 'public', table: 'requisitions' }, fetchData).subscribe();
    const cands = supabase.channel('tos-cands').on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, fetchData).subscribe();
    return () => { supabase.removeChannel(reqs); supabase.removeChannel(cands); };
  }, [fetchData, fetchAutomation]);

  const handleTabChange = useCallback((tab: TosTab) => {
    setActiveTab(tab);
    try { sessionStorage.setItem('chatr_tos_tab', tab); } catch { /* quota */ }
  }, []);

  const handleCreateRequisition = useCallback(async (reqData: Partial<Requisition>) => {
    if (reqData.id) {
      // Update existing
      setRequisitions(prev => prev.map(r => r.id === reqData.id ? { ...r, ...reqData } as Requisition : r));
      await supabase.from('requisitions').update(reqData).eq('id', reqData.id);
      toast.success('Job requisition updated');
    } else {
      // Create new
      const newJob: Requisition = {
        id: `req-${Date.now()}`,
        title: reqData.title || 'Untitled Role',
        location: reqData.location || 'Remote',
        department: reqData.department || 'Engineering',
        type: reqData.type || 'Full-time',
        status: 'Open',
        jd: reqData.jd || '',
        created_at: new Date().toISOString(),
      };
      setRequisitions(prev => [newJob, ...prev]);
      await supabase.from('requisitions').insert(newJob);
      toast.success(`Requisition '${newJob.title}' published`);
    }
  }, []);

  const handleImportJobs = useCallback(async (jobs: Partial<Requisition>[]) => {
    const formatted: Requisition[] = jobs.map((j, i) => ({
      id: `imported-req-${Date.now()}-${i}`,
      title: j.title || 'Imported Requisition',
      location: j.location || 'Remote',
      department: j.department || 'Engineering',
      type: j.type || 'Full-time',
      status: 'Open',
      jd: j.jd || '',
      created_at: new Date().toISOString(),
    }));
    setRequisitions(prev => [...formatted, ...prev]);
    for (const job of formatted) {
      await supabase.from('requisitions').insert(job);
    }
  }, []);

  const handleImportCandidate = useCallback(async (candidateData: Partial<Candidate>) => {
    const newCand: Candidate = {
      id: `cand-${Date.now()}`,
      first_name: candidateData.first_name || 'New',
      last_name: candidateData.last_name || 'Candidate',
      email: candidateData.email || 'candidate@example.com',
      phone: candidateData.phone || null,
      status: 'Applied',
      applied_for: candidateData.applied_for || null,
      current_company: candidateData.current_company || 'Tech Firm',
      experience_years: candidateData.experience_years || 4,
      expected_ctc: candidateData.expected_ctc || 20,
      notice_days: candidateData.notice_days || 30,
      location: candidateData.location || 'Bangalore',
      skills: candidateData.skills || ['React', 'Node.js'],
      ai_match: candidateData.ai_match || 88,
      ai_matched_skills: candidateData.ai_matched_skills || ['React'],
      ai_missing_skills: candidateData.ai_missing_skills || [],
      priority: candidateData.priority || 'High',
      risk: candidateData.risk || 'Low',
      salary_fit: candidateData.salary_fit || 'Within Band',
      created_at: new Date().toISOString(),
    };
    setCandidates(prev => [newCand, ...prev]);
    publishTOSEvent({ type: 'CandidateApplied', candidateId: newCand.id, candidateName: `${newCand.first_name} ${newCand.last_name}`, timestamp: new Date(), actor: 'AI Parser' });
    await supabase.from('candidates').insert(newCand);
  }, []);

  const handlePositiveResponse = useCallback(async (candidate: Candidate) => {
    setAutomationBusy(`positive-${candidate.id}`);
    try {
      await simulatePositiveRecruitmentResponse(candidate);
      toast.success('Response queued');
    } catch { toast.error('Routing failed'); }
    finally { setAutomationBusy(null); }
  }, []);

  const handleInterviewScheduled = useCallback(async (candidate: Candidate) => {
    setAutomationBusy(`scheduled-${candidate.id}`);
    try {
      await markRecruitmentCallInterviewScheduled(candidate);
      toast.success('Interview scheduled');
    } catch { toast.error('Scheduling failed'); }
    finally { setAutomationBusy(null); }
  }, []);

  const handleStageChange = useCallback(async (candidateId: string, newStage: CandidateStage) => {
    setCandidates(c => c.map(x => x.id === candidateId ? { ...x, status: newStage } : x));
    toast.success(`Moved to ${newStage}`);
    if (!candidateId.startsWith('demo-')) {
      await supabase.from('candidates').update({ status: newStage }).eq('id', candidateId);
    }
  }, []);

  const activeCandidates = candidates.length > 0 ? candidates : DEMO_CANDIDATES;

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-[#090A0F] overflow-hidden">
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onTabChange={t => { handleTabChange(t); setCmdOpen(false); }} candidates={activeCandidates} requisitions={requisitions} />
      <ImportJobModal open={importJobOpen} onClose={() => setImportJobOpen(false)} onImport={handleImportJobs} />
      <ImportCvModal open={importCvOpen} onClose={() => setImportCvOpen(false)} onImportCandidate={handleImportCandidate} requisitions={requisitions} />

      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onCmdK={() => setCmdOpen(true)}
        onOpenImportJob={() => setImportJobOpen(true)}
        onOpenImportCv={() => setImportCvOpen(true)}
        candidates={activeCandidates}
        requisitions={requisitions}
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'dashboard' && <DashboardTab requisitions={requisitions} candidates={candidates} automationEvents={automationEvents} loading={loading} automationBusy={automationBusy} onPositiveResponse={handlePositiveResponse} onInterviewScheduled={handleInterviewScheduled} onNewJob={() => handleTabChange('jobs')} onOpenImportCv={() => setImportCvOpen(true)} />}
        {activeTab === 'pipeline' && <PipelineTab candidates={candidates} requisitions={requisitions} loading={loading} onStageChange={handleStageChange} onViewCandidate={() => handleTabChange('candidates')} onOpenImportCv={() => setImportCvOpen(true)} />}
        {activeTab === 'candidates' && <CandidatesTab candidates={candidates} requisitions={requisitions} loading={loading} onPositiveResponse={handlePositiveResponse} onInterviewScheduled={handleInterviewScheduled} automationBusy={automationBusy} onOpenImportCv={() => setImportCvOpen(true)} />}
        {activeTab === 'interviews' && <InterviewsTab />}
        {activeTab === 'jobs' && <JobsTab requisitions={requisitions} candidates={candidates} loading={loading} onCreate={handleCreateRequisition} onOpenImportJob={() => setImportJobOpen(true)} />}
        {activeTab === 'analytics' && <AnalyticsTab candidates={activeCandidates} requisitions={requisitions} />}
        {activeTab === 'copilot' && <CopilotTab candidates={candidates} requisitions={requisitions} />}
        {activeTab === 'onboarding' && <OnboardingTab />}
      </div>

      <FloatingAIAssistant candidates={activeCandidates} requisitions={requisitions} />
    </div>
  );
};
