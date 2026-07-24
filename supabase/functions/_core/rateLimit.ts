import { PlatformError } from "./errors.ts";

type LimitEntry = { count: number; resetAt: number };
const memoryLimits = new Map<string, LimitEntry>();

export type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

export async function assertRateLimit(config: RateLimitConfig) {
  if (Deno.env.get("EDGE_RATE_LIMIT_DISABLED") === "true") return;

  // Upstash-compatible hook point. If REST envs are absent, in-isolate memory limits still protect bursts.
  const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (upstashUrl && upstashToken) {
    try {
      const key = `edge_rl:${config.key}`;
      const response = await fetch(`${upstashUrl}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${upstashToken}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, String(config.windowMs)],
        ]),
      });
      if (response.ok) {
        const result = await response.json();
        const count = Number(result?.[0]?.result ?? 1);
        if (count > config.limit) throw new PlatformError(429, "rate_limited", "Too many requests. Try again shortly.");
        return;
      }
    } catch (error) {
      if (error instanceof PlatformError) throw error;
      console.warn("[core-rate-limit] Redis rate limit unavailable, falling back to memory:", error);
    }
  }

  const now = Date.now();
  const existing = memoryLimits.get(config.key);
  if (!existing || existing.resetAt <= now) {
    memoryLimits.set(config.key, { count: 1, resetAt: now + config.windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > config.limit) {
    throw new PlatformError(429, "rate_limited", "Too many requests. Try again shortly.");
  }
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
}

