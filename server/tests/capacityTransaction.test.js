/**
 * Smart Pre-order & Dynamic Capacity v2.1
 * Integration / Concurrency Test Suite
 * 
 * Verifies real atomic Firestore Transactions and concurrency control:
 * 1. Concurrent Reservation Race Condition:
 *    Capacity = 10
 *    Promise.all([ Request A (6), Request B (6) ])
 *    Expectation: Exactly 1 SUCCESS, 1 REJECT, Final Workload = 6 (NEVER 12)
 * 2. Slot Confirmation (Transfer pending -> confirmedWorkload, orderId = reservationId)
 * 3. Capacity Release on Cancellation (Backend calculation)
 * 4. Inspection API Data Shape (Requirement #8)
 */

import { adminDb } from '../firebaseAdmin.js';
import { SlotTransactionService } from '../services/slotTransactionService.js';

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

async function runConcurrencyTests() {
  console.log('===============================================================');
  console.log('⚡ FIRESTORE TRANSACTION CONCURRENCY & INTEGRATION TEST SUITE');
  console.log('===============================================================\n');

  const testStoreId = `store_concurrent_${Date.now()}`;
  const testSlotId = '2026-09-26_12-00';
  const slotRef = SlotTransactionService.getSlotRef(testStoreId, testSlotId);

  // -------------------------------------------------------------------
  // TEST 1: Real Concurrent Race Condition (Promise.all)
  // Capacity = 10, Request A = 6, Request B = 6
  // -------------------------------------------------------------------
  console.log('--- TEST 1: Real Concurrent Reservation Race Condition ---');
  
  // Clean initial state: initialize slot with capacity 10
  await slotRef.set({
    slotId: testSlotId,
    storeId: testStoreId,
    startTime: '12:00',
    endTime: '12:15',
    capacity: 10,
    confirmedWorkload: 0,
    confirmedOrders: 0,
    pending: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const resIdA = `res_concurrent_A_${Date.now()}`;
  const resIdB = `res_concurrent_B_${Date.now()}`;

  console.log('  🚀 Firing Request A (workload 6) and Request B (workload 6) simultaneously...');
  
  // Fire both simultaneously via Promise.all
  const [resultA, resultB] = await Promise.all([
    SlotTransactionService.reserveSlot({
      storeId: testStoreId,
      slotId: testSlotId,
      reservationId: resIdA,
      workload: 6,
      pickupType: 'NOW',
      defaultCapacity: 10
    }),
    SlotTransactionService.reserveSlot({
      storeId: testStoreId,
      slotId: testSlotId,
      reservationId: resIdB,
      workload: 6,
      pickupType: 'NOW',
      defaultCapacity: 10
    })
  ]);

  const successes = [resultA, resultB].filter(r => r.success === true);
  const failures = [resultA, resultB].filter(r => r.success === false);

  assertEquals(successes.length, 1, 'Exactly 1 request succeeded under concurrency');
  assertEquals(failures.length, 1, 'Exactly 1 request was rejected under concurrency');
  assertEquals(failures[0].reason, 'CAPACITY_EXCEEDED', 'Rejected request reason is CAPACITY_EXCEEDED');

  // Verify directly from Firestore document that workload is 6, NEVER 12
  const slotDocAfterRace = await slotRef.get();
  const slotDataAfterRace = slotDocAfterRace.data();
  const totalPendingWorkload = slotDataAfterRace.pending.reduce((s, r) => s + r.workload, 0);
  const totalUsedWorkload = slotDataAfterRace.confirmedWorkload + totalPendingWorkload;

  assertEquals(totalUsedWorkload, 6, 'Final slot workload in database is strictly 6, proving oversell was prevented');
  assertEquals(slotDataAfterRace.pending.length, 1, 'Exactly 1 pending reservation exists in database');

  const winnerReservationId = successes[0].reservationId;
  console.log(`  🏆 Winning Reservation: ${winnerReservationId}`);

  // -------------------------------------------------------------------
  // TEST 2: Transaction Confirmation (Payment Completed)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 2: Transaction Confirmation (Transfer Pending -> Confirmed) ---');
  const confirmResult = await SlotTransactionService.confirmSlot({
    storeId: testStoreId,
    slotId: testSlotId,
    reservationId: winnerReservationId
  });

  assert(confirmResult.success === true, 'Confirmation transaction succeeded');
  assertEquals(confirmResult.orderId, winnerReservationId, 'orderId strictly equals reservationId');
  assertEquals(confirmResult.confirmedWorkload, 6, 'confirmedWorkload is updated to 6');

  // Verify in Firestore document
  const slotDocAfterConfirm = await slotRef.get();
  const slotDataAfterConfirm = slotDocAfterConfirm.data();
  assertEquals(slotDataAfterConfirm.confirmedWorkload, 6, 'Database confirmedWorkload is 6');
  assertEquals(slotDataAfterConfirm.pending.length, 0, 'Database pending array is empty');
  assertEquals(slotDataAfterConfirm.confirmedOrders, 1, 'confirmedOrders count incremented to 1');

  // Idempotency: Confirm again should return alreadyConfirmed
  const confirmDuplicate = await SlotTransactionService.confirmSlot({
    storeId: testStoreId,
    slotId: testSlotId,
    reservationId: winnerReservationId
  });
  assert(confirmDuplicate.success === true, 'Duplicate confirm succeeded idempotently');
  assert(confirmDuplicate.alreadyConfirmed === true, 'Duplicate confirm flagged as alreadyConfirmed');

  // -------------------------------------------------------------------
  // TEST 3: Capacity Release on Cancellation
  // -------------------------------------------------------------------
  console.log('\n--- TEST 3: Capacity Release on Cancellation ---');
  const releaseResult = await SlotTransactionService.releaseSlot({
    storeId: testStoreId,
    slotId: testSlotId,
    reservationId: winnerReservationId,
    isConfirmed: true,
    workloadToRelease: 6
  });

  assert(releaseResult.success === true, 'Release transaction succeeded');
  assertEquals(releaseResult.releasedWorkload, 6, 'Released workload is 6');
  assertEquals(releaseResult.confirmedWorkload, 0, 'confirmedWorkload decremented to 0');

  // Verify in Firestore document
  const slotDocAfterRelease = await slotRef.get();
  assertEquals(slotDocAfterRelease.data().confirmedWorkload, 0, 'Database confirmedWorkload restored to 0');

  // -------------------------------------------------------------------
  // TEST 4: Inspection Endpoint Data Shape (Requirement #8)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 4: Inspection Endpoint Data Shape (GET /api/capacity/:storeId/:date) ---');
  const dateSlots = await SlotTransactionService.getStoreDateSlots({
    storeId: testStoreId,
    dateStr: '2026-09-26',
    defaultCapacity: 30
  });

  assertEquals(dateSlots.storeId, testStoreId, 'Store ID matches query');
  assertEquals(dateSlots.date, '2026-09-26', 'Date matches query');
  assert(Array.isArray(dateSlots.slots) && dateSlots.slots.length > 0, 'Slots array populated');

  const sampleSlot = dateSlots.slots.find(s => s.slotId === testSlotId);
  assert(sampleSlot !== undefined, 'Target slot exists in inspection output');
  assertEquals(sampleSlot.startTime, '12:00', 'Slot startTime is 12:00');
  assertEquals(sampleSlot.endTime, '12:15', 'Slot endTime is 12:15');
  assert(sampleSlot.status === 'AVAILABLE', 'Slot status is AVAILABLE');
  assertEquals(sampleSlot.usedWorkload, 0, 'Slot usedWorkload is 0 after full release');

  console.log('\n===============================================================');
  console.log(`📊 INTEGRATION TEST RESULTS: ${passedTests}/${totalTests} Passed (${passedTests === totalTests ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
  console.log('===============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runConcurrencyTests().catch(err => {
  console.error('Unhandled failure in concurrency test:', err);
  process.exit(1);
});
