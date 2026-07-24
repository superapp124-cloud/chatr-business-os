/**
 * ULTRA-OPTIMIZED SERVICE WORKER v8
 * 10x faster loading through aggressive caching strategies
 */

// Cache version - increment to force update
const CACHE_NAME = 'chatr-cache-v8';
const RUNTIME_CACHE = 'chatr-runtime-v8';
const IMAGE_CACHE = 'chatr-images-v8';
const API_CACHE = 'chatr-api-v8';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

const LOCAL_APP_HOSTS = new Set(['localhost', '127.0.0.1']);

const getAppShellResponse = async () => {
  const cachedIndex = await caches.match('/index.html') || await caches.match('/');
  if (cachedIndex) return cachedIndex;

  try {
    const indexResponse = await fetch('/index.html', { cache: 'no-store' });
    if (indexResponse && indexResponse.ok) return indexResponse;
  } catch {
    // Fall through to the tiny recovery document below.
  }

  return new Response(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script>location.replace("/");</script></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
};

// Install event - force immediate update
self.addEventListener('install', (event) => {
  console.log('SW v8 installing... forcefully skipping waiting');
  self.skipWaiting(); // FORCE UPDATE
});

// Activate event - clean up ALL old caches aggressively
self.addEventListener('activate', (event) => {
  console.log('SW v8 activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - NETWORK FIRST FOR EVERYTHING to prevent aggressive caching bugs
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;
  if (!url.protocol.startsWith('http')) return;

  // ALWAYS Network First
  event.respondWith(
    fetch(request)
      .then(response => {
        if (!response || !response.ok) throw new Error('Fetch failed');
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Background Sync - handle offline messages
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-contacts') {
    event.waitUntil(syncContacts());
  }
});

// Periodic Background Sync - check for updates
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync triggered:', event.tag);
  
  // Use simple tag name
  if (event.tag === 'sync') {
    event.waitUntil(performDailySync());
  }
});

// Push Notification Handler - Enhanced for Calls and Messages (when app is killed)
self.addEventListener('push', (event) => {
  console.log('📲 Push notification received (app may be killed)');
  
  let notificationOptions = {
    icon: '/chatr-logo.png',
    badge: '/chatr-logo.png',
    vibrate: [200, 100, 200],
    tag: 'chatr-notification',
    requireInteraction: false,
    renotify: true,
    data: { url: '/' }
  };

  let title = 'Chatr';

  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📲 Push data:', JSON.stringify(data));
      
      // Handle INCOMING CALL notifications - HIGHEST priority
      if (data.type === 'call' || data.call_id) {
        const callerName = data.caller_name || data.callerName || 'Incoming Call';
        const callType = data.call_type || data.callType || 'voice';
        const callId = data.call_id || data.callId || Date.now().toString();
        
        title = callerName;
        notificationOptions = {
          body: callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call',
          icon: data.caller_avatar || data.callerAvatar || '/chatr-logo.png',
          tag: 'chatr-call-' + callId,
          requireInteraction: true, // Keep notification until user acts
          vibrate: [500, 200, 500, 200, 500, 200, 500], // Long vibration for calls
          renotify: true,
          actions: [
            { action: 'answer', title: '✓ Answer', icon: '/icons/answer.png' },
            { action: 'reject', title: '✗ Decline', icon: '/icons/reject.png' }
          ],
          data: {
            type: 'call',
            callId: callId,
            callerId: data.caller_id || data.callerId,
            callerName: callerName,
            callType: callType,
            url: '/chat?answerCall=' + callId
          }
        };
        console.log('📞 INCOMING CALL notification created for:', callerName);
      }
      // Handle MESSAGE notifications
      else if (data.type === 'message' || data.conversation_id) {
        let senderName = 'New Message';
        let messageContent = 'You have a new message';
        let senderAvatar = '/chatr-logo.png';
        const conversationId = data.conversation_id || data.conversationId || '';
        
        // Parse sender from JSON string if present
        try {
          if (data.sender && typeof data.sender === 'string') {
            const senderObj = JSON.parse(data.sender);
            senderName = senderObj.username || senderObj.name || 'New Message';
            senderAvatar = senderObj.avatar_url || '/chatr-logo.png';
          } else if (data.senderName) {
            senderName = data.senderName;
          }
          
          if (data.message && typeof data.message === 'string') {
            const msgObj = JSON.parse(data.message);
            messageContent = msgObj.content || 'You have a new message';
          } else if (data.messageContent) {
            messageContent = data.messageContent;
          }
        } catch (e) {
          console.log('Error parsing sender/message:', e);
          senderName = data.senderName || data.sender_name || 'New Message';
          messageContent = data.messageContent || data.message_content || data.body || 'You have a new message';
        }
        
        title = senderName;
        notificationOptions = {
          body: messageContent,
          icon: senderAvatar,
          tag: 'chatr-msg-' + conversationId,
          renotify: true,
          actions: [
            { action: 'reply', title: 'Reply' },
            { action: 'view', title: 'View' }
          ],
          data: {
            type: 'message',
            conversationId: conversationId,
            url: '/chat/' + conversationId
          }
        };
        console.log('💬 MESSAGE notification created for:', senderName);
      }
      // Generic notification
      else {
        title = data.title || title;
        notificationOptions.body = data.body || data.message || 'You have a new notification';
        notificationOptions.data = data;
      }
    } catch (e) {
      console.error('Error parsing push data:', e);
      notificationOptions.body = event.data.text() || 'You have a new notification';
    }
  }

  console.log('📲 Showing notification:', title, notificationOptions);
  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// Notification Click Handler - Enhanced for Calls
self.addEventListener('notificationclick', (event) => {
  console.log('📲 Notification clicked:', event.action);
  event.notification.close();

  const data = event.notification.data || {};
  let urlToOpen = data.url || '/';

  // Handle call notification actions
  if (data.type === 'call') {
    if (event.action === 'answer') {
      urlToOpen = '/chat?answerCall=' + data.callId;
    } else if (event.action === 'reject') {
      // Just close notification, reject handled by app
      return;
    }
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-contacts') {
    event.waitUntil(syncContacts());
  }
});

// Periodic Background Sync - check for updates
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync triggered:', event.tag);
  
  // Use simple tag name
  if (event.tag === 'sync') {
    event.waitUntil(performDailySync());
  }
});

