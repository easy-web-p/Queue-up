/**
 * Centralized Role-Based Access Control (RBAC) & Authorization Helpers
 * Single source of truth across UI, Redux, Context, and Route Guards.
 * 
 * 🔒 Security Policy:
 * 1. Unverified cached sessions (e.g. from LocalStorage) can NEVER claim privileged roles.
 * 2. Super Admin & Merchant roles are granted ONLY when `user.isVerifiedAuth === true` (officially verified by Firebase Auth).
 */

export const SUPER_ADMIN_EMAIL = "58140@lomsak.ac.th";

/**
 * Derives the list of effective roles for a user.
 * - If user session is unverified / from cache -> strictly ['customer'].
 * - Super Admin -> ['customer', 'merchant', 'admin'].
 * - Verified Merchant -> ['customer', 'merchant'].
 * - Normal Customer -> ['customer'].
 */
export function getEffectiveRoles(user) {
  if (!user) return ["guest"];

  // 🔒 LocalStorage Spoofing Guard: Unverified cached objects CANNOT claim elevated roles
  if (user.isFromCache === true || user.isVerifiedAuth !== true) {
    return ["customer"];
  }

  // Super Admin privilege (only for verified Firebase Auth sessions)
  const email = (user.email || "").toLowerCase().trim();
  const isSuperAdmin = Boolean(
    user.isSuperAdmin === true ||
    user.admin === true ||
    (user.isTokenVerified === true && email === SUPER_ADMIN_EMAIL)
  );

  const roles = new Set(["customer"]);

  if (isSuperAdmin) {
    return ["customer", "merchant", "admin", "staff_supervisor"];
  }

  // Merchant privilege (only for verified Firebase Auth sessions)
  const isMerchant = Boolean(
    (Array.isArray(user.roles) && user.roles.includes("merchant")) ||
    user.isMerchantVerified === true ||
    user.isMerchantRegistered === true ||
    user.role === "merchant"
  );

  if (isMerchant) {
    roles.add("merchant");
  }

  if (user.role) {
    roles.add(user.role);
  }

  if (Array.isArray(user.roles)) {
    user.roles.forEach((r) => roles.add(r));
  }

  return Array.from(roles);
}

/**
 * Checks if a user is permitted to access a target role.
 */
export function canAccessRole(user, targetRole) {
  if (!user || !targetRole) return false;
  const roles = getEffectiveRoles(user);
  return roles.includes(targetRole);
}

/**
 * Checks if user is Super Admin
 */
export function isUserSuperAdmin(user) {
  if (!user || user.isFromCache === true || user.isVerifiedAuth !== true) return false;
  const email = (user.email || "").toLowerCase().trim();
  return Boolean(
    user.isSuperAdmin === true ||
    user.admin === true ||
    (user.isTokenVerified === true && email === SUPER_ADMIN_EMAIL)
  );
}

/**
 * Checks if user is Merchant
 */
export function isUserMerchant(user) {
  return canAccessRole(user, "merchant");
}
