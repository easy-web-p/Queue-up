// QueueUp Merchant Centre Data Architecture v3.0
// Store Isolation & Cryptographic Engine

import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config.js";

/**
 * Generate cryptographically secure random alphanumeric string
 * @param {string} prefix - ID Prefix (e.g. 'MCH', 'STORE', 'QUP')
 * @param {number} length - Random characters length
 * @returns {string} e.g. 'MCH-7X9K2P8Q'
 */
export function generateSecureCryptoId(prefix, length = 8) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous characters O,0,I,1
  const randomBytes = new Uint8Array(length);
  window.crypto.getRandomValues(randomBytes);

  let randomStr = "";
  for (let i = 0; i < length; i++) {
    randomStr += charset[randomBytes[i] % charset.length];
  }

  return `${prefix}-${randomStr}`;
}

/**
 * Generate Account ID: QUP-YYYYMMDD-XXXXXX
 */
export function generateAccountId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = generateSecureCryptoId("QUP", 6).replace("QUP-", "");
  return `QUP-${dateStr}-${random}`;
}

/**
 * Generate Merchant ID: MCH-XXXXXXXX
 */
export function generateMerchantId() {
  return generateSecureCryptoId("MCH", 8);
}

/**
 * Generate Store ID: STORE-XXXXXXXX
 */
export function generateStoreId() {
  return generateSecureCryptoId("STORE", 8);
}

/**
 * Generate Prefixed Store Queue Number (e.g., S01-Q001)
 * @param {string} storeId - Store ID
 * @param {number} index - Queue number index
 * @returns {string} e.g., 'ST01-Q005'
 */
export function generateStoreQueueNo(storeId = "", index = 1) {
  const queueFormatted = String(index).padStart(3, "0");
  if (!storeId) return `Q${queueFormatted}`;
  const storePrefix = storeId.replace("STORE-", "").replace("store_", "").substring(0, 3).toUpperCase();
  return `${storePrefix}-Q${queueFormatted}`;
}

/**
 * Record Security Audit Log via Server-Authoritative Cloud Function
 * Collection: audit_logs/{auditId}
 */
export async function recordAuditLog(dbOrOptions, maybeOptions) {
  // Support both signatures:
  // 1. recordAuditLog(db, { action, storeId, merchantId, metadata })
  // 2. recordAuditLog({ action, storeId, merchantId, metadata })
  const options = maybeOptions || dbOrOptions || {};
  const { action, storeId, merchantId, metadata = {} } = options;
  const targetStoreId = storeId || metadata?.storeId || merchantId;

  try {
    const callable = httpsCallable(functions, "recordMerchantAuditLog");
    const res = await callable({
      action,
      storeId: targetStoreId,
      metadata,
    });
    return res?.data?.logId || null;
  } catch (err) {
    console.warn("Audit Log Notice:", err);
    return null;
  }
}

/**
 * Fetch Merchant Profile & Finance from Firestore
 */
export async function fetchMerchantProfileFromFirestore(db, uid) {
  if (!db || !uid) return null;

  try {
    // 1. Fetch User Record users/{uid}
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return null;
    const userData = userSnap.data();

    const merchantId = userData.merchantId;
    const storeId = userData.storeId;

    if (!merchantId || !storeId) return { userData, merchantData: null, storeData: null, financeData: null };

    // 2. Fetch Merchant Profile merchantProfiles/{merchantId}
    const merchantSnap = await getDoc(doc(db, "merchantProfiles", merchantId));
    const merchantData = merchantSnap.exists() ? merchantSnap.data() : null;

    // 3. Fetch Shop Profile shops/{storeId}
    const storeSnap = await getDoc(doc(db, "shops", storeId));
    const storeData = storeSnap.exists() ? storeSnap.data() : null;

    // 4. Fetch Private Finance merchantProfiles/{merchantId}/private/finance
    const finSnap = await getDoc(doc(db, "merchantProfiles", merchantId, "private", "finance"));
    const financeData = finSnap.exists() ? finSnap.data() : null;

    return {
      userData,
      merchantData,
      storeData,
      financeData,
    };
  } catch (err) {
    console.error("Fetch Merchant Profile Error:", err);
    return null;
  }
}
