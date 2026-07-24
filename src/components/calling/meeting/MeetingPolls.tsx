import React, { useState, useEffect } from 'react';
import { BarChart2, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCallContext } from '@/contexts/CallContext';
import { toast } from 'sonner';

interface Poll {
 id: string;
 question: string;
 options: string[];
 created_at: string;
}

interface Vote {
 poll_id: string;
 user_id: string;
 option_index: number;
}

export const MeetingPolls: React.FC = () => {
 const { activeRoomId, currentUserId } = useCallContext();
 const [isHost, setIsHost] = useState(false);
 const [polls, setPolls] = useState<Poll[]>([]);
 const [votes, setVotes] = useState<Vote[]>([]);
 const [showCreate, setShowCreate] = useState(false);
 
 // Create Poll Form State
 const [question, setQuestion] = useState('');
 const [options, setOptions] = useState(['', '']);

 useEffect(() => {
 if (!activeRoomId || !currentUserId) return;

 // Check if current user is host
 const checkHost = async () => {
 const { data } = await supabase
 .from('session_rooms')
 .select('host_id')
 .eq('id', activeRoomId)
 .single();
 if (data?.host_id === currentUserId) setIsHost(true);
 };
 checkHost();

 // Fetch existing polls and votes
 const fetchPolls = async () => {
 const { data: pData } = await supabase
 .from('meeting_polls')
 .select('*')
 .eq('room_id', activeRoomId)
 .order('created_at', { ascending: false });
 
 if (pData) setPolls(pData);

 const pollIds = pData?.map(p => p.id) || [];
 if (pollIds.length > 0) {
 const { data: vData } = await supabase
 .from('meeting_poll_votes')
 .select('*')
 .in('poll_id', pollIds);
 if (vData) setVotes(vData);
 }
 };
 fetchPolls();

 // Subscribe to realtime changes
 const pollSub = supabase
 .channel(`polls-${activeRoomId}`)
 .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_polls', filter: `room_id=eq.${activeRoomId}` }, (payload) => {
 if (payload.eventType === 'INSERT') setPolls(p => [payload.new as Poll, ...p]);
 if (payload.eventType === 'DELETE') setPolls(p => p.filter(poll => poll.id !== payload.old.id));
 })
 .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_poll_votes' }, (payload) => {
 if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
 setVotes(v => {
 const next = [...v.filter(vote => !(vote.poll_id === payload.new.poll_id && vote.user_id === payload.new.user_id))];
 next.push(payload.new as Vote);
 return next;
 });
 }
 })
 .subscribe();

 return () => {
 supabase.removeChannel(pollSub);
 };
 }, [activeRoomId, currentUserId]);

 const handleCreatePoll = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!question.trim() || options.filter(o => o.trim()).length < 2) {
 toast.error('Enter a question and at least 2 options.');
 return;
 }
 
 try {
 const { error } = await supabase.from('meeting_polls').insert({
 room_id: activeRoomId,
 created_by: currentUserId,
 question: question.trim(),
 options: options.filter(o => o.trim())
 });
 if (error) throw error;
 toast.success('Poll created successfully!');
 setShowCreate(false);
 setQuestion('');
 setOptions(['', '']);
 } catch (err: any) {
 toast.error('Failed to create poll: ' + err.message);
 }
 };

 const handleVote = async (pollId: string, optionIndex: number) => {
 try {
 const { error } = await supabase
 .from('meeting_poll_votes')
 .upsert({
 poll_id: pollId,
 user_id: currentUserId,
 option_index: optionIndex
 }, { onConflict: 'poll_id,user_id' });
 
 if (error) throw error;
 } catch (err: any) {
 toast.error('Failed to cast vote: ' + err.message);
 }
 };

 const handleDeletePoll = async (pollId: string) => {
 try {
 const { error } = await supabase.from('meeting_polls').delete().eq('id', pollId);
 if (error) throw error;
 toast.success('Poll deleted.');
 } catch (err: any) {
 toast.error('Failed to delete poll: ' + err.message);
 }
 };

 return (
 <div className="flex-1 flex flex-col h-full bg-zinc-900/50">
 <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
 <h3 className="text-secondary font-semibold text-white/90 flex items-center gap-2">
 <BarChart2 className="w-4 h-4 text-purple-400" />
 Polls & Q&A
 </h3>
 {isHost && !showCreate && (
 <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-label font-bold text-white transition-colors">
 <Plus className="w-3.5 h-3.5" /> New Poll
 </button>
 )}
 </div>

 <div className="flex-1 overflow-y-auto p-4 space-y-6">
 {showCreate && isHost && (
 <form onSubmit={handleCreatePoll} className="bg-white/[0.03] border border-purple-500/30 rounded-xl p-4 space-y-3">
 <h4 className="text-label font-bold text-white/70">Create New Poll</h4>
 <input 
 value={question} onChange={e => setQuestion(e.target.value)}
 placeholder="Ask a question..."
 className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-secondary text-white focus:outline-none focus:border-purple-500"
 />
 <div className="space-y-2">
 {options.map((opt, i) => (
 <div key={i} className="flex gap-2">
 <input 
 value={opt} onChange={e => { const no = [...options]; no[i] = e.target.value; setOptions(no); }}
 placeholder={`Option ${i+1}`}
 className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-label text-white focus:outline-none focus:border-purple-500"
 />
 {options.length > 2 && (
 <button type="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))} className="text-white/30 hover:text-red-400">
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 ))}
 </div>
 {options.length < 5 && (
 <button type="button" onClick={() => setOptions([...options, ''])} className="text-label text-purple-400 hover:text-purple-300 ">
 + Add Option
 </button>
 )}
 <div className="flex gap-2 pt-2">
 <button type="submit" className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-button font-bold text-white transition-colors">Publish Poll</button>
 <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-label text-white transition-colors">Cancel</button>
 </div>
 </form>
 )}

 {polls.length === 0 && !showCreate && (
 <div className="flex flex-col items-center justify-center py-10 text-center">
 <BarChart2 className="w-8 h-8 text-white/20 mb-3" />
 <p className="text-secondary text-white/50">No active polls.</p>
 {isHost && <p className="text-label text-white/30 mt-1">Create one to engage your audience.</p>}
 </div>
 )}

 {polls.map(poll => {
 const pollVotes = votes.filter(v => v.poll_id === poll.id);
 const totalVotes = pollVotes.length;
 const myVote = pollVotes.find(v => v.user_id === currentUserId);

 return (
 <div key={poll.id} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-4 relative group">
 {isHost && (
 <button onClick={() => handleDeletePoll(poll.id)} className="absolute top-3 right-3 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 <h4 className="text-secondary font-semibold text-white/90 mb-4 pr-6">{poll.question}</h4>
 <div className="space-y-2">
 {poll.options.map((opt, idx) => {
 const votesForOpt = pollVotes.filter(v => v.option_index === idx).length;
 const percent = totalVotes > 0 ? Math.round((votesForOpt / totalVotes) * 100) : 0;
 const isSelected = myVote?.option_index === idx;

 return (
 <button 
 key={idx}
 onClick={() => handleVote(poll.id, idx)}
 className="w-full relative overflow-hidden rounded-lg border flex flex-col justify-center text-left transition-all bg-black/20 hover:bg-white/[0.04]"
 style={{ 
 borderColor: isSelected ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255,255,255,0.05)',
 }}
 >
 <div 
 className="absolute left-0 top-0 bottom-0 bg-purple-500/20 transition-all duration-500 ease-out" 
 style={{ width: `${percent}%` }}
 />
 <div className="relative px-3 py-2 flex items-center justify-between z-10">
 <div className="flex items-center gap-2">
 {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
 <span className="text-label text-white/80">{opt}</span>
 </div>
 {totalVotes > 0 && <span className="text-label text-white/50">{percent}%</span>}
 </div>
 </button>
 );
 })}
 </div>
 <div className="text-[10px] text-white/30 mt-3 text-right">
 {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
};
