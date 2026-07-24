async function getMessagesSchema() {
  const url = 'https://cenxckpxaqborfqyexot.supabase.co/rest/v1/';
  const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbnhja3B4YXFib3JmcXlleG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NzU1NzQsImV4cCI6MjA5ODU1MTU3NH0.rCmVgQbMVIzG0h5nmDniHZpJtK9VUfW1mGO40VY_MZE';
  
  try {
    const res = await fetch(url, {
      headers: { apikey }
    });
    const json = await res.json();
    console.log(Object.keys(json));
    if (json.definitions) console.log(Object.keys(json.definitions).includes('messages') ? 'messages in definitions' : 'messages not in definitions');
    if (json.components?.schemas) console.log(Object.keys(json.components.schemas).includes('messages') ? 'messages in schemas' : 'messages not in schemas');
    if (json.paths) console.log(Object.keys(json.paths).includes('/messages') ? 'messages in paths' : 'messages not in paths');
    // Let's print out the definition of messages if we find it
    if (json.definitions?.messages) {
      console.log("messages columns:");
      console.log(Object.keys(json.definitions.messages.properties).join(', '));
    } else if (json.components?.schemas?.messages) {
      console.log("messages columns:");
      console.log(Object.keys(json.components.schemas.messages.properties).join(', '));
    }
  } catch (err) {
    console.error(err);
  }
}

getMessagesSchema();
