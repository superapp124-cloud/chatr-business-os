import { z, type ZodSchema } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { PlatformError } from "./errors.ts";

export { z };

export async function parseJson(req: Request, maxBytes = 64_000): Promise<unknown> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) {
    throw new PlatformError(413, "payload_too_large", "Request body is too large");
  }

  try {
    return await req.json();
  } catch {
    throw new PlatformError(400, "invalid_json", "Request body must be valid JSON");
  }
}

export async function validateJson<T>(req: Request, schema: ZodSchema<T>, maxBytes = 64_000): Promise<T> {
  const parsed = await parseJson(req, maxBytes);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new PlatformError(400, "validation_failed", "Request validation failed", {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export const uuidSchema = z.string().uuid();
export const phoneSchema = z.string().min(6).max(20).regex(/^\+?[0-9\s().-]+$/);

