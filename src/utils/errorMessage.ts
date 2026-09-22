/**
 * ============================================================================
 * ⚠️  ERROR MESSAGES
 * ============================================================================
 *
 * Getting a readable message out of something thrown, without `any`.
 *
 * Fifteen catch blocks across this project were annotated `: any`
 * purely so that `err.message` would compile. That silences the type checker at
 * the exact moment it is most useful: inside a catch, the thrown value really
 * can be anything — a Firebase HttpsError, a plain Error, a string, or a
 * rejected value that is not an error at all — and `.message` on the last two
 * is `undefined`, which is how a failure ends up reported as
 * "เกิดข้อผิดพลาด: undefined".
 *
 * TypeScript types a catch binding as `unknown` under `strict`, which is
 * correct. This narrows it once, here.
 */

/** A Firebase callable error carries a machine-readable code alongside the message. */
interface CodedError {
  code?: string;
  message?: string;
  details?: unknown;
}

function asCoded(err: unknown): CodedError | null {
  return err !== null && typeof err === 'object' ? (err as CodedError) : null;
}

/**
 * A message worth showing someone.
 *
 * @param err      whatever was caught
 * @param fallback shown when the thrown value carries no usable message
 */
export function errorMessage(err: unknown, fallback = 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'): string {
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof Error && err.message) return err.message;

  const coded = asCoded(err);
  if (coded && typeof coded.message === 'string' && coded.message.trim()) {
    return coded.message;
  }

  return fallback;
}

/**
 * The `code` on a Firebase callable error, when there is one.
 *
 * Useful for telling a refusal the server meant (`failed-precondition` carrying
 * ALLERGEN_ALERT or COUPON_REJECTED) apart from a transport failure.
 */
export function errorCode(err: unknown): string | null {
  const coded = asCoded(err);
  return coded && typeof coded.code === 'string' ? coded.code : null;
}

/** The structured `details` payload a Cloud Function attached to an HttpsError. */
export function errorDetails(err: unknown): Record<string, unknown> | null {
  const coded = asCoded(err);
  if (coded && coded.details !== null && typeof coded.details === 'object') {
    return coded.details as Record<string, unknown>;
  }
  return null;
}
