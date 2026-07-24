/**
 * CHATR Calendar Service
 * 
 * Real calendar integration for Google Calendar, Microsoft Outlook, and Local (.ics).
 * 
 * Architecture:
 *   CalendarService (this file) — facade/orchestrator
 *       ├── GoogleCalendarProvider — Google Calendar API v3 (OAuth2 PKCE)
 *       ├── OutlookCalendarProvider — Microsoft Graph API (OAuth2 PKCE)
 *       └── LocalCalendarProvider — Generates .ics file for download (universal)
 * 
 * Usage:
 *   calendarService.createEvent(event)  — writes to all connected providers
 *   calendarService.getSlots(query)     — reads from connected providers
 *   calendarService.downloadICS(event) — always works, no auth needed
 */

const CALENDAR_CONNECTIONS_KEY = 'chatr_calendar_connections_v1';

export interface CalendarEvent {
  id: string;
  title: string;
  startDateTime: string;        // ISO 8601
  endDateTime: string;          // ISO 8601
  attendees?: string[];
  location?: string;
  description?: string;
  reminderMinutes?: number;     // Default 15
}

export interface TimeSlot {
  id: string;
  timeSlot: string;             // Human readable: "Tomorrow, 10:00 AM"
  startDateTime: string;        // ISO 8601
  endDateTime: string;          // ISO 8601
  duration: string;             // "30m"
  status: 'Available' | 'Busy' | 'Tentative';
  _provider: string;
}

export interface CalendarConnection {
  provider: 'google' | 'outlook' | 'local';
  email?: string;
  name?: string;
  connected: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string;
}

// ─── Google Calendar Provider ─────────────────────────────────────────────────

// Helper to safely get environment variables in both Vite and Node.js
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) return (import.meta as any).env[key];
  return '';
};

const getOrigin = () => {
  if (typeof window !== 'undefined' && window.location) return window.location.origin;
  return 'http://localhost:8080';
};

class GoogleCalendarProvider {
  private readonly BASE_URL = 'https://www.googleapis.com/calendar/v3';
  private readonly CLIENT_ID = getEnv('VITE_GOOGLE_CLIENT_ID');
  private readonly SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  private readonly REDIRECT_URI = getOrigin() + '/auth/google/callback';

  isConfigured(): boolean {
    return !!this.CLIENT_ID;
  }

  /** Initiates Google OAuth2 PKCE flow */
  async initiateLogin(): Promise<void> {
    if (!this.CLIENT_ID) {
      throw new Error('Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in .env');
    }

    // Generate PKCE challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store verifier for the callback
    sessionStorage.setItem('chatr_google_pkce_verifier', codeVerifier);
    sessionStorage.setItem('chatr_google_oauth_state', crypto.randomUUID());

    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      response_type: 'code',
      scope: this.SCOPES + ' openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
      state: sessionStorage.getItem('chatr_google_oauth_state') || '',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /** Handles the OAuth2 callback. Call this from /auth/google/callback route */
  async handleCallback(code: string): Promise<CalendarConnection> {
    const codeVerifier = sessionStorage.getItem('chatr_google_pkce_verifier');
    if (!codeVerifier) throw new Error('PKCE verifier missing. Please try login again.');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.CLIENT_ID,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: this.REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Google token exchange failed: ${err.error_description}`);
    }

    const tokens = await response.json();
    sessionStorage.removeItem('chatr_google_pkce_verifier');

    // Get user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    return {
      provider: 'google',
      connected: true,
      email: profile.email,
      name: profile.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };
  }

  async createEvent(token: string, event: CalendarEvent): Promise<any> {
    const body: any = {
      summary: event.title,
      description: event.description || '',
      location: event.location || '',
      start: {
        dateTime: event.startDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: event.endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: event.reminderMinutes ?? 15 }],
      },
    };

    if (event.attendees && event.attendees.length > 0) {
      body.attendees = event.attendees.map(email => ({ email }));
    }

    const res = await fetch(`${this.BASE_URL}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Google Calendar error: ${err.error?.message}`);
    }

    return res.json();
  }

  async getAvailableSlots(token: string, timeMin: string, timeMax: string): Promise<TimeSlot[]> {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const res = await fetch(`${this.BASE_URL}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];
    const data = await res.json();

    // Build free slots by finding gaps between events
    const busyTimes = (data.items || []).map((e: any) => ({
      start: new Date(e.start.dateTime || e.start.date).getTime(),
      end: new Date(e.end.dateTime || e.end.date).getTime(),
    }));

    return this.generateFreeSlots(busyTimes, new Date(timeMin), new Date(timeMax));
  }

