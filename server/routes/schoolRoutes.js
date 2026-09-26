/**
 * Institutional (multi-tenant) administration.
 *
 * Two gaps this closes:
 *
 * 1. Roster import ran entirely in the browser, writing school_members one
 *    document at a time. A 1,000-student roster meant 1,000 sequential
 *    round-trips, and a tab closed halfway through left the school half
 *    imported.
 * 2. Nothing ever issued Firebase custom claims. firestore.rules authorises on
 *    request.auth.token.role / .schoolId / .storeId, and the client reads the
 *    same claims — but no code set them, so every claim-based rule was inert
 *    and every school admin was indistinguishable from a customer.
 */

import { Router } from 'express';
import { adminDb, adminAuth } from '../firebaseAdmin.js';
import {
  authenticate,
  requireSuperAdmin,
  requireSchoolAdmin,
  isSuperAdmin
} from '../middleware/authenticate.js';

export const schoolRouter = Router();

/** Firestore caps a write batch at 500 operations. */
const BATCH_LIMIT = 500;

const MEMBER_ROLES = new Set(['student', 'admin', 'staff', 'teacher']);

/**
 * Normalises one roster row into a school_members document.
 * Returns null when the row is unusable, so a single bad line cannot abort an
 * otherwise valid import.
 */
function toMemberDoc(schoolId, row, now) {
  const identifier = String(row?.id ?? row?.identifier ?? '').trim();
  const email = String(row?.email ?? '').trim().toLowerCase();
  const fullName = String(row?.fullName ?? '').trim();

  if (!identifier || !email || !fullName) return null;
  if (!email.includes('@')) return null;

  const rawRole = String(row?.type ?? row?.role ?? 'student').trim().toLowerCase();
  const role = MEMBER_ROLES.has(rawRole) ? rawRole : 'student';

  return {
    id: `${schoolId}_${identifier}`,
    schoolId,
    identifier,
    fullName,
    email,
    phone: row?.phone ? String(row.phone).trim() : null,
    classRoom: row?.classRoom ? String(row.classRoom).trim() : null,
    role,
    status: 'active',
    isRegistered: false,
    claimedByUid: null,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Writes roster documents in batches, preserving any claim already made:
 * re-importing a roster must never unclaim an account that a real student is
 * already signed in with.
 */
async function writeRoster(schoolId, members) {
  const written = [];

  for (let offset = 0; offset < members.length; offset += BATCH_LIMIT) {
    const slice = members.slice(offset, offset + BATCH_LIMIT);
    const existing = await Promise.all(
      slice.map((member) => adminDb.collection('school_members').doc(member.id).get())
    );

    const batch = adminDb.batch();
    slice.forEach((member, index) => {
      const prior = existing[index].exists ? existing[index].data() : null;
      const merged = prior
        ? {
            ...member,
            createdAt: prior.createdAt || member.createdAt,
            claimedByUid: prior.claimedByUid ?? null,
            isRegistered: prior.isRegistered === true,
            claimedAt: prior.claimedAt || null
          }
        : member;

      batch.set(adminDb.collection('school_members').doc(member.id), merged, { merge: true });
      written.push(member.id);
    });

    await batch.commit();
  }

  return written;
}

/** Re-issues a user's custom claims, keeping the ones this call does not set. */
async function mergeCustomClaims(uid, updates) {
  let current = {};
  try {
    const user = await adminAuth.getUser(uid);
    current = user?.customClaims || {};
  } catch {
    // A user record that cannot be read yet still gets the new claims.
  }
  const next = { ...current, ...updates };
  await adminAuth.setCustomUserClaims(uid, next);
  return next;
}

/**
 * POST /api/schools/applications/:applicationId/approve
 * Creates the school and imports its roster in one server-side operation.
 */
schoolRouter.post('/applications/:applicationId/approve', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const appRef = adminDb.collection('school_applications').doc(applicationId);
    const appSnap = await appRef.get();

    if (!appSnap.exists) {
      return res.status(404).json({ success: false, error: 'APPLICATION_NOT_FOUND' });
    }

    const application = appSnap.data();
    if (application.status === 'approved') {
      return res.status(200).json({
        success: true,
        alreadyApproved: true,
        schoolId: application.approvedSchoolId || application.schoolData?.schoolCode
      });
    }

    const schoolId = application.schoolData?.schoolCode || `SCH_${Date.now()}`;
    const now = new Date().toISOString();

    const rows = Array.isArray(application.parsedMembers) ? application.parsedMembers : [];
    const members = rows.map((row) => toMemberDoc(schoolId, row, now)).filter(Boolean);
    const skipped = rows.length - members.length;

    await adminDb.collection('schools').doc(schoolId).set({
      schoolId,
      schoolCode: application.schoolData?.schoolCode || schoolId,
      schoolName: application.schoolData?.schoolName || schoolId,
      province: application.schoolData?.province || '',
      contactEmail: application.schoolData?.contactEmail || '',
      contactPhone: application.schoolData?.contactPhone || '',
      emailDomain: application.schoolData?.emailDomain || null,
      status: 'active',
      totalStudents: members.filter((m) => m.role === 'student').length,
      totalAdmins: members.filter((m) => m.role !== 'student').length,
      totalStores: 0,
      createdAt: application.submittedAt || now,
      approvedAt: now
    }, { merge: true });

    const written = await writeRoster(schoolId, members);

    await appRef.update({
      status: 'approved',
      approvedSchoolId: schoolId,
      reviewedAt: now,
      reviewedBy: req.user.uid,
      importedMemberCount: written.length,
      skippedMemberCount: skipped
    });

    return res.status(200).json({
      success: true,
      schoolId,
      importedMemberCount: written.length,
      skippedMemberCount: skipped
    });
  } catch (err) {
    console.error('[School API] Approve error:', err);
    return res.status(500).json({ success: false, error: 'APPROVAL_FAILED', message: err.message });
  }
});