// Push Notification Handler - Enhanced for Calls and Messages (when app is killed)
self.addEventListener('push', (event) => {
  console.log('📲 Push notification received (app may be killed)');
  
  let notificationOptions = {
    icon: '/chatr-logo.png',
    badge: '/chatr-logo.png',
    vibrate: [200, 100, 200],
    tag: 'chatr-notification',
    requireInteraction: false,
    renotify: true,
    data: { url: '/' }
  };

  let title = 'Chatr';

  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📲 Push data:', JSON.stringify(data));
      
      // Handle INCOMING CALL notifications - HIGHEST priority
      if (data.type === 'call' || data.call_id) {
        const callerName = data.caller_name || data.callerName || 'Incoming Call';
        const callType = data.call_type || data.callType || 'voice';
        const callId = data.call_id || data.callId || Date.now().toString();
        
        title = callerName;
        notificationOptions = {
          body: callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call',
          icon: data.caller_avatar || data.callerAvatar || '/chatr-logo.png',
          tag: 'chatr-call-' + callId,
          requireInteraction: true, // Keep notification until user acts
          vibrate: [500, 200, 500, 200, 500, 200, 500], // Long vibration for calls
          renotify: true,
          actions: [
            { action: 'answer', title: '✓ Answer', icon: '/icons/answer.png' },
            { action: 'reject', title: '✗ Decline', icon: '/icons/reject.png' }
          ],
          data: {
            type: 'call',
            callId: callId,
            callerId: data.caller_id || data.callerId,
            callerName: callerName,
            callType: callType,
            url: '/chat?answerCall=' + callId
          }
        };
        console.log('📞 INCOMING CALL notification created for:', callerName);
      }
      // Handle MESSAGE notifications
      else if (data.type === 'message' || data.conversation_id) {
        let senderName = 'New Message';
        let messageContent = 'You have a new message';
        let senderAvatar = '/chatr-logo.png';
        const conversationId = data.conversation_id || data.conversationId || '';
        
        // Parse sender from JSON string if present
        try {
          if (data.sender && typeof data.sender === 'string') {
            const senderObj = JSON.parse(data.sender);
            senderName = senderObj.username || senderObj.name || 'New Message';
            senderAvatar = senderObj.avatar_url || '/chatr-logo.png';
          } else if (data.senderName) {
            senderName = data.senderName;
          }
          
          if (data.message && typeof data.message === 'string') {
            const msgObj = JSON.parse(data.message);
            messageContent = msgObj.content || 'You have a new message';
          } else if (data.messageContent) {
            messageContent = data.messageContent;
          }
        } catch (e) {
          console.log('Error parsing sender/message:', e);
          senderName = data.senderName || data.sender_name || 'New Message';
          messageContent = data.messageContent || data.message_content || data.body || 'You have a new message';
        }
        
        title = senderName;
        notificationOptions = {
          body: messageContent,
          icon: senderAvatar,
          tag: 'chatr-msg-' + conversationId,
          renotify: true,
          actions: [
            { action: 'reply', title: 'Reply' },
            { action: 'view', title: 'View' }
          ],
          data: {
            type: 'message',
            conversationId: conversationId,
            url: '/chat/' + conversationId
          }
        };
        console.log('💬 MESSAGE notification created for:', senderName);
      }
      // Generic notification
      else {
        title = data.title || title;
        notificationOptions.body = data.body || data.message || 'You have a new notification';
        notificationOptions.data = data;
      }
    } catch (e) {
      console.error('Error parsing push data:', e);
      notificationOptions.body = event.data.text() || 'You have a new notification';
    }
  }

  console.log('📲 Showing notification:', title, notificationOptions);
  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// Notification Click Handler - Enhanced for Calls
