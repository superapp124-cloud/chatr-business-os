import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  assertRateLimit,
  auditSecurityEvent,
  errorResponse,
  handleCors,
  jsonResponse,
  requireMethod,
  requireUser,
} from "../_shared/security.ts";

export const BLACKLISTED_ICE_HOSTNAMES = [
  "stun.mozilla.org",
  "stun.services.mozilla.com",
  "relay.metered.ca",
  "a.relay.metered.ca",
  "fr-turn1.xirsys.com",
  "xirsys.com"
];

const fallbackStunServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  {
    urls: [
      "stun:stun.cloudflare.com:3478",
      "turn:turn.cloudflare.com:3478?transport=udp",
      "turn:turn.cloudflare.com:3478?transport=tcp",
      "turns:turn.cloudflare.com:5349?transport=tcp"
    ],
    username: "g0c53265fd3d77b1917f9d26a934e34f4cc2e358d65733e4285a7be2e4344489",
    credential: "5969d5f8b822bcd5a43c3c5257fd9cbca7a787db37e20aa1602746f6b77a393a"
  }
];

function normalizeIceServers(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.iceServers)) return input.iceServers;
  if (input?.iceServers?.urls) return [input.iceServers];
  if (input?.urls) return [input];
  return [];
}

function cleanAndEnrichIceServers(servers: any[]): any[] {
  const cleaned = normalizeIceServers(servers).map(server => {
    if (!server || !server.urls) return null;
    
    // Normalize urls to array
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    
    // Strip out blacklisted and dead domains/hosts using the named constant
    const filteredUrls = urls.filter(url => {
      const u = url.toLowerCase();
      return !BLACKLISTED_ICE_HOSTNAMES.some(blacklisted => u.includes(blacklisted.toLowerCase()));
    });
    
    if (filteredUrls.length === 0) return null;
    
    return {
      ...server,
      urls: filteredUrls.length === 1 ? filteredUrls[0] : filteredUrls
    };
  }).filter(Boolean);

  // SAFE INTERIM: We do not inject turn.relay.chatr.im until it is fully validated.
  // We strictly return only the sanitized public STUN servers for maximum reliability.
  const hasStun = cleaned.some(s => {
    if (!s.urls) return false;
    if (typeof s.urls === 'string') return s.urls.startsWith('stun');
    return s.urls.some((u: string) => u.startsWith('stun'));
  });

  if (!hasStun || cleaned.length === 0) {
    return fallbackStunServers;
  }
  
  return cleaned;
}

function configuredIceServers() {
  let servers: any[] = [];
  const rawJson = Deno.env.get("TURN_ICE_SERVERS_JSON");
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      servers = [...fallbackStunServers, ...normalizeIceServers(parsed)];
    } catch {
      servers = [...fallbackStunServers];
    }
  } else {
    const urls = Deno.env.get("TURN_URLS");
    const username = Deno.env.get("TURN_USERNAME");
    const credential = Deno.env.get("TURN_CREDENTIAL");

    if (urls && username && credential) {
      servers = [
        ...fallbackStunServers,
        {
          urls: urls.split(",").map((url) => url.trim()).filter(Boolean),
          username,
          credential,
        },
      ];
    } else {
      servers = [...fallbackStunServers];
    }
  }

  return cleanAndEnrichIceServers(servers);
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    requireMethod(req, ["POST", "GET"]);
    const { user, serviceClient } = await requireUser(req);
    assertRateLimit(`turn-credentials:${user.id}`, 30, 60_000);

    const iceServers = configuredIceServers();

    await auditSecurityEvent(serviceClient, {
      userId: user.id,
      eventType: "turn_credentials_requested",
      metadata: { serverCount: iceServers.length, hasTurn: iceServers.some((server) => JSON.stringify(server).includes("turn:")) },
    });

    return jsonResponse(req, { iceServers });
  } catch (error) {
    console.error("Error getting TURN credentials:", error);
    return errorResponse(req, error);
  }
});
