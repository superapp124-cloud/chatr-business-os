/**
 * Utility: generate a short UUID-like string without crypto dependency.
 * In production this can be replaced with crypto.randomUUID().
 */
export function randomUUID(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
