import { FieldValue } from 'firebase-admin/firestore';

/**
 * Double-Entry Financial Ledger Service for QueueUp Marketplace
 * Ensures debits equal credits for every transaction group.
 * All amounts are in Satang (integer).
 */

function generateEntryId() {
  return `led_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Helper to update merchant balance within transaction
 */
function updateBalance(t, adminDb, storeId, deltaFields, now) {
  const balanceRef = adminDb.collection('merchant_balances').doc(storeId);
  const increments = {};

  for (const [key, val] of Object.entries(deltaFields)) {
    if (val !== 0) {
      increments[key] = FieldValue.increment(val);
    }
  }

  t.set(balanceRef, {
    storeId,
    ...increments,
    updatedAt: now
  }, { merge: true });
}

/**
 * 1. Record Customer Payment
 * Debit:  PLATFORM_CASH    (totalSatang)
 * Credit: MERCHANT_PENDING (merchantNetSatang)
 * Credit: PLATFORM_REVENUE (platformFeeSatang)
 * Credit: PAYMENT_CLEARING (gatewayFeeSatang)
 *
 * Balances because total === merchantNet + platformFee + gatewayFee, the
 * invariant computeFeeBreakdown() guarantees.
 */
export async function recordCustomerPayment(t, adminDb, {
  orderId,
  storeId,
  totalSatang,
  merchantNetSatang,
  platformFeeSatang,
  gatewayFeeSatang = 0,
  now = new Date().toISOString()
}) {
  const transactionGroupId = `txg_pay_${orderId}_${Date.now()}`;

  const entries = [
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'PLATFORM_CASH',
      debitSatang: totalSatang,
      creditSatang: 0,
      type: 'CUSTOMER_PAYMENT',
      description: `Payment received for order ${orderId}`,
      createdAt: now
    },
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'MERCHANT_PENDING',
      debitSatang: 0,
      creditSatang: merchantNetSatang,
      type: 'CUSTOMER_PAYMENT',
      description: `Merchant pending settlement for order ${orderId}`,
      createdAt: now
    },
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'PLATFORM_REVENUE',
      debitSatang: 0,
      creditSatang: platformFeeSatang,
      type: 'CUSTOMER_PAYMENT',
      description: `Platform fee for order ${orderId}`,
      createdAt: now
    }
  ];

  // The gateway fee is borne by the merchant: it is already subtracted from
  // merchantNetSatang. The platform therefore holds the full total in cash and
  // owes three parties — the merchant, itself, and the gateway. Posting a
  // GATEWAY_FEE_EXPENSE debit as well counted the fee twice and left every
  // payment group out of balance by exactly that amount.
  if (gatewayFeeSatang > 0) {
    entries.push({
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'PAYMENT_CLEARING',
      debitSatang: 0,
      creditSatang: gatewayFeeSatang,
      type: 'CUSTOMER_PAYMENT',
      description: `Payment gateway fee owed for order ${orderId}`,
      createdAt: now
    });
  }

  for (const entry of entries) {
    const entryRef = adminDb.collection('ledger_entries').doc(entry.id);
    t.set(entryRef, entry);
  }

  // Credit merchant pending balance
  updateBalance(t, adminDb, storeId, { pendingSatang: merchantNetSatang }, now);

  return transactionGroupId;
}

/**
 * 2. Record Order Fulfilled (Customer picked up food)
 * Moves funds from MERCHANT_PENDING -> MERCHANT_ON_HOLD
 */
export async function recordOrderFulfilled(t, adminDb, {
  orderId,
  storeId,
  merchantNetSatang,
  now = new Date().toISOString()
}) {
  const transactionGroupId = `txg_fulfill_${orderId}_${Date.now()}`;

  const entries = [
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'MERCHANT_PENDING',
      debitSatang: merchantNetSatang,
      creditSatang: 0,
      type: 'ORDER_FULFILLED',
      description: `Order ${orderId} picked up, moving to hold verification`,
      createdAt: now
    },
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'MERCHANT_ON_HOLD',
      debitSatang: 0,
      creditSatang: merchantNetSatang,
      type: 'ORDER_FULFILLED',
      description: `Hold reserve for order ${orderId}`,
      createdAt: now
    }
  ];

  for (const entry of entries) {
    t.set(adminDb.collection('ledger_entries').doc(entry.id), entry);
  }

  // Update merchant balance: -pending, +onHold
  updateBalance(t, adminDb, storeId, {
    pendingSatang: -merchantNetSatang,
    onHoldSatang: merchantNetSatang
  }, now);

  return transactionGroupId;
}

/**
 * 3. Record Funds Released (Hold duration expired)
 * Moves funds from MERCHANT_ON_HOLD -> MERCHANT_AVAILABLE
 */
export async function recordFundsReleased(t, adminDb, {
  orderId,
  storeId,
  merchantNetSatang,
  now = new Date().toISOString()
}) {
  const transactionGroupId = `txg_rel_${orderId}_${Date.now()}`;

  const entries = [
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'MERCHANT_ON_HOLD',
      debitSatang: merchantNetSatang,
      creditSatang: 0,
      type: 'FUNDS_RELEASED',
      description: `Hold passed for order ${orderId}, funds available for payout`,
      createdAt: now
    },
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'MERCHANT_AVAILABLE',
      debitSatang: 0,
      creditSatang: merchantNetSatang,
      type: 'FUNDS_RELEASED',
      description: `Available balance for order ${orderId}`,
      createdAt: now
    }
  ];

  for (const entry of entries) {
    t.set(adminDb.collection('ledger_entries').doc(entry.id), entry);
  }

  // Update merchant balance: -onHold, +available
  updateBalance(t, adminDb, storeId, {
    onHoldSatang: -merchantNetSatang,
    availableSatang: merchantNetSatang
  }, now);

  return transactionGroupId;
}

/**
 * 4. Record Payout Reserved (Merchant requested payout)
 * Moves funds from MERCHANT_AVAILABLE -> MERCHANT_PAYOUT_RESERVE
 */
export async function recordPayoutReserved(t, adminDb, {
  payoutId,
  storeId,
  amountSatang,
  now = new Date().toISOString()
}) {
  const transactionGroupId = `txg_payout_res_${payoutId}_${Date.now()}`;

  const entries = [
    {
      id: generateEntryId(),
      transactionGroupId,
      payoutId,
      storeId,
      account: 'MERCHANT_AVAILABLE',
      debitSatang: amountSatang,
      creditSatang: 0,
      type: 'PAYOUT_RESERVE',
      description: `Reserve for payout request ${payoutId}`,
      createdAt: now
    },
    {
      id: generateEntryId(),
      transactionGroupId,
      payoutId,
      storeId,
      account: 'MERCHANT_PAYOUT_RESERVE',
      debitSatang: 0,
      creditSatang: amountSatang,
      type: 'PAYOUT_RESERVE',
      description: `Reserved payout balance for ${payoutId}`,
      createdAt: now
    }
  ];

  for (const entry of entries) {
    t.set(adminDb.collection('ledger_entries').doc(entry.id), entry);
  }

  // Update merchant balance: -available, +payoutReserved
  updateBalance(t, adminDb, storeId, {
    availableSatang: -amountSatang,
    payoutReservedSatang: amountSatang
  }, now);

  return transactionGroupId;
}

/**
 * 5. Record Payout Completed (Stripe Transfer / Payout paid out)
 * Moves funds from MERCHANT_PAYOUT_RESERVE -> PLATFORM_CASH
 */
export async function recordPayoutCompleted(t, adminDb, {
  payoutId,
  storeId,
  amountSatang,
  now = new Date().toISOString()
}) {
  const transactionGroupId = `txg_payout_comp_${payoutId}_${Date.now()}`;

  const entries = [
    {
      id: generateEntryId(),
      transactionGroupId,
      payoutId,
      storeId,
      account: 'MERCHANT_PAYOUT_RESERVE',
      debitSatang: amountSatang,
      creditSatang: 0,
      type: 'PAYOUT_COMPLETED',
      description: `Payout ${payoutId} dispatched to merchant bank`,
      createdAt: now
    },
    {
      id: generateEntryId(),
      transactionGroupId,
      payoutId,
      storeId,
      account: 'PLATFORM_CASH',
      debitSatang: 0,
      creditSatang: amountSatang,
      type: 'PAYOUT_COMPLETED',
      description: `Cash outflow for payout ${payoutId}`,
      createdAt: now
    }
  ];

  for (const entry of entries) {
    t.set(adminDb.collection('ledger_entries').doc(entry.id), entry);
  }

  // Update merchant balance: -payoutReserved, +totalPaidOut
  updateBalance(t, adminDb, storeId, {
    payoutReservedSatang: -amountSatang,
    totalPaidOutSatang: amountSatang
  }, now);

  return transactionGroupId;
}

/**
 * 5b. Record Payout Failed / Cancelled
 * Reverses a reservation: MERCHANT_PAYOUT_RESERVE -> MERCHANT_AVAILABLE.
 *
 * Without this, a payout that never completes leaves the merchant's money
 * reserved forever — neither paid out nor withdrawable again.
 */
export async function recordPayoutFailed(t, adminDb, {
  payoutId,
  storeId,
  amountSatang,
  reason = '',
  now = new Date().toISOString()
}) {
  const transactionGroupId = `txg_payout_failed_${payoutId}_${Date.now()}`;

  const entries = [
    {
      id: generateEntryId(),
      transactionGroupId,
      payoutId,
      storeId,
      account: 'MERCHANT_PAYOUT_RESERVE',
      debitSatang: amountSatang,
      creditSatang: 0,
      type: 'PAYOUT_FAILED',
      description: `Payout ${payoutId} released back to available${reason ? `: ${reason}` : ''}`,
      createdAt: now
    },
    {
      id: generateEntryId(),
      transactionGroupId,
      payoutId,
      storeId,
      account: 'MERCHANT_AVAILABLE',
      debitSatang: 0,
      creditSatang: amountSatang,
      type: 'PAYOUT_FAILED',
      description: `Funds returned to available balance for payout ${payoutId}`,
      createdAt: now
    }
  ];

  for (const entry of entries) {
    t.set(adminDb.collection('ledger_entries').doc(entry.id), entry);
  }

  updateBalance(t, adminDb, storeId, {
    payoutReservedSatang: -amountSatang,
    availableSatang: amountSatang
  }, now);

  return transactionGroupId;
}

/**
 * 6. Record Refund (Order rejected or cancelled)
 * Reverses customer payment
 */
export async function recordRefund(t, adminDb, {
  orderId,
  storeId,
  totalSatang,
  merchantNetSatang,
  platformFeeSatang,
  gatewayFeeSatang = 0,
  now = new Date().toISOString()
}) {
  const transactionGroupId = `txg_refund_${orderId}_${Date.now()}`;

  const entries = [
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'MERCHANT_PENDING',
      debitSatang: merchantNetSatang,
      creditSatang: 0,
      type: 'REFUND',
      description: `Reverse merchant pending for refunded order ${orderId}`,
      createdAt: now
    },
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'PLATFORM_REVENUE',
      debitSatang: platformFeeSatang,
      creditSatang: 0,
      type: 'REFUND',
      description: `Reverse platform fee for refunded order ${orderId}`,
      createdAt: now
    },
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'PAYMENT_CLEARING',
      debitSatang: gatewayFeeSatang,
      creditSatang: 0,
      type: 'REFUND',
      description: `Reverse gateway fee owed for order ${orderId}`,
      createdAt: now
    },
    {
      id: generateEntryId(),
      transactionGroupId,
      orderId,
      storeId,
      account: 'PLATFORM_CASH',
      debitSatang: 0,
      creditSatang: totalSatang,
      type: 'REFUND',
      description: `Refund cash outflow to customer for order ${orderId}`,
      createdAt: now
    }
  ];

  for (const entry of entries) {
    t.set(adminDb.collection('ledger_entries').doc(entry.id), entry);
  }

  // Decrement merchant pending balance
  updateBalance(t, adminDb, storeId, { pendingSatang: -merchantNetSatang }, now);

  return transactionGroupId;
}
