/**
 * ⚠️  GENERATED FILE — do not edit.
 *
 * Source: config/super-admins.js   Regenerate: npm run sync:admins
 *
 * Cloud Functions deploy from functions/ alone, so this directory cannot import
 * the canonical module one level up. The list is copied in instead, and
 * test-super-admin-sync.js fails the build if this copy drifts from the source.
 */

export const SUPER_ADMIN_EMAILS = Object.freeze([
  "58140@lomsak.ac.th",
  "hi00000087@gmail.com",
  "easy.web.p@gmail.com",
]);

/**
 * Is this the bootstrap root of trust?
 *
 * Used only where a decision must be possible before any admin claim exists —
 * granting the very first staff role. Everywhere else, authority comes from a
 * verified custom claim.
 */
export function isBootstrapSuperAdmin(email) {
  if (typeof email !== "string") return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
