import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config.js';
import type {
  ParentChildLink,
  StudentProfile,
} from '../types/campus';

/**
 * 👪 Fetch Linked Children for Guardian
 */
export async function fetchParentChildLinks(guardianId: string): Promise<ParentChildLink[]> {
  try {
    const q = query(
      collection(db, 'parent_child_links'),
      where('guardianId', '==', guardianId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ParentChildLink[];
  } catch (err) {
    console.error('[fetchParentChildLinks] Error:', err);
    return [];
  }
}

/**
 * 👪 Request to link a new student to guardian
 */
export async function createParentChildLink(
  guardianId: string,
  guardianName: string,
  studentId: string,
  studentName: string,
  relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN'
): Promise<{ id: string }> {
  const docRef = await addDoc(collection(db, 'parent_child_links'), {
    guardianId,
    studentId,
    guardianName,
    studentName,
    relationship,
    verifiedByGuardian: true,
    verifiedBySchool: false,
    status: 'PENDING',
    createdAt: serverTimestamp(),
  });

  return { id: docRef.id };
}

/**
 * 🔒 Review a guardian ↔ student link (Staff Supervisor / Admin).
 *
 * Verifying is what actually grants a guardian access: the Cloud Function writes
 * guardianIds onto the student document, which is the field firestore.rules reads.
 */
export async function reviewParentChildLink(
  linkId: string,
  decision: 'VERIFIED' | 'REJECTED' | 'REVOKED',
  note?: string
): Promise<{ success: boolean; linkId: string; status: string; message: string }> {
  const callable = httpsCallable<
    { linkId: string; decision: string; note?: string },
    { success: boolean; linkId: string; status: string; message: string }
  >(functions, 'reviewParentChildLink');

  const res = await callable({ linkId, decision, note });
  return res.data;
}

/**
 * 🏪 Submit Vendor Approval Application for Student
 */
export async function submitVendorApproval(payload: {
  studentName: string;
  studentCode: string;
  class: string;
  room?: string;
  shopName: string;
  requestedZone: string;
  productCategories: string[];
  menuPreview: Array<{ name: string; price: number; description?: string }>;
}): Promise<{ success: boolean; approvalId: string; message: string }> {
  const callable = httpsCallable<
    typeof payload,
    { success: boolean; approvalId: string; message: string }
  >(functions, 'submitVendorApprovalRequest');

  const res = await callable(payload);
  return res.data;
}

/**
 * 🔒 Review Vendor Approval Application (Staff / Admin)
 */
export async function reviewVendorApproval(
  approvalId: string,
  decision: 'APPROVED' | 'REJECTED',
  rejectionReason?: string
): Promise<{ success: boolean; status: string; message: string }> {
  const callable = httpsCallable<
    { approvalId: string; decision: string; rejectionReason?: string },
    { success: boolean; status: string; message: string }
  >(functions, 'reviewVendorApprovalRequest');

  const res = await callable({
    approvalId,
    decision,
    rejectionReason,
  });
  return res.data;
}

export interface EmergencyLookupResult {
  found: boolean;
  profile: StudentProfile | null;
  recentOrders: Array<{
    id: string;
    queueNumber: string | null;
    status: string | null;
    storeId: string | null;
    pickupDate: string | null;
    pickupTime: string | null;
    createdAt: string | null;
    items: Array<{
      name: string;
      quantity: number;
      customNotes?: string;
      selectedModifiers?: Array<{ modifierGroupId?: string; optionId?: string; name?: string }>;
    }>;
  }>;
}

/**
 * 🚨 Emergency Medical & Allergy Lookup with Immutable Audit Logging.
 *
 * @param studentQuery - the student's uid, or the studentCode printed on their card
 */
export async function emergencyMedicalLookup(
  studentQuery: string,
  reason?: string
): Promise<EmergencyLookupResult> {
  const callable = httpsCallable<
    { studentQuery: string; reason?: string },
    { success: boolean; auditId: string } & EmergencyLookupResult
  >(functions, 'emergencyMedicalLookup');

  const res = await callable({ studentQuery, reason });
  return {
    found: res.data.found,
    profile: res.data.profile,
    recentOrders: res.data.recentOrders || [],
  };
}
