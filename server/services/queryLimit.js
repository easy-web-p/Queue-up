/**
 * Turns a ?limit= query parameter into a page size Firestore will accept.
 *
 * `Math.min(Number(req.query.limit) || 200, 500)` looked bounded but only had a
 * ceiling: ?limit=-1 came through as -1, and the Firestore SDK rejects a limit
 * that is not a positive integer, so a listing page answered 500 to a value
 * anyone could put in a URL. A fractional value was rejected the same way.
 *
 * @param {unknown} raw The value as it arrived in the query string.
 * @param {number} fallback Page size when nothing usable was asked for.
 * @param {number} max Largest page this endpoint will serve.
 * @returns {number} An integer in 1..max.
 */
export function resolveQueryLimit(raw, fallback, max) {
  const asked = Math.trunc(Number(raw));
  if (!Number.isFinite(asked) || asked < 1) return Math.min(fallback, max);
  return Math.min(asked, max);
}
