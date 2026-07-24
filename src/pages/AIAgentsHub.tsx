import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, Crown, ChevronRight, CheckCircle2, Building2, Rocket, TrendingUp,
  Users, Zap, Globe, Linkedin, Mail, MessageSquare, BarChart3, Search,
  GraduationCap, Briefcase, ShoppingBag, Heart, Home, UtensilsCrossed, Factory,
  Sparkles, ArrowRight, CheckSquare, Play, Star, Plug, RefreshCw, Activity,
  Target, Coffee, DollarSign, Code2, Github, Store, Filter, ChevronDown,
  ChevronUp, Plus, ExternalLink, Terminal, Rss, Grid, Package, Check
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type SetupStep = 'business_type' | 'goals' | 'ai_recommendation' | 'marketplace' | 'done';

type IntegrationCategory =
  | 'Analytics & BI' | 'Search & SEO' | 'Social & Publishing'
  | 'Recruitment & Jobs' | 'CRM & Sales' | 'Communication'
  | 'Payments & Finance' | 'Calendar & Meetings' | 'Storage & Docs'
  | 'AI Providers' | 'Developer & Automation' | 'Public Intelligence';

interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  free: boolean;
  stars: number; // 1-5
  logoColor: string;
  oauthUrl?: string;
}

interface TopBundle {
  id: string;
  name: string;
  tagline: string;
  stars: number;
  color: string;
  services: string[];
  integrationIds: string[];
  oauthUrl: string;
}

// ── 100+ Integration Registry ─────────────────────────────────────────────────

