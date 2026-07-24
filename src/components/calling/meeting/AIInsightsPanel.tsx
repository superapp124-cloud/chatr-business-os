import React, { useEffect, useState } from 'react';
import { Bot, Lightbulb, TrendingUp, CheckCircle2, AlertTriangle, Users, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generate } from '@/services/ai';

interface AISuggestion {
 type: 'info' | 'warning' | 'action';
 text: string;
}

interface AIInsightsPanelProps {
 remoteUserName?: string;
 remoteUserAvatar?: string;
 transcript?: string;
 participants?: { id: string; name: string; isSpeaking?: boolean }[];
}

const PARTICIPATION_COLOR = {
 Excellent: 'text-emerald-400',
 Good: 'text-blue-400',
 Low: 'text-amber-400',
};

const SUGGESTION_STYLES = {
 info: { icon: Lightbulb, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
 warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
 action: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
};

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({
 remoteUserName,
 remoteUserAvatar,
 transcript = '',
 participants = [],
}) => {
 const [remoteProfile, setRemoteProfile] = useState<any>(null);
 const [callCount, setCallCount] = useState<number | null>(null);
 const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
 const [loadingSuggestions, setLoadingSuggestions] = useState(false);
 const [participationLevel, setParticipationLevel] = useState<'Excellent' | 'Good' | 'Low'>('Good');
 const [engagementPct, setEngagementPct] = useState(0);

 // Load real profile for the remote user
 useEffect(() => {
 if (!remoteUserName) return;
 const load = async () => {
 const { data } = await supabase
 .from('profiles')
 .select('id, full_name, username, avatar_url, phone_number, created_at')
 .or(`full_name.ilike.%${remoteUserName}%,username.ilike.%${remoteUserName}%`)
 .limit(1)
 .maybeSingle();
 setRemoteProfile(data);

 if (data?.id) {
 const { count } = await supabase
 .from('calls')
 .select('id', { count: 'exact', head: true })
 .or(`caller_id.eq.${data.id},receiver_id.eq.${data.id}`);
 setCallCount(count || 0);
 }
 };
 load();
 }, [remoteUserName]);

 // Compute engagement from transcript length + participant count
 useEffect(() => {
 const wordCount = transcript.split(' ').filter(Boolean).length;
 const pct = Math.min(100, Math.round((wordCount / 200) * 100));
 setEngagementPct(pct);
 if (pct >= 60) setParticipationLevel('Excellent');
 else if (pct >= 30) setParticipationLevel('Good');
 else setParticipationLevel('Low');
 }, [transcript]);

 // Generate live AI suggestions from transcript
 const generateSuggestions = async () => {
 if (!transcript && !remoteUserName) return;
 setLoadingSuggestions(true);
 try {
 const context = [
 remoteUserName ? `Meeting with: ${remoteUserName}` : '',
 `Participants: ${participants.length + 1}`,
 transcript ? `Transcript excerpt: ${transcript.slice(-800)}` : 'Call just started.',
 ].filter(Boolean).join('. ');

 const text = await generate({
 preferLocal: true,
 prompt: `You are a private local meeting assistant running on Ollama only.
Give exactly 4 concise live meeting suggestions for this context.
Mix action items, risks, decisions, and participant engagement notes when useful.
Return one suggestion per line, no numbering.

Context: ${context}`,
 });

 const raw: AISuggestion[] = text
 .split('\n')
 .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
 .filter((line: string) => line.length > 5)
 .slice(0, 4)
 .map((text: string) => ({ type: 'info' as const, text }));

 if (raw.length > 0) setSuggestions(raw);
 } catch {
 setSuggestions([
 { type: 'info', text: transcript ? `${transcript.split(' ').filter(Boolean).length} words captured in transcript.` : 'AI is listening. Start speaking to get live suggestions.' },
 { type: 'action', text: 'Click "Summary" tab when ready for an AI-generated call summary.' },
 ]);
 } finally {
 setLoadingSuggestions(false);
 }
 };

 // Auto-generate suggestions when transcript crosses 30 words, then every 60s
 useEffect(() => {
 const wordCount = transcript.split(' ').filter(Boolean).length;
 if (wordCount > 0 && wordCount % 30 === 0) {
 generateSuggestions();
 }
 }, [transcript]);

 // Also generate on mount with a short delay
 useEffect(() => {
 const t = setTimeout(generateSuggestions, 3000);
 return () => clearTimeout(t);
 }, [remoteUserName]);

 const displayName = remoteProfile?.full_name || remoteUserName || 'Participant';
 const displayAvatar = remoteProfile?.avatar_url || remoteUserAvatar;

 return (
 <div className="space-y-5">
 {/* Current Speaker — Real Profile */}
 <div className="space-y-2">
 <div className="flex items-center gap-1.5">
 <Users className="w-3.5 h-3.5 text-purple-400" />
 <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Current Speaker</h4>
 </div>
 <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
 <div className="flex items-center gap-3">
 <Avatar className="w-10 h-10 ring-2 ring-emerald-400/60 shrink-0">
 <AvatarImage src={displayAvatar} />
 <AvatarFallback className="bg-gradient-to-br from-purple-600 to-blue-500 text-secondary font-bold text-white">
 {displayName[0]?.toUpperCase() || '?'}
 </AvatarFallback>
 </Avatar>
 <div>
 <div className="flex items-center gap-2">
 <span className="text-secondary font-semibold text-white/90">{displayName}</span>
 <span className="text-[8px] text-emerald-400 font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Speaking</span>
 </div>
 <div className="text-[10px] text-white/40 mt-0.5">
 {remoteProfile?.username ? `@${remoteProfile.username}` : 'CHATR User'}
 {remoteProfile?.phone_number ? ` · ${remoteProfile.phone_number.slice(-4)}` : ''}
 </div>
 </div>
 </div>
 <div className="grid grid-cols-3 gap-2">
 {[
 { label: 'Past Calls', val: callCount !== null ? String(callCount) : '—' },
 { label: 'Participants', val: String(participants.length + 1) },
 { label: 'Words So Far', val: String(transcript.split(' ').filter(Boolean).length) },
 ].map((m, i) => (
 <div key={i} className="p-2 rounded-lg bg-black/30 text-center">
 <div className="text-secondary font-bold text-white/90">{m.val}</div>
 <div className="text-[9px] text-white/40 mt-0.5">{m.label}</div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Meeting Health — computed from real transcript */}
 <div className="space-y-2">
 <div className="flex items-center gap-1.5">
 <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
 <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Meeting Health</h4>
 </div>
 <div className="p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-label text-white/60">Participation</span>
 <span className={cn('text-label font-bold', PARTICIPATION_COLOR[participationLevel])}>
 {participationLevel}
 </span>
 </div>
 <div className="space-y-1.5">
 <div className="flex items-center justify-between text-[10px]">
 <span className="text-white/50">Engagement (transcript coverage)</span>
 <span className="text-emerald-400 font-bold">{engagementPct}%</span>
 </div>
 <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
 <div
 className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
 style={{ width: `${engagementPct}%` }}
 />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div className="p-2.5 rounded-lg bg-black/30 text-center">
 <div className="text-body font-bold text-emerald-400">{participants.length + 1}</div>
 <div className="text-[9px] text-white/40">In Call</div>
 </div>
 <div className="p-2.5 rounded-lg bg-black/30 text-center">
 <div className="text-body font-bold text-blue-400">{transcript ? '🟢' : '🔴'}</div>
 <div className="text-[9px] text-white/40">AI Active</div>
 </div>
 </div>
 </div>
 </div>

 {/* AI Suggestions — generated from real transcript */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <Bot className="w-3.5 h-3.5 text-indigo-400" />
 <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest">AI Suggestions</h4>
 </div>
 <button
 onClick={generateSuggestions}
 disabled={loadingSuggestions}
 className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 disabled:opacity-50 transition-colors"
 >
 {loadingSuggestions ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
 Refresh
 </button>
 </div>

 {loadingSuggestions && (
 <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
 <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
 <span className="text-label text-indigo-400">Chatr AI is analyzing the call...</span>
 </div>
 )}

 {suggestions.length === 0 && !loadingSuggestions && (
 <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
 <p className="text-label text-white/30">AI suggestions will appear as the conversation progresses.</p>
 </div>
 )}

 <div className="space-y-2">
 {suggestions.map((s, i) => {
 const style = SUGGESTION_STYLES[s.type] || SUGGESTION_STYLES.info;
 return (
 <div key={i} className={cn('flex items-start gap-2.5 p-3 rounded-xl border', style.bg, style.border)}>
 <style.icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', style.color)} />
 <p className="text-[11px] text-white/70 leading-relaxed">{s.text}</p>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 );
};
