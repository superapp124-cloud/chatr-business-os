import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { calendarService } from '@/core/services/CalendarService';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export const OutlookCalendarCallback: React.FC = () => {
 const [searchParams] = useSearchParams();
 const navigate = useNavigate();
 const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
 const [message, setMessage] = useState('Connecting your Outlook Calendar...');

 useEffect(() => {
 const code = searchParams.get('code');
 const error = searchParams.get('error');
 const errorDesc = searchParams.get('error_description');

 if (error) {
 setStatus('error');
 setMessage(errorDesc || `Microsoft denied access: ${error}`);
 setTimeout(() => navigate('/desktop/chat'), 3000);
 return;
 }

 if (!code) {
 setStatus('error');
 setMessage('No authorization code received from Microsoft.');
 setTimeout(() => navigate('/desktop/chat'), 3000);
 return;
 }

 (async () => {
 try {
 const conn = await calendarService.outlook.handleCallback(code);
 calendarService.saveConnection(conn);
 setStatus('success');
 setMessage(`Connected as ${conn.email}`);
 setTimeout(() => navigate('/desktop/chat?pane=calendar'), 2000);
 } catch (err: any) {
 setStatus('error');
 setMessage(err.message || 'Outlook Calendar connection failed.');
 setTimeout(() => navigate('/desktop/chat'), 3000);
 }
 })();
 }, []);

 return (
 <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
 <div className="flex flex-col items-center gap-6 max-w-sm text-center p-8">
 {status === 'loading' && (
 <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
 <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
 </div>
 )}
 {status === 'success' && (
 <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
 <CheckCircle2 className="w-8 h-8 text-emerald-400" />
 </div>
 )}
 {status === 'error' && (
 <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
 <XCircle className="w-8 h-8 text-red-400" />
 </div>
 )}

 <div>
 <h2 className="text-white font-bold text-section mb-2">
 {status === 'loading' && 'Connecting Outlook Calendar'}
 {status === 'success' && 'Outlook Calendar Connected!'}
 {status === 'error' && 'Connection Failed'}
 </h2>
 <p className="text-white/50 text-secondary">{message}</p>
 {status !== 'loading' && (
 <p className="text-white/30 text-label mt-3">Redirecting you back...</p>
 )}
 </div>
 </div>
 </div>
 );
};
