const DEFAULT_ALLOWED_ORIGINS = [
  "https://chatr.chat",
  "https://www.chatr.chat",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:8085",
  "http://127.0.0.1:8085",
  "capacitor://localhost",
  "ionic://localhost",
];

function configuredOrigins() {
  const raw = Deno.env.get("ALLOWED_ORIGINS") || Deno.env.get("CHATR_ALLOWED_ORIGINS");
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  return raw.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function isPreviewOrigin(origin: string) {
  const isVercel = Deno.env.get("ALLOW_VERCEL_PREVIEW_ORIGINS") === "true" &&
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
    
  // Allow local network IP addresses for testing on mobile devices
  const isLocalNetwork = /^http:\/\/(192\.168\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/.test(origin);
  
  return isVercel || isLocalNetwork;
}

export function resolveOrigin(req: Request) {
  const origin = req.headers.get("Origin");
  const allowed = configuredOrigins();
  if (!origin) return allowed[0];
  if (allowed.includes(origin) || isPreviewOrigin(origin)) return origin;
  return allowed[0];
}

export function corsHeaders(req: Request): HeadersInit {
  return {
    "Access-Control-Allow-Origin": resolveOrigin(req),
    "Access-Control-Allow-Headers": [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "x-request-id",
      "x-correlation-id",
      "x-cron-secret",
      "x-chatr-machine-token",
      "x-chatr-signature",
      "x-chatr-timestamp",
      "x-idempotency-key",
    ].join(", "),
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

export function handleOptions(req: Request) {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

