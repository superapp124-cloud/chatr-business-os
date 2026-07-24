import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL as string, process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);

async function test() {
  console.log("Checking calls count...");
  const { data: calls } = await supabase.from('calls').select('*');
  console.log("Total Calls:", calls?.length);
  
  if (calls && calls.length > 0) {
    console.log("Sample Call:", calls[0]);
  }

  console.log("\nChecking messages count...");
  const { data: msgs } = await supabase.from('messages').select('*');
  console.log("Total Messages:", msgs?.length);
}

test();
