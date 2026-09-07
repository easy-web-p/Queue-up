/**
 * ============================================================================
 * 🔒 CAMPUS WALLET AUTHORIZATION
 * ============================================================================
 *
 * A wallet holds real money and the spending controls a parent configured, so no
 * wallet mutation may be authorized by the student who benefits from it. Only two
 * principals are trusted:
 *
 *   1. Staff supervisors / admins — via custom claims, or via a row in
 *      `staff_supervisors`, which per firestore.rules only an admin can write.
 *   2. A guardian whose link to the student the school has verified.
 *
 * Guardian links are self-asserted at creation: firestore.rules lets any signed-in
 * user create a `parent_child_links` row with `guardianId == uid` as long as its
 * status is PENDING, and only a staff supervisor or admin may update it afterwards.
 * A PENDING link therefore proves nothing and is never honoured here — only links
 * the school has moved to VERIFIED (or flagged `verifiedBySchool`) count.
 *
 * This module is deliberately free of firebase-admin and firebase-functions imports:
 * `db` is injected and decisions are returned rather than thrown, so the rules below
 * can be exercised directly by tests. index.js maps the results onto HttpsError.
 */

// Upper bound on a single top-up, to cap the blast radius of a typo or a
// compromised staff/guardian session. 20,000 THB.
export const MAX_TOPUP_SATANG = 2000000;

export async function isStaffOrAdmin(db, auth) {
  const token = auth.token || {};
  if (token.admin === true || token.role === "admin" || token.role === "staff_supervisor") {
    return true;
  }
  // Fallback for staff whose custom claims have not been refreshed on their session yet.
  const staffDoc = await db.collection("staff_supervisors").doc(auth.uid).get();
  return staffDoc.exists === true;
}

export async function isVerifiedGuardianOf(db, auth, studentId) {
  // Source 1: guardians recorded on the wallet itself (backend-written only).
  // This is the same field firestore.rules trusts to grant guardians read access.
  const walletSnap = await db.collection("wallets").doc(studentId).get();
  if (walletSnap.exists === true) {
    const guardianIds = walletSnap.data().guardianIds;
    if (Array.isArray(guardianIds) && guardianIds.includes(auth.uid)) {
      return true;
    }
  }

  // Source 2: a school-verified parent-child link. PENDING links are ignored.
  const linkSnap = await db
    .collection("parent_child_links")
    .where("guardianId", "==", auth.uid)
    .where("studentId", "==", studentId)
    .limit(10)
    .get();

  return linkSnap.docs.some((d) => {
    const link = d.data();
    return link.status === "VERIFIED" || link.verifiedBySchool === true;
  });
}

/**
 * Decides whether `auth` may act on `studentId`'s wallet.
 *
 * `allowSelf` must be false for operations a student may never authorize for
 * themselves — topping up their own balance, or relaxing their own spending
 * controls. It is true only for spending, where the student is the legitimate actor.
 *
 * @returns {Promise<{allowed: true, role: 'SELF'|'STAFF'|'GUARDIAN'} |
 *                   {allowed: false, reason: 'SELF_SERVICE_FORBIDDEN'|'WALLET_AUTHORITY_REQUIRED'}>}
 */
export async function resolveWalletAuthority(db, auth, studentId, { allowSelf }) {
  if (allowSelf && studentId === auth.uid) {
    return { allowed: true, role: "SELF" };
  }

  if (await isStaffOrAdmin(db, auth)) {
    return { allowed: true, role: "STAFF" };
  }

  // Reached only when allowSelf is false: the student is acting on their own wallet
  // and is not staff. Reported separately so the caller can explain why.
  if (studentId === auth.uid) {
    return { allowed: false, reason: "SELF_SERVICE_FORBIDDEN" };
  }

  if (await isVerifiedGuardianOf(db, auth, studentId)) {
    return { allowed: true, role: "GUARDIAN" };
  }

  return { allowed: false, reason: "WALLET_AUTHORITY_REQUIRED" };
}
