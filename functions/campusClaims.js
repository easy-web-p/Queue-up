/**
 * ============================================================================
 * 🎖️  CUSTOM CLAIM GRANTS
 * ============================================================================
 *
 * Firebase custom claims are the only thing firestore.rules trusts for a
 * privileged role, which makes two properties of setCustomUserClaims dangerous
 * if you forget them:
 *
 *  1. **It replaces, it does not merge.** `setCustomUserClaims(uid, {role:'x'})`
 *     erases every other claim that user had. The vendor-approval path called it
 *     exactly that way, so approving a shop for someone who also supervised the
 *     canteen would have silently stripped their supervisor role — and nothing
 *     would have reported it, because the approval itself succeeded.
 *
 *  2. **The token does not update until it is refreshed.** A user who is granted
 *     a role keeps their old token, and its claims, for up to an hour. Every
 *     grant here therefore also writes a Firestore record, which the backend
 *     consults as a fallback, and the caller is told the user must sign in again.
 *
 * The decision rules are pure and live here so they can be tested without the
 * Admin SDK; index.js does the awaiting and the throwing.
 */

/** Roles a campus admin may hand out. Anything else is rejected outright. */
export const GRANTABLE_ROLES = Object.freeze(["staff_supervisor", "student_vendor", "merchant"]);

/**
 * Claim keys this system owns. A merge preserves everything else on the token
 * (Firebase's own reserved fields never reach here) but must be able to *clear*
 * its own keys on revocation, which a naive spread cannot do.
 */
export const MANAGED_CLAIM_KEYS = Object.freeze(["role", "staffSupervisor", "admin"]);

/**
 * The claims a user should end up with after granting or revoking `role`.
 *
 * @param {object|null} existingClaims - claims currently on the user's token
 * @param {string} role - one of GRANTABLE_ROLES
 * @param {boolean} enabled - true to grant, false to revoke
 * @returns {object} the complete claim set to write
 */
export function buildClaimPatch(existingClaims, role, enabled) {
  if (!GRANTABLE_ROLES.includes(role)) {
    throw new Error(`buildClaimPatch: ${role} is not a grantable role`);
  }

  // Start from what the user already has, so unrelated claims survive.
  const next = { ...(existingClaims || {}) };

  // Never let a grant mint an admin. Admin comes from the bootstrap list alone,
  // so that the set of people who can appoint staff cannot itself be grown from
  // inside the app — one compromised staff account would otherwise be enough to
  // manufacture a second admin and lock the real one out.
  delete next.admin;

  if (enabled) {
    next.role = role;
    if (role === "staff_supervisor") {
      next.staffSupervisor = true;
    }
  } else {
    // Revoking the role the user currently holds drops them back to a plain
    // customer. Revoking a role they do not hold leaves them alone — so
    // revoking "merchant" from a supervisor cannot be used to strip supervision.
    if (next.role === role) {
      delete next.role;
    }
    if (role === "staff_supervisor") {
      delete next.staffSupervisor;
    }
  }

  return next;
}

/**
 * Whether `actorClaims` / `actorEmail` may hand out campus roles.
 *
 * Deliberately admin-only. A staff supervisor approving vendors is one thing;
 * a staff supervisor appointing more staff supervisors is an escalation path
 * that never closes.
 *
 * @param {object|null} actorClaims - the caller's verified token claims
 * @param {string} actorEmail - the caller's verified email
 * @param {(email: string) => boolean} isBootstrapSuperAdmin
 */
export function canGrantRoles(actorClaims, actorEmail, isBootstrapSuperAdmin) {
  const claims = actorClaims || {};
  if (claims.admin === true || claims.role === "admin") return true;
  return isBootstrapSuperAdmin(actorEmail);
}

/**
 * Is this caller an administrator?
 *
 * Claims only. recordMerchantAuditLog used to answer this by reading `role` and
 * `admin` off users/{uid} — the caller's own profile document. firestore.rules
 * refuses a self-assigned admin flag there, so the escalation was not live, but
 * the Admin SDK bypasses those rules: the only thing standing between a user and
 * admin was a rule enforced in a different file, which has regressed before.
 *
 * Lives here rather than inline so a test can call the real decision instead of
 * re-implementing it — the suite covering that function modelled the old logic
 * by hand and kept passing after the function changed.
 *
 * @param {object|null} claims - the caller's verified token claims
 * @param {(email: string) => boolean} isBootstrapSuperAdmin
 */
export function isCallerAdmin(claims, isBootstrapSuperAdmin) {
  const token = claims || {};
  if (token.admin === true || token.role === "admin") return true;
  return isBootstrapSuperAdmin(token.email || "");
}

/**
 * Validates a grant request before anything is written.
 *
 * @returns {{ok: true, role: string, enabled: boolean} | {ok: false, reason: string}}
 */
export function validateGrantRequest({ targetUid, role, enabled }, actorUid) {
  if (typeof targetUid !== "string" || targetUid.trim() === "") {
    return { ok: false, reason: "TARGET_REQUIRED" };
  }
  if (!GRANTABLE_ROLES.includes(role)) {
    return { ok: false, reason: "ROLE_NOT_GRANTABLE" };
  }
  if (typeof enabled !== "boolean") {
    return { ok: false, reason: "ENABLED_REQUIRED" };
  }
  // An admin revoking their own supervisor role is harmless; an admin granting
  // themselves anything is a self-elevation we would rather not have in the log.
  if (targetUid === actorUid && enabled) {
    return { ok: false, reason: "SELF_GRANT_FORBIDDEN" };
  }
  return { ok: true, role, enabled };
}
