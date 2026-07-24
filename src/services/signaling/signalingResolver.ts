export type SignalingEnvironment =
  | 'local'
  | 'lan'
  | 'preview'
  | 'staging'
  | 'production'
  | 'native'
  | 'automation'
  | 'unknown';

export interface SignalingRuntimeContext {
  environment: SignalingEnvironment;
  hostname: string;
  protocol: string;
  isAutomation: boolean;
  isNative: boolean;
  isLocalHost: boolean;
  isLanHost: boolean;
}

export interface SignalingEndpointResolution {
  socketEnabled: boolean;
  socketIoUrl: string | null;
  webSocketUrl: string | null;
  webTransportUrl: string | null;
  fallbackTransport: 'supabase';
  environment: SignalingEnvironment;
  reconnectBudget: number;
  timeoutMs: number;
  reason: string;
  diagnostics: SignalingRuntimeContext;
}

const STAGING_SIGNALING_URL = 'https://staging-signal.chatr.chat';
const PRODUCTION_SIGNALING_URL = 'https://signal.chatr.chat';

function readEnv(name: string): string {
  let value: any = '';
  if (name === 'VITE_ENABLE_SOCKET') value = import.meta.env.VITE_ENABLE_SOCKET;
  else if (name === 'VITE_SIGNALING_ENV') value = import.meta.env.VITE_SIGNALING_ENV;
  else if (name === 'VITE_ALLOW_LOCAL_SOCKET_AUTO') value = import.meta.env.VITE_ALLOW_LOCAL_SOCKET_AUTO;
  else if (name === 'VITE_SOCKET_URL') value = import.meta.env.VITE_SOCKET_URL;
  else if (name === 'VITE_SIGNALING_URL') value = import.meta.env.VITE_SIGNALING_URL;
  else if (name === 'VITE_WEBTRANSPORT_URL') value = import.meta.env.VITE_WEBTRANSPORT_URL;
  else if (name === 'VITE_APP_ENV') value = import.meta.env.VITE_APP_ENV;
  else if (name === 'VITE_ENVIRONMENT') value = import.meta.env.VITE_ENVIRONMENT;
  else if (name === 'MODE') value = import.meta.env.MODE;
  else value = import.meta.env[name];

  return typeof value === 'string' ? value.trim() : (value ? String(value) : '');
}

function getWindowHostname(): string {
  return typeof window === 'undefined' ? '' : window.location.hostname;
}

function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const maybeCapacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(maybeCapacitor?.isNativePlatform?.());
}

function isAutomationRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  const webdriver = navigator.webdriver === true;
  const headlessUa = /HeadlessChrome|Playwright|Puppeteer|PhantomJS/i.test(userAgent);
  const globals = typeof window !== 'undefined'
    ? Boolean((window as Window & { __playwright?: unknown; __puppeteer?: unknown }).__playwright)
      || Boolean((window as Window & { __playwright?: unknown; __puppeteer?: unknown }).__puppeteer)
    : false;

  return webdriver || headlessUa || globals;
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname.startsWith('127.');
}

