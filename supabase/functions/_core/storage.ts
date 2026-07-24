import type { AuthContext } from "./auth.ts";
import { PlatformError } from "./errors.ts";

export async function createSignedReadUrl(
  auth: AuthContext,
  bucket: string,
  path: string,
  expiresInSeconds = 300,
) {
  const { data, error } = await auth.serviceClient.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new PlatformError(500, "signed_url_failed", error?.message ?? "Failed to create signed URL");
  }
  return data.signedUrl;
}

export function assertUserPath(auth: AuthContext, path: string) {
  if (!auth.user) throw new PlatformError(401, "missing_authorization", "Authentication is required");
  const firstSegment = path.split("/")[0];
  if (firstSegment !== auth.user.id) {
    throw new PlatformError(403, "storage_owner_required", "Storage object owner access is required");
  }
}

