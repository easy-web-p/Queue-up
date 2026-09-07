/**
 * ============================================================================
 * 👪 GUARDIAN LINK REVIEW — DECISION RULES
 * ============================================================================
 *
 * What a staff decision may do to a parent_child_links row, and what access that
 * decision grants or withdraws.
 *
 * A link is self-asserted at creation: firestore.rules lets any signed-in user
 * create a row with `guardianId == uid` while its status is PENDING, and the
 * `verifiedByGuardian` flag on it is client-supplied. Only the school's decision,
 * recorded here, makes a link mean anything.
 *
 * Approval is not merely a status change — it writes `guardianIds` onto the student
 * and wallet documents, which is the field firestore.rules reads to grant a guardian
 * access. So the grant and the withdrawal are modelled explicitly rather than left
 * implicit in the caller.
 *
 * Pure and dependency-free, so the transitions can be exercised directly by tests.
 */

export const LINK_DECISIONS = ['VERIFIED', 'REJECTED', 'REVOKED'];

/**
 * @param {string} currentStatus - the link's stored status
 * @param {string} decision - VERIFIED | REJECTED | REVOKED
 * @returns {{ok: true, nextStatus: string, grantsAccess: boolean, revokesAccess: boolean}
 *          | {ok: false, reason: string}}
 */
export function resolveLinkDecision(currentStatus, decision) {
  if (!LINK_DECISIONS.includes(decision)) {
    return { ok: false, reason: 'INVALID_DECISION' };
  }

  const status = currentStatus || 'PENDING';

  if (decision === 'REVOKED') {
    // Revocation exists to undo a grant, so there must be a grant to undo.
    if (status !== 'VERIFIED') {
      return { ok: false, reason: 'REVOKE_REQUIRES_VERIFIED' };
    }
    return { ok: true, nextStatus: 'REJECTED', grantsAccess: false, revokesAccess: true };
  }

  // A decision is made once. Re-deciding a settled link would silently re-grant or
  // re-remove access; revocation is the explicit path for undoing an approval.
  if (status !== 'PENDING') {
    return { ok: false, reason: 'LINK_ALREADY_REVIEWED' };
  }

  if (decision === 'VERIFIED') {
    return { ok: true, nextStatus: 'VERIFIED', grantsAccess: true, revokesAccess: false };
  }

  return { ok: true, nextStatus: 'REJECTED', grantsAccess: false, revokesAccess: false };
}
