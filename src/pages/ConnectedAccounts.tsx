import React, { useState } from 'react';
import {
 ArrowUpRight,
 CheckCircle2,
 Github,
 Link,
 Mail,
 MessageSquare,
 Shield,
 UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type AuthMode = 'login' | 'signup';

interface AccountProvider {
 id: string;
 name: string;
 category: string;
 icon: React.ReactNode;
 color: string;
 loginUrl: string;
}

const providers: AccountProvider[] = [
 { id: 'google', name: 'Google Workspace', category: 'Mail, Calendar, Drive', icon: <Mail className="h-5 w-5" />, color: 'bg-rose-500', loginUrl: 'https://accounts.google.com/' },
 { id: 'microsoft', name: 'Microsoft 365', category: 'Outlook, Teams, OneDrive', icon: <Mail className="h-5 w-5" />, color: 'bg-blue-600', loginUrl: 'https://login.microsoftonline.com/' },
 { id: 'slack', name: 'Slack', category: 'Work chat', icon: <MessageSquare className="h-5 w-5" />, color: 'bg-purple-600', loginUrl: 'https://slack.com/signin' },
 { id: 'github', name: 'GitHub', category: 'Code and issues', icon: <Github className="h-5 w-5" />, color: 'bg-slate-700', loginUrl: 'https://github.com/login' },
 { id: 'linkedin', name: 'LinkedIn', category: 'Professional network', icon: <Link className="h-5 w-5" />, color: 'bg-sky-600', loginUrl: 'https://www.linkedin.com/login' },
 { id: 'salesforce', name: 'Salesforce', category: 'CRM', icon: <Link className="h-5 w-5" />, color: 'bg-cyan-600', loginUrl: 'https://login.salesforce.com/' },
];

const openBrowserAuth = async (mode: AuthMode) => {
 const electronAuth = (window as any).electronAPI?.auth;

 if (electronAuth) {
 return mode === 'signup' ? electronAuth.openSignup() : electronAuth.openLogin();
 }

 const url = new URL('/auth', 'https://chatr.chat');
 url.searchParams.set('mode', mode);
 url.searchParams.set('source', 'desktop');
 window.open(url.toString(), '_blank', 'noopener,noreferrer');
 return { ok: true, url: url.toString() };
};

const openProviderLogin = async (provider: AccountProvider) => {
 const electronAuth = (window as any).electronAPI?.auth;

 if (electronAuth?.openProviderLogin) {
 return electronAuth.openProviderLogin(provider.id);
 }

 window.open(provider.loginUrl, '_blank', 'noopener,noreferrer');
 return { ok: true, url: provider.loginUrl };
};

export default function ConnectedAccounts() {
 const { toast } = useToast();
 const [opening, setOpening] = useState<AuthMode | null>(null);
 const [openingProvider, setOpeningProvider] = useState<string | null>(null);

 const startAuth = async (mode: AuthMode) => {
 setOpening(mode);

 try {
 await openBrowserAuth(mode);
 toast({
 title: mode === 'signup' ? 'Signup opened in browser' : 'Login opened in browser',
 description: 'Complete CHATR authentication in your browser, then return to the desktop app.',
 });
 } catch (err) {
 toast({
 title: 'Could not open browser',
 description: err instanceof Error ? err.message : 'Please open https://chatr.chat/auth manually.',
 variant: 'destructive',
 });
 } finally {
 setOpening(null);
 }
 };

 const startProviderLogin = async (provider: AccountProvider) => {
 setOpeningProvider(provider.id);

 try {
 await openProviderLogin(provider);
 toast({
 title: `${provider.name} opened in browser`,
 description: 'Complete login in your browser. Real OAuth connection will be wired in the next provider step.',
 });
 } catch (err) {
 toast({
 title: `Could not open ${provider.name}`,
 description: err instanceof Error ? err.message : `Please open ${provider.loginUrl} manually.`,
 variant: 'destructive',
 });
 } finally {
 setOpeningProvider(null);
 }
 };

 return (
 <div className="flex-1 h-full overflow-y-auto bg-[#0a0a0c]">
 <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6 lg:p-10">
 <section className="flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
 <div className="max-w-2xl">
 <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/20">
 <Link className="h-6 w-6 text-indigo-300" />
 </div>
 <h1 className="text-display tracking-tight text-white">Connected Accounts</h1>
 <p className="mt-3 text-secondary leading-6 text-slate-400">
 Start by signing in or creating your CHATR account in the browser. Provider connections will unlock after desktop identity is active.
 </p>
 </div>

 <div className="flex flex-col gap-3 sm:flex-row">
 <Button
 onClick={() => startAuth('login')}
 disabled={opening !== null}
 className="h-11 rounded-lg bg-white px-5 font-semibold text-black hover:bg-slate-200"
 >
 <ArrowUpRight className="mr-2 h-4 w-4" />
 {opening === 'login' ? 'Opening...' : 'Log in'}
 </Button>
 <Button
 onClick={() => startAuth('signup')}
 disabled={opening !== null}
 variant="outline"
 className="h-11 rounded-lg border-white/15 bg-white/5 px-5 font-semibold text-white hover:bg-white/10"
 >
 <UserPlus className="mr-2 h-4 w-4" />
 {opening === 'signup' ? 'Opening...' : 'Create account'}
 </Button>
 </div>
 </section>

 <section className="grid gap-4 md:grid-cols-3">
 <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
 <Shield className="mb-3 h-5 w-5 text-emerald-300" />
 <h2 className="text-secondary font-semibold text-emerald-100">Desktop-first auth</h2>
 <p className="mt-2 text-secondary leading-6 text-emerald-100/70">
 Authentication starts in the system browser. The desktop app stays local and does not collect provider passwords.
 </p>
 </div>
 <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
 <CheckCircle2 className="mb-3 h-5 w-5 text-sky-300" />
 <h2 className="text-secondary font-semibold text-white">No provider API required</h2>
 <p className="mt-2 text-secondary leading-6 text-slate-400">
 This screen no longer depends on unfinished OAuth provider APIs or mock connected-account data.
 </p>
 </div>
 <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
 <Link className="mb-3 h-5 w-5 text-indigo-300" />
 <h2 className="text-secondary font-semibold text-white">Ready for real OAuth later</h2>
 <p className="mt-2 text-secondary leading-6 text-slate-400">
 Provider cards remain visible so the desktop identity flow has a clear next connection step.
 </p>
 </div>
 </section>

 <section>
 <div className="mb-4 flex items-center justify-between gap-4">
 <div>
 <h2 className="text-section text-white">Provider connections</h2>
 <p className="mt-1 text-secondary text-slate-500">Available after CHATR browser authentication is completed.</p>
 </div>
 </div>

 <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
 {providers.map((provider) => (
 <div
 key={provider.id}
 className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/35 p-5"
 >
 <div className="flex min-w-0 items-center gap-4">
 <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white', provider.color)}>
 {provider.icon}
 </div>
 <div className="min-w-0">
 <h3 className="truncate text-body font-semibold text-white">{provider.name}</h3>
 <p className="mt-1 truncate text-secondary text-slate-500">{provider.category}</p>
 </div>
 </div>

 <Button
 onClick={() => startProviderLogin(provider)}
 disabled={opening !== null || openingProvider !== null}
 variant="outline"
 className="h-10 shrink-0 rounded-lg border-white/10 bg-white/[0.03] px-4 text-secondary font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
 >
 <ArrowUpRight className="mr-2 h-4 w-4" />
 {openingProvider === provider.id ? 'Opening...' : 'Login'}
 </Button>
 </div>
 ))}
 </div>
 </section>
 </div>
 </div>
 );
}
