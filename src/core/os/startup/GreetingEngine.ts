import greetingsDb from './greetings.json';
import { supabase } from '@/integrations/supabase/client';

export interface GreetingPayload {
  text: string;
  pitch: number;
  rate: number;
}

export class GreetingEngine {
  private queue: string[] = [];

  async generateGreeting(): Promise<GreetingPayload> {
    const hour = new Date().getHours();
    const dayIndex = new Date().getDay();
    
    let timeCategory = 'night';
    if (hour >= 5 && hour < 12) timeCategory = 'morning';
    else if (hour >= 12 && hour < 17) timeCategory = 'afternoon';
    else if (hour >= 17 && hour < 22) timeCategory = 'evening';

    const timeGreetings: string[] = (greetingsDb as any)[timeCategory];
    const baseGreeting = timeGreetings[Math.floor(Math.random() * timeGreetings.length)];
    
    // Warmth variations
    const warmthStyles = [
      { type: 'casual', pitch: 0.9, rate: 0.95 },
      { type: 'friendly', pitch: 1.1, rate: 1.05 },
      { type: 'professional', pitch: 1.0, rate: 1.0 },
      { type: 'energetic', pitch: 1.2, rate: 1.1 }
    ];
    const style = warmthStyles[Math.floor(Math.random() * warmthStyles.length)];
    
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const suffix = `Happy ${days[dayIndex]}.`;

    let userName = 'User';
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const userId = data.session.user.id;
        
        // 1. Try to get the username from the profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, primary_handle')
          .eq('id', userId)
          .maybeSingle();

        if (profile?.username) {
          userName = profile.username;
        } else if (profile?.primary_handle) {
          userName = profile.primary_handle;
        } else {
          // 2. Fallback to metadata or User
          const metadata = data.session.user.user_metadata;
          userName = metadata?.full_name || metadata?.name || 'User';
        }
      }
    } catch (e) {
      console.warn("Could not fetch user session for greeting:", e);
    }
    
    let finalGreeting = '';
    if (style.type === 'casual') finalGreeting = `Hey ${userName}, good to see you. `;
    else if (style.type === 'energetic') finalGreeting = `Welcome back, ${userName}! `;
    else if (style.type === 'friendly') finalGreeting = `Hello ${userName}, so glad you're here. `;
    else finalGreeting = `The CHATR family welcomes you back, ${userName}. `;
    
    finalGreeting += baseGreeting.replace('{UserName}', userName) + ' ' + suffix;
    
    return {
      text: finalGreeting,
      pitch: style.pitch,
      rate: style.rate
    };
  }

  queueGreeting(greeting: string) {
    this.queue.push(greeting);
  }

  popGreeting(): string | undefined {
    return this.queue.shift();
  }
}

export const greetingEngine = new GreetingEngine();
