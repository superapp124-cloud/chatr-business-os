import React, { useState, useRef, useEffect } from 'react';
import { 
 Briefcase, Users, Presentation, GraduationCap, Stethoscope, 
 CheckCircle2, Bot, Calendar, FileText, Send, MessageCircle, 
 Clock, Activity, ClipboardCheck, Phone, ChevronRight, Share2, 
 Download, Printer, AlertCircle, Mic, MicOff, TrendingUp,
 Lightbulb, BarChart2, Sparkles, Hash, RefreshCw, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useCallContext } from '@/contexts/CallContext';
import { useCallTranscription } from '@/hooks/useCallTranscription';
import { AIInsightsPanel } from '@/components/calling/meeting/AIInsightsPanel';
import { supabase } from '@/integrations/supabase/client';
import { generate } from '@/services/ai';
import { useSuggestedQuestions } from '@/hooks/useSuggestedQuestions';
import { useCallSummary } from '@/hooks/useCallSummary';

// ---------------------------------------------------------------------------
// Legacy callAI — still used by SalesAssistant / RecruitmentAssistant / ClinicAssistant
// New features use generate() from @/services/ai directly.
// ---------------------------------------------------------------------------
async function callAI(goal: string, context: string, count: number): Promise<string[]> {
 const prompt =
 goal === 'sales'
 ? `You are a sales coach. Generate exactly ${count} specific conversation topics for a sales call with context: ${context}. Return ONLY a numbered list, one per line.`
 : goal === 'recruitment'
 ? `You are a recruiter. Generate exactly ${count} tailored interview questions for context: ${context}. Return ONLY a numbered list, one per line.`
 : goal === 'clinic'
 ? `You are a clinical assistant. Generate exactly ${count} clinical next steps for context: ${context}. Return ONLY a numbered list, one per line.`
 : `Generate exactly ${count} meeting action items or suggestions for context: ${context}. Return ONLY a numbered list, one per line.`;

 const raw = await generate({ prompt, preferLocal: true });
 return raw
 .split('\n')
 .map((l: string) => l.replace(/^\d+\.\s*/, '').trim())
 .filter((l: string) => l.length > 5)
 .slice(0, count);
}


interface SessionWorkspaceProps {
 goal: string;
 remoteUserName?: string;
 remoteUserAvatar?: string;
 callId?: string | null;
 callDuration?: number;
 onSaveTranscript?: (text?: string) => Promise<string | null>;
 onSaveSummary?: (summary: string, transcript?: string) => Promise<string | null>;
 onTranscriptUpdate?: (text: string) => void;
}

export const SessionWorkspace: React.FC<SessionWorkspaceProps> = ({
 goal,
 remoteUserName,
 remoteUserAvatar,
 callId,
 callDuration = 0,
 onSaveTranscript,
 onSaveSummary,
 onTranscriptUpdate,
}) => {
 const [activeTab, setActiveTab] = useState(0);
 const [isAiReady, setIsAiReady] = useState(true);
 const [localTranscript, setLocalTranscript] = useState<string>('');

 const { localStream, remoteStreams } = useCallContext();
 const callAudioStreams = React.useMemo(
 () => [
 localStream,
 ...Object.values(remoteStreams).map(({ stream }) => stream),
 ].filter((stream): stream is MediaStream => !!stream),
 [localStream, remoteStreams]
 );

 const handleTranscriptUpdate = React.useCallback((text: string) => {
 const cleanedText = text.trim();
 if (!cleanedText) return;

 setLocalTranscript(prev => prev ? `${prev.trimEnd()}\n${cleanedText}` : cleanedText);
 if (onTranscriptUpdate) onTranscriptUpdate(cleanedText);
 }, [onTranscriptUpdate]);

 // Start background transcription
 const { isListening, error: transcriptError, downloadProgress } = useCallTranscription(true, handleTranscriptUpdate, callAudioStreams);

 const renderContent = () => {
 switch (goal) {
 case 'sales':
 return <SalesAssistant remoteUserName={remoteUserName} activeTab={activeTab} setActiveTab={setActiveTab} transcript={localTranscript} />;
 case 'recruitment':
 return <RecruitmentAssistant remoteUserName={remoteUserName} activeTab={activeTab} setActiveTab={setActiveTab} transcript={localTranscript} />;
 case 'clinic':
 return <ClinicAssistant remoteUserName={remoteUserName} activeTab={activeTab} setActiveTab={setActiveTab} transcript={localTranscript} />;
 default:
 return (
 <GeneralAssistant
 activeTab={activeTab}
 setActiveTab={setActiveTab}
 transcript={localTranscript}
 remoteUserName={remoteUserName}
 remoteUserAvatar={remoteUserAvatar}
 callId={callId}
 callDuration={callDuration}
 onSaveTranscript={onSaveTranscript}
 onSaveSummary={onSaveSummary}
 downloadProgress={downloadProgress}
 participants={[]}
 />
 );
 }
 };

 return (
 <div className="w-[400px] lg:w-[450px] shrink-0 border-l border-white/[0.08] bg-[#080810] flex flex-col h-full animate-in slide-in-from-right-8 duration-500 relative z-20 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]">
 {/* Header */}
 <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02] backdrop-blur-md shrink-0">
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center">
 <Bot className="w-4 h-4 text-emerald-400" />
 </div>
 <h3 className="font-semibold text-white/90">ChatrAI Assistant</h3>
 </div>
 
 {isListening ? (
 isAiReady ? (
 <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full" title="ChatrAI is actively listening and transcribing">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
 <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Live ChatrAI</span>
 </div>
 ) : (
 <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full" title="Local ChatrAI is downloading or starting up...">
 <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
 <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Warming Up</span>
 </div>
 )
 ) : (
 <div className="flex items-center gap-2 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full cursor-help" title={transcriptError || 'Local ChatrAI is offline'}>
 <AlertCircle className="w-3 h-3 text-red-400" />
 <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Offline</span>
 </div>
 )}
 </div>
 
 {/* Scrollable Content Area */}
 <ScrollArea className="flex-1">
 <div className="p-5 pb-20">
 {renderContent()}
 </div>
 </ScrollArea>
 </div>
 );
};

