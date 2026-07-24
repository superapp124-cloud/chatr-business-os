import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL or Key not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- CONNECTING TO SUPABASE ---');
  console.log('URL:', supabaseUrl);

  // 1. Fetch recent FCM delivery logs
  console.log('\n--- RECENT FCM DELIVERY LOGS ---');
  try {
    const { data: logs, error: logsError } = await supabase
      .from('fcm_delivery_logs')
      .select('*')
      .limit(10);

    if (logsError) {
      console.error('Error fetching logs:', logsError);
    } else if (!logs || logs.length === 0) {
      console.log('No FCM delivery logs found.');
    } else {
      logs.forEach(log => {
        console.log(`- Call: ${log.call_id}`);
        console.log(`  Receiver: ${log.receiver_id} | Caller: ${log.caller_id}`);
        console.log(`  Tokens Found: ${log.tokens_found} | Sent: ${log.tokens_sent} | Failed: ${log.tokens_failed}`);
        console.log(`  Status: ${log.fcm_status}`);
        if (log.fcm_error) console.log(`  Error: ${log.fcm_error}`);
        console.log(`  Latency: ${log.delivery_latency_ms}ms`);
        console.log(`  Created: ${log.created_at}`);
      });
    }
  } catch (err) {
    console.error('Unexpected error fetching logs:', err);
  }

  // 2. Fetch recent device tokens
  console.log('\n--- ACTIVE DEVICE TOKENS ---');
  try {
    const { data: tokens, error: tokensError } = await supabase
      .from('device_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
    } else if (!tokens || tokens.length === 0) {
      console.log('No device tokens found.');
    } else {
      tokens.forEach(t => {
        console.log(`- User: ${t.user_id}`);
        console.log(`  Token: ${t.device_token}`);
        console.log(`  Platform: ${t.platform}`);
        console.log(`  Last Used: ${t.last_used_at}`);
        console.log(`  Created: ${t.created_at}`);
      });
    }
  } catch (err) {
    console.error('Unexpected error fetching tokens:', err);
  }
}

run();
