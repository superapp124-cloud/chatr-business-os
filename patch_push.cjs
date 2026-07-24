const fs = require('fs');
let content = fs.readFileSync('src/hooks/useChatPushNotifications.tsx', 'utf8');

const target = `            // Save token to Firestore users collection
            const firebaseImport = await import('@/firebase');
            const firestoreImport = await import('firebase/firestore');
            const db = firebaseImport.db;
            const docFunc = firestoreImport.doc;
            const setDocFunc = firestoreImport.setDoc;
            
            await setDocFunc(docFunc(db, 'users', userId), {
              fcmToken: token,
              lastUpdated: new Date().toISOString()
            }, { merge: true });`;

const replacement = `            // Fetch user settings first
            const { data: settings } = await supabase
              .from('user_settings')
              .select('push_notifications')
              .eq('user_id', userId)
              .maybeSingle();

            const firebaseImport = await import('@/firebase');
            const firestoreImport = await import('firebase/firestore');
            const db = firebaseImport.db;
            const docFunc = firestoreImport.doc;
            const setDocFunc = firestoreImport.setDoc;

            if (settings && settings.push_notifications === false) {
              console.log('✅ Push notifications disabled in settings. Removing FCM token.');
              await setDocFunc(docFunc(db, 'users', userId), {
                fcmToken: null,
                lastUpdated: new Date().toISOString()
              }, { merge: true });
              return;
            }

            // Save token to Firestore users collection
            await setDocFunc(docFunc(db, 'users', userId), {
              fcmToken: token,
              lastUpdated: new Date().toISOString()
            }, { merge: true });`;

content = content.replace(target, replacement);

fs.writeFileSync('src/hooks/useChatPushNotifications.tsx', content);
console.log('useChatPushNotifications patched.');
