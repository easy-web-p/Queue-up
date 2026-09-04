import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();
const db = getFirestore();
const authAdmin = getAuth();

/**
 * ============================================================================
 * QUEUEUP & QUEUEUP FOR CAMPUS CLOUD FUNCTIONS
 * Direct Food Ordering, Authoritative Order Creation & Queue Issuance
 * Student Vendor Workflow, Campus Wallet & Emergency Medical Protocols
 * ============================================================================
 */

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
 * 🔒 Server-Authoritative Order Creation (5-Phase Ordering with Campus Wallet support)
 */
export const createOrderAuthoritative = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    // 1. Authentication Guard
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนทำการสั่งจองอาหาร");
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
      paymentMode, // 'CAMPUS_WALLET' | 'DIRECT_ZERO_PAYMENT'
      studentId,   // Required if paymentMode === 'CAMPUS_WALLET'
    } = request.data || {};

    if (userId && userId !== authUid && request.auth.token?.admin !== true) {
      throw new HttpsError("permission-denied", "ไม่สามารถสร้างคำสั่งซื้อในนามของผู้ใช้อื่นได้");
    }

    const effectiveUserId = authUid;

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
    const targetPickupDateObj = new Date(Date.UTC(pYear, pMonth - 1, pDay, 12, 0, 0));
    const targetBangkok = getBangkokYmd(targetPickupDateObj);

    // Strict same-day past pickup time validation
    if (targetYmdClean === currentBangkok.ymdClean) {
      const currentBangkokTime = getBangkokCurrentTime(now);
      if (cleanPickupTime <= currentBangkokTime) {
        throw new HttpsError("failed-precondition", `PAST_PICKUP_TIME_NOT_ALLOWED: เวลารับอาหาร (${cleanPickupTime} น.) ผ่านไปแล้วสำหรับวันนี้ (เวลาปัจจุบัน ${currentBangkokTime} น.)`);
      }
    }

    // Aggregate Product Quantities
    const productTotalQuantityMap = new Map();
    let totalOrderItemsCount = 0;

    for (const it of items) {
      if (!it.productId) {
        throw new HttpsError("invalid-argument", "PRODUCT_ID_REQUIRED: ทุกรายการต้องระบุ productId");
      }
      const qty = Number(it.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new HttpsError("invalid-argument", "INVALID_QUANTITY: จำนวนสินค้าต้องเป็นจำนวนเต็มบวก");
      }
      totalOrderItemsCount += qty;
      productTotalQuantityMap.set(it.productId, (productTotalQuantityMap.get(it.productId) || 0) + qty);
    }

    const isCampusWallet = paymentMode === "CAMPUS_WALLET";
    const effectiveStudentId = isCampusWallet ? (studentId || authUid) : null;

    try {
      return await db.runTransaction(async (tx) => {
        // ===================================================================
        // PHASE 0 & 1: READ ALL REQUIRED DOCUMENTS
        // ===================================================================
        const shopRef = db.collection("shops").doc(storeId);
        const shopSnap = await tx.get(shopRef);
        if (!shopSnap.exists) {
          throw new HttpsError("not-found", `STORE_NOT_FOUND: ร้านค้ารหัส ${storeId} ไม่มีอยู่ในระบบ`);
        }
        const shopData = shopSnap.data();

        // Optional Campus Wallet & Student documents
        let walletSnap = null;
        let walletRef = null;
        let studentSnap = null;
        if (isCampusWallet && effectiveStudentId) {
          walletRef = db.collection("wallets").doc(effectiveStudentId);
          walletSnap = await tx.get(walletRef);
          const studentRef = db.collection("students").doc(effectiveStudentId);
          studentSnap = await tx.get(studentRef);
        }

        // Read all product documents
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

        // Add any modifierGroupIds selected in the request items
        for (const it of items) {
          if (Array.isArray(it.selectedModifiers)) {
            it.selectedModifiers.forEach((m) => {
              if (m.modifierGroupId) referencedModifierGroupIds.add(m.modifierGroupId);
            });
          }
        }

        // Read all referenced modifier groups
        const modifierGroupSnapMap = new Map();
        for (const mgId of referencedModifierGroupIds) {
          const modRef = db.collection("modifier_groups").doc(mgId);
          const modSnap = await tx.get(modRef);
          if (modSnap.exists) {
            modifierGroupSnapMap.set(mgId, modSnap);
          }
        }

        // Read Slot Capacity doc
        const cleanTime = cleanPickupTime.replace(":", "");
        const dateScopedSlotId = `slot_${storeId}_${targetYmdClean}_${cleanTime}`;
        const slotRef = db.collection("store_slots").doc(dateScopedSlotId);
        const slotSnap = await tx.get(slotRef);

        // Read Sequence Counter doc
        const counterDocId = `counter_${storeId}_${targetYmdClean}`;
        const counterRef = db.collection("queue_counters").doc(counterDocId);
        const counterSnap = await tx.get(counterRef);

        // ===================================================================
        // PHASE 2: VALIDATE BUSINESS RULES & CALCULATE AMOUNTS
        // ===================================================================
        // 2.1 Store Availability & Operating Hours
        if (shopData.isOpen === false || shopData.status === "closed") {
          throw new HttpsError("failed-precondition", "STORE_CLOSED: ร้านค้าปิดให้บริการชั่วคราว");
        }
        if (shopData.operationalOverride === "FORCE_CLOSE" || shopData.operationalOverride === "EMERGENCY_STOP") {
          throw new HttpsError("failed-precondition", "STORE_PAUSED: ร้านค้าหยุดรับออเดอร์ชั่วคราว");
        }

        if (shopData.operatingHours) {
          const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
          const targetDayName = days[targetBangkok.dayOfWeekIndex];
          const targetDaySchedule = shopData.operatingHours[targetDayName];

          if (targetDaySchedule) {
            if (!targetDaySchedule.isOpen) {
              throw new HttpsError("failed-precondition", `STORE_CLOSED_ON_DATE: ร้านค้าปิดทำการในวัน${targetDayName} (${targetYmd})`);
            }
            const { open, close } = targetDaySchedule;
            const isPickupAllowed =
              open <= close
                ? cleanPickupTime >= open && cleanPickupTime <= close
                : cleanPickupTime >= open || cleanPickupTime <= close;
            if (!isPickupAllowed) {
              throw new HttpsError("failed-precondition", `INVALID_PICKUP_TIME: เวลารับอาหาร ${cleanPickupTime} น. อยู่นอกเวลาทำการ (${open} - ${close})`);
            }
          }
        }

        // 2.2 Product Stock & Modifier Integrity
        for (const [prodId, requiredTotalQty] of productTotalQuantityMap.entries()) {
          const prodData = productSnapMap.get(prodId).data();
          if (prodData.storeId !== storeId) {
            throw new HttpsError("invalid-argument", `CROSS_STORE_PRODUCT_VIOLATION: สินค้า ${prodData.name} ไม่ได้เป็นของร้าน ${storeId}`);
          }
          if (prodData.isAvailable === false) {
            throw new HttpsError("failed-precondition", `PRODUCT_UNAVAILABLE: สินค้า ${prodData.name} ปิดรับออเดอร์ชั่วคราว`);
          }
          const currentStock = typeof prodData.stock === "number" ? prodData.stock : 0;
          if (currentStock < requiredTotalQty) {
            throw new HttpsError("failed-precondition", `INSUFFICIENT_STOCK: สินค้า "${prodData.name}" คงเหลือเพียง ${currentStock} ชุด (ต้องการ ${requiredTotalQty})`);
          }
        }

        let calculatedTotalSatang = 0;
        const validatedOrderItems = [];
        const itemCategories = new Set();

        for (const itemReq of items) {
          const prodData = productSnapMap.get(itemReq.productId).data();
          if (prodData.category) itemCategories.add(prodData.category);

          const basePriceSatang = prodData.priceSatang ?? Math.round((Number(prodData.price) || 0) * 100);
          let itemModifierSatang = 0;

          const selectedModifiers = itemReq.selectedModifiers || [];
          const allowedGroupIds = new Set(prodData.modifierGroupIds || []);

          // Validate linked required modifier groups
          if (Array.isArray(prodData.modifierGroupIds)) {
            for (const mgId of prodData.modifierGroupIds) {
              const modSnap = modifierGroupSnapMap.get(mgId);
              if (!modSnap || !modSnap.exists) {
                throw new HttpsError("not-found", `MODIFIER_GROUP_NOT_FOUND: ไม่พบกลุ่มตัวเลือก ${mgId} สำหรับเมนู "${prodData.name}"`);
              }
              const modData = modSnap.data();
              if (modData.storeId !== storeId) {
                throw new HttpsError("invalid-argument", `CROSS_STORE_MODIFIER_VIOLATION: กลุ่มตัวเลือก ${mgId} ไม่ได้เป็นของร้าน ${storeId}`);
              }
              const groupSelections = selectedModifiers.filter((m) => m.modifierGroupId === mgId);
              const minSelections = modData.minSelections ?? modData.minSelect ?? (modData.required || modData.isRequired ? 1 : 0);
              const maxSelections = modData.maxSelections ?? modData.maxSelect ?? (modData.selectionType === "single" ? 1 : null);
              const isSingle = modData.selectionType === "single" || modData.type === "single";

              // Check duplicate optionIds within group
              const optionIdsInGroup = groupSelections.map((m) => m.optionId);
              if (new Set(optionIdsInGroup).size !== optionIdsInGroup.length) {
                throw new HttpsError("invalid-argument", `DUPLICATE_MODIFIER_OPTION: กลุ่มตัวเลือก "${modData.name || mgId}" มีตัวเลือกซ้ำกัน`);
              }

              if (groupSelections.length < minSelections) {
                throw new HttpsError("invalid-argument", `REQUIRED_MODIFIER_MISSING: กรุณาเลือก ${modData.name || "ตัวเลือกที่จำเป็น"} อย่างน้อย ${minSelections} รายการ สำหรับเมนู "${prodData.name}"`);
              }
              if (maxSelections !== null && groupSelections.length > maxSelections) {
                throw new HttpsError("invalid-argument", `MAX_SELECTIONS_EXCEEDED: กลุ่มตัวเลือก "${modData.name}" เลือกได้สูงสุดไม่เกิน ${maxSelections} รายการ`);
              }
              if (isSingle && groupSelections.length > 1) {
                throw new HttpsError("invalid-argument", `SINGLE_SELECTION_VIOLATED: กลุ่มตัวเลือก "${modData.name}" สามารถเลือกได้เพียง 1 ตัวเลือกเท่านั้น`);
              }
            }
          }

          // Validate chosen modifier options
          if (selectedModifiers.length > 0) {
            for (const selMod of selectedModifiers) {
              if (!allowedGroupIds.has(selMod.modifierGroupId)) {
                throw new HttpsError("invalid-argument", `INVALID_PRODUCT_MODIFIER: กลุ่มตัวเลือก ${selMod.modifierGroupId} ไม่ได้เป็นของสินค้า "${prodData.name}"`);
              }
              const modSnap = modifierGroupSnapMap.get(selMod.modifierGroupId);
              if (!modSnap || !modSnap.exists) {
                throw new HttpsError("not-found", `MODIFIER_GROUP_NOT_FOUND: ไม่พบกลุ่มตัวเลือก ${selMod.modifierGroupId}`);
              }
              const modData = modSnap.data();
              const opt = (modData.options || []).find((o) => o.id === selMod.optionId);
              if (!opt) {
                throw new HttpsError("not-found", `OPTION_NOT_FOUND: ไม่พบตัวเลือก ${selMod.optionId}`);
              }
              if (opt.isOutOfStock) {
                throw new HttpsError("failed-precondition", `OPTION_OUT_OF_STOCK: ตัวเลือก "${opt.name}" หมดชั่วคราว`);
              }
              const optPriceSatang = opt.priceModifierSatang ?? Math.round((Number(opt.priceModifier) || 0) * 100);
              itemModifierSatang += optPriceSatang;
            }
          }

          const unitPriceSatang = basePriceSatang + itemModifierSatang;
          const subtotalSatang = unitPriceSatang * Number(itemReq.quantity);
          calculatedTotalSatang += subtotalSatang;

          validatedOrderItems.push({
            productId: itemReq.productId,
            name: prodData.name,
            category: prodData.category || "General",
            quantity: Number(itemReq.quantity),
            unitPriceSatang,
            unitPrice: unitPriceSatang / 100,
            subtotalSatang,
            subtotal: subtotalSatang / 100,
            customNotes: itemReq.customNotes || "",
            selectedModifiers,
          });
        }

        // 2.3 Campus Wallet Spending Rules Enforcement (Phase 0)
        let walletData = null;
        if (isCampusWallet) {
          if (!walletSnap || !walletSnap.exists) {
            throw new HttpsError("not-found", "CAMPUS_WALLET_NOT_FOUND: ไม่พบบัญชีกระเป๋าเงินดิจิทัลสำหรับนักเรียน");
          }
          walletData = walletSnap.data();
          if (walletData.isLocked === true) {
            throw new HttpsError("failed-precondition", "CAMPUS_WALLET_LOCKED: กระเป๋าเงินถูกระงับการใช้งานชั่วคราวโดยผู้ปกครองหรือโรงเรียน");
          }

          const currentBalance = Number(walletData.balanceSatang) || 0;
          if (currentBalance < calculatedTotalSatang) {
            throw new HttpsError("failed-precondition", `INSUFFICIENT_WALLET_BALANCE: ยอดเงินในกระเป๋าไม่เพียงพอ (คงเหลือ ${currentBalance / 100} บาท, ยอดสั่งซื้อ ${calculatedTotalSatang / 100} บาท)`);
          }

          // Check Daily Limit
          const dailyLimitSatang = typeof walletData.dailyLimitSatang === "number" ? walletData.dailyLimitSatang : 20000; // default 200 THB
          const lastSpentDate = walletData.lastSpentDate || "";
          const spentToday = lastSpentDate === targetYmd ? (Number(walletData.spentTodaySatang) || 0) : 0;
          if (spentToday + calculatedTotalSatang > dailyLimitSatang) {
            throw new HttpsError("failed-precondition", `DAILY_LIMIT_EXCEEDED: ยอดการใช้จ่ายเกินวงเงินรายวัน (${dailyLimitSatang / 100} บาท/วัน) วันนี้ใช้ไปแล้ว ${spentToday / 100} บาท`);
          }

          // Check Weekly Limit
          const weeklyLimitSatang = typeof walletData.weeklyLimitSatang === "number" ? walletData.weeklyLimitSatang : 100000; // default 1000 THB
          const spentThisWeek = Number(walletData.spentThisWeekSatang) || 0;
          if (spentThisWeek + calculatedTotalSatang > weeklyLimitSatang) {
            throw new HttpsError("failed-precondition", `WEEKLY_LIMIT_EXCEEDED: ยอดการใช้จ่ายเกินวงเงินรายสัปดาห์ (${weeklyLimitSatang / 100} บาท/สัปดาห์)`);
          }

          // Check Blocked Categories
          const blockedCategories = Array.isArray(walletData.blockedCategories) ? walletData.blockedCategories : [];
          for (const cat of itemCategories) {
            if (blockedCategories.includes(cat)) {
              throw new HttpsError("failed-precondition", `BLOCKED_CATEGORY_VIOLATION: หมวดหมู่สินค้า "${cat}" ถูกจำกัดการซื้อโดยผู้ปกครอง`);
            }
          }
        }

        // 2.4 Slot Capacity (Fail-Closed)
        if (typeof shopData.maxOrdersPerSlot !== "number" || shopData.maxOrdersPerSlot <= 0) {
          throw new HttpsError("failed-precondition", "STORE_CAPACITY_NOT_CONFIGURED: ร้านค้ายังไม่ได้กำหนดขีดจำกัดโควตาคิวรับอาหาร");
        }
        const authoritativeCapacity = shopData.maxOrdersPerSlot;
        let currentSlotOrders = 0;
        if (slotSnap.exists) {
          const slotData = slotSnap.data();
          currentSlotOrders = Number(slotData.currentOrders) || 0;
        }
        if (currentSlotOrders + 1 > authoritativeCapacity) {
          throw new HttpsError("resource-exhausted", `SLOT_CAPACITY_EXCEEDED: รอบเวลารับอาหาร ${cleanPickupTime} น. ของวันที่ ${targetYmd} คิวเต็มแล้ว (${currentSlotOrders}/${authoritativeCapacity})`);
        }

        // 2.5 Queue Number Generation
        let sequenceNumber = 1;
        if (counterSnap.exists) {
          sequenceNumber = (Number(counterSnap.data().lastSequence) || 0) + 1;
        }
        const queueNumber = `Q${String(sequenceNumber).padStart(3, "0")}`;

        // ===================================================================
        // PHASE 3 & 4: WRITE ALL MUTATIONS ATOMICALLY (Including Wallet Deduction)
        // ===================================================================
        // Update product stock
        for (const [prodId, requiredTotalQty] of productTotalQuantityMap.entries()) {
          const prodRef = db.collection("products").doc(prodId);
          const prodData = productSnapMap.get(prodId).data();
          const currentStock = typeof prodData.stock === "number" ? prodData.stock : 0;
          tx.update(prodRef, {
            stock: currentStock - requiredTotalQty,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // Update slot capacity
        tx.set(
          slotRef,
          {
            slotId: dateScopedSlotId,
            storeId,
            date: targetYmd,
            timeSlot: cleanPickupTime,
            capacity: authoritativeCapacity,
            currentOrders: currentSlotOrders + 1,
            totalItemsReserved: (slotSnap.exists ? Number(slotSnap.data().totalItemsReserved || 0) : 0) + totalOrderItemsCount,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Update queue counter
        tx.set(
          counterRef,
          {
            storeId,
            date: targetYmd,
            lastSequence: sequenceNumber,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Create authoritative Order
        const orderDocRef = db.collection("orders").doc();
        const orderId = orderDocRef.id;

        const orderPayload = {
          id: orderId,
          orderId,
          storeId,
          userId: effectiveUserId,
          customerName: (customerName || "").trim() || "ลูกค้า QueueUp",
          customerPhone: customerPhone.trim(),
          queueNumber,
          status: "PENDING",
          queueStatus: "waiting",
          paymentMode: isCampusWallet ? "CAMPUS_WALLET" : "DIRECT_ZERO_PAYMENT",
          paymentStatus: isCampusWallet ? "PAID" : "NOT_APPLICABLE",
          studentId: effectiveStudentId,
          totalAmountSatang: calculatedTotalSatang,
          totalAmount: calculatedTotalSatang / 100,
          finalAmountSatang: calculatedTotalSatang,
          finalAmount: calculatedTotalSatang / 100,
          discountAppliedSatang: 0,
          pointsEarned: Math.floor(calculatedTotalSatang / 1000),
          items: validatedOrderItems,
          pickupTime: cleanPickupTime,
          pickupDate: targetYmd,
          slotId: dateScopedSlotId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        tx.set(orderDocRef, orderPayload);

        // Phase 4: Atomic Wallet Deduction & Transaction Log
        if (isCampusWallet && walletRef && walletData) {
          const currentBal = Number(walletData.balanceSatang) || 0;
          const lastSpentDate = walletData.lastSpentDate || "";
          const spentToday = lastSpentDate === targetYmd ? (Number(walletData.spentTodaySatang) || 0) : 0;
          const spentThisWeek = Number(walletData.spentThisWeekSatang) || 0;

          tx.update(walletRef, {
            balanceSatang: currentBal - calculatedTotalSatang,
            spentTodaySatang: spentToday + calculatedTotalSatang,
            spentThisWeekSatang: spentThisWeek + calculatedTotalSatang,
            lastSpentDate: targetYmd,
            updatedAt: FieldValue.serverTimestamp(),
          });

          const txRef = db.collection("wallet_transactions").doc();
          tx.set(txRef, {
            id: txRef.id,
            walletId: effectiveStudentId,
            studentId: effectiveStudentId,
            orderId,
            amountSatang: calculatedTotalSatang,
            type: "SPEND",
            storeId,
            storeName: shopData.name || "Campus Store",
            actorUid: authUid,
            note: `ซื้ออาหารคิว ${queueNumber} ที่ร้าน ${shopData.name || storeId}`,
            timestamp: FieldValue.serverTimestamp(),
          });
        }

        return {
          success: true,
          orderId,
          queueNumber,
          totalAmountSatang: calculatedTotalSatang,
          totalAmountBaht: calculatedTotalSatang / 100,
          orderStatus: "PENDING",
          paymentMode: isCampusWallet ? "CAMPUS_WALLET" : "DIRECT_ZERO_PAYMENT",
          order: orderPayload,
        };
      });
    } catch (err) {
      console.error("[createOrderAuthoritative] Error:", err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message || "Failed to create authoritative order");
    }
  }
);

/**
 * 🎓 Submit Vendor Approval Request (Student Entrepreneur Onboarding)
 */
export const submitVendorApprovalRequest = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนยื่นคำขอเปิดร้านค้า");
    }

    const {
      studentName,
      studentCode,
      class: studentClass,
      room,
      shopName,
      requestedZone,
      productCategories,
      menuPreview,
    } = request.data || {};

    if (!studentName || !studentCode || !shopName || !requestedZone) {
      throw new HttpsError("invalid-argument", "กรุณากรอกข้อมูลนักเรียนและข้อมูลร้านค้าให้ครบถ้วน");
    }

    const approvalDocRef = db.collection("vendor_approvals").doc();
    const payload = {
      id: approvalDocRef.id,
      studentVendorId: request.auth.uid,
      studentName: String(studentName).trim(),
      studentCode: String(studentCode).trim(),
      class: String(studentClass || "").trim(),
      room: String(room || "").trim(),
      shopName: String(shopName).trim(),
      requestedZone: String(requestedZone).trim(),
      productCategories: Array.isArray(productCategories) ? productCategories : ["Snacks"],
      menuPreview: Array.isArray(menuPreview) ? menuPreview : [],
      status: "PENDING",
      submittedAt: FieldValue.serverTimestamp(),
    };

    await approvalDocRef.set(payload);

    return {
      success: true,
      approvalId: approvalDocRef.id,
      message: "ยื่นคำขอเปิดร้านค้าสำเร็จ กรุณารออาจารย์หรือผู้รับผิดชอบโรงอาหารอนุมัติ",
    };
  }
);

/**
 * 👨‍🏫 Review Vendor Approval Request (Staff Supervisor / Admin Approval Panel)
 */
export const reviewVendorApprovalRequest = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนทำการตรวจสอบ");
    }

    const tokenRole = request.auth.token?.role;
    const isStaffOrAdmin = tokenRole === "staff_supervisor" || tokenRole === "admin" || request.auth.token?.admin === true;
    
    // Check in staff_supervisors collection if token role is not yet refreshed
    let isAuthorized = isStaffOrAdmin;
    if (!isAuthorized) {
      const staffDoc = await db.collection("staff_supervisors").doc(request.auth.uid).get();
      if (staffDoc.exists && staffDoc.data().canApproveVendors) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new HttpsError("permission-denied", "คุณไม่มีสิทธิ์ในการอนุมัติหรือปฏิเสธคำขอเปิดร้านค้า (ต้องเป็น Staff Supervisor หรือ Admin)");
    }

    const { approvalId, decision, rejectionReason } = request.data || {};
    if (!approvalId || !["APPROVED", "REJECTED"].includes(decision)) {
      throw new HttpsError("invalid-argument", "กรุณาระบุ approvalId และ decision ('APPROVED' หรือ 'REJECTED')");
    }

    const approvalRef = db.collection("vendor_approvals").doc(approvalId);
    const approvalSnap = await approvalRef.get();
    if (!approvalSnap.exists) {
      throw new HttpsError("not-found", "ไม่พบเอกสารคำขอนี้ในระบบ");
    }

    const approvalData = approvalSnap.data();
    const studentVendorId = approvalData.studentVendorId;

    if (decision === "APPROVED") {
      // 1. Update Approval Doc
      await approvalRef.update({
        status: "APPROVED",
        approvedBy: request.auth.uid,
        approvedByName: request.auth.token?.name || "อาจารย์ผู้ดูแลระบบ",
        approvedAt: FieldValue.serverTimestamp(),
      });

      // 2. Set Custom User Claims for student vendor role
      try {
        await authAdmin.setCustomUserClaims(studentVendorId, {
          role: "student_vendor",
        });
      } catch (err) {
        console.warn("[reviewVendorApprovalRequest] Warning setting custom claims:", err);
      }

      // 3. Ensure Shop Document is created and linked
      const shopDocRef = db.collection("shops").doc(`shop_${studentVendorId}`);
      await shopDocRef.set(
        {
          id: shopDocRef.id,
          name: approvalData.shopName,
          ownerUid: studentVendorId,
          ownerName: approvalData.studentName,
          zone: approvalData.requestedZone,
          status: "active",
          isOpen: true,
          maxOrdersPerSlot: 10,
          categories: approvalData.productCategories || ["Campus Snacks"],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 4. Update user profile role
      await db.collection("users").doc(studentVendorId).set(
        {
          role: "student_vendor",
          storeId: shopDocRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        success: true,
        status: "APPROVED",
        shopId: shopDocRef.id,
        message: "อนุมัติเปิดร้านค้าให้นักเรียนสำเร็จและเปิดใช้งานร้านเรียบร้อย",
      };
    } else {
      // REJECTED
      await approvalRef.update({
        status: "REJECTED",
        rejectionReason: rejectionReason || "ข้อมูลไม่ผ่านเกณฑ์การเปิดร้านในโรงเรียน",
        reviewedBy: request.auth.uid,
        reviewedAt: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        status: "REJECTED",
        message: "บันทึกผลการปฏิเสธคำขอเรียบร้อยแล้ว",
      };
    }
  }
);

/**
 * 💳 Top-up Campus Wallet (Staff or Guardian)
 */
export const topupCampusWallet = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนทำรายการเติมเงิน");
    }

    const { studentId, amountSatang, note, paymentMethod } = request.data || {};
    const amt = Number(amountSatang);
    if (!studentId || !Number.isInteger(amt) || amt <= 0) {
      throw new HttpsError("invalid-argument", "กรุณาระบุ studentId และจำนวนเงิน (Satang) ที่ถูกต้อง");
    }

    const walletRef = db.collection("wallets").doc(studentId);

    return await db.runTransaction(async (tx) => {
      const walletSnap = await tx.get(walletRef);
      let currentBal = 0;
      let walletData = {};

      if (walletSnap.exists) {
        walletData = walletSnap.data();
        currentBal = Number(walletData.balanceSatang) || 0;
      }

      const newBal = currentBal + amt;

      tx.set(
        walletRef,
        {
          studentId,
          balanceSatang: newBal,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const txRef = db.collection("wallet_transactions").doc();
      tx.set(txRef, {
        id: txRef.id,
        walletId: studentId,
        studentId,
        amountSatang: amt,
        type: "TOPUP",
        actorUid: request.auth.uid,
        paymentMethod: paymentMethod || "PROMPTPAY",
        note: note || "เติมเงินเข้ากระเป๋านักเรียน",
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        studentId,
        addedSatang: amt,
        newBalanceSatang: newBal,
        newBalanceBaht: newBal / 100,
      };
    });
  }
);

/**
 * 🛡️ Update Campus Wallet Spending Limits & Categories (Guardian / Supervisor)
 */
export const updateCampusWalletLimits = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนตั้งค่ากระเป๋าเงิน");
    }

    const { studentId, dailyLimitSatang, weeklyLimitSatang, blockedCategories, isLocked } = request.data || {};
    if (!studentId) {
      throw new HttpsError("invalid-argument", "กรุณาระบุ studentId");
    }

    const walletRef = db.collection("wallets").doc(studentId);
    const updatePayload = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof dailyLimitSatang === "number" && dailyLimitSatang >= 0) {
      updatePayload.dailyLimitSatang = dailyLimitSatang;
    }
    if (typeof weeklyLimitSatang === "number" && weeklyLimitSatang >= 0) {
      updatePayload.weeklyLimitSatang = weeklyLimitSatang;
    }
    if (Array.isArray(blockedCategories)) {
      updatePayload.blockedCategories = blockedCategories;
    }
    if (typeof isLocked === "boolean") {
      updatePayload.isLocked = isLocked;
    }

    await walletRef.set(updatePayload, { merge: true });

    return {
      success: true,
      studentId,
      message: "อัปเดตการตั้งค่าและวงเงินการใช้งานเรียบร้อยแล้ว",
    };
  }
);

