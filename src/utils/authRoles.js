/**
 * Centralized Role-Based Access Control (RBAC) & Authorization Helpers
 * Single source of truth across UI, Redux, Context, and Route Guards.
 */

export const SUPER_ADMIN_EMAIL = "58140@lomsak.ac.th";

/**
 * Derives the list of effective roles for a user.
 * Super Admin strictly has ['customer', 'merchant', 'admin'].
 * Verified Merchant has ['customer', 'merchant'].
 * Normal Customer has ['customer'].
 */
export function getEffectiveRoles(user) {
  if (!user) return ["guest"];

  const email = (user.email || "").toLowerCase().trim();
  const isSuperAdmin = email === SUPER_ADMIN_EMAIL || user.isSuperAdmin === true || user.admin === true;
  if (isSuperAdmin) {
    return ["customer", "merchant", "admin"];
  }

  const isMerchant = Boolean(
    (Array.isArray(user.roles) && user.roles.includes("merchant")) ||
    user.isMerchantVerified === true ||
    user.isMerchantRegistered === true
  );

  if (isMerchant) {
    return ["customer", "merchant"];
  }

  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles;
  }

  return ["customer"];
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
  if (!user) return false;
  const email = (user.email || "").toLowerCase().trim();
  return email === SUPER_ADMIN_EMAIL || user.isSuperAdmin === true || user.admin === true;
}

/**
 * Checks if user is Merchant
 */
export function isUserMerchant(user) {
  return canAccessRole(user, "merchant");
}
