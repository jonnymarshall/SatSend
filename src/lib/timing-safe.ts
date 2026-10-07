import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison (v1.4.25-H).
 *
 * Both sides are hashed first, so the comparison is a fixed-length operation
 * regardless of input length (no length leak), and a null/undefined on either
 * side is never equal to a real secret.
 */
export function timingSafeStringEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
