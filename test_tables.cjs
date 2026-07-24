const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function check() {
  // Try querying a few possible table names
  const queries = ['tasks', 'workspace_tasks', 'conversation_tasks', 'notes', 'calendar_events', 'decisions'];
  
  for (const table of queries) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`Table ${table}: ERROR - ${error.message}`);
    } else {
      console.log(`Table ${table}: EXISTS`);
    }
  }
}
check();
