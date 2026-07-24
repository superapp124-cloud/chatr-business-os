const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*["']?([^"'\r\n]+)["']?/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsertWorkaround() {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'SupabaseStrong_2026_!@#';
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpError) {
    console.error('Sign up failed:', signUpError);
    return;
  }
  
  const userId = signUpData.user.id;
  
  console.log('Inserting text story using workaround...');
  const { error: insertError } = await supabase.from('stories').insert({
    user_id: userId,
    media_type: 'image', // Workaround for CHECK constraint
    media_url: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', // Workaround for NOT NULL constraint
    caption: JSON.stringify({ captionText: 'This is a text story bypass!', templateId: 'brand-card' }),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  
  if (insertError) {
    console.error('Workaround Insert failed:', insertError);
  } else {
    console.log('Workaround Insert succeeded!');
  }
}

testInsertWorkaround();
