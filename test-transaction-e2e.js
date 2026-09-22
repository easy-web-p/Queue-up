/**
 * ============================================================================
 * QueueUp Zero-Payment & Instant Queue Architecture Comprehensive Test Matrix
 * ============================================================================
 * 
 * 100% Zero-Payment Architecture Verification:
 * - Direct Cart -> Confirm Order -> Instant Sequential Atomic Queue Number (Q001, Q002...)
 * - Zero Payment Fields (No paymentMethod, paymentStatus, paymentExpiredAt, chargeId)
 * - Strict Real Calendar Date Validation (Rejection of 2026-02-31, 2026-99-99, 2026-13-45)
 * - Same-Day Past Pickup Time Guard (Rejection of pickup time earlier than Bangkok current time)
 * - Fail-Closed Store Capacity Enforcement (STORE_CAPACITY_NOT_CONFIGURED if maxOrdersPerSlot unset)
 * - Structured Modifier Bounds, Single-Selection Limit & Duplicate Option Guard
 * - Optimistic Concurrency Control (OCC) Simulation & Atomic Rollbacks
 * - Kitchen State Machine Transitions (PENDING -> CONFIRMED -> PREPARING -> READY -> COMPLETED)
 */

import assert from 'node:assert/strict';
// The rules under test, imported from the modules the Cloud Function uses.
import {
  validateOrderRequest,
  checkStoreAvailability,
  checkSlotCapacity,
  nextQueueNumber,
} from './functions/orderRequest.js';
import { checkProductAvailability, priceOrder } from './functions/orderPricing.js';

console.log('🧪 Starting QueueUp Pure Zero-Payment & Instant Queue Test Matrix...\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
  }
}

/**
 * Advanced In-Memory Firestore Transaction Engine with OCC, Versioning & Atomic Rollback
 */
class AdvancedFirestoreEngine {
  constructor() {
    this.storage = new Map(); // path -> { data, version }
  }

  getDoc(path) {
    const record = this.storage.get(path);
    return record ? JSON.parse(JSON.stringify(record.data)) : null;
  }

  setDoc(path, data, options = {}) {
    const existing = this.storage.get(path);
    if (options.merge && existing) {
      this.storage.set(path, {
        data: { ...existing.data, ...data },
        version: existing.version + 1,
      });
    } else {
      this.storage.set(path, {
        data: JSON.parse(JSON.stringify(data)),
        version: (existing ? existing.version : 0) + 1,
      });
    }
  }

  async runTransaction(updateFunction, maxRetries = 10) {
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      const readSnapshots = new Map(); // path -> version
      const stagedWrites = new Map();  // path -> { type: 'set'|'update', data, options }

      const tx = {
        get: async (docRef) => {
          const record = this.storage.get(docRef.path);
          const version = record ? record.version : 0;
          readSnapshots.set(docRef.path, version);
          return {
            exists: record !== undefined && record !== null,
            data: () => (record ? JSON.parse(JSON.stringify(record.data)) : null),
            ref: docRef,
          };
        },
        set: (docRef, data, options = {}) => {
          stagedWrites.set(docRef.path, { type: 'set', data, options });
        },
        update: (docRef, data) => {
          stagedWrites.set(docRef.path, { type: 'update', data });
        }
      };

      try {
        const result = await updateFunction(tx);

        // Commit Phase: Check for Concurrency Conflicts
        for (const [path, readVersion] of readSnapshots.entries()) {
          const currentRecord = this.storage.get(path);
          const currentVersion = currentRecord ? currentRecord.version : 0;
          if (currentVersion !== readVersion) {
            throw new Error(`CONCURRENCY_CONFLICT on ${path}`);
          }
        }

        // Apply Staged Writes Atomically
        for (const [path, write] of stagedWrites.entries()) {
          if (write.type === 'set') {
            this.setDoc(path, write.data, write.options);
          } else if (write.type === 'update') {
            const existing = this.storage.get(path);
            if (!existing) throw new Error(`Document ${path} does not exist for update`);
            this.storage.set(path, {
              data: { ...existing.data, ...write.data },
              version: existing.version + 1,
            });
          }
        }

        return result;
      } catch (err) {
        if (err.message.includes('CONCURRENCY_CONFLICT') && attempt < maxRetries) {
          // Jittered backoff & retry
          await new Promise((r) => setTimeout(r, Math.random() * 25));
          continue;
        }
        // Failure: Staged writes are automatically discarded (Snapshot Rollback)
        throw err;
      }
    }
    throw new Error('Transaction failed after maximum concurrency retries');
  }
}


