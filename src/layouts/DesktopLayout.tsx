import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { AIStatusBadge } from '@/components/desktop/AIStatusBadge';
import {
  MessageSquare,
  Users,
  Phone,
  Settings,
  Search,
  LogOut,
  Bell,
  Moon,
  Sun,
  BrainCircuit,
  Briefcase,
  Store,
  Workflow,
  Clock,
  Inbox,
  Building2,
  Layers,
  Server,
  Shield,
  Sparkles,
  CheckSquare,
  FolderOpen,
  Calendar,
  Command,
  Activity,
  Hash,
  Globe,
  Zap,
  Package,
  UserPlus,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import chatrLogo from '@/assets/chatr-icon-logo.png';
import { CommunicationPulse } from '@/components/desktop/CommunicationPulse';
import { ChatrConsole } from '@/components/desktop/ChatrConsole';
import { useDesktopElectronIntegrations } from '@/hooks/useDesktopElectronIntegrations';
import { AppearanceSettings } from '@/components/desktop/AppearanceSettings';
import { useAppearanceStore } from '@/hooks/useAppearanceStore';
import { useCallContext } from '@/contexts/CallContext';
import { CommandPalette } from '@/components/desktop/CommandPalette';
import { QuickActionsBar } from '@/components/desktop/QuickActionsBar';
import { usePresence, PresenceStatus } from '@/hooks/usePresence';
import { ProductivityDock } from '@/components/desktop/ProductivityDock';
import { TinyAIIndicator } from '@/components/desktop/TinyAIIndicator';
import { GlobalIntentProvider } from '@/core/os/GlobalIntentProvider';
import { KernelErrorBoundary } from '@/components/desktop/KernelErrorBoundary';

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Communication',
    items: [
      { icon: MessageSquare, label: 'Chat',       subtitle: 'Messages & Conversations', path: '/desktop/chat' },
      { icon: Inbox,         label: 'Inbox',      subtitle: 'Unified Smart Inbox',       path: '/desktop/smart-inbox' },
      { icon: Phone,         label: 'Calls',      subtitle: 'Voice & Video Calls',       path: '/desktop/calls' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { icon: BrainCircuit,  label: 'AI Canvas',  subtitle: 'Business Canvas & Memory', path: '/desktop/canvas' },
      { icon: Bot,           label: 'AI Agents',  subtitle: 'Autonomous Agent Hub',    path: '/desktop/ai-agents' },
      { icon: Zap,           label: 'Execution',  subtitle: 'Intent OS Engine',         path: '/desktop/intelligence' },
      { icon: Store,         label: 'Marketplace',subtitle: 'Agent & Connector Store',  path: '/desktop/marketplace' },
      { icon: Package,       label: 'Ecosystem',  subtitle: 'Connector Marketplace',    path: '/desktop/connector-store' },
    ],
  },
  {
    label: 'Productivity & OS',
    items: [
      { icon: UserPlus,      label: 'Recruitment',subtitle: 'Talent OS & ATS Engine',    path: '/desktop/recruitment' },
      { icon: Layers,        label: 'Business OS', subtitle: 'Executive Control & IDE',   path: '/desktop/business-os' },
      { icon: Shield,        label: 'Enterprise', subtitle: 'Enterprise Security & Scale', path: '/enterprise' },
      { icon: Calendar,      label: 'Calendar',   subtitle: 'Schedules & Meetings',      path: '/desktop/calendar' },
      { icon: CheckSquare,   label: 'Tasks',      subtitle: 'Tasks & Workflows',         path: '/desktop/workspace' },
      { icon: Building2,     label: 'CRM',        subtitle: 'Customers & Deals',         path: '/desktop/pro/business' },
      { icon: Hash,          label: 'Tickets',    subtitle: 'Service Desk',              path: '/desktop/tickets' },
      { icon: FolderOpen,    label: 'Files',      subtitle: 'Documents & Media',         path: '/desktop/files' },
    ],
  },
  {
    label: 'System',
    items: [
      { icon: Bell,          label: 'Activity',   subtitle: 'Notifications & Alerts',   path: '/desktop/notifications' },
      { icon: Globe,         label: 'Accounts',   subtitle: 'Connected Providers',       path: '/desktop/connected-accounts' },
      { icon: Workflow,      label: 'Studio',     subtitle: 'Automations & Workflows',   path: '/desktop/studio' },
      { icon: Activity,      label: 'Inspector',  subtitle: 'Pipeline Observability',    path: '/desktop/inspector' },
      { icon: Server,        label: 'Health',     subtitle: 'Engine & Provider Health',  path: '/desktop/health' },
      { icon: Settings,      label: 'Settings',   subtitle: 'Preferences & Account',     path: '/desktop/settings' },
    ],
  },
];

