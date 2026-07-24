import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.desktop'));

const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbnhja3B4YXFib3JmcXlleG90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk3NTU3NCwiZXhwIjoyMDk4NTUxNTc0fQ.5jHOfbdPEL9H0WdAFyGdKtnXwos5Si_nDv8SRHQxqkM';
const adminClient = createClient(envConfig.VITE_SUPABASE_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function cleanup() {
  console.log('Fetching users to clean up...');
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  
  if (error) {
    console.error('Failed to list users:', error);
    return;
  }

  const usersToDelete = data.users.filter(u => 
    u.email?.endsWith('@chatr.local') || 
    u.email?.endsWith('@chatr.chat')
  );

  console.log(`Found ${usersToDelete.length} fake email accounts to delete.`);

  for (const user of usersToDelete) {
    console.log(`Deleting ${user.email}...`);
    await adminClient.auth.admin.deleteUser(user.id);
  }

  console.log('Cleanup complete!');
}

cleanup();
