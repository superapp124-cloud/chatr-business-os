import { supabase } from './src/integrations/supabase/client';

async function checkRpc() {
  const { data, error } = await supabase.rpc('sync_user_contacts', {
    user_uuid: '00000000-0000-0000-0000-000000000000',
    contact_list: []
  });
  
  if (error) {
    console.error('RPC Error:', error);
    if (error.message.includes('function "sync_user_contacts" does not exist')) {
      console.log('❌ RPC function does not exist!');
    }
  } else {
    console.log('✅ RPC function exists and responded:', data);
  }
}

checkRpc();