// Flatten for routing
const navItems = NAV_SECTIONS.flatMap(s => s.items);

// ─── Presence dot ─────────────────────────────────────────────────────────────

const PresenceDot: React.FC<{ status: PresenceStatus }> = ({ status }) => {
  const colors: Record<string, string> = {
    online: 'bg-emerald-500',
    away: 'bg-amber-400',
    busy: 'bg-red-500',
    on_call: 'bg-blue-500 animate-pulse',
    in_meeting: 'bg-purple-500',
    sharing_screen: 'bg-cyan-500',
    recording: 'bg-red-600 animate-pulse',
    offline: 'bg-zinc-500',
  };
  return (
    <span className={cn(
      'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-zinc-900',
      colors[status] || colors.offline
    )} />
  );
};

// ─── Global Call Overlay ──────────────────────────────────────────────────────

const GlobalCallOverlay = () => {
  const { incomingRoom, answerCall, declineCall } = useCallContext();
  if (!incomingRoom) return null;
  return (
    <div className="absolute top-5 right-5 z-[9999] w-80 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-top-4 duration-300">
      <audio src="/ringtones/perfect-ring.mp3" autoPlay loop className="hidden" />
      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
          <Avatar className="w-14 h-14 ring-2 ring-emerald-500/50 relative">
            <AvatarImage src={incomingRoom.callerAvatar} />
            <AvatarFallback>{incomingRoom.callerName[0]}</AvatarFallback>
          </Avatar>
        </div>
        <div>
          <h3 className="font-bold text-lg text-white">{incomingRoom.callerFlag} {incomingRoom.callerName}</h3>
          <p className="text-xs text-emerald-400 font-medium tracking-wide uppercase">{incomingRoom.goal} session</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={declineCall} className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-semibold transition-colors">Decline</button>
        <button onClick={answerCall} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all">Join</button>
      </div>
    </div>
  );
};

// ─── Main Layout ──────────────────────────────────────────────────────────────

const DesktopLayout: React.FC = () => (
  <KernelErrorBoundary>
    <GlobalIntentProvider>
      <DesktopLayoutInner />
    </GlobalIntentProvider>
  </KernelErrorBoundary>
);

