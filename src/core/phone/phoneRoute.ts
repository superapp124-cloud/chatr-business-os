export type PhoneCoreRouteType = "chatr_voip" | "gsm" | "pstn_bridge" | "invalid";

export type PhoneCoreShieldDisposition = "allow" | "warn" | "high_risk" | "invalid";

export interface PhoneCoreRouteDecision {
  callId?: string | null;
  requestedNumber: string;
  normalizedNumber: string;
  hashedNumber?: string;
  primaryRoute: PhoneCoreRouteType;
  fallbackRoute?: PhoneCoreRouteType | null;
  shieldDisposition: PhoneCoreShieldDisposition;
  trustScore: number;
  riskLevel: string;
  identitySource: string;
  identityLabel?: string | null;
  reason: string;
  confidence: number;
  resolvedAt?: number;
}

const routeTypes = new Set<PhoneCoreRouteType>([
  "chatr_voip",
  "gsm",
  "pstn_bridge",
  "invalid",
]);

const shieldDispositions = new Set<PhoneCoreShieldDisposition>([
  "allow",
  "warn",
  "high_risk",
  "invalid",
]);

const asRouteType = (value: unknown, fallback: PhoneCoreRouteType): PhoneCoreRouteType => {
  return typeof value === "string" && routeTypes.has(value as PhoneCoreRouteType)
    ? (value as PhoneCoreRouteType)
    : fallback;
};

const asShieldDisposition = (
  value: unknown,
  fallback: PhoneCoreShieldDisposition,
): PhoneCoreShieldDisposition => {
  return typeof value === "string" && shieldDispositions.has(value as PhoneCoreShieldDisposition)
    ? (value as PhoneCoreShieldDisposition)
    : fallback;
};

const asNumber = (value: unknown, fallback = 0): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const asString = (value: unknown, fallback = ""): string => {
  return typeof value === "string" ? value : fallback;
};

export function parsePhoneRouteDecision(
  rawRoute: unknown,
  fallback: {
    callId?: string | null;
    phoneNumber?: string | null;
    primaryRoute?: PhoneCoreRouteType;
  } = {},
): PhoneCoreRouteDecision {
  const source = rawRoute && typeof rawRoute === "object"
    ? (rawRoute as Record<string, unknown>)
    : {};

  const requestedNumber = asString(
    source.requestedNumber,
    fallback.phoneNumber ?? "",
  );
  const normalizedNumber = asString(source.normalizedNumber, "");
  const primaryRoute = asRouteType(
    source.primaryRoute,
    fallback.primaryRoute ?? "chatr_voip",
  );

  return {
    callId: asString(source.callId, fallback.callId ?? "") || null,
    requestedNumber,
    normalizedNumber,
    hashedNumber: asString(source.hashedNumber, ""),
    primaryRoute,
    fallbackRoute: source.fallbackRoute
      ? asRouteType(source.fallbackRoute, "gsm")
      : null,
    shieldDisposition: asShieldDisposition(source.shieldDisposition, "allow"),
    trustScore: asNumber(source.trustScore, 50),
    riskLevel: asString(source.riskLevel, "unknown"),
    identitySource: asString(source.identitySource, "unresolved"),
    identityLabel: asString(source.identityLabel, "") || null,
    reason: asString(source.reason, "legacy_native_call_event"),
    confidence: asNumber(source.confidence, 0),
    resolvedAt: asNumber(source.resolvedAt, Date.now()),
  };
}

export function describePhoneRoute(route: PhoneCoreRouteDecision): string {
  const fallback = route.fallbackRoute ? ` fallback=${route.fallbackRoute}` : "";
  return `primary=${route.primaryRoute}${fallback} shield=${route.shieldDisposition} reason=${route.reason}`;
}
