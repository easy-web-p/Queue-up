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

  // -------------------------------------------------------------------
  // TEST 5: Abandoning a hold must not touch workload that is already paid for
  // -------------------------------------------------------------------
  console.log('\n--- TEST 5: Abandoned checkout releases the hold, not confirmed workload ---');

  const abandonStoreId = `store_abandon_${Date.now()}`;
  const abandonSlotRef = SlotTransactionService.getSlotRef(abandonStoreId, testSlotId);
  await abandonSlotRef.set({
    slotId: testSlotId,
    storeId: abandonStoreId,
    capacity: 30,
    confirmedWorkload: 0,
    confirmedOrders: 0,
    pending: [],
    updatedAt: Date.now()
  });

  // One customer pays: workload 10 sits in confirmedWorkload.
  await SlotTransactionService.reserveSlot({
    storeId: abandonStoreId, slotId: testSlotId, reservationId: 'res_paid_order', workload: 10, uid: 'alice'
  });
  await SlotTransactionService.confirmSlot({
    storeId: abandonStoreId, slotId: testSlotId, reservationId: 'res_paid_order'
  });

  // Another holds 7 and walks away from checkout.
  await SlotTransactionService.reserveSlot({
    storeId: abandonStoreId, slotId: testSlotId, reservationId: 'res_abandoned', workload: 7, uid: 'bob'
  });

  // Exactly what POST /api/capacity/release sends.
  const abandonRelease = await SlotTransactionService.releaseSlot({
    storeId: abandonStoreId, slotId: testSlotId, reservationId: 'res_abandoned', isConfirmed: false
  });

  assertEquals(abandonRelease.releasedFrom, 'PENDING', 'An abandoned hold is released from the pending pool');
  assertEquals(abandonRelease.releasedWorkload, 7, 'The abandoned workload of 7 is released');

  const abandonSlot = (await abandonSlotRef.get()).data();
  const abandonPendingWorkload = (abandonSlot.pending || []).reduce((sum, r) => sum + r.workload, 0);
  assertEquals(abandonSlot.confirmedWorkload, 10, "The paid order's confirmed workload is untouched");
  assertEquals(abandonPendingWorkload, 0, 'The abandoned hold no longer occupies the slot');

  // -------------------------------------------------------------------
  // TEST 6: A confirmed reservation cannot be released as if it were pending
  // -------------------------------------------------------------------
  console.log('\n--- TEST 6: A paid reservation cannot be released through the pending path ---');

  const paidRelease = await SlotTransactionService.releaseSlot({
    storeId: abandonStoreId, slotId: testSlotId, reservationId: 'res_paid_order', isConfirmed: false
  });
  assert(paidRelease.success === false, 'Releasing a confirmed reservation without asking for it is refused');
  assertEquals(paidRelease.reason, 'RESERVATION_NOT_PENDING', 'Refusal reason is RESERVATION_NOT_PENDING');

  const afterPaidRelease = (await abandonSlotRef.get()).data();
  assertEquals(afterPaidRelease.confirmedWorkload, 10, 'Confirmed workload survived the refused release');

  const paidReservation = (await adminDb.collection('reservations').doc('res_paid_order').get()).data();
  assert(paidReservation.status !== 'CANCELLED', 'The paid reservation was not marked CANCELLED');

  // -------------------------------------------------------------------
  // TEST 7: Reserving twice under one id is one reservation, not two
  // -------------------------------------------------------------------
  console.log('\n--- TEST 7: A retry of the same reservationId does not book capacity twice ---');

  const retryStoreId = `store_retry_${Date.now()}`;
  const retrySlotRef = SlotTransactionService.getSlotRef(retryStoreId, testSlotId);
  await retrySlotRef.set({
    slotId: testSlotId,
    storeId: retryStoreId,
    capacity: 30,
    confirmedWorkload: 0,
    confirmedOrders: 0,
    pending: [],
    updatedAt: Date.now()
  });

  await SlotTransactionService.reserveSlot({
    storeId: retryStoreId, slotId: testSlotId, reservationId: 'res_retried', workload: 6, uid: 'carol'
  });
  const retry = await SlotTransactionService.reserveSlot({
    storeId: retryStoreId, slotId: testSlotId, reservationId: 'res_retried', workload: 6, uid: 'carol'
  });
  assert(retry.success === true, 'The retry succeeds');

  const retrySlot = (await retrySlotRef.get()).data();
  const retryPendingWorkload = (retrySlot.pending || []).reduce((sum, r) => sum + r.workload, 0);
  assertEquals(retrySlot.pending.length, 1, 'One pending entry exists for one reservationId');
  assertEquals(retryPendingWorkload, 6, 'The retried reservation occupies 6, not 12');

  // Confirming it must leave nothing pending behind.
  await SlotTransactionService.confirmSlot({
    storeId: retryStoreId, slotId: testSlotId, reservationId: 'res_retried'
  });
  const retryAfterConfirm = (await retrySlotRef.get()).data();
  assertEquals(retryAfterConfirm.confirmedWorkload, 6, 'Confirming the retried reservation transfers 6');
  assertEquals(retryAfterConfirm.pending.length, 0, 'No orphaned hold is left behind after confirmation');

  // -------------------------------------------------------------------
  // TEST 8: A reservation id already in use by someone else is refused
  // -------------------------------------------------------------------
  console.log("\n--- TEST 8: A caller cannot reserve under another customer's reservationId ---");

  const hijackStoreId = `store_hijack_${Date.now()}`;
  await SlotTransactionService.getSlotRef(hijackStoreId, testSlotId).set({
    slotId: testSlotId,
    storeId: hijackStoreId,
    capacity: 30,
    confirmedWorkload: 0,
    confirmedOrders: 0,
    pending: [],
    updatedAt: Date.now()
  });

  await SlotTransactionService.reserveSlot({
    storeId: hijackStoreId,
    slotId: testSlotId,
    reservationId: 'res_belongs_to_dave',
    workload: 4,
    uid: 'dave',
    orderPayload: { items: [{ menuItemId: 'daves_lunch' }] }
  });

  const hijack = await SlotTransactionService.reserveSlot({
    storeId: hijackStoreId,
    slotId: testSlotId,
    reservationId: 'res_belongs_to_dave',
    workload: 1,
    uid: 'attacker',
    orderPayload: { items: [{ menuItemId: 'attackers_item' }] }
  });

  assert(hijack.success === false, "Reserving under another customer's reservationId is refused");
  assertEquals(hijack.reason, 'RESERVATION_ID_TAKEN', 'Refusal reason is RESERVATION_ID_TAKEN');

  const daveReservation = (await adminDb.collection('reservations').doc('res_belongs_to_dave').get()).data();
  assertEquals(daveReservation.uid, 'dave', 'The reservation still belongs to its holder');
  assertEquals(daveReservation.orderPayload.items[0].menuItemId, 'daves_lunch', "The holder's cart was not replaced");

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