  private generateFreeSlots(busyTimes: { start: number; end: number }[], from: Date, to: Date): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotDurationMs = 30 * 60 * 1000;
    let cursor = from.getTime();
    let slotId = 1;

    while (cursor + slotDurationMs <= to.getTime()) {
      const slotEnd = cursor + slotDurationMs;
      const isBusy = busyTimes.some(b => cursor < b.end && slotEnd > b.start);

      if (!isBusy) {
        const start = new Date(cursor);
        const end = new Date(slotEnd);
        slots.push({
          id: `GSLOT-${slotId++}`,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          duration: '30m',
          status: 'Available',
          timeSlot: start.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          _provider: 'Google Calendar',
        });
      }

      cursor += slotDurationMs;
      if (slots.length >= 6) break; // Return top 6 slots
    }

    return slots;
  }

  // PKCE helpers
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

// ─── Microsoft Outlook / Graph Provider ──────────────────────────────────────

class OutlookCalendarProvider {
  private readonly BASE_URL = 'https://graph.microsoft.com/v1.0';
  private readonly CLIENT_ID = getEnv('VITE_OUTLOOK_CLIENT_ID');
  private readonly TENANT_ID = getEnv('VITE_OUTLOOK_TENANT_ID') || 'common';
  private readonly SCOPES = 'Calendars.ReadWrite offline_access';
  private readonly REDIRECT_URI = getOrigin() + '/auth/outlook/callback';

  isConfigured(): boolean {
    return !!this.CLIENT_ID;
  }

  async initiateLogin(): Promise<void> {
    if (!this.CLIENT_ID) {
      throw new Error('Outlook Client ID not configured. Set VITE_OUTLOOK_CLIENT_ID in .env');
    }

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    sessionStorage.setItem('chatr_outlook_pkce_verifier', codeVerifier);

    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      response_type: 'code',
      redirect_uri: this.REDIRECT_URI,
      response_mode: 'query',
      scope: this.SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `https://login.microsoftonline.com/${this.TENANT_ID}/oauth2/v2.0/authorize?${params}`;
  }

  async handleCallback(code: string): Promise<CalendarConnection> {
    const codeVerifier = sessionStorage.getItem('chatr_outlook_pkce_verifier');
    if (!codeVerifier) throw new Error('PKCE verifier missing.');

    const response = await fetch(`https://login.microsoftonline.com/${this.TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.CLIENT_ID,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: this.REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Outlook token exchange failed: ${err.error_description}`);
    }

    const tokens = await response.json();
    sessionStorage.removeItem('chatr_outlook_pkce_verifier');

    const profileRes = await fetch(`${this.BASE_URL}`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    return {
      provider: 'outlook',
      connected: true,
      email: profile.mail || profile.userPrincipalName,
      name: profile.displayName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    };
  }

  async createEvent(token: string, event: CalendarEvent): Promise<any> {
    const body: any = {
      subject: event.title,
      body: { contentType: 'Text', content: event.description || '' },
      start: { dateTime: event.startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: event.endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      location: event.location ? { displayName: event.location } : undefined,
      isReminderOn: true,
      reminderMinutesBeforeStart: event.reminderMinutes ?? 15,
    };

    if (event.attendees && event.attendees.length > 0) {
      body.attendees = event.attendees.map(email => ({
        emailAddress: { address: email },
        type: 'required',
      }));
    }

    const res = await fetch(`${this.BASE_URL}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Outlook Calendar error: ${err.error?.message}`);
    }

    return res.json();
  }

