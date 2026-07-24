import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createEdgeFunction, jsonResponse } from "../_core/functionWrapper.ts";
import { z, validateJson } from "../_core/validate.ts";
import { PlatformError } from "../_core/errors.ts";
import { createServiceClient, requireSameUser, verifyMachineToken } from "../_core/auth.ts";
import { auditEvent } from "../_core/audit.ts";

const rewardSchema = z.object({
  userId: z.string().uuid(),
  actionType: z.string().min(1).max(80),
  referenceId: z.string().max(160).optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

type SupabaseClient = ReturnType<typeof createServiceClient>;

type RewardRow = {
  coin_amount: number;
  description: string;
  max_total: number | null;
  max_per_day: number | null;
};

type BalanceRow = {
  total_coins: number;
  lifetime_earned: number;
  longest_streak?: number;
};

type BadgeRow = {
  id: string;
  name: string;
  requirement_type: "coins_earned" | "referrals" | "streak";
  requirement_value: number;
  coin_reward: number;
};

serve(createEdgeFunction({
  name: "process-coin-reward",
  classification: ["HIGH_VALUE", "SERVICE_ONLY"],
  methods: ["POST"],
  auth: "optional",
  rateLimit: {
    limit: 60,
    windowMs: 60_000,
    key: (_req, auth) => `process-coin-reward:${auth.user?.id ?? auth.machine?.id ?? "anonymous"}`,
  },
  audit: { eventType: "coin_reward_requested" },
}, async ({ req, auth, correlationId }) => {
  const body = await validateJson(req, rewardSchema);

  let userId = body.userId;
  if (auth.user) {
    userId = requireSameUser(auth, body.userId);
  } else if (!auth.machine) {
    auth.machine = await verifyMachineToken(req, "process-coin-reward");
  }

  const { data: reward, error: rewardError } = await auth.serviceClient
    .from("chatr_coin_rewards")
    .select("coin_amount, description, max_total, max_per_day")
    .eq("action_type", body.actionType)
    .eq("is_active", true)
    .single<RewardRow>();

  if (rewardError || !reward) {
    throw new PlatformError(404, "reward_not_found", "Reward not found");
  }

  if (reward.max_total === 1) {
    const { data: existingTransaction } = await auth.serviceClient
      .from("chatr_coin_transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("source", body.actionType)
      .maybeSingle();

    if (existingTransaction) {
      throw new PlatformError(400, "reward_already_claimed", "Reward already claimed");
    }
  }

  if (reward.max_per_day) {
    const today = new Date().toISOString().split("T")[0];
    const { count } = await auth.serviceClient
      .from("chatr_coin_transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("source", body.actionType)
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lte("created_at", `${today}T23:59:59.999Z`);

    if (count && count >= reward.max_per_day) {
      throw new PlatformError(400, "daily_limit_reached", "Daily limit reached");
    }
  }

  const { error: transactionError } = await auth.serviceClient
    .from("chatr_coin_transactions")
    .insert({
      user_id: userId,
      transaction_type: "earn",
      amount: reward.coin_amount,
      source: body.actionType,
      description: reward.description,
      reference_id: body.referenceId ?? null,
      metadata: body.metadata,
    });

  if (transactionError) {
    throw new PlatformError(500, "coin_transaction_failed", transactionError.message);
  }

  const { data: balance } = await auth.serviceClient
    .from("chatr_coin_balances")
    .select("total_coins, lifetime_earned, longest_streak")
    .eq("user_id", userId)
    .maybeSingle<BalanceRow>();

  if (balance) {
    await auth.serviceClient
      .from("chatr_coin_balances")
      .update({
        total_coins: Number(balance.total_coins || 0) + reward.coin_amount,
        lifetime_earned: Number(balance.lifetime_earned || 0) + reward.coin_amount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await auth.serviceClient
      .from("chatr_coin_balances")
      .insert({
        user_id: userId,
        total_coins: reward.coin_amount,
        lifetime_earned: reward.coin_amount,
      });
  }

  await checkBadgeAchievements(auth.serviceClient, userId);
  const newBalance = Number(balance?.total_coins || 0) + reward.coin_amount;

  await auditEvent(auth, {
    type: "coin_reward_processed",
    correlationId,
    metadata: { userId, actionType: body.actionType, coinsAwarded: reward.coin_amount },
  });

  return jsonResponse(req, {
    success: true,
    coinsAwarded: reward.coin_amount,
    newBalance,
  }, 200, correlationId);
}));

async function checkBadgeAchievements(supabase: SupabaseClient, userId: string) {
  const { data: balance } = await supabase
    .from("chatr_coin_balances")
    .select("total_coins, lifetime_earned, longest_streak")
    .eq("user_id", userId)
    .maybeSingle<BalanceRow>();

  if (!balance) return;

  const { count: referralCount } = await supabase
    .from("chatr_referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", userId)
    .eq("status", "active");

  const { data: badges } = await supabase
    .from("chatr_badges")
    .select("id, name, requirement_type, requirement_value, coin_reward")
    .eq("is_active", true)
    .returns<BadgeRow[]>();

  for (const badge of badges || []) {
    let shouldAward = false;

    switch (badge.requirement_type) {
      case "coins_earned":
        shouldAward = Number(balance.lifetime_earned || 0) >= badge.requirement_value;
        break;
      case "referrals":
        shouldAward = (referralCount || 0) >= badge.requirement_value;
        break;
      case "streak":
        shouldAward = Number(balance.longest_streak || 0) >= badge.requirement_value;
        break;
    }

    if (!shouldAward) continue;

    const { data: existing } = await supabase
      .from("chatr_user_badges")
      .select("id")
      .eq("user_id", userId)
      .eq("badge_id", badge.id)
      .maybeSingle();

    if (existing) continue;

    await supabase.from("chatr_user_badges").insert({ user_id: userId, badge_id: badge.id });

    if (badge.coin_reward > 0) {
      await supabase.from("chatr_coin_transactions").insert({
        user_id: userId,
        transaction_type: "bonus",
        amount: badge.coin_reward,
        source: "badge_earned",
        description: `Badge earned: ${badge.name}`,
        reference_id: badge.id,
      });

      await supabase
        .from("chatr_coin_balances")
        .update({
          total_coins: Number(balance.total_coins || 0) + badge.coin_reward,
          lifetime_earned: Number(balance.lifetime_earned || 0) + badge.coin_reward,
        })
        .eq("user_id", userId);
    }
  }
}
