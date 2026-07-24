import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sbayuqgomlflmxgicplz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiYXl1cWdvbWxmbG14Z2ljcGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTc2MDAsImV4cCI6MjA3NDk5MzYwMH0.gVSObpMtsv5W2nuLBHKT8G1_hXIprWXdn5l7Bnnj7jw';

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  console.log("Fetching messages columns...");
  const { data, error } = await supabase
    .from('messages')
    .select('message_type')
    .limit(1);
    
  if (error) {
    console.error("Error fetching messages:", JSON.stringify(error, null, 2));
  } else {
    console.log("Success! Data:", JSON.stringify(data, null, 2));
  }
}

run();