/* -------------------------------------------------------------------------- */
/* SALES ASSISTANT */
/* -------------------------------------------------------------------------- */

const SalesAssistant = ({ remoteUserName, activeTab, setActiveTab, transcript }: any) => {
 const tabs = ['Overview', 'Notes', 'Actions', 'Timeline'];
 const [contactData, setContactData] = useState<any>(null);
 const [callHistory, setCallHistory] = useState<any[]>([]);
 const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
 const [loadingTopics, setLoadingTopics] = useState(false);
 const [checkedTopics, setCheckedTopics] = useState<Set<number>>(new Set());
 const [notes, setNotes] = useState('');

 // Load real contact data from Supabase by username/name
 useEffect(() => {
 if (!remoteUserName) return;
 const load = async () => {
 const { data } = await supabase
 .from('profiles')
 .select('id, full_name, username, avatar_url, phone_number, created_at')
 .or(`full_name.ilike.%${remoteUserName}%,username.ilike.%${remoteUserName}%`)
 .limit(1)
 .maybeSingle();
 setContactData(data);

 if (data?.id) {
 const { data: calls } = await supabase
 .from('calls')
 .select('id, call_type, started_at, status, duration')
 .or(`caller_id.eq.${data.id},receiver_id.eq.${data.id}`)
 .order('started_at', { ascending: false })
 .limit(10);
 setCallHistory(calls || []);
 }
 };
 load();
 }, [remoteUserName]);

 const generateTopics = async () => {
 setLoadingTopics(true);
 setSuggestedTopics([]);
 try {
 const context = [
 `Client: ${remoteUserName || 'Unknown'}`,
 `Past calls: ${callHistory.length}`,
 `Current transcript: ${transcript || 'Call just started'}`,
 ].join('. ');
 const results = await callAI('sales', context, 5);
 if (results.length > 0) setSuggestedTopics(results);
 else throw new Error('empty');
 } catch {
 setSuggestedTopics([
 '❌ ChatrAI generation failed. Check your local Ollama or cloud API key.'
 ]);
 } finally {
 setLoadingTopics(false);
 }
 };

 // Auto-generate topics on mount
 useEffect(() => { generateTopics(); }, [remoteUserName]);

 const sessionCount = callHistory.length;
 const lastContactStr = callHistory[0]
 ? new Date(callHistory[0].started_at).toLocaleDateString()
 : 'Never';

 return (
 <div className="space-y-6">
 {/* Tabs */}
 <div className="flex p-1 bg-white/[0.03] border border-white/[0.05] rounded-lg">
 {tabs.map((tab, i) => (
 <button
 key={tab}
 onClick={() => setActiveTab(i)}
 className={cn(
 "flex-1 py-1.5 text-label rounded-md transition-all",
 activeTab === i ? "bg-white/[0.08] text-white shadow-sm" : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
 )}
 >
 {tab}
 </button>
 ))}
 </div>

 {activeTab === 0 && (
 <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
 {/* Real Profile Card */}
 <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-start gap-4 shadow-lg shadow-blue-900/10">
 <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-bold">
 {(remoteUserName || 'C')[0].toUpperCase()}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <h4 className="text-secondary font-semibold text-white/90">{remoteUserName || 'Client'}</h4>
 {sessionCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium uppercase tracking-wider">Existing</span>}
 </div>
 <p className="text-label text-blue-400/80 mt-1 ">
 {contactData?.phone_number || 'No phone number on record'}
 </p>
 </div>
 </div>

 {/* Real Metrics from Supabase */}
 <div className="grid grid-cols-3 gap-2">
 {[
 { label: 'Sessions', val: String(sessionCount) },
 { label: 'Call Type', val: callHistory[0]?.call_type || '—' },
 { label: 'Last Contact', val: lastContactStr },
 ].map(m => (
 <div key={m.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center justify-center text-center">
 <span className="text-section font-bold text-white/90">{m.val}</span>
 <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{m.label}</span>
 </div>
 ))}
 </div>

 {/* AI-Generated Suggested Topics */}
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-widest">ChatrAI Suggested Topics</h4>
 <button
 onClick={generateTopics}
 disabled={loadingTopics}
 className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors"
 >
 {loadingTopics ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
 Regenerate
 </button>
 </div>
 {loadingTopics && (
 <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
 <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
 <span className="text-label text-purple-400">ChatrAI is generating topics...</span>
 </div>
 )}
 <div className="space-y-2">
 {suggestedTopics.map((topic, i) => (
 <label key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer transition-colors">
 <input
 type="checkbox"
 checked={checkedTopics.has(i)}
 onChange={() => setCheckedTopics(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
 className="rounded border-white/20 bg-black/50 text-blue-500 focus:ring-blue-500/50"
 />
 <span className={cn('text-secondary transition-colors', checkedTopics.has(i) ? 'text-white/30 line-through' : 'text-white/70')}>{topic}</span>
 </label>
 ))}
 </div>
 </div>
 </div>
 )}

 {activeTab === 1 && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <textarea 
 className="w-full h-64 p-4 rounded-xl bg-black/40 border border-white/[0.08] text-white/80 text-secondary focus:outline-none focus:border-blue-500/50 resize-none"
 placeholder="Your notes will appear here..."
 value={notes}
 onChange={e => setNotes(e.target.value)}
 />
 </div>
 )}

 {activeTab === 2 && (
 <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
 {[
 { icon: FileText, label: 'Generate Quotation', desc: 'Draft based on conversation', color: 'text-blue-400', bg: 'bg-blue-500/10' },
 { icon: Send, label: 'Send Brochure', desc: 'Email the enterprise deck', color: 'text-purple-400', bg: 'bg-purple-500/10' },
 { icon: Calendar, label: 'Schedule Follow-up', desc: 'Find time next week', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
 { icon: CheckCircle2, label: 'Create Task', desc: 'Add to CRM pipeline', color: 'text-orange-400', bg: 'bg-orange-500/10' },
 ].map((action, i) => (
 <button key={i} className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all group text-left">
 <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", action.bg)}>
 <action.icon className={cn("w-5 h-5", action.color)} />
 </div>
 <div className="flex-1">
 <div className="text-secondary font-medium text-white/90">{action.label}</div>
 <div className="text-label text-white/40">{action.desc}</div>
 </div>
 <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
 </button>
 ))}
 </div>
 )}

 {activeTab === 3 && (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pt-4 px-2">
 {callHistory.length === 0 && (
 <p className="text-label text-white/30 text-center py-6">No call history found for this contact.</p>
 )}
 {callHistory.map((call, i) => (
 <div key={call.id} className="relative pl-6 pb-6 last:pb-0">
 <div className="absolute left-0 top-1 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-[#080810]" />
 {i !== callHistory.length - 1 && <div className="absolute left-1 top-3 w-px h-full bg-white/[0.08]" />}
 <div className="text-label text-white/40 mb-1">{new Date(call.started_at).toLocaleDateString()}</div>
 <div className="text-secondary text-white/80">{call.call_type === 'video' ? 'Video Call' : 'Voice Call'} — {call.status}</div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
};

/* -------------------------------------------------------------------------- */
/* RECRUITMENT ASSISTANT */
/* -------------------------------------------------------------------------- */

const RecruitmentAssistant = ({ remoteUserName, activeTab, setActiveTab, transcript }: any) => {
 const tabs = ['Scorecard', 'Interview', 'Notes', 'Summary'];
 const [scores, setScores] = useState<Record<string, number>>({});
 const [questions, setQuestions] = useState<string[]>([]);
 const [checkedQuestions, setCheckedQuestions] = useState<Set<number>>(new Set());
 const [loadingQuestions, setLoadingQuestions] = useState(false);
 const [notes, setNotes] = useState('');
 const [jobRole, setJobRole] = useState('');
 
 const criteria = ['Communication', 'Technical Skills', 'Culture Fit', 'Leadership', 'Problem Solving'];
 const avgScore = criteria.length ? criteria.reduce((sum, c) => sum + (scores[c] || 0), 0) / criteria.length : 0;

 const generateInterviewQuestions = async () => {
 setLoadingQuestions(true);
 setQuestions([]);
 try {
 const context = [
 `Candidate: ${remoteUserName || 'Unknown'}`,
 `Role: ${jobRole || 'not specified'}`,
 `Transcript so far: ${transcript || 'Interview just started'}`,
 ].join('. ');
 const results = await callAI('recruitment', context, 6);
 if (results.length > 0) setQuestions(results);
 else throw new Error('empty');
 } catch {
 setQuestions([
 '❌ ChatrAI generation failed. Check your local Ollama or cloud API key.'
 ]);
 } finally {
 setLoadingQuestions(false);
 }
 };

 useEffect(() => { generateInterviewQuestions(); }, [remoteUserName]);

 return (
 <div className="space-y-6">
 {/* Tabs */}
 <div className="flex p-1 bg-white/[0.03] border border-white/[0.05] rounded-lg">
 {tabs.map((tab, i) => (
 <button
 key={tab}
 onClick={() => setActiveTab(i)}
 className={cn(
 "flex-1 py-1.5 text-label rounded-md transition-all",
 activeTab === i ? "bg-white/[0.08] text-white shadow-sm" : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
 )}
 >
 {tab}
 </button>
 ))}
 </div>

 {activeTab === 0 && (
 <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 flex items-start justify-between gap-4 shadow-lg shadow-purple-900/10">
 <div className="flex-1">
 <h4 className="text-secondary font-semibold text-white/90">{remoteUserName || 'Candidate'}</h4>
 <input
 className="text-input text-purple-400/80 mt-1 bg-transparent border-none outline-none w-full placeholder:text-purple-400/40"
 value={jobRole}
 onChange={e => setJobRole(e.target.value)}
 placeholder="Type the role being interviewed for..."
 onBlur={() => { if (jobRole) generateInterviewQuestions(); }}
 />
 </div>
 <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 flex items-center justify-center shrink-0 bg-black/40">
 <span className="text-secondary font-bold text-purple-400">{avgScore > 0 ? avgScore.toFixed(1) : '—'}</span>
 </div>
 </div>

 <div className="space-y-3">
 {criteria.map(skill => (
 <div key={skill} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
 <div className="text-label text-white/70 mb-2">{skill}</div>
 <div className="flex gap-1">
 {[1, 2, 3, 4, 5].map(i => (
 <button 
 key={i} 
 onClick={() => setScores(s => ({...s, [skill]: i}))}
 className={cn(
 "flex-1 h-8 rounded-lg border transition-all flex items-center justify-center text-label ",
 (scores[skill] || 0) >= i 
 ? "bg-purple-500/20 border-purple-500/50 text-purple-300" 
 : "bg-black/40 border-white/[0.06] text-white/30 hover:bg-white/[0.05]"
 )}
 >
 {i}
 </button>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {activeTab === 1 && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
 <div className="flex justify-between text-label text-white/50 mb-2">
 <span>Interview Progress</span>
 <span>{checkedQuestions.size} of {questions.length} questions</span>
 </div>
 <div className="w-full h-1.5 rounded-full bg-black/50 overflow-hidden">
 <div
 className="h-full bg-purple-500 rounded-full transition-all"
 style={{ width: questions.length ? `${(checkedQuestions.size / questions.length) * 100}%` : '0%' }}
 />
 </div>
 </div>

 <div className="flex items-center justify-between">
 <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-widest">ChatrAI Questions</h4>
 <button
 onClick={generateInterviewQuestions}
 disabled={loadingQuestions}
 className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors"
 >
 {loadingQuestions ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
 Regenerate
 </button>
 </div>

 {loadingQuestions && (
 <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
 <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
 <span className="text-label text-purple-400">ChatrAI is generating interview questions...</span>
 </div>
 )}

 <div className="space-y-2">
 {questions.map((q, i) => (
 <label key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer transition-colors">
 <input
 type="checkbox"
 checked={checkedQuestions.has(i)}
 onChange={() => setCheckedQuestions(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
 className="mt-0.5 rounded border-white/20 bg-black/50 text-purple-500 focus:ring-purple-500/50"
 />
 <span className={cn('text-secondary transition-colors', checkedQuestions.has(i) ? 'text-white/40 line-through' : 'text-white/80')}>{q}</span>
 </label>
 ))}
 </div>
 </div>
 )}

 {activeTab === 2 && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <textarea 
 className="w-full h-64 p-4 rounded-xl bg-black/40 border border-white/[0.08] text-white/80 text-secondary focus:outline-none focus:border-purple-500/50 resize-none"
 placeholder="Interview notes..."
 value={notes}
 onChange={e => setNotes(e.target.value)}
 />
 </div>
 )}

 {activeTab === 3 && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 h-full flex flex-col justify-center">
 <div className="p-8 rounded-xl border border-white/[0.06] bg-white/[0.02] border-dashed text-center space-y-4">
 <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto">
 <FileText className="w-6 h-6 text-purple-400" />
 </div>
 <div>
 <div className="text-secondary font-medium text-white/90">Interview Report</div>
 <div className="text-label text-white/40 mt-1">Avg Score: {avgScore > 0 ? avgScore.toFixed(1) : '—'} · {checkedQuestions.size}/{questions.length} questions asked</div>
 </div>
 </div>
 <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20">
 Generate Report Now
 </Button>
 </div>
 )}
 </div>
 );
};

/* -------------------------------------------------------------------------- */
/* CLINIC ASSISTANT */
/* -------------------------------------------------------------------------- */


const ClinicAssistant = ({ remoteUserName, activeTab, setActiveTab, transcript }: any) => {
 const tabs = ['Patient', 'Notes', 'Prescribe', 'Next Steps'];
 const [patientData, setPatientData] = useState<any>(null);
 const [chiefComplaint, setChiefComplaint] = useState('');
 const [clinicalNotes, setClinicalNotes] = useState('');
 const [medications, setMedications] = useState<string[]>([]);
 const [newMed, setNewMed] = useState('');
 const [nextSteps, setNextSteps] = useState<string[]>([]);
 const [loadingSteps, setLoadingSteps] = useState(false);
 const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

 // Load real patient profile
 useEffect(() => {
 if (!remoteUserName) return;
 supabase
 .from('profiles')
 .select('id, full_name, username, phone_number, created_at')
 .or(`full_name.ilike.%${remoteUserName}%,username.ilike.%${remoteUserName}%`)
 .limit(1)
 .maybeSingle()
 .then(({ data }) => setPatientData(data));
 }, [remoteUserName]);

 // AI-generated clinical next steps based on transcript
 const generateNextSteps = async () => {
 setLoadingSteps(true);
 try {
 const context = `Patient: ${remoteUserName}. Complaint: ${chiefComplaint || 'not recorded yet'}. Transcript: ${transcript || 'Consultation just started.'}`;
 const results = await callAI('clinic', context, 5);
 if (results.length > 0) setNextSteps(results);
 else throw new Error('empty');
 } catch {
 setNextSteps([
 '❌ ChatrAI generation failed. Check your local Ollama or cloud API key.'
 ]);
 } finally {
 setLoadingSteps(false);
 }
 };

 useEffect(() => { generateNextSteps(); }, [remoteUserName]);

 const memberSince = patientData?.created_at
 ? new Date(patientData.created_at).toLocaleDateString()
 : '—';

 return (
 <div className="space-y-6">
 {/* Tabs */}
 <div className="flex p-1 bg-white/[0.03] border border-white/[0.05] rounded-lg">
 {tabs.map((tab, i) => (
 <button
 key={tab}
 onClick={() => setActiveTab(i)}
 className={cn(
 "flex-1 py-1.5 text-label rounded-md transition-all",
 activeTab === i ? "bg-white/[0.08] text-white shadow-sm" : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
 )}
 >
 {tab}
 </button>
 ))}
 </div>

 {activeTab === 0 && (
 <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-4 shadow-lg shadow-emerald-900/10">
 <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
 <Stethoscope className="w-5 h-5 text-emerald-400" />
 </div>
 <div>
 <h4 className="text-secondary font-semibold text-emerald-100">{remoteUserName || 'Patient'}</h4>
 <p className="text-label text-emerald-400/80 mt-1">{patientData?.phone_number || 'Phone not on record'}</p>
 </div>
 </div>

 {/* Real data from profiles */}
 <div className="grid grid-cols-3 gap-2">
 {[
 { label: 'Phone', val: patientData?.phone_number ? patientData.phone_number.slice(-4) : '—' },
 { label: 'Member Since', val: memberSince },
 { label: 'Username', val: patientData?.username ? '@' + patientData.username : '—' },
 ].map(m => (
 <div key={m.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col items-center justify-center text-center">
 <span className="text-secondary font-bold text-white/90 truncate w-full text-center">{m.val}</span>
 <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{m.label}</span>
 </div>
 ))}
 </div>

 {/* Live Chief Complaint — entered by doctor */}
 <div className="space-y-2">
 <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-widest">Chief Complaint</h4>
 <textarea
 className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-secondary text-white/80 min-h-[80px] focus:outline-none focus:border-emerald-500/40 resize-none"
 placeholder="Enter patient's chief complaint..."
 value={chiefComplaint}
 onChange={e => setChiefComplaint(e.target.value)}
 />
 </div>
 </div>
 )}

 {activeTab === 1 && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <textarea 
 className="w-full h-64 p-4 rounded-xl bg-black/40 border border-white/[0.08] text-white/80 text-secondary focus:outline-none focus:border-emerald-500/50 resize-none"
 placeholder="Clinical notes (SOAP format suggested)..."
 value={clinicalNotes}
 onChange={e => setClinicalNotes(e.target.value)}
 />
 </div>
 )}

 {activeTab === 2 && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="flex gap-2">
 <input
 className="flex-1 p-2 rounded-xl bg-black/40 border border-white/[0.08] text-white/80 text-input focus:outline-none focus:border-emerald-500/40 placeholder:text-white/30"
 placeholder="Add medication (e.g. Ibuprofen 400mg 1 tab BID)..."
 value={newMed}
 onChange={e => setNewMed(e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter' && newMed.trim()) { setMedications(p => [...p, newMed.trim()]); setNewMed(''); } }}
 />
 <button
 onClick={() => { if (newMed.trim()) { setMedications(p => [...p, newMed.trim()]); setNewMed(''); } }}
 className="px-3 py-2 rounded-xl bg-emerald-600/40 hover:bg-emerald-500/60 text-emerald-300 text-label font-bold transition-all"
 >Add</button>
 </div>

 {medications.length === 0 && (
 <p className="text-label text-white/30 text-center py-2">No medications added yet.</p>
 )}
 <div className="space-y-2">
 {medications.map((med, i) => (
 <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
 <div className="text-secondary font-medium text-white/90">{med}</div>
 <button onClick={() => setMedications(p => p.filter((_, j) => j !== i))} className="text-red-400/50 hover:text-red-400 text-label transition-colors">✕</button>
 </div>
 ))}
 </div>

 <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 mt-4">
 <Printer className="w-4 h-4 mr-2" /> Print Prescription
 </Button>
 </div>
 )}

 {activeTab === 3 && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="flex items-center justify-between">
 <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-widest">ChatrAI Next Steps</h4>
 <button
 onClick={generateNextSteps}
 disabled={loadingSteps}
 className="flex items-center gap-1 text-[9px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
 >
 {loadingSteps ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
 Regenerate
 </button>
 </div>
 {loadingSteps && (
 <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
 <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
 <span className="text-label text-emerald-400">ChatrAI is generating clinical next steps...</span>
 </div>
 )}
 <div className="space-y-2">
 {nextSteps.map((item, i) => (
 <label key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer transition-colors">
 <input
 type="checkbox"
 checked={checkedSteps.has(i)}
 onChange={() => setCheckedSteps(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
 className="mt-0.5 rounded border-white/20 bg-black/50 text-emerald-500 focus:ring-emerald-500/50"
 />
 <span className={cn('text-secondary transition-colors', checkedSteps.has(i) ? 'text-white/30 line-through' : 'text-white/80')}>{item}</span>
 </label>
 ))}
 </div>
 </div>
 )}
 </div>
 );
};

/* -------------------------------------------------------------------------- */
/* GENERAL ASSISTANT */
/* -------------------------------------------------------------------------- */

const TRANSCRIPT_LINES: any[] = [];
const AI_TIMELINE_EVENTS: any[] = [];
const SHARED_FILES_LIST: any[] = [];
const MEETING_CHAT: any[] = [];

const GeneralAssistant = ({
 activeTab,
 setActiveTab,
 transcript,
 remoteUserName,
 remoteUserAvatar,
 participants,
 onSaveTranscript,
 onSaveSummary,
 downloadProgress,
}: any) => {
 const tabs = ['Agenda', 'Transcript', 'Summary', 'Tasks', 'Files', 'Chat', 'Insights'];
 
 const [agenda, setAgenda] = useState([
 { id: 1, text: "Welcome and Introductions", done: false },
 { id: 2, text: "Project Status Update", done: false },
 { id: 3, text: "Blockers and Risks", done: false },
 { id: 4, text: "Next Steps", done: false }
 ]);
 const [tasks, setTasks] = useState<string[]>([]);
 const [newItem, setNewItem] = useState('');
 const [newTask, setNewTask] = useState('');
 const [chatInput, setChatInput] = useState('');
 const transcriptEndRef = useRef<HTMLDivElement>(null);

 // AI hooks — both route through generate() in @/services/ai
 const meetingTitle = remoteUserName ? `Call with ${remoteUserName}` : 'Meeting';
 const participantList = (participants || []).map((p: any) => ({
 name: typeof p === 'string' ? p : p.name || 'Participant',
 }));

 const { questions: suggestedQuestions, loading: questionsLoading, refresh: refreshQuestions } =
 useSuggestedQuestions({ meetingTitle, participants: participantList, transcript });

 const { summary, loading: generatingSummary, generateSummary } =
 useCallSummary({ meetingTitle, transcript });

 const handleGenerateSummary = async () => {
 const generated = await generateSummary();
 if (generated) {
 await onSaveSummary?.(generated, transcript);
 }
 setActiveTab(2);
 };

 useEffect(() => {
 if (activeTab === 1 && transcriptEndRef.current) {
 transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
 }
 }, [activeTab, transcript]);

 React.useEffect(() => {
 if ((window as any).electronAPI) {
 (window as any).electronAPI.on('agenda-update', (data: any) => {
 if (data.agenda_completed) {
 setAgenda(prev => prev.map(item => {
 const isCompleted = data.agenda_completed.some((c: string) => 
 item.text.toLowerCase().includes(c.toLowerCase()) || 
 c.toLowerCase().includes(item.text.toLowerCase())
 );
 return isCompleted ? { ...item, done: true } : item;
 }));
 }
 if (data.tasks && data.tasks.length > 0) {
 setTasks(prev => {
 const newTasks = data.tasks.filter((t: string) => !prev.includes(t));
 return [...prev, ...newTasks];
 });
 }
 });
 }
 }, []);
 
 return (
 <div className="space-y-4">
 {/* Tabs — 2-row compact layout */}
 <div className="space-y-1">
 <div className="flex p-1 bg-white/[0.03] border border-white/[0.05] rounded-lg gap-0.5">
 {tabs.slice(0, 4).map((tab, i) => (
 <button
 key={tab}
 onClick={() => setActiveTab(i)}
 className={cn(
 "flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all",
 activeTab === i ? "bg-white/[0.10] text-white shadow-sm" : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]"
 )}
 >
 {tab}
 </button>
 ))}
 </div>
 <div className="flex p-1 bg-white/[0.03] border border-white/[0.05] rounded-lg gap-0.5">
 {tabs.slice(4).map((tab, i) => (
 <button
 key={tab}
 onClick={() => setActiveTab(i + 4)}
 className={cn(
 "flex-1 py-1.5 text-[10px] font-semibold rounded-md transition-all",
 activeTab === i + 4 ? "bg-white/[0.10] text-white shadow-sm" : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]"
 )}
 >
 {tab}
 </button>
 ))}
 </div>
 </div>

 {/* Tab 0: Agenda */}
 {activeTab === 0 && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="flex gap-2">
 <input 
 type="text" 
 value={newItem}
 onChange={(e) => setNewItem(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && newItem.trim()) {
 setAgenda([...agenda, { id: Date.now(), text: newItem.trim(), done: false }]);
 setNewItem('');
 }
 }}
 placeholder="Add agenda item..." 
 className="flex-1 px-3 py-2 text-secondary bg-black/40 border border-white/[0.08] rounded-lg focus:outline-none focus:border-indigo-500/50 text-white"
 />
 <Button 
 variant="secondary" 
 onClick={() => {
 if (newItem.trim()) {
 setAgenda([...agenda, { id: Date.now(), text: newItem.trim(), done: false }]);
 setNewItem('');
 }
 }}
 className="bg-white/[0.05] hover:bg-white/[0.1] text-white"
 >
 Add
 </Button>
 </div>
 <div className="space-y-2">
 {agenda.map((item) => (
 <label key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer transition-colors">
 <input 
 type="checkbox" 
 checked={item.done}
 onChange={(e) => setAgenda(prev => prev.map(a => a.id === item.id ? { ...a, done: e.target.checked } : a))}
 className="rounded border-white/20 bg-black/50 text-indigo-500 focus:ring-indigo-500/50" 
 />
 <span className={cn("text-secondary transition-colors", item.done ? "text-white/40 line-through" : "text-white/80")}>{item.text}</span>
 </label>
 ))}
 </div>

 {/* AI Suggested Questions — from useSuggestedQuestions via generate() */}
 <div className="pt-2 space-y-2">
 <div className="flex items-center justify-between">
 <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
 <Sparkles className="w-3 h-3 text-indigo-400" /> ChatrAI Questions
 </h4>
 <button
 onClick={refreshQuestions}
 disabled={questionsLoading}
 className="flex items-center gap-1 text-[9px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
 >
 {questionsLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
 Regenerate
 </button>
 </div>
 {questionsLoading && (
 <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
 <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
 <span className="text-label text-indigo-400">ChatrAI is generating questions…</span>
 </div>
 )}
 {suggestedQuestions.map((q, i) => (
 <div key={i} className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-label text-white/70 ">
 {q}
 </div>
 ))}
 </div>
 </div>
 )}


 {/* Tab 1: Transcript */}
 {activeTab === 1 && (
 <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
 <Mic className="w-3 h-3 text-red-400 animate-pulse" />
 <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider">Live Transcript</span>
 </div>
 <span className="text-[10px] text-white/30">Auto-saved</span>
 </div>
 <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
 <div className="text-secondary text-white/80 p-2 whitespace-pre-line">
 {transcript || (
 downloadProgress !== null 
 ? <span className="text-white/30 italic flex items-center gap-2"><div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>Warming up AI...</span>
 : <span className="text-white/30 italic">No transcript recorded yet... Start speaking!</span>
 )}
 </div>
 <div ref={transcriptEndRef} />
 </div>
 <div className="flex gap-2 pt-1">
 <button
 onClick={() => onSaveTranscript?.(transcript)}
 disabled={!transcript?.trim()}
 className="flex-1 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.08] text-[10px] text-white/60 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
 >
 <Download className="w-3 h-3" /> Export
 </button>
 <button 
 onClick={handleGenerateSummary}
 disabled={generatingSummary}
 className="flex-1 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-[10px] text-white font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
 >
 {generatingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
 {generatingSummary ? 'Summarizing...' : 'Summarize'}
 </button>
 </div>
 </div>
 )}

 {/* Tab 2: Summary */}
 {activeTab === 2 && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 {/* AI Timeline */}
 <div className="space-y-1.5">
 <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
 <Activity className="w-3 h-3" /> AI Timeline
 </h4>
 <div className="space-y-0">
 {AI_TIMELINE_EVENTS.map((event, i) => (
 <div key={i} className="relative flex items-center gap-3 pl-4">
 {i < AI_TIMELINE_EVENTS.length - 1 && (
 <div className="absolute left-[5px] top-3 bottom-0 w-px bg-white/[0.08]" />
 )}
 <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 absolute left-0', event.color)} />
 <div className="flex items-center gap-3 py-2">
 <span className="text-[9px] font-mono text-white/25 w-10">{event.time}</span>
 <span className={cn('text-label ', event.textColor)}>{event.label}</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] border-dashed text-center space-y-3">
 <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto">
 <Share2 className="w-5 h-5 text-indigo-400" />
 </div>
 <div>
 <div className="text-secondary font-medium text-white/90">Auto-Generate Summary</div>
 <div className="text-label text-white/40 mt-1">Generate a structured AI summary with decisions, actions, and key points.</div>
 </div>
 </div>
 {summary && (
 <div className="p-4 rounded-xl bg-white/[0.02] border border-indigo-500/20 text-secondary text-white/80 whitespace-pre-line ">
 {summary}
 </div>
 )}
 <Button
 className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20 disabled:opacity-50"
 onClick={handleGenerateSummary}
 disabled={generatingSummary}
 >
 {generatingSummary
 ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
 : <><Sparkles className="w-4 h-4 mr-2" /> Generate Summary</>}
 </Button>
 </div>
 )}

 {/* Tab 3: Tasks */}
 {activeTab === 3 && (
 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="flex gap-2">
 <input 
 type="text" 
 value={newTask}
 onChange={(e) => setNewTask(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && newTask.trim()) {
 setTasks([...tasks, newTask.trim()]);
 setNewTask('');
 }
 }}
 placeholder="Add action item..." 
 className="flex-1 px-3 py-2 text-secondary bg-black/40 border border-white/[0.08] rounded-lg focus:outline-none focus:border-indigo-500/50 text-white"
 />
 <Button 
 variant="secondary" 
 onClick={() => { if (newTask.trim()) { setTasks([...tasks, newTask.trim()]); setNewTask(''); } }}
 className="bg-white/[0.05] hover:bg-white/[0.1] text-white"
 >Add</Button>
 </div>
 <div className="space-y-2">
 {tasks.length === 0 ? (
 <div className="p-8 rounded-xl border border-white/[0.06] bg-white/[0.02] border-dashed text-center">
 <CheckCircle2 className="w-6 h-6 text-white/20 mx-auto mb-2" />
 <p className="text-secondary text-white/40">No tasks created yet.</p>
 <p className="text-label text-white/25 mt-1">AI will auto-detect action items from transcript.</p>
 </div>
 ) : (
 tasks.map((task, i) => (
 <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
 <CheckCircle2 className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
 <span className="text-secondary text-white/90">{task}</span>
 </div>
 ))
 )}
 </div>
 </div>
 )}

 {/* Tab 4: Files */}
 {activeTab === 4 && (
 <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="flex items-center justify-between">
 <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Meeting Files</h4>
 <button className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium">+ Upload</button>
 </div>
 {SHARED_FILES_LIST.map((file, i) => (
 <button key={i} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all text-left group">
 <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-workspace shrink-0', file.bg, 'border', file.border)}>
 {file.emoji}
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-label text-white/90 truncate">{file.name}</div>
 <div className="text-[9px] text-white/40 mt-0.5">{file.size}</div>
 </div>
 <Download className={cn('w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity', file.color)} />
 </button>
 ))}
 </div>
 )}

 {/* Tab 5: Chat */}
 {activeTab === 5 && (
 <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
 {MEETING_CHAT.map((msg, i) => (
 <div key={i} className={cn('flex items-start gap-2', msg.self && 'flex-row-reverse')}>
 {!msg.self && (
 <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
 {msg.sender[0]}
 </div>
 )}
 <div className={cn('max-w-[75%]', msg.self && 'items-end flex flex-col')}>
 {!msg.self && <div className="text-[9px] text-white/40 mb-1">{msg.sender} · {msg.time}</div>}
 <div className={cn('px-3 py-2 rounded-2xl text-label', msg.self ? 'bg-indigo-600/80 text-white' : 'bg-white/[0.06] text-white/80')}>
 {msg.text}
 </div>
 {msg.self && <div className="text-[9px] text-white/30 mt-1">{msg.time}</div>}
 </div>
 </div>
 ))}
 </div>
 <div className="flex gap-2">
 <input
 type="text"
 value={chatInput}
 onChange={(e) => setChatInput(e.target.value)}
 placeholder="Message everyone..."
 className="flex-1 px-3 py-2 text-secondary bg-black/40 border border-white/[0.08] rounded-lg focus:outline-none focus:border-indigo-500/50 text-white"
 />
 <button className="w-9 h-9 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 flex items-center justify-center transition-all">
 <Send className="w-4 h-4 text-white" />
 </button>
 </div>
 </div>
 )}

 {/* Tab 6: Insights */}
 {activeTab === 6 && (
 <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
 <AIInsightsPanel
 remoteUserName={remoteUserName}
 remoteUserAvatar={remoteUserAvatar}
 transcript={transcript}
 participants={participants || []}
 />
 </div>
 )}
 </div>
 );
};
