/**
 * ============================================================================
 * 🧾 ORDER REQUEST VALIDATION
 * ============================================================================
 *
 * Everything that can be decided about an order request before reading a single
 * document: the shape of the input, which calendar day and time the pickup
 * actually resolves to, and how many of each product the cart adds up to.
 *
 * Extracted from createOrderAuthoritative, which had grown to 700 lines holding
 * the pricing, coupon, wallet, allergen, capacity and queue rules inline, all
 * inside one transaction. None of it could be exercised without the Firestore
 * emulator, so the rules that decide whether an order is accepted were the least
 * tested code in the project.
 *
 * Refusals are returned, not thrown — this file has no firebase-functions import
 * and index.js maps each `code` onto an HttpsError. That is the same shape
 * walletAuthority.js and walletLimits.js already use, and it is what makes these
 * rules directly testable.
 */

/** Is this a real calendar date? Rejects 2026-02-30 and friends. */
export function isValidCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const refuse = (status, code, message) => ({ ok: false, status, code, message });

/**
 * Validates the caller's request and resolves the pickup day.
 *
 * @param {object} data - the raw request payload
 * @param {{ymd: string, ymdClean: string, hhmm: string}} nowBangkok - the server's current instant
 * @returns {{ok: true, cleanPickupTime, targetYmd, targetYmdClean,
 *            productTotalQuantityMap: Map<string, number>, totalOrderItemsCount: number}
 *          |{ok: false, status: string, code: string, message: string}}
 */