function isLanHostname(hostname: string): boolean {
  if (hostname.endsWith('.local')) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;

  const match = hostname.match(/^172\.(\d{1,2})\./);
  if (!match) return false;
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function inferEnvironment(context: Omit<SignalingRuntimeContext, 'environment'>): SignalingEnvironment {
  const appEnv = readEnv('VITE_APP_ENV') || readEnv('VITE_ENVIRONMENT') || readEnv('MODE');
  const forced = readEnv('VITE_SIGNALING_ENV');

  if (forced && forced !== 'auto') return forced as SignalingEnvironment;
  if (context.isAutomation) return 'automation';
  if (context.isNative) return 'native';
  if (appEnv === 'staging' || context.hostname.startsWith('staging.')) return 'staging';
  if (appEnv === 'production' || context.hostname === 'chatr.chat' || context.hostname.endsWith('.chatr.chat')) {
    return 'production';
  }
  if (context.hostname.endsWith('.vercel.app')) return 'preview';
  if (context.isLanHost) return 'lan';
  if (context.isLocalHost) return 'local';

  return 'unknown';
}

export function getSignalingRuntimeContext(): SignalingRuntimeContext {
  const hostname = getWindowHostname();
  const protocol = typeof window === 'undefined' ? '' : window.location.protocol;
  const isAutomation = isAutomationRuntime();
  const isNative = isCapacitorNative();
  const isLocalHost = isLocalHostname(hostname);
  const isLanHost = isLanHostname(hostname);

  return {
    environment: inferEnvironment({ hostname, protocol, isAutomation, isNative, isLocalHost, isLanHost }),
    hostname,
    protocol,
    isAutomation,
    isNative,
    isLocalHost,
    isLanHost,
  };
}

function normalizeSocketIoUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function toWebSocketUrl(socketIoUrl: string | null): string | null {
  if (!socketIoUrl) return null;

  try {
    const url = new URL(socketIoUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function allowLocalSocketAutoDiscovery(): boolean {
  return readEnv('VITE_ALLOW_LOCAL_SOCKET_AUTO') === 'true';
}

function selectDefaultSocketUrl(context: SignalingRuntimeContext): string {
  if (context.environment === 'production') return PRODUCTION_SIGNALING_URL;
  if (context.environment === 'staging' || context.environment === 'preview') return STAGING_SIGNALING_URL;

  if (context.isAutomation || context.isNative) return '';
  if (!allowLocalSocketAutoDiscovery()) return '';

  const localHost = context.hostname || 'localhost';
  return `http://${localHost}:3000`;
}

function endpointHost(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function isInsecureNativeShell(context: SignalingRuntimeContext, socketIoUrl: string | null): boolean {
  const appEnv = readEnv('VITE_APP_ENV') || readEnv('VITE_ENVIRONMENT') || readEnv('MODE');
  if (appEnv === 'development' || context.environment === 'development') return false;
  if (!context.isNative || context.protocol !== 'https:') return false;
  if (!socketIoUrl) return false;
  return socketIoUrl.startsWith('http://');
}

function isUnsafePrivateEndpoint(context: SignalingRuntimeContext, socketIoUrl: string | null): boolean {
  const host = endpointHost(socketIoUrl);
  if (!host) return true;

  const endpointIsPrivate = isLocalHostname(host) || isLanHostname(host);
  if (!endpointIsPrivate) return false;

  if (context.environment === 'production' || context.environment === 'staging' || context.environment === 'preview') {
    return true;
  }

  if (context.isAutomation && host !== context.hostname) {
    return true;
  }

  return false;
}

export function resolveSignalingEndpoint(): SignalingEndpointResolution {
  const context = getSignalingRuntimeContext();
  const featureEnabled = readEnv('VITE_ENABLE_SOCKET') === 'true';
  const explicitUrl = readEnv('VITE_SIGNALING_URL') || readEnv('VITE_SOCKET_URL');
  const selectedUrl = explicitUrl || selectDefaultSocketUrl(context);
  const socketIoUrl = normalizeSocketIoUrl(selectedUrl);
  const webSocketUrl = toWebSocketUrl(socketIoUrl);
  const webTransportUrl = readEnv('VITE_WEBTRANSPORT_URL') || null;

  let socketEnabled = featureEnabled && Boolean(socketIoUrl);
  let reason = socketEnabled ? 'primary-socket-selected' : 'socket-feature-disabled';

  if (featureEnabled && !explicitUrl && !socketIoUrl) {
    reason = context.environment === 'production' || context.environment === 'staging' || context.environment === 'preview'
      ? 'default-socket-endpoint-unavailable'
      : 'local-socket-requires-explicit-endpoint';
  }

  if (socketEnabled && isInsecureNativeShell(context, socketIoUrl)) {
    socketEnabled = false;
    reason = 'native-https-shell-blocked-insecure-socket';
  }

  if (socketEnabled && isUnsafePrivateEndpoint(context, socketIoUrl)) {
    socketEnabled = false;
    reason = 'private-socket-endpoint-blocked-for-runtime';
  }

  return {
    socketEnabled,
    socketIoUrl: socketEnabled ? socketIoUrl : null,
    webSocketUrl: socketEnabled ? webSocketUrl : null,
    webTransportUrl,
    fallbackTransport: 'supabase',
    environment: context.environment,
    reconnectBudget: context.isAutomation ? 2 : 8,
    timeoutMs: context.isAutomation ? 2500 : 10000,
    reason,
    diagnostics: context,
  };
}
