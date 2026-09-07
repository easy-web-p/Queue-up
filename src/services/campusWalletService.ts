import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config.js';
import type {
  StudentWallet,
  WalletTransaction,
  ParentChildLink,
  VendorApprovalRequest,
  StudentProfile,
} from '../types/campus';

/**
 * Fetch Student Wallet balance and spending limits
 */
export async function fetchStudentWallet(studentId: string): Promise<StudentWallet | null> {
  try {
    const walletDoc = await getDoc(doc(db, 'wallets', studentId));
    if (!walletDoc.exists()) {
      return null;
    }
    return walletDoc.data() as StudentWallet;
  } catch (err) {
    console.error('[fetchStudentWallet] Error:', err);
    throw err;
  }
}

/**
 * Fetch Student Wallet Transactions history
 */
export async function fetchWalletTransactions(
  studentId: string,
  limitCount = 30
): Promise<WalletTransaction[]> {
  try {
    const q = query(
      collection(db, 'wallet_transactions'),
      where('studentId', '==', studentId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as WalletTransaction[];
  } catch (err) {
    console.error('[fetchWalletTransactions] Error:', err);
    // Fallback if index is building or unordered query
    try {
      const qFallback = query(
        collection(db, 'wallet_transactions'),
        where('studentId', '==', studentId),
        limit(limitCount)
      );
      const snap = await getDocs(qFallback);
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as WalletTransaction[];
    } catch (fallbackErr) {
      console.error('[fetchWalletTransactions] Fallback failed:', fallbackErr);
      return [];
    }
  }
}

/**
 * Top up student wallet balance via Cloud Function
 */
export async function topupCampusWallet(
  studentId: string,
  amountSatang: number,
  note?: string,
  paymentMethod = 'PROMPTPAY'
): Promise<{ success: boolean; newBalanceSatang: number; newBalanceBaht: number }> {
  const callable = httpsCallable<
    { studentId: string; amountSatang: number; note?: string; paymentMethod?: string },
    { success: boolean; newBalanceSatang: number; newBalanceBaht: number }
  >(functions, 'topupCampusWallet');

  const res = await callable({
    studentId,
    amountSatang,
    note,
    paymentMethod,
  });

  return res.data;
}

/**
 * Update spending limits & restricted categories
 */
export async function updateCampusWalletLimits(
  studentId: string,
  limits: {
    dailyLimitSatang?: number;
    weeklyLimitSatang?: number;
    blockedCategories?: string[];
    isLocked?: boolean;
  }
): Promise<{ success: boolean }> {
  const callable = httpsCallable<
    {
      studentId: string;
      dailyLimitSatang?: number;
      weeklyLimitSatang?: number;
      blockedCategories?: string[];
      isLocked?: boolean;
    },
    { success: boolean; message: string }
  >(functions, 'updateCampusWalletLimits');

  const res = await callable({
    studentId,
    ...limits,
  });

  return res.data;
}

/**
 * Fetch Linked Children for Guardian
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
 * Request to link a new student to guardian
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
 * Submit Vendor Approval Application for Student
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
 * Review Vendor Approval Application (Staff / Admin)
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
 * Emergency Medical & Allergy Lookup with Immutable Audit Logging.
 *
 * 🔒 The profile read and the audit write both happen inside the Cloud Function, so
 * the access cannot be made without leaving a record. This previously logged from the
 * client with a warn-only catch and then read `students/{id}` directly, which meant
 * dropping the log request was enough to read a child's health data untraced.
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
