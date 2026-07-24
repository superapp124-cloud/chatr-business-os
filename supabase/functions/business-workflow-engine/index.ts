/**
 * business-workflow-engine — Supabase Edge Function
 *
 * STATUS: NON-AUTHORITATIVE FOR STUDIO EXECUTION
 * Phase A decision: ADR-A1 (docs/ADR/ADR-A1-authoritative-runtime-selection.md)
 *
 * This Edge Function is NOT the authoritative execution runtime for the Studio route (/desktop/studio).
 * Studio executions go through AutomationOS/RuntimeAdapter (LocalBrowserRuntime).
 *
 * This function is RETAINED for:
 *   - Future background / scheduled workflow triggers
 *   - Webhook-based trigger entry points that need a server-side receiver
 *   - Potential worker-queue execution path (Phase A.5+)
 *
 * Do NOT call this function from handleTestRun() or any Studio execution path.
 * Do NOT add new execution logic here until the authoritative runtime (Phase A.5) is stable.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    const { workflowId, payload } = await req.json();

    if (!workflowId) {
      return new Response(JSON.stringify({ error: "workflowId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch the workflow
    const { data: workflow, error } = await supabaseClient
      .from("business_workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (error || !workflow) {
      throw error || new Error("Workflow not found");
    }

    if (workflow.status !== "active") {
      return new Response(JSON.stringify({ message: "Workflow is not active, skipping execution." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse nodes and edges
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];

    const triggerNode = nodes.find((n: any) => n.type === "trigger");
    if (!triggerNode) {
      throw new Error("Workflow has no trigger node");
    }

    // Simple Breadth-First traversal simulator for demonstration
    const executionLog = [];
    let currentNodeId = triggerNode.id;
    let maxSteps = 10;
    
    while (currentNodeId && maxSteps > 0) {
      const node = nodes.find((n: any) => n.id === currentNodeId);
      if (!node) break;

      executionLog.push({ nodeId: node.id, type: node.type, label: node.data?.label });

      // Simulate execution based on node type
      if (node.type === "ai_decision") {
        // Normally we would call OpenAI here based on node.data.prompt
        executionLog.push({ action: "AI Decision Executed", prompt: node.data?.prompt });
      } else if (node.type === "action") {
        executionLog.push({ action: "Action Executed", actionName: node.data?.label });
      }

      // Find next edge
      const nextEdge = edges.find((e: any) => e.source === currentNodeId);
      if (nextEdge) {
        currentNodeId = nextEdge.target;
      } else {
        currentNodeId = null;
      }
      maxSteps--;
    }

    // 3. Increment run_count safely via RPC or direct update
    await supabaseClient
      .from("business_workflows")
      .update({ 
        run_count: (workflow.run_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", workflowId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Workflow executed successfully",
      executionLog
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
