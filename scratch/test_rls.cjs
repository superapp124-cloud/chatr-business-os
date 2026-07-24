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

async function testQuery() {
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
  
  // Wait a second for profile trigger to run
  await new Promise(r => setTimeout(r, 1000));
  
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('*').limit(5);
  console.log('Profiles read error:', profileError);
  console.log('Profiles returned count:', profiles?.length);

  const { data: stories, error: storyError } = await supabase.from('stories').select('*').limit(5);
  console.log('Stories read error:', storyError);
  console.log('Stories returned count:', stories?.length);
}

testQuery();
