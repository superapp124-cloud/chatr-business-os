const fs = require('fs');
let content = fs.readFileSync('src/hooks/useRealtimeNotifications.tsx', 'utf8');

const target1 = `    let userNotificationTone = '/notification.mp3';

    // Get user's preferred notification tone
    const getUserTone = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('notification_tone')
        .eq('id', userId)
        .single();
      
      if (data?.notification_tone) {
        userNotificationTone = data.notification_tone;
      }
    };

    getUserTone();`;

const replacement1 = `    let userNotificationTone = '/notification.mp3';
    let messageNotificationsEnabled = true;

    // Get user's preferred notification tone and settings
    const getUserSettings = async () => {
      const [
        { data: profileData },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('profiles').select('notification_tone').eq('id', userId).maybeSingle(),
        supabase.from('user_settings').select('message_notifications').eq('user_id', userId).maybeSingle()
      ]);
      
      if (profileData?.notification_tone) {
        userNotificationTone = profileData.notification_tone;
      }
      
      if (settingsData && settingsData.message_notifications === false) {
        messageNotificationsEnabled = false;
      }
    };

    getUserSettings();`;

const target2 = `          if (isForCurrentUser && !isFromActiveConversation) {`;
const replacement2 = `          if (isForCurrentUser && !isFromActiveConversation && messageNotificationsEnabled) {`;

content = content.replace(target1, replacement1);
content = content.replace(target2, replacement2);

fs.writeFileSync('src/hooks/useRealtimeNotifications.tsx', content);
console.log('useRealtimeNotifications patched.');
