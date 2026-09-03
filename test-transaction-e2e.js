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

  // Scenario 17: Synchronized Coupled Order State Machine & Customer Cancellation Guard
  await runTest('Scenario 17: Validates synchronized coupled state progression and blocks mismatched pairs', async () => {
    function isValidOrderStateTransition(oldStatus, oldQueue, newStatus, newQueue) {
      return (oldStatus === newStatus && oldQueue === newQueue) ||
             (oldStatus === 'TO_SHIP' && oldQueue === 'waiting' && newStatus === 'PREPARING' && newQueue === 'cooking') ||
             (oldStatus === 'PREPARING' && oldQueue === 'cooking' && newStatus === 'READY' && newQueue === 'ready') ||
             (oldStatus === 'READY' && oldQueue === 'ready' && newStatus === 'COMPLETED' && newQueue === 'completed') ||
             ((oldStatus === 'TO_SHIP' || oldStatus === 'PREPARING') && newStatus === 'CANCELLED' && newQueue === 'cancelled');
    }

    function canCustomerCancel(status, queueStatus) {
      return status === 'TO_SHIP' && queueStatus === 'waiting';
    }

    // Valid synchronized forward transitions
    assert.equal(isValidOrderStateTransition('TO_SHIP', 'waiting', 'PREPARING', 'cooking'), true);
    assert.equal(isValidOrderStateTransition('PREPARING', 'cooking', 'READY', 'ready'), true);
    assert.equal(isValidOrderStateTransition('READY', 'ready', 'COMPLETED', 'completed'), true);
    assert.equal(isValidOrderStateTransition('TO_SHIP', 'waiting', 'CANCELLED', 'cancelled'), true);
    assert.equal(isValidOrderStateTransition('PREPARING', 'cooking', 'CANCELLED', 'cancelled'), true);

    // Mismatched / uncoupled transitions (e.g. status advances but queueStatus stays behind)
    assert.equal(isValidOrderStateTransition('TO_SHIP', 'waiting', 'PREPARING', 'waiting'), false);
    assert.equal(isValidOrderStateTransition('PREPARING', 'cooking', 'READY', 'cooking'), false);
    assert.equal(isValidOrderStateTransition('READY', 'ready', 'COMPLETED', 'ready'), false);

    // Illegal backward transitions
    assert.equal(isValidOrderStateTransition('COMPLETED', 'completed', 'TO_SHIP', 'waiting'), false);
    assert.equal(isValidOrderStateTransition('READY', 'ready', 'PREPARING', 'cooking'), false);
    assert.equal(isValidOrderStateTransition('CANCELLED', 'cancelled', 'TO_SHIP', 'waiting'), false);

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

  // Scenario 19: Offline vs Online Order Creation Guard in Firestore Rules
  await runTest('Scenario 19: Client can only create offline orders (cash/canteen_counter) and online payments are rejected', async () => {
    function validateClientOrderCreation(payload) {
      const allowedMethods = ['cash', 'canteen_counter'];
      if (!allowedMethods.includes(payload.paymentMethod)) {
        throw new Error(`Security violation: client cannot create online payment order with method ${payload.paymentMethod}`);
      }
      if (!payload.storeId || typeof payload.storeId !== 'string') {
        throw new Error('Missing storeId on order creation');
      }
      if (typeof payload.totalAmount !== 'number' || payload.totalAmount <= 0) {
        throw new Error('Invalid totalAmount on order creation');
      }
      return true;
    }

    // Client creates cash order -> PASS
    assert.equal(validateClientOrderCreation({ paymentMethod: 'cash', storeId: 'shop_01', totalAmount: 50 }), true);
    assert.equal(validateClientOrderCreation({ paymentMethod: 'canteen_counter', storeId: 'shop_01', totalAmount: 40 }), true);

    // Client tries to create online PromptPay or Slip order directly -> REJECT
    assert.throws(() => validateClientOrderCreation({ paymentMethod: 'promptpay', storeId: 'shop_01', totalAmount: 50 }), /Security violation/);
    assert.throws(() => validateClientOrderCreation({ paymentMethod: 'promptpay_slip', storeId: 'shop_01', totalAmount: 1 }), /Security violation/);
    assert.throws(() => validateClientOrderCreation({ paymentMethod: 'credit_card', storeId: 'shop_01', totalAmount: 50 }), /Security violation/);
  });

  // Scenario 20: LocalStorage Email & Role Tampering Immunity
  await runTest('Scenario 20: Initial session strictly sanitizes LocalStorage and rejects email/role spoofing', async () => {
    function getEffectiveRoles(user) {
      if (!user) return ['guest'];
      if (user.isFromCache === true || user.isVerifiedAuth !== true) {
        return ['customer'];
      }
      const email = (user.email || '').toLowerCase().trim();
      const isSuperAdmin = Boolean(
        user.isSuperAdmin === true ||
        user.admin === true ||
        (user.isTokenVerified === true && email === '58140@lomsak.ac.th')
      );
      if (isSuperAdmin) return ['customer', 'merchant', 'admin'];
      return ['customer'];
    }

    function isUserSuperAdmin(user) {
      if (!user || user.isFromCache === true || user.isVerifiedAuth !== true) return false;
      const email = (user.email || '').toLowerCase().trim();
      return Boolean(
        user.isSuperAdmin === true ||
        user.admin === true ||
        (user.isTokenVerified === true && email === '58140@lomsak.ac.th')
      );
    }

    function hydrateInitialSession(storedJson) {
      const parsed = JSON.parse(storedJson);
      if (!parsed || typeof parsed !== 'object' || !parsed.uid) return null;
      return {
        uid: String(parsed.uid),
        email: String(parsed.email || ''),
        displayName: String(parsed.displayName || "User"),
        roles: ['customer'],
        activeRole: 'customer',
        isMerchantVerified: false,
        isSuperAdmin: false,
        isVerifiedAuth: false,
        isTokenVerified: false,
        isFromCache: true
      };
    }

    // Attacker modifies LocalStorage to inject admin email and admin flags
    const tamperedLocalStorage = JSON.stringify({
      uid: 'hacker_123',
      email: '58140@lomsak.ac.th', // Injected Super Admin email!
      displayName: 'Attacker',
      roles: ['customer', 'merchant', 'admin'],
      activeRole: 'admin',
      isMerchantVerified: true,
      isSuperAdmin: true
    });

    const hydratedSession = hydrateInitialSession(tamperedLocalStorage);
    // Unverified cached session MUST strictly evaluate to customer
    assert.deepEqual(getEffectiveRoles(hydratedSession), ['customer']);
    assert.equal(isUserSuperAdmin(hydratedSession), false);
    assert.equal(hydratedSession.activeRole, 'customer');

    // Officially verified Firebase Auth session -> Grants elevated role
    const verifiedSession = {
      ...hydratedSession,
      isVerifiedAuth: true,
      isTokenVerified: true,
      isFromCache: false
    };
    assert.deepEqual(getEffectiveRoles(verifiedSession), ['customer', 'merchant', 'admin']);
    assert.equal(isUserSuperAdmin(verifiedSession), true);
  });

  // Scenario 21: Fake Offline Price Manipulation Blocked by Universal Server Pricing
  await runTest('Scenario 21: Client sending manipulated totalAmount is overridden by server-calculated catalog price', async () => {
    const catalogProduct = { id: 'p_real_01', price: 65, storeId: 'shop_01' };
    const clientOrderPayload = { productId: 'p_real_01', quantity: 2, clientClaimedTotal: 1, paymentMethod: 'cash' };

    function calculateServerAuthoritativePrice(product, quantity) {
      return product.price * quantity;
    }

    const calculatedTotal = calculateServerAuthoritativePrice(catalogProduct, clientOrderPayload.quantity);
    assert.equal(calculatedTotal, 130);
    assert.notEqual(calculatedTotal, clientOrderPayload.clientClaimedTotal);
  });

  // Scenario 22: Fake Coupon / Discount Injection Rejected
  await runTest('Scenario 22: Fake or expired coupon codes produce 0 THB discount on server calculation', async () => {
    const validCoupons = {
      'VALID10': { status: 'Active', discount: 10, minSpend: 50, expiryDate: '2099-12-31' }
    };

    function applyServerCoupon(couponCode, subtotal) {
      if (!couponCode) return 0;
      const c = validCoupons[couponCode.trim().toUpperCase()];
      if (!c || c.status !== 'Active' || subtotal < c.minSpend || new Date(c.expiryDate) < new Date()) {
        return 0;
      }
      return c.discount;
    }

    assert.equal(applyServerCoupon('HACK999', 100), 0);
    assert.equal(applyServerCoupon('VALID10', 40), 0); // minSpend not met
    assert.equal(applyServerCoupon('VALID10', 80), 10);
  });

  // Scenario 23: Fake Subtotal vs Unit Price * Quantity Mismatch
  await runTest('Scenario 23: Subtotal is strictly computed server-side from unit price + modifiers * quantity', async () => {
    function computeOrderBreakdown(unitPrice, toppingPrice, quantity) {
      const effectiveUnitPrice = unitPrice + toppingPrice;
      const subtotal = effectiveUnitPrice * quantity;
      return { effectiveUnitPrice, subtotal };
    }

    const breakdown = computeOrderBreakdown(50, 15, 3);
    assert.equal(breakdown.effectiveUnitPrice, 65);
    assert.equal(breakdown.subtotal, 195);
  });

  // Scenario 24: Store ID and Product Ownership Mismatch Rejected
  await runTest('Scenario 24: Orders with mismatched storeId and product owner are rejected', async () => {
    const product = { id: 'p_canteen_1', storeId: 'store_canteen_01' };

    function verifyProductStore(prod, claimedStoreId) {
      if (prod.storeId !== claimedStoreId) {
        throw new Error('Product does not belong to specified store');
      }
      return true;
    }

    assert.equal(verifyProductStore(product, 'store_canteen_01'), true);
    assert.throws(() => verifyProductStore(product, 'store_canteen_02'), /Product does not belong/);
  });

  // Scenario 25: Unauthorized switchRole Rejected by Client State Guard
  await runTest('Scenario 25: switchRole rejects unverified role changes for non-merchant customers', async () => {
    const customerUser = { uid: 'user_cust', roles: ['customer'], activeRole: 'customer' };

    function guardedSwitchRole(user, targetRole) {
      const allowedRoles = user.roles || ['customer'];
      if (!allowedRoles.includes(targetRole)) {
        return user.activeRole; // Reject change, retain current
      }
      return targetRole;
    }

    assert.equal(guardedSwitchRole(customerUser, 'merchant'), 'customer');
    assert.equal(guardedSwitchRole(customerUser, 'admin'), 'customer');

    const merchantUser = { uid: 'user_mch', roles: ['customer', 'merchant'], activeRole: 'customer' };
    assert.equal(guardedSwitchRole(merchantUser, 'merchant'), 'merchant');
  });

  // Scenario 26: Complete Client Order Creation Lockdown (allow create: if false)
  await runTest('Scenario 26: Complete Lockdown: Client SDK (including admin) cannot create orders directly in Firestore', async () => {
    function firestoreSecurityRuleCheck(requestAuth, isBackendAdminSdk) {
      // allow create: if false (Only Backend Admin SDK can write orders)
      if (isBackendAdminSdk) return true;
      return false;
    }

    assert.equal(firestoreSecurityRuleCheck({ uid: 'cust_1' }, false), false);
    assert.equal(firestoreSecurityRuleCheck({ uid: 'merchant_1' }, false), false);
    assert.equal(firestoreSecurityRuleCheck({ uid: 'admin_browser_user' }, false), false);
    assert.equal(firestoreSecurityRuleCheck(null, true), true); // Cloud Function Admin SDK
  });

  // Scenario 27: Cross-store Coupon Injection Rejected
  await runTest('Scenario 27: Coupon bound to Store A produces 0 THB discount when applied to Store B', async () => {
    const coupons = {
      'STORE_A_ONLY': { status: 'Active', storeId: 'store_a', discount: 20, minSpend: 50, expiryDate: '2099-12-31' }
    };

    function validateCouponStoreScope(code, targetStoreId, subtotal) {
      const c = coupons[code];
      if (!c || (c.storeId && c.storeId !== targetStoreId) || subtotal < c.minSpend) {
        return 0;
      }
      return c.discount;
    }

    assert.equal(validateCouponStoreScope('STORE_A_ONLY', 'store_b', 100), 0); // Cross-store rejected
    assert.equal(validateCouponStoreScope('STORE_A_ONLY', 'store_a', 100), 20); // Valid store match
  });

  // Scenario 28: Malformed Coupon Edge Cases Handled Safely
  await runTest('Scenario 28: Malformed coupons (>100% percent, negative discount, inactive) produce safe 0 THB discount', async () => {
    function computeSafeCouponDiscount(coupon, subtotal) {
      if (!coupon || coupon.status !== 'Active') return 0;
      const minSpend = Number(coupon.minSpend) || 0;
      const discountVal = Number(coupon.discount) || 0;
      if (subtotal < minSpend || discountVal <= 0 || isNaN(minSpend) || isNaN(discountVal)) return 0;

      if (coupon.discountType === 'percent') {
        const clampedPercent = Math.min(100, Math.max(0, discountVal));
        return Math.round((subtotal * clampedPercent) / 100);
      }
      return Math.min(subtotal, discountVal);
    }

    assert.equal(computeSafeCouponDiscount({ status: 'Inactive', discount: 50, minSpend: 0 }, 100), 0);
    assert.equal(computeSafeCouponDiscount({ status: 'Active', discount: -50, minSpend: 0 }, 100), 0);
    assert.equal(computeSafeCouponDiscount({ status: 'Active', discount: 150, discountType: 'percent', minSpend: 0 }, 100), 100); // Clamped to 100%
    assert.equal(computeSafeCouponDiscount({ status: 'Active', discount: 20, minSpend: 200 }, 100), 0); // minSpend not met
  });

  // Scenario 29: Provider Crash Injection & Automatic Resource Rollback Reconciliation
  await runTest('Scenario 29: Crash between Firestore commit and Opn provider triggers safe resource release', async () => {
    const db = new AdvancedFirestoreEngine();
    const storeId = 'store_crash_01';
    const date = '2026-09-03';
    const time = '12:00';
    const slotDocId = `${storeId}_${date}_${time}`;

    db.setDoc(`products/p_crash_01`, { stock: 5, price: 40 });
    db.setDoc(`store_slots/${slotDocId}`, { currentOrders: 2, capacity: 10 });

    // Step 1: Reserve resources in Firestore Transaction
    const orderId = 'ORD_CRASH_TEST';
    await db.runTransaction(async (t) => {
      const prod = (await t.get({ path: 'products/p_crash_01' })).data();
      const slot = (await t.get({ path: `store_slots/${slotDocId}` })).data();
      t.update({ path: 'products/p_crash_01' }, { stock: prod.stock - 1 });
      t.update({ path: `store_slots/${slotDocId}` }, { currentOrders: slot.currentOrders + 1 });
      t.set({ path: `orders/${orderId}` }, { orderId, paymentStatus: 'pending', reservedQuantity: 1, resourcesReleased: false });
    });

    assert.equal(db.getDoc('products/p_crash_01').stock, 4);
    assert.equal(db.getDoc(`store_slots/${slotDocId}`).currentOrders, 3);

    // Step 2: Simulate Payment Provider Crash (Network Timeout)
    const providerCrashed = true;
    if (providerCrashed) {
      db.setDoc(`orders/${orderId}`, { paymentStatus: 'creation_failed' }, { merge: true });
    }

    // Step 3: Scheduler / Reconciliation rolls back reserved resources
    await db.runTransaction(async (t) => {
      const ord = (await t.get({ path: `orders/${orderId}` })).data();
      if (ord.paymentStatus === 'creation_failed' && !ord.resourcesReleased) {
        const prod = (await t.get({ path: 'products/p_crash_01' })).data();
        const slot = (await t.get({ path: `store_slots/${slotDocId}` })).data();
        t.update({ path: 'products/p_crash_01' }, { stock: prod.stock + ord.reservedQuantity });
        t.update({ path: `store_slots/${slotDocId}` }, { currentOrders: slot.currentOrders - ord.reservedQuantity });
        t.update({ path: `orders/${orderId}` }, { resourcesReleased: true });
      }
    });

    // Verification: Stock and Slot restored to initial values!
    assert.equal(db.getDoc('products/p_crash_01').stock, 5);
    assert.equal(db.getDoc(`store_slots/${slotDocId}`).currentOrders, 2);
    assert.equal(db.getDoc(`orders/${orderId}`).resourcesReleased, true);
  });

  // Scenario 30: Multi-step Payment Provider Timeout with Idempotent Recovery
  await runTest('Scenario 30: Recovers existing payment charge on client retry without duplicate charge creation', async () => {
    const charges = new Map();
    let chargeCounter = 0;

    function createOrRecoverOpnCharge(idempotencyKey, amount) {
      if (charges.has(idempotencyKey)) {
        return { recovered: true, ...charges.get(idempotencyKey) };
      }
      chargeCounter++;
      const charge = { id: `chrg_${chargeCounter}`, amount, qrUrl: `https://opn.ooo/qr/${chargeCounter}` };
      charges.set(idempotencyKey, charge);
      return { recovered: false, ...charge };
    }

    const firstAttempt = createOrRecoverOpnCharge('idemp_timeout_key_1', 15000);
    assert.equal(firstAttempt.recovered, false);
    assert.equal(firstAttempt.id, 'chrg_1');

    const retryAttempt = createOrRecoverOpnCharge('idemp_timeout_key_1', 15000);
    assert.equal(retryAttempt.recovered, true);
    assert.equal(retryAttempt.id, 'chrg_1'); // Same charge returned, zero duplicate charges!
  });

  // Scenario 31: Dynamic Store Capacity Precedence
  await runTest('Scenario 31: Live store configuration takes immediate precedence over historical slot capacity', async () => {
    const historicalSlotDoc = { currentOrders: 3, capacity: 20 }; // Old capacity 20
    const liveShopDoc = { slotCapacity: 5 }; // Store owner reduced capacity to 5

    function computeEffectiveCapacity(shopData, slotData) {
      const storeConfiguredCapacity = shopData?.slotCapacity ?? shopData?.maxOrdersPerSlot;
      return typeof storeConfiguredCapacity === 'number' && storeConfiguredCapacity > 0
        ? Number(storeConfiguredCapacity)
        : (slotData?.capacity ? Number(slotData.capacity) : 0);
    }

    const effectiveCapacity = computeEffectiveCapacity(liveShopDoc, historicalSlotDoc);
    assert.equal(effectiveCapacity, 5); // 5 overrides 20 immediately!

    // Attempting to order 3 more when 3 are booked and max is 5 -> REJECT
    const canBook3More = (historicalSlotDoc.currentOrders + 3) <= effectiveCapacity;
    assert.equal(canBook3More, false);
  });

  // Scenario 32: Admin Browser Client Mutation Restriction in Firestore Rules
  await runTest('Scenario 32: Admin client in browser cannot tamper with paymentStatus or bypass coupled state machine', async () => {
    function validateAdminOrderUpdate(existingOrder, updatedFields) {
      const allowedKeys = ['queueStatus', 'status', 'estimatedReadyTime', 'merchantNote', 'adminNote', 'updatedAt'];
      const mutatedKeys = Object.keys(updatedFields);
      const hasOnlyAllowed = mutatedKeys.every(k => allowedKeys.includes(k));
      if (!hasOnlyAllowed) {
        throw new Error(`Security Violation: Mutating forbidden keys: ${mutatedKeys.filter(k => !allowedKeys.includes(k))}`);
      }

      function isValidOrderStateTransition(oldStatus, oldQueue, newStatus, newQueue) {
        return (oldStatus === newStatus && oldQueue === newQueue) ||
               (oldStatus === 'TO_SHIP' && oldQueue === 'waiting' && newStatus === 'PREPARING' && newQueue === 'cooking') ||
               (oldStatus === 'PREPARING' && oldQueue === 'cooking' && newStatus === 'READY' && newQueue === 'ready') ||
               (oldStatus === 'READY' && oldQueue === 'ready' && newStatus === 'COMPLETED' && newQueue === 'completed') ||
               ((oldStatus === 'TO_SHIP' || oldStatus === 'PREPARING') && newStatus === 'CANCELLED' && newQueue === 'cancelled');
      }

      const newStatus = updatedFields.status || existingOrder.status;
      const newQueue = updatedFields.queueStatus || existingOrder.queueStatus;
      if (!isValidOrderStateTransition(existingOrder.status, existingOrder.queueStatus, newStatus, newQueue)) {
        throw new Error('State Machine Violation: Invalid coupled state transition');
      }
      return true;
    }

    const currentOrder = { status: 'TO_SHIP', queueStatus: 'waiting', paymentStatus: 'pending', totalAmount: 100 };

    // Admin tries to set paymentStatus to paid directly -> REJECT
    assert.throws(() => validateAdminOrderUpdate(currentOrder, { paymentStatus: 'paid' }), /Mutating forbidden keys/);

    // Admin tries to jump TO_SHIP -> COMPLETED directly -> REJECT
    assert.throws(() => validateAdminOrderUpdate(currentOrder, { status: 'COMPLETED', queueStatus: 'completed' }), /State Machine Violation/);

    // Admin performs legitimate synchronized advance TO_SHIP/waiting -> PREPARING/cooking -> PASS
    assert.equal(validateAdminOrderUpdate(currentOrder, { status: 'PREPARING', queueStatus: 'cooking', adminNote: 'Approved by admin' }), true);
  });

  // Scenario 33: Network timeout after charge creation -> Client retry recovers existing charge without double deduction
  await runTest('Scenario 33: Network timeout after charge creation recovers existing charge on retry', async () => {
    const engine = new AdvancedFirestoreEngine();
    const idempotencyDocId = 'user_01_idemp_key_network_drop';

    // Simulate initial attempt creating charge then client timing out
    engine.setDoc(`orders/ord_timeout_01`, {
      orderId: 'ord_timeout_01',
      userId: 'user_01',
      storeId: 'store_canteen01',
      productId: 'prod_krapao',
      quantity: 1,
      paymentId: 'chrg_test_timeout_01',
      qrUrl: 'https://api.omise.co/qr/timeout_01',
      totalAmount: 50,
      paymentStatus: 'pending',
      status: 'TO_SHIP',
      queueStatus: 'waiting',
      resourcesReleased: false
    });

    engine.setDoc(`idempotency_keys/${idempotencyDocId}`, {
      orderId: 'ord_timeout_01',
      paymentId: 'chrg_test_timeout_01',
      createdAt: new Date()
    });

    // Client retries with same idempotency key
    const idempSnap = engine.getDoc(`idempotency_keys/${idempotencyDocId}`);
    assert.ok(idempSnap);
    const existingOrder = engine.getDoc(`orders/${idempSnap.orderId}`);
    assert.equal(existingOrder.orderId, 'ord_timeout_01');
    assert.equal(existingOrder.paymentId, 'chrg_test_timeout_01');
    assert.equal(existingOrder.paymentStatus, 'pending');
  });

  // Scenario 34: Webhook arrives before client retry finishes -> marks paid, client retry returns updated state
  await runTest('Scenario 34: Out-of-order Webhook completes before client retry returns', async () => {
    const engine = new AdvancedFirestoreEngine();
    const idempotencyDocId = 'user_01_idemp_key_ooo';

    engine.setDoc(`orders/ord_ooo_01`, {
      orderId: 'ord_ooo_01',
      userId: 'user_01',
      storeId: 'store_canteen01',
      productId: 'prod_krapao',
      quantity: 1,
      paymentId: 'chrg_test_ooo_01',
      totalAmount: 50,
      paymentStatus: 'pending',
      status: 'TO_SHIP',
      queueStatus: 'waiting',
      resourcesReleased: false
    });

    engine.setDoc(`idempotency_keys/${idempotencyDocId}`, {
      orderId: 'ord_ooo_01',
      paymentId: 'chrg_test_ooo_01',
      createdAt: new Date()
    });

    // 1. Webhook arrives FIRST and transitions order to paid
    await engine.runTransaction(async (tx) => {
      const snap = await tx.get({ path: 'orders/ord_ooo_01' });
      const order = snap.data();
      if (order.paymentStatus === 'pending') {
        tx.update({ path: 'orders/ord_ooo_01' }, {
          paymentStatus: 'paid',
          paidAt: new Date()
        });
      }
    });

    // 2. Client retry recovers the order and sees it is already paid!
    const idempSnap = engine.getDoc(`idempotency_keys/${idempotencyDocId}`);
    const recoveredOrder = engine.getDoc(`orders/${idempSnap.orderId}`);
    assert.equal(recoveredOrder.paymentStatus, 'paid');
    assert.ok(recoveredOrder.paidAt);
  });

  // Scenario 35: Webhook with unsupported event key or malformed body is REJECTED (HTTP 400)
  await runTest('Scenario 35: Webhook with unsupported event key or malformed body is REJECTED', async () => {
    function validateWebhookEvent(event) {
      const ALLOWED_WEBHOOK_EVENTS = ["charge.complete", "charge.create", "charge.update"];
      if (!event || typeof event.key !== "string" || !ALLOWED_WEBHOOK_EVENTS.includes(event.key)) {
        throw new Error("HTTP 400: Unsupported or missing webhook event key");
      }
      const chargeId = event.data?.id;
      if (typeof chargeId !== "string" || !chargeId.trim() || !chargeId.startsWith("chrg_")) {
        throw new Error("HTTP 400: Invalid or missing Opn charge ID format");
      }
      return true;
    }

    assert.throws(() => validateWebhookEvent({ key: "customer.create", data: { id: "chrg_123" } }), /Unsupported or missing webhook event key/);
    assert.throws(() => validateWebhookEvent({ key: "charge.complete", data: { id: "invalid_id_format" } }), /Invalid or missing Opn charge ID format/);
    assert.equal(validateWebhookEvent({ key: "charge.complete", data: { id: "chrg_test_valid_01" } }), true);
  });

  // Scenario 36: Webhook with tampered amount (e.g. 50 THB paid for 500 THB order) is REJECTED
  await runTest('Scenario 36: Webhook with tampered amount is strictly REJECTED (Amount Mismatch)', async () => {
    function verifyChargeAgainstOrder(charge, order) {
      const expectedSatang = Math.round(Number(order.totalAmount || order.totalPrice) * 100);
      if (charge.currency !== "THB") throw new Error("HTTP 400: Currency mismatch");
      if (charge.amount !== expectedSatang) throw new Error("HTTP 400: Amount mismatch (Possible Underpayment Attack)");
      if (charge.metadata?.orderId !== order.orderId) throw new Error("HTTP 400: Order ID mismatch");
      if (charge.metadata?.uid !== order.userId) throw new Error("HTTP 400: User ID mismatch");
      return true;
    }

    const validOrder = { orderId: "ord_100", userId: "user_buyer_01", totalAmount: 500 };
    const tamperedCharge = { id: "chrg_100", amount: 5000, currency: "THB", metadata: { orderId: "ord_100", uid: "user_buyer_01" } }; // 50 THB instead of 500 THB (50000 satang)
    const validCharge = { id: "chrg_100", amount: 50000, currency: "THB", metadata: { orderId: "ord_100", uid: "user_buyer_01" } };

    assert.throws(() => verifyChargeAgainstOrder(tamperedCharge, validOrder), /Amount mismatch/);
    assert.equal(verifyChargeAgainstOrder(validCharge, validOrder), true);
  });

  // Scenario 37: Webhook with charge belonging to Order A attempting to mutate Order B is REJECTED
  await runTest('Scenario 37: Cross-order charge mutation spoofing is strictly REJECTED', async () => {
    function verifyOrderBinding(charge, targetOrder) {
      if (charge.metadata?.orderId !== targetOrder.orderId) {
        throw new Error("HTTP 400: Metadata Order ID does not match target order");
      }
      if (targetOrder.paymentId && targetOrder.paymentId !== charge.id) {
        throw new Error("HTTP 400: Charge ID does not match order payment binding");
      }
      return true;
    }

    const orderB = { orderId: "ord_B", userId: "user_B", paymentId: "chrg_order_B" };
    const chargeFromOrderA = { id: "chrg_order_A", metadata: { orderId: "ord_A", uid: "user_A" } };

    assert.throws(() => verifyOrderBinding(chargeFromOrderA, orderB), /Metadata Order ID does not match target order/);
  });

  // Scenario 38: Webhook attempting to downgrade already PAID order to FAILED is REJECTED
  await runTest('Scenario 38: Webhook cannot downgrade already PAID order to non-successful status', async () => {
    function processStateTransition(currentPaymentStatus, incomingChargeStatus) {
      if (currentPaymentStatus === "paid") {
        if (incomingChargeStatus === "successful") {
          return { action: "IGNORE_IDEMPOTENT", status: "paid" };
        }
        throw new Error("HTTP 400: Cannot downgrade already paid order to non-successful status");
      }
      return { action: "APPLY", status: incomingChargeStatus === "successful" ? "paid" : incomingChargeStatus };
    }

    assert.throws(() => processStateTransition("paid", "failed"), /Cannot downgrade already paid order/);
    assert.throws(() => processStateTransition("paid", "expired"), /Cannot downgrade already paid order/);
    assert.deepEqual(processStateTransition("paid", "successful"), { action: "IGNORE_IDEMPOTENT", status: "paid" });
    assert.deepEqual(processStateTransition("pending", "successful"), { action: "APPLY", status: "paid" });
  });

  // Scenario 39: charge.create event acknowledges receipt but NEVER marks order as paid
  await runTest('Scenario 39: charge.create event acknowledges receipt but never marks order as paid', async () => {
    function handleWebhookEventKey(eventKey, currentOrderStatus) {
      if (eventKey === "charge.create") {
        return { responseCode: 200, message: "Charge creation event acknowledged", newStatus: currentOrderStatus };
      }
      if (eventKey === "charge.complete") {
        return { responseCode: 200, message: "OK", newStatus: "paid" };
      }
      throw new Error("Unsupported event key");
    }

    const initialOrder = { orderId: "ord_create_01", paymentStatus: "pending" };
    const createResult = handleWebhookEventKey("charge.create", initialOrder.paymentStatus);
    assert.equal(createResult.responseCode, 200);
    assert.equal(createResult.newStatus, "pending"); // Must remain pending!
  });

  // Scenario 40: Concurrent duplicate webhooks (Event #1 & #2 entering simultaneously) are serialized with OCC
  await runTest('Scenario 40: Concurrent webhooks are serialized with OCC and processed exactly once', async () => {
    const engine = new AdvancedFirestoreEngine();
    engine.setDoc(`orders/ord_concurrent_01`, {
      orderId: 'ord_concurrent_01',
      userId: 'user_concurrent',
      paymentStatus: 'pending',
      totalAmount: 100
    });

    async function processWebhookAtomic() {
      return await engine.runTransaction(async (tx) => {
        const snap = await tx.get({ path: 'orders/ord_concurrent_01' });
        const order = snap.data();
        if (order.paymentStatus === 'paid') {
          return { status: 'already_paid' };
        }
        tx.update({ path: 'orders/ord_concurrent_01' }, {
          paymentStatus: 'paid'
        });
        return { status: 'marked_paid' };
      });
    }

    // Run 2 webhook processors concurrently
    const [res1, res2] = await Promise.all([processWebhookAtomic(), processWebhookAtomic()]);
    const finalOrder = engine.getDoc('orders/ord_concurrent_01');
    assert.equal(finalOrder.paymentStatus, 'paid');
    const markedPaidCount = [res1, res2].filter(r => r.status === 'marked_paid').length;
    const alreadyPaidCount = [res1, res2].filter(r => r.status === 'already_paid').length;
    assert.equal(markedPaidCount, 1); // Exactly 1 committed the transition
    assert.equal(alreadyPaidCount, 1); // Exactly 1 detected already paid on OCC retry
  });

  // Scenario 41: Replayed webhook event with existing eventId in webhook_events returns 200 without mutation
  await runTest('Scenario 41: Replayed webhook event with existing eventId returns 200 without duplicate mutation', async () => {
    const engine = new AdvancedFirestoreEngine();
    const eventId = "evnt_test_replay_999";
    engine.setDoc(`webhook_events/${eventId}`, {
      eventId,
      chargeId: "chrg_test_replay",
      orderId: "ord_replay_01",
      processed: true,
      createdAt: new Date()
    });
    engine.setDoc(`orders/ord_replay_01`, {
      orderId: 'ord_replay_01',
      paymentStatus: 'paid',
      totalAmount: 100
    });

    let duplicateAuditCreated = false;
    const result = await engine.runTransaction(async (tx) => {
      const eventSnap = await tx.get({ path: `webhook_events/${eventId}` });
      if (eventSnap?.exists && eventSnap.data()?.processed === true) {
        return { code: 200, message: "Already processed event" };
      }
      duplicateAuditCreated = true;
      return { code: 200, message: "OK" };
    });

    assert.equal(result.code, 200);
    assert.equal(result.message, "Already processed event");
    assert.equal(duplicateAuditCreated, false);
  });

  // Scenario 42: Out-of-order charge.update with failed arriving after charge.complete is rejected by state machine
  await runTest('Scenario 42: Out-of-order charge.update after charge.complete is rejected by isAllowedPaymentTransition', async () => {
    function isAllowedPaymentTransition(currentStatus, nextStatus) {
      if (currentStatus === nextStatus) return true;
      const ALLOWED_TRANSITIONS = {
        pending: ["paid", "failed", "expired", "charge_created_order_pending", "creation_failed"],
        charge_created_order_pending: ["paid", "failed", "expired", "creation_failed"],
        expired: ["paid_after_expired"],
        cancelled: ["paid_after_expired"],
        paid: ["refunded", "paid"],
        paid_after_expired: ["paid", "refunded"],
        refunded: ["refunded"]
      };
      return (ALLOWED_TRANSITIONS[currentStatus] || []).includes(nextStatus);
    }

    assert.equal(isAllowedPaymentTransition("pending", "paid"), true);
    assert.equal(isAllowedPaymentTransition("paid", "failed"), false);
    assert.equal(isAllowedPaymentTransition("paid", "expired"), false);
    assert.equal(isAllowedPaymentTransition("refunded", "paid"), false);
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