export function validateOrderRequest(data, nowBangkok) {
  const { storeId, customerPhone, items, pickupTime, pickupDate } = data || {};

  if (!storeId || typeof storeId !== "string" || !storeId.trim()) {
    return refuse("invalid-argument", "STORE_ID_REQUIRED", "STORE_ID_REQUIRED: ไม่พบรหัสร้านค้า");
  }
  if (!customerPhone || typeof customerPhone !== "string" || !customerPhone.trim()) {
    return refuse(
      "invalid-argument",
      "CUSTOMER_PHONE_REQUIRED",
      "CUSTOMER_PHONE_REQUIRED: กรุณาระบุเบอร์โทรศัพท์สำหรับรับการแจ้งเตือนคิว"
    );
  }
  if (!Array.isArray(items) || items.length === 0) {
    return refuse("invalid-argument", "ORDER_ITEMS_EMPTY", "ORDER_ITEMS_EMPTY: รายการอาหารในคำสั่งซื้อว่างเปล่า");
  }
  if (!pickupTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(pickupTime).trim())) {
    return refuse(
      "invalid-argument",
      "INVALID_PICKUP_TIME_FORMAT",
      "INVALID_PICKUP_TIME_FORMAT: รูปแบบเวลารับอาหารไม่ถูกต้อง (ต้องเป็น HH:mm)"
    );
  }

  const cleanPickupTime = String(pickupTime).trim();
  let targetYmd = nowBangkok.ymd;
  let targetYmdClean = nowBangkok.ymdClean;

  if (pickupDate) {
    const rawDate = String(pickupDate).trim();
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
    const isCleanDate = /^\d{8}$/.test(rawDate);
    if (!isIsoDate && !isCleanDate) {
      return refuse(
        "invalid-argument",
        "INVALID_DATE_FORMAT",
        "INVALID_DATE_FORMAT: รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)"
      );
    }
    const clean = rawDate.replace(/-/g, "");
    const iso = isIsoDate ? rawDate : `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;

    // Whether the date exists is checked before whether it has passed. The
    // original order put the past-date comparison first, so "2026-02-30" — a
    // day that does not exist — was refused with "ไม่สามารถเลือกวันที่ย้อนหลังได้",
    // telling the user to pick a later date when the problem was that they had
    // picked an impossible one. Both orders refuse; only this one explains.
    const [y, m, d] = iso.split("-").map(Number);
    if (!isValidCalendarDate(y, m, d)) {
      return refuse(
        "invalid-argument",
        "INVALID_CALENDAR_DATE",
        "INVALID_CALENDAR_DATE: วันที่ระบุไม่มีอยู่จริงในปฏิทิน"
      );
    }

    // Compared as YYYYMMDD strings, which sort identically to the dates they
    // encode — no Date parsing, so no timezone can move the comparison.
    if (clean < nowBangkok.ymdClean) {
      return refuse(
        "invalid-argument",
        "PAST_DATE_NOT_ALLOWED",
        "PAST_DATE_NOT_ALLOWED: ไม่สามารถเลือกวันที่ย้อนหลังได้"
      );
    }
    targetYmd = iso;
    targetYmdClean = clean;
  }

  // A pickup slot that has already passed today. Same-day only: a time earlier
  // than now is perfectly valid for tomorrow.
  if (targetYmdClean === nowBangkok.ymdClean && cleanPickupTime <= nowBangkok.hhmm) {
    return refuse(
      "failed-precondition",
      "PAST_PICKUP_TIME_NOT_ALLOWED",
      `PAST_PICKUP_TIME_NOT_ALLOWED: เวลารับอาหาร (${cleanPickupTime} น.) ผ่านไปแล้วสำหรับวันนี้ (เวลาปัจจุบัน ${nowBangkok.hhmm} น.)`
    );
  }

  // Aggregate quantities per product. Two cart lines for the same dish must be
  // checked against stock together, or each passes on its own and the pair
  // oversells.
  const productTotalQuantityMap = new Map();
  let totalOrderItemsCount = 0;

  for (const it of items) {
    if (!it || !it.productId) {
      return refuse("invalid-argument", "PRODUCT_ID_REQUIRED", "PRODUCT_ID_REQUIRED: ทุกรายการต้องระบุ productId");
    }
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      return refuse("invalid-argument", "INVALID_QUANTITY", "INVALID_QUANTITY: จำนวนสินค้าต้องเป็นจำนวนเต็มบวก");
    }
    totalOrderItemsCount += qty;
    productTotalQuantityMap.set(it.productId, (productTotalQuantityMap.get(it.productId) || 0) + qty);
  }

  return {
    ok: true,
    cleanPickupTime,
    targetYmd,
    targetYmdClean,
    productTotalQuantityMap,
    totalOrderItemsCount,
  };
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Is the shop accepting an order for this day and time?
 *
 * @param {object} shopData - the shop document
 * @param {{dayOfWeekIndex: number}} targetBangkok - the resolved pickup day
 * @param {string} targetYmd
 * @param {string} cleanPickupTime - "HH:MM"
 */
export function checkStoreAvailability(shopData, targetBangkok, targetYmd, cleanPickupTime) {
  const shop = shopData || {};

  if (shop.isOpen === false || shop.status === "closed") {
    return refuse("failed-precondition", "STORE_CLOSED", "STORE_CLOSED: ร้านค้าปิดให้บริการชั่วคราว");
  }
  if (shop.operationalOverride === "FORCE_CLOSE" || shop.operationalOverride === "EMERGENCY_STOP") {
    return refuse("failed-precondition", "STORE_PAUSED", "STORE_PAUSED: ร้านค้าหยุดรับออเดอร์ชั่วคราว");
  }

  if (shop.operatingHours) {
    const targetDayName = DAY_NAMES[targetBangkok.dayOfWeekIndex];
    const targetDaySchedule = shop.operatingHours[targetDayName];

    if (targetDaySchedule) {
      if (!targetDaySchedule.isOpen) {
        return refuse(
          "failed-precondition",
          "STORE_CLOSED_ON_DATE",
          `STORE_CLOSED_ON_DATE: ร้านค้าปิดทำการในวัน${targetDayName} (${targetYmd})`
        );
      }
      const { open, close } = targetDaySchedule;
      // A shop open 18:00–02:00 has open > close. Comparing naively would reject
      // every hour of its actual trading.
      const isPickupAllowed =
        open <= close
          ? cleanPickupTime >= open && cleanPickupTime <= close
          : cleanPickupTime >= open || cleanPickupTime <= close;
      if (!isPickupAllowed) {
        return refuse(
          "failed-precondition",
          "INVALID_PICKUP_TIME",
          `INVALID_PICKUP_TIME: เวลารับอาหาร ${cleanPickupTime} น. อยู่นอกเวลาทำการ (${open} - ${close})`
        );
      }
    }
  }

  return { ok: true };
}

/**
 * Slot capacity, fail-closed.
 *
 * A shop that has not configured a capacity is refused rather than treated as
 * unlimited: an unconfigured limit should not read as "no limit" on the one
 * check standing between a kitchen and more orders than it can cook.
 */
export function checkSlotCapacity(shopData, slotData, targetYmd, cleanPickupTime) {
  const maxPerSlot = shopData && shopData.maxOrdersPerSlot;
  if (typeof maxPerSlot !== "number" || maxPerSlot <= 0) {
    return refuse(
      "failed-precondition",
      "STORE_CAPACITY_NOT_CONFIGURED",
      "STORE_CAPACITY_NOT_CONFIGURED: ร้านค้ายังไม่ได้กำหนดขีดจำกัดโควตาคิวรับอาหาร"
    );
  }

  const currentSlotOrders = Number(slotData && slotData.currentOrders) || 0;
  if (currentSlotOrders + 1 > maxPerSlot) {
    return refuse(
      "resource-exhausted",
      "SLOT_CAPACITY_EXCEEDED",
      `SLOT_CAPACITY_EXCEEDED: รอบเวลารับอาหาร ${cleanPickupTime} น. ของวันที่ ${targetYmd} คิวเต็มแล้ว (${currentSlotOrders}/${maxPerSlot})`
    );
  }

  return { ok: true, capacity: maxPerSlot, currentSlotOrders };
}

/** The next queue number for this store and day. */
export function nextQueueNumber(counterData) {
  const sequenceNumber = (Number(counterData && counterData.lastSequence) || 0) + 1;
  return { sequenceNumber, queueNumber: `Q${String(sequenceNumber).padStart(3, "0")}` };
}
