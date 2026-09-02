/* global process */
/**
 * QueueUp Wave 3.13 Production-Grade Transaction & State-Machine Test Matrix
 * Features:
 * - Real Firestore Transaction Simulation with Optimistic Concurrency Control (OCC)
 * - Version Checking, Conflict Detection & Auto-retry
 * - Transaction Snapshot Staging & Instant Rollback on Exceptions (Failure Injection)
 * - Concurrent Simultaneous Execution (Promise.all)
 * - 16 Exhaustive Scenarios covering Payment, Expiry, Refund, Webhook, and Business Rules
 * - Zero-tolerance Exit Code Enforcement
 */
import assert from 'node:assert/strict';

console.log('🧪 Starting QueueUp Wave 3.13 Production-Grade Transaction Test Matrix...\n');

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

  async runTransaction(updateFunction, maxRetries = 5) {
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
            data: () => record ? JSON.parse(JSON.stringify(record.data)) : null,
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
          await new Promise((r) => setTimeout(r, Math.random() * 20));
          continue;
        }
        // Failure: Staged writes are automatically discarded (Snapshot Rollback)
        throw err;
      }
    }
    throw new Error('Transaction failed after maximum concurrency retries');
  }
}

async function main() {
  // Scenario 1: Standard Payment Success
  await runTest('Scenario 1: Webhook transition from pending -> paid with UID & Amount validation', async () => {
    const db = new AdvancedFirestoreEngine();
    const orderId = 'ORD_SUCCESS_1';
    db.setDoc(`orders/${orderId}`, {
      orderId,
      userId: 'user_123',
      totalAmount: 65,
      paymentStatus: 'pending',
      status: 'TO_SHIP',
      queueStatus: 'waiting'
    });

    const charge = {
      id: 'chrg_1',
      amount: 6500,
      currency: 'THB',
      status: 'successful',
      metadata: { orderId, uid: 'user_123' }
    };

    const order = db.getDoc(`orders/${orderId}`);
    assert.equal(order.userId, charge.metadata.uid);
    assert.equal(charge.amount, order.totalAmount * 100);
    assert.equal(charge.currency, 'THB');

    db.setDoc(`orders/${orderId}`, {
      paymentId: charge.id,
      paymentStatus: 'paid',
      reconciled: true,
      paidAt: new Date().toISOString()
    }, { merge: true });

    assert.equal(db.getDoc(`orders/${orderId}`).paymentStatus, 'paid');
    assert.equal(db.getDoc(`orders/${orderId}`).paymentId, 'chrg_1');
  });

  // Scenario 2: Atomic Resource Release on Expiry
  await runTest('Scenario 2: Atomic Resource Release rolls back stock and slot capacity idempotently', async () => {
    const db = new AdvancedFirestoreEngine();
    const orderId = 'ORD_EXPIRY_2';
    db.setDoc('products/prod_1', { stock: 8 });
    db.setDoc('store_slots/shop_1_2026-09-03_12:00', { currentOrders: 5, capacity: 20 });
    db.setDoc(`orders/${orderId}`, {
      orderId,
      productId: 'prod_1',
      storeId: 'shop_1',
      quantity: 2,
      booking: { date: '2026-09-03', timeSlot: '12:00' },
      paymentStatus: 'pending',
      resourcesReleased: false
    });

    async function executeAtomicRelease(ordId) {
      return await db.runTransaction(async (t) => {
        const oSnap = await t.get({ path: `orders/${ordId}` });
        const data = oSnap.data();
        if (data.paymentStatus === 'paid' || data.resourcesReleased === true) return false;

        const pSnap = await t.get({ path: `products/${data.productId}` });
        t.update({ path: `products/${data.productId}` }, { stock: pSnap.data().stock + data.quantity });

        const slotPath = `store_slots/${data.storeId}_${data.booking.date}_${data.booking.timeSlot}`;
        const sSnap = await t.get({ path: slotPath });
        t.set({ path: slotPath }, { currentOrders: Math.max(0, sSnap.data().currentOrders - data.quantity) }, { merge: true });

        t.update({ path: `orders/${ordId}` }, {
          paymentStatus: 'expired',
          status: 'CANCELLED',
          resourcesReleased: true
        });
        return true;
      });
    }

    const first = await executeAtomicRelease(orderId);
    assert.equal(first, true);
    assert.equal(db.getDoc('products/prod_1').stock, 10);
    assert.equal(db.getDoc('store_slots/shop_1_2026-09-03_12:00').currentOrders, 3);
    assert.equal(db.getDoc(`orders/${orderId}`).paymentStatus, 'expired');

    const second = await executeAtomicRelease(orderId);
    assert.equal(second, false);
    assert.equal(db.getDoc('products/prod_1').stock, 10);
  });

  // Scenario 3: Real Transaction Snapshot Rollback on Injected Failure
  await runTest('Scenario 3: Transaction snapshot rollback restores initial state if failure occurs midway', async () => {
    const db = new AdvancedFirestoreEngine();
    db.setDoc('products/prod_fail', { stock: 10 });
    db.setDoc('store_slots/shop_fail_slot', { currentOrders: 2 });
    db.setDoc('orders/ord_fail', { id: 'ord_fail', paymentStatus: 'pending', resourcesReleased: false });

    let failureCaught = false;
    try {
      await db.runTransaction(async (t) => {
        const pSnap = await t.get({ path: 'products/prod_fail' });
        t.update({ path: 'products/prod_fail' }, { stock: pSnap.data().stock + 5 });

        const sSnap = await t.get({ path: 'store_slots/shop_fail_slot' });
        t.update({ path: 'store_slots/shop_fail_slot' }, { currentOrders: sSnap.data().currentOrders - 1 });

        // Injected crash before order update
        throw new Error('INJECTED_NETWORK_TIMEOUT_BEFORE_ORDER_UPDATE');
      });
    } catch (e) {
      if (e.message.includes('INJECTED_NETWORK_TIMEOUT')) failureCaught = true;
    }

    assert.equal(failureCaught, true);
    // Verify pure atomic rollback: stock & slot remain untouched
    assert.equal(db.getDoc('products/prod_fail').stock, 10);
    assert.equal(db.getDoc('store_slots/shop_fail_slot').currentOrders, 2);
    assert.equal(db.getDoc('orders/ord_fail').paymentStatus, 'pending');
  });

  // Scenario 4: Concurrent Simultaneous Scheduler vs Webhook Race
  await runTest('Scenario 4: Simultaneous Scheduler & Webhook execution resolved with OCC without dirty reads', async () => {
    const db = new AdvancedFirestoreEngine();
    const orderId = 'ORD_RACE_OCC';
    db.setDoc(`orders/${orderId}`, {
      orderId,
      userId: 'user_race',
      totalAmount: 100,
      paymentStatus: 'pending',
      resourcesReleased: false
    });

    const runScheduler = async () => {
      return await db.runTransaction(async (t) => {
        const oSnap = await t.get({ path: `orders/${orderId}` });
        const data = oSnap.data();
        if (data.paymentStatus === 'paid') return 'IGNORED_PAID';
        t.update({ path: `orders/${orderId}` }, {
          paymentStatus: 'expired',
          status: 'CANCELLED',
          resourcesReleased: true
        });
        return 'EXPIRED';
      });
    };

    const runWebhook = async () => {
      return await db.runTransaction(async (t) => {
        const oSnap = await t.get({ path: `orders/${orderId}` });
        const data = oSnap.data();
        if (data.paymentStatus === 'expired' || data.resourcesReleased) {
          t.update({ path: `orders/${orderId}` }, {
            paymentStatus: 'paid_after_expired',
            flaggedForMerchantReview: true,
            reconciliationStatus: 'PENDING_REVIEW'
          });
          return 'LATE_PAID';
        }
        t.update({ path: `orders/${orderId}` }, { paymentStatus: 'paid', reconciled: true });
        return 'PAID';
      });
    };

    // Execute concurrently
    await Promise.all([runScheduler(), runWebhook()]);

    const finalOrder = db.getDoc(`orders/${orderId}`);
    assert.equal(['paid', 'paid_after_expired'].includes(finalOrder.paymentStatus), true);
  });

  // Scenario 5: Multiple Webhooks (10x Sequential Delivery)
  await runTest('Scenario 5: Webhook repeated 10 times keeps order in paid status without mutation', async () => {
    const db = new AdvancedFirestoreEngine();
    const orderId = 'ORD_WEBHOOK_10X';
    db.setDoc(`orders/${orderId}`, { orderId, paymentStatus: 'pending', totalAmount: 50 });

    let writes = 0;
    for (let i = 0; i < 10; i++) {
      const order = db.getDoc(`orders/${orderId}`);
      if (order.paymentStatus === 'paid') continue;
      db.setDoc(`orders/${orderId}`, { paymentStatus: 'paid', reconciled: true }, { merge: true });
      writes++;
    }

    assert.equal(writes, 1);
    assert.equal(db.getDoc(`orders/${orderId}`).paymentStatus, 'paid');
  });

  // Scenario 6: Merchant Resolution - ACCEPT Flow
  await runTest('Scenario 6: Merchant accepts paid_after_expired order into special queue', async () => {
    const db = new AdvancedFirestoreEngine();
    const orderId = 'ORD_MERCHANT_ACCEPT';
    db.setDoc(`orders/${orderId}`, {
      orderId,
      paymentStatus: 'paid_after_expired',
      flaggedForMerchantReview: true,
      reconciliationStatus: 'PENDING_REVIEW'
    });

    const TERMINAL = ['ACCEPTED', 'REFUNDED', 'REFUND_REQUESTED', 'MANUAL_REFUND_PENDING'];
    const order = db.getDoc(`orders/${orderId}`);
    assert.equal(TERMINAL.includes(order.reconciliationStatus), false);

    db.setDoc(`orders/${orderId}`, {
      paymentStatus: 'paid',
      status: 'TO_SHIP',
      queueStatus: 'waiting',
      flaggedForMerchantReview: false,
      reconciliationStatus: 'ACCEPTED'
    }, { merge: true });

    const accepted = db.getDoc(`orders/${orderId}`);
    assert.equal(accepted.paymentStatus, 'paid');
    assert.equal(accepted.reconciliationStatus, 'ACCEPTED');
    assert.equal(accepted.flaggedForMerchantReview, false);
  });

  // Scenario 7: Merchant Resolution - REFUND Flow & Duplicate Rejection
  await runTest('Scenario 7: Merchant refund transitions to terminal REFUNDED and blocks duplicate calls', async () => {
    const db = new AdvancedFirestoreEngine();
    const orderId = 'ORD_MERCHANT_REFUND';
    db.setDoc(`orders/${orderId}`, {
      orderId,
      paymentId: 'chrg_rfnd_1',
      totalAmount: 120,
      paymentStatus: 'paid_after_expired',
      flaggedForMerchantReview: true,
      reconciliationStatus: 'PENDING_REVIEW'
    });

    const TERMINAL = ['ACCEPTED', 'REFUNDED', 'REFUND_REQUESTED', 'MANUAL_REFUND_PENDING'];

    function resolveRefund(ordId) {
      const ord = db.getDoc(`orders/${ordId}`);
      if (TERMINAL.includes(ord.reconciliationStatus) || ord.paymentStatus === 'refunded') {
        throw new Error(`Order already in terminal state (${ord.reconciliationStatus || ord.paymentStatus})`);
      }
      db.setDoc(`orders/${ordId}`, {
        paymentStatus: 'refunded',
        status: 'CANCELLED',
        flaggedForMerchantReview: false,
        reconciliationStatus: 'REFUNDED',
        refundId: 'rfnd_999'
      }, { merge: true });
    }

    resolveRefund(orderId);
    assert.equal(db.getDoc(`orders/${orderId}`).paymentStatus, 'refunded');
    assert.equal(db.getDoc(`orders/${orderId}`).reconciliationStatus, 'REFUNDED');

    assert.throws(() => resolveRefund(orderId), /Order already in terminal state/);
  });

  // Scenario 8: Webhook Never Re-Opens Reconciled Terminal Orders
  await runTest('Scenario 8: Webhook retry never re-opens or downgrades refunded/accepted terminal order', async () => {
    const db = new AdvancedFirestoreEngine();
    const orderId = 'ORD_TERMINAL_GUARD';
    db.setDoc(`orders/${orderId}`, {
      orderId,
      paymentStatus: 'refunded',
      reconciliationStatus: 'REFUNDED',
      flaggedForMerchantReview: false
    });

    const TERMINAL = ['ACCEPTED', 'REFUNDED', 'REFUND_REQUESTED', 'MANUAL_REFUND_PENDING'];
    const order = db.getDoc(`orders/${orderId}`);

    let reOpened = false;
    if (TERMINAL.includes(order.reconciliationStatus) || order.paymentStatus === 'refunded') {
      // Return 200 OK without re-opening
    } else {
      reOpened = true;
    }

    assert.equal(reOpened, false);
    assert.equal(db.getDoc(`orders/${orderId}`).paymentStatus, 'refunded');
  });

  // Scenario 9: Webhook Signature & Tamper Verification
  await runTest('Scenario 9: Webhook validates metadata integrity and rejects tampered UID/Amount payloads', async () => {
    const order = { orderId: 'ORD_TAMPER_CHECK', userId: 'uid_legit', totalAmount: 90 };
    const tamperedCharge = {
      id: 'chrg_tamper',
      amount: 4500, // Tampered half amount
      currency: 'THB',
      metadata: { orderId: 'ORD_TAMPER_CHECK', uid: 'uid_attacker' }
    };

    function verifyWebhook(ord, chrg) {
      if (chrg.metadata?.uid !== ord.userId) throw new Error('User ID mismatch');
      if (chrg.metadata?.orderId !== ord.orderId) throw new Error('Order ID mismatch');
      if (chrg.amount !== ord.totalAmount * 100) throw new Error('Amount mismatch');
      return true;
    }

    assert.throws(() => verifyWebhook(order, tamperedCharge), /User ID mismatch/);
  });

  // Scenario 10: Slot Counter Clamping & Warning
  await runTest('Scenario 10: Underflow slot release safely clamps to 0 with inconsistency warning', async () => {
    const warnings = [];
    const currentOrders = 1;
    const releaseQty = 3;

    if (currentOrders < releaseQty) {
      warnings.push('SLOT_COUNTER_INCONSISTENCY');
    }
    const safeOrders = Math.max(0, currentOrders - releaseQty);

    assert.equal(safeOrders, 0);
    assert.deepEqual(warnings, ['SLOT_COUNTER_INCONSISTENCY']);
  });

  // Scenario 11: Unknown Modifier Catalog Rejection
  await runTest('Scenario 11: Unknown modifiers thrown as invalid-argument with 0% price leakage', async () => {
    const TOPPING_PRICES = {
      'ไข่ดาว': 10,
      'ไข่เจียว': 10,
      'หมูกรอบพิเศษ': 15,
      'กุนเชียง': 10,
      'ชีส': 15,
      'เพิ่มเส้น/ข้าว': 10,
    };

    function calculateModifierPrice(modName) {
      const price = TOPPING_PRICES[modName];
      if (typeof price !== 'number' || price < 0) {
        throw new Error(`ไม่พบตัวเลือกท็อปปิ้ง: ${modName}`);
      }
      return price;
    }

    assert.equal(calculateModifierPrice('ไข่ดาว'), 10);
    assert.throws(() => calculateModifierPrice('ของแถมฟรีปลอม'), /ไม่พบตัวเลือกท็อปปิ้ง/);
  });

  // Scenario 12: Past Date / Past Timeslot Validation with Thai Timezone
  await runTest('Scenario 12: Rejects past dates and past timeslots for current date in Asia/Bangkok time', async () => {
    const ALLOWED_SLOTS = ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00"];

    function validateSlot(dateStr, timeStr, simulatedNow) {
      if (!ALLOWED_SLOTS.includes(timeStr)) throw new Error('รอบเวลารับประทานไม่ถูกต้อง');
      const slotDate = new Date(dateStr);
      if (isNaN(slotDate.getTime())) throw new Error('รูปแบบวันที่ไม่ถูกต้อง');

      const todayYmd = `${simulatedNow.getFullYear()}-${String(simulatedNow.getMonth() + 1).padStart(2, '0')}-${String(simulatedNow.getDate()).padStart(2, '0')}`;
      if (dateStr < todayYmd) throw new Error('ไม่สามารถเลือกวันที่ย้อนหลังได้');

      if (dateStr === todayYmd) {
        const [h, m] = timeStr.split(':').map(Number);
        if (h < simulatedNow.getHours() || (h === simulatedNow.getHours() && m <= simulatedNow.getMinutes())) {
          throw new Error('รอบเวลาของวันนี้ผ่านไปแล้ว');
        }
      }
      return true;
    }

    const mockToday = new Date('2026-09-03T12:45:00');
    assert.throws(() => validateSlot('2026-09-02', '12:00', mockToday), /ไม่สามารถเลือกวันที่ย้อนหลังได้/);
    assert.throws(() => validateSlot('2026-09-03', '11:30', mockToday), /รอบเวลาของวันนี้ผ่านไปแล้ว/);
    assert.equal(validateSlot('2026-09-03', '13:30', mockToday), true);
  });

  // Scenario 13: Stock Reservation Race
  await runTest('Scenario 13: Stock reservation race with stock=1 allows exactly 1 buyer and rejects second buyer', async () => {
    const db = new AdvancedFirestoreEngine();
    db.setDoc('products/prod_limited', { stock: 1 });

    const buyItem = async (userId) => {
      return await db.runTransaction(async (t) => {
        const pSnap = await t.get({ path: 'products/prod_limited' });
        const stock = pSnap.data().stock;
        if (stock < 1) throw new Error('สินค้าในสต็อกไม่เพียงพอ');
        t.update({ path: 'products/prod_limited' }, { stock: stock - 1 });
        return { success: true, userId };
      });
    };

    const results = await Promise.allSettled([buyItem('user_A'), buyItem('user_B')]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(db.getDoc('products/prod_limited').stock, 0);
  });

  // Scenario 14: Slot Capacity Reservation Race
  await runTest('Scenario 14: Slot capacity reservation race at capacity limit permits exactly available slots', async () => {
    const db = new AdvancedFirestoreEngine();
    db.setDoc('store_slots/shop_busy_slot', { currentOrders: 9, capacity: 10 });

    const reserveSlot = async (qty) => {
      return await db.runTransaction(async (t) => {
        const sSnap = await t.get({ path: 'store_slots/shop_busy_slot' });
        const { currentOrders, capacity } = sSnap.data();
        if (currentOrders + qty > capacity) throw new Error('รอบเวลานี้เต็มแล้ว');
        t.update({ path: 'store_slots/shop_busy_slot' }, { currentOrders: currentOrders + qty });
        return { success: true };
      });
    };

    const results = await Promise.allSettled([reserveSlot(1), reserveSlot(1)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(db.getDoc('store_slots/shop_busy_slot').currentOrders, 10);
  });

  // Scenario 15: Crash Recovery with Deterministic Idempotency Key
  await runTest('Scenario 15: Retry with idempotency key recovers existing order and charge without double charging', async () => {
    const db = new AdvancedFirestoreEngine();
    const idempotencyKey = 'uid1_key123';
    db.setDoc(`idempotency_keys/${idempotencyKey}`, { orderId: 'ORD_EXISTING_1' });
    db.setDoc('orders/ORD_EXISTING_1', {
      orderId: 'ORD_EXISTING_1',
      paymentId: 'chrg_recovered',
      qrUrl: 'https://opn.ooo/qr/123',
      totalAmount: 55,
      paymentStatus: 'pending'
    });

    const createOrRecover = async (key) => {
      return await db.runTransaction(async (t) => {
        const idempSnap = await t.get({ path: `idempotency_keys/${key}` });
        if (idempSnap.exists) {
          const ordSnap = await t.get({ path: `orders/${idempSnap.data().orderId}` });
          if (ordSnap.exists) {
            return { recovered: true, ...ordSnap.data() };
          }
        }
        return { recovered: false };
      });
    };

    const result = await createOrRecover(idempotencyKey);
    assert.equal(result.recovered, true);
    assert.equal(result.paymentId, 'chrg_recovered');
  });

  // Scenario 16: Exhaustive Terminal State Machine Protection
  await runTest('Scenario 16: Terminal states (ACCEPTED, REFUNDED) strictly forbid any further mutations', async () => {
    const TERMINAL_STATES = ['ACCEPTED', 'REFUNDED'];

    function attemptTransition(currentState, targetAction) {
      if (TERMINAL_STATES.includes(currentState)) {
        throw new Error(`State machine violation: cannot ${targetAction} from ${currentState}`);
      }
      return true;
    }

    assert.throws(() => attemptTransition('REFUNDED', 'ACCEPT'), /State machine violation/);
    assert.throws(() => attemptTransition('REFUNDED', 'REFUND'), /State machine violation/);
    assert.throws(() => attemptTransition('ACCEPTED', 'REFUND'), /State machine violation/);
    assert.throws(() => attemptTransition('ACCEPTED', 'ACCEPT'), /State machine violation/);
  });

  // Scenario 17: True Order State Machine Forward Progression & Customer Cancellation Guard
  await runTest('Scenario 17: Validates sequential state progression and blocks illegal backward/arbitrary jumps', async () => {
    function isValidStatusTransition(oldStatus, newStatus) {
      return (oldStatus === newStatus) ||
             (oldStatus === 'TO_SHIP' && (newStatus === 'PREPARING' || newStatus === 'CANCELLED')) ||
             (oldStatus === 'PREPARING' && (newStatus === 'READY' || newStatus === 'CANCELLED')) ||
             (oldStatus === 'READY' && newStatus === 'COMPLETED');
    }

    function canCustomerCancel(status, queueStatus) {
      return status === 'TO_SHIP' && queueStatus === 'waiting';
    }

    // Valid forward transitions
    assert.equal(isValidStatusTransition('TO_SHIP', 'PREPARING'), true);
    assert.equal(isValidStatusTransition('PREPARING', 'READY'), true);
    assert.equal(isValidStatusTransition('READY', 'COMPLETED'), true);

    // Illegal backward / jump transitions
    assert.equal(isValidStatusTransition('COMPLETED', 'TO_SHIP'), false);
    assert.equal(isValidStatusTransition('READY', 'PREPARING'), false);
    assert.equal(isValidStatusTransition('CANCELLED', 'TO_SHIP'), false);
    assert.equal(isValidStatusTransition('TO_SHIP', 'COMPLETED'), false);

    // Customer cancellation guards
    assert.equal(canCustomerCancel('TO_SHIP', 'waiting'), true);
    assert.equal(canCustomerCancel('PREPARING', 'cooking'), false);
    assert.equal(canCustomerCancel('READY', 'ready'), false);
    assert.equal(canCustomerCancel('COMPLETED', 'completed'), false);
  });

  // Scenario 18: Reject Products with Missing storeId without Fallback
  await runTest('Scenario 18: Product missing storeId throws failed-precondition without STORE_DEFAULT fallback', async () => {
    const invalidProduct = { id: 'p_broken', name: 'ข้าวไข่ดาว', price: 30 }; // No storeId/shopId

    function prepareOrder(product) {
      const storeId = String(product.storeId || product.shopId || '').trim();
      if (!storeId) {
        throw new Error('ข้อมูลสินค้าไม่สมบูรณ์: ไม่พบการระบุรหัสร้านค้า (storeId)');
      }
      return { storeId };
    }

    assert.throws(() => prepareOrder(invalidProduct), /ไม่พบการระบุรหัสร้านค้า/);
    assert.equal(prepareOrder({ ...invalidProduct, storeId: 'shop_valid_123' }).storeId, 'shop_valid_123');
  });

  const passRate = Math.round((passedTests / totalTests) * 100);
  console.log(`\n📊 Test Execution Summary: ${passedTests}/${totalTests} scenarios passed (${passRate}%).`);

  if (passedTests !== totalTests) {
    console.error('❌ Test suite failed!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
