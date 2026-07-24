import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This endpoint is designed to be called by Twilio when a call comes in.
serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Webhooks from Twilio won't have the user's JWT
    );

    // Parse the form data sent by Twilio
    const formData = await req.formData();
    const from = formData.get("From")?.toString() || "+10000000000";
    const to = formData.get("To")?.toString() || "+18005550199";
    const callStatus = formData.get("CallStatus")?.toString() || "completed";

    // 1. Look up the business profile by the 'to' number (assuming it's their company line)
    // For this demonstration, we'll just grab the first profile since it's a dev environment.
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .limit(1)
      .single();

    if (!profile) {
      const emptyTwiML = `<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`;
      return new Response(emptyTwiML, { status: 200, headers: { "Content-Type": "text/xml" } });
    }

    // 2. Log the incoming call to business_call_logs
    await supabaseClient
      .from("business_call_logs")
      .insert([{
        profile_id: profile.id,
        caller_number: from,
        receiver_number: to,
        direction: "inbound",
        status: callStatus === "completed" ? "completed" : "missed",
        duration_seconds: Math.floor(Math.random() * 120) // Mock duration
      }]);

    // 3. Generate IVR TwiML
    // If we had a specific IVR workflow active, we'd parse its nodes here.
    // For now, we generate a standard dynamic IVR greeting.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather numDigits="1" action="/business-ivr-webhook/handle-gather" method="POST">
        <Say voice="alice">Welcome to Chatr Business. Please press 1 for Sales, or 2 for Support.</Say>
    </Gather>
    <Say voice="alice">We didn't receive any input. Goodbye!</Say>
</Response>`;

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error: any) {
    console.error("IVR Webhook Error:", error);
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An application error has occurred.</Say></Response>`;
    return new Response(errorTwiML, {
      status: 500,
      headers: { "Content-Type": "text/xml" },
    });
  }
});
