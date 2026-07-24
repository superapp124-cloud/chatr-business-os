import React, { useState, useEffect } from 'react';
import { Sparkles, Clock, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const DashboardHeader: React.FC<{
  onCreateNew?: () => void;
}> = ({ onCreateNew }) => {
  const [userName, setUserName] = useState('there');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, primary_handle')
          .eq('id', user.id)
          .single();

        if (profile?.full_name) {
          setUserName(profile.full_name.split(' ')[0]);
        } else if (profile?.primary_handle) {
          setUserName(profile.primary_handle);
        }
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="flex items-start justify-between gap-4">
      {/* Left: Greeting */}
      <div className="flex items-center gap-4">
        {/* Animated icon */}
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-violet-500/40 shadow-xl shadow-violet-500/30 shrink-0">
            <img src="/chatr-ai-logo.jpg" alt="chatrAI" className="w-full h-full object-cover" />
          </div>
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-2xl bg-violet-500/20 animate-ping" style={{ animationDuration: '3s' }} />
        </div>

        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-black text-white tracking-tight capitalize leading-none">
              {greeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-300">{userName}</span> 👋
            </h1>
            {/* Live clock pill */}
            {currentTime && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-white/[0.07] border border-white/[0.12] px-3 py-1.5 rounded-full font-mono text-white/70 backdrop-blur-md shadow-sm">
                <Clock className="w-3.5 h-3.5 text-violet-400" />
                {currentTime}
              </span>
            )}
          </div>
          {currentDate && (
            <p className="text-sm text-white/40 mt-1.5 font-medium">{currentDate} — Here's what's happening in your workspace.</p>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0 mt-1">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.10] text-white/70 hover:text-white text-sm font-semibold border border-white/[0.08] hover:border-white/[0.15] transition-all"
        >
          Customize
        </button>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>
    </div>
  );
};
