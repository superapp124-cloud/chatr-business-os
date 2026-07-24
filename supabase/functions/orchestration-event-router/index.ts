import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  assertRateLimit,
  errorResponse,
  handleCors,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requireEnum,
  requireMethod,
  requireUser,
  requireUuid,
} from "../_shared/security.ts";

const EVENT_TYPES = [
  "message.received",
  "call.ended",
  "mobile_action.completed",
] as const;

type EventType = typeof EVENT_TYPES[number];
type JsonRecord = Record<string, unknown>;

interface RouterBody extends JsonRecord {
  eventType?: unknown;
  source?: unknown;
  payload?: unknown;
}

function asRecord(value: unknown, fieldName: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_payload", `${fieldName} must be an object`);
  }
  return value as JsonRecord;
}

function optionalUuid(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return null;
  return requireUuid(value, fieldName);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function classifyRecruitmentIntent(text: string) {
  const normalized = text.toLowerCase();
  if (/\b(not interested|no thanks|not looking|decline|remove me)\b/.test(normalized)) {
    return { intent: "negative_response", confidence: 0.86 };
  }

  if (/\b(interested|sounds good|yes|available|let'?s talk|call me|schedule|happy to|looking forward|works for me)\b/.test(normalized)) {
    return { intent: "positive_response", confidence: 0.88 };
  }

  return { intent: "unknown", confidence: 0.55 };
}

async function insertEvent(
  serviceClient: any,
  event: {
    userId: string;
    eventType: string;
    source: string;
    payload: JsonRecord;
    correlationId?: string | null;
    candidateId?: string | null;
    conversationId?: string | null;
    callId?: string | null;
    status?: "received" | "processed" | "failed";
  },
) {
  const { data, error } = await serviceClient
    .from("communication_events")
    .insert({
      user_id: event.userId,
      event_type: event.eventType,
      source: event.source,
      payload: event.payload,
      correlation_id: event.correlationId ?? null,
      candidate_id: event.candidateId ?? null,
      conversation_id: event.conversationId ?? null,
      call_id: event.callId ?? null,
      status: event.status ?? "received",
      processed_at: event.status === "processed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    throw new HttpError(500, "event_insert_failed", error.message);
  }

  return data.id as string;
}

async function queueMobileAction(
  serviceClient: any,
  action: {
    userId: string;
    actionType: "place_call" | "send_message" | "update_workspace";
    payload: JsonRecord;
    candidateId?: string | null;
    conversationId?: string | null;
    callId?: string | null;
    correlationId?: string | null;
  },
) {
  const { data, error } = await serviceClient
    .from("mobile_action_queue")
    .insert({
      user_id: action.userId,
      action_type: action.actionType,
      payload: action.payload,
      candidate_id: action.candidateId ?? null,
      conversation_id: action.conversationId ?? null,
      call_id: action.callId ?? null,
      correlation_id: action.correlationId ?? null,
      status: "pending",
    })
    .select("id, action_type, status")
    .single();

  if (error) {
    throw new HttpError(500, "action_queue_failed", error.message);
  }

  return data;
}

async function handleMessageReceived(
  serviceClient: any,
  userId: string,
  source: string,
  payload: JsonRecord,
  rootEventId: string,
) {
  const content = optionalString(payload.content) ?? optionalString(payload.message) ?? optionalString(payload.body) ?? "";
  const candidateId = optionalUuid(payload.candidateId ?? payload.candidate_id, "candidateId");
  const conversationId = optionalUuid(payload.conversationId ?? payload.conversation_id, "conversationId");
  const phone = optionalString(payload.phone) ?? optionalString(payload.contactPhone);
  const candidateName = optionalString(payload.candidateName) ?? optionalString(payload.contactName);

  const classification = classifyRecruitmentIntent(content);
  const generatedEvents: string[] = [];
  const queuedActions: Array<{ id: string; action_type: string; status: string }> = [];

  const intentEventId = await insertEvent(serviceClient, {
    userId,
    eventType: "intent.classified",
    source: "orchestration-event-router",
    payload: {
      ...classification,
      content,
      sourceEventId: rootEventId,
      candidateId,
    },
    correlationId: rootEventId,
    candidateId,
    conversationId,
    status: "processed",
  });
  generatedEvents.push(intentEventId);

  if (classification.intent === "positive_response" && candidateId) {
    await serviceClient
      .from("candidates")
      .update({
        status: "Call Queued",
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidateId);

    const action = await queueMobileAction(serviceClient, {
      userId,
      actionType: "place_call",
      candidateId,
      conversationId,
      correlationId: rootEventId,
      payload: {
        candidateId,
        candidateName,
        phone,
        reason: "positive_response",
        sourceEventId: rootEventId,
        content,
        consentSignal: "candidate_replied_positive",
      },
    });
    queuedActions.push(action);

    const actionEventId = await insertEvent(serviceClient, {
      userId,
      eventType: "workflow.action_queued",
      source: "orchestration-event-router",
      payload: {
        actionType: "place_call",
        actionId: action.id,
        candidateId,
        reason: "positive_response",
      },
      correlationId: rootEventId,
      candidateId,
      conversationId,
      status: "processed",
    });
    generatedEvents.push(actionEventId);
  }

  return {
    intent: classification.intent,
    confidence: classification.confidence,
    generatedEvents,
    queuedActions,
  };
}

async function handleCallEnded(
  serviceClient: any,
  userId: string,
  source: string,
  payload: JsonRecord,
  rootEventId: string,
) {
  const candidateId = optionalUuid(payload.candidateId ?? payload.candidate_id, "candidateId");
  const conversationId = optionalUuid(payload.conversationId ?? payload.conversation_id, "conversationId");
  const callId = optionalUuid(payload.callId ?? payload.call_id, "callId");
  const outcome = optionalString(payload.outcome) ?? optionalString(payload.outcome_status) ?? "unknown";
  const phone = optionalString(payload.phone) ?? optionalString(payload.contactPhone);
  const candidateName = optionalString(payload.candidateName) ?? optionalString(payload.contactName);
  const generatedEvents: string[] = [];
  const queuedActions: Array<{ id: string; action_type: string; status: string }> = [];

  if (candidateId && outcome === "interview_scheduled") {
    await serviceClient
      .from("candidates")
      .update({
        status: "Interview Scheduled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidateId);

    const workspaceEventId = await insertEvent(serviceClient, {
      userId,
      eventType: "workspace.updated",
      source: "orchestration-event-router",
      payload: {
        candidateId,
        status: "Interview Scheduled",
        outcome,
        sourceEventId: rootEventId,
      },
      correlationId: rootEventId,
      candidateId,
      conversationId,
      callId,
      status: "processed",
    });
    generatedEvents.push(workspaceEventId);

    const messageAction = await queueMobileAction(serviceClient, {
      userId,
      actionType: "send_message",
      candidateId,
      conversationId,
      callId,
      correlationId: rootEventId,
      payload: {
        candidateId,
        candidateName,
        phone,
        template: "interview_confirmation",
        text: "Thanks for speaking with us. Your interview is scheduled, and we will send the details shortly.",
        sourceEventId: rootEventId,
      },
    });
    queuedActions.push(messageAction);

    const messageEventId = await insertEvent(serviceClient, {
      userId,
      eventType: "message.send_queued",
      source,
      payload: {
        actionId: messageAction.id,
        candidateId,
        template: "interview_confirmation",
      },
      correlationId: rootEventId,
      candidateId,
      conversationId,
      callId,
      status: "processed",
    });
    generatedEvents.push(messageEventId);
  }

  return { outcome, generatedEvents, queuedActions };
}

async function handleMobileActionCompleted(
  serviceClient: any,
  payload: JsonRecord,
) {
  const actionId = requireUuid(payload.actionId ?? payload.action_id, "actionId");
  const status = optionalString(payload.status) ?? "completed";
  if (!["completed", "failed"].includes(status)) {
    throw new HttpError(400, "invalid_action_status", "status must be completed or failed");
  }

  const { error } = await serviceClient
    .from("mobile_action_queue")
    .update({
      status,
      completed_at: new Date().toISOString(),
      error_text: optionalString(payload.error) ?? null,
    })
    .eq("id", actionId);

  if (error) {
    throw new HttpError(500, "action_update_failed", error.message);
  }

  return { actionId, status };
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    requireMethod(req, ["POST"]);
    const { user, serviceClient } = await requireUser(req);
    assertRateLimit(`orchestration-event-router:${user.id}`, 120, 60_000);

    const body = await parseJsonBody<RouterBody>(req);
    const eventType = requireEnum(body.eventType, "eventType", EVENT_TYPES) as EventType;
    const source = optionalString(body.source) ?? "client";
    const payload = asRecord(body.payload ?? {}, "payload");

    const candidateId = optionalUuid(payload.candidateId ?? payload.candidate_id, "candidateId");
    const conversationId = optionalUuid(payload.conversationId ?? payload.conversation_id, "conversationId");
    const callId = optionalUuid(payload.callId ?? payload.call_id, "callId");

    const rootEventId = await insertEvent(serviceClient, {
      userId: user.id,
      eventType,
      source,
      payload,
      candidateId,
      conversationId,
      callId,
      status: "processed",
    });

    let result: JsonRecord = {};
    if (eventType === "message.received") {
      result = await handleMessageReceived(serviceClient, user.id, source, payload, rootEventId);
    } else if (eventType === "call.ended") {
      result = await handleCallEnded(serviceClient, user.id, source, payload, rootEventId);
    } else if (eventType === "mobile_action.completed") {
      result = await handleMobileActionCompleted(serviceClient, payload);
    }

    return jsonResponse(req, {
      success: true,
      eventId: rootEventId,
      eventType,
      ...result,
    });
  } catch (error: unknown) {
    return errorResponse(req, error);
  }
});
