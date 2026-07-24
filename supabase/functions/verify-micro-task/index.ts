import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createEdgeFunction, jsonResponse } from "../_core/functionWrapper.ts";
import { z, validateJson } from "../_core/validate.ts";
import { PlatformError } from "../_core/errors.ts";
import { verifyMachineToken } from "../_core/auth.ts";
import { auditEvent } from "../_core/audit.ts";

const FRAUD_RULES = {
  MAX_TASKS_PER_HOUR: 3,
  MAX_GPS_DISTANCE_PHOTO: 2,
  MAX_GPS_DISTANCE_RATE: 5,
  MIN_AUDIO_PERCENT: 70,
};

const verifySchema = z.object({
  submissionId: z.string().uuid(),
});

type MicroTask = {
  title: string;
  task_type: "photo_verify" | "audio_listen" | "rate_service" | string;
  geo_required: boolean;
  correct_option_index: number | null;
  reward_coins: number;
  reward_rupees: number;
};

type SubmissionRow = {
  id: string;
  user_id: string;
  assignment_id: string;
  device_hash: string | null;
  gps_distance_km: number | null;
  media_hash: string | null;
  audio_listened_percent: number | null;
  selected_option_index: number | null;
  rating: number | null;
  task: MicroTask;
};

type UserScore = {
  is_soft_blocked?: boolean;
  tasks_completed?: number;
  total_earned_coins?: number;
  total_earned_rupees?: number;
};

