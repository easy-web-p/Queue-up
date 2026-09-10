import { HttpsError } from "firebase-functions/v2/https";

/**
 * 🔒 Verify Guardian Authorization on Student IDOR Guard
 *
 * Ensures that a user cannot attach arbitrary student IDs to their order
 * or access another student's allergy/dietary profile.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} authUid - Authenticated caller UID
 * @param {object} tokenClaims - Custom claims from request.auth.token
 * @param {string|null} cleanStudentId - Requested student ID
 * @param {FirebaseFirestore.Transaction} [tx] - Optional transaction
 * @returns {Promise<{ isAuthorized: boolean, relationship: 'SELF' | 'GUARDIAN' | 'ADMIN' }>}
 */
export async function verifyStudentAuthority(db, authUid, tokenClaims = {}, cleanStudentId, tx = null) {
  if (!cleanStudentId) {
    return { isAuthorized: true, relationship: 'SELF' };
  }

  // 1. Student ordering for self
  if (cleanStudentId === authUid) {
    return { isAuthorized: true, relationship: 'SELF' };
  }

  // 2. Admin or Staff Supervisor override
  const isAdmin = tokenClaims?.admin === true || tokenClaims?.role === 'admin';
  const isSupervisor = tokenClaims?.staff_supervisor === true || tokenClaims?.staffSupervisor === true || tokenClaims?.role === 'staff_supervisor';
  if (isAdmin || isSupervisor) {
    return { isAuthorized: true, relationship: 'ADMIN' };
  }

  // 3. Check student document directly (in case caller's UID is in guardianIds)
  const studentRef = db.collection("students").doc(cleanStudentId);
  const studentSnap = tx ? await tx.get(studentRef) : await studentRef.get();
  if (studentSnap.exists) {
    const sData = studentSnap.data();
    if (Array.isArray(sData.guardianIds) && sData.guardianIds.includes(authUid)) {
      return { isAuthorized: true, relationship: 'GUARDIAN' };
    }
  }

  // 4. Check active relationship in parent_child_links
  // Query for verified link between this guardian and student
  const linkQuery = db.collection("parent_child_links")
    .where("guardianId", "==", authUid)
    .where("studentId", "==", cleanStudentId)
    .where("status", "==", "VERIFIED")
    .limit(1);

  const linkSnap = tx ? await tx.get(linkQuery) : await linkQuery.get();
  if (!linkSnap.empty) {
    return { isAuthorized: true, relationship: 'GUARDIAN' };
  }

  throw new HttpsError(
    "permission-denied",
    `UNAUTHORIZED_STUDENT_ACCESS: คุณไม่มีสิทธิ์สั่งอาหารในนามของนักเรียนรหัส ${cleanStudentId} (ต้องได้รับการอนุมัติความสัมพันธ์ผู้ปกครองก่อน)`
  );
}
