import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import React, { Suspense, useEffect, createContext, useContext } from "react";
import { Capacitor } from "@capacitor/core";

// ============================================
// PLATFORM CONTEXT
// Decided once at startup by the entry point.
// Never guessed at runtime.
// ============================================
export type Platform = "web" | "desktop" | "mobile";

const PlatformContext = createContext<Platform>("web");

export const usePlatform = (): Platform => useContext(PlatformContext);
import { SplashScreen } from "@capacitor/splash-screen";
import { HelmetProvider } from 'react-helmet-async';
import ProtectedRoute from "./components/ProtectedRoute";
import { NativeAppProvider } from "./components/NativeAppProvider";
import { LocationProvider } from "./contexts/LocationContext";
import { initializeCapabilities } from "./core/capabilities/init";

// Initialize the Outcome Engine Capabilities
initializeCapabilities();
import { registerServiceWorker, resetServiceWorkerState } from "./utils/serviceWorkerRegistration";
import { setupNativeCallUI } from "./utils/nativeCallUI";
import { CrashlyticsErrorBoundary } from "./utils/crashlyticsErrorBoundary";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { CallProvider } from "./contexts/CallContext";
import { SocketProvider } from "./contexts/SocketContext";
import { ThemeCustomizationProvider } from "./contexts/ThemeCustomizationContext";
import { PageLoader } from "./components/PageLoader";
import { useUISpeedBudget } from "./hooks/useUISpeedBudget";
import { MobileTabFrame } from "./components/MobileTabFrame";
import { MobileLayout } from "./layouts/MobileLayout";
import { initPerformanceOptimizations } from "./utils/performanceOptimizations";
import { initVoIPPrewarm, cancelPrewarm } from "./utils/voipBridgePrewarm";
import { TurnCache } from "./services/turnCache";
import { getTurnConfig } from "./utils/webrtcSignaling";
import { networkMonitor } from "./utils/networkMonitor";
import { ChatrAIFab } from "./components/ChatrAIFab";
import { PlatformProvider } from "./platform/Infrastructure/PlatformContext";
import { bootstrapPlatform } from "./platform/Runtime/Bootstrap";

// Initiate the platform bootstrap immediately
bootstrapPlatform();

// ============================================
// CRITICAL PAGES - Lazy loaded for smaller bundle
// ============================================
// Index, Auth, and Home are now lazy-loaded via lazyPages.ts

// ============================================
// ALL OTHER PAGES - Lazy loaded for performance
// ============================================
import * as LazyPages from "./routes/lazyPages";
import { preloadCriticalRoutes } from "./routes/lazyPages";

import ExecutionDashboard from "./components/dev/ExecutionDashboard";

// Layout components (small, keep eager)
const AdminLayout = React.lazy(() => import("./components/AdminLayout").then(m => ({ default: m.AdminLayout })));
import DesktopLayout from "./layouts/DesktopLayout";
const WorkspaceSetup = React.lazy(() => import("./pages/desktop/WorkspaceSetup").then(m => ({ default: m.WorkspaceSetup })));
const KernelDashboard = React.lazy(() => import("./pages/desktop/KernelDashboard").then(m => ({ default: m.KernelDashboard })));
const WorkflowInspectorPage = React.lazy(() => import("./pages/desktop/WorkflowInspector").then(m => ({ default: m.WorkflowInspector })));
const EngineHealthDashboardPage = React.lazy(() => import("./pages/desktop/EngineHealthDashboard").then(m => ({ default: m.EngineHealthDashboard })));
const BusinessLayout = React.lazy(() => import("./layouts/BusinessLayout").then(m => ({ default: m.BusinessLayout })));
const DesignSystemPlayground = React.lazy(() => import("./pages/desktop/DesignSystemPlayground"));
const GoogleCalendarCallback = React.lazy(() => import("./pages/auth/GoogleCalendarCallback").then(m => ({ default: m.GoogleCalendarCallback })));
const OutlookCalendarCallback = React.lazy(() => import("./pages/auth/OutlookCalendarCallback").then(m => ({ default: m.OutlookCalendarCallback })));
const ChiefOfStaffHome = React.lazy(() => import("./pages/desktop/ChiefOfStaffHome").then(m => ({ default: m.ChiefOfStaffHome })));

const DeferredFeatureEngagementTracker = React.lazy(() =>
 import("./components/FeatureEngagementTracker").then((module) => ({
 default: module.FeatureEngagementTracker,
 }))
);
const DeferredGlobalCallListener = React.lazy(() =>
 import("./components/calling/GlobalCallListener").then((module) => ({
 default: module.GlobalCallListener,
 }))
);
const DeferredGlobalNotificationListener = React.lazy(() =>
 import("./components/GlobalNotificationListener").then((module) => ({
 default: module.GlobalNotificationListener,
 }))
);
const DeferredStandaloneCallsApp = React.lazy(() =>
 import("./components/dialer/StandaloneCallsApp").then((module) => ({
 default: module.StandaloneCallsApp,
 }))
);
const DeferredSocketStatusIndicator = React.lazy(() =>
 import("./components/SocketStatusIndicator").then((module) => ({
 default: module.SocketStatusIndicator,
 }))
);

// CHATR OS Enterprise Components
import { KernelProvider } from './presentation-runtime/providers/KernelProvider';
const MarketplaceLayout = React.lazy(() => import('./presentation-runtime/marketplace/components/MarketplaceLayout').then(m => ({ default: m.MarketplaceLayout })));
const HomeDashboard = React.lazy(() => import('./presentation-runtime/marketplace/components/HomeDashboard').then(m => ({ default: m.HomeDashboard })));
const MarketplaceBrowser = React.lazy(() => import('./presentation-runtime/marketplace/components/MarketplaceBrowser').then(m => ({ default: m.MarketplaceBrowser })));
const IndustryDetailView = React.lazy(() => import('./presentation-runtime/marketplace/components/IndustryDetailView').then(m => ({ default: m.IndustryDetailView })));
const InstallationWizard = React.lazy(() => import('./presentation-runtime/marketplace/components/InstallationWizard').then(m => ({ default: m.InstallationWizard })));
const WorkspaceDashboard = React.lazy(() => import('./presentation-runtime/marketplace/components/WorkspaceDashboard').then(m => ({ default: m.WorkspaceDashboard })));
const ExecutiveAI = React.lazy(() => import('./presentation-runtime/marketplace/components/ExecutiveAI').then(m => ({ default: m.ExecutiveAI })));
const EnterpriseSearch = React.lazy(() => import('./presentation-runtime/marketplace/components/EnterpriseSearch').then(m => ({ default: m.EnterpriseSearch })));
const EnterpriseAnalytics = React.lazy(() => import('./presentation-runtime/marketplace/components/EnterpriseAnalytics').then(m => ({ default: m.EnterpriseAnalytics })));
const UserManagement = React.lazy(() => import('./presentation-runtime/marketplace/components/UserManagement').then(m => ({ default: m.UserManagement })));
const CapabilityRuntimeView = React.lazy(() => import('./presentation-runtime/marketplace/components/CapabilityRuntimeView').then(m => ({ default: m.CapabilityRuntimeView })));
const AuditCompliance = React.lazy(() => import('./presentation-runtime/marketplace/components/AuditCompliance').then(m => ({ default: m.AuditCompliance })));
const WorkspaceSettings = React.lazy(() => import('./presentation-runtime/marketplace/components/WorkspaceSettings').then(m => ({ default: m.WorkspaceSettings })));
const EnterpriseIntegrations = React.lazy(() => import('./presentation-runtime/marketplace/components/EnterpriseIntegrations').then(m => ({ default: m.EnterpriseIntegrations })));
const DeveloperHub = React.lazy(() => import('./presentation-runtime/marketplace/components/DeveloperHub').then(m => ({ default: m.DeveloperHub })));
const ComingSoon = React.lazy(() => import('./presentation-runtime/marketplace/components/ComingSoon').then(m => ({ default: m.ComingSoon })));

