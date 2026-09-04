import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();
const db = getFirestore();

/**
 * ============================================================================
 * QUEUEUP CLOUD FUNCTIONS (ZERO-PAYMENT ARCHITECTURE)
 * Direct Food Ordering, Authoritative Order Creation & Queue Issuance
 * ============================================================================
 */

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
 * 🔒 Server-Authoritative Order Creation (Instant Q001 via Zero-Payment)
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
    const targetPickupDateObj = new Date(Date.UTC(pYear, pMonth - 1, pDay, 12, 0, 0));
    const targetBangkok = getBangkokYmd(targetPickupDateObj);

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

    try {
      return await db.runTransaction(async (tx) => {
        // ===================================================================
        // PHASE 1: READ ALL REQUIRED DOCUMENTS
        // ===================================================================
        const shopRef = db.collection("shops").doc(storeId);
        const shopSnap = await tx.get(shopRef);
        if (!shopSnap.exists) {
          throw new HttpsError("not-found", `STORE_NOT_FOUND: ร้านค้ารหัส ${storeId} ไม่มีอยู่ในระบบ`);
        }
        const shopData = shopSnap.data();

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

        for (const itemReq of items) {
          const prodData = productSnapMap.get(itemReq.productId).data();
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

              if (groupSelections.length < minSelections) {
                throw new HttpsError("invalid-argument", `REQUIRED_MODIFIER_MISSING: กรุณาเลือก ${modData.name || "ตัวเลือกที่จำเป็น"} อย่างน้อย ${minSelections} รายการ สำหรับเมนู "${prodData.name}"`);
              }
              if (maxSelections !== null && groupSelections.length > maxSelections) {
                throw new HttpsError("invalid-argument", `MAX_SELECTIONS_EXCEEDED: กลุ่มตัวเลือก "${modData.name}" เลือกได้สูงสุดไม่เกิน ${maxSelections} รายการ`);
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
            quantity: Number(itemReq.quantity),
            unitPriceSatang,
            unitPrice: unitPriceSatang / 100,
            subtotalSatang,
            subtotal: subtotalSatang / 100,
            customNotes: itemReq.customNotes || "",
            selectedModifiers,
          });
        }

        // 2.3 Slot Capacity (Fail-Closed)
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


        // 2.4 Queue Number Generation
        let sequenceNumber = 1;
        if (counterSnap.exists) {
          sequenceNumber = (Number(counterSnap.data().lastSequence) || 0) + 1;
        }
        const queueNumber = `Q${String(sequenceNumber).padStart(3, "0")}`;

        // ===================================================================
        // PHASE 3: WRITE ALL MUTATIONS ATOMICALLY
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

        return {
          success: true,
          orderId,
          queueNumber,
          totalAmountSatang: calculatedTotalSatang,
          totalAmountBaht: calculatedTotalSatang / 100,
          orderStatus: "PENDING",
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
 * Health check & platform status endpoint
 */
export const getSystemHealth = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    try {
      res.status(200).json({
        status: "ok",
        architecture: "Zero-Payment Direct Food Queue",
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