/**
 * POST /api/schools/applications/:applicationId/reject
 */
schoolRouter.post('/applications/:applicationId/reject', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { rejectionReason = '' } = req.body;
    const appRef = adminDb.collection('school_applications').doc(applicationId);

    if (!(await appRef.get()).exists) {
      return res.status(404).json({ success: false, error: 'APPLICATION_NOT_FOUND' });
    }

    await appRef.update({
      status: 'rejected',
      rejectionReason,
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.user.uid
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[School API] Reject error:', err);
    return res.status(500).json({ success: false, error: 'REJECTION_FAILED', message: err.message });
  }
});

/**
 * POST /api/schools/:schoolId/roster
 * Bulk upsert of roster rows parsed from a CSV or spreadsheet.
 */
schoolRouter.post('/:schoolId/roster', authenticate, requireSchoolAdmin(), async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { members: rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'EMPTY_ROSTER',
        message: 'members must be a non-empty array.'
      });
    }

    if (rows.length > 10000) {
      return res.status(413).json({
        success: false,
        error: 'ROSTER_TOO_LARGE',
        message: 'Import at most 10,000 rows per request.'
      });
    }

    if (!(await adminDb.collection('schools').doc(schoolId).get()).exists) {
      return res.status(404).json({ success: false, error: 'SCHOOL_NOT_FOUND' });
    }

    const now = new Date().toISOString();
    const members = rows.map((row) => toMemberDoc(schoolId, row, now)).filter(Boolean);
    const skipped = rows.length - members.length;

    if (members.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_VALID_ROWS',
        message: 'ไม่มีแถวใดที่มี รหัสประจำตัว, ชื่อ-สกุล และอีเมลครบถ้วน'
      });
    }

    const written = await writeRoster(schoolId, members);

    await adminDb.collection('schools').doc(schoolId).set({
      totalStudents: members.filter((m) => m.role === 'student').length,
      totalAdmins: members.filter((m) => m.role !== 'student').length,
      rosterUpdatedAt: now
    }, { merge: true });

    return res.status(200).json({
      success: true,
      schoolId,
      importedMemberCount: written.length,
      skippedMemberCount: skipped
    });
  } catch (err) {
    console.error('[School API] Roster import error:', err);
    return res.status(500).json({ success: false, error: 'ROSTER_IMPORT_FAILED', message: err.message });
  }
});

/**
 * POST /api/schools/membership/claim
 * The signed-in user claims the roster record matching their verified email,
 * and the server issues the custom claims the rules and the UI read.
 */