const queryClient = new QueryClient({
 defaultOptions: {
 queries: {
 staleTime: 1000 * 60 * 10, // 10 minutes - reduce refetches
 gcTime: 1000 * 60 * 30, // 30 minutes - keep cache longer
 retry: 1, // Fewer retries = faster failure recovery
 refetchOnWindowFocus: false,
 refetchOnMount: false, // Use cached data on mount
 refetchOnReconnect: true,
 refetchInterval: false,
 },
 mutations: {
 retry: 1,
 },
 },
});

// Check if on web subdomain (web.chatr.chat)
const isWebSubdomain = () => {
 const hostname = window.location.hostname;
 return hostname === 'web.chatr.chat' || 
 hostname.startsWith('web.') || 
 new URLSearchParams(window.location.search).get('subdomain') === 'web';
};

// Component to handle subdomain redirect
const SubdomainRedirect = () => {
  const navigate = useNavigate();
  const platform = usePlatform();

  React.useEffect(() => {
    // Mobile platform always goes to the mobile home
    if (platform === "mobile") {
      navigate('/home', { replace: true });
      return;
    }

    // Web platform: check subdomains
    const hostname = window.location.hostname;
    if (hostname.startsWith('seller.') && window.location.pathname === '/') {
      navigate('/seller/portal', { replace: true });
      return;
    }
    if (isWebSubdomain() && window.location.pathname === '/') {
      navigate('/web', { replace: true });
      return;
    }

    // Default: Always navigate to Chief of Staff Home (/desktop/home)
    navigate('/desktop/home', { replace: true });
  }, [navigate, platform]);

  return <PageLoader message="Loading CHATR OS..." />;
};

// Wrapper for lazy routes with Suspense
const LazyRoute = ({ component: Component, ...props }: { component: React.ComponentType<any>, [key: string]: any }) => (
 <Suspense fallback={<PageLoader />}>
 <Component {...props} />
 </Suspense>
);

// Protected lazy route wrapper
const ProtectedLazyRoute = ({ component: Component }: { component: React.ComponentType<any> }) => (
 <ProtectedRoute>
 <Suspense fallback={<PageLoader />}>
 <Component />
 </Suspense>
 </ProtectedRoute>
);

const shouldNormalizeNativeStartupPath = (pathname: string) => (
 pathname === '/' ||
 pathname === '/index.html'
);

const NativeStartupRouteGate = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    // Sanitizer for concatenated URLs like /desktop/calls#/desktop/workspace-ide
    if (window.location.pathname !== '/' && window.location.hash.startsWith('#/')) {
      const hashTarget = window.location.hash.slice(1);
      window.history.replaceState(null, '', `${window.location.origin}/#${hashTarget}`);
      navigate(hashTarget, { replace: true });
      setIsReady(true);
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      setIsReady(true);
      return;
    }

    const nativePath = window.location.hash.startsWith('#/')
      ? window.location.hash.slice(1).split('?')[0]
      : window.location.pathname;

    const appId = (window as any).__CHATR_APP_ID__ || '';
    const isChatrCallsApp = appId.includes('calls') || document.title.toLowerCase().includes('chatrcalls');
    const defaultRoute = isChatrCallsApp ? '/calls' : '/home';

    if (shouldNormalizeNativeStartupPath(nativePath)) {
      navigate(defaultRoute, { replace: true });
    }
    
    setIsReady(true);
  }, [navigate]);

  if (!isReady) return <PageLoader />;

  return <>{children}</>;
};

const ensureNativeHashRoute = () => {
 if (!Capacitor.isNativePlatform()) return;
 if (window.location.hash.startsWith('#/')) return;

 const { origin, pathname, search } = window.location;
 const route = shouldNormalizeNativeStartupPath(pathname)
 ? '/home'
 : `${pathname}${search}`;

 window.history.replaceState(null, '', `${origin}/#${route}`);
};

const markNativeWebAppReady = () => {
 if (!Capacitor.isNativePlatform()) return;

 try {
 (window as any).ChatrNativeRuntime?.markWebAppReady?.();
 } catch (error) {
 console.error("[NativeStartup] Failed to mark web app ready:", error);
 }

 void SplashScreen.hide().catch((error) => {
 console.warn("[NativeStartup] Failed to hide splash screen:", error);
 });
};

const DeferredGlobalServices = () => {
 return (
 <>
 <Suspense fallback={null}>
 <DeferredGlobalCallListener />
 </Suspense>
 <Suspense fallback={null}>
 <DeferredGlobalNotificationListener />
 </Suspense>
 <Suspense fallback={null}>
 <DeferredFeatureEngagementTracker />
 </Suspense>
 </>
 );
};

