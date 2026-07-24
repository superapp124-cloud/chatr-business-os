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

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStories() {
  try {
    const { data: stories, error } = await supabase
      .from('stories')
      .select('id, user_id, caption, media_type, created_at, expires_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching stories:', error);
      return;
    }

    console.log(`\nFound ${stories ? stories.length : 0} stories:`);
    console.log('--- Database Stories ---');
    stories.forEach(s => {
      console.log(`User ID: ${s.user_id}`);
      console.log(`Caption: ${s.caption}`);
      console.log(`Media Type: ${s.media_type}`);
      console.log(`Created: ${s.created_at}`);
      console.log(`Expires: ${s.expires_at}`);
      console.log(`Is Expired? ${new Date(s.expires_at) < new Date()}`);
      console.log('----------------------------------------');
    });
  } catch (err) {
    console.error('Failed to run query:', err);
  }
}

checkStories();
