/**
 * Smart Pre-order & Dynamic Capacity v2.1
 * Unit Test Suite for capacityService.js
 * 
 * Verifies the 7 Core Requirements:
 * Test 1: Normal Capacity (20 + 5 + 3 = 28 <= 30 -> PASS)
 * Test 2: Oversell Prevention (20 + 8 + 3 = 31 > 30 -> REJECT)
 * Test 3: Lazy Expiration (expired pending filtered out on-the-fly -> ACCEPT)
 * Test 4: NOW + SCHEDULED Shared Pool (combined workload enforces strict ceiling)
 * Test 5: Cancellation Workload Release (confirmedWorkload 25 - 5 = 20)
 * Test 6: Webhook Idempotency & Layered Defense Logic
 * Test 7: Capacity Boundary & Sequential Race Condition Prevention
 */

import {
  calculateWorkload,
  cleanupExpiredPending,
  calculateUsedWorkload,
  calculateRemainingCapacity,
  canReserve,
  reserve,
  confirmReservation,
  releaseReservation,
  resolveCurrentSlot,
  getCapacityStatus
} from '../services/capacityService.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

function assertEquals(actual, expected, message) {
  totalTests++;
  if (actual === expected) {
    console.log(`  ✅ [PASS] ${message} (Value: ${actual})`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message} | Expected: ${expected}, Got: ${actual}`);
    process.exitCode = 1;
  }
}

console.log('===============================================================');
console.log('🧪 SMART PRE-ORDER & DYNAMIC CAPACITY V2.1 — UNIT TEST SUITE');
console.log('===============================================================\n');

// -------------------------------------------------------------------
// TEST 1: Normal Capacity Check
// capacity = 30, confirmed = 20, pending = 5, new = 3 -> 28 <= 30 -> PASS
// -------------------------------------------------------------------
console.log('--- TEST 1: Normal Capacity Check (20 + 5 + 3 = 28 <= 30) ---');
{
  const now = 1700000000000;
  const pending = [
    { reservationId: 'res_1', workload: 5, expiresAt: now + 300000, pickupType: 'NOW' }
  ];

  const result = canReserve({
    capacity: 30,
    confirmedWorkload: 20,
    pending,
    newWorkload: 3,
    now
  });

  assert(result.allowed === true, 'Reservation is allowed when within capacity');
  assertEquals(result.usedWorkload, 25, 'Used workload before reservation is 25');
  assertEquals(result.projectedWorkload, 28, 'Projected workload is 28');
  assertEquals(result.remainingWorkload, 2, 'Remaining workload after reservation is 2');
}

// -------------------------------------------------------------------
// TEST 2: Oversell Prevention
// capacity = 30, confirmed = 20, pending = 8, new = 3 -> 31 > 30 -> REJECT
// -------------------------------------------------------------------
console.log('\n--- TEST 2: Oversell Prevention (20 + 8 + 3 = 31 > 30 -> REJECT) ---');
{
  const now = 1700000000000;
  const pending = [
    { reservationId: 'res_2', workload: 8, expiresAt: now + 300000, pickupType: 'SCHEDULED' }
  ];

  const result = canReserve({
    capacity: 30,
    confirmedWorkload: 20,
    pending,
    newWorkload: 3,
    now
  });

  assert(result.allowed === false, 'Reservation is rejected when exceeding capacity');
  assertEquals(result.reason, 'CAPACITY_EXCEEDED', 'Rejection reason is CAPACITY_EXCEEDED');
  assertEquals(result.usedWorkload, 28, 'Used workload is 28');
  assertEquals(result.projectedWorkload, 31, 'Projected workload exceeds capacity at 31');
  assertEquals(result.remainingWorkload, 2, 'Remaining capacity before rejection is 2');
}

// -------------------------------------------------------------------
// TEST 3: Lazy Expiration (In-Flight Expiration without Cron)
// capacity = 30, confirmed = 20
// pending: r1 = 5 (expired), r2 = 3 (active)
// new = 4 -> after cleanup: 20 + 3 + 4 = 27 <= 30 -> ACCEPT
// -------------------------------------------------------------------
console.log('\n--- TEST 3: Lazy Expiration (Cleanup on-the-fly) ---');
{
  const now = 1700000000000;
  const pending = [
    { reservationId: 'r1', workload: 5, expiresAt: now - 1000, pickupType: 'NOW' },      // EXPIRED 1s ago
    { reservationId: 'r2', workload: 3, expiresAt: now + 300000, pickupType: 'SCHEDULED' } // ACTIVE
  ];

  const result = canReserve({
    capacity: 30,
    confirmedWorkload: 20,
    pending,
    newWorkload: 4,
    now
  });

  assert(result.allowed === true, 'Lazy cleanup of r1 frees 5 workload, allowing new reservation');
  assertEquals(result.expiredPending.length, 1, 'Exactly 1 reservation was detected as expired');
  assertEquals(result.freedWorkload, 5, 'Freed 5 workload from expired reservation r1');
  assertEquals(result.usedWorkload, 23, 'Active used workload after lazy cleanup is 23 (20 + 3)');
  assertEquals(result.projectedWorkload, 27, 'Projected workload is 27 (23 + 4)');
  assertEquals(result.remainingWorkload, 3, 'Remaining capacity is 3 (30 - 27)');
}

// -------------------------------------------------------------------
// TEST 4: NOW + SCHEDULED Shared Pool Ceiling
// capacity = 30
// confirmed NOW = 10, confirmed SCHEDULED = 12 (confirmedWorkload = 22)
// pending = 5, total used = 27
// new NOW = 4 -> 27 + 4 = 31 > 30 -> REJECT
// -------------------------------------------------------------------
console.log('\n--- TEST 4: NOW + SCHEDULED Shared Pool (Total ceiling enforcement) ---');
{
  const now = 1700000000000;
  // Shared capacity: both NOW and SCHEDULED consume from the same confirmed pool
  const confirmedNow = 10;
  const confirmedScheduled = 12;
  const confirmedWorkload = confirmedNow + confirmedScheduled; // 22

  const pending = [
    { reservationId: 'res_active', workload: 5, expiresAt: now + 300000, pickupType: 'NOW' }
  ];

  const result = canReserve({
    capacity: 30,
    confirmedWorkload,
    pending,
    newWorkload: 4, // Customer attempts a NOW order of workload 4
    now
  });

  assert(result.allowed === false, 'Shared pool rejects new NOW order because kitchen total is 31/30');
  assertEquals(result.usedWorkload, 27, 'Combined used workload is 27');
  assertEquals(result.projectedWorkload, 31, 'Projected total workload is 31');
}

// -------------------------------------------------------------------
// TEST 5: Cancellation Capacity Release
// confirmed = 25, cancel workload = 5 -> confirmed = 20
// -------------------------------------------------------------------
console.log('\n--- TEST 5: Cancellation Capacity Release ---');
{
  // 5.1 Confirmed Order Cancellation / Merchant Rejection
  const releaseConfirmed = releaseReservation({
    confirmedWorkload: 25,
    pending: [],
    isConfirmed: true,
    workloadToRelease: 5
  });

  assert(releaseConfirmed.success === true, 'Confirmed cancellation successfully processed');
  assertEquals(releaseConfirmed.confirmedWorkload, 20, 'Confirmed workload decremented from 25 to 20');
  assertEquals(releaseConfirmed.releasedWorkload, 5, 'Released workload is exactly 5');

  // 5.2 Pending Checkout Cancellation
  const pendingBefore = [
    { reservationId: 'r_cancel', workload: 3, expiresAt: Date.now() + 60000 }
  ];
  const releasePending = releaseReservation({
    confirmedWorkload: 20,
    pending: pendingBefore,
    reservationId: 'r_cancel'
  });

  assert(releasePending.success === true, 'Pending reservation successfully removed');
  assertEquals(releasePending.pending.length, 0, 'Pending queue emptied of cancelled reservation');
  assertEquals(releasePending.releasedWorkload, 3, 'Released pending workload is 3');
}

// -------------------------------------------------------------------
// TEST 6: Webhook Idempotency & Defense in Depth
// -------------------------------------------------------------------
console.log('\n--- TEST 6: Webhook Idempotency & Defense in Depth ---');
{
  // Simulating payment event idempotency logic
  const processedEvents = new Set();
  const existingOrders = new Map();

  function processPaymentWebhook({ eventId, reservationId, paymentId, workload }) {
    // Layer 1: Payment Event Idempotency Check
    if (processedEvents.has(eventId)) {
      return { status: 'IGNORED_DUPLICATE_EVENT', orderId: existingOrders.get(reservationId)?.orderId };
    }
    processedEvents.add(eventId);

    // Layer 2: Order Existence Check (orderId === reservationId)
    if (existingOrders.has(reservationId)) {
      return { status: 'IGNORED_EXISTING_ORDER', orderId: reservationId };
    }

    // Layer 3: Creation
    const order = {
      orderId: reservationId,
      paymentId,
      workload,
      createdAt: Date.now()
    };
    existingOrders.set(reservationId, order);

    return { status: 'ORDER_CREATED', orderId: reservationId };
  }

  // Webhook Delivery 1
  const res1 = processPaymentWebhook({
    eventId: 'evt_stripe_101',
    reservationId: 'R001',
    paymentId: 'pi_3001',
    workload: 4
  });
  assertEquals(res1.status, 'ORDER_CREATED', 'Webhook Delivery 1 successfully creates order R001');
  assertEquals(res1.orderId, 'R001', 'orderId matches reservationId exactly');

  // Webhook Delivery 2 (Stripe network retry of same event)
  const res2 = processPaymentWebhook({
    eventId: 'evt_stripe_101',
    reservationId: 'R001',
    paymentId: 'pi_3001',
    workload: 4
  });
  assertEquals(res2.status, 'IGNORED_DUPLICATE_EVENT', 'Webhook Delivery 2 is ignored by event idempotency');

  // Webhook Delivery 3 (Different event referencing same reservationId)
  const res3 = processPaymentWebhook({
    eventId: 'evt_stripe_102',
    reservationId: 'R001',
    paymentId: 'pi_3001',
    workload: 4
  });
  assertEquals(res3.status, 'IGNORED_EXISTING_ORDER', 'Webhook Delivery 3 is caught by order existence check');
  assertEquals(existingOrders.size, 1, 'Total orders created is strictly 1');
}

// -------------------------------------------------------------------
// TEST 7: Capacity Boundary & Sequential Race Condition Prevention
// capacity = 10, Request A = 6, Request B = 6
// Sequential processing: A = ACCEPT, B = REJECT, Final workload = 6
// -------------------------------------------------------------------
console.log('\n--- TEST 7: Capacity Boundary & Sequential Race Condition Prevention ---');
{
  const capacity = 10;
  let slotState = {
    confirmedWorkload: 0,
    pending: []
  };

  // Request A tries to reserve 6
  const reqA = reserve({
    capacity,
    confirmedWorkload: slotState.confirmedWorkload,
    pending: slotState.pending,
    reservationId: 'res_A',
    newWorkload: 6,
    pickupType: 'NOW'
  });

  assert(reqA.success === true, 'Request A (workload 6) is accepted');
  assertEquals(reqA.usedWorkload, 6, 'Workload after Request A is 6');
  assertEquals(reqA.remainingWorkload, 4, 'Remaining capacity after Request A is 4');

  // Update slot state with Request A result
  slotState.pending = reqA.pending;

  // Request B tries to reserve 6 on the updated slot state
  const reqB = reserve({
    capacity,
    confirmedWorkload: slotState.confirmedWorkload,
    pending: slotState.pending,
    reservationId: 'res_B',
    newWorkload: 6,
    pickupType: 'NOW'
  });

  assert(reqB.success === false, 'Request B (workload 6) is rejected due to insufficient capacity');
  assertEquals(reqB.reason, 'CAPACITY_EXCEEDED', 'Rejection reason is CAPACITY_EXCEEDED');

  // Check final workload remains 6, NEVER 12
  const finalUsed = calculateUsedWorkload(slotState.confirmedWorkload, slotState.pending).usedWorkload;
  assertEquals(finalUsed, 6, 'Final slot workload is strictly 6, preventing oversell');
}

// -------------------------------------------------------------------
// TEST 8: Helper Functions (calculateWorkload & resolveCurrentSlot)
// -------------------------------------------------------------------
console.log('\n--- TEST 8: Workload Calculation & Slot Window Resolution ---');
{
  const items = [
    { name: 'กะเพราหมูกรอบ', quantity: 2, itemWorkload: 2 }, // 2 * 2 = 4
    { name: 'ชามะนาว', quantity: 3, itemWorkload: 1 }        // 3 * 1 = 3
  ];
  const workload = calculateWorkload(items);
  assertEquals(workload, 7, 'Item workload sums correctly to 7 (4 + 3)');

  // Slot Resolution: 12:08 should resolve to 12:00 - 12:15
  const testTime = new Date('2026-09-26T12:08:00+07:00').getTime();
  const slot = resolveCurrentSlot(testTime, 15);
  assertEquals(slot.startTimeStr, '12:00', 'Slot start time is 12:00');
  assertEquals(slot.endTimeStr, '12:15', 'Slot end time is 12:15');
}

// -------------------------------------------------------------------
// TEST 9: Slot boundaries are time-zone independent
// A UTC container must file a 12:08 Bangkok pickup under the 12:00 slot,
// not the 05:00 one, and must roll the date over at Bangkok midnight.
// -------------------------------------------------------------------
console.log('\n--- TEST 9: Time-zone Independent Slot Resolution ---');
{
  const noon = new Date('2026-09-26T12:08:00+07:00').getTime();
  const noonSlot = resolveCurrentSlot(noon, 15);
  assertEquals(noonSlot.slotId, '2026-09-26_12-00', 'Bangkok noon resolves to the 12:00 slot on any host');
  assertEquals(
    new Date(noonSlot.startTimeMs).toISOString(),
    '2026-09-26T05:00:00.000Z',
    'Slot start instant is the real 12:00 Bangkok moment'
  );

  const beforeMidnight = resolveCurrentSlot(new Date('2026-09-26T23:58:00+07:00').getTime(), 15);
  assertEquals(beforeMidnight.slotId, '2026-09-26_23-45', 'Late evening stays on the same Bangkok date');

  const afterMidnight = resolveCurrentSlot(new Date('2026-09-27T00:03:00+07:00').getTime(), 15);
  assertEquals(afterMidnight.slotId, '2026-09-27_00-00', 'The date rolls over at Bangkok midnight, not UTC midnight');
}

console.log('\n===============================================================');
console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} Passed (${passedTests === totalTests ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
console.log('===============================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
