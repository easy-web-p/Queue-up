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
  StudentProfile,
  WalletTopupRequest,
} from '../types/campus';

/** Current Bangkok calendar date as "YYYY-MM-DD" (matches the server's day boundary). */
function getBangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Today's spending, for display.
 *
 * The stored counter resets lazily — it is only rewritten on the next spend — so a
 * wallet last used yesterday still holds yesterday's total. Reading it raw would
 * report stale spending as today's. Presentation only; the Cloud Function remains
 * the authority on whether a limit is actually breached.
 */
export function getSpentTodaySatang(wallet: StudentWallet | null | undefined): number {
  if (!wallet || wallet.lastSpentDate !== getBangkokToday()) return 0;
  return Math.max(0, Number(wallet.spentTodaySatang) || 0);
}

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

export interface TopupResult {
  success: boolean;
  /**
   * True when the call recorded a REQUEST rather than crediting the wallet.
   *
   * A guardian's top-up is a request: nothing behind this call captures a
   * payment, so crediting on the guardian's word alone would let them mint
   * balance that buys real food from stalls the school then settles with.
   * Staff — who are handed the cash — confirm it afterwards, and only then does
   * the balance move. Staff's own top-ups credit immediately and return false.
   *
   * A caller that ignores this flag will tell a guardian their money arrived
   * when it has not.
   */
  pending?: boolean;
  requestId?: string;
  studentId: string;
  requestedSatang?: number;
  addedSatang?: number;
  newBalanceSatang?: number;
  newBalanceBaht?: number;
  message?: string;
}

/**
 * Top up a student wallet, or request one.
 *
 * See TopupResult.pending — the outcome depends on who is calling.
 */
export async function topupCampusWallet(
  studentId: string,
  amountSatang: number,
  note?: string,
  paymentMethod = 'PROMPTPAY'
): Promise<TopupResult> {
  const callable = httpsCallable<
    { studentId: string; amountSatang: number; note?: string; paymentMethod?: string },
    TopupResult
  >(functions, 'topupCampusWallet');

  const res = await callable({
    studentId,
    amountSatang,
    note,
    paymentMethod,
  });

  return res.data;
}

/** Staff confirming that a guardian's payment actually arrived. */
export async function reviewWalletTopupRequest(
  requestId: string,
  decision: 'CONFIRMED' | 'REJECTED',
  note?: string
): Promise<{ success: boolean; requestId: string; status: string; message: string }> {
  const callable = httpsCallable<
    { requestId: string; decision: string; note?: string },
    { success: boolean; requestId: string; status: string; message: string }
  >(functions, 'reviewWalletTopupRequest');
  const res = await callable({ requestId, decision, note });
  return res.data;
}

/**
 * A guardian's own top-up requests, newest first.
 *
 * Without this a parent records a request, walks to the office, and has no way
 * to tell whether it exists or whether staff have settled it — the balance
 * simply does not change and nothing says why.
 *
 * Filtered on `requestedBy` because that is the clause the security rule can
 * prove: a guardian may read their own requests and nobody else's, so an
 * unfiltered query is refused outright rather than silently trimmed.
 *
 * Ordered in the query rather than after it: `limit` applies before any sort
 * done here, so a parent with more than `max` requests would get an arbitrary
 * handful sorted, not their latest ones. The composite index this needs is in
 * firestore.indexes.json.
 */
export async function fetchMyTopupRequests(
  guardianUid: string,
  max = 10
): Promise<WalletTopupRequest[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'wallet_topup_requests'),
        where('requestedBy', '==', guardianUid),
        orderBy('createdAt', 'desc'),
        limit(max)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WalletTopupRequest);
  } catch (err) {
    console.error('[fetchMyTopupRequests] Error:', err);
    throw err;
  }
}

/**
 * Top-up requests awaiting staff confirmation, for the student the money is for.
 *
 * `fetchMyTopupRequests` filters on `requestedBy`, which is the guardian who
 * asked — a student would see nothing through it, and a pending request is
 * precisely what explains why their balance has not moved yet. The rules allow
 * a student to read a request whose `studentId` is their own uid.
 */
export async function fetchTopupRequestsForStudent(
  studentId: string,
  max = 10
): Promise<WalletTopupRequest[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'wallet_topup_requests'),
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc'),
        limit(max)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WalletTopupRequest);
  } catch (err) {
    // An unbuilt composite index or a tightened rule must not blank the whole
    // wallet page; the balance and the ledger are the point.
    console.error('[fetchTopupRequestsForStudent] Error:', err);
    return [];
  }
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
 * Review a guardian ↔ student link (Staff Supervisor / Admin).
 *
 * Verifying is what actually grants a guardian access: the Cloud Function writes
 * guardianIds onto the student and wallet documents, which is the field
 * firestore.rules reads. A PENDING link proves nothing on its own — anyone signed in
 * can create one claiming to be a guardian.
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

/**
 * One meal as the emergency lookup returns it.
 *
 * Deliberately narrower than Order: the lookup is an audited read of a
 * student's medical history, so it returns what a first responder needs to know
 * about what the student ate, and nothing about money, coupons or who paid.
 * Typing it as Order would invite a screen to display fields the Cloud Function
 * does not send.
 */
export interface EmergencyLookupOrder {
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
}

export interface EmergencyLookupResult {
  found: boolean;
  profile: StudentProfile | null;
  recentOrders: EmergencyLookupOrder[];
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
