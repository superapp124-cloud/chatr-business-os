import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('webrtc_signals').select('*').order('created_at', { ascending: false }).limit(20);
  if (error) console.error(error);
  else console.log(data.map(d => d.signal_type + ' from ' + d.from_user.substring(0,8) + ' to ' + d.to_user.substring(0,8)));
}

run();
