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
  requireUser,
  requireUuid,
} from "../_shared/security.ts";

const APPOINTMENT_TYPES = ["in-person", "video", "phone"] as const;

type BookingBody = {
  patientId?: unknown;
  providerId?: unknown;
  appointmentDate?: unknown;
  appointmentType?: unknown;
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    requireMethod(req, ["POST"]);
    const { user, serviceClient } = await requireUser(req);
    assertRateLimit(`healthcare-booking:${user.id}`, 20, 60_000);

    const body = await parseJsonBody<BookingBody>(req);
    const patientId = requireSameUser(user.id, body.patientId);
    const providerId = requireUuid(body.providerId, "providerId");
    const appointmentType = requireEnum(body.appointmentType, "appointmentType", APPOINTMENT_TYPES);

    if (typeof body.appointmentDate !== "string" || Number.isNaN(new Date(body.appointmentDate).getTime())) {
      throw new HttpError(400, "invalid_appointment_date", "appointmentDate must be a valid ISO timestamp");
    }
    const appointmentDate = body.appointmentDate;

    const { data: existingAppointments, error: availabilityError } = await serviceClient
      .from("healthcare_appointments")
      .select("*")
      .eq("provider_id", providerId)
      .eq("appointment_date", appointmentDate)
      .in("status", ["scheduled", "confirmed"]);

    if (availabilityError) {
      throw new HttpError(500, "availability_check_failed", availabilityError.message);
    }

    if (existingAppointments && existingAppointments.length > 0) {
      throw new HttpError(409, "appointment_unavailable", "Time slot not available");
    }

    const { data: appointment, error } = await serviceClient
      .from("healthcare_appointments")
      .insert({
        patient_id: patientId,
        provider_id: providerId,
        appointment_date: appointmentDate,
        appointment_type: appointmentType,
        status: "scheduled",
      })
      .select()
      .single();

    if (error) {
      throw new HttpError(500, "appointment_create_failed", error.message);
    }

    await serviceClient
      .from("notifications")
      .insert({
        user_id: providerId,
        title: "New Appointment Booking",
        message: `New ${appointmentType} appointment scheduled`,
        type: "appointment",
        data: { appointmentId: appointment.id },
      });

    await auditSecurityEvent(serviceClient, {
      userId: patientId,
      eventType: "healthcare_appointment_booked",
      metadata: { appointmentId: appointment.id, providerId, appointmentDate, appointmentType },
    });

    return jsonResponse(req, { success: true, appointment });
  } catch (error: unknown) {
    return errorResponse(req, error);
  }
});
