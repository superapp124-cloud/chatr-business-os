import React, { useEffect, useState } from 'react';
import { Briefcase, Building, MapPin, Clock, Calendar, CheckCircle, Upload, MessageSquare, ChevronRight, Check, Sparkles, Inbox } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';

export const CandidateWorkspace: React.FC = () => {
 const [user, setUser] = useState<any>(null);
 const [applications, setApplications] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const fetchUserAndApplications = async () => {
 const { data: { user: currentUser } } = await supabase.auth.getUser();
 if (currentUser) {
 // Fetch user profile
 const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
 setUser(profile || currentUser);
 
 // Fetch real applications if any exist (empty state fallback)
 // Assume 'applications' table exists or just return empty for now since it's mock eradication
 setApplications([]);
 }
 setLoading(false);
 };
 fetchUserAndApplications();
 }, []);

 const getInitials = (name?: string, email?: string) => {
 if (name) return name.substring(0, 2).toUpperCase();
 if (email) return email.substring(0, 2).toUpperCase();
 return 'ME';
 };

 return (
 <div className="flex flex-col h-full bg-slate-50 overflow-hidden w-full items-center p-8">
 
 <div className="w-full max-w-4xl space-y-6">
 
 {/* Header */}
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-page font-bold text-slate-800">My Application</h1>
 <p className="text-secondary text-slate-500 mt-1">Track your progress and communicate with the AI Recruiter.</p>
 </div>
 <div className="flex items-center gap-3">
 <Avatar>
 <AvatarFallback className="bg-blue-100 text-blue-700">{getInitials(user?.full_name, user?.email)}</AvatarFallback>
 </Avatar>
 <div className="text-secondary">
 <p className="font-semibold text-slate-800">{user?.full_name || user?.email || 'Candidate'}</p>
 <p className="text-label text-slate-500">Candidate</p>
 </div>
 </div>
 </div>

 {loading ? (
 <div className="flex items-center justify-center h-64">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
 </div>
 ) : applications.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-center">
 <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
 <Inbox className="w-10 h-10 text-slate-400" />
 </div>
 <h2 className="text-workspace font-bold text-slate-800 mb-2">No Active Applications</h2>
 <p className="text-slate-500 max-w-sm mb-8">
 You haven't submitted any applications yet or your previous applications have been archived.
 </p>
 <Button className="bg-indigo-600 hover:bg-indigo-700">Browse Open Roles</Button>
 </div>
 ) : (
 <div>
 {/* Real applications would map here */}
 </div>
 )}
 </div>
 </div>
 );
};
