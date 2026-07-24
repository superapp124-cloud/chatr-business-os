import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/Arshid.Wani/chatrchat/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('Listening to calls table...');

supabase.channel('monitor-calls')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, (payload) => {
    console.log('🔔 DB EVENT on calls:', payload);
  })
  .subscribe((status) => {
    console.log('Subscription status:', status);
  });

// keep alive
setInterval(() => {}, 10000);
