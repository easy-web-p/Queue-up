/**
 * ============================================================================
 * 🗑️ ACCOUNT DELETION — CLIENT SIDE
 * ============================================================================
 *
 * One call. The browser cannot do any of this itself: it cannot delete a
 * Firebase Auth user, it cannot read the collections that hold the person's
 * records, and deciding which of its own records to keep is not a decision a
 * client gets to make.
 *
 * What it replaces deleted `users/{uid}` from the browser, swallowed the
 * failure with `console.warn`, and showed "ลบข้อมูล...เรียบร้อยแล้ว" whether
 * that worked or not — while the Auth account, the wallet, the orders and the
 * child's allergy record all stayed exactly where they were.
 */

import { httpsCallable } from 'firebase/functions';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { auth, functions } from '../firebase/config.js';

export interface DeleteAccountResult {
  success: boolean;
  /** Documents removed, by collection. */
  deleted: Record<string, number>;
  /** Documents kept with every naming field stripped, by collection. */
  anonymised: Record<string, number>;
  /** Collections deliberately left alone — the ledger and the audit trail. */
  retained: string[];
  message: string;
}

/**
 * Delete the signed-in account.
 *
 * Throws rather than resolving when the server refuses — an unsettled wallet,
 * an order a stall is still cooking, the last admin account. The caller must
 * show that message: a refusal reported as success is how someone walks away
 * believing their data is gone.
 */
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  const callable = httpsCallable<Record<string, never>, DeleteAccountResult>(
    functions,
    'deleteMyAccount'
  );
  const res = await callable({});
  return res.data;
}

/**
 * Prove the person at the keyboard is the account holder, moments ago.
 *
 * The delete dialog already asked for a password. It checked that the box was
 * non-empty and then threw the value away — a password field that authenticates
 * nothing, guarding the one irreversible action in the app. Anyone at an
 * unlocked screen could type four characters and erase the account.
 *
 * Firebase calls this reauthentication and requires it for destructive
 * operations precisely because a session token can be hours old. Deleting
 * through the Admin SDK skips that check, so it has to happen here instead —
 * which means it has to actually happen.
 *
 * @throws the Firebase auth error when the password is wrong or the popup is
 *   dismissed. A failure here must stop the deletion, not be logged past.
 */
export async function reauthenticateForDeletion(password?: string): Promise<void> {
  const current = auth.currentUser;
  if (!current) throw new Error('ไม่พบผู้ใช้ที่เข้าสู่ระบบอยู่ กรุณาเข้าสู่ระบบใหม่');

  const usesPassword = current.providerData.some((p) => p.providerId === 'password');

  if (usesPassword) {
    if (!password) throw new Error('กรุณากรอกรหัสผ่านเพื่อยืนยันตัวตน');
    if (!current.email) throw new Error('บัญชีนี้ไม่มีอีเมลสำหรับยืนยันตัวตน');
    await reauthenticateWithCredential(
      current,
      EmailAuthProvider.credential(current.email, password)
    );
    return;
  }

  // Signed in with Google and no password to ask for. The popup is the proof.
  await reauthenticateWithPopup(current, new GoogleAuthProvider());
}

/** Does this account sign in with a password, or only through Google? */
export function accountUsesPassword(): boolean {
  return (auth.currentUser?.providerData || []).some((p) => p.providerId === 'password');
}
