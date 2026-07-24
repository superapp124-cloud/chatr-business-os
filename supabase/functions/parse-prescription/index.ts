import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  assertRateLimit,
  auditSecurityEvent,
  errorResponse,
  handleCors,
  HttpError,
  jsonResponse,
  parseJsonBody,
  requireMethod,
  requireString,
  requireUser,
  requireUuid,
} from "../_shared/security.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    requireMethod(req, ["POST"]);
    const { user, serviceClient } = await requireUser(req);
    assertRateLimit(`parse-prescription:${user.id}`, 10, 60_000);

    const body = await parseJsonBody(req);
    const prescriptionId = requireUuid(body.prescriptionId, "prescriptionId");
    const imageUrl = requireString(body.imageUrl, "imageUrl", { min: 8, max: 4096, pattern: /^https:\/\// });

    const { data: prescription, error: prescriptionError } = await serviceClient
      .from("prescription_uploads")
      .select("id, user_id, image_url")
      .eq("id", prescriptionId)
      .single();

    if (prescriptionError || !prescription) {
      throw new HttpError(404, "prescription_not_found", "Prescription not found");
    }

    if (prescription.user_id !== user.id || prescription.image_url !== imageUrl) {
      throw new HttpError(403, "prescription_access_denied", "You are not allowed to parse this prescription");
    }

    const aiResponse = await fetch("https://lovable.dev/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Analyze this prescription image and extract all medicines with their dosage, frequency, and timing. Return JSON format: { \"doctor_name\": \"...\", \"hospital_name\": \"...\", \"medicines\": [{ \"name\": \"...\", \"dosage\": \"...\", \"frequency\": \"once_daily|twice_daily|thrice_daily\", \"timing\": [\"morning\", \"evening\"], \"duration_days\": 30 }] }. Only return valid JSON." },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
      }),
    });

    const aiData = await aiResponse.json();
    let parsedData: { medicines: unknown[]; doctor_name?: string; hospital_name?: string } = { medicines: [] };

    try {
      const content = aiData.choices?.[0]?.message?.content || "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Error parsing AI response:", error);
    }

    const { error: updateError } = await serviceClient
      .from("prescription_uploads")
      .update({
        ocr_parsed_data: parsedData,
        ocr_raw_text: JSON.stringify(aiData),
        doctor_name: parsedData.doctor_name || null,
        hospital_name: parsedData.hospital_name || null,
        status: "processed",
      })
      .eq("id", prescriptionId)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    await auditSecurityEvent(serviceClient, {
      userId: user.id,
      eventType: "prescription_parsed",
      severity: "warning",
      metadata: { prescriptionId },
    });

    return jsonResponse(req, { success: true, data: parsedData });
  } catch (error) {
    console.error("Prescription parsing error:", error);
    return errorResponse(req, error);
  }
});
