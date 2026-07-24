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
  const testEmail = `test2_${Date.now()}@example.com`;
  const testPassword = 'SupabaseStrong_2026_!@#';
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpError) {
    console.error('Sign up failed:', signUpError);
    return;
  }
  
  const token = signUpData.session.access_token;
  
  // Use a client with the access token
  const authSupabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Querying profiles...');
  const { data: profiles, error: profileError } = await authSupabase.from('profiles').select('*').limit(5);
  console.log('Profiles error:', profileError);
  console.log('Profiles returned:', profiles?.length);

  console.log('Querying stories...');
  const { data: stories, error: storyError } = await authSupabase.from('stories').select('*').limit(5);
  console.log('Stories error:', storyError);
  console.log('Stories returned:', stories?.length);
}

testQuery();
