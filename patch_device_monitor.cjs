const fs = require('fs');
let content = fs.readFileSync('src/hooks/useNativeAppInitialization.tsx', 'utf8');

const target = `            console.log('✅ Device session registered');
            persistDeviceCapabilities().catch(() => {});`;

const replacement = `            console.log('✅ Device session registered');
            
            // Subscribe to device_sessions changes to auto-logout if session is revoked
            supabase.channel(\`device-session-\${fingerprint}\`)
              .on(
                'postgres_changes',
                {
                  event: 'UPDATE',
                  schema: 'public',
                  table: 'device_sessions',
                  filter: \`device_fingerprint=eq.\${fingerprint}\`
                },
                (payload) => {
                  if (payload.new && payload.new.is_active === false) {
                    console.log('Device session was revoked remotely. Logging out...');
                    supabase.auth.signOut().then(() => {
                      window.location.href = '/auth';
                    });
                  }
                }
              )
              .subscribe();

            persistDeviceCapabilities().catch(() => {});`;

// Let's also check for different console log emojis just in case
let replaced = content.replace(target, replacement);

if (replaced === content) {
  // try regex to match the lines regardless of emoji
  const regex = /console\.log\([^)]*Device session registered[^)]*\);\s*persistDeviceCapabilities\(\)\.catch\(\(\) => \{\}\);/g;
  replaced = content.replace(regex, replacement);
}

fs.writeFileSync('src/hooks/useNativeAppInitialization.tsx', replaced);
console.log('Done modifying useNativeAppInitialization.tsx');