const ALL_INTEGRATIONS: Integration[] = [
  // Analytics & BI
  { id: 'ga4', name: 'Google Analytics 4', category: 'Analytics & BI', description: 'Website traffic & conversion tracking', free: true, stars: 5, logoColor: '#F57C00', oauthUrl: 'https://accounts.google.com/signin' },
  { id: 'gsc', name: 'Google Search Console', category: 'Analytics & BI', description: 'Search rankings & click-through data', free: true, stars: 5, logoColor: '#0F9D58', oauthUrl: 'https://accounts.google.com/signin' },
  { id: 'gbp', name: 'Google Business Profile', category: 'Analytics & BI', description: 'Appear on Google Maps & Reviews', free: true, stars: 5, logoColor: '#4285F4', oauthUrl: 'https://accounts.google.com/signin' },
  { id: 'gtm', name: 'Google Tag Manager', category: 'Analytics & BI', description: 'Track events without developer help', free: true, stars: 4, logoColor: '#4285F4' },
  { id: 'clarity', name: 'Microsoft Clarity', category: 'Analytics & BI', description: 'Session recordings & heatmaps', free: true, stars: 4, logoColor: '#0078D4' },
  { id: 'plausible', name: 'Plausible Analytics', category: 'Analytics & BI', description: 'Privacy-first open-source analytics', free: true, stars: 4, logoColor: '#5850EC' },
  { id: 'matomo', name: 'Matomo', category: 'Analytics & BI', description: 'Self-hosted Google Analytics alternative', free: true, stars: 4, logoColor: '#3152A0' },
  { id: 'posthog', name: 'PostHog', category: 'Analytics & BI', description: 'Product analytics & feature flags', free: true, stars: 4, logoColor: '#FF9635' },
  { id: 'umami', name: 'Umami', category: 'Analytics & BI', description: 'Simple self-hosted website stats', free: true, stars: 3, logoColor: '#1A1A1A' },

  // Search & SEO
  { id: 'google_trends', name: 'Google Trends', category: 'Search & SEO', description: 'Discover trending keywords & topics', free: true, stars: 5, logoColor: '#4285F4' },
  { id: 'bing_webmaster', name: 'Bing Webmaster Tools', category: 'Search & SEO', description: 'Bing search performance & indexing', free: true, stars: 4, logoColor: '#0078D4' },
  { id: 'indexnow', name: 'IndexNow', category: 'Search & SEO', description: 'Instant search engine indexing protocol', free: true, stars: 4, logoColor: '#FF6B35' },
  { id: 'pagespeed', name: 'Google PageSpeed Insights', category: 'Search & SEO', description: 'Core Web Vitals & performance scores', free: true, stars: 4, logoColor: '#34A853' },
  { id: 'ahrefs_free', name: 'Ahrefs Webmaster Tools', category: 'Search & SEO', description: 'Backlink & keyword tracking (free tier)', free: true, stars: 4, logoColor: '#0E6FFF' },
  { id: 'semrush_free', name: 'SEMrush Free Projects', category: 'Search & SEO', description: 'Keyword & competitor research', free: true, stars: 3, logoColor: '#FF642B' },
  { id: 'rss_monitor', name: 'RSS Monitoring Engine', category: 'Search & SEO', description: 'Track industry news & competitor updates', free: true, stars: 4, logoColor: '#FFA500' },

  // Social & Publishing
  { id: 'linkedin', name: 'LinkedIn', category: 'Social & Publishing', description: 'B2B outreach & professional publishing', free: true, stars: 5, logoColor: '#0077B5', oauthUrl: 'https://www.linkedin.com/login' },
  { id: 'x_twitter', name: 'X (Twitter)', category: 'Social & Publishing', description: 'Real-time engagement & trends', free: true, stars: 4, logoColor: '#000000' },
  { id: 'facebook', name: 'Facebook Pages', category: 'Social & Publishing', description: 'Business page management & ads', free: true, stars: 4, logoColor: '#1877F2', oauthUrl: 'https://www.facebook.com/login' },
  { id: 'instagram', name: 'Instagram Business', category: 'Social & Publishing', description: 'Visual brand building & reels', free: true, stars: 4, logoColor: '#E4405F' },
  { id: 'youtube', name: 'YouTube', category: 'Social & Publishing', description: 'Thought leadership via video content', free: true, stars: 4, logoColor: '#FF0000', oauthUrl: 'https://accounts.google.com/signin' },
  { id: 'threads', name: 'Threads', category: 'Social & Publishing', description: 'Meta text-based social network', free: true, stars: 3, logoColor: '#000000' },
  { id: 'devto', name: 'Dev.to', category: 'Social & Publishing', description: 'Tech articles to 10M+ developers', free: true, stars: 4, logoColor: '#0A0A0A' },
  { id: 'hashnode', name: 'Hashnode', category: 'Social & Publishing', description: 'Developer blogging platform', free: true, stars: 4, logoColor: '#2962FF' },
  { id: 'medium', name: 'Medium', category: 'Social & Publishing', description: 'Long-form thought leadership content', free: true, stars: 3, logoColor: '#000000' },
  { id: 'wordpress', name: 'WordPress', category: 'Social & Publishing', description: 'Self-hosted blog & content management', free: true, stars: 4, logoColor: '#21759B' },
  { id: 'ghost', name: 'Ghost', category: 'Social & Publishing', description: 'Open-source modern publishing platform', free: true, stars: 4, logoColor: '#15171A' },
  { id: 'pinterest', name: 'Pinterest', category: 'Social & Publishing', description: 'Visual discovery for B2C brands', free: true, stars: 3, logoColor: '#E60023' },

  // Recruitment & Jobs
  { id: 'talentxcel', name: 'TalentXcel', category: 'Recruitment & Jobs', description: 'Your own recruitment platform', free: true, stars: 5, logoColor: '#10B981' },
  { id: 'github_jobs', name: 'GitHub', category: 'Recruitment & Jobs', description: 'Developer sourcing & talent discovery', free: true, stars: 5, logoColor: '#24292E', oauthUrl: 'https://github.com/login' },
  { id: 'indeed', name: 'Indeed', category: 'Recruitment & Jobs', description: 'Mass job posting & applicant tracking', free: true, stars: 4, logoColor: '#003A9B' },
  { id: 'glassdoor', name: 'Glassdoor', category: 'Recruitment & Jobs', description: 'Employer branding & reviews', free: true, stars: 4, logoColor: '#0CAA41' },
  { id: 'wellfound', name: 'Wellfound (AngelList)', category: 'Recruitment & Jobs', description: 'Startup hiring & tech talent', free: true, stars: 4, logoColor: '#000000' },
  { id: 'aicte', name: 'AICTE Campus Data', category: 'Recruitment & Jobs', description: 'Government database of 10,000+ colleges', free: true, stars: 4, logoColor: '#FF6B00' },
  { id: 'nirf', name: 'NIRF Rankings', category: 'Recruitment & Jobs', description: 'Top-ranked college placement portals', free: true, stars: 4, logoColor: '#003087' },
  { id: 'remote_ok', name: 'Remote OK', category: 'Recruitment & Jobs', description: 'Remote tech job board & RSS feed', free: true, stars: 3, logoColor: '#00D1B2' },

  // CRM & Sales
  { id: 'hubspot', name: 'HubSpot', category: 'CRM & Sales', description: 'Free CRM, deals pipeline & sequences', free: true, stars: 5, logoColor: '#FF7A59' },
  { id: 'zoho_crm', name: 'Zoho CRM', category: 'CRM & Sales', description: 'Indian-friendly CRM with free tier', free: true, stars: 4, logoColor: '#E42527' },
  { id: 'pipedrive', name: 'Pipedrive', category: 'CRM & Sales', description: 'Sales pipeline & deal management', free: false, stars: 4, logoColor: '#2D3748' },
  { id: 'supabase', name: 'Supabase', category: 'CRM & Sales', description: 'Open-source PostgreSQL database & auth', free: true, stars: 5, logoColor: '#3ECF8E' },
  { id: 'airtable', name: 'Airtable', category: 'CRM & Sales', description: 'Flexible spreadsheet-database hybrid', free: true, stars: 4, logoColor: '#FCB400' },
  { id: 'notion', name: 'Notion', category: 'CRM & Sales', description: 'All-in-one workspace & knowledge base', free: true, stars: 4, logoColor: '#000000' },
  { id: 'google_sheets', name: 'Google Sheets', category: 'CRM & Sales', description: 'Lightweight CRM & reporting sheets', free: true, stars: 4, logoColor: '#34A853', oauthUrl: 'https://accounts.google.com/signin' },

  // Communication
  { id: 'gmail', name: 'Gmail', category: 'Communication', description: 'Business email & automated sequences', free: true, stars: 5, logoColor: '#EA4335', oauthUrl: 'https://accounts.google.com/signin' },
  { id: 'outlook', name: 'Microsoft Outlook', category: 'Communication', description: 'Enterprise email & calendar sync', free: true, stars: 5, logoColor: '#0078D4', oauthUrl: 'https://login.microsoftonline.com' },
  { id: 'resend', name: 'Resend', category: 'Communication', description: 'Developer-friendly transactional email', free: true, stars: 4, logoColor: '#000000' },
  { id: 'brevo', name: 'Brevo (Sendinblue)', category: 'Communication', description: '300 free emails/day, marketing automation', free: true, stars: 4, logoColor: '#0092FF' },
  { id: 'sendgrid', name: 'SendGrid', category: 'Communication', description: 'Reliable email delivery at scale', free: true, stars: 4, logoColor: '#1A82E2' },
  { id: 'whatsapp_business', name: 'WhatsApp Business', category: 'Communication', description: 'Direct candidate & employer messaging', free: true, stars: 5, logoColor: '#25D366', oauthUrl: 'https://business.facebook.com' },
  { id: 'telegram', name: 'Telegram Bot API', category: 'Communication', description: 'Broadcast alerts to developer groups', free: true, stars: 4, logoColor: '#2CA5E0' },
  { id: 'slack', name: 'Slack', category: 'Communication', description: 'Team collaboration & workflow automation', free: true, stars: 4, logoColor: '#4A154B' },
  { id: 'ms_teams', name: 'Microsoft Teams', category: 'Communication', description: 'Enterprise meetings & file sharing', free: true, stars: 4, logoColor: '#6264A7', oauthUrl: 'https://login.microsoftonline.com' },
  { id: 'discord', name: 'Discord', category: 'Communication', description: 'Developer & student community channels', free: true, stars: 4, logoColor: '#5865F2' },

  // Payments & Finance
  { id: 'razorpay', name: 'Razorpay', category: 'Payments & Finance', description: 'India payments, subscriptions & invoicing', free: true, stars: 5, logoColor: '#3395FF' },
  { id: 'stripe', name: 'Stripe', category: 'Payments & Finance', description: 'Global payment processing & billing', free: true, stars: 5, logoColor: '#635BFF' },
  { id: 'cashfree', name: 'Cashfree', category: 'Payments & Finance', description: 'India payouts & collection gateway', free: true, stars: 4, logoColor: '#1C1C1C' },
  { id: 'paypal', name: 'PayPal', category: 'Payments & Finance', description: 'International payment collection', free: true, stars: 4, logoColor: '#003087' },
  { id: 'zoho_books', name: 'Zoho Books', category: 'Payments & Finance', description: 'GST-compliant Indian accounting', free: true, stars: 4, logoColor: '#E42527' },
  { id: 'quickbooks', name: 'QuickBooks', category: 'Payments & Finance', description: 'SMB accounting & invoicing', free: false, stars: 3, logoColor: '#2CA01C' },

  // Calendar & Meetings
  { id: 'google_calendar', name: 'Google Calendar', category: 'Calendar & Meetings', description: 'Schedule employer & client meetings', free: true, stars: 5, logoColor: '#4285F4', oauthUrl: 'https://accounts.google.com/signin' },
  { id: 'ms_calendar', name: 'Microsoft Calendar', category: 'Calendar & Meetings', description: 'Outlook calendar sync & booking', free: true, stars: 5, logoColor: '#0078D4', oauthUrl: 'https://login.microsoftonline.com' },
  { id: 'zoom', name: 'Zoom', category: 'Calendar & Meetings', description: 'Video interviews & client calls', free: true, stars: 4, logoColor: '#2D8CFF' },
  { id: 'google_meet', name: 'Google Meet', category: 'Calendar & Meetings', description: 'Free video calls for employer meetings', free: true, stars: 4, logoColor: '#00897B', oauthUrl: 'https://accounts.google.com/signin' },
  { id: 'calendly', name: 'Calendly', category: 'Calendar & Meetings', description: 'Self-serve meeting booking links', free: true, stars: 4, logoColor: '#006BFF' },

  // Storage & Docs
  { id: 'google_drive', name: 'Google Drive', category: 'Storage & Docs', description: 'Client contracts & resume storage', free: true, stars: 5, logoColor: '#34A853', oauthUrl: 'https://accounts.google.com/signin' },
  { id: 'onedrive', name: 'Microsoft OneDrive', category: 'Storage & Docs', description: 'Enterprise document management', free: true, stars: 4, logoColor: '#0078D4', oauthUrl: 'https://login.microsoftonline.com' },
  { id: 'dropbox', name: 'Dropbox', category: 'Storage & Docs', description: 'File sharing & team collaboration', free: true, stars: 3, logoColor: '#0061FF' },

  // AI Providers
  { id: 'openai', name: 'OpenAI', category: 'AI Providers', description: 'GPT-4o for content & reasoning tasks', free: false, stars: 5, logoColor: '#000000' },
  { id: 'anthropic', name: 'Anthropic Claude', category: 'AI Providers', description: 'Long context & coding capabilities', free: false, stars: 5, logoColor: '#D97757' },
  { id: 'gemini', name: 'Google Gemini', category: 'AI Providers', description: 'Multimodal AI with Google grounding', free: true, stars: 5, logoColor: '#4285F4' },
  { id: 'ollama', name: 'Ollama', category: 'AI Providers', description: 'Run AI models locally for free', free: true, stars: 5, logoColor: '#1A1A1A' },
  { id: 'groq', name: 'Groq', category: 'AI Providers', description: 'Fastest AI inference, generous free tier', free: true, stars: 4, logoColor: '#F55036' },
  { id: 'openrouter', name: 'OpenRouter', category: 'AI Providers', description: 'Unified API for 100+ AI models', free: true, stars: 4, logoColor: '#6750A4' },
  { id: 'deepseek', name: 'DeepSeek', category: 'AI Providers', description: 'Open-source reasoning model', free: true, stars: 4, logoColor: '#4D6BF5' },
  { id: 'mistral', name: 'Mistral AI', category: 'AI Providers', description: 'European open-weight models', free: true, stars: 4, logoColor: '#FF7000' },

  // Developer & Automation
  { id: 'github_dev', name: 'GitHub', category: 'Developer & Automation', description: 'Code, CI/CD & Actions automation', free: true, stars: 5, logoColor: '#24292E', oauthUrl: 'https://github.com/login' },
  { id: 'vercel', name: 'Vercel', category: 'Developer & Automation', description: 'Frontend deployment & preview URLs', free: true, stars: 4, logoColor: '#000000' },
  { id: 'supabase_dev', name: 'Supabase', category: 'Developer & Automation', description: 'Realtime database, auth & edge functions', free: true, stars: 5, logoColor: '#3ECF8E' },
  { id: 'n8n', name: 'n8n', category: 'Developer & Automation', description: 'Self-hosted workflow automation', free: true, stars: 5, logoColor: '#EA4B71' },
  { id: 'cloudflare', name: 'Cloudflare', category: 'Developer & Automation', description: 'CDN, DNS & Workers edge functions', free: true, stars: 4, logoColor: '#F48120' },
  { id: 'netlify', name: 'Netlify', category: 'Developer & Automation', description: 'Jamstack hosting & forms', free: true, stars: 3, logoColor: '#00C7B7' },
  { id: 'temporal', name: 'Temporal', category: 'Developer & Automation', description: 'Durable workflow orchestration engine', free: true, stars: 4, logoColor: '#1C2C5E' },

  // Public Intelligence
  { id: 'hackernews', name: 'Hacker News API', category: 'Public Intelligence', description: '"Who is Hiring" — startup employer discovery', free: true, stars: 5, logoColor: '#FF6600' },
  { id: 'product_hunt', name: 'Product Hunt API', category: 'Public Intelligence', description: 'Track new tools & competitor launches', free: true, stars: 4, logoColor: '#DA552F' },
  { id: 'rss_feeds', name: 'RSS Feed Aggregator', category: 'Public Intelligence', description: 'Monitor industry news & funding rounds', free: true, stars: 4, logoColor: '#FFA500' },
  { id: 'govt_datasets', name: 'Government Open Datasets', category: 'Public Intelligence', description: 'AICTE, NIRF, MCA company data', free: true, stars: 4, logoColor: '#003087' },
  { id: 'startup_funding', name: 'Startup Funding Feeds', category: 'Public Intelligence', description: 'Track recently funded companies to pitch', free: true, stars: 4, logoColor: '#6C5CE7' },
  { id: 'career_pages', name: 'Company Career Page Scanner', category: 'Public Intelligence', description: 'Detect companies hiring without job boards', free: true, stars: 4, logoColor: '#00B894' },
];

