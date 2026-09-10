import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { scanOrderForAllergens } from "../../allergenGuard.js";
import { getCanonicalSlotId } from "./slotHelper.js";
import { verifyStudentAuthority } from "../identity/guardianAuthority.js";
import { processWalletPaymentInTransaction } from "../payments/paymentService.js";

function isValidCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month && d.getUTCDate() === day;
}

function getBangkokCurrentTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getBangkokYmd(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = formatter.format(date);
  const ymdClean = ymd.replace(/-/g, "");

  const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", weekday: "short" });
  const weekdayShort = dayFormatter.format(date).toLowerCase();
  const weekdayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const dayOfWeekIndex = weekdayMap[weekdayShort] ?? 0;

  return { ymd, ymdClean, dayOfWeekIndex };
}

/**
 * 🔒 Create Order Authoritative
 *
 * Server-authoritative order creation, inventory deduction, slot capacity reservation,
 * and sequential queue issuance supporting Multi-Channel Payments (Wallet, PromptPay, Pay at store).
 */
export async function handleCreateOrderAuthoritative(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "AUTHENTICATION_REQUIRED: ผู้ใช้งานต้องเข้าสู่ระบบก่อนทำการสั่งอาหาร");
  }

  const authUid = request.auth.uid;
  const {
    storeId,
    userId,
    customerName,
    customerPhone,
    items,
    pickupTime,
    pickupDate,
    acknowledgeAllergenWarning,
    couponCode,
    studentId,
    paymentMethod = "PAY_AT_STORE", // "WALLET" | "PROMPTPAY" | "PAY_AT_STORE"
  } = request.data || {};

  if (userId && userId !== authUid && request.auth.token?.admin !== true) {
    throw new HttpsError("permission-denied", "ไม่สามารถสร้างคำสั่งซื้อในนามของผู้ใช้อื่นได้");
  }

  const effectiveUserId = authUid;
  const cleanStudentId = (studentId && typeof studentId === "string" && studentId.trim()) ? studentId.trim() : null;

  // 1. IDOR Guard: Verify student authority via guardian relationship or self
  await verifyStudentAuthority(db, authUid, request.auth.token, cleanStudentId);

  // 2. Strict Input Validation
  if (!storeId || typeof storeId !== "string" || !storeId.trim()) {
    throw new HttpsError("invalid-argument", "STORE_ID_REQUIRED: ไม่พบรหัสร้านค้า");
  }
  if (!customerPhone || typeof customerPhone !== "string" || !customerPhone.trim()) {
    throw new HttpsError("invalid-argument", "CUSTOMER_PHONE_REQUIRED: กรุณาระบุเบอร์โทรศัพท์สำหรับรับการแจ้งเตือนคิว");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "ORDER_ITEMS_EMPTY: รายการอาหารในคำสั่งซื้อว่างเปล่า");
  }
  if (!pickupTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(pickupTime).trim())) {
    throw new HttpsError("invalid-argument", "INVALID_PICKUP_TIME_FORMAT: รูปแบบเวลารับอาหารไม่ถูกต้อง (ต้องเป็น HH:mm)");
  }

  const cleanPickupTime = String(pickupTime).trim();
  const now = new Date();
  const currentBangkok = getBangkokYmd(now);

  let targetYmd = currentBangkok.ymd;
  let targetYmdClean = currentBangkok.ymdClean;

  if (pickupDate) {
    const rawDate = String(pickupDate).trim();
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
    const isCleanDate = /^\d{8}$/.test(rawDate);
    if (!isIsoDate && !isCleanDate) {
      throw new HttpsError("invalid-argument", "INVALID_DATE_FORMAT: รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)");
    }
    const clean = rawDate.replace(/-/g, "");
    if (clean < currentBangkok.ymdClean) {
      throw new HttpsError("invalid-argument", "PAST_DATE_NOT_ALLOWED: ไม่สามารถเลือกวันที่ย้อนหลังได้");
    }
    targetYmd = isIsoDate ? rawDate : `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    targetYmdClean = clean;
  }

  const [pYear, pMonth, pDay] = targetYmd.split("-").map(Number);
  if (!isValidCalendarDate(pYear, pMonth, pDay)) {
    throw new HttpsError("invalid-argument", "INVALID_CALENDAR_DATE: วันที่ระบุไม่มีอยู่จริงในปฏิทิน");
  }

  if (targetYmdClean === currentBangkok.ymdClean) {
    const currentBangkokTime = getBangkokCurrentTime(now);
    if (cleanPickupTime <= currentBangkokTime) {
      throw new HttpsError("failed-precondition", `PAST_PICKUP_TIME_NOT_ALLOWED: เวลารับอาหาร (${cleanPickupTime} น.) ผ่านไปแล้วสำหรับวันนี้ (เวลาปัจจุบัน ${currentBangkokTime} น.)`);
    }
  }

  // Aggregate Product Quantities
  const productTotalQuantityMap = new Map();

  for (const it of items) {
    if (!it.productId) {
      throw new HttpsError("invalid-argument", "PRODUCT_ID_REQUIRED: ทุกรายการต้องระบุ productId");
    }
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new HttpsError("invalid-argument", "INVALID_QUANTITY: จำนวนสินค้าต้องเป็นจำนวนเต็มบวก");
    }
    productTotalQuantityMap.set(it.productId, (productTotalQuantityMap.get(it.productId) || 0) + qty);
  }

  const cleanPaymentMethod = ["WALLET", "PROMPTPAY", "PAY_AT_STORE"].includes(String(paymentMethod).toUpperCase())
    ? String(paymentMethod).toUpperCase()
    : "PAY_AT_STORE";

  try {
    return await db.runTransaction(async (tx) => {
      // PHASE 0 & 1: READ ALL REQUIRED DOCUMENTS
      const shopRef = db.collection("shops").doc(storeId);
      const shopSnap = await tx.get(shopRef);
      if (!shopSnap.exists) {
        throw new HttpsError("not-found", `STORE_NOT_FOUND: ร้านค้ารหัส ${storeId} ไม่มีอยู่ในระบบ`);
      }
      const shopData = shopSnap.data();

      // Allergy Profile
      const allergyProfileId = cleanStudentId || authUid;
      const studentSnap = await tx.get(db.collection("students").doc(allergyProfileId));

      // Single-use Coupon Ledger Check
      const cleanCoupon = couponCode && typeof couponCode === "string" ? couponCode.trim().toUpperCase() : null;
      let couponSnap = null;
      if (cleanCoupon) {
        couponSnap = await tx.get(db.collection("coupons").doc(cleanCoupon));
        const redemptionRef = db.collection("coupon_redemptions").doc(`${cleanCoupon}_${authUid}`);
        const couponRedemptionSnap = await tx.get(redemptionRef);
        if (couponRedemptionSnap.exists) {
          throw new HttpsError("failed-precondition", `COUPON_ALREADY_USED: คุณได้ใช้สิทธิ์คูปอง ${cleanCoupon} ไปแล้ว ไม่สามารถใช้ซ้ำได้`);
        }
      }

      // Read all products
      const productSnapMap = new Map();
      const referencedModifierGroupIds = new Set();

      for (const prodId of productTotalQuantityMap.keys()) {
        const prodRef = db.collection("products").doc(prodId);
        const prodSnap = await tx.get(prodRef);
        if (!prodSnap.exists) {
          throw new HttpsError("not-found", `PRODUCT_NOT_FOUND: ไม่พบสินค้ารหัส ${prodId} ในระบบ`);
        }
        productSnapMap.set(prodId, prodSnap);
        const pData = prodSnap.data();
        if (Array.isArray(pData.modifierGroupIds)) {
          pData.modifierGroupIds.forEach((mgId) => referencedModifierGroupIds.add(mgId));
        }
      }

      // Referenced Modifier Groups
      for (const it of items) {
        if (Array.isArray(it.selectedModifiers)) {
          it.selectedModifiers.forEach((m) => {
            if (m.modifierGroupId) referencedModifierGroupIds.add(m.modifierGroupId);
          });
        }
      }

      const modifierGroupSnapMap = new Map();
      for (const mgId of referencedModifierGroupIds) {
        const modRef = db.collection("modifier_groups").doc(mgId);
        const modSnap = await tx.get(modRef);
        if (modSnap.exists) {
          modifierGroupSnapMap.set(mgId, modSnap);
        }
      }

      // Slot Capacity doc (Using canonical helper)
      const canonicalSlotId = getCanonicalSlotId(storeId, targetYmdClean, cleanPickupTime);
      const slotRef = db.collection("store_slots").doc(canonicalSlotId);
      const slotSnap = await tx.get(slotRef);

      // Sequence Counter doc
      const counterDocId = `counter_${storeId}_${targetYmdClean}`;
      const counterRef = db.collection("queue_counters").doc(counterDocId);
      const counterSnap = await tx.get(counterRef);

      // Wallet Pre-read if paying by Wallet
      let walletSnap = null;
      if (cleanPaymentMethod === "WALLET") {
        const walletIdToDeduct = cleanStudentId || authUid;
        walletSnap = await tx.get(db.collection("wallets").doc(walletIdToDeduct));
      }

      // ===================================================================
      // PHASE 2: VALIDATE BUSINESS RULES & CALCULATE AMOUNTS
      // ===================================================================
      if (shopData.isOpen === false || shopData.status === "closed") {
        throw new HttpsError("failed-precondition", "STORE_CLOSED: ร้านค้าปิดให้บริการชั่วคราว");
      }
      if (shopData.operationalOverride === "FORCE_CLOSE" || shopData.operationalOverride === "EMERGENCY_STOP") {
        throw new HttpsError("failed-precondition", "STORE_PAUSED: ร้านค้าหยุดรับออเดอร์ชั่วคราว");
      }

      // Operating Hours Validation
      if (shopData.operatingHours && typeof shopData.operatingHours === "object") {
        const targetPickupDateObj = new Date(Date.UTC(pYear, pMonth - 1, pDay, 12, 0, 0));
        const { dayOfWeekIndex } = getBangkokYmd(targetPickupDateObj);
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const dayKey = days[dayOfWeekIndex];
        const dayConfig = shopData.operatingHours[dayKey];
        if (dayConfig) {
          if (dayConfig.isOpen === false) {
            throw new HttpsError("failed-precondition", `STORE_CLOSED_ON_DATE: ร้านค้าปิดให้บริการในวันดังกล่าว (${dayKey})`);
          }
          if (dayConfig.open && dayConfig.close) {
            if (cleanPickupTime < dayConfig.open || cleanPickupTime > dayConfig.close) {
              throw new HttpsError("failed-precondition", `PICKUP_TIME_OUT_OF_HOURS: เวลารับอาหารอยู่นอกเวลาเปิดทำการ (${dayConfig.open} - ${dayConfig.close} น.)`);
            }
          }
        }
      }

      // Validate Products & Modifiers
      let calculatedTotalSatang = 0;
      const validatedOrderItems = [];
      const allergenScanItems = [];

      for (const it of items) {
        const prodSnap = productSnapMap.get(it.productId);
        const prodData = prodSnap.data();

        if (prodData.storeId !== storeId) {
          throw new HttpsError("invalid-argument", `CROSS_STORE_PRODUCT_VIOLATION: สินค้า ${prodData.name} ไม่ได้เป็นของร้านค้า ${storeId}`);
        }
        if (prodData.isAvailable === false || prodData.status === "OUT_OF_STOCK") {
          throw new HttpsError("failed-precondition", `PRODUCT_UNAVAILABLE: สินค้า ${prodData.name} ไม่พร้อมจำหน่าย`);
        }

        const basePriceSatang = typeof prodData.priceSatang === "number"
          ? prodData.priceSatang
          : Math.round((Number(prodData.price) || 0) * 100);

        let itemModifierTotalSatang = 0;
        const validSelectedModifiers = [];
        const selectedModifierNames = [];

        // Validate Modifiers
        const productMgIds = Array.isArray(prodData.modifierGroupIds) ? prodData.modifierGroupIds : [];
        const requiredMgIds = new Set();
        for (const mgId of productMgIds) {
          const mgSnap = modifierGroupSnapMap.get(mgId);
          if (mgSnap && mgSnap.data().isRequired) {
            requiredMgIds.add(mgId);
          }
        }

        const selectedByGroup = new Map();
        if (Array.isArray(it.selectedModifiers)) {
          for (const sel of it.selectedModifiers) {
            if (!sel.modifierGroupId || !sel.optionId) continue;
            if (!selectedByGroup.has(sel.modifierGroupId)) {
              selectedByGroup.set(sel.modifierGroupId, []);
            }
            selectedByGroup.get(sel.modifierGroupId).push(sel);
          }
        }

        for (const reqMgId of requiredMgIds) {
          const sels = selectedByGroup.get(reqMgId) || [];
          if (sels.length === 0) {
            const mgData = modifierGroupSnapMap.get(reqMgId)?.data();
            throw new HttpsError("invalid-argument", `REQUIRED_MODIFIER_MISSING: กรุณาเลือกตัวเลือกสำหรับหมวดหมู่ "${mgData?.name || reqMgId}"`);
          }
        }

        for (const [mgId, selList] of selectedByGroup.entries()) {
          const mgSnap = modifierGroupSnapMap.get(mgId);
          if (!mgSnap) continue;
          const mgData = mgSnap.data();

          if (mgData.selectionType === "single" && selList.length > 1) {
            throw new HttpsError("invalid-argument", `SINGLE_SELECTION_VIOLATED: หมวดหมู่ "${mgData.name}" เลือกได้เพียง 1 ตัวเลือกเท่านั้น`);
          }

          const seenOptions = new Set();
          for (const sel of selList) {
            if (seenOptions.has(sel.optionId)) {
              throw new HttpsError("invalid-argument", `DUPLICATE_MODIFIER_OPTION: ตัวเลือกถูกเลือกซ้ำในหมวดหมู่ "${mgData.name}"`);
            }
            seenOptions.add(sel.optionId);

            const opt = Array.isArray(mgData.options) ? mgData.options.find((o) => o.id === sel.optionId) : null;
            if (!opt) {
              throw new HttpsError("invalid-argument", `INVALID_MODIFIER_OPTION: ไม่พบตัวเลือกรหัส ${sel.optionId} ในหมวดหมู่ "${mgData.name}"`);
            }
            if (opt.isOutOfStock) {
              throw new HttpsError("failed-precondition", `OPTION_OUT_OF_STOCK: ตัวเลือก "${opt.name}" หมดชั่วคราว`);
            }

            const modPriceSatang = typeof opt.priceModifierSatang === "number"
              ? opt.priceModifierSatang
              : Math.round((Number(opt.priceModifier) || 0) * 100);

            itemModifierTotalSatang += modPriceSatang;
            if (opt.name) selectedModifierNames.push(String(opt.name));
            validSelectedModifiers.push({
              modifierGroupId: mgId,
              modifierGroupName: mgData.name,
              optionId: opt.id,
              name: opt.name,
              priceModifier: modPriceSatang / 100,
              priceModifierSatang: modPriceSatang,
            });
          }
        }

        const unitPriceSatang = basePriceSatang + itemModifierTotalSatang;
        const lineTotalSatang = unitPriceSatang * it.quantity;
        calculatedTotalSatang += lineTotalSatang;

        validatedOrderItems.push({
          productId: it.productId,
          name: prodData.name,
          quantity: it.quantity,
          unitPriceSatang,
          unitPrice: unitPriceSatang / 100,
          subtotalSatang: lineTotalSatang,
          subtotal: lineTotalSatang / 100,
          customNotes: typeof it.customNotes === "string" ? it.customNotes.slice(0, 200) : "",
          selectedModifiers: validSelectedModifiers,
        });

        allergenScanItems.push({
          productId: it.productId,
          name: prodData.name || "",
          category: prodData.category || "",
          description: prodData.description || "",
          declaredAllergens: Array.isArray(prodData.allergens) ? prodData.allergens : [],
          modifierNames: selectedModifierNames,
        });
      }

      // Stock Validation
      for (const [prodId, requiredQty] of productTotalQuantityMap.entries()) {
        const prodSnap = productSnapMap.get(prodId);
        const prodData = prodSnap.data();
        if (typeof prodData.stock === "number") {
          if (prodData.stock < requiredQty) {
            throw new HttpsError("failed-precondition", `INSUFFICIENT_STOCK: สินค้า "${prodData.name}" มีจำนวนคงเหลือไม่พอ (${prodData.stock} ชิ้น)`);
          }
        }
      }

      // Coupon Calculation
      let discountSatang = 0;
      let couponTitle = null;
      if (cleanCoupon) {
        if (couponSnap && couponSnap.exists) {
          const cData = couponSnap.data();
          const minSpendSatang = cData.minSpendSatang ?? ((Number(cData.minSpend) || 0) * 100);
          if (calculatedTotalSatang >= minSpendSatang) {
            couponTitle = cData.title || cleanCoupon;
            if (cData.discountType === "PERCENT") {
              const percent = Number(cData.discountValue) || 0;
              const rawDiscount = Math.round(calculatedTotalSatang * (percent / 100));
              const maxCap = cData.maxDiscountSatang ?? ((Number(cData.maxDiscount) || 0) * 100);
              discountSatang = maxCap > 0 ? Math.min(rawDiscount, maxCap) : rawDiscount;
            } else {
              const fixedSatang = cData.discountValueSatang ?? Math.round((Number(cData.discountValue) || 0) * 100);
              discountSatang = Math.min(fixedSatang, calculatedTotalSatang);
            }
          }
        } else if (cleanCoupon === "WELCOME50") {
          if (calculatedTotalSatang >= 10000) {
            discountSatang = Math.min(5000, calculatedTotalSatang);
            couponTitle = "ต้อนรับสมาชิกใหม่ ลด ฿50 (WELCOME50)";
          }
        } else if (cleanCoupon === "HAPPY15") {
          if (calculatedTotalSatang >= 5000) {
            discountSatang = Math.min(5000, Math.round(calculatedTotalSatang * 0.15));
            couponTitle = "Happy Hour พิเศษ ลด 15% (HAPPY15)";
          }
        } else if (cleanCoupon === "STUDENT10") {
          if (calculatedTotalSatang >= 4000) {
            discountSatang = Math.min(3000, Math.round(calculatedTotalSatang * 0.10));
            couponTitle = "ส่วนลดนักเรียนนักศึกษา ลด 10% (STUDENT10)";
          }
        }
      }

      const finalAmountSatang = Math.max(0, calculatedTotalSatang - discountSatang);

      // Slot Capacity Enforcement (Fail-Closed)
      if (typeof shopData.maxOrdersPerSlot !== "number" || shopData.maxOrdersPerSlot <= 0) {
        throw new HttpsError("failed-precondition", "STORE_CAPACITY_NOT_CONFIGURED: ร้านค้ายังไม่ได้กำหนดขีดจำกัดโควตาคิวรับอาหาร");
      }
      const authoritativeCapacity = shopData.maxOrdersPerSlot;
      let currentSlotOrders = 0;
      if (slotSnap.exists) {
        currentSlotOrders = Number(slotSnap.data().currentOrders) || 0;
      }
      if (currentSlotOrders + 1 > authoritativeCapacity) {
        throw new HttpsError("resource-exhausted", `SLOT_CAPACITY_EXCEEDED: รอบเวลารับอาหาร ${cleanPickupTime} น. ของวันที่ ${targetYmd} คิวเต็มแล้ว (${currentSlotOrders}/${authoritativeCapacity})`);
      }

      // Allergen Guard
      const studentAllergyProfile = studentSnap.exists ? studentSnap.data() : null;
      const studentAllergies = Array.isArray(studentAllergyProfile?.allergyInfo)
        ? studentAllergyProfile.allergyInfo
        : [];

      const allergenScan = scanOrderForAllergens(studentAllergies, allergenScanItems);
      if (allergenScan.hasAllergens && acknowledgeAllergenWarning !== true) {
        const allergenList = allergenScan.matchedAllergenNames.join(", ");
        const dishList = allergenScan.flaggedItems.map((f) => `"${f.name}"`).join(", ");
        throw new HttpsError(
          "failed-precondition",
          `ALLERGEN_ALERT: เมนู ${dishList} อาจมีส่วนผสมที่แพ้ (${allergenList}) กรุณาตรวจสอบกับร้านค้าก่อนยืนยันการสั่งซื้อ`,
          {
            code: "ALLERGEN_ALERT",
            matchedAllergenNames: allergenScan.matchedAllergenNames,
            flaggedItems: allergenScan.flaggedItems,
            hasDeclaredMatch: allergenScan.hasDeclaredMatch === true,
          }
        );
      }

      // Wallet Pre-validation
      if (cleanPaymentMethod === "WALLET") {
        if (!walletSnap || !walletSnap.exists) {
          throw new HttpsError("failed-precondition", "WALLET_NOT_FOUND: ไม่พบบัญชี Campus Wallet สำหรับผู้ใช้นี้");
        }
        const wData = walletSnap.data();
        if (wData.isLocked === true || wData.status === "LOCKED") {
          throw new HttpsError("failed-precondition", "CAMPUS_WALLET_LOCKED: กระเป๋าเงินถูกระงับการใช้งาน");
        }
        const balanceSatang = Number(wData.balanceSatang) || 0;
        if (balanceSatang < finalAmountSatang) {
          throw new HttpsError(
            "failed-precondition",
            `INSUFFICIENT_WALLET_BALANCE: ยอดเงินในกระเป๋าไม่พอ (คงเหลือ ฿${(balanceSatang / 100).toFixed(2)} ยอดชำระ ฿${(finalAmountSatang / 100).toFixed(2)})`
          );
        }
        const dailyLimitSatang = Number(wData.dailyLimitSatang) || 50000;
        const dailySpentSatang = Number(wData.dailySpentSatang) || 0;
        if (dailySpentSatang + finalAmountSatang > dailyLimitSatang) {
          throw new HttpsError(
            "failed-precondition",
            `DAILY_LIMIT_EXCEEDED: เกินวงเงินจำกัดรายวัน (โควตา ฿${(dailyLimitSatang / 100).toFixed(2)})`
          );
        }
      }

      // ===================================================================
      // PHASE 3: WRITE COMMITS (Zero Writes Before This Point)
      // ===================================================================
      // 3.1 Deduct Product Stocks
      for (const [prodId, requiredQty] of productTotalQuantityMap.entries()) {
        const prodSnap = productSnapMap.get(prodId);
        const prodData = prodSnap.data();
        if (typeof prodData.stock === "number") {
          tx.update(db.collection("products").doc(prodId), {
            stock: prodData.stock - requiredQty,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // 3.2 Reserve Slot Allocation
      tx.set(
        slotRef,
        {
          id: canonicalSlotId,
          storeId,
          date: targetYmd,
          timeSlot: cleanPickupTime,
          currentOrders: currentSlotOrders + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 3.3 Atomic Queue Numbering Q001 - Q999
      let sequenceNumber = 1;
      if (counterSnap.exists) {
        sequenceNumber = (Number(counterSnap.data().lastSequence) || 0) + 1;
      }
      if (sequenceNumber > 999) {
        throw new HttpsError("resource-exhausted", "QUEUE_CAPACITY_EXCEEDED: คิวรับอาหารของวันนี้เต็มแล้ว (เกิน Q999)");
      }
      const queueNumber = `Q${String(sequenceNumber).padStart(3, "0")}`;

      tx.set(
        counterRef,
        {
          id: counterDocId,
          storeId,
          date: targetYmd,
          lastSequence: sequenceNumber,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 3.4 Create Order Document
      const studentProfileData = studentSnap.exists ? studentSnap.data() : null;
      const studentGuardianIds = Array.isArray(studentProfileData?.guardianIds) ? studentProfileData.guardianIds : [];

      const orderDocRef = db.collection("orders").doc();
      const orderId = orderDocRef.id;

      // Status resolution based on payment method
      let paymentStatus;
      let orderStatus;

      if (cleanPaymentMethod === "WALLET") {
        paymentStatus = "PAID";
        orderStatus = "CONFIRMED";
      } else if (cleanPaymentMethod === "PROMPTPAY") {
        paymentStatus = "PENDING_QR";
        orderStatus = "RESERVED";
      } else {
        paymentStatus = "PENDING_AT_STORE";
        orderStatus = "CONFIRMED";
      }

      const orderPayload = {
        id: orderId,
        orderId,
        storeId,
        userId: effectiveUserId,
        customerName: (customerName || "").trim() || "ลูกค้า QueueUp",
        customerPhone: customerPhone.trim(),
        ...(cleanStudentId ? { studentId: cleanStudentId } : {}),
        guardianIds: studentGuardianIds,
        queueNumber,
        status: orderStatus,
        orderStatus,
        paymentStatus,
        paymentMethod: cleanPaymentMethod,
        queueStatus: "waiting",
        totalAmountSatang: calculatedTotalSatang,
        totalAmount: calculatedTotalSatang / 100,
        finalAmountSatang,
        finalAmount: finalAmountSatang / 100,
        discountAppliedSatang: discountSatang,
        discountAppliedBaht: discountSatang / 100,
        couponCode: discountSatang > 0 ? cleanCoupon : null,
        couponTitle: discountSatang > 0 ? couponTitle : null,
        pointsEarned: Math.floor(finalAmountSatang / 1000),
        items: validatedOrderItems,
        allergenWarningAcknowledged: allergenScan.hasAllergens,
        acknowledgedAllergenNames: allergenScan.matchedAllergenNames,
        pickupTime: cleanPickupTime,
        pickupDate: targetYmd,
        slotId: canonicalSlotId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      tx.set(orderDocRef, orderPayload);

      // 3.5 Execute Wallet Deduction if WALLET
      if (cleanPaymentMethod === "WALLET") {
        const walletIdToDeduct = cleanStudentId || authUid;
        await processWalletPaymentInTransaction(tx, db, {
          studentOrUserId: walletIdToDeduct,
          amountSatang: finalAmountSatang,
          orderId,
          storeId,
        });
      }

      // 3.6 Record Single-Use Coupon Redemption
      if (cleanCoupon && discountSatang > 0) {
        const redemptionRef = db.collection("coupon_redemptions").doc(`${cleanCoupon}_${authUid}`);
        tx.set(redemptionRef, {
          id: `${cleanCoupon}_${authUid}`,
          couponCode: cleanCoupon,
          userId: authUid,
          orderId,
          storeId,
          discountSatang,
          redeemedAt: FieldValue.serverTimestamp(),
        });
      }

      // 3.7 Allergen Override Audit Log
      if (allergenScan.hasAllergens) {
        const allergenAuditRef = db.collection("audit_logs").doc();
        tx.set(allergenAuditRef, {
          id: allergenAuditRef.id,
          action: "ALLERGEN_WARNING_OVERRIDDEN",
          actorUid: authUid,
          targetStudentId: allergyProfileId,
          orderId,
          storeId,
          matchedAllergenNames: allergenScan.matchedAllergenNames,
          hasDeclaredMatch: allergenScan.hasDeclaredMatch === true,
          flaggedItems: allergenScan.flaggedItems,
          timestamp: FieldValue.serverTimestamp(),
        });
      }

      return {
        success: true,
        orderId,
        queueNumber,
        totalAmountSatang: calculatedTotalSatang,
        totalAmountBaht: calculatedTotalSatang / 100,
        finalAmountSatang,
        finalAmountBaht: finalAmountSatang / 100,
        discountSatang,
        discountBaht: discountSatang / 100,
        couponCode: discountSatang > 0 ? cleanCoupon : null,
        orderStatus,
        paymentStatus,
        paymentMethod: cleanPaymentMethod,
        order: orderPayload,
      };
    });
  } catch (err) {
    console.error("[createOrderAuthoritative] Error:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err.message || "Failed to create authoritative order");
  }
}
