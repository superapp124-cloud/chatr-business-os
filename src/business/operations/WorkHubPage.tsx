import React, { useState, useEffect } from 'react';
import { AICopilot } from '../../components/workHub/AICopilot';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, CheckSquare, Clock, ShieldCheck, Briefcase, Plane, HeartPulse, Sparkles, Filter, Search, Plus, X } from 'lucide-react';
import { BusinessObjectRenderer } from '../../components/workHub/BusinessObjectRenderer';
import { UniversalTimeline } from '../../components/workHub/UniversalTimeline';
import { workflowEngine } from '../../core/WorkflowEngine';
import { workEngine } from '../../core/WorkEngine';

// Templates
import leaveRequestTemplate from '../../data/templates/leaveRequest.json';
import expenseReportTemplate from '../../data/templates/expenseReport.json';
import itSupportTemplate from '../../data/templates/itSupport.json';

// Mock Current User for RBAC Demonstration
const CURRENT_USER = {
 id: 'usr_arshid',
 name: 'Arshid Wani',
 role: 'manager' // Change this to 'employee' to see RBAC in action!
};

export const WorkHub: React.FC = () => {
 const [activeTab, setActiveTab] = useState('inbox');
 const [localWorkItems, setLocalWorkItems] = useState<any[]>([]);
 
 // Slide Over State
 const [isSlideOpen, setIsSlideOpen] = useState(false);
 const [slideMode, setSlideMode] = useState<'create' | 'view'>('create');
 const [selectedItem, setSelectedItem] = useState<any>(null);
 const [timelineEvents, setTimelineEvents] = useState<any[]>([]);

 // Load Data on Mount or Tab Change
 useEffect(() => {
 const loadData = async () => {
 let filter = undefined;
 if (activeTab === 'leave') filter = 'leave';
 if (activeTab === 'expenses') filter = 'expenses';
 if (activeTab === 'it') filter = 'it';
 
 const items = await workEngine.getObjects(filter);
 
 // If "inbox", only show items that need approval
 if (activeTab === 'inbox') {
 setLocalWorkItems(items.filter(i => i.status === 'Pending Approval' || i.status === 'New'));
 } else if (activeTab === 'requests') {
 setLocalWorkItems(items.filter(i => i.author === CURRENT_USER.name));
 } else {
 setLocalWorkItems(items);
 }
 };
 loadData();
 }, [activeTab, isSlideOpen]); // Re-run when slider closes to catch new items

 const getActiveTemplate = () => {
 switch (activeTab) {
 case 'expenses': return expenseReportTemplate;
 case 'it': return itSupportTemplate;
 case 'leave':
 default: return leaveRequestTemplate;
 }
 };

 const navItems = [
 { id: 'inbox', icon: <Inbox className="w-5 h-5" />, label: 'Inbox', badge: localWorkItems.length > 0 && activeTab === 'inbox' ? localWorkItems.length : undefined },
 { id: 'requests', icon: <Briefcase className="w-5 h-5" />, label: 'My Requests' },
 { id: 'approvals', icon: <CheckSquare className="w-5 h-5" />, label: 'Approvals' },
 ];

 const appItems = [
 { id: 'leave', icon: <Plane className="w-5 h-5" />, label: 'Leave Management' },
 { id: 'expenses', icon: <Clock className="w-5 h-5" />, label: 'Expenses' },
 { id: 'it', icon: <ShieldCheck className="w-5 h-5" />, label: 'IT Support' },
 { id: 'hr', icon: <HeartPulse className="w-5 h-5" />, label: 'HR & Wellness' },
 ];

 const handleCreateRequest = () => {
 setSlideMode('create');
 setIsSlideOpen(true);
 };

 const handleViewItem = async (item: any) => {
 setSelectedItem(item);
 setSlideMode('view');
 setIsSlideOpen(true);
 
 // Fetch real history
 const history = await workEngine.getHistory(item.id);
 setTimelineEvents(history.map(h => ({
 id: h.id,
 type: h.action === 'STATUS_CHANGE' ? 'status_change' : 'creation',
 actor: h.actor_id === 'usr_arshid' ? 'Arshid Wani' : h.actor_id,
 timestamp: new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
 details: h.details
 })));
 };

 const canApprove = () => {
 return CURRENT_USER.role === 'manager' && (selectedItem?.status === 'Pending Approval' || selectedItem?.status === 'New');
 };

 return (
 <div className="flex-1 bg-[#0a0a0c] h-full overflow-hidden flex font-sans text-white relative">
 
 {/* Background Gradients */}
 <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
 <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

 {/* Sidebar Navigation */}
 <div className="w-72 bg-black/40 border-r border-white/5 flex flex-col backdrop-blur-xl z-10">
 <div className="p-8 pb-4 flex flex-col gap-1">
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.3)] mb-4">
 <Sparkles className="w-6 h-6 text-white" />
 </div>
 <h1 className="text-page font-bold tracking-tight text-white">Work Hub</h1>
 <p className="text-secondary text-slate-400 font-medium">Business Operations</p>
 </div>

 <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8">
 <nav className="space-y-1.5">
 <p className="px-4 text-label font-bold text-slate-500 uppercase tracking-widest mb-3">Workspace</p>
 {navItems.map(item => (
 <button 
 key={item.id}
 onClick={() => setActiveTab(item.id)}
 className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-secondary ${
 activeTab === item.id 
 ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' 
 : 'text-slate-400 hover:bg-white/[0.04] hover:text-white border border-transparent'
 }`}
 >
 {item.icon}
 <span>{item.label}</span>
 {item.badge && (
 <span className={`ml-auto text-label px-2 py-0.5 rounded-full ${activeTab === item.id ? 'bg-violet-500/20 text-violet-300' : 'bg-white/10 text-slate-300'}`}>
 {item.badge}
 </span>
 )}
 </button>
 ))}
 </nav>
 
 <nav className="space-y-1.5">
 <p className="px-4 text-label font-bold text-slate-500 uppercase tracking-widest mb-3">Applications</p>
 {appItems.map(item => (
 <button 
 key={item.id}
 onClick={() => setActiveTab(item.id)}
 className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-secondary ${
 activeTab === item.id 
 ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
 : 'text-slate-400 hover:bg-white/[0.04] hover:text-white border border-transparent'
 }`}
 >
 {item.icon}
 <span>{item.label}</span>
 </button>
 ))}
 </nav>
 </div>
 </div>

 {/* Main Content Area */}
 <div className="flex-1 flex flex-col relative z-10">
 <div className="h-20 border-b border-white/5 flex items-center px-10 bg-black/20 backdrop-blur-md sticky top-0">
 <h2 className="text-workspace capitalize text-white tracking-tight">
 {activeTab.replace('-', ' ')}
 </h2>
 
 <div className="ml-auto flex items-center gap-4">
 <div className="relative group">
 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-400 transition-colors" />
 <input 
 type="text" 
 placeholder="Search anything..." 
 className="bg-black/40 border border-white/10 rounded-full py-2 pl-10 pr-4 text-input text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all w-64"
 />
 </div>
 <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
 <Filter className="w-4 h-4 text-slate-300" />
 </button>
 <button 
 onClick={handleCreateRequest}
 className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-full text-button font-semibold hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all flex items-center gap-2"
 >
 <Plus className="w-4 h-4" />
 New Request
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-10">
 <motion.div 
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="max-w-5xl mx-auto space-y-4"
 >
 {localWorkItems.length === 0 ? (
 <div className="text-center text-slate-500 py-20">
 <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
 <p>No requests found in this view.</p>
 </div>
 ) : localWorkItems.map((item, idx) => (
 <motion.div 
 onClick={() => handleViewItem(item)}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: idx * 0.05 }}
 key={item.id} 
 className="bg-black/40 rounded-2xl border border-white/5 p-5 hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer group flex items-center gap-6"
 >
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <span className="text-label font-mono text-slate-500 bg-black/50 px-2 py-1 rounded-md border border-white/5">{item.id}</span>
 <span className="text-label bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-md border border-blue-500/20">{item.definition_id.replace('def_', '').replace('_', ' ')}</span>
 {item.priority === 'High' && (
 <span className="text-label bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-md border border-rose-500/20 flex items-center gap-1.5">
 <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
 High Priority
 </span>
 )}
 </div>
 <h3 className="text-section text-slate-200 group-hover:text-white transition-colors">{item.title}</h3>
 <div className="flex items-center gap-2 mt-2 text-secondary text-slate-500">
 <span>{item.author || item.owner_id}</span>
 <span className="w-1 h-1 rounded-full bg-slate-700" />
 <span>{item.date || 'Just now'}</span>
 </div>
 </div>
 
 <div className="text-right flex flex-col items-end justify-center">
 <span className={`text-secondary font-medium px-3 py-1.5 rounded-lg border ${
 ['In Progress', 'New'].includes(item.status) ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
 item.status === 'Pending Approval' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
 item.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
 'bg-slate-500/10 text-slate-400 border-slate-500/20'
 }`}>
 {item.status}
 </span>
 </div>
 </motion.div>
 ))}
 </motion.div>
 </div>

 <AICopilot />
 </div>

 {/* Slide-over Panel for Create/View */}
 <AnimatePresence>
 {isSlideOpen && (
 <motion.div 
 initial={{ x: '100%' }}
 animate={{ x: 0 }}
 exit={{ x: '100%' }}
 transition={{ type: 'spring', damping: 25, stiffness: 200 }}
 className="absolute top-0 right-0 w-[550px] h-full bg-black/80 backdrop-blur-3xl border-l border-white/10 z-50 flex flex-col shadow-2xl"
 >
 <div className="h-20 border-b border-white/10 flex items-center px-8 justify-between bg-white/[0.02]">
 <h2 className="text-workspace font-bold text-white">
 {slideMode === 'create' ? 'New Request' : selectedItem?.title}
 </h2>
 <button onClick={() => setIsSlideOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
 <X className="w-5 h-5 text-slate-400" />
 </button>
 </div>

 <div className="flex-1 overflow-y-auto p-8">
 {slideMode === 'create' ? (
 <div className="space-y-6">
 <BusinessObjectRenderer 
 definition={getActiveTemplate() as any}
 onSubmit={async (data) => {
 const template = getActiveTemplate();
 await workEngine.createObject(template.id, {
 title: data.reason || data.description || data.expense_category || 'New Request',
 priority: data.urgency || 'Medium',
 date: 'Just now',
 author: CURRENT_USER.name,
 metadata: data
 });
 setIsSlideOpen(false);
 }}
 />
 </div>
 ) : (
 <div className="space-y-8">
 {/* Detailed View */}
 <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
 <h3 className="text-label font-bold text-slate-500 uppercase tracking-widest mb-6">Request Metadata</h3>
 <div className="space-y-4">
 <div className="flex justify-between items-center pb-4 border-b border-white/5">
 <span className="text-slate-400 text-secondary">Request ID</span>
 <span className="font-mono text-white text-secondary bg-black/50 px-2 py-1 rounded border border-white/10">{selectedItem?.id}</span>
 </div>
 <div className="flex justify-between items-center pb-4 border-b border-white/5">
 <span className="text-slate-400 text-secondary">Status</span>
 <span className="text-violet-400 text-secondary font-medium">{selectedItem?.status}</span>
 </div>
 <div className="flex justify-between items-center pb-4 border-b border-white/5">
 <span className="text-slate-400 text-secondary">Priority</span>
 <span className="text-rose-400 text-secondary font-medium">{selectedItem?.priority || 'Medium'}</span>
 </div>
 <div className="flex justify-between items-center">
 <span className="text-slate-400 text-secondary">Requested By</span>
 <span className="text-white text-secondary font-medium">{selectedItem?.author || selectedItem?.owner_id}</span>
 </div>
 </div>
 </div>

 <UniversalTimeline events={timelineEvents} />

 {/* Actions (RBAC protected) */}
 {canApprove() ? (
 <div className="flex gap-4">
 <button 
 onClick={async () => {
 const updated = localWorkItems.map(item => 
 item.id === selectedItem.id ? { ...item, status: 'Approved' } : item
 );
 setLocalWorkItems(updated);
 setSelectedItem({ ...selectedItem, status: 'Approved' });
 await workflowEngine.transitionState(selectedItem.id, 'Approved', CURRENT_USER.id);
 
 // Refresh history after action
 const history = await workEngine.getHistory(selectedItem.id);
 setTimelineEvents(history.map(h => ({
 id: h.id,
 type: h.action === 'STATUS_CHANGE' ? 'status_change' : 'creation',
 actor: h.actor_id === 'usr_arshid' ? 'Arshid Wani' : h.actor_id,
 timestamp: new Date(h.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
 details: h.details
 })));
 }}
 className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-3 rounded-xl font-medium transition-colors shadow-lg shadow-violet-500/20"
 >
 Approve Request
 </button>
 <button className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-xl font-medium transition-colors">
 Reject
 </button>
 </div>
 ) : (
 <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
 <p className="text-secondary text-blue-400">This request is waiting on approval from a Manager.</p>
 </div>
 )}
 </div>
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
};
