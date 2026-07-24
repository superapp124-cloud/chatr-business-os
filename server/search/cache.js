import { config } from "./config.js";

const responseCache = new Map();

function getMemoryCachedAnswer(key) {
  const cached = responseCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.createdAt > config.cacheTtlMs) {
    responseCache.delete(key);
    return null;
  }

  return cached;
}

async function getRedisCachedAnswer(key) {
  if (!config.redisRestUrl || !config.redisRestToken) return null;

  try {
    const response = await fetch(`${config.redisRestUrl.replace(/\/$/, "")}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${config.redisRestToken}` },
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data.result) return null;
    return typeof data.result === "string" ? JSON.parse(data.result) : data.result;
  } catch (error) {
    console.warn("Redis cache read failed:", error.message);
    return null;
  }
}

export async function getCachedAnswer(key) {
  const memoryCached = getMemoryCachedAnswer(key);
  if (memoryCached) return { ...memoryCached, cacheLayer: "memory" };

  const redisCached = await getRedisCachedAnswer(key);
  if (redisCached) {
    responseCache.set(key, { ...redisCached, createdAt: Date.now() });
    return { ...redisCached, cacheLayer: "redis" };
  }

  return null;
}

export async function setCachedAnswer(key, value) {
  const cacheValue = { ...value, createdAt: Date.now() };
  responseCache.set(key, cacheValue);

  if (!config.redisRestUrl || !config.redisRestToken) return;

  try {
    const ttlSeconds = Math.max(1, Math.ceil(config.cacheTtlMs / 1000));
    const redisUrl = `${config.redisRestUrl.replace(/\/$/, "")}/set/${encodeURIComponent(key)}/${encodeURIComponent(
      JSON.stringify(cacheValue),
    )}?EX=${ttlSeconds}`;

    const response = await fetch(redisUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.redisRestToken}` },
    });

    if (!response.ok) throw new Error(`status ${response.status}`);
  } catch (error) {
    console.warn("Redis cache write failed:", error.message);
  }
}
