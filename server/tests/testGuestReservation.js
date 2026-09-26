/**
 * Test Guest and Authenticated Reservation on /api/capacity/reserve
 */

const SERVER_BASE = 'http://127.0.0.1:8080';

async function testGuest() {
  console.log('Testing guest reservation on /api/capacity/reserve...');

  const storeId = `store_test_guest_${Date.now()}`;
  const slotId = '2026-09-26_15-00';

  // 1. Guest request with NO headers at all (no auth, no token)
  const res = await fetch(`${SERVER_BASE}/api/capacity/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      storeId,
      scheduledSlotId: slotId,
      pickupType: 'SCHEDULED',
      customerId: 'guest_user_123',
      items: [{ quantity: 2 }]
    })
  });

  console.log(`Status: ${res.status}`);
  const data = await res.json();
  console.log('Response:', data);

  if (res.status === 200 && data.success) {
    console.log('✅ PASS: Guest reservation succeeded without Bearer token error!');
  } else {
    console.error('❌ FAIL: Guest reservation failed!', data);
    process.exit(1);
  }
}

testGuest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