  async getAvailableSlots(token: string, timeMin: string, timeMax: string): Promise<TimeSlot[]> {
    const res = await fetch(
      `${this.BASE_URL}/calendarView?startDateTime=${timeMin}&endDateTime=${timeMax}&$orderby=start/dateTime`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return [];
    const data = await res.json();

    const busyTimes = (data.value || []).map((e: any) => ({
      start: new Date(e.start.dateTime).getTime(),
      end: new Date(e.end.dateTime).getTime(),
    }));

    return this.generateFreeSlots(busyTimes, new Date(timeMin), new Date(timeMax));
  }

  private generateFreeSlots(busyTimes: { start: number; end: number }[], from: Date, to: Date): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotDurationMs = 30 * 60 * 1000;
    let cursor = from.getTime();
    let slotId = 1;

    while (cursor + slotDurationMs <= to.getTime() && slots.length < 6) {
      const slotEnd = cursor + slotDurationMs;
      const isBusy = busyTimes.some(b => cursor < b.end && slotEnd > b.start);

      if (!isBusy) {
        const start = new Date(cursor);
        slots.push({
          id: `OSLOT-${slotId++}`,
          startDateTime: start.toISOString(),
          endDateTime: new Date(slotEnd).toISOString(),
          duration: '30m',
          status: 'Available',
          timeSlot: start.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          _provider: 'Outlook Calendar',
        });
      }
      cursor += slotDurationMs;
    }

    return slots;
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

// ─── Local Calendar Provider (.ics) ──────────────────────────────────────────

class LocalCalendarProvider {
  /** Downloads a .ics file to the user's computer (opens in default calendar app) */
  downloadICS(event: CalendarEvent): void {
    const formatDate = (iso: string) => iso.replace(/[-:]/g, '').replace('.000Z', 'Z');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CHATR//CHATR OS//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${event.id}@chatr.app`,
      `DTSTAMP:${formatDate(new Date().toISOString())}`,
      `DTSTART:${formatDate(event.startDateTime)}`,
      `DTEND:${formatDate(event.endDateTime)}`,
      `SUMMARY:${event.title}`,
      event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
      event.location ? `LOCATION:${event.location}` : '',
      ...(event.attendees || []).map(e => `ATTENDEE;CN=${e}:mailto:${e}`),
      `BEGIN:VALARM`,
      `TRIGGER:-PT${event.reminderMinutes ?? 15}M`,
      `ACTION:DISPLAY`,
      `DESCRIPTION:Reminder`,
      `END:VALARM`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('[LocalCalendar] .ics file downloaded for:', event.title);
  }

  /** Generate available slots (mock — local calendar has no real data) */
  getAvailableSlots(): TimeSlot[] {
    const now = new Date();
    const slots: TimeSlot[] = [];

    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const hours = [9, 10, 14, 15, 16];
      hours.forEach((hour, i) => {
        const start = new Date(now);
        start.setDate(start.getDate() + dayOffset + 1);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        slots.push({
          id: `LOCAL-${dayOffset}-${i}`,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          duration: '30m',
          status: 'Available',
          timeSlot: start.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
          _provider: 'Local Calendar',
        });
      });
    }

    return slots.slice(0, 6);
  }
}

// ─── CalendarService Facade ───────────────────────────────────────────────────

export class CalendarServiceImpl {
  private static instance: CalendarServiceImpl;
  private connections: Map<string, CalendarConnection> = new Map();

  public readonly google = new GoogleCalendarProvider();
  public readonly outlook = new OutlookCalendarProvider();
  public readonly local = new LocalCalendarProvider();

  private constructor() {
    this.loadConnections();
  }

  public static getInstance(): CalendarServiceImpl {
    if (!CalendarServiceImpl.instance) {
      CalendarServiceImpl.instance = new CalendarServiceImpl();
    }
    return CalendarServiceImpl.instance;
  }

  // ─── Connection Management ─────────────────────────────────────────────────

  private loadConnections(): void {
    try {
      const saved = localStorage.getItem(CALENDAR_CONNECTIONS_KEY);
      if (saved) {
        const parsed: CalendarConnection[] = JSON.parse(saved);
        parsed.forEach(c => this.connections.set(c.provider, c));
      }
    } catch { /* ignore */ }
  }

