/**
 * ============================================================================
 * QUEUEUP PLATFORM ROLES & ACCESS CONTEXT
 * ============================================================================
 * Defines platform roles, operational store roles, and scoping context
 * across campuses, shops, and privacy-preserving support tickets.
 */

export type PlatformRole =
  | "customer"
  | "guardian"
  | "student_vendor"
  | "merchant"
  | "campus_supervisor"
  | "health_staff"
  | "support_agent"
  | "support_supervisor"
  | "finance_specialist"
  | "privacy_officer"
  | "platform_admin";

export type StoreRole =
  | "store_owner"
  | "store_manager"
  | "kitchen_lead"
  | "kitchen_staff"
  | "cashier"
  | "analyst"
  | "student_vendor";

export interface AccessContext {
  actorId: string;
  roles: PlatformRole[];
  campusIds: string[];
  shopIds: string[];
  assignedTicketIds?: string[];
  purpose?: string;
  elevatedGrantId?: string;
}

export interface SupportAccessGrant {
  grantId: string;
  ticketId: string;
  agentId: string;
  userId: string;
  purposeCode: string;
  approvedFields: string[];
  approvedBy: string;
  grantedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

/**
 * Checks if the actor has permission for a specific store.
 */
export function canAccessShop(context: AccessContext, shopId: string): boolean {
  if (context.roles.includes("platform_admin")) return true;
  return context.shopIds.includes(shopId);
}

/**
 * Checks if the actor has permission for a specific campus.
 */
export function canAccessCampus(context: AccessContext, campusId: string): boolean {
  if (context.roles.includes("platform_admin")) return true;
  return context.campusIds.includes(campusId);
}

/**
 * Checks if the actor holds at least one of the specified roles.
 */
export function hasAnyRole(context: AccessContext, roles: PlatformRole[]): boolean {
  if (context.roles.includes("platform_admin")) return true;
  return roles.some((role) => context.roles.includes(role));
}

/**
 * Privacy helper: masks a phone number (e.g. 0812345678 -> 08X-XXX-5678).
 */
export function maskPhone(phone?: string): string {
  if (!phone) return "08X-XXX-XXXX";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 9) return "08X-XXX-XXXX";
  const prefix = cleaned.slice(0, 2);
  const suffix = cleaned.slice(-4);
  return `${prefix}X-XXX-${suffix}`;
}

/**
 * Privacy helper: masks an email (e.g. natthaphon@school.ac.th -> n***@school.ac.th).
 */
export function maskEmail(email?: string): string {
  if (!email || !email.includes("@")) return "***@domain.com";
  const [user, domain] = email.split("@");
  const first = user[0] || "*";
  return `${first}***@${domain}`;
}
