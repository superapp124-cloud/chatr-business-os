async function testDumper() {
  try {
    const res = await fetch('https://cenxckpxaqborfqyexot.supabase.co/functions/v1/schema-dumper', {
      method: 'POST'
    });
    const json = await res.json();
    console.log(json);
  } catch (err) {
    console.error(err);
  }
}
testDumper();
