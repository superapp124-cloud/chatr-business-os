import { supabase } from '@/integrations/supabase/client';

export interface Cursor {
  userId: string;
  x: number;
  y: number;
  color: string;
  name: string;
}

const CURSOR_COLORS = ['#f43f5e','#0ea5e9','#10b981','#f59e0b','#a855f7','#6366f1'];
let colorIndex = 0;
const assignedColors: Record<string, string> = {};
function getColor(userId: string): string {
  if (!assignedColors[userId]) {
    assignedColors[userId] = CURSOR_COLORS[colorIndex % CURSOR_COLORS.length];
    colorIndex++;
  }
  return assignedColors[userId];
}

class Manager {
  private cursors: Map<string, Cursor> = new Map();
  private listeners: (() => void)[] = [];
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private currentUserId: string | null = null;

  async init(workflowId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    this.currentUserId = user.id;

    // Leave old channel if re-initializing
    if (this.channel) { await supabase.removeChannel(this.channel); }

    this.channel = supabase.channel(`workflow_presence_${workflowId}`, {
      config: { presence: { key: user.id } },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel!.presenceState();
        this.cursors.clear();
        Object.entries(state).forEach(([uid, presences]: [string, any[]]) => {
          const p = presences[0];
          if (p) {
            this.cursors.set(uid, {
              userId: uid,
              x: p.x || 0,
              y: p.y || 0,
              color: getColor(uid),
              name: p.name || 'User',
            });
          }
        });
        this.notify();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: profile } = await supabase.from('profiles').select('full_name, username').eq('id', user.id).single();
          await this.channel!.track({
            x: 200,
            y: 200,
            name: (profile as any)?.full_name || (profile as any)?.username || 'You',
          });
        }
      });
  }

  async updateCursor(x: number, y: number) {
    if (!this.channel || !this.currentUserId) return;
    const cursor = this.cursors.get(this.currentUserId);
    await this.channel.track({ x, y, name: cursor?.name || 'You' });
  }

  async destroy() {
    if (this.channel) {
      await this.channel.untrack();
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.cursors.clear();
    this.notify();
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private notify() { this.listeners.forEach(l => l()); }

  getCursors(): Cursor[] {
    return Array.from(this.cursors.values()).filter(c => c.userId !== this.currentUserId);
  }
}

export const PresenceManager = new Manager();