// ── Recommended Top Bundles ───────────────────────────────────────────────────

const TOP_BUNDLES: TopBundle[] = [
  {
    id: 'google_workspace',
    name: 'Google Workspace',
    tagline: 'Connect once → Analytics, Search Console, Business Profile, Gmail, Calendar, Drive, YouTube',
    stars: 5,
    color: '#4285F4',
    services: ['Google Analytics 4', 'Google Search Console', 'Google Business Profile', 'Gmail', 'Google Calendar', 'Google Drive', 'YouTube'],
    integrationIds: ['ga4', 'gsc', 'gbp', 'gmail', 'google_calendar', 'google_drive', 'youtube'],
    oauthUrl: 'https://accounts.google.com/signin',
  },
  {
    id: 'microsoft365',
    name: 'Microsoft 365',
    tagline: 'Connect once → Outlook, Teams, Calendar, OneDrive, SharePoint',
    stars: 5,
    color: '#0078D4',
    services: ['Outlook', 'Microsoft Teams', 'Microsoft Calendar', 'OneDrive', 'Microsoft Clarity'],
    integrationIds: ['outlook', 'ms_teams', 'ms_calendar', 'onedrive', 'clarity'],
    oauthUrl: 'https://login.microsoftonline.com',
  },
  {
    id: 'meta_business',
    name: 'Meta Business Suite',
    tagline: 'Connect once → WhatsApp Business, Facebook Page, Instagram Business',
    stars: 5,
    color: '#1877F2',
    services: ['WhatsApp Business', 'Facebook Pages', 'Instagram Business', 'Threads'],
    integrationIds: ['whatsapp_business', 'facebook', 'instagram', 'threads'],
    oauthUrl: 'https://business.facebook.com',
  },
  {
    id: 'linkedin_bundle',
    name: 'LinkedIn',
    tagline: 'Professional outreach, employer connections & thought leadership',
    stars: 5,
    color: '#0077B5',
    services: ['LinkedIn Company Page', 'LinkedIn Recruiter Lite', 'LinkedIn Analytics'],
    integrationIds: ['linkedin'],
    oauthUrl: 'https://www.linkedin.com/login',
  },
  {
    id: 'github_bundle',
    name: 'GitHub',
    tagline: 'Developer sourcing, engineering insights & open-source intelligence',
    stars: 5,
    color: '#24292E',
    services: ['GitHub Jobs Intelligence', 'Developer Profile Discovery', 'GitHub Actions CI/CD'],
    integrationIds: ['github_jobs', 'github_dev'],
    oauthUrl: 'https://github.com/login',
  },
  {
    id: 'razorpay_bundle',
    name: 'Razorpay',
    tagline: 'India payments, real-time revenue tracking & subscription billing',
    stars: 5,
    color: '#3395FF',
    services: ['Payment Collection', 'Subscription Billing', 'Invoice Automation', 'Settlement Reports'],
    integrationIds: ['razorpay'],
    oauthUrl: 'https://dashboard.razorpay.com',
  },
  {
    id: 'talentxcel_bundle',
    name: 'TalentXcel Platform',
    tagline: 'Connect your own platform for candidate ATS, employer CRM & job matching',
    stars: 5,
    color: '#10B981',
    services: ['Candidate ATS', 'Employer CRM', 'Job Matching Engine', 'Resume Builder Data'],
    integrationIds: ['talentxcel'],
    oauthUrl: 'https://talentxcel.in',
  },
];

