import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createEdgeFunction, jsonResponse } from "../_core/functionWrapper.ts";
import { z, validateJson } from "../_core/validate.ts";
import { PlatformError } from "../_core/errors.ts";
import { verifyMachineToken } from "../_core/auth.ts";
import { auditEvent } from "../_core/audit.ts";

const lookupSchema = z.object({
  phones: z.array(z.string().min(6).max(32)).min(1).max(200),
});

type ProfileRow = {
  id: string;
  phone_number: string | null;
  username: string | null;
  avatar_url: string | null;
  last_seen: string | null;
};

serve(createEdgeFunction({
  name: "lookup-chatr-users",
  classification: ["HIGH_VALUE", "SERVICE_ONLY"],
  methods: ["POST"],
  auth: "optional",
  rateLimit: {
    limit: 30,
    windowMs: 60_000,
    key: (_req, auth) => `lookup-chatr-users:${auth.user?.id ?? auth.machine?.id ?? "anonymous"}`,
  },
  audit: { eventType: "chatr_user_lookup_requested" },
}, async ({ req, auth, correlationId }) => {
  if (!auth.user && !auth.machine) {
    auth.machine = await verifyMachineToken(req, "lookup-chatr-users");
  }

  const { phones } = await validateJson(req, lookupSchema);
  const limitedPhones = phones.slice(0, 200).map((phone) => phone.trim());

  const { data: users, error } = await auth.serviceClient
    .from("profiles")
    .select("id, phone_number, username, avatar_url, last_seen")
    .in("phone_number", limitedPhones)
    .returns<ProfileRow[]>();

  if (error) {
    throw new PlatformError(500, "lookup_failed", "Lookup failed");
  }

  const mapped = (users || []).map((user) => ({
    id: user.id,
    phone: user.phone_number,
    display_name: user.username,
    avatar_url: user.avatar_url,
    last_seen: user.last_seen,
  }));

  await auditEvent(auth, {
    type: "chatr_user_lookup_completed",
    correlationId,
    metadata: { totalQueried: limitedPhones.length, totalFound: mapped.length },
  });

  return jsonResponse(req, {
    users: mapped,
    total_queried: limitedPhones.length,
    total_found: mapped.length,
  }, 200, correlationId);
}));
