import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useDesktopElectronIntegrations(userId: string | undefined) {
  useEffect(() => {
    // Only run if we are in an Electron environment with our API exposed
    if (!window.electronAPI || !userId) return;

    // 1. Initialize Badge Count
    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false);
        
        if (!error && count !== null && window.electronAPI) {
          window.electronAPI.setBadgeCount(count);
        }
      } catch (err) {
        // Silently ignore schema mismatch errors if table not migrated
      }
    };

    fetchUnreadCount();

    // 2. Subscribe to new notifications to update badge dynamically
    const channel = supabase.channel('desktop-badge-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${userId}` 
      }, () => {
        // Re-calculate unread count when anything changes
        fetchUnreadCount();
      })
      .subscribe();

    // 3. Listen for Global Shortcuts
    if (window.electronAPI.onGlobalShortcut) {
      window.electronAPI.onGlobalShortcut(() => {
        // Find the ChatrConsole input and focus it
        const consoleInput = document.getElementById('chatr-console-input');
        if (consoleInput) {
          consoleInput.focus();
        }
      });
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
