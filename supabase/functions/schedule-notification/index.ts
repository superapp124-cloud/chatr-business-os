import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  assertRateLimit,
  auditSecurityEvent,
  errorResponse,
  handleCors,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requireEnum,
  requireMethod,
  requireSameUser,
  requireString,
  requireUser,
} from "../_shared/security.ts";

type ScheduleRequest = {
  userId?: unknown;
  type?: unknown;
  title?: unknown;
  body?: unknown;
  scheduledAt?: unknown;
  data?: unknown;
  recurring?: {
    frequency?: unknown;
    endDate?: unknown;
  };
};

const RECURRING_FREQUENCIES = ["daily", "weekly", "monthly"] as const;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    requireMethod(req, ["POST"]);
    const { user, serviceClient } = await requireUser(req);
    assertRateLimit(`schedule-notification:${user.id}`, 30, 60_000);

    const body = await parseJsonBody<ScheduleRequest>(req);
    const userId = requireSameUser(user.id, body.userId);
    const type = requireString(body.type, "type", { min: 1, max: 80 });
    const title = requireString(body.title, "title", { min: 1, max: 160 });
    const message = requireString(body.body, "body", { min: 1, max: 500 });
    const scheduledAt = requireString(body.scheduledAt, "scheduledAt", { min: 10, max: 40 });
    const scheduledDate = new Date(scheduledAt);

    if (Number.isNaN(scheduledDate.getTime())) {
      throw new HttpError(400, "invalid_scheduled_at", "scheduledAt must be a valid ISO timestamp");
    }

    let recurringFrequency: string | null = null;
    let recurringEndDate: string | null = null;
    if (body.recurring) {
      recurringFrequency = requireEnum(body.recurring.frequency, "recurring.frequency", RECURRING_FREQUENCIES);
      if (body.recurring.endDate) {
        recurringEndDate = requireString(body.recurring.endDate, "recurring.endDate", { min: 10, max: 40 });
        if (Number.isNaN(new Date(recurringEndDate).getTime())) {
          throw new HttpError(400, "invalid_recurring_end_date", "recurring.endDate must be a valid ISO timestamp");
        }
      }
    }

    const data = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : {};

    const { data: scheduled, error } = await serviceClient
      .from("scheduled_notifications")
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data,
        scheduled_at: scheduledAt,
        recurring_frequency: recurringFrequency,
        recurring_end_date: recurringEndDate,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      throw new HttpError(500, "notification_schedule_failed", error.message);
    }

    await auditSecurityEvent(serviceClient, {
      userId,
      eventType: "notification_scheduled",
      metadata: { scheduledNotificationId: scheduled.id, type, scheduledAt },
    });

    return jsonResponse(req, { success: true, id: scheduled.id });
  } catch (error: unknown) {
    return errorResponse(req, error);
  }
});
