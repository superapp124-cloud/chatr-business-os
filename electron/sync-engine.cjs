const log = require('electron-log');
const { getToken } = require('./token-vault.cjs');

// Minimal mock sync implementation for when real API keys aren't present
function mockSyncGoogle() {
  const now = new Date();
  
  // Format times nicely for the UI
  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const in30Mins = new Date(now.getTime() + 30 * 60000);
  const in1Hour = new Date(now.getTime() + 60 * 60000);

  return [
    {
      id: 'mock-cal-1',
      title: 'Design Review: Desktop App',
      time: formatTime(in30Mins),
      category: 'Meeting',
      detail: 'Google Meet',
      icon: 'calendar'
    },
    {
      id: 'mock-mail-1',
      title: 'Invoice #1024 Approved',
      time: formatTime(now),
      category: 'Finance',
      detail: 'finance@chatr.chat',
      icon: 'mail'
    },
    {
      id: 'mock-cal-2',
      title: 'Engineering Sync',
      time: formatTime(in1Hour),
      category: 'Meeting',
      detail: 'Google Meet',
      icon: 'calendar'
    },
    {
      id: 'mock-mail-2',
      title: 'Pull Request: Smart Inbox Sync',
      time: '1 hour ago',
      category: 'GitHub Notifications',
      detail: 'github.com',
      icon: 'mail'
    }
  ];
}

async function syncGoogle(token) {
  const isMock = process.env.VITE_GOOGLE_MOCK === 'true' || !process.env.GOOGLE_CLIENT_ID;
  if (isMock) {
    log.info('[SyncEngine] Running Google sync in MOCK mode');
    return mockSyncGoogle();
  }

  log.info('[SyncEngine] Running REAL Google sync');
  try {
    const items = [];
    const headers = { Authorization: `Bearer ${token.access_token}` };

    // 1. Fetch recent Gmail messages (mocking parsing for brevity without googleapis client)
    const mailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3', { headers });
    if (mailRes.ok) {
      const mailData = await mailRes.json();
      if (mailData.messages) {
        for (const msg of mailData.messages) {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, { headers });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            const subject = detailData.payload.headers.find(h => h.name === 'Subject')?.value || 'No Subject';
            const from = detailData.payload.headers.find(h => h.name === 'From')?.value || 'Unknown';
            
            items.push({
              id: `gmail-${msg.id}`,
              title: subject,
              time: 'Just now', // Ideally format detailData.internalDate
              category: 'Email',
              detail: from,
              icon: 'mail'
            });
          }
        }
      }
    } else {
      log.warn('[SyncEngine] Gmail fetch failed:', mailRes.statusText);
    }

    // 2. Fetch upcoming Calendar events
    const timeMin = new Date().toISOString();
    const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=3&singleEvents=true&orderBy=startTime`, { headers });
    if (calRes.ok) {
      const calData = await calRes.json();
      if (calData.items) {
        for (const event of calData.items) {
          const startTime = new Date(event.start.dateTime || event.start.date);
          items.push({
            id: `cal-${event.id}`,
            title: event.summary || 'Busy',
            time: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: 'Meeting',
            detail: 'Calendar Event',
            icon: 'calendar'
          });
        }
      }
    } else {
      log.warn('[SyncEngine] Calendar fetch failed:', calRes.statusText);
    }

    // Sort combined items if needed, for now just return
    return items;
  } catch (err) {
    log.error('[SyncEngine] Real sync failed, falling back to mock:', err.message);
    return mockSyncGoogle();
  }
}

/**
 * Runs a sync for a given provider and returns the synced items array.
 * @param {string} providerId 
 */
async function runSync(providerId) {
  log.info(`[SyncEngine] Starting sync for provider: ${providerId}`);
  
  const token = getToken(providerId);
  if (!token) {
    log.warn(`[SyncEngine] No token found for ${providerId}. Attempting mock sync if available.`);
    if (providerId === 'google') return mockSyncGoogle();
    return [];
  }

  if (providerId === 'google') {
    return await syncGoogle(token);
  }

  // Add more providers here (microsoft, slack, etc)
  return [];
}

module.exports = {
  runSync
};
