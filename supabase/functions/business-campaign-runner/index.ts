import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This edge function simulates running a mass broadcast campaign.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { campaignId } = await req.json();

    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch the campaign
    const { data: campaign, error } = await supabaseClient
      .from("business_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (error || !campaign) {
      throw error || new Error("Campaign not found");
    }

    // 2. Mark as running
    await supabaseClient
      .from("business_campaigns")
      .update({ status: "running" })
      .eq("id", campaignId);

    // 3. Simulate processing audience and sending messages.
    // In production, you would fetch `business_customers` matching the `audience_segment`,
    // batch them, and call SendGrid/Twilio APIs for each.
    
    // We simulate a 2-second processing time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Calculate mock metrics based on audience segment (just for demo purposes)
    const totalAudience = campaign.audience_segment === "all" ? 1542 : 380;
    const sentCount = totalAudience;
    const openCount = Math.floor(totalAudience * 0.45); // 45% open rate
    const clickCount = Math.floor(openCount * 0.2); // 20% click rate

    // 4. Mark as completed with final metrics
    await supabaseClient
      .from("business_campaigns")
      .update({ 
        status: "completed",
        sent_count: sentCount,
        open_count: openCount,
        click_count: clickCount,
        updated_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Campaign ${campaignId} completed successfully`,
      metrics: { sentCount, openCount, clickCount }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