const DesktopLayoutInner = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { themeMode, accentColor, fontScale, fontFamily } = useAppearanceStore();
  const { myStatus, setStatus, getStatusColor, getStatusLabel } = usePresence(user?.id);

  // Font scale
  useEffect(() => {
    const scaleMap: any = { compact: '14px', standard: '16px', large: '18px' };
    document.documentElement.style.fontSize = scaleMap[fontScale] || '16px';
  }, [fontScale]);

  useDesktopElectronIntegrations(user?.id);

  // Theme sync
  useEffect(() => {
    const resolvedTheme = themeMode === 'system' ? (theme || 'dark') : themeMode;
    if (theme !== resolvedTheme) setTheme(resolvedTheme);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.send('window:update-theme', resolvedTheme);
    }
  }, [theme, themeMode, setTheme]);

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) setTimeout(() => fetchProfile(session.user.id), 0);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) fetchProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Global Ctrl+K / Ctrl+Space listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === ' ')) {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
      if (e.key === 'Escape') setCmdOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/web');
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-[#09090b] overflow-hidden">
        {/* Sidebar Skeleton */}
        <div className="w-[72px] shrink-0 border-r border-white/10 bg-[#09090b] flex flex-col items-center py-6 gap-6">
          <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
          <div className="flex-1 flex flex-col items-center gap-6 mt-4 w-full">
            {[1,2,3,4,5].map(i => <div key={i} className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse mt-auto" />
        </div>
        {/* Main Content Skeleton */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a12]">
          {/* Header */}
          <div className="h-14 border-b border-white/5 flex items-center px-6">
            <div className="w-48 h-5 rounded-lg bg-white/10 animate-pulse" />
          </div>
          {/* Body */}
          <div className="flex-1 p-8 flex flex-col gap-6">
            <div className="w-1/3 h-16 rounded-2xl bg-white/5 animate-pulse" />
            <div className="w-1/2 h-24 rounded-2xl bg-white/5 animate-pulse self-end" />
            <div className="w-2/3 h-20 rounded-2xl bg-white/5 animate-pulse" />
            <div className="w-1/4 h-12 rounded-2xl bg-white/5 animate-pulse self-end mt-4" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const isDark = themeMode === 'dark' || (themeMode === 'system' && theme === 'dark');

  const themeClasses: any = {
    dark:   'theme-dark text-white',
    light:  'theme-light text-zinc-950',
    system: theme === 'dark' ? 'theme-dark text-white' : 'theme-light text-zinc-950',
  }[themeMode];

  const sidebarClasses: any = {
    dark:   'bg-zinc-950/90 border-white/8 shadow-[4px_0_32px_rgba(0,0,0,0.6)]',
    light:  'bg-white/80 backdrop-blur-3xl border-zinc-200/70 shadow-sm',
    system: theme === 'dark'
      ? 'bg-zinc-950/90 border-white/8 shadow-[4px_0_32px_rgba(0,0,0,0.6)]'
      : 'bg-white/80 backdrop-blur-3xl border-zinc-200/70 shadow-sm',
  }[themeMode];

  const fontClasses: any = {
    inter: 'font-sans', sans: 'font-sans', serif: 'font-serif', mono: 'font-mono tracking-tight',
  }[fontFamily];

  const displayName = profile?.full_name || profile?.display_name || profile?.username || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const currentPath = `${location.pathname}${location.search}`;
  const isNavItemActive = (path: string) => {
    if (path.includes('?')) return currentPath === path;
    return location.pathname.startsWith(path) && !navItems.some(item => item.path.includes('?') && currentPath === item.path);
  };

  return (
    <TooltipProvider>
      <div className={cn('h-screen w-screen flex overflow-hidden transition-colors duration-300 relative', themeClasses, fontClasses, `accent-${accentColor}`)}>

        {/* Ambient orb */}
        {isDark && (
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full blur-[160px] pointer-events-none" />
        )}

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className={cn(
          'h-screen shrink-0 border-r flex flex-col transition-all duration-300 w-16 hover:w-60 group z-50 relative [-webkit-app-region:drag] backdrop-blur-2xl',
          sidebarClasses
        )}>

          {/* Logo */}
          <div className="h-[60px] px-4 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-[12px] bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_4px_16px_rgba(124,58,237,0.5)] flex items-center justify-center flex-shrink-0 [-webkit-app-region:no-drag] border border-white/20">
              <img src={chatrLogo} alt="CHATR" className="w-5 h-5 object-contain filter drop-shadow-md" />
            </div>
            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap [-webkit-app-region:no-drag] overflow-hidden">
              <span className={cn('font-bold text-base leading-tight tracking-tight', isDark ? 'text-white' : 'text-zinc-900')}>chatr+</span>
              <span className={cn('text-[9px] font-medium', isDark ? 'text-white/40' : 'text-zinc-400')}>AI OS Platform</span>
            </div>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-2 [-webkit-app-region:no-drag] overflow-hidden">
            <nav className="px-2 space-y-4">
              {NAV_SECTIONS.map(section => (
                <div key={section.label}>
                  {/* Section label — only visible when expanded */}
                  <p className={cn(
                    'text-[9px] font-bold uppercase tracking-widest px-3 mb-1 transition-all duration-200 overflow-hidden whitespace-nowrap',
                    isDark ? 'text-white/25' : 'text-zinc-400',
                    'opacity-0 group-hover:opacity-100 max-h-0 group-hover:max-h-4'
                  )}>
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map(item => {
                      const isActive = isNavItemActive(item.path);
                      return (
                        <Tooltip key={item.label} delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => navigate(item.path)}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 text-sm relative group/btn [-webkit-app-region:no-drag]',
                                isActive
                                  ? isDark
                                    ? 'bg-white/10 text-white border border-white/10 shadow-sm'
                                    : 'bg-violet-50 text-violet-700 border border-violet-200/60'
                                  : isDark
                                    ? 'text-white/50 hover:bg-white/6 hover:text-white/90'
                                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                              )}
                            >
                              {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-500 rounded-r-full" />
                              )}
                              <item.icon className={cn(
                                'w-[18px] h-[18px] flex-shrink-0 transition-all duration-200',
                                isActive
                                  ? isDark ? 'text-violet-400' : 'text-violet-600'
                                  : 'group-hover/btn:scale-110'
                              )} />
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 min-w-0 text-left">
                                <div className="text-[13px] font-semibold leading-tight truncate">{item.label}</div>
                                <div className={cn('text-[10px] leading-tight truncate', isDark ? 'text-white/30' : 'text-zinc-400')}>{item.subtitle}</div>
                              </div>
                            </button>
                          </TooltipTrigger>
                          {/* Tooltip only shows when sidebar is collapsed */}
                          <TooltipContent side="right" className="flex flex-col gap-0.5 hidden group-hover:hidden lg:group-hover:hidden z-[100]">
                            <span className="font-semibold">{item.label}</span>
                            <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>

          {/* AI Engine Status — non-intrusive, auto-hides when ready */}
          <AIStatusBadge />

          {/* Bottom: User presence + logout */}
          <div className="p-3 border-t border-white/6 [-webkit-app-region:no-drag] space-y-3">
            {/* Presence selector */}
            <div className="relative">
              <button
                onClick={() => setStatusMenuOpen(prev => !prev)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors',
                  isDark ? 'hover:bg-white/6' : 'hover:bg-zinc-100'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className={cn('text-[10px]', isDark ? 'bg-violet-900 text-white' : 'bg-violet-100 text-violet-700')}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <PresenceDot status={myStatus} />
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity min-w-0 flex-1 text-left">
                  <div className={cn('text-[12px] font-semibold truncate', isDark ? 'text-white/80' : 'text-zinc-800')}>
                    {displayName.split(' ')[0]}
                  </div>
                  <div className="text-[10px] text-white/40">{getStatusLabel(myStatus)}</div>
                </div>
              </button>

              {/* Status dropdown */}
              {statusMenuOpen && (
                <div className={cn(
                  'absolute bottom-full left-0 mb-2 w-52 rounded-2xl border shadow-2xl z-50 overflow-hidden',
                  isDark ? 'bg-zinc-900 border-white/10' : 'bg-white border-zinc-200'
                )}>
                  {((['online', 'away', 'busy', 'on_call', 'in_meeting'] as PresenceStatus[])).map(s => {
                    const colors: Record<string, string> = {
                      online: 'bg-emerald-500', away: 'bg-amber-400', busy: 'bg-red-500',
                      on_call: 'bg-blue-500', in_meeting: 'bg-purple-500',
                    };
                    const labels: Record<string, string> = {
                      online: 'Online', away: 'Away', busy: 'Busy / DND',
                      on_call: 'On Call', in_meeting: 'In Meeting',
                    };
                    return (
                      <button
                        key={s}
                        onClick={() => { setStatus(s); setStatusMenuOpen(false); }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
                          isDark ? 'hover:bg-white/8 text-white/80' : 'hover:bg-zinc-50 text-zinc-700',
                          myStatus === s && (isDark ? 'bg-white/6' : 'bg-violet-50')
                        )}
                      >
                        <span className={cn('w-2 h-2 rounded-full', colors[s])} />
                        {labels[s]}
                        {myStatus === s && <span className="ml-auto text-violet-400 text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Icon row */}
            <div className={cn('flex items-center', isDark ? 'text-white/30' : 'text-zinc-400')}>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:text-white/70 hover:bg-white/6' : 'hover:text-zinc-700 hover:bg-zinc-100')}
                title="Toggle theme"
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => navigate('/desktop/settings')}
                className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:text-white/70 hover:bg-white/6' : 'hover:text-zinc-700 hover:bg-zinc-100')}
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleLogout}
                className={cn('p-1.5 rounded-lg transition-colors text-red-400/60 hover:text-red-400', isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50')}
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content area ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

          <ChatrConsole />

          {/* Top header — 30% reduced height */}
          <header className={cn(
            'h-[42px] flex items-center justify-between px-5 z-40 [-webkit-app-region:drag] border-b shrink-0',
            isDark ? 'border-white/6 bg-zinc-950/60 backdrop-blur-2xl' : 'border-zinc-200 bg-white/70 backdrop-blur-2xl'
          )}>

            {/* Left: Global search trigger */}
            <div className="flex items-center gap-3 [-webkit-app-region:no-drag]">
              <button
                onClick={() => setCmdOpen(true)}
                className={cn(
                  'flex items-center gap-2 pl-3 pr-2 py-1 rounded-xl border text-sm transition-all hover:scale-[1.01]',
                  isDark
                    ? 'border-white/10 bg-white/4 text-white/40 hover:bg-white/8 hover:text-white/70'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                )}
                aria-label="Search (Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="text-xs hidden sm:block w-48">Search people, messages, calls...</span>
                <kbd className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded border ml-2 font-mono hidden sm:block',
                  isDark ? 'border-white/15 text-white/30' : 'border-zinc-300 text-zinc-400'
                )}>
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-4 [-webkit-app-region:no-drag]">
              {/* AI System Indicator */}
              <TinyAIIndicator />

              <AppearanceSettings />

              {/* Notifications */}
              <button className={cn('relative transition-colors', isDark ? 'text-white/50 hover:text-white/90' : 'text-zinc-500 hover:text-zinc-800')}>
                <Bell className="w-4 h-4" />
                <span className={cn('absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full ring-2', isDark ? 'ring-zinc-950' : 'ring-white')} />
              </button>

              {/* User + presence */}
              <div className={cn('flex items-center gap-2.5 pl-4 border-l', isDark ? 'border-white/8' : 'border-zinc-200')}>
                <div className="hidden sm:flex flex-col items-end">
                  <span className={cn('text-[12px] font-bold leading-tight', isDark ? 'text-white' : 'text-zinc-900')}>
                    {displayName.split(' ')[0]}
                  </span>
                  <span className={cn('text-[10px]', isDark ? 'text-white/40' : 'text-zinc-400')}>
                    {getStatusLabel(myStatus)}
                  </span>
                </div>
                <div className="relative">
                  <Avatar className={cn('w-7 h-7 border cursor-pointer hover:scale-105 transition-transform', isDark ? 'border-white/10' : 'border-zinc-200')}>
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className={cn('text-[10px]', isDark ? 'bg-violet-900 text-white' : 'bg-violet-100 text-violet-700')}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <PresenceDot status={myStatus} />
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 flex flex-col overflow-hidden relative">
            <Outlet />
          </main>
        </div>

        {/* ── Transparent Expandable Quick Actions Bar (Right Sidebar) ── */}
        <QuickActionsBar isDark={isDark} />

        {/* ── Global Call Overlay (Top Right Notification) ── */}
        <GlobalCallOverlay />

        {/* ── Command Palette ──────────────────────────────────────────────── */}
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} userId={user?.id} />

        {/* ── Productivity Dock ────────────────────────────────────────────── */}
        <ProductivityDock />

      </div>
    </TooltipProvider>
  );
};

export default DesktopLayout;