schoolRouter.post('/membership/claim', authenticate, async (req, res) => {
  try {
    const email = (req.user.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, error: 'NO_EMAIL_ON_ACCOUNT' });
    }

    const snap = await adminDb.collection('school_members')
      .where('email', '==', email)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        success: false,
        error: 'NOT_ON_ANY_ROSTER',
        message: 'ไม่พบอีเมลนี้ในรายชื่อสมาชิกของสถานศึกษาใด'
      });
    }

    const memberDoc = snap.docs[0];
    const member = memberDoc.data();

    // Anti-hijack: a roster row already bound to another account is never
    // rebound, even though the email matches.
    if (member.claimedByUid && member.claimedByUid !== req.user.uid) {
      console.warn(`[School API] Duplicate claim on ${memberDoc.id} by ${req.user.uid}`);
      return res.status(409).json({
        success: false,
        error: 'ROSTER_ALREADY_CLAIMED',
        message: 'สิทธิ์นี้ถูกใช้งานโดยบัญชีอื่นแล้ว กรุณาติดต่อผู้ดูแลสถานศึกษา'
      });
    }

    const now = new Date().toISOString();
    if (!member.isRegistered || member.claimedByUid !== req.user.uid) {
      await memberDoc.ref.update({
        claimedByUid: req.user.uid,
        userId: req.user.uid,
        isRegistered: true,
        claimedAt: now,
        updatedAt: now
      });
    }

    // Role and schoolId come from the roster, never from the request.
    const claims = await mergeCustomClaims(req.user.uid, {
      role: member.role === 'student' ? 'customer' : member.role,
      schoolId: member.schoolId
    });

    await adminDb.collection('users').doc(req.user.uid).set({
      schoolId: member.schoolId,
      role: claims.role,
      studentOrStoreId: member.identifier,
      displayName: member.fullName,
      email: member.email,
      updatedAt: now
    }, { merge: true });

    return res.status(200).json({
      success: true,
      claimed: true,
      schoolId: member.schoolId,
      role: claims.role,
      // The client must refresh its ID token before the new claims appear.
      refreshTokenRequired: true
    });
  } catch (err) {
    console.error('[School API] Claim error:', err);
    return res.status(500).json({ success: false, error: 'CLAIM_FAILED', message: err.message });
  }
});

/**
 * POST /api/schools/users/:uid/claims
 * Platform administration: grant or revoke the claims that drive both
 * firestore.rules and the server's own authorization checks.
 */
schoolRouter.post('/users/:uid/claims', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const { role, schoolId, storeId, admin } = req.body;

    const allowedRoles = ['customer', 'merchant', 'admin', 'super_admin'];
    if (role !== undefined && role !== null && !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ROLE',
        message: `role must be one of ${allowedRoles.join(', ')}`
      });
    }

    // Only the keys actually supplied are changed; null clears one.
    const updates = {};
    if (role !== undefined) updates.role = role;
    if (schoolId !== undefined) updates.schoolId = schoolId;
    if (storeId !== undefined) updates.storeId = storeId;
    if (admin !== undefined) updates.admin = admin === true;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'NO_CLAIMS_SUPPLIED' });
    }

    const claims = await mergeCustomClaims(uid, updates);

    await adminDb.collection('users').doc(uid).set({
      role: claims.role || 'customer',
      schoolId: claims.schoolId || null,
      storeId: claims.storeId || null,
      claimsUpdatedAt: new Date().toISOString(),
      claimsUpdatedBy: req.user.uid
    }, { merge: true });

    return res.status(200).json({ success: true, uid, claims, refreshTokenRequired: true });
  } catch (err) {
    console.error('[School API] Set claims error:', err);
    return res.status(500).json({ success: false, error: 'SET_CLAIMS_FAILED', message: err.message });
  }
});

/**
 * GET /api/schools/users/:uid/claims
 * Read back what a user currently carries, for the admin console.
 */
schoolRouter.get('/users/:uid/claims', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const user = await adminAuth.getUser(req.params.uid);
    return res.status(200).json({ success: true, uid: req.params.uid, claims: user?.customClaims || {} });
  } catch (err) {
    return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: err.message });
  }
});