self.addEventListener('notificationclick', (event) => {
  console.log('📲 Notification clicked:', event.action);
  event.notification.close();

  const data = event.notification.data || {};
  let urlToOpen = data.url || '/';

  // Handle call notification actions
  if (data.type === 'call') {
    if (event.action === 'answer') {
      urlToOpen = '/chat?answerCall=' + data.callId;
    } else if (event.action === 'reject') {
      // Just close notification, reject handled by app
      return;
    }
  }
  
  // Handle message notification actions
  if (data.type === 'message') {
    if (event.action === 'reply' || event.action === 'view') {
      urlToOpen = '/chat/' + data.conversationId;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Focus existing window if available
        for (let client of windowClients) {
          if ('focus' in client) {
            client.focus();
            // Navigate to the correct URL
            client.postMessage({
              type: 'NAVIGATE',
              url: urlToOpen,
              callData: data.type === 'call' ? data : null
            });
            return;
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message handler for communication with app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then(cache => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

// Helper Functions

async function syncMessages() {
  try {
    const db = await openDB();
    const tx = db.transaction('pending_messages', 'readonly');
    const store = tx.objectStore('pending_messages');
    const messages = await store.getAll();
    
    for (const message of messages) {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
        
        if (response.ok) {
          const deleteTx = db.transaction('pending_messages', 'readwrite');
          const deleteStore = deleteTx.objectStore('pending_messages');
          await deleteStore.delete(message.id);
        }
      } catch (error) {
        console.error('Failed to sync message:', error);
      }
    }
  } catch (error) {
    console.error('Sync messages failed:', error);
  }
}

async function syncContacts() {
  try {
    console.log('Syncing contacts...');
    // Implement contact sync logic
  } catch (error) {
    console.error('Sync contacts failed:', error);
  }
}

async function performDailySync() {
  try {
    console.log('Performing daily sync...');
    await Promise.all([
      syncMessages(),
      syncContacts(),
      checkNewMessages()
    ]);
  } catch (error) {
    console.error('Daily sync failed:', error);
  }
}

async function checkNewMessages() {
  try {
    const response = await fetch('/api/messages/check');
    if (response.ok) {
      const data = await response.json();
      if (data.hasNew) {
        await self.registration.showNotification('Chatr', {
          body: 'You have new messages',
          icon: '/chatr-logo.png',
          badge: '/chatr-logo.png'
        });
      }
    }
  } catch (error) {
    console.error('Check messages failed:', error);
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatrDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending_messages')) {
        db.createObjectStore('pending_messages', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}
