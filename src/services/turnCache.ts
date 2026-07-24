// CHATR+ TURN Credential Cache
// Eliminates the 200-800ms network penalty of fetching TURN on every call answer.
// Credentials are pre-fetched at app boot and silently refreshed every 4 minutes.

const TURN_CACHE_KEY = 'chatr_turn_v2';
const TURN_TTL_MS    = 4 * 60 * 1000;   // 4 min (TURN creds expire at 5 min)
const REFRESH_AHEAD  = 30 * 1000;        // refresh 30s before expiry

interface TurnEntry {
  iceServers: RTCIceServer[];
  expiresAt: number;
}

class TurnCacheClass {
  private mem: TurnEntry | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private fetchFn: (() => Promise<RTCIceServer[]>) | null = null;

  /** Return cached ICE servers if still valid, else null. */
  get(): RTCIceServer[] | null {
    if (this.mem && Date.now() < this.mem.expiresAt) return this.mem.iceServers;

    try {
      const raw = localStorage.getItem(TURN_CACHE_KEY);
      if (raw) {
        const entry: TurnEntry = JSON.parse(raw);
        if (Date.now() < entry.expiresAt) {
          this.mem = entry;
          return entry.iceServers;
        }
      }
    } catch { /* corrupt cache — ignore */ }

    return null;
  }

  /** Store new ICE servers into memory + localStorage. */
  set(iceServers: RTCIceServer[]) {
    const entry: TurnEntry = { iceServers, expiresAt: Date.now() + TURN_TTL_MS };
    this.mem = entry;
    try { localStorage.setItem(TURN_CACHE_KEY, JSON.stringify(entry)); } catch { /* quota */ }
  }

  /** Start a background refresh loop at app boot. */
  startBackgroundRefresh(fetchFn: () => Promise<RTCIceServer[]>) {
    if (this.fetchFn) return; // already started
    this.fetchFn = fetchFn;
    this.scheduleRefresh(0); // fire immediately
  }

  /** Invalidate on sign-out. */
  invalidate() {
    this.mem = null;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    try { localStorage.removeItem(TURN_CACHE_KEY); } catch { /* ignore */ }
  }

  private scheduleRefresh(delayMs: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.doRefresh(), delayMs);
  }

  private async doRefresh() {
    if (!this.fetchFn) return;
    try {
      const servers = await this.fetchFn();
      if (servers?.length) {
        this.set(servers);
        console.log('[TURN] 🔄 Credentials refreshed silently');
      }
    } catch (e) {
      console.debug('[TURN] Background refresh failed (will retry):', e);
    }
    // Schedule next refresh: TTL minus 30s ahead-of-expiry
    this.scheduleRefresh(TURN_TTL_MS - REFRESH_AHEAD);
  }
}

export const TurnCache = new TurnCacheClass();
