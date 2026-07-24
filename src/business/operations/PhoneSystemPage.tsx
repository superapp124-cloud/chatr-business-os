import React, { useState } from 'react';
import { PhoneCall, Play, Settings, Plus, PhoneIncoming, Voicemail, History, PhoneForwarded } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import WorkflowBuilder from '@/components/business/automation/WorkflowBuilder';
import { useBusinessPhone } from '@/hooks/useBusinessPhone';
import { formatDistanceToNow } from 'date-fns';

export default function PhoneSystem() {
 const [activeTab, setActiveTab] = useState<'logs' | 'ivr'>('logs');
 const { callLogs, isLoading, simulateCall } = useBusinessPhone();

 const totalCalls = callLogs.length;
 const missedCalls = callLogs.filter(c => c.status === 'missed').length;
 const voicemails = callLogs.filter(c => c.status === 'voicemail').length;
 const avgDuration = totalCalls > 0 ? Math.floor(callLogs.reduce((acc, curr) => acc + curr.duration_seconds, 0) / totalCalls) : 0;

 const formatDuration = (seconds: number) => {
 if (seconds === 0) return '0s';
 const m = Math.floor(seconds / 60);
 const s = seconds % 60;
 if (m > 0) return `${m}m ${s}s`;
 return `${s}s`;
 };

 return (
 <div className="h-full bg-gray-50 dark:bg-[#0B0F19] overflow-y-auto">
 <div className="max-w-7xl mx-auto px-6 py-8">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-display text-gray-900 dark:text-white flex items-center gap-3">
 <PhoneCall className="h-8 w-8 text-emerald-500" />
 Business Phone
 </h1>
 <p className="text-gray-500 dark:text-white/60 mt-2">
 Manage call logs, voicemails, and visual IVR routing via the automation engine.
 </p>
 </div>
 <div className="flex bg-white dark:bg-black/20 p-1 rounded-lg border border-gray-200 dark:border-white/10">
 <button 
 onClick={() => setActiveTab('logs')}
 className={`px-4 py-2 rounded-md text-secondary font-medium transition-all ${activeTab === 'logs' ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'}`}
 >
 Call Logs
 </button>
 <button 
 onClick={() => setActiveTab('ivr')}
 className={`px-4 py-2 rounded-md text-secondary font-medium transition-all ${activeTab === 'ivr' ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'}`}
 >
 IVR Routing
 </button>
 </div>
 </div>

 {activeTab === 'logs' ? (
 <div className="space-y-6 animate-fade-in">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <Card className="dark:bg-black/20 border-gray-200 dark:border-white/10">
 <CardHeader className="pb-2 flex flex-row items-center justify-between">
 <CardTitle className="text-secondary font-medium text-gray-500">Total Calls</CardTitle>
 <PhoneIncoming className="w-4 h-4 text-emerald-500" />
 </CardHeader>
 <CardContent><div className="text-page font-bold">{totalCalls}</div></CardContent>
 </Card>
 <Card className="dark:bg-black/20 border-gray-200 dark:border-white/10">
 <CardHeader className="pb-2 flex flex-row items-center justify-between">
 <CardTitle className="text-secondary font-medium text-gray-500">Missed Calls</CardTitle>
 <PhoneForwarded className="w-4 h-4 text-rose-500" />
 </CardHeader>
 <CardContent><div className="text-page font-bold">{missedCalls}</div></CardContent>
 </Card>
 <Card className="dark:bg-black/20 border-gray-200 dark:border-white/10">
 <CardHeader className="pb-2 flex flex-row items-center justify-between">
 <CardTitle className="text-secondary font-medium text-gray-500">Voicemails</CardTitle>
 <Voicemail className="w-4 h-4 text-purple-500" />
 </CardHeader>
 <CardContent><div className="text-page font-bold">{voicemails}</div></CardContent>
 </Card>
 <Card className="dark:bg-black/20 border-gray-200 dark:border-white/10">
 <CardHeader className="pb-2 flex flex-row items-center justify-between">
 <CardTitle className="text-secondary font-medium text-gray-500">Avg Duration</CardTitle>
 <History className="w-4 h-4 text-blue-500" />
 </CardHeader>
 <CardContent><div className="text-page font-bold">{formatDuration(avgDuration)}</div></CardContent>
 </Card>
 </div>

 <Card className="dark:bg-black/20 border-gray-200 dark:border-white/10">
 <CardHeader className="flex flex-row items-center justify-between">
 <CardTitle>Recent Activity</CardTitle>
 <Button onClick={simulateCall} variant="outline" size="sm" className="border-emerald-500 text-emerald-600 dark:text-emerald-400">
 <PhoneIncoming className="w-4 h-4 mr-2" />
 Simulate Call
 </Button>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {isLoading ? (
 <div className="text-center py-8 text-gray-500">Loading call history...</div>
 ) : callLogs.length === 0 ? (
 <div className="text-center py-8 text-gray-500">No calls recorded yet.</div>
 ) : (
 callLogs.map((call) => (
 <div key={call.id} className="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
 <div className="flex items-center gap-4">
 <div className={`p-3 rounded-full ${call.status === 'missed' ? 'bg-rose-500/10 text-rose-500' : call.status === 'voicemail' ? 'bg-purple-500/10 text-purple-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
 {call.status === 'missed' ? <PhoneForwarded className="w-5 h-5" /> : call.status === 'voicemail' ? <Voicemail className="w-5 h-5" /> : <PhoneCall className="w-5 h-5" />}
 </div>
 <div>
 <div className="font-semibold text-gray-900 dark:text-white">{call.caller_number}</div>
 <div className="text-secondary text-gray-500 dark:text-white/60">Called {call.receiver_number} • {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}</div>
 </div>
 </div>
 <div className="flex items-center gap-4">
 <div className="text-secondary font-medium text-gray-700 dark:text-white/80">{formatDuration(call.duration_seconds)}</div>
 {call.recording_url && (
 <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 dark:text-emerald-400">
 <Play className="w-4 h-4" />
 </Button>
 )}
 </div>
 </div>
 ))
 )}
 </div>
 </CardContent>
 </Card>
 </div>
 ) : (
 <div className="h-[600px] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden animate-fade-in relative">
 <div className="absolute top-4 right-4 z-10 flex gap-2">
 <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">Save Routing</Button>
 </div>
 {/* We reuse the WorkflowBuilder but it functions as IVR routing visually */}
 <WorkflowBuilder workflowId="ivr-main" />
 </div>
 )}
 </div>
 </div>
 );
}
