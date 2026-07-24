import React, { useState, useEffect } from 'react';
import { Search, Filter, Star, Download, ChevronRight, CheckCircle, Sparkles, Building, Briefcase, Code, Stethoscope, Boxes } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AgentListing {
 id: string;
 name: string;
 creator: string;
 description: string;
 rating: number;
 installs: number;
 category: string;
 icon: React.ReactNode;
 installed: boolean;
 price: string;
}

export const AgentMarketplace: React.FC = () => {
 const navigate = useNavigate();
 const [searchQuery, setSearchQuery] = useState('');
 const [agents, setAgents] = useState<AgentListing[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 fetchAgents();
 }, []);

 const getCategoryIcon = (category: string) => {
 switch(category) {
 case 'HR & Recruitment': return <Briefcase className="w-8 h-8 text-blue-500" />;
 case 'Legal': return <Building className="w-8 h-8 text-slate-700" />;
 case 'Engineering': return <Code className="w-8 h-8 text-emerald-500" />;
 case 'Healthcare': return <Stethoscope className="w-8 h-8 text-red-500" />;
 default: return <Boxes className="w-8 h-8 text-[#5c22ff]" />;
 }
 };

 const fetchAgents = async () => {
 setLoading(true);
 try {
 const { data, error } = await supabase
 .from('ai_agents')
 .select('*')
 .order('install_count', { ascending: false });

 if (error) {
 console.error('Error fetching agents:', error);
 setAgents(getFallbackAgents());
 setLoading(false);
 return;
 }

 if (data) {
 // Map Supabase response to AgentListing format
 const mappedAgents: AgentListing[] = data.map((agent: any) => ({
 id: agent.id,
 name: agent.name,
 creator: agent.creator_id ? 'Verified Partner' : 'CHATR Core',
 description: agent.description,
 rating: Number(agent.rating) || 0,
 installs: agent.install_count || 0,
 category: agent.category,
 icon: getCategoryIcon(agent.category),
 installed: false,
 price: agent.price_model === 'free' ? 'Free' : agent.price_model === 'premium' ? 'Premium' : agent.price_model
 }));
 
 if (mappedAgents.length > 0) {
 setAgents(mappedAgents);
 } else {
 setAgents(getFallbackAgents());
 }
 } else {
 setAgents(getFallbackAgents());
 }
 } catch (err) {
 console.error('Fetch exception:', err);
 setAgents(getFallbackAgents());
 } finally {
 setLoading(false);
 }
 };

 const getFallbackAgents = (): AgentListing[] => [
 {
 id: '1',
 name: 'RecruitmentOS Sourcing Agent',
 creator: 'CHATR Core',
 description: 'Automates candidate sourcing from LinkedIn and GitHub matching your JD parameters.',
 rating: 4.9,
 installs: 0,
 category: 'HR & Recruitment',
 icon: getCategoryIcon('HR & Recruitment'),
 installed: true,
 price: 'Free'
 },
 {
 id: '2',
 name: 'Legal Contract Reviewer',
 creator: 'LexAI Partners',
 description: 'Reads NDAs and MSA contracts, highlighting liabilities and non-standard clauses.',
 rating: 4.7,
 installs: 0,
 category: 'Legal',
 icon: getCategoryIcon('Legal'),
 installed: false,
 price: 'Premium'
 },
 {
 id: '3',
 name: 'Senior Code Reviewer',
 creator: 'DevTools Inc',
 description: 'Acts as a strict senior engineer. Reviews PRs for security, performance, and best practices.',
 rating: 4.8,
 installs: 0,
 category: 'Engineering',
 icon: getCategoryIcon('Engineering'),
 installed: false,
 price: 'Free'
 },
 {
 id: '4',
 name: 'Medical Triage Assistant',
 creator: 'HealthTech Solutions',
 description: 'HIPAA-compliant agent that conducts preliminary patient symptom screening.',
 rating: 4.6,
 installs: 0,
 category: 'Healthcare',
 icon: getCategoryIcon('Healthcare'),
 installed: false,
 price: 'Pay-per-use'
 },
 {
 id: '5',
 name: 'Finance & Accounting Agent',
 creator: 'CHATR Core',
 description: 'Automates GST reminders, invoice collection, and tax filing workflows.',
 rating: 4.8,
 installs: 0,
 category: 'Finance',
 icon: getCategoryIcon('Finance'),
 installed: false,
 price: 'Free'
 },
 {
 id: '6',
 name: 'Sales & CRM Agent',
 creator: 'CHATR Core',
 description: 'Manages leads, auto-generates quotes, and handles follow-ups and renewals.',
 rating: 4.9,
 installs: 0,
 category: 'Sales',
 icon: getCategoryIcon('Sales'),
 installed: true,
 price: 'Premium'
 },
 {
 id: '7',
 name: 'Customer Success Agent',
 creator: 'SupportTech Inc',
 description: 'Monitors product usage and proactively reaches out for onboarding and retention.',
 rating: 4.7,
 installs: 0,
 category: 'Sales',
 icon: getCategoryIcon('Sales'),
 installed: false,
 price: 'Free'
 },
 {
 id: '8',
 name: 'Marketing Campaign Agent',
 creator: 'GrowthStack',
 description: 'Drafts copy, schedules posts, and optimizes ad budgets based on analytics.',
 rating: 4.5,
 installs: 0,
 category: 'Engineering',
 icon: getCategoryIcon('Engineering'),
 installed: false,
 price: 'Pay-per-use'
 },
 {
 id: '9',
 name: 'Compliance & Audit Agent',
 creator: 'LexAI Partners',
 description: 'Constantly monitors internal workflows to ensure GDPR and HIPAA compliance.',
 rating: 4.9,
 installs: 0,
 category: 'Legal',
 icon: getCategoryIcon('Legal'),
 installed: false,
 price: 'Premium'
 },
 {
 id: '10',
 name: 'Real Estate Workflow Agent',
 creator: 'PropertyTech',
 description: 'Automates property listings, tenant screening, and lease agreement generation.',
 rating: 4.6,
 installs: 0,
 category: 'Finance',
 icon: getCategoryIcon('Finance'),
 installed: false,
 price: 'Free'
 }
 ];

 const handleInstall = async (id: string) => {
 // Optimistic UI update
 setAgents(prev => prev.map(a => a.id === id ? { ...a, installed: true } : a));
 
 // In production, we would INSERT into ai_agent_installations here
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 await supabase.from('ai_agent_installations').insert({
 user_id: user.id,
 agent_id: id,
 status: 'active'
 });
 }
 } catch (err) {
 console.error('Failed to install agent:', err);
 }
 };

 return (
 <div className="flex flex-col h-full bg-slate-50 w-full overflow-y-auto">
 
 {/* Header Banner */}
 <div className="bg-[#5c22ff] text-white p-10 relative overflow-hidden">
 <div className="absolute top-0 right-0 opacity-10">
 <Sparkles className="w-64 h-64 -mt-10 -mr-10" />
 </div>
 <div className="max-w-5xl mx-auto relative z-10">
 <h1 className="text-display mb-2">Agent Marketplace</h1>
 <p className="text-[#5c22ff] text-blue-100 max-w-xl">
 Expand your CHATR Workspace. Install specialized AI Agents to automate your unique business workflows.
 </p>
 
 <div className="mt-8 flex gap-4 max-w-2xl">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
 <Input 
 placeholder="Search for agents, skills, or workflows..." 
 className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 focus:bg-white/20 focus:border-white/30"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 <Button variant="secondary" className="h-12 px-6 bg-white text-[#5c22ff] hover:bg-slate-100 font-semibold">
 <Filter className="w-4 h-4 mr-2" /> Filters
 </Button>
 </div>
 </div>
 </div>

 {/* Main Content */}
 <div className="max-w-5xl mx-auto w-full p-8 space-y-8">
 
 {/* Categories */}
 <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
 {['All Agents', 'HR & Recruitment', 'Engineering', 'Legal', 'Sales', 'Healthcare', 'Finance'].map(cat => (
 <button key={cat} className={`px-4 py-2 rounded-full text-secondary font-medium whitespace-nowrap transition-colors ${cat === 'All Agents' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
 {cat}
 </button>
 ))}
 </div>

 {/* Loading State */}
 {loading ? (
 <div className="flex items-center justify-center py-20 text-slate-400">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5c22ff]"></div>
 </div>
 ) : (
 /* Listings Grid */
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {agents
 .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.description.toLowerCase().includes(searchQuery.toLowerCase()))
 .map(agent => (
 <Card key={agent.id} className="p-6 border-slate-200 hover:border-[#5c22ff]/30 hover:shadow-md transition-all group bg-white">
 <div className="flex items-start gap-4">
 <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0 group-hover:scale-105 transition-transform">
 {agent.icon}
 </div>
 <div className="flex-1">
 <div className="flex justify-between items-start">
 <div>
 <h3 className="font-bold text-slate-800 text-section">{agent.name}</h3>
 <p className="text-label text-slate-500 mt-0.5">By {agent.creator}</p>
 </div>
 <span className="text-label font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md capitalize">
 {agent.price}
 </span>
 </div>
 
 <p className="text-secondary text-slate-600 mt-3 line-clamp-2 ">
 {agent.description}
 </p>
 
 <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
 <div className="flex items-center gap-4 text-label text-slate-500">
 <span className="flex items-center gap-1 font-medium text-amber-500">
 <Star className="w-3.5 h-3.5 fill-current" /> {agent.rating}
 </span>
 </div>
 
 {agent.installed ? (
 <Button 
 size="sm" 
 className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
 onClick={() => navigate(`/desktop/agent/${agent.id}`)}
 >
 <CheckCircle className="w-4 h-4 mr-1.5" /> Open Agent
 </Button>
 ) : (
 <Button size="sm" className="h-8 bg-[#5c22ff] hover:bg-[#4b1ac4] text-white" onClick={() => handleInstall(agent.id)}>
 Install Agent
 </Button>
 )}
 </div>
 </div>
 </div>
 </Card>
 ))}
 
 {!loading && agents.length === 0 && (
 <div className="col-span-full py-20 text-center">
 <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-4" />
 <h3 className="text-section font-bold text-slate-700">No Agents Found</h3>
 <p className="text-slate-500 mt-2">The marketplace is currently empty. Run database migrations to populate.</p>
 </div>
 )}
 </div>
 )}

 </div>
 </div>
 );
};
