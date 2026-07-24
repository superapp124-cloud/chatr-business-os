export type TelemetryContext = {
  functionName: string;
  correlationId: string;
  startedAt: number;
  method: string;
  path: string;
};

export function createTelemetryContext(req: Request, functionName: string): TelemetryContext {
  const url = new URL(req.url);
  return {
    functionName,
    correlationId: req.headers.get("x-correlation-id") || req.headers.get("x-request-id") || crypto.randomUUID(),
    startedAt: Date.now(),
    method: req.method,
    path: url.pathname,
  };
}

export function logRequest(ctx: TelemetryContext, metadata: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    level: "info",
    event: "edge_request_started",
    function: ctx.functionName,
    correlation_id: ctx.correlationId,
    method: ctx.method,
    path: ctx.path,
    ...metadata,
  }));
}

export function logCompletion(ctx: TelemetryContext, status: number, metadata: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    event: "edge_request_completed",
    function: ctx.functionName,
    correlation_id: ctx.correlationId,
    status,
    duration_ms: Date.now() - ctx.startedAt,
    ...metadata,
  }));
}

export function logFailure(ctx: TelemetryContext, error: unknown, metadata: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(JSON.stringify({
    level: "error",
    event: "edge_request_failed",
    function: ctx.functionName,
    correlation_id: ctx.correlationId,
    duration_ms: Date.now() - ctx.startedAt,
    error: message,
    ...metadata,
  }));
}

