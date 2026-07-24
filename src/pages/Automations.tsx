import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
 Menu, Bell, Search, Settings2, Play, Pause, Trash2, Edit2, 
 Zap, Plus, ShieldCheck, Car, Cloud, Briefcase, FileText, CheckCircle2, 
 Lightbulb, Activity, Home, Grid, Clock, Sparkles, MessageSquare, Save, Inbox, User, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RuleBuilderDialog } from '@/components/automations/RuleBuilderDialog';
import { motion } from 'framer-motion';

const PREDEFINED_TEMPLATES: Record<string, any> = {
 'driving': {
 name: "Auto-reply while driving",
 trigger_type: "message_received",
 conditions: [{ field: 'content', operator: 'matches_ai', value: 'Driving context' }],
 action_type: "auto_reply",
 action_payload: { reply_text: "I'm currently driving and will get back to you soon!" }
 },
 'archive_otp': {
 name: "Archive old OTPs",
 trigger_type: "message_received",
 conditions: [{ field: 'content', operator: 'matches_ai', value: 'OTP' }],
 action_type: "archive",
 action_payload: {}
 },
 'invoices': {
 name: "Save invoices to Cloud",
 trigger_type: "message_received",
 conditions: [{ field: 'content', operator: 'matches_ai', value: 'Invoice or Receipt' }],
 action_type: "save_to_cloud",
 action_payload: {}
 },
 'scam_protection': {
 name: "Scam Protection",
 trigger_type: "message_received",
 conditions: [{ field: 'content', operator: 'matches_ai', value: 'Phishing or Scam' }],
 action_type: "archive",
 action_payload: {}
 },
 'smart_inbox': {
 name: "Smart Inbox Categorization",
 trigger_type: "message_received",
 conditions: [{ field: 'content', operator: 'matches_ai', value: 'Spam or Promotional' }],
 action_type: "archive",
 action_payload: {}
 }
};

