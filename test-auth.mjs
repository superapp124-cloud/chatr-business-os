import { createClient } from '@supabase/supabase-js';

import fs from 'fs';
import dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.desktop'));

const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbnhja3B4YXFib3JmcXlleG90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk3NTU3NCwiZXhwIjoyMDk4NTUxNTc0fQ.5jHOfbdPEL9H0WdAFyGdKtnXwos5Si_nDv8SRHQxqkM';
const supabase = createClient(envConfig.VITE_SUPABASE_URL, serviceRoleKey);

async function test() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: '919999999999@chatr.chat',
    password: '+919999999999',
    email_confirm: true,
  });
  console.log('Result:', data.user ? 'Success' : 'Fail');
  if (error) console.log('Error:', error);
  if (data.user) console.log('User ID:', data.user.id);
}

test();
