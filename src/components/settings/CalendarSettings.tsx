import React, { useState, useEffect } from 'react';
import { calendarService, CalendarConnection } from '@/core/services/CalendarService';
import { CheckCircle2, AlertCircle, Globe, ExternalLink, Loader2, Trash2, RefreshCcw, Calendar, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProviderCardProps {
 provider: 'google' | 'outlook' | 'local';
 name: string;
 description: string;
 icon: React.ReactNode;
 connection: CalendarConnection | undefined;
 onConnect: () => void;
 onDisconnect: () => void;
 isConfigured: boolean;
 isConnecting: boolean;
 accentColor: string;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
 provider, name, description, icon, connection, onConnect, onDisconnect,
 isConfigured, isConnecting, accentColor
}) => {
 const isConnected = connection?.connected;

 return (
 <div className={cn(
 'relative rounded-2xl border p-5 transition-all duration-300',
 isConnected
 ? 'bg-emerald-950/30 border-emerald-500/30'
 : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
 )}>
 {/* Status indicator */}
 {isConnected && (
 <div className="absolute top-4 right-4">
 <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2.5 py-1">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
 <span className="text-[10px] font-semibold text-emerald-400 tracking-wider uppercase">Connected</span>
 </div>
 </div>
 )}

 {/* Header */}
 <div className="flex items-start gap-4 mb-4">
 <div className={cn(
 'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-workspace',
 `bg-${accentColor}-500/10 border border-${accentColor}-500/20`
 )}>
 {icon}
 </div>
 <div>
 <h3 className="text-secondary font-bold text-white/90">{name}</h3>
 <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{description}</p>
 </div>
 </div>

 {/* Connected account info */}
 {isConnected && connection && (
 <div className="mb-4 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
 <p className="text-[11px] text-white/50 mb-0.5">Signed in as</p>
 <p className="text-label font-semibold text-white/80">{connection.name || connection.email}</p>
 {connection.email && connection.name && (
 <p className="text-[10px] text-white/40">{connection.email}</p>
 )}
 </div>
 )}

 {/* Not configured warning */}
 {!isConfigured && !isConnected && provider !== 'local' && (
 <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
 <div className="flex items-start gap-2">
 <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
 <div>
 <p className="text-[10px] text-amber-300 font-semibold">API Key Required</p>
 <p className="text-[10px] text-amber-400/70 mt-0.5 leading-relaxed">
 Add <code className="font-mono bg-amber-500/10 px-1 rounded">VITE_{provider.toUpperCase()}_CLIENT_ID</code> to your .env file.
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Actions */}
 {provider === 'local' ? (
 <div className="flex items-center gap-2">
 <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
 <span className="text-[11px] text-white/60">Always available — downloads .ics files</span>
 </div>
 </div>
 ) : isConnected ? (
 <button
 onClick={onDisconnect}
 className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-white/[0.08] text-white/40 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-all text-[11px] font-medium"
 >
 <Trash2 className="w-3.5 h-3.5" />
 Disconnect {name}
 </button>
 ) : (
 <button
 onClick={onConnect}
 disabled={!isConfigured || isConnecting}
 className={cn(
 'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold transition-all',
 isConfigured
 ? 'bg-white/10 hover:bg-white/15 text-white border border-white/[0.08] hover:border-white/[0.15]'
 : 'bg-white/[0.03] text-white/25 border border-white/[0.04] cursor-not-allowed'
 )}
 >
 {isConnecting ? (
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 ) : (
 <ExternalLink className="w-3.5 h-3.5" />
 )}
 {isConnecting ? 'Connecting...' : `Connect ${name}`}
 </button>
 )}
 </div>
 );
};

interface CalendarSettingsProps {
 onClose?: () => void;
}

export const CalendarSettings: React.FC<CalendarSettingsProps> = ({ onClose }) => {
 const [connections, setConnections] = useState<CalendarConnection[]>([]);
 const [connecting, setConnecting] = useState<string | null>(null);

 const loadConnections = () => {
 setConnections(calendarService.getConnections());
 };

 useEffect(() => {
 loadConnections();

 // Handle OAuth2 callbacks from URL params
 const url = new URL(window.location.href);
 const code = url.searchParams.get('code');
 const state = url.searchParams.get('state');
 const provider = sessionStorage.getItem('chatr_oauth_provider');

 if (code && provider) {
 handleOAuthCallback(provider as 'google' | 'outlook', code);
 // Clean up URL
 window.history.replaceState({}, '', window.location.pathname);
 sessionStorage.removeItem('chatr_oauth_provider');
 }
 }, []);

 const handleOAuthCallback = async (provider: 'google' | 'outlook', code: string) => {
 setConnecting(provider);
 try {
 let conn: CalendarConnection;
 if (provider === 'google') {
 conn = await calendarService.google.handleCallback(code);
 } else {
 conn = await calendarService.outlook.handleCallback(code);
 }
 calendarService.saveConnection(conn);
 loadConnections();
 toast.success(`${provider === 'google' ? 'Google' : 'Outlook'} Calendar connected!`, {
 description: `Signed in as ${conn.email}`
 });
 } catch (err: any) {
 toast.error('Calendar connection failed', { description: err.message });
 } finally {
 setConnecting(null);
 }
 };

 const handleConnect = async (provider: 'google' | 'outlook') => {
 setConnecting(provider);
 sessionStorage.setItem('chatr_oauth_provider', provider);
 try {
 if (provider === 'google') {
 await calendarService.google.initiateLogin();
 } else {
 await calendarService.outlook.initiateLogin();
 }
 // Will redirect — won't reach here
 } catch (err: any) {
 toast.error('Failed to start login', { description: err.message });
 setConnecting(null);
 sessionStorage.removeItem('chatr_oauth_provider');
 }
 };

 const handleDisconnect = (provider: string) => {
 calendarService.removeConnection(provider);
 loadConnections();
 toast.info(`${provider} calendar disconnected`);
 };

 const getConnection = (provider: string) =>
 connections.find(c => c.provider === provider);

 const isGoogleConfigured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
 const isOutlookConfigured = !!import.meta.env.VITE_OUTLOOK_CLIENT_ID;

 return (
 <div className="flex flex-col h-full">
 {/* Header */}
 <div className="p-6 border-b border-white/[0.06]">
 <div className="flex items-center gap-3 mb-1">
 <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
 <Calendar className="w-4 h-4 text-violet-400" />
 </div>
 <div>
 <h2 className="text-secondary font-bold text-white/90">Calendar Connections</h2>
 <p className="text-[11px] text-white/40">Connect your calendars to schedule real events</p>
 </div>
 </div>
 </div>

 {/* Provider cards */}
 <div className="flex-1 p-5 space-y-3 overflow-y-auto">
 <ProviderCard
 provider="local"
 name="Local Computer"
 description="Downloads .ics files that open in macOS Calendar, Windows Calendar, Outlook, or any calendar app."
 icon={<Monitor className="w-5 h-5 text-slate-400" />}
 connection={{ provider: 'local', connected: true }}
 onConnect={() => {}}
 onDisconnect={() => {}}
 isConfigured={true}
 isConnecting={false}
 accentColor="slate"
 />

 <ProviderCard
 provider="google"
 name="Google Calendar"
 description="Creates events directly in Google Calendar. Sends invites to attendees automatically."
 icon={<span className="text-workspace">📅</span>}
 connection={getConnection('google')}
 onConnect={() => handleConnect('google')}
 onDisconnect={() => handleDisconnect('google')}
 isConfigured={isGoogleConfigured}
 isConnecting={connecting === 'google'}
 accentColor="blue"
 />

 <ProviderCard
 provider="outlook"
 name="Microsoft Outlook"
 description="Creates events in Outlook/Office 365. Sends meeting invites via Microsoft Graph API."
 icon={<span className="text-workspace">📆</span>}
 connection={getConnection('outlook')}
 onConnect={() => handleConnect('outlook')}
 onDisconnect={() => handleDisconnect('outlook')}
 isConfigured={isOutlookConfigured}
 isConnecting={connecting === 'outlook'}
 accentColor="indigo"
 />

 {/* Setup guide */}
 {(!isGoogleConfigured || !isOutlookConfigured) && (
 <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/20">
 <p className="text-[11px] text-violet-300 font-bold mb-2 flex items-center gap-2">
 <Globe className="w-3.5 h-3.5" />
 Setup Guide
 </p>
 <div className="space-y-2.5 text-[10px] text-white/40 leading-relaxed">
 {!isGoogleConfigured && (
 <div>
 <p className="text-white/60 font-semibold mb-1">Google Calendar:</p>
 <ol className="list-decimal list-inside space-y-1 pl-1">
 <li>Go to <span className="text-violet-400">console.cloud.google.com</span></li>
 <li>Create OAuth2 credentials → Web Application</li>
 <li>Add redirect URI: <code className="font-mono bg-white/5 px-1 rounded">{window.location.origin}/auth/google/callback</code></li>
 <li>Add <code className="font-mono bg-white/5 px-1 rounded">VITE_GOOGLE_CLIENT_ID=your_id</code> to .env</li>
 </ol>
 </div>
 )}
 {!isOutlookConfigured && (
 <div>
 <p className="text-white/60 font-semibold mb-1">Microsoft Outlook:</p>
 <ol className="list-decimal list-inside space-y-1 pl-1">
 <li>Go to <span className="text-violet-400">portal.azure.com</span> → App Registrations</li>
 <li>Add redirect URI: <code className="font-mono bg-white/5 px-1 rounded">{window.location.origin}/auth/outlook/callback</code></li>
 <li>Grant permissions: <code className="font-mono bg-white/5 px-1 rounded">Calendars.ReadWrite</code></li>
 <li>Add <code className="font-mono bg-white/5 px-1 rounded">VITE_OUTLOOK_CLIENT_ID=your_id</code> to .env</li>
 </ol>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 );
};