serve(createEdgeFunction({
  name: "verify-micro-task",
  classification: ["HIGH_VALUE", "SERVICE_ONLY"],
  methods: ["POST"],
  auth: "optional",
  rateLimit: {
    limit: 40,
    windowMs: 60_000,
    key: (_req, auth) => `verify-micro-task:${auth.user?.id ?? auth.machine?.id ?? "anonymous"}`,
  },
  audit: { eventType: "micro_task_verification_requested" },
}, async ({ req, auth, correlationId }) => {
  const { submissionId } = await validateJson(req, verifySchema);

  if (!auth.user && !auth.machine) {
    auth.machine = await verifyMachineToken(req, "verify-micro-task");
  }

  const { data: submission, error: subError } = await auth.serviceClient
    .from("micro_task_submissions")
    .select("*, task:micro_tasks (*)")
    .eq("id", submissionId)
    .single<SubmissionRow>();

  if (subError || !submission) {
    throw new PlatformError(404, "submission_not_found", "Submission not found");
  }

  if (auth.user && auth.user.id !== submission.user_id && !auth.user.roles.includes("admin")) {
    throw new PlatformError(403, "submission_owner_required", "Submission owner access is required");
  }

  const task = submission.task;
  const userId = submission.user_id;
  const fraudFlags: string[] = [];
  let shouldReject = false;
  let rejectReason = "";

  const { data: userScore } = await auth.serviceClient
    .from("micro_task_user_scores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UserScore>();

  if (userScore?.is_soft_blocked) {
    await updateSubmissionStatus(auth.serviceClient, submissionId, "manual_review", "User is soft-blocked");
    return jsonResponse(req, { status: "manual_review", reason: "Account under review" }, 200, correlationId);
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  if (submission.device_hash) {
    const { data: recentSubmissions } = await auth.serviceClient
      .from("micro_task_submissions")
      .select("id")
      .eq("device_hash", submission.device_hash)
      .gte("created_at", oneHourAgo);

    if (recentSubmissions && recentSubmissions.length > FRAUD_RULES.MAX_TASKS_PER_HOUR) {
      fraudFlags.push("rate_limit");
      await insertFraudFlag(auth.serviceClient, userId, submissionId, "rate_limit", {
        device_hash: submission.device_hash,
        count: recentSubmissions.length,
      });
    }
  }

  if (task.geo_required && submission.gps_distance_km !== null) {
    const maxDistance = task.task_type === "photo_verify"
      ? FRAUD_RULES.MAX_GPS_DISTANCE_PHOTO
      : FRAUD_RULES.MAX_GPS_DISTANCE_RATE;

    if (submission.gps_distance_km > maxDistance) {
      fraudFlags.push("gps_mismatch");
      shouldReject = true;
      rejectReason = `Location too far (${submission.gps_distance_km.toFixed(1)}km from task area)`;
      await insertFraudFlag(auth.serviceClient, userId, submissionId, "gps_mismatch", {
        distance: submission.gps_distance_km,
        max_allowed: maxDistance,
      });
    }
  }

  if (task.task_type === "photo_verify" && submission.media_hash) {
    const { data: duplicates } = await auth.serviceClient
      .from("micro_task_submissions")
      .select("id")
      .eq("media_hash", submission.media_hash)
      .neq("id", submissionId);

    if (duplicates && duplicates.length > 0) {
      fraudFlags.push("photo_duplicate");
      shouldReject = true;
      rejectReason = "Duplicate photo detected";
      await insertFraudFlag(auth.serviceClient, userId, submissionId, "photo_duplicate", {
        duplicate_count: duplicates.length,
      });
    }
  }

  if (task.task_type === "audio_listen" && (submission.audio_listened_percent || 0) < FRAUD_RULES.MIN_AUDIO_PERCENT) {
    fraudFlags.push("audio_incomplete");
    shouldReject = true;
    rejectReason = "Audio not fully listened";
    await insertFraudFlag(auth.serviceClient, userId, submissionId, "audio_incomplete", {
      listened_percent: submission.audio_listened_percent,
    });
  }

  let finalStatus: string;
  let coinsAwarded = 0;
  let rupeesAwarded = 0;

  if (shouldReject) {
    finalStatus = "auto_rejected";
  } else if (fraudFlags.length > 0) {
    finalStatus = "manual_review";
  } else if (task.task_type === "audio_listen") {
    const isCorrect = submission.selected_option_index === task.correct_option_index;
    if (!isCorrect) {
      finalStatus = "auto_rejected";
      rejectReason = "Incorrect answer";
    } else {
      finalStatus = "auto_approved";
      coinsAwarded = task.reward_coins;
      rupeesAwarded = task.reward_rupees;
    }
  } else if (task.task_type === "rate_service" && submission.rating) {
    finalStatus = "auto_approved";
    coinsAwarded = task.reward_coins;
    rupeesAwarded = task.reward_rupees;
  } else {
    finalStatus = "manual_review";
  }

  await updateSubmissionStatus(auth.serviceClient, submissionId, finalStatus, rejectReason);

  if (finalStatus === "auto_approved") {
    await auth.serviceClient
      .from("micro_task_assignments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", submission.assignment_id);

    await auth.serviceClient.from("micro_task_verifications").insert({
      submission_id: submissionId,
      verification_type: "auto",
      result: "approved",
      coins_awarded: coinsAwarded,
      rupees_awarded: rupeesAwarded,
    });

    await auth.serviceClient
      .from("micro_task_user_scores")
      .upsert({
        user_id: userId,
        tasks_completed: (userScore?.tasks_completed || 0) + 1,
        total_earned_coins: (userScore?.total_earned_coins || 0) + coinsAwarded,
        total_earned_rupees: Number(userScore?.total_earned_rupees || 0) + rupeesAwarded,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    await auth.serviceClient.from("chatr_coin_transactions").insert({
      user_id: userId,
      amount: coinsAwarded,
      transaction_type: "earn",
      source: "micro_task",
      description: `Earned from: ${task.title}`,
      reference_id: submissionId,
    });
  } else if (finalStatus === "auto_rejected") {
    await auth.serviceClient
      .from("micro_task_assignments")
      .update({ status: "rejected" })
      .eq("id", submission.assignment_id);

    await auth.serviceClient.from("micro_task_verifications").insert({
      submission_id: submissionId,
      verification_type: "auto",
      result: "rejected",
      reason: rejectReason,
    });
  }

  await auditEvent(auth, {
    type: "micro_task_verification_completed",
    severity: fraudFlags.length > 0 ? "warning" : "info",
    correlationId,
    metadata: { submissionId, finalStatus, fraudFlags, coinsAwarded, rupeesAwarded },
  });

  return jsonResponse(req, {
    status: finalStatus,
    reason: rejectReason || null,
    coins_awarded: coinsAwarded,
    rupees_awarded: rupeesAwarded,
    fraud_flags: fraudFlags,
  }, 200, correlationId);
}));

async function updateSubmissionStatus(
  supabase: { from: (table: string) => { update: (payload: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<unknown> } } },
  submissionId: string,
  status: string,
  reason?: string,
) {
  await supabase
    .from("micro_task_submissions")
    .update({
      status,
      rejection_reason: reason || null,
    })
    .eq("id", submissionId);
}

async function insertFraudFlag(
  supabase: { from: (table: string) => { insert: (payload: Record<string, unknown>) => Promise<unknown> } },
  userId: string,
  submissionId: string,
  flagType: string,
  details: Record<string, unknown>,
) {
  await supabase.from("micro_task_fraud_flags").insert({
    user_id: userId,
    submission_id: submissionId,
    flag_type: flagType,
    details,
    risk_score_delta: 10,
  });
}
