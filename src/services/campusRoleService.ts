/**
 * ============================================================================
 * 🎖️  CAMPUS ROLE ADMINISTRATION
 * ============================================================================
 *
 * The client half of setCampusStaffRole. Deliberately thin: every decision about
 * who may grant what lives in the Cloud Function, because a check made here is a
 * check an attacker can skip. This module exists so the admin screen does not
 * have to know the callable's name or shape.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config.js';

/** Roles an admin can hand out. Mirrors GRANTABLE_ROLES in functions/campusClaims.js. */
export const GRANTABLE_ROLES = ['staff_supervisor', 'student_vendor', 'merchant'] as const;
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

export const ROLE_LABELS: Record<GrantableRole, string> = {
  staff_supervisor: 'เจ้าหน้าที่ผู้ดูแล (Staff Supervisor)',
  student_vendor: 'นักเรียนผู้ขาย (Student Vendor)',
  merchant: 'ร้านค้า (Merchant)',
};

export interface SetStaffRoleInput {
  /** Either uid or email — the function resolves an email to a uid. */
  targetUid?: string;
  targetEmail?: string;
  role: GrantableRole;
  enabled: boolean;
  note?: string;
}

export interface SetStaffRoleResult {
  success: boolean;
  targetUid: string;
  targetEmail: string | null;
  role: GrantableRole;
  enabled: boolean;
  /** Always true: the target keeps their old token, and its claims, until they sign in again. */
  requiresReauth: boolean;
  message: string;
}

/**
 * Grants or revokes a campus role.
 *
 * Throws on failure rather than returning a flag — a role grant that quietly
 * did nothing is the failure mode this whole area was built to avoid, and a
 * caller that ignores a thrown error at least does so visibly.
 */
export async function setCampusStaffRole(input: SetStaffRoleInput): Promise<SetStaffRoleResult> {
  if (!input.targetUid && !input.targetEmail) {
    throw new Error('กรุณาระบุอีเมลหรือ UID ของผู้ใช้ที่ต้องการกำหนดสิทธิ์');
  }

  const callable = httpsCallable<SetStaffRoleInput, SetStaffRoleResult>(
    functions,
    'setCampusStaffRole'
  );
  const response = await callable({
    targetUid: input.targetUid,
    targetEmail: input.targetEmail,
    role: input.role,
    enabled: input.enabled,
    note: input.note,
  });

  return response.data;
}
