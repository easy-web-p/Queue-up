/**
 * Smart Pre-order & Dynamic Capacity v2.1
 * End-to-End HTTP API & Concurrency Verification
 * 
 * Verifies live Express server endpoints:
 * 1. GET  /api/capacity/:storeId/:date (Inspection API)
 * 2. POST /api/capacity/reserve (401 unauthenticated check)
 * 3. POST /api/capacity/reserve (200 authenticated reservation)
 * 4. POST /api/capacity/reserve (Idempotency key cache hit)
 * 5. POST /api/capacity/reserve (409 CAPACITY_FULL ceiling enforcement)
 * 6. POST /api/capacity/release (Capacity reclamation)
 * 7. POST /api/orders (Strict orderId = reservationId link & slot confirmation)
 */

const SERVER_BASE = 'http://127.0.0.1:8080';

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

async function runApiVerification() {
  console.log('===============================================================');
  console.log('🌐 CAPACITY SYSTEM END-TO-END HTTP API VERIFICATION');
  console.log(`📡 Target Server: ${SERVER_BASE}`);
  console.log('===============================================================\n');

  const testStoreId = `store_e2e_${Date.now()}`;
  const testDate = '2026-09-26';
  const testSlotId = '2026-09-26_14-00';
  const mockUserId = `user_e2e_${Date.now()}`;

  // -------------------------------------------------------------------
  // TEST 1: GET /api/capacity/:storeId/:date (Inspection API)
  // -------------------------------------------------------------------
  console.log('--- TEST 1: GET /api/capacity/:storeId/:date ---');
  const inspectRes = await fetch(`${SERVER_BASE}/api/capacity/${testStoreId}/${testDate}`);
  assertEquals(inspectRes.status, 200, 'GET /api/capacity returns 200 OK');
  
  const inspectData = await inspectRes.json();
  assertEquals(inspectData.storeId, testStoreId, 'Response contains requested storeId');
  assertEquals(inspectData.date, testDate, 'Response contains requested date');
  assert(Array.isArray(inspectData.slots) && inspectData.slots.length === 48, 'Inspection returns 48 15-min intervals (08:00 - 20:00)');

  const targetSlot = inspectData.slots.find(s => s.slotId === testSlotId);
  assert(targetSlot !== undefined, 'Target slot 14:00 is present in returned slots');
  assertEquals(targetSlot.status, 'AVAILABLE', 'Initial slot status is AVAILABLE');
  assertEquals(targetSlot.remainingWorkload, 30, 'Initial remaining workload is 30');

  // -------------------------------------------------------------------
  // TEST 2: POST /api/capacity/reserve (Validation Error Handling)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 2: POST /api/capacity/reserve (Validation Error Handling) ---');
  const invalidRes = await fetch(`${SERVER_BASE}/api/capacity/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scheduledSlotId: testSlotId,
      pickupType: 'SCHEDULED',
      items: [{ quantity: 2 }]
    })
  });
  assertEquals(invalidRes.status, 400, 'Missing storeId request rejected with 400');
  const invalidData = await invalidRes.json();
  assertEquals(invalidData.error, 'MISSING_STORE_ID', 'Error code is MISSING_STORE_ID');

  // -------------------------------------------------------------------
  // TEST 3: POST /api/capacity/reserve (Authenticated Successful Reservation)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 3: POST /api/capacity/reserve (Authenticated Reservation) ---');
  const customResId = `res_e2e_${Date.now()}`;
  const customIdempKey = `idemp_e2e_${Date.now()}`;

  const reserveRes = await fetch(`${SERVER_BASE}/api/capacity/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mock-user-id': mockUserId,
      'x-idempotency-key': customIdempKey
    },
    body: JSON.stringify({
      storeId: testStoreId,
      scheduledSlotId: testSlotId,
      reservationId: customResId,
      pickupType: 'SCHEDULED',
      items: [
        { menuItemId: 'menu_pad_thai', quantity: 3, workload: 2 } // 3 * 2 = 6 workload
      ]
    })
  });

  assertEquals(reserveRes.status, 200, 'Authenticated reservation returns 200 OK');
  const reserveData = await reserveRes.json();
  assert(reserveData.success === true, 'Reservation success is true');
  assertEquals(reserveData.reservationId, customResId, 'reservationId matches requested ID');
  assertEquals(reserveData.slotId, testSlotId, 'slotId matches target slot');
  assertEquals(reserveData.workload, 6, 'Workload is computed as 6 (3 * 2)');
  assertEquals(reserveData.remainingWorkload, 24, 'Remaining workload is 24 (30 - 6)');

  // -------------------------------------------------------------------
  // TEST 4: POST /api/capacity/reserve (Idempotency Key Check)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 4: POST /api/capacity/reserve (Idempotency Key Cache Hit) ---');
  const idempRes = await fetch(`${SERVER_BASE}/api/capacity/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mock-user-id': mockUserId,
      'x-idempotency-key': customIdempKey
    },
    body: JSON.stringify({
      storeId: testStoreId,
      scheduledSlotId: testSlotId,
      reservationId: customResId,
      pickupType: 'SCHEDULED',
      items: [{ quantity: 3, workload: 2 }]
    })
  });

  assertEquals(idempRes.status, 200, 'Duplicate reservation with same idempotency key returns 200 OK');
  const idempData = await idempRes.json();
  assertEquals(idempData.reservationId, customResId, 'Returns identical reservation ID without burning extra capacity');
  assertEquals(idempData.remainingWorkload, 24, 'Remaining workload is still 24 (not decremented twice)');

  // -------------------------------------------------------------------
  // TEST 5: POST /api/capacity/reserve (Capacity Exceeded / 409 CAPACITY_FULL)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 5: POST /api/capacity/reserve (Capacity Exceeded Enforcement) ---');
  // Attempt to reserve workload of 26 when only 24 remains
  const exceedRes = await fetch(`${SERVER_BASE}/api/capacity/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mock-user-id': mockUserId
    },
    body: JSON.stringify({
      storeId: testStoreId,
      scheduledSlotId: testSlotId,
      pickupType: 'SCHEDULED',
      items: [{ quantity: 26, workload: 1 }] // 26 workload > 24 remaining
    })
  });

  assertEquals(exceedRes.status, 409, 'Excess reservation rejected with 409 Conflict');
  const exceedData = await exceedRes.json();
  assertEquals(exceedData.error, 'CAPACITY_FULL', 'Error code is CAPACITY_FULL');
  assertEquals(exceedData.code, 'CAPACITY_FULL', 'Code field is CAPACITY_FULL');
  assertEquals(exceedData.remainingWorkload, 24, 'Reports current remaining workload of 24');

  // -------------------------------------------------------------------
  // TEST 6: POST /api/orders (Strict orderId = reservationId Integration)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 6: POST /api/orders (orderId = reservationId & Confirmation) ---');
  const orderRes = await fetch(`${SERVER_BASE}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-mock-user-id': mockUserId
    },
    body: JSON.stringify({
      storeId: testStoreId,
      reservationId: customResId,
      slotId: testSlotId,
      workload: 6,
      paymentMethod: 'promptpay',
      items: [
        { menuItemId: 'menu_pad_thai', name: 'ผัดไทย', quantity: 3, unitPrice: 50 }
      ]
    })
  });

  assertEquals(orderRes.status, 201, 'Order creation with reservationId returns 201 Created');
  const orderData = await orderRes.json();
  assertEquals(orderData.orderId, customResId, 'orderId strictly equals reservationId');

  // Verify Slot state after order creation: pending is converted to confirmedWorkload
  const inspectAfterOrder = await fetch(`${SERVER_BASE}/api/capacity/${testStoreId}/${testDate}`);
  const slotAfterOrder = (await inspectAfterOrder.json()).slots.find(s => s.slotId === testSlotId);
  assertEquals(slotAfterOrder.confirmedWorkload, 6, 'Slot confirmedWorkload is 6');
  assertEquals(slotAfterOrder.pendingWorkload, 0, 'Slot pendingWorkload is now 0');
  assertEquals(slotAfterOrder.remainingWorkload, 24, 'Slot remainingWorkload remains 24');

  // -------------------------------------------------------------------
  // TEST 7: PATCH /api/orders/:id/status (Cancellation & Capacity Reclamation)
  // -------------------------------------------------------------------
  console.log('\n--- TEST 7: Order Cancellation Releases Capacity ---');
  const cancelRes = await fetch(`${SERVER_BASE}/api/orders/${customResId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-mock-user-id': mockUserId
    },
    body: JSON.stringify({
      status: 'CANCELLED',
      note: 'User canceled order'
    })
  });

  assertEquals(cancelRes.status, 200, 'Order cancellation returns 200 OK');

  // Verify Slot state after cancellation: confirmedWorkload decremented back to 0
  const inspectAfterCancel = await fetch(`${SERVER_BASE}/api/capacity/${testStoreId}/${testDate}`);
  const slotAfterCancel = (await inspectAfterCancel.json()).slots.find(s => s.slotId === testSlotId);
  assertEquals(slotAfterCancel.confirmedWorkload, 0, 'Slot confirmedWorkload restored to 0 after cancellation');
  assertEquals(slotAfterCancel.remainingWorkload, 30, 'Slot remainingWorkload restored to full capacity 30');

  console.log('\n===============================================================');
  console.log(`📊 E2E API TEST RESULTS: ${passedTests}/${totalTests} Passed (${passedTests === totalTests ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
  console.log('===============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runApiVerification().catch(err => {
  console.error('Unhandled failure in E2E API verification:', err);
  process.exit(1);
});
