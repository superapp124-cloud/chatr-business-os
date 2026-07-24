import { createClient } from '@supabase/supabase-js';

import fs from 'fs';
import dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.desktop'));

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: '919717845477@chatr.chat',
    password: '+919717845477',
  });
  console.log('Result:', data.user ? 'Success' : 'Fail');
  if (error) console.log('Error:', error);
}

test();
