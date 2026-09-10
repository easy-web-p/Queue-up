/**
 * 🕒 Canonical Slot ID Helper
 *
 * Guarantees 100% document ID symmetry between createOrderAuthoritative
 * and cancelOrderAuthoritative.
 * Format: slot_{storeId}_{YYYYMMDD}_{HHmm}
 */

export function getCanonicalSlotId(storeId, pickupDate, pickupTime) {
  if (!storeId || !pickupDate || !pickupTime) {
    throw new Error("INVALID_SLOT_PARAMS: storeId, pickupDate, and pickupTime are required");
  }
  const cleanStoreId = String(storeId).trim();
  const cleanDate = String(pickupDate).replace(/-/g, "").trim();
  const cleanTime = String(pickupTime).replace(/:/g, "").trim();
  return `slot_${cleanStoreId}_${cleanDate}_${cleanTime}`;
}
