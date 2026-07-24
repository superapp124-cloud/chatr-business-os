// CHATR+ Network Monitor
// Proactive network type change detection for ICE restart.
// Detects WiFi ↔ LTE transitions and notifies the WebRTC layer before
// ICE times out naturally (which takes 5–15s by default).

export type NetworkType =
  | 'wifi'
  | '4g'
  | '3g'
  | '2g'
  | 'ethernet'
  | 'offline'
  | 'unknown';

type NetworkChangeListener = (type: NetworkType, prev: NetworkType | null) => void;

function normalizeEffectiveType(raw: string): NetworkType {
  switch (raw) {
    case '4g':      return '4g';
    case '3g':      return '3g';
    case '2g':      return '2g';
    case 'slow-2g': return '2g';
    default:        return 'unknown';
  }
}

function readNetworkType(): NetworkType {
  if (!navigator.onLine) return 'offline';

  const conn = (navigator as any).connection ??
               (navigator as any).mozConnection ??
               (navigator as any).webkitConnection;
  if (!conn) return 'unknown';

  // Connection type: 'wifi', 'cellular', 'ethernet', etc.
  if (conn.type === 'wifi')     return 'wifi';
  if (conn.type === 'ethernet') return 'ethernet';
  if (conn.type === 'cellular') return normalizeEffectiveType(conn.effectiveType ?? '');

  return normalizeEffectiveType(conn.effectiveType ?? '');
}

class NetworkMonitorClass {
  private current: NetworkType | null = null;
  private listeners: NetworkChangeListener[] = [];
  private started = false;

  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    this.current = readNetworkType();

    const check = () => {
      const next = readNetworkType();
      if (next !== this.current) {
        const prev = this.current;
        this.current = next;
        console.log(`🌐 [Network] ${prev} → ${next}`);
        this.listeners.forEach(fn => fn(next, prev));
      }
    };

    const conn = (navigator as any).connection;
    conn?.addEventListener?.('change', check);
    window.addEventListener('online',  check);
    window.addEventListener('offline', check);

    // Also listen for native bridge events (Android NetworkChangeReceiver)
    window.addEventListener('nativeNetworkChanged', (e: Event) => {
      const detail = (e as CustomEvent<{ type: string }>).detail;
      if (detail?.type) check();
    });
  }

  /** Subscribe to network type changes. Returns unsubscribe fn. */
  onChange(fn: NetworkChangeListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(f => f !== fn);
    };
  }

  currentType(): NetworkType | null { return this.current; }

  isOnline(): boolean {
    if (this.current === null) return navigator.onLine;
    return this.current !== 'offline';
  }
}

export const networkMonitor = new NetworkMonitorClass();