const App = ({ platform = "web" }: { platform?: Platform }) => {
 console.log(`🚀 [App] Component rendering... platform=${platform}`);

 // Derive native flag from platform prop — no guessing
 const isNative = platform === "mobile";
 
 useEffect(() => {
 initPerformanceOptimizations();

 // Phase 5 - TURN Credential Cache: pre-fetch at boot so first call answer is instant
 TurnCache.startBackgroundRefresh(getTurnConfig);

 // Phase 8 - Network Monitor: start listening for WiFi/LTE transitions
 networkMonitor.start();

 // CHATR Intelligence Engine - init local DB + wire event bus pipeline
 import('./services/intelligence').then(({ intelligenceEngine }) => {
 intelligenceEngine.init().catch((err) =>
 console.error('[App] Intelligence Engine init failed:', err)
 );
 });
 }, []);

 if (isNative) ensureNativeHashRoute();
 const Router = (isNative || platform === 'desktop') ? HashRouter : BrowserRouter;

 // UI Speed Budget - warn when interactions exceed 100ms (Nielsen "instant" threshold)
 useUISpeedBudget({ budgetMs: 100 });

 // Tell the Android shell that React has committed before heavier native
 // listeners start. This prevents slow first paints from being mistaken for a
 // broken WebView.
 React.useEffect(() => {
 if (!Capacitor.isNativePlatform()) return;

 let hasSignaledReady = false;

 // Signal readiness after a brief delay to ensure hydration is stable
 // and listeners in DeferredGlobalServices are attached.
 const signalReady = () => {
 if (hasSignaledReady) return;
 hasSignaledReady = true;
 console.log("🚀 [App] Signaling WebApp Ready to Native Shell");
 markNativeWebAppReady();
 };

 const timeoutId = window.setTimeout(signalReady, 100);
 const rafId = window.requestAnimationFrame(() => window.requestAnimationFrame(signalReady));
 
 return () => {
 window.clearTimeout(timeoutId);
 window.cancelAnimationFrame(rafId);
 };
 }, []);

 // Register service worker once on mount
 React.useEffect(() => {
 let registered = false;
 let preloadTimer: number | undefined;
 
 const initServiceWorker = async () => {
 if (registered) return;

 if (Capacitor.isNativePlatform()) {
 await resetServiceWorkerState('native-shell');
 console.log('📱 Service worker disabled for native shell');
 registered = true;
 return;
 }

 if ('serviceWorker' in navigator) {
 const existing = await navigator.serviceWorker.getRegistration();
 if (existing) {
 console.log('✅ Service Worker already registered');
 registered = true;
 return;
 }
 }
 
 const registration = await registerServiceWorker();
 if (registration) {
 console.log('✅ Service Worker initialized for push notifications');
 registered = true;
 }
 };
 
 const scheduleRoutePreload = () => {
 const runPreload = () => preloadCriticalRoutes();

 if (Capacitor.isNativePlatform()) {
 if ('requestIdleCallback' in window) {
 (window as any).requestIdleCallback(runPreload, { timeout: 4000 });
 } else {
 preloadTimer = window.setTimeout(runPreload, 3000);
 }
 return;
 }

 runPreload();
 };

 initServiceWorker();
 
 // Let the native shell paint before warming other tabs.
 scheduleRoutePreload();

 return () => {
 if (preloadTimer) {
 window.clearTimeout(preloadTimer);
 }
 };
 }, []);

 // Initialize native call UI (CallKit/ConnectionService)
 React.useEffect(() => {
 const initialize = () => setupNativeCallUI().catch(err => {
 console.log('Native call UI not available:', err);
 });

 if (!Capacitor.isNativePlatform()) {
 initialize();
 return;
 }

 const timeoutId = window.setTimeout(initialize, 400);
 return () => window.clearTimeout(timeoutId);
 }, []);

 // Register VoIP prewarm listeners - must run on every platform mount so that
 // FCM-triggered background prewarm payloads are consumed the instant React
 // hydrates. cancelPrewarm() is called on unmount to free camera/mic tracks.
 React.useEffect(() => {
 const cleanup = initVoIPPrewarm();
 return () => {
 cleanup();
 // Belt-and-suspenders: release any lingering prewarm on hot-reload / unmount
 cancelPrewarm();
 };
 }, []);

 return (
 <PlatformContext.Provider value={platform}>
 <div className="app-container antialiased selection:bg-[#5c22ff]/30 text-slate-800 dark:text-slate-200">
 <CrashlyticsErrorBoundary>
 <GlobalErrorBoundary>
 <HelmetProvider>
 <QueryClientProvider client={queryClient}>
 <SocketProvider>
 <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
 <ThemeCustomizationProvider>
 <LocationProvider>
 <PlatformProvider>
 <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
 <CallProvider>
 <NativeStartupRouteGate>
 <NativeAppProvider>
 <OfflineIndicator />
 <DeferredGlobalServices />
 <ChatrAIFab />
 <Routes>
  {/* Developer Routes */}
  <Route path="/dev" element={<ExecutionDashboard />} />
  <Route path="/design-system" element={<Suspense fallback={<PageLoader message="Loading CXS Design System..." />}><DesignSystemPlayground /></Suspense>} />
 {/* Desktop Platform Routes */}
  <Route path="/desktop">
  {/* Desktop Execution OS & Chief of Staff Home */}
  <Route element={<DesktopLayout />}>
  <Route index element={<Navigate to="home" replace />} />
  <Route path="home" element={<Suspense fallback={<PageLoader message="Loading Chief of Staff..." />}><ChiefOfStaffHome /></Suspense>} />
  <Route path="workspace-ide" element={<LazyRoute component={LazyPages.WorkspaceIDE} />} />
 <Route path="chat" element={<LazyRoute component={LazyPages.DesktopChat} />} />
 <Route path="kernel" element={
 <Suspense fallback={<PageLoader message="Loading Kernel Dashboard..." />}>
 <KernelDashboard />
 </Suspense>
 } />
 <Route path="inspector" element={
 <Suspense fallback={<PageLoader message="Loading Workflow Inspector..." />}>
 <WorkflowInspectorPage />
 </Suspense>
 } />
 <Route path="health" element={
 <Suspense fallback={<PageLoader message="Loading Engine Health..." />}>
 <EngineHealthDashboardPage />
 </Suspense>
 } />
 <Route path="setup" element={<Suspense fallback={<PageLoader />}><WorkspaceSetup /></Suspense>} />
 <Route path="beta-command-center" element={<LazyRoute component={LazyPages.BetaCommandCenter} />} />
 <Route path="connect" element={<LazyRoute component={LazyPages.DesktopConnectPairing} />} />
 <Route path="chat" element={<LazyRoute component={LazyPages.DesktopChat} />} />
 <Route path="contacts" element={<Navigate to="/desktop/chat" replace />} />
 <Route path="canvas" element={<LazyRoute component={LazyPages.InfiniteCanvas} />} />
 <Route path="calls" element={<LazyRoute component={LazyPages.DesktopCalls} />} />
 <Route path="ai-agents" element={<LazyRoute component={LazyPages.AIAgentsHub} />} />
 <Route path="ai-agents/create" element={<LazyRoute component={LazyPages.AIAgentCreate} />} />
 <Route path="ai-agents/chat/:agentId" element={<LazyRoute component={LazyPages.AIAgentChatNew} />} />
 <Route path="ai-agents/settings/:agentId" element={<LazyRoute component={LazyPages.AIAgents} />} />
 <Route path="workspace" element={<LazyRoute component={LazyPages.DesktopWorkspace} />} />
 <Route path="calendar" element={<LazyRoute component={LazyPages.DesktopCalendar} />} />
 <Route path="intelligence" element={<LazyRoute component={LazyPages.DesktopIntelligence} />} />
 <Route path="notifications" element={<LazyRoute component={LazyPages.DesktopNotifications} />} />
 <Route path="settings" element={<LazyRoute component={LazyPages.DesktopSettings} />} />
 <Route path="settings/notifications" element={<LazyRoute component={LazyPages.DesktopNotifications} />} />
 <Route path="settings/appearance" element={<LazyRoute component={LazyPages.DesktopAppearance} />} />
 <Route path="settings/wallpaper" element={<LazyRoute component={LazyPages.DesktopWallpaper} />} />
 <Route path="profile" element={<LazyRoute component={LazyPages.DesktopProfile} />} />
 <Route path="privacy" element={<LazyRoute component={LazyPages.DesktopPrivacy} />} />
 <Route path="account" element={<LazyRoute component={LazyPages.DesktopAccount} />} />
 <Route path="device-management" element={<LazyRoute component={LazyPages.DesktopConnectPairing} />} />
 <Route path="recruitment" element={<LazyRoute component={LazyPages.RecruiterWorkspace} />} />
 <Route path="candidate" element={<LazyRoute component={LazyPages.CandidateWorkspace} />} />
 <Route path="marketplace" element={<LazyRoute component={LazyPages.AgentMarketplace} />} />
 <Route path="connector-store" element={<LazyRoute component={LazyPages.DesktopConnectorStore} />} />
 <Route path="agent/:id" element={<LazyRoute component={LazyPages.AgentWorkspace} />} />
 <Route path="studio" element={<LazyRoute component={LazyPages.WorkflowStudio} />} />
 <Route path="business-os" element={<LazyRoute component={LazyPages.BusinessOS} />} />
 <Route path="smart-inbox" element={<LazyRoute component={LazyPages.SmartInbox} />} />
 <Route path="tickets" element={<LazyRoute component={LazyPages.DesktopTickets} />} />
 <Route path="files" element={<LazyRoute component={LazyPages.DesktopFiles} />} />
 <Route path="connected-accounts" element={<LazyRoute component={LazyPages.ConnectedAccounts} />} />
 <Route path="processes" element={<LazyRoute component={LazyPages.ProcessMonitor} />} />
 <Route path="world" element={<LazyRoute component={LazyPages.WorldExplorer} />} />
 <Route path="production-validation" element={<LazyRoute component={LazyPages.ProductionValidationReport} />} />
 <Route path="pro" element={<LazyRoute component={LazyPages.ProUpgrade} />} />
 <Route path="design-system" element={<Suspense fallback={<PageLoader message="Loading CXS Design System..." />}><DesignSystemPlayground /></Suspense>} />
 {/* Business Platform Routes Nested in Desktop */}
 <Route path="pro/business" element={<Suspense fallback={<PageLoader />}><BusinessLayout /></Suspense>}>
 <Route index element={<Navigate to="dashboard" replace />} />
 <Route path="dashboard" element={<LazyRoute component={LazyPages.BusinessDashboard} />} />
 <Route path="onboard" element={<LazyRoute component={LazyPages.BusinessOnboarding} />} />
 <Route path="inbox" element={<LazyRoute component={LazyPages.BusinessInbox} />} />
 <Route path="crm" element={<LazyRoute component={LazyPages.CRMPage} />} />
 <Route path="analytics" element={<LazyRoute component={LazyPages.BusinessAnalytics} />} />
 <Route path="team" element={<LazyRoute component={LazyPages.BusinessTeam} />} />
 <Route path="settings" element={<LazyRoute component={LazyPages.BusinessSettings} />} />
 <Route path="catalog" element={<LazyRoute component={LazyPages.BusinessCatalog} />} />
 <Route path="broadcasts" element={<LazyRoute component={LazyPages.BusinessBroadcasts} />} />
 <Route path="groups" element={<LazyRoute component={LazyPages.BusinessGroups} />} />
 <Route path="ai-roles" element={<LazyRoute component={LazyPages.AIRoles} />} />
 <Route path="automations" element={<LazyRoute component={LazyPages.BusinessAutomations} />} />
 <Route path="integrations" element={<LazyRoute component={LazyPages.Integrations} />} />
 <Route path="phone" element={<LazyRoute component={LazyPages.PhoneSystem} />} />
 <Route path="app-store" element={<LazyRoute component={LazyPages.AppStore} />} />
 <Route path="developer" element={<LazyRoute component={LazyPages.DeveloperHub} />} />
 </Route>
 </Route>
 </Route>

 {/* Calendar OAuth2 Callback Routes */}
 <Route path="/auth/google/callback" element={<React.Suspense fallback={<PageLoader />}><GoogleCalendarCallback /></React.Suspense>} />
 <Route path="/auth/outlook/callback" element={<React.Suspense fallback={<PageLoader />}><OutlookCalendarCallback /></React.Suspense>} />
 
 {/* Admin Platform Routes */}
 <Route path="/admin" element={<Suspense fallback={<PageLoader />}><AdminLayout /></Suspense>}>
 <Route index element={<LazyRoute component={LazyPages.AdminDashboard} />} />
 <Route path="feature-builder" element={<LazyRoute component={LazyPages.FeatureBuilder} />} />
 <Route path="schema-manager" element={<LazyRoute component={LazyPages.SchemaManager} />} />
 <Route path="users" element={<LazyRoute component={LazyPages.AdminUsers} />} />
 <Route path="providers" element={<LazyRoute component={LazyPages.AdminProviders} />} />
 <Route path="analytics" element={<LazyRoute component={LazyPages.AdminAnalytics} />} />
 <Route path="payments" element={<LazyRoute component={LazyPages.AdminPayments} />} />
 <Route path="points" element={<LazyRoute component={LazyPages.AdminPoints} />} />
 <Route path="settings" element={<LazyRoute component={LazyPages.AdminSettings} />} />
 <Route path="announcements" element={<LazyRoute component={LazyPages.AdminAnnouncements} />} />
 <Route path="documents" element={<LazyRoute component={LazyPages.AdminDocuments} />} />
 <Route path="doctor-applications" element={<LazyRoute component={LazyPages.AdminDoctorApplications} />} />
 <Route path="official-accounts" element={<LazyRoute component={LazyPages.OfficialAccountsManager} />} />
 <Route path="broadcast" element={<LazyRoute component={LazyPages.BroadcastManager} />} />
 <Route path="brand-partnerships" element={<LazyRoute component={LazyPages.BrandPartnerships} />} />
 <Route path="app-approvals" element={<LazyRoute component={LazyPages.AppApprovals} />} />
 <Route path="kyc-approvals" element={<LazyRoute component={LazyPages.KYCApprovals} />} />
 <Route path="chatr-world" element={<LazyRoute component={LazyPages.ChatrWorldAdmin} />} />
 <Route path="payment-verification" element={<LazyRoute component={LazyPages.PaymentVerification} />} />
 <Route path="micro-tasks" element={<LazyRoute component={LazyPages.AdminMicroTasks} />} />
 <Route path="job-health" element={<LazyRoute component={LazyPages.AdminJobHealth} />} />
 <Route path="token-health" element={<LazyRoute component={LazyPages.AdminTokenHealth} />} />
 </Route>

 {/* Mobile & Public Platform Routes */}
 <Route element={<MobileLayout />}>
 {/* Public Routes */}
 <Route path="/" element={<SubdomainRedirect />} />
 
 <Route path="/workspace-selector" element={<LazyRoute component={LazyPages.WorkspaceSelector} />} />
 <Route path="/launcher" element={<ProtectedLazyRoute component={LazyPages.Launcher} />} />
 <Route path="/auth" element={<LazyRoute component={LazyPages.Auth} />} />
 <Route path="/download" element={<LazyRoute component={LazyPages.Download} />} />
 <Route path="/install" element={<LazyRoute component={LazyPages.Install} />} />
 <Route path="/onboarding" element={<LazyRoute component={LazyPages.Onboarding} />} />
 <Route path="/about" element={<LazyRoute component={LazyPages.About} />} />
 <Route path="/help" element={<LazyRoute component={LazyPages.Help} />} />
 <Route path="/contact" element={<LazyRoute component={LazyPages.Contact} />} />
 <Route path="/privacy" element={<LazyRoute component={LazyPages.PrivacyPolicy} />} />
 <Route path="/terms" element={<LazyRoute component={LazyPages.Terms} />} />
 <Route path="/refund" element={<LazyRoute component={LazyPages.Refund} />} />
 <Route path="/disclaimer" element={<LazyRoute component={LazyPages.Disclaimer} />} />
 <Route path="/join" element={<LazyRoute component={LazyPages.JoinInvite} />} />
 <Route path="/web" element={<LazyRoute component={LazyPages.ChatrWeb} />} />
 {/* Legacy Desktop paths (Removed during refactor) */}
 
 {/* Consolidated Hub Routes */}
 <Route path="/health" element={<LazyRoute component={LazyPages.HealthHub} />} />
 <Route path="/care" element={<LazyRoute component={LazyPages.CareAccess} />} />
 <Route path="/community" element={<LazyRoute component={LazyPages.CommunitySpace} />} />
 
 {/* New Feature Routes */}
 <Route path="/symptom-checker" element={<LazyRoute component={LazyPages.SymptomCheckerPage} />} />
 <Route path="/health-wallet" element={<LazyRoute component={LazyPages.HealthWalletPage} />} />
 <Route path="/teleconsultation" element={<LazyRoute component={LazyPages.TeleconsultationPage} />} />
 <Route path="/medication-interactions" element={<LazyRoute component={LazyPages.MedicationInteractionsPage} />} />
 <Route path="/health-streaks" element={<LazyRoute component={LazyPages.HealthStreaksPage} />} />
 <Route path="/chronic-vitals" element={<LazyRoute component={LazyPages.ChronicVitalsPage} />} />
 <Route path="/chatr-shield" element={<LazyRoute component={LazyPages.ChatrShield} />} />
 
 {/* Main App Routes - Native tab shell */}
 <Route element={<MobileTabFrame />}>
 <Route path="/home" element={<LazyRoute component={LazyPages.Home} />} />
 <Route path="/chat" element={<LazyRoute component={LazyPages.Chat} />} />
 <Route path="/jobs" element={<LazyRoute component={LazyPages.LocalJobs} />} />
 <Route path="/marketplace" element={<LazyRoute component={LazyPages.Marketplace} />} />
 <Route path="/profile" element={<LazyRoute component={LazyPages.Profile} />} />
 <Route path="/calls/*" element={<Suspense fallback={<PageLoader />}><DeferredStandaloneCallsApp /></Suspense>} />
 <Route path="/more" element={<LazyRoute component={LazyPages.More} />} />
 <Route path="/explore" element={<LazyRoute component={LazyPages.ChatrWorld} />} />
 <Route path="/status" element={<LazyRoute component={LazyPages.Stories} />} />
 <Route path="/stories" element={<LazyRoute component={LazyPages.Stories} />} />
 <Route path="/standalone-dialer" element={<LazyRoute component={LazyPages.StandaloneDialer} />} />
 </Route>
 <Route path="/chat/:conversationId" element={<LazyRoute component={LazyPages.Chat} />} />
 <Route path="/status/create" element={<LazyRoute component={LazyPages.StatusComposer} />} />
 <Route path="/stories/create" element={<LazyRoute component={LazyPages.StatusComposer} />} />
 <Route path="/starred-messages" element={<LazyRoute component={LazyPages.StarredMessages} />} />
 <Route path="/chat/:conversationId/media" 
 element={<Suspense fallback={<PageLoader />}>{React.createElement(React.lazy(() => import('@/components/chat/MediaViewer').then(m => ({ default: m.MediaViewer }))))}</Suspense>}
 />
 <Route path="/contacts" element={<LazyRoute component={LazyPages.Contacts} />} />
 <Route path="/global-contacts" element={<LazyRoute component={LazyPages.GlobalContacts} />} />
 <Route path="/call-history" element={<LazyRoute component={LazyPages.CallHistory} />} />
 <Route path="/standalone-messenger" element={<LazyRoute component={LazyPages.Chat} />} />
 <Route path="/standalone-messenger/:conversationId" element={<LazyRoute component={LazyPages.Chat} />} />
 <Route path="/smart-inbox" element={<LazyRoute component={LazyPages.SmartInbox} />} />
 <Route path="/connected-accounts" element={<LazyRoute component={LazyPages.ConnectedAccounts} />} />

 <Route path="/communities" element={<LazyRoute component={LazyPages.Communities} />} />
 <Route path="/create-community" element={<LazyRoute component={LazyPages.CreateCommunity} />} />
 <Route path="/desktop-connect" element={<ProtectedLazyRoute component={LazyPages.DesktopConnectScanner} />} />
 
 {/* Health & Wellness Routes */}
 <Route path="/wellness" element={<LazyRoute component={LazyPages.WellnessTracking} />} />
 <Route path="/health-passport" element={<LazyRoute component={LazyPages.HealthPassport} />} />
 <Route path="/lab-reports" element={<LazyRoute component={LazyPages.LabReports} />} />
 <Route path="/medicine-reminders" element={<LazyRoute component={LazyPages.MedicineReminders} />} />
 <Route path="/bmi-calculator" element={<LazyRoute component={LazyPages.BMICalculator} />} />
 <Route path="/nutrition-tracker" element={<LazyRoute component={LazyPages.NutritionTracker} />} />
 <Route path="/mental-health" element={<LazyRoute component={LazyPages.MentalHealth} />} />
 <Route path="/health-reminders" element={<LazyRoute component={LazyPages.HealthReminders} />} />
 <Route path="/health-risks" element={<LazyRoute component={LazyPages.HealthRiskPredictions} />} />
 <Route path="/emergency" element={<LazyRoute component={LazyPages.EmergencyButton} />} />
 <Route path="/emergency-services" element={<LazyRoute component={LazyPages.EmergencyServices} />} />
 
 {/* Care Path Routes */}
 <Route path="/care/path/:pathId" element={<LazyRoute component={LazyPages.CarePathDetail} />} />
 <Route path="/care/doctor/:doctorId" element={<LazyRoute component={LazyPages.DoctorDetail} />} />
 <Route path="/care/family/add" element={<LazyRoute component={LazyPages.AddFamilyMember} />} />
 <Route path="/care/appointments" element={<LazyRoute component={LazyPages.MyAppointments} />} />
 
 {/* Medicine Subscription Routes */}
 <Route path="/care/medicines" element={<LazyRoute component={LazyPages.MedicineHubPage} />} />
 <Route path="/care/medicines/subscribe" element={<LazyRoute component={LazyPages.MedicineSubscribePage} />} />
 <Route path="/care/medicines/subscriptions" element={<LazyRoute component={LazyPages.MedicineSubscriptionsPage} />} />
 <Route path="/care/medicines/family" element={<LazyRoute component={LazyPages.MedicineFamilyPage} />} />
 <Route path="/care/medicines/vitals" element={<LazyRoute component={LazyPages.MedicineVitalsPage} />} />
 <Route path="/care/medicines/prescriptions" element={<LazyRoute component={LazyPages.MedicinePrescriptionsPage} />} />
 <Route path="/care/medicines/reminders" element={<LazyRoute component={LazyPages.MedicineRemindersPage} />} />
 <Route path="/care/medicines/rewards" element={<LazyRoute component={LazyPages.MedicineRewardsPage} />} />
 
 {/* Provider & Booking Routes */}
 <Route path="/booking" element={<LazyRoute component={LazyPages.BookingPage} />} />
 <Route path="/provider-portal" element={<LazyRoute component={LazyPages.ProviderPortal} />} />
 <Route path="/provider-register" element={<LazyRoute component={LazyPages.ProviderRegister} />} />
 <Route path="/allied-healthcare" element={<LazyRoute component={LazyPages.AlliedHealthcare} />} />
 
 {/* Marketplace & Engagement */}
 <Route path="/marketplace" element={<LazyRoute component={LazyPages.Marketplace} />} />
 <Route path="/marketplace/checkout" element={<LazyRoute component={LazyPages.MarketplaceCheckout} />} />
 <Route path="/marketplace/order-success" element={<LazyRoute component={LazyPages.OrderSuccessPage} />} />
 <Route path="/service/:categoryId" element={<LazyRoute component={LazyPages.ServiceListing} />} />
 <Route path="/provider/:providerId" element={<LazyRoute component={LazyPages.ProviderDetails} />} />
 <Route path="/booking/track/:bookingId" element={<LazyRoute component={LazyPages.BookingTracking} />} />
 <Route path="/provider/dashboard" element={<LazyRoute component={LazyPages.ProviderDashboard} />} />
 <Route path="/youth-engagement" element={<LazyRoute component={LazyPages.YouthEngagement} />} />
 <Route path="/youth-feed" element={<LazyRoute component={LazyPages.YouthFeed} />} />
 <Route path="/app-statistics" element={<LazyRoute component={LazyPages.AppStatistics} />} />
 <Route path="/developer-portal" element={<LazyRoute component={LazyPages.DeveloperPortal} />} />
 <Route path="/mcp-console" element={<ProtectedLazyRoute component={LazyPages.McpDeveloperDashboard} />} />
 <Route path="/official-accounts" element={<LazyRoute component={LazyPages.OfficialAccounts} />} />
 <Route path="/chatr-studio" element={<LazyRoute component={LazyPages.ChatrStudio} />} />
 <Route path="/food-ordering" element={<LazyRoute component={LazyPages.FoodOrdering} />} />
 <Route path="/restaurant/:id" element={<LazyRoute component={LazyPages.RestaurantDetail} />} />
 <Route path="/food-checkout/:id" element={<LazyRoute component={LazyPages.FoodCheckout} />} />
 <Route path="/order-tracking/:orderId" element={<LazyRoute component={LazyPages.OrderTracking} />} />
 <Route path="/order-history" element={<LazyRoute component={LazyPages.OrderHistory} />} />
 <Route path="/local-deals" element={<LazyRoute component={LazyPages.LocalDeals} />} />
 
 {/* Earning / Micro-Tasks Routes */}
 <Route path="/earn" element={<ProtectedLazyRoute component={LazyPages.Earn} />} />
 <Route path="/earn/history" element={<ProtectedLazyRoute component={LazyPages.EarnHistory} />} />
 
 {/* Business / Dhandha Routes */}
 <Route path="/dhandha" element={<ProtectedLazyRoute component={LazyPages.Dhandha} />} />
 
 {/* Points & Payment Routes */}
 <Route path="/chatr-points" element={<LazyRoute component={LazyPages.ChatrPoints} />} />
 <Route path="/reward-shop" element={<LazyRoute component={LazyPages.RewardShop} />} />
 <Route path="/stealth-mode" element={<ProtectedLazyRoute component={LazyPages.StealthMode} />} />
 <Route path="/growth" element={<LazyRoute component={LazyPages.ChatrGrowth} />} />
 <Route path="/chatr-growth" element={<LazyRoute component={LazyPages.ChatrGrowth} />} />
 <Route path="/chatr-wallet" element={<LazyRoute component={LazyPages.ChatrWallet} />} />
 <Route path="/chatr-plus-subscribe" element={<LazyRoute component={LazyPages.ChatrPlusSubscribe} />} />
 <Route path="/ambassador-program" element={<LazyRoute component={LazyPages.AmbassadorProgram} />} />
 <Route path="/doctor-onboarding" element={<LazyRoute component={LazyPages.DoctorOnboarding} />} />
 <Route path="/qr-payment" element={<LazyRoute component={LazyPages.QRPayment} />} />
 <Route path="/kyc-verification" element={<ProtectedLazyRoute component={LazyPages.KYCVerificationPage} />} />

 {/* AI & Settings Routes */}
 <Route path="/chatr-world" element={<LazyRoute component={LazyPages.ChatrWorld} />} />
 <Route path="/chatr-games" element={<LazyRoute component={LazyPages.ChatrGames} />} />
 <Route path="/native-apps" element={<LazyRoute component={LazyPages.MiniApps} />} />
 <Route path="/store/app/:id" element={<LazyRoute component={LazyPages.StoreAppDetail} />} />
 <Route path="/store/my-apps" element={<LazyRoute component={LazyPages.StoreMyApps} />} />
 <Route path="/store/updates" element={<LazyRoute component={LazyPages.StoreUpdates} />} />
 <Route path="/store/explore" element={<LazyRoute component={LazyPages.StoreExplore} />} />
 <Route path="/store/developer" element={<LazyRoute component={LazyPages.StoreDeveloperDashboard} />} />
 <Route path="/chatr-os" element={<LazyRoute component={LazyPages.ChatrOS} />} />
 <Route path="/os-detection" element={<LazyRoute component={LazyPages.OSDetection} />} />
 <Route path="/ai-agents" element={<LazyRoute component={LazyPages.AIAgentsHub} />} />
 <Route path="/ai-agents/create" element={<LazyRoute component={LazyPages.AIAgentCreate} />} />
 <Route path="/ai-agents/chat/:agentId" element={<LazyRoute component={LazyPages.AIAgentChatNew} />} />
 <Route path="/ai-agents/settings/:agentId" element={<LazyRoute component={LazyPages.AIAgents} />} />
 <Route path="/ai-assistant" element={<LazyRoute component={LazyPages.AIAssistant} />} />
 <Route path="/local-jobs" element={<Navigate to="/jobs" replace />} />
 <Route path="/local-healthcare" element={<LazyRoute component={LazyPages.LocalHealthcare} />} />
 <Route path="/geofences" element={<LazyRoute component={LazyPages.Geofences} />} />
 <Route path="/geofence-history" element={<LazyRoute component={LazyPages.GeofenceHistory} />} />
 
 {/* Public browser - no auth required */}
 <Route path="/geo" element={<LazyRoute component={LazyPages.GeoDiscovery} />} />
 <Route path="/search" element={<LazyRoute component={LazyPages.UniversalSearch} />} />
 <Route path="/universal-search" element={<LazyRoute component={LazyPages.UniversalSearch} />} />
 <Route path="/chatr-home" element={<Navigate to="/home" replace />} />
 <Route path="/chatr-results" element={<LazyRoute component={LazyPages.ChatrResults} />} />
 <Route path="/ai-browser-home" element={<LazyRoute component={LazyPages.AIBrowserHome} />} />
 <Route path="/ai-search" element={<LazyRoute component={LazyPages.AIBrowserHome} />} />
 <Route path="/ai-browser" element={<LazyRoute component={LazyPages.AIBrowserView} />} />
 <Route path="/chatr-ai" element={<LazyRoute component={LazyPages.AIChat} />} />
 <Route path="/chat-ai" element={<LazyRoute component={LazyPages.AIChat} />} />
 <Route path="/capture" element={<LazyRoute component={LazyPages.Capture} />} />
 <Route path="/account" element={<LazyRoute component={LazyPages.Account} />} />
 <Route path="/prechu-ai" element={<ProtectedLazyRoute component={LazyPages.PrechuAI} />} />
 <Route path="/jobs" element={<LazyRoute component={LazyPages.LocalJobs} />} />
 <Route path="/job/:id" element={<ProtectedLazyRoute component={LazyPages.JobDetail} />} />
 <Route path="/notifications" element={<LazyRoute component={LazyPages.Notifications} />} />
 <Route path="/notification-settings" element={<LazyRoute component={LazyPages.NotificationSettings} />} />
 <Route path="/notifications/settings" element={<LazyRoute component={LazyPages.NotificationSettings} />} />
 <Route path="/notifications/digest-settings" element={<LazyRoute component={LazyPages.DigestNotificationSettings} />} />
 <Route path="/notifications/health" element={<LazyRoute component={LazyPages.NotificationHealth} />} />
 <Route path="/notifications/smart" element={<LazyRoute component={LazyPages.SmartPushPreferences} />} />
 <Route path="/notifications/templates" element={<LazyRoute component={LazyPages.NotificationTemplates} />} />
 <Route path="/settings" element={<LazyRoute component={LazyPages.Settings} />} />
 <Route path="/automations" element={<LazyRoute component={LazyPages.Automations} />} />
 <Route path="/settings/appearance" element={<LazyRoute component={LazyPages.AppearanceSettings} />} />
 <Route path="/settings/app-icon" element={<LazyRoute component={LazyPages.AppIconSettings} />} />
 <Route path="/settings/wallpaper" element={<LazyRoute component={LazyPages.WallpaperSettings} />} />
 <Route path="/settings/chat-folders" element={<LazyRoute component={LazyPages.ChatFoldersSettings} />} />
 <Route path="/device-management" element={<LazyRoute component={LazyPages.DeviceManagement} />} />
 <Route path="/bluetooth-test" element={<LazyRoute component={LazyPages.BluetoothTest} />} />
 
 {/* AI Command Center (CEO portal) */}
 <Route path="/command-center" element={<LazyRoute component={LazyPages.CommandCenter} />} />
 <Route path="/dev/execution-dashboard" element={<ExecutionDashboard />} />

 {/* Call Quality Benchmark Dashboard */}
 <Route path="/call-benchmark" element={<Suspense fallback={<PageLoader />}>{React.createElement(React.lazy(() => import('./pages/CallBenchmarkDashboard')))}</Suspense>} />

 {/* Legacy Admin paths (Removed during refactor) */}
 <Route path="/chatr-tutors" element={<LazyRoute component={LazyPages.ChatrTutors} />} />
 <Route path="/tutors" element={<LazyRoute component={LazyPages.ChatrTutors} />} />
 <Route path="/home-services" element={<LazyRoute component={LazyPages.HomeServices} />} />
 <Route path="/wellness-circles" element={<LazyRoute component={LazyPages.WellnessCircles} />} />
 <Route path="/wellness-circles/:circleId" element={<LazyRoute component={LazyPages.WellnessCircles} />} />
 <Route path="/expert-sessions" element={<LazyRoute component={LazyPages.ExpertSessions} />} />
 <Route path="/community" element={<LazyRoute component={LazyPages.Community} />} />
 {/* New CHATR OS Enterprise Home Routes */}
 <Route path="/enterprise" element={<KernelProvider useInMemory={false}><Suspense fallback={<PageLoader />}><MarketplaceLayout /></Suspense></KernelProvider>}>
 <Route index element={<Suspense fallback={<PageLoader />}><HomeDashboard /></Suspense>} />
 <Route path="marketplace" element={<Suspense fallback={<PageLoader />}><MarketplaceBrowser /></Suspense>} />
 <Route path="marketplace/industry/:id" element={<Suspense fallback={<PageLoader />}><IndustryDetailView /></Suspense>} />
 <Route path="install/:type/:id" element={<Suspense fallback={<PageLoader />}><InstallationWizard /></Suspense>} />
 <Route path="workspace" element={<Suspense fallback={<PageLoader />}><WorkspaceDashboard /></Suspense>} />
 <Route path="executive" element={<Suspense fallback={<PageLoader />}><ExecutiveAI /></Suspense>} />
 <Route path="search" element={<Suspense fallback={<PageLoader />}><EnterpriseSearch /></Suspense>} />
 <Route path="analytics" element={<Suspense fallback={<PageLoader />}><EnterpriseAnalytics /></Suspense>} />
 <Route path="users" element={<Suspense fallback={<PageLoader />}><UserManagement /></Suspense>} />
 <Route path="runtime" element={<Suspense fallback={<PageLoader />}><CapabilityRuntimeView /></Suspense>} />
 <Route path="compliance" element={<Suspense fallback={<PageLoader />}><AuditCompliance /></Suspense>} />
 <Route path="settings" element={<Suspense fallback={<PageLoader />}><WorkspaceSettings /></Suspense>} />
 <Route path="integrations" element={<Suspense fallback={<PageLoader />}><EnterpriseIntegrations /></Suspense>} />
 <Route path="developer" element={<Suspense fallback={<PageLoader />}><DeveloperHub /></Suspense>} />
 <Route path="coming-soon" element={<Suspense fallback={<PageLoader />}><ComingSoon /></Suspense>} />
 </Route>
 
 {/* Legacy CHATR OS Routes */}
 <Route path="/chatr-plus" element={<LazyRoute component={LazyPages.ChatrPlus} />} />
 <Route path="/chatr-plus/search" element={<LazyRoute component={LazyPages.ChatrPlusSearch} />} />
 <Route path="/chatr-plus/subscribe" element={<LazyRoute component={LazyPages.ChatrPlusSubscribe} />} />
 <Route path="/subscription" element={<LazyRoute component={LazyPages.UserSubscription} />} />
 <Route path="/wallet" element={<LazyRoute component={LazyPages.ChatrWallet} />} />
 <Route path="/chatr-plus/service/:id" element={<LazyRoute component={LazyPages.ChatrPlusServiceDetail} />} />
 <Route path="/chatr-plus/seller-registration" element={<LazyRoute component={LazyPages.ChatrPlusSellerRegistration} />} />
 <Route path="/chatr-plus/seller/dashboard" element={<LazyRoute component={LazyPages.ChatrPlusSellerDashboard} />} />
 <Route path="/chatr-plus/category/:slug" element={<LazyRoute component={LazyPages.ChatrPlusCategoryPage} />} />
 <Route path="/chatr-plus/wallet" element={<LazyRoute component={LazyPages.ChatrPlusWallet} />} />
 <Route path="/seller" element={<LazyRoute component={LazyPages.SellerPortal} />} />
 <Route path="/seller/portal" element={<LazyRoute component={LazyPages.SellerPortal} />} />
 <Route path="/seller/bookings" element={<LazyRoute component={LazyPages.SellerBookings} />} />
 <Route path="/seller/services" element={<LazyRoute component={LazyPages.SellerServices} />} />
 <Route path="/seller/analytics" element={<LazyRoute component={LazyPages.SellerAnalytics} />} />
 <Route path="/seller/messages" element={<LazyRoute component={LazyPages.SellerMessages} />} />
 <Route path="/seller/settings" element={<LazyRoute component={LazyPages.SellerSettings} />} />
 <Route path="/seller/reviews" element={<LazyRoute component={LazyPages.SellerReviews} />} />
 <Route path="/seller/payouts" element={<LazyRoute component={LazyPages.SellerPayouts} />} />
 <Route path="/seller/subscription" element={<LazyRoute component={LazyPages.SellerSubscription} />} />
 <Route path="/seller/settlements" element={<LazyRoute component={LazyPages.SellerSettlements} />} />
 
 <Route path="/provider/appointments" element={<LazyRoute component={LazyPages.ProviderAppointments} />} />
 <Route path="/provider/services" element={<LazyRoute component={LazyPages.ProviderServices} />} />
 <Route path="/provider/payments" element={<LazyRoute component={LazyPages.ProviderPayments} />} />
 

 
 <Route path="/vendor/login" element={<LazyRoute component={LazyPages.VendorLogin} />} />
 <Route path="/vendor/register" element={<LazyRoute component={LazyPages.VendorRegister} />} />
 <Route path="/vendor/dashboard" element={<ProtectedLazyRoute component={LazyPages.VendorDashboard} />} />
 <Route path="/vendor/menu" element={<ProtectedLazyRoute component={LazyPages.RestaurantMenu} />} />
 <Route path="/vendor/orders" element={<ProtectedLazyRoute component={LazyPages.RestaurantOrders} />} />
 <Route path="/vendor/deals" element={<ProtectedLazyRoute component={LazyPages.DealsManagement} />} />
 <Route path="/vendor/deals/new" element={<ProtectedLazyRoute component={LazyPages.DealsManagement} />} />
 <Route path="/vendor/settings" element={<ProtectedLazyRoute component={LazyPages.VendorSettings} />} />
 <Route path="/vendor/appointments" element={<ProtectedLazyRoute component={LazyPages.DoctorAppointments} />} />
 <Route path="/vendor/patients" element={<ProtectedLazyRoute component={LazyPages.DoctorPatients} />} />
 <Route path="/vendor/analytics" element={<ProtectedLazyRoute component={LazyPages.DoctorAnalytics} />} />
 <Route path="/vendor/availability" element={<ProtectedLazyRoute component={LazyPages.DoctorAvailability} />} />
 
 <Route path="/referrals" element={<ProtectedLazyRoute component={LazyPages.Referrals} />} />
 <Route path="/leaderboard" element={<LazyRoute component={LazyPages.ChatrPoints} />} />
 <Route path="/fame-cam" element={<ProtectedLazyRoute component={LazyPages.FameCam} />} />
 <Route path="/fame-leaderboard" element={<ProtectedLazyRoute component={LazyPages.FameLeaderboard} />} />
 <Route path="/mini-apps" element={<LazyRoute component={LazyPages.MiniAppsStore} />} />
 <Route path="/identity" element={<ProtectedLazyRoute component={LazyPages.Identity} />} />
 <Route path="/discover" element={<LazyRoute component={LazyPages.Discover} />} />
 <Route path="/u/:handle" element={<LazyRoute component={LazyPages.PublicProfile} />} />
 <Route path="/ai-clone-settings" element={<ProtectedLazyRoute component={LazyPages.AICloneSettings} />} />
 <Route path="/caller-id" element={<ProtectedLazyRoute component={LazyPages.CallerIdHub} />} />
 <Route path="/:handle" element={<LazyRoute component={LazyPages.PublicProfile} />} />
 <Route path="*" element={<LazyRoute component={LazyPages.NotFound} />} />
 </Route>
 </Routes>
 </NativeAppProvider>
 </NativeStartupRouteGate>
 </CallProvider>
 </Router>
 </PlatformProvider>
 </LocationProvider>
 </ThemeCustomizationProvider>
 </ThemeProvider>
 </SocketProvider>
 </QueryClientProvider>
 </HelmetProvider>
 </GlobalErrorBoundary>
 </CrashlyticsErrorBoundary>
 </div>
 </PlatformContext.Provider>
 );
};

export default App;

