/**
 * Ledger Integrity Suite
 *
 * A double-entry ledger is only worth having if it balances. This drives every
 * posting through a recording transaction and checks the one property that
 * makes the books trustworthy: within each transaction group, debits equal
 * credits.
 *
 * Two groups did not. Customer payments posted a GATEWAY_FEE_EXPENSE debit on
 * top of a fee already subtracted from the merchant's share, so every paid
 * order left the books over on the debit side by the gateway fee; refunds
 * dropped the gateway leg entirely and came out short by the same amount. The
 * service header claimed "debits equal credits for every transaction group"
 * the whole time, which is exactly why this is asserted rather than read.
 */

import {
  recordCustomerPayment,
  recordOrderFulfilled,
  recordFundsReleased,
  recordPayoutReserved,
  recordPayoutCompleted,
  recordRefund
} from '../services/ledgerService.js';
import { computeFeeBreakdown, resolveOrderBreakdown } from '../services/orderPricing.js';

console.log('===============================================================');
console.log('📒 QUEUEUP LEDGER INTEGRITY SUITE');
console.log('===============================================================');

let total = 0;
let passed = 0;

function check(condition, message, detail = '') {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}${detail ? ` (${detail})` : ''}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}${detail ? ` (${detail})` : ''}`);
    process.exitCode = 1;
  }
}

/**
 * Captures ledger writes without touching Firestore, so the postings can be
 * inspected directly.
 */
function recordingHarness() {
  const entries = [];
  const balanceDeltas = {};

  const collection = (name) => ({
    doc: (id) => ({ __collection: name, __id: id })
  });

  const transaction = {
    set(ref, data) {
      if (ref.__collection === 'ledger_entries') {
        entries.push(data);
      } else if (ref.__collection === 'merchant_balances') {
        for (const [key, value] of Object.entries(data)) {
          // FieldValue.increment carries its operand under a private field.
          const operand = value?.operand ?? value?._operand;
          if (typeof operand === 'number') {
            balanceDeltas[key] = (balanceDeltas[key] || 0) + operand;
          }
        }
      }
    },
    update() {},
    get: async () => ({ exists: false, data: () => ({}) })
  };

  return { entries, balanceDeltas, adminDb: { collection }, t: transaction };
}

/** Groups postings by transactionGroupId and compares the two sides. */
function groupImbalances(entries) {
  const groups = new Map();
  for (const e of entries) {
    const g = groups.get(e.transactionGroupId) || { debit: 0, credit: 0, accounts: [] };
    g.debit += Number(e.debitSatang) || 0;
    g.credit += Number(e.creditSatang) || 0;
    g.accounts.push(e.account);
    groups.set(e.transactionGroupId, g);
  }
  return Array.from(groups.entries())
    .map(([id, g]) => ({ id, ...g, diff: g.debit - g.credit }))
    .filter((g) => g.diff !== 0);
}

async function runTests() {
  // --- The fee split must always re-add to the total ---
  console.log('\n--- Fee arithmetic ---');
  const totals = [1, 7, 45, 99, 100, 4999, 25000, 123456, 999999];
  const broken = totals
    .map((t) => ({ t, b: computeFeeBreakdown(t) }))
    .filter(({ t, b }) => b.platformFeeSatang + b.gatewayFeeSatang + b.merchantNetSatang !== t);
  check(broken.length === 0,
    'total always equals platformFee + gatewayFee + merchantNet',
    broken.length ? JSON.stringify(broken[0]) : `${totals.length} amounts checked`);

  const tiny = computeFeeBreakdown(1);
  check(tiny.merchantNetSatang >= 0 && tiny.platformFeeSatang >= 0 && tiny.gatewayFeeSatang >= 0,
    'A one-satang order produces no negative component', JSON.stringify(tiny));

  const cash = computeFeeBreakdown(10000, { chargedByGateway: false });
  check(cash.gatewayFeeSatang === 0 && cash.merchantNetSatang + cash.platformFeeSatang === 10000,
    'Cash and wallet orders carry no gateway fee', JSON.stringify(cash));

  const drifted = resolveOrderBreakdown({
    totalSatang: 10000, platformFeeSatang: 1000,
    estimatedGatewayFeeSatang: 177, merchantNetSatang: 9999
  });
  check(drifted.platformFeeSatang + drifted.gatewayFeeSatang + drifted.merchantNetSatang === 10000,
    'A stored split that does not re-add is recomputed, not trusted',
    JSON.stringify(drifted));

  // --- Every posting type balances ---
  console.log('\n--- Every transaction group balances ---');
  const totalSatang = 25000;
  const { platformFeeSatang, gatewayFeeSatang, merchantNetSatang } = computeFeeBreakdown(totalSatang);
  const now = new Date().toISOString();
  const storeId = 'store-ledger';
  const orderId = 'ord-ledger-1';

  const payment = recordingHarness();
  await recordCustomerPayment(payment.t, payment.adminDb, {
    orderId, storeId, totalSatang, merchantNetSatang, platformFeeSatang, gatewayFeeSatang, now
  });
  let bad = groupImbalances(payment.entries);
  check(bad.length === 0, 'A customer payment balances',
    bad.length ? `off by ${bad[0].diff} satang` : `${payment.entries.length} postings`);
  check(payment.balanceDeltas.pendingSatang === merchantNetSatang,
    'It credits the merchant exactly their net share',
    `${payment.balanceDeltas.pendingSatang} satang`);

  const fulfilled = recordingHarness();
  await recordOrderFulfilled(fulfilled.t, fulfilled.adminDb, { orderId, storeId, merchantNetSatang, now });
  check(groupImbalances(fulfilled.entries).length === 0, 'Order fulfilment balances');

  const released = recordingHarness();
  await recordFundsReleased(released.t, released.adminDb, { orderId, storeId, merchantNetSatang, now });
  check(groupImbalances(released.entries).length === 0, 'A hold release balances');

  const reserved = recordingHarness();
  await recordPayoutReserved(reserved.t, reserved.adminDb, {
    payoutId: 'payout-1', storeId, amountSatang: merchantNetSatang, now
  });
  check(groupImbalances(reserved.entries).length === 0, 'A payout reservation balances');

  const completed = recordingHarness();
  await recordPayoutCompleted(completed.t, completed.adminDb, {
    payoutId: 'payout-1', storeId, amountSatang: merchantNetSatang, now
  });
  check(groupImbalances(completed.entries).length === 0, 'A completed payout balances');

  const refund = recordingHarness();
  await recordRefund(refund.t, refund.adminDb, {
    orderId, storeId, totalSatang, merchantNetSatang, platformFeeSatang, gatewayFeeSatang, now
  });
  bad = groupImbalances(refund.entries);
  check(bad.length === 0, 'A refund balances',
    bad.length ? `off by ${bad[0].diff} satang` : `${refund.entries.length} postings`);

  // --- A refund must fully reverse the payment it undoes ---
  console.log('\n--- A refund reverses its payment exactly ---');
  const netByAccount = {};
  for (const e of [...payment.entries, ...refund.entries]) {
    netByAccount[e.account] = (netByAccount[e.account] || 0)
      + (Number(e.debitSatang) || 0) - (Number(e.creditSatang) || 0);
  }
  const residue = Object.entries(netByAccount).filter(([, v]) => v !== 0);
  check(residue.length === 0,
    'Payment then refund leaves every account at zero',
    residue.length ? JSON.stringify(residue) : 'all accounts flat');

  check(payment.balanceDeltas.pendingSatang + refund.balanceDeltas.pendingSatang === 0,
    'The merchant\'s pending balance returns to where it started');

  // --- The full lifecycle moves money without losing any ---
  console.log('\n--- Full lifecycle, end to end ---');
  const lifecycle = recordingHarness();
  await recordCustomerPayment(lifecycle.t, lifecycle.adminDb, {
    orderId, storeId, totalSatang, merchantNetSatang, platformFeeSatang, gatewayFeeSatang, now
  });
  await recordOrderFulfilled(lifecycle.t, lifecycle.adminDb, { orderId, storeId, merchantNetSatang, now });
  await recordFundsReleased(lifecycle.t, lifecycle.adminDb, { orderId, storeId, merchantNetSatang, now });
  await recordPayoutReserved(lifecycle.t, lifecycle.adminDb, {
    payoutId: 'payout-2', storeId, amountSatang: merchantNetSatang, now
  });
  await recordPayoutCompleted(lifecycle.t, lifecycle.adminDb, {
    payoutId: 'payout-2', storeId, amountSatang: merchantNetSatang, now
  });

  bad = groupImbalances(lifecycle.entries);
  check(bad.length === 0, 'Every group in the lifecycle balances',
    bad.length ? `${bad.length} unbalanced` : `${lifecycle.entries.length} postings`);

  const d = lifecycle.balanceDeltas;
  check((d.pendingSatang || 0) === 0 && (d.onHoldSatang || 0) === 0
    && (d.availableSatang || 0) === 0 && (d.payoutReservedSatang || 0) === 0,
    'Money paid in and paid out leaves no balance stranded',
    JSON.stringify(d));
  check(d.totalPaidOutSatang === merchantNetSatang,
    'The merchant is paid out exactly their net share',
    `${d.totalPaidOutSatang} satang`);

  console.log('\n===============================================================');
  console.log(`📊 LEDGER INTEGRITY RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
  console.log('===============================================================\n');

  if (passed !== total) process.exit(1);
}

runTests().catch((err) => {
  console.error('❌ Ledger suite crashed:', err);
  process.exit(1);
});
