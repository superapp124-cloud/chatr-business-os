const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*["']?([^"'\r\n]+)["']?/);
  if (match) {
    env[match[1]] = match[2];
  }
});

console.log('Parsed Env Keys:', Object.keys(env));
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
console.log('Using URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, status, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching profiles:', error);
      return;
    }

    console.log(`\nFound ${profiles ? profiles.length : 0} profiles:`);
    console.log('--- Database Profiles & Status Notes ---');
    profiles.forEach(p => {
      console.log(`User: ${p.full_name || p.username} (@${p.username}) [ID: ${p.id}]`);
      console.log(`Status Note: ${p.status ? '"' + p.status + '"' : '[Empty]'}`);
      console.log(`Last Updated: ${p.updated_at}`);
      console.log('----------------------------------------');
    });
  } catch (err) {
    console.error('Failed to run query:', err);
  }
}

checkProfiles();
