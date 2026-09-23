/**
 * ============================================================================
 * CANCEL & REFUND TEST SUITE
 * ============================================================================
 *
 * Money could enter this system and be spent, and never come back.
 *
 * `createOrderAuthoritative` debits `wallets/{studentId}.balanceSatang` inside
 * the order transaction. Cancelling was a plain client-side write of
 * `status: 'CANCELLED'` — the rules allowed it for the customer before the
 * kitchen started, and for the stall at any point — and nothing anywhere
 * credited the wallet back. It could not have: `wallets` is closed to browsers,
 * correctly. `WalletTransaction.type` has listed `'REFUND'` since the beginning
 * and no code ever wrote one.
 *
 * So a stall that ran out of an ingredient cancelled the order, and the student
 * had paid for nothing. On a system where a parent tops up a child's wallet,
 * that is the worst thing in the app.
 *
 * Meanwhile the PDPA page carries a "นโยบายการคืนเงินและยกเลิกคำสั่งซื้อ"
 * section promising cancellation before the kitchen starts — and no screen in
 * the app had a cancel button at all.
 */

import { readFileSync } from 'node:fs';
import {
  CANCEL_ACTOR,
  CANCELLABLE_STATUSES,
  CUSTOMER_CANCELLABLE_STATUSES,
  REFUND_REFUSAL,
  checkCancellable,
  computeRefund,
  refundTargetStudentId,
} from './functions/refundRules.js';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}\n       ${err.message}`);
  }
}

const assert = (c, m) => { if (!c) throw new Error(m); };
const assertEqual = (a, e, m) => {
  if (a !== e) throw new Error(`${m}\n       expected: ${e}\n       actual:   ${a}`);
};

const read = (rel) => readFileSync(new URL(`./${rel}`, import.meta.url), 'utf8');
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const order = (over = {}) => ({
  status: 'CONFIRMED',
  paymentMode: 'CAMPUS_WALLET',
  paymentStatus: 'PAID',
  studentId: 'STU1',
  totalAmountSatang: 10000,
  finalAmountSatang: 5000,
  ...over,
});

console.log('\n🕒 Who may cancel, and when');

runTest('🚨 A customer cannot cancel once the kitchen has started', () => {
  // The stall is the one who knows whether it can still be stopped, and the one
  // absorbing the loss.
  for (const status of ['PREPARING', 'READY']) {
    const r = checkCancellable(order({ status }), CANCEL_ACTOR.CUSTOMER);
    assert(!r.ok, `a customer cancelled a ${status} order`);
    assertEqual(r.code, REFUND_REFUSAL.TOO_LATE_FOR_CUSTOMER, 'wrong refusal');
  }
  for (const status of CUSTOMER_CANCELLABLE_STATUSES) {
    assert(checkCancellable(order({ status }), CANCEL_ACTOR.CUSTOMER).ok, `${status} must be cancellable`);
  }
});

runTest('The stall and the school can cancel later than the customer', () => {
  for (const actor of [CANCEL_ACTOR.STORE, CANCEL_ACTOR.ADMIN]) {
    for (const status of CANCELLABLE_STATUSES) {
      assert(checkCancellable(order({ status }), actor).ok, `${actor} cannot cancel a ${status} order`);
    }
  }
});

runTest('🚨 A collected order cannot be cancelled by anyone', () => {
  for (const actor of Object.values(CANCEL_ACTOR)) {
    const r = checkCancellable(order({ status: 'COMPLETED' }), actor);
    assert(!r.ok, `${actor} cancelled an order that was already collected`);
    assertEqual(r.code, REFUND_REFUSAL.ALREADY_COMPLETED, 'wrong refusal');
  }
});

runTest('🚨 An order already cancelled is refused, not cancelled twice', () => {
  const r = checkCancellable(order({ status: 'CANCELLED' }), CANCEL_ACTOR.STORE);
  assert(!r.ok, 'a second cancellation was allowed');
  assertEqual(r.code, REFUND_REFUSAL.ALREADY_CANCELLED, 'wrong refusal');
});

runTest('A missing order is refused rather than assumed', () => {
  const r = checkCancellable(null, CANCEL_ACTOR.ADMIN);
  assert(!r.ok, 'a null order was cancellable');
  assertEqual(r.code, REFUND_REFUSAL.ORDER_NOT_FOUND, 'wrong refusal');
});

console.log('\n💰 How much comes back');

runTest('🚨 The refund is what was charged, not the subtotal', () => {
  // finalAmountSatang is after the coupon. Refunding totalAmountSatang would
  // hand back a ฿50 discount as cash on a ฿50 payment.
  const { refundSatang } = computeRefund(order({ totalAmountSatang: 10000, finalAmountSatang: 5000 }));
  assertEqual(refundSatang, 5000, 'the discount was refunded as cash');
});

runTest('🚨 A counter-paid order refunds nothing', () => {
  // The app never held that money.
  const r = computeRefund(order({ paymentMode: 'DIRECT_ZERO_PAYMENT' }));
  assertEqual(r.refundSatang, 0, 'the app paid out money it never took');
  assertEqual(r.reason, 'NOT_WALLET_PAID', 'wrong reason');
});

runTest('🚨 An order already refunded refunds nothing again', () => {
  // The record lives on the order, so a retried request cannot pay twice.
  const r = computeRefund(order({ refundedSatang: 5000 }));
  assertEqual(r.refundSatang, 0, 'a retry paid a second refund');
  assertEqual(r.reason, 'ALREADY_REFUNDED', 'wrong reason');
});

runTest('An unpaid order refunds nothing', () => {
  assertEqual(computeRefund(order({ paymentStatus: 'PENDING' })).refundSatang, 0, 'unpaid');
  assertEqual(computeRefund(order({ finalAmountSatang: 0 })).refundSatang, 0, 'zero charge');
  assertEqual(computeRefund(order({ finalAmountSatang: 'x' })).refundSatang, 0, 'malformed charge');
  assertEqual(computeRefund(null).refundSatang, 0, 'missing order');
});

runTest('🚨 The money goes back to the student, not the caller', () => {
  // A guardian may have placed the order; the wallet debited was the child's.
  assertEqual(refundTargetStudentId(order({ studentId: 'STU9' })), 'STU9', 'wrong wallet');
  assertEqual(refundTargetStudentId(order({ studentId: '' })), null, 'an empty id is not a wallet');
  assertEqual(refundTargetStudentId(null), null, 'a missing order names a wallet');
});

console.log('\n🔒 A browser cannot cancel a paid order');

const rules = read('firestore.rules');

runTest('🚨 A customer cannot client-cancel a wallet-paid order', () => {
  // This path cancelled the food and kept the money, every time.
  const at = rules.indexOf('resource.data.userId == request.auth.uid &&');
  assert(at > 0, 'the customer cancel clause is gone');
  const clause = rules.slice(at, rules.indexOf('))', at));
  assert(
    clause.includes("resource.data.get('paymentMode', '') != 'CAMPUS_WALLET'"),
    'a customer can still cancel a wallet-paid order from the browser'
  );
});

runTest('🚨 A stall cannot client-cancel a wallet-paid order either', () => {
  // Read with comments stripped: the guard sits under an explanatory block, so
  // a raw slice starts in prose rather than at the expression.
  const live = stripComments(rules);
  const at = live.indexOf('isStoreOwner(resource.data.storeId))) &&');
  assert(at > 0, 'the merchant update clause is gone');
  const clause = live.slice(at, at + 400);
  const guard =
    "!(resource.data.get('paymentMode', '') == 'CAMPUS_WALLET' && " +
    "request.resource.data.status == 'CANCELLED')";
  // The leading `!` is the whole point: without it the clause REQUIRES that a
  // cancellation be of a wallet-paid order, which is the opposite rule.
  assert(clause.includes(guard), 'a stall can still cancel a wallet-paid order from the browser');
});

runTest('Everything else on the board still works from the browser', () => {
  // The point is not to move the whole kitchen server-side; it is that a refund
  // is not a status change.
  const at = rules.indexOf("hasOnly(['queueStatus', 'status'");
  assert(at > 0, 'the merchant status-change path is gone');
  assert(rules.includes('isValidOrderStateTransition('), 'the state machine is gone');
});

console.log('\n🖥️  The server does it, in one transaction');

const live = stripComments(read('functions/index.js'));
const fn = (() => {
  const at = live.indexOf('export const cancelOrderWithRefund');
  if (at < 0) throw new Error('cancelOrderWithRefund does not exist');
  return live.slice(at, live.indexOf('\nexport const', at + 10));
})();

runTest('🚨 The cancellation and the refund are one transaction', () => {
  // Separately, a crash between them either cancels the food without returning
  // the money — the bug this replaces — or returns money on an order still
  // being cooked.
  assert(fn.includes('runTransaction'), 'the two writes are not atomic');
  const txAt = fn.indexOf('runTransaction');
  assert(fn.indexOf('tx.update(orderRef') > txAt, 'the status change is outside the transaction');
  assert(fn.indexOf('balanceSatang: newBal') > txAt, 'the refund is outside the transaction');
});

runTest('🚨 A REFUND ledger row is written with the money', () => {
  // The type existed and nothing ever wrote one, so a refund left no trace a
  // parent could see.
  assert(fn.includes('type: "REFUND"'), 'no ledger row records the refund');
  assert(fn.includes('wallet_transactions'), 'the ledger is not written at all');
  assert(fn.includes('ORDER_CANCELLED_REFUNDED'), 'the refund is not audited');
});

runTest('🚨 The spend counters move back too', () => {
  // Without this a cancelled order still counts against the child's daily
  // limit: they are told they have spent money that was returned.
  //
  // Read the wallet write itself, not the whole function: `spentTodaySatang`
  // appears in the *read* of the current counter too, so a `fn.includes` here
  // passes with the write deleted.
  const at = fn.indexOf('tx.set(');
  assert(at > 0, 'the wallet is never written');
  const walletWrite = fn.slice(at, fn.indexOf('{ merge: true }', at));

  for (const counter of ['spentTodaySatang', 'spentThisWeekSatang']) {
    const written = walletWrite.match(new RegExp(`${counter}:\\s*(\\w+)`));
    assert(written, `${counter} is not written back to the wallet`);
    const decl = fn.match(new RegExp(`const\\s+${written[1]}\\s*=([\\s\\S]*?);\\n`));
    assert(decl, `${counter} is written from ${written[1]}, which is never computed`);
    assert(decl[1].includes('- refundSatang'), `${counter} is not reduced by the refund`);
    assert(/Math\.max\(\s*0,/.test(decl[1]), `${counter} could be driven negative`);
  }

  const balance = walletWrite.match(/balanceSatang:\s*(\w+)/);
  assert(balance, 'the balance is never credited');
  const balDecl = fn.match(new RegExp(`const\\s+${balance[1]}\\s*=([^;]*);`));
  assert(balDecl && balDecl[1].includes('+ refundSatang'), 'the balance is not credited by the refund');
});

runTest('🚨 Only the customer, the stall or an admin may cancel', () => {
  assert(fn.includes('CANCEL_ACTOR.CUSTOMER'), 'the customer is never recognised');
  assert(fn.includes('ownerUid === uid'), 'stall ownership is never checked');
  assert(fn.includes('isCallerAdmin('), 'admin is never recognised');
  assert(fn.includes('permission-denied'), 'a stranger is not refused');

  const denyAt = fn.indexOf('permission-denied');
  const txAt = fn.indexOf('runTransaction');
  assert(denyAt < txAt, 'authority is checked after the money moves');
});

runTest('🚨 The refusal is evaluated inside the transaction', () => {
  // Checked outside it, two simultaneous cancellations both see a live order
  // and both refund.
  const txAt = fn.indexOf('runTransaction');
  const checkAt = fn.indexOf('checkCancellable(');
  assert(checkAt > txAt, 'the cancellable check is outside the transaction');
  assert(fn.indexOf('computeRefund(') > txAt, 'the refund amount is computed outside it');
});

runTest('The refund amount is recorded on the order', () => {
  assert(fn.includes('refundedSatang: refundSatang'), 'nothing marks the order as refunded');
});

console.log('\n🖥️  Both screens have the button the policy promised');

runTest('🚨 A customer can cancel their own order', () => {
  const profile = stripComments(read('src/pages/UserProfile.jsx'));
  assert(profile.includes('cancelOrderWithRefund('), 'there is still no cancel button');
  assert(profile.includes('CUSTOMER_CANCELLABLE'), 'the button shows on orders that cannot be cancelled');
  assert(profile.includes('toast.confirm'), 'an order is cancelled with no confirmation');
  assert(profile.includes('toast.error('), 'a refusal never reaches the customer');
});

runTest('🚨 The merchant cancel goes through the refund, not a status write', () => {
  const dash = stripComments(read('src/pages/MerchantDashboard.jsx'));
  const at = dash.indexOf("if (status === 'CANCELLED')");
  assert(at > 0, 'the cancel is no longer separated from an ordinary status change');
  // Sliced to the closing `return;` of the branch, not to the next `try {` —
  // the branch has a try of its own, so that cut landed before the call.
  const body = dash.slice(at, dash.indexOf('\n    }', at));
  assert(body.includes('cancelOrderWithRefund('), 'the merchant cancel still writes the status itself');
  assert(body.includes('return;'), 'it falls through to the direct status write as well');
  assert(
    !/updateDoc\(doc\(db, "orders", orderId\)/.test(body),
    'the branch still writes the order document directly'
  );
});

runTest('The policy the app has always shown is now true', () => {
  const pdpa = read('src/pages/PdpaPolicy.jsx');
  assert(
    pdpa.includes('การยกเลิกออเดอร์'),
    'the cancellation policy is gone — it should be kept, now that it is honoured'
  );
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
