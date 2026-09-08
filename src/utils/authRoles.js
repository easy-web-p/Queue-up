/**
 * Centralized Role-Based Access Control (RBAC) & Authorization Helpers
 * Single source of truth across UI, Redux, Context, and Route Guards.
 * 
 * 🔒 Security Policy:
 * 1. Unverified cached sessions (e.g. from LocalStorage) can NEVER claim privileged roles.
 * 2. Super Admin & Merchant roles are granted ONLY when `user.isVerifiedAuth === true` (officially verified by Firebase Auth).
 */

export const SUPER_ADMIN_EMAIL = "58140@lomsak.ac.th";
export const SUPER_ADMIN_EMAILS = [
  "58140@lomsak.ac.th",
  "hi00000087@gmail.com",
  "easy.web.p@gmail.com",
];

/**
 * 🔒 Roles that may NEVER be granted by the user's own Firestore profile document.
 *
 * A user creates `users/{uid}` themselves, so any field in it is attacker-controlled
 * on first write. These roles are therefore honoured only from Firebase ID token
 * custom claims (set by Cloud Functions via the Admin SDK) or the super-admin email.
 * This mirrors firestore.rules, which authorizes privileged access off
 * `request.auth.token` and never off the profile document.
 */
const PRIVILEGED_ROLES = new Set(["admin", "staff_supervisor"]);

/** Reads verified ID token custom claims, if the session carries them. */
function getClaims(user) {
  return (user && user.tokenClaims) || {};
}

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

  // 🔒 Super Admin privilege comes from verified ID token claims or the super-admin
  // email only — never from `isSuperAdmin` / `admin` in the user's own profile doc.
  const email = (user.email || "").toLowerCase().trim();
  const claims = getClaims(user);
  const isSuperAdmin = Boolean(
    claims.admin === true ||
    claims.role === "admin" ||
    SUPER_ADMIN_EMAILS.includes(email)
  );

  const roles = new Set(["customer"]);

  if (isSuperAdmin) {
    return ["customer", "merchant", "admin", "staff_supervisor"];
  }

  // Staff supervisor is likewise claim-only.
  if (claims.role === "staff_supervisor" || claims.staffSupervisor === true) {
    roles.add("staff_supervisor");
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

  // Non-privileged roles (customer, student_vendor, guardian, ...) may come from the
  // profile doc; privileged ones are filtered out — see PRIVILEGED_ROLES above.
  if (user.role && !PRIVILEGED_ROLES.has(user.role)) {
    roles.add(user.role);
  }

  if (Array.isArray(user.roles)) {
    user.roles.forEach((r) => {
      if (!PRIVILEGED_ROLES.has(r)) roles.add(r);
    });
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
  const claims = getClaims(user);
  return Boolean(
    claims.admin === true ||
    claims.role === "admin" ||
    SUPER_ADMIN_EMAILS.includes(email)
  );
}

/**
 * Checks if user is Merchant
 */
export function isUserMerchant(user) {
  return canAccessRole(user, "merchant");
}