const CATEGORIES: IntegrationCategory[] = [
  'Analytics & BI', 'Search & SEO', 'Social & Publishing',
  'Recruitment & Jobs', 'CRM & Sales', 'Communication',
  'Payments & Finance', 'Calendar & Meetings', 'Storage & Docs',
  'AI Providers', 'Developer & Automation', 'Public Intelligence',
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Analytics & BI': <BarChart3 className="w-3.5 h-3.5" />,
  'Search & SEO': <Search className="w-3.5 h-3.5" />,
  'Social & Publishing': <Globe className="w-3.5 h-3.5" />,
  'Recruitment & Jobs': <Users className="w-3.5 h-3.5" />,
  'CRM & Sales': <Target className="w-3.5 h-3.5" />,
  'Communication': <Mail className="w-3.5 h-3.5" />,
  'Payments & Finance': <DollarSign className="w-3.5 h-3.5" />,
  'Calendar & Meetings': <Activity className="w-3.5 h-3.5" />,
  'Storage & Docs': <Package className="w-3.5 h-3.5" />,
  'AI Providers': <Sparkles className="w-3.5 h-3.5" />,
  'Developer & Automation': <Code2 className="w-3.5 h-3.5" />,
  'Public Intelligence': <Rss className="w-3.5 h-3.5" />,
};