  private saveConnections(): void {
    try {
      const toSave = Array.from(this.connections.values()).map(c => ({
        ...c,
        // Don't persist sensitive tokens in clear text in production
        // In production, use Supabase Vault or secure cookie
        accessToken: c.accessToken,
        refreshToken: c.refreshToken,
      }));
      localStorage.setItem(CALENDAR_CONNECTIONS_KEY, JSON.stringify(toSave));
    } catch { /* ignore */ }
  }

  public saveConnection(conn: CalendarConnection): void {
    this.connections.set(conn.provider, conn);
    this.saveConnections();
  }

  public removeConnection(provider: string): void {
    this.connections.delete(provider);
    this.saveConnections();
  }

  public getConnections(): CalendarConnection[] {
    return Array.from(this.connections.values());
  }

  public getConnection(provider: string): CalendarConnection | undefined {
    return this.connections.get(provider);
  }

  public isAnyConnected(): boolean {
    return Array.from(this.connections.values()).some(c => c.connected);
  }

  // ─── Calendar Operations ───────────────────────────────────────────────────

  /**
   * Creates a calendar event across ALL connected providers.
   * Always also triggers a local .ics download so the event is never lost.
   */
  public async createEvent(event: CalendarEvent, downloadICS = true): Promise<{
    success: boolean;
    results: { provider: string; success: boolean; id?: string; error?: string }[];
  }> {
    const results: { provider: string; success: boolean; id?: string; error?: string }[] = [];

    // Always offer .ics download for local calendar app (macOS Calendar, Outlook, Windows Calendar)
    if (downloadICS) {
      this.local.downloadICS(event);
      results.push({ provider: 'local', success: true });
    }

    // Google Calendar
    const googleConn = this.connections.get('google');
    if (googleConn?.connected && googleConn.accessToken) {
      try {
        const res = await this.google.createEvent(googleConn.accessToken, event);
        results.push({ provider: 'google', success: true, id: res.id });
      } catch (err: any) {
        results.push({ provider: 'google', success: false, error: err.message });
      }
    }

    // Outlook
    const outlookConn = this.connections.get('outlook');
    if (outlookConn?.connected && outlookConn.accessToken) {
      try {
        const res = await this.outlook.createEvent(outlookConn.accessToken, event);
        results.push({ provider: 'outlook', success: true, id: res.id });
      } catch (err: any) {
        results.push({ provider: 'outlook', success: false, error: err.message });
      }
    }

    return { success: results.some(r => r.success), results };
  }

  /**
   * Fetches available time slots from all connected providers.
   * If no providers connected, returns local mock slots.
   */
  public async getAvailableSlots(timeframeHours = 72): Promise<TimeSlot[]> {
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + timeframeHours * 60 * 60 * 1000).toISOString();

    const allSlots: TimeSlot[] = [];

    const googleConn = this.connections.get('google');
    if (googleConn?.connected && googleConn.accessToken) {
      try {
        const slots = await this.google.getAvailableSlots(googleConn.accessToken, timeMin, timeMax);
        allSlots.push(...slots);
      } catch { /* fall through */ }
    }

    const outlookConn = this.connections.get('outlook');
    if (outlookConn?.connected && outlookConn.accessToken) {
      try {
        const slots = await this.outlook.getAvailableSlots(outlookConn.accessToken, timeMin, timeMax);
        allSlots.push(...slots);
      } catch { /* fall through */ }
    }

    // Always include local slots as fallback / supplement
    const localSlots = this.local.getAvailableSlots();
    allSlots.push(...localSlots);

    // Deduplicate by similar start times (within 5 min) and sort
    const seen = new Set<string>();
    return allSlots
      .filter(s => {
        const key = new Date(s.startDateTime).toISOString().slice(0, 16); // minute precision
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime())
      .slice(0, 8);
  }

  /** Helper: parse slot + duration into CalendarEvent */
  public slotToEvent(slot: TimeSlot, title: string, attendees?: string[]): CalendarEvent {
    return {
      id: crypto.randomUUID(),
      title,
      startDateTime: slot.startDateTime,
      endDateTime: slot.endDateTime,
      attendees: attendees || [],
      reminderMinutes: 15,
    };
  }
}

export const calendarService = CalendarServiceImpl.getInstance();
