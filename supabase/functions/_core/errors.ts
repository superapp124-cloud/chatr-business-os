export type ErrorSeverity = "info" | "warning" | "critical";

export class PlatformError extends Error {
  status: number;
  code: string;
  severity: ErrorSeverity;
  exposeMessage: boolean;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { severity?: ErrorSeverity; exposeMessage?: boolean; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.severity = options.severity ?? "warning";
    this.exposeMessage = options.exposeMessage ?? true;
    this.details = options.details;
  }
}

export function platformError(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return new PlatformError(status, code, message, { details });
}

export function normalizeError(error: unknown) {
  if (error instanceof PlatformError) {
    return {
      status: error.status,
      code: error.code,
      message: error.exposeMessage ? error.message : "Request failed",
      severity: error.severity,
      details: error.details,
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    status: 500,
    code: "internal_error",
    message,
    severity: "critical" as const,
    details: undefined,
  };
}

