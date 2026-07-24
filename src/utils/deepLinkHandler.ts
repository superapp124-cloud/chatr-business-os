import { App } from '@capacitor/app';

/**
 * Deep Link Handler for Chatr+
 * Handles all incoming deep links from:
 * - chatr:// custom scheme
 * - https://chatr.chat universal links
 * - Android App Links
 */

export interface DeepLinkRoute {
  path: string;
  queryParams?: Record<string, string>;
}

/**
 * Parse deep link URL to route
 */
export const parseDeepLink = (url: string): DeepLinkRoute | null => {
  try {
    console.log('[DeepLink] Parsing URL:', url);

    // Remove scheme and host
    let path = url
      .replace(/^(chatr:\/\/|https?:\/\/(www\.)?chatr\.chat)/, '')
      .replace(/^\/+/, '/'); // Ensure starts with /

    // Extract query parameters
    const urlObj = new URL(url.includes('://') ? url : `https://chatr.chat${url}`);
    const queryParams: Record<string, string> = {};
    
    urlObj.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Remove query string from path
    path = path.split('?')[0];

    // Default to home if empty
    if (!path || path === '/') {
      path = '/';
    }

    console.log('[DeepLink] Parsed route:', { path, queryParams });

    return {
      path,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    };
  } catch (error) {
    console.error('[DeepLink] Parse error:', error);
    return null;
  }
};

/**
 * Navigate to deep link route
 */
export const navigateToDeepLink = (route: DeepLinkRoute): void => {
  let targetUrl = route.path;

  // Add query parameters
  if (route.queryParams) {
    const params = new URLSearchParams(route.queryParams);
    targetUrl += `?${params.toString()}`;
  }

  console.log('[DeepLink] Navigating to:', targetUrl);

  // Dispatch as a nativeNavigate event so useNativeNavigate handles it
  // with React Router's navigate() — no page reload, works with HashRouter.
  window.dispatchEvent(
    new CustomEvent('nativeNavigate', { detail: { path: targetUrl, source: 'deeplink' } })
  );
};

/**
 * Initialize deep link listener
 * Call this in your app initialization
 */
export const initDeepLinkListener = async (): Promise<() => void> => {
  console.log('[DeepLink] Initializing listener');

  const listener = await App.addListener('appUrlOpen', (event) => {
    console.log('[DeepLink] Received (warm):', event.url);

    const route = parseDeepLink(event.url);
    
    if (route) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => navigateToDeepLink(route));
      });
    }
  });

  // Cold-start fallback: if the app was launched from a deep link while killed,
  // the appUrlOpen event fires before the listener is registered.
  // getLaunchUrl() recovers that URL.
  try {
    const launchUrl = await App.getLaunchUrl();
    if (launchUrl?.url) {
      console.log('[DeepLink] Cold-start URL:', launchUrl.url);
      const route = parseDeepLink(launchUrl.url);
      if (route) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => navigateToDeepLink(route));
        });
      }
    }
  } catch (err) {
    // getLaunchUrl is not available in all Capacitor versions — safe to ignore
    console.log('[DeepLink] getLaunchUrl not available:', err);
  }

  // Return cleanup function
  return () => {
    console.log('[DeepLink] Removing listener');
    listener.remove();
  };
};

/**
 * Route mapping for validation
 */
export const VALID_ROUTES = [
  '/',
  '/auth',
  '/chat',
  '/chat/:conversationId',
  '/contacts',
  '/global-contacts',
  '/call-history',
  '/smart-inbox',
  '/stories',
  '/communities',
  '/create-community',
  '/health',
  '/health-passport',
  '/lab-reports',
  '/medicine-reminders',
  '/care',
  '/booking',
  '/provider-portal',
  '/provider-register',
  '/allied-healthcare',
  '/local-healthcare',
  '/marketplace',
  '/home-services',
  '/native-apps',
  '/app-statistics',
  '/developer-portal',
  '/jobs',
  '/ai-agents',
  '/ai-agents/chat/:agentId',
  '/ai-assistant',
  '/ai-browser',
  '/official-accounts',
  '/tutors',
  '/growth',
  '/youth-feed',
  '/settings',
  '/account',
  '/privacy',
  '/notifications',
  '/notification-settings',
  '/device-management',
  '/geofences',
  '/geofence-history',
  '/qr-payment',
  '/download',
  '/install',
  '/onboarding',
  '/emergency',
  '/emergency-services',
  '/wellness-circles',
  '/expert-sessions',
  '/admin',
  '/about',
  '/help',
  '/contact',
  '/terms',
  '/privacy',
  '/refund',
  '/disclaimer',
  '/join',
] as const;

/**
 * Validate if route is supported
 */
export const isValidRoute = (path: string): boolean => {
  // Exact match
  if (VALID_ROUTES.includes(path as any)) {
    return true;
  }

  // Dynamic route match (e.g., /chat/123, /profile/user456)
  const dynamicMatch = VALID_ROUTES.some(route => {
    const pattern = route.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(path);
  });

  return dynamicMatch;
};

/**
 * Example deep link URLs that work:
 * 
 * chatr://chat
 * chatr://chat/conv-123
 * chatr://profile/user-456
 * chatr://ai-agents/chat/agent-789
 * 
 * https://chatr.chat/chat
 * https://chatr.chat/chat/conv-123
 * https://chatr.chat/profile/user-456
 * https://chatr.chat/ai-browser?url=https://example.com
 * 
 * https://www.chatr.chat/health
 * https://www.chatr.chat/jobs
 */