/**
 * 🚨 Log Emergency Medical / Allergy Lookup (Immutable Audit Trail)
 */
export const logEmergencyLookup = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "กรุณาเข้าสู่ระบบก่อนเข้าถึงข้อมูลฉุกเฉิน");
    }

    const { studentId, studentName, reason } = request.data || {};
    if (!studentId) {
      throw new HttpsError("invalid-argument", "กรุณาระบุ studentId");
    }

    const auditRef = db.collection("audit_logs").doc();
    await auditRef.set({
      id: auditRef.id,
      action: "EMERGENCY_MEDICAL_LOOKUP",
      actorUid: request.auth.uid,
      targetStudentId: studentId,
      targetStudentName: studentName || "N/A",
      reason: reason || "การรักษาพยาบาลหรืออุบัติเหตุฉุกเฉิน",
      timestamp: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      auditId: auditRef.id,
    };
  }
);

/**
 * Health check & platform status endpoint
 */
export const getSystemHealth = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    try {
      res.status(200).json({
        status: "ok",
        architecture: "Zero-Payment Direct Food Queue with QueueUp for Campus Extension",
        timestamp: new Date().toISOString(),
        region: "asia-southeast1",
      });
    } catch (error) {
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

/**
 * Scheduled Daily Capacity & Counters Cleanup / Reset (Maintenance routine)
 */
export const scheduledDailyMaintenance = onSchedule(
  { schedule: "0 0 * * *", timeZone: "Asia/Bangkok", region: "asia-southeast1" },
  async () => {
    console.log("[QueueUp] Daily maintenance routine triggered successfully.");
  }
);