function getBangkokYmd(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const ymd = formatter.format(date);
  const ymdClean = ymd.replace(/-/g, '');
  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' });
  const weekdayShort = dayFormatter.format(date).toLowerCase();
  const weekdayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const dayOfWeekIndex = weekdayMap[weekdayShort] ?? 0;
  return { ymd, ymdClean, dayOfWeekIndex };
}

function getBangkokCurrentTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

/**
 * The server's current instant, in the shape the rule modules expect.
 * Mirrors what index.js passes, so the tests exercise the same input.
 */
function currentBangkokFor(date) {
  const { ymd, ymdClean, dayOfWeekIndex } = getBangkokYmd(date);
  return { ymd, ymdClean, dayOfWeekIndex, hhmm: getBangkokCurrentTime(date) };
}

/**
 * Authoritative Order Creation — the transaction plumbing only.
 *
 * The business rules are imported from the modules the Cloud Function itself
 * uses; what remains here is the in-memory Firestore double and the ordering of
 * reads and writes, which is what these scenarios are actually about.
 */
async function executeOrderCreation(dbEngine, request, customNow = new Date()) {
  const { storeId, userId, customerName, customerPhone, items } = request;

  // Authentication is the one check this harness still owns: it belongs to the
  // callable wrapper, not to the rules.
  if (!userId || userId === 'guest_user') {
    throw new Error('AUTHENTICATION_REQUIRED: กรุณาเข้าสู่ระบบก่อนทำการสั่งจองอาหาร');
  }

  // Everything below is the REAL rule, not a restatement of it.
  //
  // This file used to re-implement the whole transaction — 1,258 lines of
  // hand-written copy — and its 24 passing scenarios said nothing whatsoever
  // about functions/index.js. A copy drifts the moment the original changes,
  // and a green suite over a drifted copy is worse than no suite: it reports
  // that the shipped behaviour is correct without ever having run it.
  const validated = validateOrderRequest(request, currentBangkokFor(customNow));
  if (!validated.ok) throw new Error(validated.message);

  const {
    cleanPickupTime,
    targetYmd,
    targetYmdClean,
    productTotalQuantityMap,
    totalOrderItemsCount,
  } = validated;

  const [pYear, pMonth, pDay] = targetYmd.split('-').map(Number);
  const targetPickupDateObj = new Date(Date.UTC(pYear, pMonth - 1, pDay, 12, 0, 0));
  const targetBangkok = getBangkokYmd(targetPickupDateObj);

  return await dbEngine.runTransaction(async (tx) => {
    // PHASE 1: READ ALL
    const shopSnap = await tx.get({ path: `shops/${storeId}` });
    if (!shopSnap.exists) {
      throw new Error(`STORE_NOT_FOUND: ร้านค้ารหัส ${storeId} ไม่มีอยู่ในระบบ`);
    }
    const shopData = shopSnap.data();

    const productSnapMap = new Map();
    const referencedModifierGroupIds = new Set();
    for (const prodId of productTotalQuantityMap.keys()) {
      const prodSnap = await tx.get({ path: `products/${prodId}` });
      if (!prodSnap.exists) {
        throw new Error(`PRODUCT_NOT_FOUND: ไม่พบสินค้ารหัส ${prodId} ในระบบ`);
      }
      productSnapMap.set(prodId, prodSnap);
      const pData = prodSnap.data();
      if (Array.isArray(pData.modifierGroupIds)) {
        pData.modifierGroupIds.forEach((mgId) => referencedModifierGroupIds.add(mgId));
      }
    }

    for (const it of items) {
      if (Array.isArray(it.selectedModifiers)) {
        it.selectedModifiers.forEach((m) => {
          if (m.modifierGroupId) referencedModifierGroupIds.add(m.modifierGroupId);
        });
      }
    }

    const modifierGroupSnapMap = new Map();
    for (const mgId of referencedModifierGroupIds) {
      const modSnap = await tx.get({ path: `modifier_groups/${mgId}` });
      if (modSnap.exists) {
        modifierGroupSnapMap.set(mgId, modSnap);
      }
    }

    const cleanTime = cleanPickupTime.replace(':', '');
    const dateScopedSlotId = `slot_${storeId}_${targetYmdClean}_${cleanTime}`;
    const slotSnap = await tx.get({ path: `store_slots/${dateScopedSlotId}` });

    const counterDocId = `counter_${storeId}_${targetYmdClean}`;
    const counterSnap = await tx.get({ path: `queue_counters/${counterDocId}` });

    // PHASE 2: VALIDATE BUSINESS INVARIANTS
    const availability = checkStoreAvailability(shopData, targetBangkok, targetYmd, cleanPickupTime);
    if (!availability.ok) throw new Error(availability.message);

    const productDataMap = new Map(
      Array.from(productSnapMap.entries()).map(([id, snap]) => [id, snap.data()])
    );
    const modifierGroupDataMap = new Map(
      Array.from(modifierGroupSnapMap.entries())
        .filter(([, snap]) => snap && snap.exists)
        .map(([id, snap]) => [id, snap.data()])
    );

    const availabilityCheck = checkProductAvailability(productTotalQuantityMap, productDataMap, storeId);
    if (!availabilityCheck.ok) throw new Error(availabilityCheck.message);

    const priced = priceOrder(items, productDataMap, modifierGroupDataMap, storeId);
    if (!priced.ok) throw new Error(priced.message);
    const { calculatedTotalSatang, validatedOrderItems } = priced;

    const capacity = checkSlotCapacity(
      shopData,
      slotSnap.exists ? slotSnap.data() : null,
      targetYmd,
      cleanPickupTime
    );
    if (!capacity.ok) throw new Error(capacity.message);
    const authoritativeCapacity = capacity.capacity;
    const currentSlotOrders = capacity.currentSlotOrders;

    const { sequenceNumber, queueNumber } = nextQueueNumber(
      counterSnap.exists ? counterSnap.data() : null
    );

    // PHASE 3: WRITE ALL
    for (const [prodId, requiredQty] of productTotalQuantityMap.entries()) {
      const prodData = productSnapMap.get(prodId).data();
      const currentStock = typeof prodData.stock === 'number' ? prodData.stock : 0;
      tx.update({ path: `products/${prodId}` }, {
        stock: currentStock - requiredQty,
        updatedAt: new Date().toISOString()
      });
    }

    tx.set(
      { path: `store_slots/${dateScopedSlotId}` },
      {
        slotId: dateScopedSlotId,
        storeId,
        date: targetYmd,
        timeSlot: cleanPickupTime,
        capacity: authoritativeCapacity,
        currentOrders: currentSlotOrders + 1,
        totalItemsReserved: (slotSnap.exists ? Number(slotSnap.data().totalItemsReserved || 0) : 0) + totalOrderItemsCount,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    tx.set(
      { path: `queue_counters/${counterDocId}` },
      {
        storeId,
        date: targetYmd,
        lastSequence: sequenceNumber,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    const orderId = `ord_${Math.random().toString(36).substring(2, 9)}`;
    const orderPayload = {
      id: orderId,
      orderId,
      storeId,
      userId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      queueNumber,
      status: 'PENDING',
      queueStatus: 'waiting',
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    tx.set({ path: `orders/${orderId}` }, orderPayload);

    return {
      success: true,
      orderId,
      queueNumber,
      totalAmountSatang: calculatedTotalSatang,
      totalAmountBaht: calculatedTotalSatang / 100,
      orderStatus: 'PENDING',
      order: orderPayload
    };
  });
}

function setupStoreFixtures(db, storeId = 'store_test_01') {
  db.setDoc(`shops/${storeId}`, {
    storeId,
    name: `ร้านทดสอบ ${storeId}`,
    isOpen: true,
    status: 'open',
    operationalOverride: 'NORMAL',
    maxOrdersPerSlot: 5,
    operatingHours: {
      friday: { isOpen: true, open: '08:00', close: '22:00' },
      saturday: { isOpen: true, open: '08:00', close: '22:00' },
      sunday: { isOpen: false, open: '08:00', close: '22:00' },
      monday: { isOpen: true, open: '08:00', close: '22:00' }
    }
  });

  db.setDoc(`modifier_groups/mg_noodle_type_${storeId}`, {
    id: `mg_noodle_type_${storeId}`,
    storeId,
    name: 'เส้นก๋วยเตี๋ยว',
    required: true,
    selectionType: 'single',
    minSelections: 1,
    maxSelections: 1,
    options: [
      { id: 'opt_sen_lek', name: 'เส้นเล็ก', priceModifierSatang: 0, isOutOfStock: false },
      { id: 'opt_sen_yai', name: 'เส้นใหญ่', priceModifierSatang: 0, isOutOfStock: false },
      { id: 'opt_mama', name: 'เส้นมาม่า', priceModifierSatang: 1000, isOutOfStock: false },
      { id: 'opt_woonsen', name: 'วุ้นเส้น (หมด)', priceModifierSatang: 500, isOutOfStock: true },
    ]
  });

  db.setDoc(`modifier_groups/mg_spicy_level_${storeId}`, {
    id: `mg_spicy_level_${storeId}`,
    storeId,
    name: 'ระดับความเผ็ด',
    required: true,
    selectionType: 'single',
    minSelections: 1,
    maxSelections: 1,
    options: [
      { id: 'opt_spicy_0', name: 'ไม่เผ็ด', priceModifierSatang: 0, isOutOfStock: false },
      { id: 'opt_spicy_1', name: 'เผ็ดน้อย', priceModifierSatang: 0, isOutOfStock: false },
      { id: 'opt_spicy_2', name: 'เผ็ดกลาง', priceModifierSatang: 0, isOutOfStock: false },
    ]
  });

  db.setDoc(`modifier_groups/mg_extra_toppings_${storeId}`, {
    id: `mg_extra_toppings_${storeId}`,
    storeId,
    name: 'ท็อปปิ้งเพิ่มเติม',
    required: false,
    selectionType: 'multiple',
    minSelections: 0,
    maxSelections: 2,
    options: [
      { id: 'opt_pork_ball', name: 'ลูกชิ้นหมูเพิ่ม', priceModifierSatang: 1500, isOutOfStock: false },
      { id: 'opt_crispy_wonton', name: 'เกี๊ยวกรอบ', priceModifierSatang: 1000, isOutOfStock: false },
      { id: 'opt_boiled_egg', name: 'ไข่ต้มยางมะตูม', priceModifierSatang: 1000, isOutOfStock: false },
    ]
  });

  db.setDoc(`products/prod_noodle_${storeId}`, {
    id: `prod_noodle_${storeId}`,
    storeId,
    name: 'ก๋วยเตี๋ยวเรือน้ำตกหมูตุ๋น',
    priceSatang: 5500,
    price: 55,
    stock: 20,
    isAvailable: true,
    modifierGroupIds: [`mg_noodle_type_${storeId}`, `mg_spicy_level_${storeId}`, `mg_extra_toppings_${storeId}`]
  });

  db.setDoc(`products/prod_crispy_pork_${storeId}`, {
    id: `prod_crispy_pork_${storeId}`,
    storeId,
    name: 'กากหมูเจียวกรอบโบราณ',
    priceSatang: 2500,
    price: 25,
    stock: 5,
    isAvailable: true,
    modifierGroupIds: []
  });
}

async function main() {
  // =========================================================================
  // Section A: Pure Zero-Payment & Queue Number Invariants
  // =========================================================================
  await runTest('A.1: Order Creation produces instant Q001 in PENDING state with Zero-Payment fields', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    const result = await executeOrderCreation(db, {
      storeId: 'store_test_01',
      userId: 'user_cust_01',
      customerName: 'สมชาย นักชิม',
      customerPhone: '0812345678',
      pickupTime: '18:00',
      pickupDate: '2026-09-04',
      items: [
        {
          productId: 'prod_noodle_store_test_01',
          quantity: 1,
          selectedModifiers: [
            { modifierGroupId: 'mg_noodle_type_store_test_01', optionId: 'opt_sen_lek' },
            { modifierGroupId: 'mg_spicy_level_store_test_01', optionId: 'opt_spicy_2' }
          ]
        }
      ]
    }, new Date('2026-09-04T10:00:00+07:00'));

    assert.equal(result.success, true);
    assert.equal(result.queueNumber, 'Q001');
    assert.equal(result.orderStatus, 'PENDING');
    assert.equal(result.totalAmountSatang, 5500);

    const savedOrder = db.getDoc(`orders/${result.orderId}`);
    assert.ok(savedOrder);
    assert.equal(savedOrder.queueNumber, 'Q001');
    assert.equal(savedOrder.status, 'PENDING');
    assert.equal(savedOrder.queueStatus, 'waiting');

    // Strict Zero-Payment Invariant: No payment fields!
    assert.equal(savedOrder.paymentStatus, undefined, 'Order must not contain paymentStatus');
    assert.equal(savedOrder.paymentMethod, undefined, 'Order must not contain paymentMethod');
    assert.equal(savedOrder.paymentExpiredAt, undefined, 'Order must not contain paymentExpiredAt');
    assert.equal(savedOrder.chargeId, undefined, 'Order must not contain chargeId');
  });

  await runTest('A.2: Sequential Queue Numbering increments Q001 -> Q002 -> Q003', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    const now = new Date('2026-09-04T10:00:00+07:00');
    const baseRequest = {
      storeId: 'store_test_01',
      userId: 'user_cust_01',
      customerName: 'สมชาย',
      customerPhone: '0812345678',
      pickupTime: '18:00',
      pickupDate: '2026-09-04',
      items: [{
        productId: 'prod_noodle_store_test_01',
        quantity: 1,
        selectedModifiers: [
          { modifierGroupId: 'mg_noodle_type_store_test_01', optionId: 'opt_sen_lek' },
          { modifierGroupId: 'mg_spicy_level_store_test_01', optionId: 'opt_spicy_1' }
        ]
      }]
    };

    const r1 = await executeOrderCreation(db, baseRequest, now);
    const r2 = await executeOrderCreation(db, { ...baseRequest, userId: 'user_cust_02' }, now);
    const r3 = await executeOrderCreation(db, { ...baseRequest, userId: 'user_cust_03' }, now);

    assert.equal(r1.queueNumber, 'Q001');
    assert.equal(r2.queueNumber, 'Q002');
    assert.equal(r3.queueNumber, 'Q003');
  });

  await runTest('A.3: Multi-Store Isolation: Store A and Store B both start with Q001 independently', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_A');
    setupStoreFixtures(db, 'store_B');

    const now = new Date('2026-09-04T10:00:00+07:00');
    const rA = await executeOrderCreation(db, {
      storeId: 'store_A',
      userId: 'user_1',
      customerName: 'ลูกค้า A',
      customerPhone: '0811111111',
      pickupTime: '18:00',
      pickupDate: '2026-09-04',
      items: [{
        productId: 'prod_crispy_pork_store_A',
        quantity: 1
      }]
    }, now);

    const rB = await executeOrderCreation(db, {
      storeId: 'store_B',
      userId: 'user_2',
      customerName: 'ลูกค้า B',
      customerPhone: '0822222222',
      pickupTime: '18:00',
      pickupDate: '2026-09-04',
      items: [{
        productId: 'prod_crispy_pork_store_B',
        quantity: 1
      }]
    }, now);

    assert.equal(rA.queueNumber, 'Q001');
    assert.equal(rB.queueNumber, 'Q001');
  });

  // =========================================================================
  // Section B: Real Calendar & Date Integrity
  // =========================================================================
  await runTest('B.1: Rejects fake calendar dates (2026-02-31, 2026-99-99, 2026-13-45)', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    const invalidDates = ['2026-02-31', '2026-99-99', '2026-13-45', '2026-04-31', '2026-06-31'];
    for (const d of invalidDates) {
      await assert.rejects(
        async () => {
          await executeOrderCreation(db, {
            storeId: 'store_test_01',
            userId: 'user_cust_01',
            customerName: 'สมชาย',
            customerPhone: '0812345678',
            pickupTime: '18:00',
            pickupDate: d,
            items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
          }, new Date('2026-01-01T10:00:00+07:00'));
        },
        /INVALID_CALENDAR_DATE|INVALID_DATE_FORMAT/
      );
    }
  });

  await runTest('B.2: Accepts valid calendar dates (including leap year 2028-02-29)', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    const result = await executeOrderCreation(db, {
      storeId: 'store_test_01',
      userId: 'user_cust_01',
      customerName: 'สมชาย',
      customerPhone: '0812345678',
      pickupTime: '18:00',
      pickupDate: '2028-02-29',
      items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
    }, new Date('2026-01-01T10:00:00+07:00'));

    assert.equal(result.success, true);
    assert.equal(result.queueNumber, 'Q001');
  });

  await runTest('B.3: Rejects past dates compared to Bangkok today', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '18:00',
          pickupDate: '2026-09-03',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, new Date('2026-09-04T10:00:00+07:00'));
      },
      /PAST_DATE_NOT_ALLOWED/
    );
  });

  // =========================================================================
  // Section C: Same-Day Past Pickup Time Validation
  // =========================================================================
  await runTest('C.1: Same-Day pickup time already passed (now: 14:00, pickup: 12:15) is rejected', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    const now = new Date('2026-09-04T14:00:00+07:00');
    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '12:15',
          pickupDate: '2026-09-04',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, now);
      },
      /PAST_PICKUP_TIME_NOT_ALLOWED/
    );
  });

  await runTest('C.2: Same-Day future pickup time (now: 14:00, pickup: 14:30) is accepted', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    const now = new Date('2026-09-04T14:00:00+07:00');
    const result = await executeOrderCreation(db, {
      storeId: 'store_test_01',
      userId: 'user_cust_01',
      customerName: 'สมชาย',
      customerPhone: '0812345678',
      pickupTime: '14:30',
      pickupDate: '2026-09-04',
      items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
    }, now);

    assert.equal(result.success, true);
  });

  await runTest('C.3: Future date allows pickup time even if earlier than current time of day', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    // Current time 14:00 on Friday 2026-09-04, booking for 09:00 on Saturday 2026-09-05
    const now = new Date('2026-09-04T14:00:00+07:00');
    const result = await executeOrderCreation(db, {
      storeId: 'store_test_01',
      userId: 'user_cust_01',
      customerName: 'สมชาย',
      customerPhone: '0812345678',
      pickupTime: '09:00',
      pickupDate: '2026-09-05',
      items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
    }, now);

    assert.equal(result.success, true);
  });

  // =========================================================================
  // Section D: Modifier Bounds, Duplicates & Single Choice
  // =========================================================================
  await runTest('D.1: Missing required modifier group throws REQUIRED_MODIFIER_MISSING', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{
            productId: 'prod_noodle_store_test_01',
            quantity: 1,
            selectedModifiers: [
              // Missing mg_spicy_level
              { modifierGroupId: 'mg_noodle_type_store_test_01', optionId: 'opt_sen_lek' }
            ]
          }]
        }, new Date('2026-09-04T10:00:00+07:00'));
      },
      /REQUIRED_MODIFIER_MISSING/
    );
  });

  await runTest('D.2: Single-choice group with multiple options throws SINGLE_SELECTION_VIOLATED', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{
            productId: 'prod_noodle_store_test_01',
            quantity: 1,
            selectedModifiers: [
              { modifierGroupId: 'mg_noodle_type_store_test_01', optionId: 'opt_sen_lek' },
              { modifierGroupId: 'mg_noodle_type_store_test_01', optionId: 'opt_sen_yai' }, // 2 noodle choices!
              { modifierGroupId: 'mg_spicy_level_store_test_01', optionId: 'opt_spicy_1' }
            ]
          }]
        }, new Date('2026-09-04T10:00:00+07:00'));
      },
      /MAX_SELECTIONS_EXCEEDED|SINGLE_SELECTION_VIOLATED/
    );
  });

  await runTest('D.3: Duplicate modifier option in group throws DUPLICATE_MODIFIER_OPTION', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{
            productId: 'prod_noodle_store_test_01',
            quantity: 1,
            selectedModifiers: [
              { modifierGroupId: 'mg_noodle_type_store_test_01', optionId: 'opt_sen_lek' },
              { modifierGroupId: 'mg_spicy_level_store_test_01', optionId: 'opt_spicy_1' },
              // Duplicate topping:
              { modifierGroupId: 'mg_extra_toppings_store_test_01', optionId: 'opt_pork_ball' },
              { modifierGroupId: 'mg_extra_toppings_store_test_01', optionId: 'opt_pork_ball' }
            ]
          }]
        }, new Date('2026-09-04T10:00:00+07:00'));
      },
      /DUPLICATE_MODIFIER_OPTION/
    );
  });

  await runTest('D.4: Modifier option out of stock throws OPTION_OUT_OF_STOCK', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{
            productId: 'prod_noodle_store_test_01',
            quantity: 1,
            selectedModifiers: [
              { modifierGroupId: 'mg_noodle_type_store_test_01', optionId: 'opt_woonsen' }, // Out of stock
              { modifierGroupId: 'mg_spicy_level_store_test_01', optionId: 'opt_spicy_1' }
            ]
          }]
        }, new Date('2026-09-04T10:00:00+07:00'));
      },
      /OPTION_OUT_OF_STOCK/
    );
  });

  await runTest('D.5: Correct price calculation with base price + modifiers in Satang', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    const result = await executeOrderCreation(db, {
      storeId: 'store_test_01',
      userId: 'user_cust_01',
      customerName: 'สมชาย',
      customerPhone: '0812345678',
      pickupTime: '18:00',
      pickupDate: '2026-09-04',
      items: [{
        productId: 'prod_noodle_store_test_01',
        quantity: 2,
        selectedModifiers: [
          { modifierGroupId: 'mg_noodle_type_store_test_01', optionId: 'opt_mama' }, // +10.00 THB (1000 Satang)
          { modifierGroupId: 'mg_spicy_level_store_test_01', optionId: 'opt_spicy_2' }, // +0 THB
          { modifierGroupId: 'mg_extra_toppings_store_test_01', optionId: 'opt_pork_ball' }, // +15.00 THB (1500 Satang)
          { modifierGroupId: 'mg_extra_toppings_store_test_01', optionId: 'opt_crispy_wonton' } // +10.00 THB (1000 Satang)
        ]
      }]
    }, new Date('2026-09-04T10:00:00+07:00'));

    // Base: 5500 Satang + Modifiers: (1000 + 1500 + 1000 = 3500) = 9000 Satang per bowl
    // 2 bowls = 18000 Satang (180.00 THB)
    assert.equal(result.totalAmountSatang, 18000);
    assert.equal(result.totalAmountBaht, 180);
  });

  // =========================================================================
  // Section E: Fail-Closed Store Capacity & Overbooking Guard
  // =========================================================================
  await runTest('E.1: Missing maxOrdersPerSlot throws STORE_CAPACITY_NOT_CONFIGURED', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');
    db.setDoc('shops/store_test_01', {
      storeId: 'store_test_01',
      name: 'ร้านค้าไม่มี Capacity',
      isOpen: true,
      status: 'open',
      maxOrdersPerSlot: undefined // Missing!
    });

    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, new Date('2026-09-04T10:00:00+07:00'));
      },
      /STORE_CAPACITY_NOT_CONFIGURED/
    );
  });

  await runTest('E.2: Slot capacity full throws SLOT_CAPACITY_EXCEEDED', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01'); // maxOrdersPerSlot = 5

    const now = new Date('2026-09-04T10:00:00+07:00');
    // Pre-fill slot with 5 orders
    db.setDoc('store_slots/slot_store_test_01_20260904_1800', {
      slotId: 'slot_store_test_01_20260904_1800',
      storeId: 'store_test_01',
      currentOrders: 5,
      capacity: 5
    });

    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, now);
      },
      /SLOT_CAPACITY_EXCEEDED/
    );
  });

  await runTest('E.3: High Concurrency Slot Overbooking Race: 10 concurrent orders for capacity 3 -> exactly 3 succeed, 7 fail', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');
    db.setDoc('shops/store_test_01', {
      storeId: 'store_test_01',
      name: 'ร้านค้า',
      isOpen: true,
      status: 'open',
      maxOrdersPerSlot: 3
    });

    const now = new Date('2026-09-04T10:00:00+07:00');
    const promises = [];
    for (let i = 1; i <= 10; i++) {
      promises.push(
        executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: `user_concurrent_${i}`,
          customerName: `ลูกค้า ${i}`,
          customerPhone: `081000000${i}`,
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, now).catch((err) => ({ error: err.message }))
      );
    }

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r && r.success);
    const failures = results.filter((r) => r && r.error);

    assert.equal(successes.length, 3, 'Exactly 3 orders must succeed');
    assert.equal(failures.length, 7, 'Exactly 7 orders must fail');

    const slotDoc = db.getDoc('store_slots/slot_store_test_01_20260904_1800');
    assert.equal(slotDoc.currentOrders, 3, 'Slot currentOrders must be exactly 3');
  });

  // =========================================================================
  // Section F: Stock Integrity & Atomic 100% Rollback
  // =========================================================================
  await runTest('F.1: Insufficient stock rejects order and performs zero write rollback', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01'); // prod_crispy_pork has stock 5

    const now = new Date('2026-09-04T10:00:00+07:00');
    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 6 }] // needs 6, stock is 5
        }, now);
      },
      /INSUFFICIENT_STOCK/
    );

    const productDoc = db.getDoc('products/prod_crispy_pork_store_test_01');
    assert.equal(productDoc.stock, 5, 'Stock must remain intact at 5');

    const counterDoc = db.getDoc('queue_counters/counter_store_test_01_20260904');
    assert.equal(counterDoc, null, 'Counter doc must not be created or bumped');
  });

  await runTest('F.2: High Concurrency Stock Race: Stock 5 with 12 concurrent requests -> exactly 5 succeed, stock = 0, no negative stock', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01'); // prod_crispy_pork stock = 5, capacity = 10
    db.setDoc('shops/store_test_01', {
      storeId: 'store_test_01',
      name: 'ร้านค้า',
      isOpen: true,
      status: 'open',
      maxOrdersPerSlot: 10
    });

    const now = new Date('2026-09-04T10:00:00+07:00');
    const promises = [];
    for (let i = 1; i <= 12; i++) {
      promises.push(
        executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: `user_stock_${i}`,
          customerName: `ลูกค้า ${i}`,
          customerPhone: `081000000${i}`,
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, now).catch((err) => ({ error: err.message }))
      );
    }

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r && r.success);
    const failures = results.filter((r) => r && r.error);

    assert.equal(successes.length, 5, 'Exactly 5 orders must succeed');
    assert.equal(failures.length, 7, 'Exactly 7 orders must fail');

    const productDoc = db.getDoc('products/prod_crispy_pork_store_test_01');
    assert.equal(productDoc.stock, 0, 'Stock must be exactly 0, never negative');
  });

  // =========================================================================
  // Section G: Store Operational Availability & Schedule
  // =========================================================================
  await runTest('G.1: Store closed on Sunday is rejected when booking for Sunday', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01'); // Sunday is closed

    // 2026-09-06 is Sunday
    const now = new Date('2026-09-04T10:00:00+07:00');
    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '12:00',
          pickupDate: '2026-09-06',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, now);
      },
      /STORE_CLOSED_ON_DATE/
    );
  });

  await runTest('G.2: Pickup time outside store operating hours is rejected', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01'); // open 08:00 - 22:00

    const now = new Date('2026-09-04T10:00:00+07:00');
    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '23:30', // Out of operating hours
          pickupDate: '2026-09-04',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, now);
      },
      /INVALID_PICKUP_TIME/
    );
  });

  await runTest('G.3: Store EMERGENCY_STOP overrides open status and rejects order', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');
    db.setDoc('shops/store_test_01', {
      storeId: 'store_test_01',
      name: 'ร้านค้า',
      isOpen: true,
      operationalOverride: 'EMERGENCY_STOP',
      maxOrdersPerSlot: 5
    });

    const now = new Date('2026-09-04T10:00:00+07:00');
    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '0812345678',
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, now);
      },
      /STORE_PAUSED/
    );
  });

  // =========================================================================
  // Section H: Authentication & Identity
  // =========================================================================
  await runTest('H.1: Unauthenticated user or guest_user throws AUTHENTICATION_REQUIRED', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    const now = new Date('2026-09-04T10:00:00+07:00');
    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'guest_user',
          customerName: 'ผู้เยี่ยมชม',
          customerPhone: '0812345678',
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, now);
      },
      /AUTHENTICATION_REQUIRED/
    );
  });

  await runTest('H.2: Missing customerPhone throws CUSTOMER_PHONE_REQUIRED', async () => {
    const db = new AdvancedFirestoreEngine();
    setupStoreFixtures(db, 'store_test_01');

    const now = new Date('2026-09-04T10:00:00+07:00');
    await assert.rejects(
      async () => {
        await executeOrderCreation(db, {
          storeId: 'store_test_01',
          userId: 'user_cust_01',
          customerName: 'สมชาย',
          customerPhone: '', // Missing!
          pickupTime: '18:00',
          pickupDate: '2026-09-04',
          items: [{ productId: 'prod_crispy_pork_store_test_01', quantity: 1 }]
        }, now);
      },
      /CUSTOMER_PHONE_REQUIRED/
    );
  });

  console.log(`\n📊 Test Execution Summary: ${passedTests}/${totalTests} scenarios passed (${Math.round((passedTests / totalTests) * 100)}%).`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal Test Matrix Failure:', err);
  process.exit(1);
});