// ── Business Types & Goals ─────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { id: 'recruitment', label: 'Recruitment Agency', icon: <Users className="w-5 h-5" />, description: 'IT staffing, talent matching, campus hiring' },
  { id: 'saas', label: 'SaaS Startup', icon: <Rocket className="w-5 h-5" />, description: 'Software product, subscriptions, growth' },
  { id: 'consulting', label: 'Consulting Firm', icon: <Briefcase className="w-5 h-5" />, description: 'Advisory, projects, enterprise clients' },
  { id: 'ecommerce', label: 'E-commerce', icon: <ShoppingBag className="w-5 h-5" />, description: 'Online store, products, fulfilment' },
  { id: 'education', label: 'Education / EdTech', icon: <GraduationCap className="w-5 h-5" />, description: 'Courses, LMS, student placement' },
  { id: 'hospital', label: 'Healthcare / Hospital', icon: <Heart className="w-5 h-5" />, description: 'Clinics, labs, patient management' },
  { id: 'realestate', label: 'Real Estate', icon: <Home className="w-5 h-5" />, description: 'Properties, leads, site visits' },
  { id: 'restaurant', label: 'Restaurant / Food', icon: <UtensilsCrossed className="w-5 h-5" />, description: 'Dine-in, delivery, menus, reviews' },
  { id: 'manufacturing', label: 'Manufacturing', icon: <Factory className="w-5 h-5" />, description: 'Production, supply chain, B2B sales' },
  { id: 'other', label: 'Other Business', icon: <Building2 className="w-5 h-5" />, description: 'Tell CHATR more in the next step' },
];