export default function Automations() {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const { toast } = useToast();
 
 const templatesRef = useRef<HTMLDivElement>(null);
 const insightsRef = useRef<HTMLDivElement>(null);
 
 const [userId, setUserId] = useState<string | null>(null);
 const [userProfile, setUserProfile] = useState<any>(null);
 const [rules, setRules] = useState<any[]>([]);
 const [metrics, setMetrics] = useState({ runs_today: 0, time_saved_minutes: 0 });
 const [insights, setInsights] = useState<any[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 
 const [isBuilderOpen, setIsBuilderOpen] = useState(false);
 const [editingRule, setEditingRule] = useState<any>(null);
 const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Inactive'>('All');
 const [activeCategory, setActiveCategory] = useState<string>('⭐ Popular');

 const fetchRules = async (currentUserId: string) => {
 try {
 setIsLoading(true);
 const [rulesRes, metricsRes, logsRes] = await Promise.all([
 supabase.from('automation_rules').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }),
 supabase.rpc('get_automation_metrics', { p_user_id: currentUserId }),
 supabase.from('automation_logs').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }).limit(3)
 ]);
 
 if (rulesRes.error) throw rulesRes.error;
 setRules(rulesRes.data || []);
 
 if (!metricsRes.error && metricsRes.data) {
 setMetrics(metricsRes.data as any);
 }
 
 if (!logsRes.error && logsRes.data) {
 setInsights(logsRes.data);
 }
 } catch (err: any) {
 toast.error('Failed to load automations');
 } finally {
 setIsLoading(false);
 }
 };

 useEffect(() => {
 let subscription: any;
 const init = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 setUserId(user.id);
 const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
 setUserProfile(profile);
 fetchRules(user.id);

 // Subscribe to real-time changes
 subscription = supabase.channel('public:automation_rules')
 .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_rules', filter: `user_id=eq.${user.id}` }, payload => {
 fetchRules(user.id);
 })
 .subscribe();

 // Handle Deep Linking
 const templateId = searchParams.get('template');
 const action = searchParams.get('action');
 if (action === 'create') {
 if (templateId && PREDEFINED_TEMPLATES[templateId]) {
 openBuilder(PREDEFINED_TEMPLATES[templateId]);
 } else {
 openBuilder();
 }
 }
 }
 };
 init();

 return () => {
 if (subscription) {
 supabase.removeChannel(subscription);
 }
 };
 }, [searchParams]);

 const toggleRule = async (ruleId: string, currentState: boolean) => {
 try {
 setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: !currentState } : r));
 const { error } = await supabase.from('automation_rules').update({ is_active: !currentState }).eq('id', ruleId);
 if (error) throw error;
 toast.success(currentState ? 'Automation paused' : 'Automation activated');
 } catch (err) {
 setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: currentState } : r));
 toast.error('Failed to update automation');
 }
 };

 const deleteRule = async (ruleId: string) => {
 if (!confirm('Are you sure you want to delete this workflow?')) return;
 try {
 const { error } = await supabase.from('automation_rules').delete().eq('id', ruleId);
 if (error) throw error;
 setRules(prev => prev.filter(r => r.id !== ruleId));
 toast.success('Workflow deleted');
 } catch (err) {
 toast.error('Failed to delete workflow');
 }
 };

 const openBuilder = (rule?: any) => {
 setEditingRule(rule || null);
 setIsBuilderOpen(true);
 };

 const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
 if (ref.current) {
 ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
 }
 };

 const filteredRules = rules.filter(r => {
 // Tab filter
 if (activeTab === 'Active' && !r.is_active) return false;
 if (activeTab === 'Inactive' && r.is_active) return false;
 // Search filter
 if (searchQuery.trim()) {
 return r.name.toLowerCase().includes(searchQuery.toLowerCase());
 }
 return true;
 });

 return (
 <div className="flex flex-col h-screen bg-gray-50 pb-24 relative overflow-hidden">
 
 {/* Dynamic Background Mesh (subtle) */}
 <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-indigo-50/70 via-purple-50/70 to-white -z-10" />

 {/* Header */}
 <header className="px-4 py-3 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-xl z-20 border-b border-gray-100">
 <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors">
 <Menu className="w-5 h-5 text-gray-700" />
 </button>
 
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
 <Zap className="w-4 h-4 text-blue-600" />
 </div>
 <h1 className="text-section font-bold text-gray-900">Automation Engine</h1>
 </div>

 <div className="flex items-center gap-3">
 <button onClick={() => navigate('/notifications')} className="relative">
 <Bell className="w-5 h-5 text-gray-600 hover:text-gray-900 transition-colors" />
 <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">3</span>
 </button>
 <button onClick={() => navigate('/settings')} className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 overflow-hidden border-2 border-white shadow-sm flex items-center justify-center hover:scale-105 transition-transform">
 {userProfile?.avatar_url ? (
 <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
 ) : (
 <User className="w-4 h-4 text-white" />
 )}
 </button>
 </div>
 </header>

 <main className="flex-1 overflow-y-auto w-full">
 <div className="max-w-md mx-auto space-y-6 pt-4 pb-12">
 
 {/* Automation Metrics Overview */}
 <div className="px-4">
 <div className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100 flex items-center justify-between">
 <div className="text-center">
 <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Active</p>
 <p className="text-workspace font-black text-gray-900">{rules.filter(r => r.is_active).length}</p>
 </div>
 <div className="w-px h-8 bg-gray-100" />
 <div className="text-center">
 <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Runs Today</p>
 <p className="text-workspace font-black text-emerald-600">{metrics.runs_today || 0}</p>
 </div>
 <div className="w-px h-8 bg-gray-100" />
 <div className="text-center">
 <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Time Saved</p>
 <p className="text-workspace font-black text-[#5c22ff]">{metrics.time_saved_minutes > 60 ? `${Math.floor(metrics.time_saved_minutes / 60)}h ${metrics.time_saved_minutes % 60}m` : `${metrics.time_saved_minutes || 0}m`}</p>
 </div>
 </div>
 </div>

 {/* Search Bar */}
 <div className="px-4">
 <div className="relative flex items-center">
 <Search className="w-5 h-5 text-gray-400 absolute left-4" />
 <input 
 type="text" 
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search workflows, templates..." 
 className="w-full h-12 bg-white rounded-full pl-12 pr-12 text-[15px] font-medium shadow-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#5c22ff]/20"
 />
 {searchQuery && (
 <button onClick={() => setSearchQuery('')} className="absolute right-4 text-gray-400 hover:text-gray-900 transition-colors">
 <Settings2 className="w-5 h-5" />
 </button>
 )}
 </div>
 </div>

 {/* Interactive Hero Banner */}
 <div className="px-4">
 <div className="bg-gradient-to-br from-[#fcfaff] to-[#fff5fa] rounded-[28px] p-6 shadow-sm border border-purple-100/50 relative overflow-hidden h-[180px]">
 <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-200/40 to-pink-200/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
 
 <div className="relative z-10 w-[55%]">
 <h2 className="text-[22px] font-bold text-gray-900 leading-tight mb-2">
 Let CHATR <span className="text-[#5c22ff]">work for you</span> <Sparkles className="inline w-5 h-5 text-[#5c22ff]" />
 </h2>
 <p className="text-[11px] font-medium text-gray-500 mb-5 leading-relaxed pr-2">
 Set up smart rules to handle messages, sort files, and auto-reply instantly.
 </p>
 
 <div className="flex items-center gap-2">
 <Button onClick={() => openBuilder()} className="bg-[#5c22ff] hover:bg-purple-700 text-white rounded-full h-9 px-4 text-[11px] font-bold shadow-md shadow-purple-500/20">
 <Plus className="w-3.5 h-3.5 mr-1" /> Workflow
 </Button>
 <button onClick={() => navigate('/help')} className="flex items-center gap-1.5 text-gray-700 text-[11px] font-bold hover:text-gray-900 bg-white/50 px-3 py-2 rounded-full border border-gray-200">
 <Play className="w-3 h-3" />
 How it works
 </button>
 </div>
 </div>

 {/* Animated Graphic Right Side */}
 <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[160px] h-[160px]">
 {/* Connecting Lines */}
 <svg className="absolute inset-0 w-full h-full text-purple-200" style={{ strokeDasharray: '4,4' }}>
 <line x1="30" y1="40" x2="80" y2="80" stroke="currentColor" strokeWidth="1.5" />
 <line x1="130" y1="40" x2="80" y2="80" stroke="currentColor" strokeWidth="1.5" />
 <line x1="30" y1="120" x2="80" y2="80" stroke="currentColor" strokeWidth="1.5" />
 <line x1="130" y1="120" x2="80" y2="80" stroke="currentColor" strokeWidth="1.5" />
 </svg>

 {/* Nodes */}
 <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="absolute top-4 left-4 w-9 h-9 rounded-full bg-[#5c22ff] shadow-lg shadow-purple-500/30 flex items-center justify-center text-white">
 <MessageSquare className="w-4 h-4 fill-white text-white" />
 </motion.div>
 <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1, ease: "easeInOut" }} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/30 flex items-center justify-center text-white">
 <Settings2 className="w-4 h-4" />
 </motion.div>
 <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.5, ease: "easeInOut" }} className="absolute bottom-4 left-4 w-9 h-9 rounded-full bg-orange-400 shadow-lg shadow-orange-500/30 flex items-center justify-center text-white">
 <Cloud className="w-4 h-4 fill-white text-white" />
 </motion.div>
 <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: 1.5, ease: "easeInOut" }} className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-pink-500 shadow-lg shadow-pink-500/30 flex items-center justify-center text-white">
 <Zap className="w-4 h-4 fill-white text-white" />
 </motion.div>

 {/* Center Robot */}
 <motion.div 
 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[52px] h-[52px] bg-white rounded-2xl shadow-xl shadow-purple-500/10 flex items-center justify-center z-10"
 >
 <div className="w-[40px] h-[40px] bg-gradient-to-br from-[#8b5cf6] to-[#5c22ff] rounded-xl flex items-center justify-center text-white">
 <Zap className="w-5 h-5 fill-current" />
 </div>
 </motion.div>
 </div>
 </div>
 </div>

 {/* Premium AI Suggestions (1-Tap) */}
 <div className="px-4">
 <div className="flex items-center gap-2 mb-3">
 <Sparkles className="w-4 h-4 text-amber-500" />
 <h3 className="font-bold text-[15px] text-gray-900">AI Suggestions</h3>
 </div>
 <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
 {[
 { icon: Inbox, text: "Create Smart Inbox", id: "smart_inbox", color: "text-blue-600", bg: "bg-blue-100" },
 { icon: ShieldCheck, text: "Create Scam Protection", id: "scam_protection", color: "text-emerald-600", bg: "bg-emerald-100" },
 { icon: Save, text: "Invoice Scanner", id: "invoices", color: "text-orange-600", bg: "bg-orange-100" },
 ].map((s, i) => (
 <button key={i} onClick={() => openBuilder(PREDEFINED_TEMPLATES[s.id])} className="flex-shrink-0 flex items-center gap-2 bg-white border border-gray-100 px-3 py-2 rounded-2xl shadow-sm hover:shadow-md hover:bg-gray-50 transition-all">
 <div className={`p-1.5 rounded-lg ${s.bg}`}>
 <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
 </div>
 <span className="text-label font-bold text-gray-700">{s.text}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Templates Section */}
 <div className="mt-2" ref={templatesRef}>
 <div className="px-4 flex items-center justify-between mb-3">
 <h3 className="font-bold text-gray-900 text-[15px]">Start with a template</h3>
 </div>

 {/* Categories */}
 <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide px-4 mb-2">
 {['⭐ Popular', '🚗 Driving', '📂 Productivity', '🛡 Security', '🤖 AI'].map((cat) => (
 <button
 key={cat}
 onClick={() => setActiveCategory(cat)}
 className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
 activeCategory === cat 
 ? 'bg-gray-900 text-white shadow-md' 
 : 'bg-white text-gray-600 border border-gray-200'
 }`}
 >
 {cat}
 </button>
 ))}
 </div>

 {/* Template Cards */}
 <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide px-4">
 {[
 { icon: Car, id: 'driving', title: "Auto-reply while driving", desc: "Automatically reply with your driving message.", color: "text-blue-500", bg: "bg-blue-50" },
 { icon: Zap, id: 'archive_otp', title: "Archive old OTPs", desc: "Move OTP messages older than 24 hours to archive.", color: "text-emerald-500", bg: "bg-emerald-50" },
 { icon: Cloud, id: 'invoices', title: "Save invoices to Cloud", desc: "Automatically save invoice attachments.", color: "text-orange-500", bg: "bg-orange-50" },
 { icon: ShieldCheck, id: 'scam_protection', title: "Smart notifications", desc: "Get notified about important messages only.", color: "text-purple-500", bg: "bg-purple-50", isNew: true }
 ].map(template => (
 <div key={template.title} onClick={() => openBuilder(PREDEFINED_TEMPLATES[template.id])} className="flex-shrink-0 w-44 bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col cursor-pointer hover:shadow-md transition-shadow relative">
 {template.isNew && (
 <span className="absolute top-4 right-4 bg-blue-100 text-blue-700 text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full">NEW</span>
 )}
 <div className={`w-12 h-12 rounded-2xl ${template.bg} flex items-center justify-center mb-4`}>
 <template.icon className={`w-6 h-6 ${template.color}`} />
 </div>
 <h4 className="font-bold text-[15px] text-gray-900 leading-tight mb-2">{template.title}</h4>
 <p className="text-[12px] font-medium text-gray-500 leading-snug flex-1 mb-4">{template.desc}</p>
 <div className="text-[13px] font-bold text-[#5c22ff] flex items-center">
 Use template <ArrowLeft className="w-3.5 h-3.5 ml-1.5 rotate-180" />
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Your Workflows */}
 <div className="px-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-bold text-gray-900 text-[15px]">Your Workflows</h3>
 <div className="text-[12px] font-bold text-gray-500 flex items-center cursor-pointer">
 Sort: Last updated <ArrowLeft className="w-3 h-3 ml-1 -rotate-90" />
 </div>
 </div>

 <div className="flex gap-2 mb-4">
 {['All', 'Active', 'Inactive'].map((tab) => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab as any)}
 className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
 activeTab === tab 
 ? 'bg-[#5c22ff] text-white shadow-md' 
 : 'bg-white text-gray-600 border border-gray-200'
 }`}
 >
 {tab}
 </button>
 ))}
 </div>

 {isLoading ? (
 <div className="space-y-3">
 {[1, 2].map(i => <div key={i} className="h-32 bg-white rounded-3xl border border-gray-100 animate-pulse"></div>)}
 </div>
 ) : filteredRules.length === 0 ? (
 <div className="text-center py-12 bg-white rounded-[24px] border border-gray-100 shadow-sm flex flex-col items-center">
 <div className="relative mb-4">
 <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full"></div>
 <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[20px] flex items-center justify-center text-white relative z-10 rotate-[-5deg] shadow-lg">
 <FileText className="w-7 h-7" />
 <Zap className="w-4 h-4 absolute bottom-2 right-2 fill-current" />
 </div>
 <div className="w-16 h-16 bg-gray-200 rounded-[20px] absolute top-1 left-2 rotate-[5deg] z-0"></div>
 </div>
 <h4 className="text-[15px] font-bold text-gray-900 mb-1.5">
 {searchQuery ? 'No workflows match search' : 'No workflows yet'}
 </h4>
 <p className="text-[13px] font-medium text-gray-500 mb-6 max-w-[220px]">
 {searchQuery ? 'Try a different search term.' : 'Create your first automation rule and let CHATR do the work for you.'}
 </p>
 {!searchQuery && (
 <Button onClick={() => openBuilder()} className="bg-[#5c22ff] hover:bg-purple-700 text-white rounded-full h-11 px-6 text-[13px] font-bold shadow-md shadow-purple-500/20">
 <Plus className="w-4 h-4 mr-1.5" /> Create Your First Workflow
 </Button>
 )}
 </div>
 ) : (
 <div className="space-y-3">
 {filteredRules.map(rule => (
 <Card key={rule.id} className="overflow-hidden rounded-3xl border-gray-100 shadow-sm hover:shadow-md transition-all">
 <CardContent className="p-5">
 <div className="flex justify-between items-start mb-4">
 <div className="flex items-center gap-3.5">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${rule.is_active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
 {rule.is_active ? <Zap className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
 </div>
 <div>
 <h4 className={`font-bold text-[15px] leading-tight mb-1 ${rule.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
 {rule.name}
 </h4>
 <div className="flex items-center gap-2">
 {rule.is_active && (
 <span className="text-[10px] font-black tracking-wider text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">ACTIVE</span>
 )}
 <span className="text-[12px] font-medium text-gray-500">Runs Automatically</span>
 </div>
 </div>
 </div>
 <Switch 
 checked={rule.is_active} 
 onCheckedChange={() => toggleRule(rule.id, rule.is_active)}
 className="data-[state=checked]:bg-[#5c22ff]"
 />
 </div>
 
 <div className="bg-gray-50/80 rounded-2xl p-3 flex items-center justify-between border border-gray-100/50">
 <div>
 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Executions Today</p>
 <p className="text-[13px] font-black text-gray-800">{rule.execution_count || 0} runs</p>
 </div>
 <div className="w-px h-8 bg-gray-200" />
 <div>
 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Last Run</p>
 <p className="text-[13px] font-bold text-gray-600 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" /> {rule.last_executed_at ? new Date(rule.last_executed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</p>
 </div>
 <div className="flex gap-1 ml-2">
 <button onClick={() => openBuilder(rule)} className="p-2 text-gray-400 hover:text-[#5c22ff] rounded-xl hover:bg-white transition-colors"><Edit2 className="w-4 h-4" /></button>
 <button onClick={() => deleteRule(rule.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-xl hover:bg-white transition-colors"><Trash2 className="w-4 h-4" /></button>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </div>

 {/* AI Insights Feed */}
 <div className="px-4 pb-8" ref={insightsRef}>
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-bold text-gray-900 text-[15px]">AI Insights</h3>
 </div>
 
 {insights.length === 0 ? (
 <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 text-center">
 <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
 <h4 className="text-[14px] font-bold text-gray-900 mb-1">No insights generated yet</h4>
 <p className="text-[12px] font-medium text-gray-500">Enable an automation rule to start gathering real-time telemetry.</p>
 </div>
 ) : (
 <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-2">
 {insights.map((log, i) => (
 <div key={i} className="flex items-start gap-3.5 p-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer">
 <div className={`w-9 h-9 rounded-full ${log.status === 'success' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'} flex items-center justify-center shrink-0 mt-0.5`}>
 {log.status === 'success' ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Settings2 className="w-4.5 h-4.5" />}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex justify-between items-center mb-0.5">
 <h4 className="font-bold text-[13px] text-gray-900 truncate pr-2">Automation Executed</h4>
 <span className="text-[11px] font-bold text-gray-400 shrink-0">
 {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 <p className="text-[12px] font-medium text-gray-500 leading-snug truncate">
 {log.details?.message || 'Rule successfully completed.'}
 </p>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 </div>
 </main>

 {/* Custom Bottom Navigation */}
 <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-100 z-50 pb-safe">
 <div className="max-w-md mx-auto flex items-center justify-between px-6 h-[72px] relative">
 <button onClick={() => navigate('/home')} className="flex flex-col items-center gap-1.5 text-gray-400 hover:text-gray-900 w-12">
 <Home className="w-5 h-5" />
 <span className="text-[10px] font-bold">Home</span>
 </button>
 
 <button onClick={() => scrollTo({ current: document.body as unknown as HTMLDivElement })} className="flex flex-col items-center gap-1.5 text-[#5c22ff] w-16">
 <Zap className="w-5 h-5 fill-current" />
 <span className="text-[10px] font-bold">Workflows</span>
 </button>

 {/* Floating Center FAB */}
 <div className="relative -top-6">
 <button 
 onClick={() => openBuilder()}
 className="w-14 h-14 bg-gradient-to-br from-[#8b5cf6] to-[#5c22ff] rounded-full flex items-center justify-center text-white shadow-lg shadow-purple-500/40 hover:scale-105 transition-transform border-4 border-white"
 >
 <Plus className="w-6 h-6" />
 </button>
 </div>

 <button onClick={() => scrollTo(templatesRef)} className="flex flex-col items-center gap-1.5 text-gray-400 hover:text-gray-900 w-16">
 <Grid className="w-5 h-5" />
 <span className="text-[10px] font-bold">Templates</span>
 </button>

 <button onClick={() => scrollTo(insightsRef)} className="flex flex-col items-center gap-1.5 text-gray-400 hover:text-gray-900 w-12">
 <Activity className="w-5 h-5" />
 <span className="text-[10px] font-bold">Insights</span>
 </button>
 </div>
 </div>

 {/* Builder Modal */}
 {isBuilderOpen && (
 <RuleBuilderDialog 
 isOpen={isBuilderOpen} 
 onClose={() => setIsBuilderOpen(false)}
 onSave={() => userId && fetchRules(userId)}
 initialRule={editingRule}
 userId={userId}
 />
 )}
 </div>
 );
}
