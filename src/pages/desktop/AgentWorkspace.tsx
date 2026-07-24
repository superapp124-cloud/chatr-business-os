import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
 Bot, ArrowLeft, Settings, BrainCircuit, MessageSquare,
 Workflow, Send, Loader2, FileText, Activity, CheckCircle2, Clipboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { generate } from '@/services/ai';
import { eventBus } from '@/core/runtime/EventBus';

interface Message {
 role: 'user' | 'agent';
 text: string;
 timestamp?: Date;
}

interface AgentRecord {
 id: string;
 name: string;
 objective: string;
 status: string;
 model: string;
 confidence_threshold: number;
}

interface WorkflowRun {
 id: string;
 workflow_name: string;
 status: string;
 started_at: string;
}

export const AgentWorkspace: React.FC = () => {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const scrollRef = useRef<HTMLDivElement>(null);

 const [agent, setAgent] = useState<AgentRecord | null>(null);
 const [agentName, setAgentName] = useState('Loading Agent...');
 const [messages, setMessages] = useState<Message[]>([]);
 const [inputValue, setInputValue] = useState('');
 const [isTyping, setIsTyping] = useState(false);
 const [clipboardText, setClipboardText] = useState<string | null>(null);
 const [pendingWorkflows, setPendingWorkflows] = useState<WorkflowRun[]>([]);
 const [recentWorkflows, setRecentWorkflows] = useState<WorkflowRun[]>([]);
 const [sessionId] = useState(() => `agent-${id}-${Date.now()}`);

 // Load real agent from DB
 useEffect(() => {
 loadAgent();
 readClipboard();
 loadWorkflows();
 }, [id]);

 // Auto-scroll on new message
 useEffect(() => {
 scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [messages, isTyping]);

 const loadAgent = async () => {
 if (!id) return;
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 // Try business_ai_roles first
 const { data: roleData } = await supabase
 .from('business_ai_roles')
 .select('*')
 .eq('id', id)
 .single();

 if (roleData) {
 setAgent(roleData);
 setAgentName(roleData.name);
 setMessages([{
 role: 'agent',
 text: `Hello! I am ${roleData.name}. ${roleData.objective}\n\nI am initialized and ready to execute workflows via the CHATR Runtime. What would you like me to do?`,
 timestamp: new Date(),
 }]);
 return;
 }

 // Fallback: try ai_agents table
 const { data: agentData } = await supabase
 .from('ai_agents' as any)
 .select('*')
 .eq('id', id)
 .single();

 if (agentData) {
 setAgentName((agentData as any).name || `Agent #${id}`);
 setMessages([{
 role: 'agent',
 text: `Hello! I am ${(agentData as any).name}. I am initialized and ready. What would you like me to do?`,
 timestamp: new Date(),
 }]);
 } else {
 // ID-based default names
 const defaultNames: Record<string, string> = {
 '1': 'RecruitmentOS Sourcing Agent',
 '2': 'Customer Support Agent',
 '3': 'Sales Intelligence Agent',
 '4': 'Data Analytics Agent',
 '5': 'Content Creation Agent',
 '6': 'Sales & CRM Agent',
 };
 const name = defaultNames[id] || `Specialized Agent Workspace`;
 setAgentName(name);
 setMessages([{
 role: 'agent',
 text: `Hello! I am ${name}. I am initialized and ready to execute workflows via the CHATR Runtime. What would you like me to do?`,
 timestamp: new Date(),
 }]);
 }
 } catch (e) {
 console.error('Agent load error:', e);
 setAgentName('Agent Workspace');
 }
 };

 const readClipboard = async () => {
 try {
 // Use Electron IPC if available, otherwise browser Clipboard API
 if (typeof window !== 'undefined' && (window as any).electronAPI?.clipboard) {
 const text = await (window as any).electronAPI.clipboard.readText();
 if (text && text.length > 0) setClipboardText(text.slice(0, 200));
 } else if (navigator.clipboard && document.hasFocus()) {
 const text = await navigator.clipboard.readText();
 if (text && text.length > 0) setClipboardText(text.slice(0, 200));
 }
 } catch {
 setClipboardText(null);
 }
 };

 const loadWorkflows = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const { data } = await supabase
 .from('workflow_runs')
 .select('id, workflow_name, status, started_at')
 .eq('triggered_by', user.id)
 .order('started_at', { ascending: false })
 .limit(10);

 if (data) {
 setPendingWorkflows(data.filter(w => w.status === 'running'));
 setRecentWorkflows(data.filter(w => w.status !== 'running').slice(0, 3));
 }
 } catch {
 // workflow_runs table may be empty
 }
 };

 const handleSendMessage = async (e?: React.FormEvent) => {
 e?.preventDefault();
 if (!inputValue.trim() || isTyping) return;

 const query = inputValue.trim();
 const userMsg: Message = { role: 'user', text: query, timestamp: new Date() };
 const agentPlaceholder: Message = { role: 'agent', text: '', timestamp: new Date() };
 setMessages(prev => [...prev, userMsg, agentPlaceholder]);
 setInputValue('');
 setIsTyping(true);

 try {
 // Build system prompt from agent config
 const systemPrompt = agent?.objective
 ? `You are ${agentName}. Your objective: ${agent.objective}. Answer concisely and helpfully.`
 : `You are ${agentName}, an AI agent in the CHATR Desktop OS. Help the user with their tasks.`;

 const response = await generate({
 prompt: query,
 conversationId: sessionId,
 systemPrompt,
 });

 setMessages(prev => {
 const copy = [...prev];
 copy[copy.length - 1].text = response;
 return copy;
 });

 // Save to agent_sessions for memory
 await supabase.from('agent_sessions').upsert({
 agent_id: id || 'unknown',
 session_name: `Session ${new Date().toLocaleDateString()}`,
 messages: messages.concat([userMsg, { role: 'agent', text: response }]),
 last_active_at: new Date().toISOString(),
 total_messages: messages.length + 2,
 }, { onConflict: 'id' });

 // Emit to EventBus
 eventBus.publish('ui:interaction', { type: 'AI_RESPONSE_READY', payload: { agentId: id, sessionId } });
 } catch (err: any) {
 setMessages(prev => {
 const copy = [...prev];
 copy[copy.length - 1].text = `Error: ${err.message}`;
 return copy;
 });
 } finally {
 setIsTyping(false);
 }
 };

 return (
 <div className="flex h-full w-full bg-slate-50 dark:bg-[#121422] overflow-hidden">

 {/* Left Pane — Context & Workflows */}
 <div className="w-[360px] border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#181A2A] flex flex-col z-10 shrink-0">

 {/* Header */}
 <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center gap-3">
 <Button variant="ghost" size="icon" onClick={() => navigate('/desktop/marketplace')} className="text-slate-500">
 <ArrowLeft className="w-5 h-5" />
 </Button>
 <div className="w-10 h-10 rounded-lg bg-[#5c22ff]/10 flex items-center justify-center shrink-0">
 <Bot className="w-5 h-5 text-[#5c22ff]" />
 </div>
 <div className="flex-1 overflow-hidden">
 <h2 className="font-bold text-slate-800 dark:text-white text-secondary truncate">{agentName}</h2>
 <div className="flex items-center gap-1.5 text-label text-emerald-600 dark:text-emerald-400 ">
 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
 Execution Engine Active
 </div>
 </div>
 <Button variant="ghost" size="icon" className="text-slate-400">
 <Settings className="w-5 h-5" />
 </Button>
 </div>

 <ScrollArea className="flex-1 p-4">
 <div className="space-y-6">

 {/* Live Clipboard Context */}
 <section>
 <h3 className="text-label font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
 <BrainCircuit className="w-4 h-4" /> Live Context
 </h3>
 <div className="space-y-2">
 {clipboardText ? (
 <Card className="p-3 border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 shadow-none">
 <div className="flex items-start gap-3">
 <Clipboard className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
 <div>
 <p className="text-label font-semibold text-slate-700 dark:text-slate-200">Clipboard Detected</p>
 <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-3">
 "{clipboardText}"
 </p>
 </div>
 </div>
 </Card>
 ) : (
 <Card className="p-3 border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 shadow-none">
 <div className="flex items-start gap-3">
 <Clipboard className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
 <div>
 <p className="text-label font-semibold text-slate-700 dark:text-slate-200">No Clipboard Content</p>
 <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Copy text to give agent context.</p>
 </div>
 </div>
 </Card>
 )}

 {pendingWorkflows.length > 0 && (
 <Card className="p-3 border-slate-100 dark:border-white/5 bg-amber-50/50 dark:bg-amber-900/10 shadow-none">
 <div className="flex items-start gap-3">
 <Activity className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
 <div>
 <p className="text-label font-semibold text-slate-700 dark:text-slate-200">Running Workflows</p>
 <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
 {pendingWorkflows.length} workflow{pendingWorkflows.length !== 1 ? 's' : ''} currently executing
 </p>
 </div>
 </div>
 </Card>
 )}
 </div>
 </section>

 {/* Agent Config */}
 {agent && (
 <section>
 <h3 className="text-label font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
 <Settings className="w-4 h-4" /> Agent Config
 </h3>
 <div className="space-y-2">
 <div className="flex justify-between text-label">
 <span className="text-slate-500">Status</span>
 <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
 {agent.status}
 </Badge>
 </div>
 <div className="flex justify-between text-label">
 <span className="text-slate-500">Model</span>
 <span className="text-slate-300 font-mono">{agent.model}</span>
 </div>
 <div className="flex justify-between text-label">
 <span className="text-slate-500">Confidence</span>
 <span className="text-slate-300">{agent.confidence_threshold}%</span>
 </div>
 </div>
 </section>
 )}

 {/* Recent Workflow Runs */}
 {recentWorkflows.length > 0 && (
 <section>
 <h3 className="text-label font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
 <Workflow className="w-4 h-4" /> Recent Runs
 </h3>
 <div className="space-y-2">
 {recentWorkflows.map(wf => (
 <div key={wf.id} className="flex items-center justify-between text-label">
 <span className="text-slate-500 truncate max-w-[180px]">{wf.workflow_name}</span>
 <Badge
 variant={wf.status === 'completed' ? 'default' : 'destructive'}
 className="text-[10px]"
 >
 {wf.status}
 </Badge>
 </div>
 ))}
 </div>
 </section>
 )}
 </div>
 </ScrollArea>
 </div>

 {/* Right Pane — Agent Chat */}
 <div className="flex-1 flex flex-col bg-white dark:bg-[#121422]">
 <div className="h-16 border-b border-slate-200 dark:border-white/10 px-6 flex items-center shadow-sm bg-white dark:bg-[#181A2A]">
 <MessageSquare className="w-5 h-5 text-slate-400 mr-3" />
 <h2 className="font-semibold text-slate-700 dark:text-white">Workspace Execution Chat</h2>
 </div>

 <ScrollArea className="flex-1 p-6 bg-slate-50/50 dark:bg-[#121422]">
 <div className="max-w-3xl mx-auto space-y-6">
 {messages.map((msg, i) => (
 <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
 {msg.role === 'agent' && (
 <div className="w-8 h-8 rounded-full bg-[#5c22ff]/10 flex items-center justify-center shrink-0 mt-1">
 <Bot className="w-4 h-4 text-[#5c22ff]" />
 </div>
 )}
 <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-secondary whitespace-pre-wrap ${
 msg.role === 'user'
 ? 'bg-[#5c22ff] text-white shadow-sm'
 : 'bg-white dark:bg-[#181A2A] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 shadow-sm'
 }`}>
 {msg.text}
 </div>
 </div>
 ))}

 {isTyping && (
 <div className="flex gap-4 justify-start">
 <div className="w-8 h-8 rounded-full bg-[#5c22ff]/10 flex items-center justify-center shrink-0 mt-1">
 <Bot className="w-4 h-4 text-[#5c22ff]" />
 </div>
 <div className="bg-white dark:bg-[#181A2A] border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3.5 flex items-center gap-2">
 <Loader2 className="w-4 h-4 text-[#5c22ff] animate-spin" />
 <span className="text-label text-slate-500 ">Executing...</span>
 </div>
 </div>
 )}
 <div ref={scrollRef} />
 </div>
 </ScrollArea>

 <div className="p-4 bg-white dark:bg-[#181A2A] border-t border-slate-200 dark:border-white/10">
 <div className="max-w-3xl mx-auto">
 <form onSubmit={handleSendMessage} className="relative flex items-center">
 <Input
 value={inputValue}
 onChange={e => setInputValue(e.target.value)}
 placeholder={`Ask ${agentName} to perform a task...`}
 className="pl-4 pr-12 h-12 bg-slate-50 dark:bg-[#121422] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:border-[#5c22ff]/50 rounded-xl"
 />
 <Button
 type="submit"
 size="icon"
 className="absolute right-1.5 h-9 w-9 bg-[#5c22ff] hover:bg-[#4b1ac4] text-white rounded-lg"
 disabled={!inputValue.trim() || isTyping}
 >
 <Send className="w-4 h-4" />
 </Button>
 </form>
 <div className="mt-2 text-center">
 <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center justify-center gap-1">
 <CheckCircle2 className="w-3 h-3" /> Powered by CHATR AI Execution Engine
 </span>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};