const BUSINESS_GOALS = [
  { id: 'grow_traffic', label: 'Get More Customers / Website Visitors', icon: <Globe className="w-4 h-4" />, description: 'SEO, social media, content marketing' },
  { id: 'hire_faster', label: 'Hire People Faster', icon: <Users className="w-4 h-4" />, description: 'Job boards, candidate sourcing, ATS' },
  { id: 'increase_sales', label: 'Increase Sales & Revenue', icon: <TrendingUp className="w-4 h-4" />, description: 'CRM, proposals, follow-ups, payments' },
  { id: 'automate_ops', label: 'Automate Daily Business Operations', icon: <Zap className="w-4 h-4" />, description: 'Reports, emails, data entry, scheduling' },
  { id: 'improve_marketing', label: 'Improve Marketing & Brand Awareness', icon: <Sparkles className="w-4 h-4" />, description: 'LinkedIn, Google Business, campaigns' },
  { id: 'reduce_costs', label: 'Reduce Costs & Eliminate Manual Work', icon: <DollarSign className="w-4 h-4" />, description: 'Automation, open-source tools, AI agents' },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AIAgentsHub() {
  const navigate = useNavigate();
  const [step, setStep] = useState<SetupStep>('business_type');
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [isThinking, setIsThinking] = useState(false);

  // Marketplace state
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [waitingId, setWaitingId] = useState<string | null>(null);
  const [showAllIntegrations, setShowAllIntegrations] = useState(false);
  const [marketplaceTab, setMarketplaceTab] = useState<'recommended' | 'all' | 'installed'>('recommended');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedBiz = BUSINESS_TYPES.find(b => b.id === selectedBusiness);
  const installedCount = installedIds.size;
  const totalAvailable = ALL_INTEGRATIONS.length;

  // ── OAuth Popup Handler ──
  const openOAuth = (url: string, id: string, name: string) => {
    const w = 520, h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(url, `${id}_oauth`, `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`);
    if (!popup) {
      toast.error('Popup blocked! Allow popups for this site in your browser settings.');
      return;
    }
    setWaitingId(id);
    toast.info(`${name} sign-in opened. Complete sign-in, then click "Confirm" below.`);
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        setWaitingId(null);
        setInstalledIds(prev => new Set([...prev, id]));
        toast.success(`✅ ${name} connected!`);
      }
    }, 800);
  };

  const confirmConnect = (id: string, name: string, extraIds?: string[]) => {
    setWaitingId(null);
    const next = new Set([...installedIds, id, ...(extraIds || [])]);
    setInstalledIds(next);
    toast.success(`✅ ${name} connected! ${extraIds ? `${extraIds.length + 1} services unlocked.` : ''}`);
  };

  const handleBundleConnect = (bundle: TopBundle) => {
    openOAuth(bundle.oauthUrl, bundle.id, bundle.name);
  };

  const handleIntegrationConnect = (intg: Integration) => {
    if (intg.oauthUrl) {
      openOAuth(intg.oauthUrl, intg.id, intg.name);
    } else {
      setInstalledIds(prev => new Set([...prev, intg.id]));
      toast.success(`✅ ${intg.name} connected!`);
    }
  };

  const filteredIntegrations = useMemo(() => {
    return ALL_INTEGRATIONS.filter(intg => {
      const matchCat = selectedCategory === 'All' || intg.category === selectedCategory;
      const matchSearch = !searchQuery || intg.name.toLowerCase().includes(searchQuery.toLowerCase()) || intg.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const renderStars = (count: number) => (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= count ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`} />
      ))}
    </span>
  );

  const STEPS = ['business_type','goals','ai_recommendation','marketplace','done'];
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="flex flex-col w-full h-[calc(100vh-42px)] overflow-y-auto bg-[#080a11] text-slate-100 font-sans pb-20">

      {/* ── Header ── */}
      <div className="sticky top-0 z-40 bg-[#0d0f1a]/95 backdrop-blur-xl border-b border-white/10 px-6 py-3 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-white">CHATR Business OS Setup</h1>
              <p className="text-[11px] text-slate-400">{totalAvailable} integrations available · {installedCount} installed</p>
            </div>
          </div>

          {/* Step Breadcrumb */}
          <div className="hidden sm:flex items-center gap-1">
            {['Business', 'Goals', 'AI Plan', 'Connect', 'Live'].map((label, i) => (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                  i === stepIdx ? 'bg-emerald-500 text-white' :
                  i < stepIdx ? 'bg-emerald-950/60 text-emerald-400' : 'text-slate-600'}`}>
                  {i < stepIdx ? <CheckCircle2 className="w-3 h-3" /> : <span>{i+1}</span>}
                  <span className="hidden md:inline">{label}</span>
                </div>
                {i < 4 && <ChevronRight className="w-3 h-3 text-slate-700" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
        <AnimatePresence mode="wait">

          {/* ══ STEP 1: BUSINESS TYPE ══ */}
          {step === 'business_type' && (
            <motion.div key="s1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-extrabold text-white">Welcome to CHATR</h2>
                <p className="text-slate-400 text-sm">What business do you run? CHATR will automatically recommend the right integrations.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {BUSINESS_TYPES.map(biz => (
                  <button key={biz.id} onClick={() => setSelectedBusiness(biz.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2 ${selectedBusiness === biz.id ? 'border-emerald-500 bg-emerald-950/40' : 'border-white/10 bg-[#0d0f1a] hover:border-white/20'}`}>
                    <div className={`p-2 rounded-xl w-fit ${selectedBusiness === biz.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>{biz.icon}</div>
                    <div>
                      <h3 className="text-xs font-bold text-white leading-tight">{biz.label}</h3>
                      <p className="text-[9px] text-slate-500 leading-relaxed mt-0.5">{biz.description}</p>
                    </div>
                    {selectedBusiness === biz.id && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </button>
                ))}
              </div>

              <div className="flex justify-center">
                <button disabled={!selectedBusiness} onClick={() => setStep('goals')}
                  className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm transition-all ${selectedBusiness ? 'bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer shadow-lg' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}>
                  <span>Continue</span><ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ══ STEP 2: GOALS ══ */}
          {step === 'goals' && (
            <motion.div key="s2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="text-center space-y-2">
                <div className="p-3 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 w-fit mx-auto"><Target className="w-6 h-6 text-indigo-400" /></div>
                <h2 className="text-2xl font-extrabold text-white">What are your goals?</h2>
                <p className="text-slate-400 text-sm">Select all that apply. CHATR builds your integration stack around these outcomes.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BUSINESS_GOALS.map(goal => {
                  const sel = selectedGoals.has(goal.id);
                  return (
                    <button key={goal.id} onClick={() => setSelectedGoals(prev => { const n = new Set(prev); n.has(goal.id) ? n.delete(goal.id) : n.add(goal.id); return n; })}
                      className={`p-4 rounded-2xl border text-left flex items-start gap-3 cursor-pointer transition-all ${sel ? 'border-indigo-500 bg-indigo-950/40' : 'border-white/10 bg-[#0d0f1a] hover:border-white/20'}`}>
                      <div className={`p-2 rounded-xl flex-shrink-0 ${sel ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-slate-500'}`}>{goal.icon}</div>
                      <div className="flex-1">
                        <h3 className="text-xs font-bold text-white">{goal.label}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">{goal.description}</p>
                      </div>
                      {sel && <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-center gap-3">
                <button onClick={() => setStep('business_type')} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 bg-white/5 hover:bg-white/10 cursor-pointer">Back</button>
                <button onClick={() => { setIsThinking(true); setTimeout(() => { setIsThinking(false); setStep('ai_recommendation'); }, 2200); }}
                  disabled={selectedGoals.size === 0 || isThinking}
                  className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm transition-all ${selectedGoals.size > 0 && !isThinking ? 'bg-indigo-500 hover:bg-indigo-400 text-white cursor-pointer' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}>
                  {isThinking ? <><RefreshCw className="w-4 h-4 animate-spin" /><span>CHATR is thinking...</span></> : <><Sparkles className="w-4 h-4" /><span>Build My Integration Stack</span></>}
                </button>
              </div>
            </motion.div>
          )}

          {/* ══ STEP 3: AI RECOMMENDATION ══ */}
          {step === 'ai_recommendation' && (
            <motion.div key="s3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-indigo-950/40 to-slate-900 border border-emerald-500/40 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">CHATR Business OS AI</span>
                    <p className="text-xs text-slate-400">Recommended for <strong className="text-white">{selectedBiz?.label}</strong></p>
                  </div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 font-mono text-xs space-y-1 border border-white/5">
                  <p className="text-emerald-400">We know how {selectedBiz?.label?.toLowerCase()} companies grow.</p>
                  <p className="text-slate-300 mt-2">I've selected <strong className="text-white">7 priority bundles</strong> and <strong className="text-white">{ALL_INTEGRATIONS.length}+ available integrations</strong> for you.</p>
                  <p className="text-slate-400">Estimated setup: <strong className="text-amber-400">~18 minutes</strong> · Cost: <strong className="text-emerald-400">₹0 for 80% of integrations</strong></p>
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <button onClick={() => setStep('goals')} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 bg-white/5 hover:bg-white/10 cursor-pointer">Adjust Goals</button>
                <button onClick={() => setStep('marketplace')}
                  className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer shadow-lg transition-all">
                  <Store className="w-4 h-4" /><span>Open Integration Marketplace</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ══ STEP 4: INTEGRATION MARKETPLACE ══ */}
          {step === 'marketplace' && (
            <motion.div key="s4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">

              {/* Header Row */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                    <Store className="w-5 h-5 text-emerald-400" />
                    CHATR Integration Marketplace
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">{totalAvailable}+ integrations · {installedCount} installed · Recommended for {selectedBiz?.label}</p>
                </div>
                {installedCount > 0 && (
                  <button onClick={() => setStep('done')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer shadow-lg transition-all">
                    <span>Finish Setup</span><ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* ── RECOMMENDED BUNDLES (Top 7) ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    Recommended for {selectedBiz?.label}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">7 Priority Bundles</span>
                </div>

                <div className="space-y-2">
                  {TOP_BUNDLES.map(bundle => {
                    const isInstalled = bundle.integrationIds.every(id => installedIds.has(id)) || installedIds.has(bundle.id);
                    const isWaiting = waitingId === bundle.id;
                    return (
                      <div key={bundle.id} className={`p-4 rounded-2xl border transition-all ${isInstalled ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-white/10 bg-[#0d0f1a] hover:border-white/20'}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: bundle.color }}>
                              {bundle.name.slice(0,2)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-white">{bundle.name}</h4>
                                {renderStars(bundle.stars)}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">{bundle.tagline}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {bundle.services.map(s => (
                                  <span key={s} className="text-[9px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{s}</span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex-shrink-0 w-40">
                            {isInstalled ? (
                              <div className="py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-[11px] font-bold text-emerald-400 flex items-center justify-center gap-1">
                                <Check className="w-3 h-3" /> Connected
                              </div>
                            ) : isWaiting ? (
                              <div className="space-y-1.5">
                                <div className="py-1.5 px-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center text-[10px] text-amber-300 flex items-center justify-center gap-1">
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Sign-in open...
                                </div>
                                <button
                                  onClick={() => confirmConnect(bundle.id, bundle.name, bundle.integrationIds)}
                                  className="w-full py-1.5 rounded-lg text-[11px] font-extrabold text-white cursor-pointer"
                                  style={{ background: bundle.color }}>
                                  ✓ I've signed in
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleBundleConnect(bundle)}
                                className="w-full py-2 rounded-xl text-[11px] font-bold text-white cursor-pointer hover:opacity-90 transition-all"
                                style={{ background: bundle.color }}>
                                Connect {bundle.name.split(' ')[0]}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Show More Toggle */}
                <button onClick={() => setShowAllIntegrations(v => !v)}
                  className="w-full py-2.5 rounded-xl border border-white/10 bg-[#0d0f1a] hover:border-white/20 text-xs font-bold text-slate-400 cursor-pointer flex items-center justify-center gap-2 transition-all">
                  {showAllIntegrations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showAllIntegrations ? 'Hide' : `Show all ${totalAvailable - 7} more integrations`}
                </button>
              </div>

              {/* ── FULL INTEGRATION MARKETPLACE ── */}
              {showAllIntegrations && (
                <div className="space-y-4 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0d0f1a] border border-white/10">
                      {(['recommended','all','installed'] as const).map(tab => (
                        <button key={tab} onClick={() => setMarketplaceTab(tab)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all capitalize ${marketplaceTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                          {tab === 'installed' ? `Installed (${installedCount})` : tab === 'all' ? `All (${totalAvailable})` : `Recommended (18)`}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search integrations..."
                        className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white/5 border border-white/10 text-white outline-none w-44 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setSelectedCategory('All')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${selectedCategory === 'All' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'}`}>
                      <Grid className="w-3 h-3" /> All
                    </button>
                    {CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setSelectedCategory(cat)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'}`}>
                        {CATEGORY_ICONS[cat]} {cat}
                      </button>
                    ))}
                  </div>

                  {/* Integration Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredIntegrations
                      .filter(intg => {
                        if (marketplaceTab === 'installed') return installedIds.has(intg.id);
                        return true;
                      })
                      .map(intg => {
                        const installed = installedIds.has(intg.id);
                        const waiting = waitingId === intg.id;
                        return (
                          <div key={intg.id} className={`p-3.5 rounded-xl border transition-all ${installed ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-white/[0.07] bg-[#0d0f1a] hover:border-white/15'}`}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[9px] font-extrabold" style={{ background: intg.logoColor }}>
                                  {intg.name.slice(0,2)}
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white leading-tight">{intg.name}</h4>
                                  <span className="text-[9px] text-slate-500">{intg.category}</span>
                                </div>
                              </div>
                              {renderStars(intg.stars)}
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mb-2">{intg.description}</p>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${intg.free ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                                {intg.free ? 'Free' : 'Paid'}
                              </span>
                              {installed ? (
                                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Connected</span>
                              ) : waiting ? (
                                <button onClick={() => confirmConnect(intg.id, intg.name)}
                                  className="text-[10px] font-extrabold text-white px-2 py-1 rounded-lg cursor-pointer" style={{ background: intg.logoColor }}>
                                  ✓ I've signed in
                                </button>
                              ) : (
                                <button onClick={() => handleIntegrationConnect(intg)}
                                  className="text-[10px] font-bold text-white px-2.5 py-1 rounded-lg cursor-pointer hover:opacity-90 flex items-center gap-1" style={{ background: intg.logoColor }}>
                                  <Plus className="w-3 h-3" /> Add
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Marketplace Status Bar */}
              <div className="sticky bottom-0 bg-[#0d0f1a]/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs">
                  <div className="text-center">
                    <div className="text-lg font-extrabold text-emerald-400">{installedCount}</div>
                    <div className="text-slate-500 text-[9px] uppercase font-bold">Installed</div>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-center">
                    <div className="text-lg font-extrabold text-indigo-400">7</div>
                    <div className="text-slate-500 text-[9px] uppercase font-bold">Recommended</div>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div className="text-center">
                    <div className="text-lg font-extrabold text-slate-400">{totalAvailable}+</div>
                    <div className="text-slate-500 text-[9px] uppercase font-bold">Available</div>
                  </div>
                </div>

                {installedCount > 0 ? (
                  <button onClick={() => setStep('done')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer shadow-lg transition-all">
                    <Zap className="w-4 h-4" /><span>Start CHATR OS ({installedCount} connected)</span>
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 italic">Connect at least 1 account to continue →</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ══ STEP 5: DONE ══ */}
          {step === 'done' && (
            <motion.div key="s5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-6 text-center">
              <div className="space-y-3">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                  className="w-20 h-20 rounded-full mx-auto flex items-center justify-center shadow-2xl shadow-emerald-500/20"
                  style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>
                <h2 className="text-2xl font-extrabold text-white">CHATR Business OS is now live.</h2>
                <p className="text-slate-400 text-sm">{installedCount} integrations connected. Your first CEO morning briefing arrives tomorrow at 8:00 AM.</p>
              </div>

              <div className="p-5 rounded-2xl bg-[#0d0f1a] border border-white/10 text-left space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> CHATR is now running on autopilot</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {['Monitoring Google Search rankings daily','Tracking employer career pages for new openings','Discovering college placement officers','Scanning HackerNews & GitHub for developer talent','Drafting LinkedIn content for your approval','Preparing CEO morning briefing'].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-slate-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />{t}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                <Coffee className="w-4 h-4 flex-shrink-0" />
                <span>First CEO morning briefing at <strong>8:00 AM tomorrow</strong>. CHATR will report what it discovered overnight.</span>
              </div>

              <div className="flex justify-center gap-3">
                <button onClick={() => setStep('marketplace')} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 bg-white/5 hover:bg-white/10 cursor-pointer">Add More Integrations</button>
                <button onClick={() => navigate('/')}
                  className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer shadow-lg transition-all">
                  <span>Open CEO Dashboard</span><ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
