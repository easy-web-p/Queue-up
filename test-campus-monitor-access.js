/**
 * ============================================================================
 * CAMPUS QUEUE MONITOR ACCESS TEST SUITE
 * ============================================================================
 *
 * The campus-wide queue board is a StaffSupervisor tool. Three things have to
 * line up for it to work at all, and they are easy to break independently:
 *
 *   1. the route must be gated to staff/admin;
 *   2. firestore.rules must authorize the aggregate order query — a Firestore
 *      query is refused outright unless the rules permit every document it
 *      could return, so a board spanning all stalls cannot ride on the
 *      per-owner clauses that serve customers and merchants;
 *   3. staff must remain read-only — observing congestion must not let them
 *      advance another stall's orders.
 *
 * Also pins the board's PII boundary: a shared canteen screen shows queue
 * numbers, never customer names.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

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

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const read = (f) => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
const rules = read('firestore.rules');
const app = read('src/App.jsx');
const monitor = read('src/pages/CampusQueueMonitor.tsx');

/**
 * Extracts a TOP-LEVEL `match` block. Anchored on the 4-space indent because
 * `match /orders/{orderId}` also appears nested inside `match /shops/{shopId}`,
 * and that subcollection block is a different rule with different semantics.
 */
function topLevelRuleBlock(collectionPath) {
  const header = `\n    match /${collectionPath} {`;
  const start = rules.indexOf(header);
  assert(start !== -1, `top-level match /${collectionPath} not found`);
  const rest = rules.slice(start + 1);
  const end = rest.indexOf('\n    match /', 1);
  return end === -1 ? rest : rest.slice(0, end);
}

function allowStatement(block, action) {
  const start = block.indexOf(`allow ${action}:`);
  assert(start !== -1, `allow ${action} not found`);
  const rest = block.slice(start);
  const next = rest.indexOf('allow ', 6);
  return next === -1 ? rest : rest.slice(0, next);
}

console.log('\n📺 CAMPUS QUEUE MONITOR ACCESS TEST SUITE\n');

// ===========================================================================
console.log('1. Route is gated to StaffSupervisor / Admin');
// ===========================================================================

for (const route of ['/campus/monitor', '/campus/queue-monitor']) {
  runTest(`${route} requires staff_supervisor or admin`, () => {
    const line = app.split('\n').find((l) => l.includes(`path="${route}"`));
    assert(line, `route ${route} not found in App.jsx`);
    assert(line.includes('ProtectedRoute'), `${route} must be wrapped in ProtectedRoute`);
    assert(line.includes('staff_supervisor'), `${route} must allow staff_supervisor`);
    assert(line.includes('admin'), `${route} must allow admin`);
  });
}

runTest('The monitor is not reachable from an ungated route', () => {
  const lines = app.split('\n').filter((l) => l.includes('<CampusQueueMonitor'));
  assert(lines.length > 0, 'no CampusQueueMonitor route found');
  lines.forEach((l) => {
    assert(l.includes('ProtectedRoute'), `ungated CampusQueueMonitor route: ${l.trim()}`);
  });
});

// ===========================================================================
console.log('\n2. firestore.rules authorizes the aggregate query');
// ===========================================================================

const ordersBlock = topLevelRuleBlock('orders/{orderId}');

runTest('Staff supervisors may READ orders (without this the board loads nothing)', () => {
  const readRule = allowStatement(ordersBlock, 'read');
  assert(readRule.includes('isStaffSupervisor()'), 'orders read must admit staff supervisors');
});

runTest('Customers and store owners keep their existing read access', () => {
  const readRule = allowStatement(ordersBlock, 'read');
  assert(readRule.includes('resource.data.userId == request.auth.uid'), 'customer read must survive');
  assert(readRule.includes('isStoreOwner(resource.data.storeId)'), 'merchant read must survive');
});

runTest('🚨 Staff supervisors may NOT update orders', () => {
  // Monitoring congestion must not become the power to advance another stall's queue.
  const updateRule = allowStatement(ordersBlock, 'update');
  assert(
    !updateRule.includes('isStaffSupervisor()'),
    'staff must not be able to change order state'
  );
});

runTest('Client-side order creation stays blocked', () => {
  assert(
    allowStatement(ordersBlock, 'create').includes('if false'),
    'orders must remain server-authoritative'
  );
});

runTest('The board query is covered by a composite index', () => {
  // The board filters pickupDate == today AND status in [...]; without this index
  // the listener falls back to the unscoped query on every load.
  const indexes = JSON.parse(read('firestore.indexes.json'));
  const covered = indexes.indexes.some((idx) => {
    if (idx.collectionGroup !== 'orders') return false;
    const fields = idx.fields.map((f) => f.fieldPath);
    return fields.includes('pickupDate') && fields.includes('status');
  });
  assert(covered, 'orders(pickupDate, status) composite index expected');
});

// ===========================================================================
console.log('\n3. Listener lifecycle — no leak past unmount');
// ===========================================================================

runTest('Cleanup tears down BOTH the primary and the fallback listener', () => {
  // The fallback used to be opened inside the error callback with its unsubscribe
  // returned there, where nothing received it, so it outlived the component.
  const cleanup = monitor.slice(monitor.indexOf('return () => {'));
  assert(cleanup.includes('primaryUnsub'), 'cleanup must release the primary listener');
  assert(cleanup.includes('fallbackUnsub'), 'cleanup must release the fallback listener');
});

runTest('The fallback listener is captured, not discarded', () => {
  assert(
    /fallbackUnsub\s*=\s*onSnapshot\(/.test(monitor),
    'the fallback subscription must be assigned so cleanup can reach it'
  );
  assert(
    !/return onSnapshot\(/.test(monitor),
    'returning a subscription from an error callback discards its unsubscribe'
  );
});

runTest('The fallback is not opened after unmount, nor opened twice', () => {
  assert(
    monitor.includes('if (cancelled || fallbackUnsub) return;'),
    'a late error callback must not open a listener on a dead component'
  );
});

// ===========================================================================
console.log('\n4. PII boundary of a shared screen');
// ===========================================================================

runTest('🚨 The board does not render customer names', () => {
  const rendered = monitor.replace(/\/\/.*$/gm, ''); // ignore comments
  assert(!rendered.includes('customerName'), 'a shared canteen screen must not show names');
  assert(!rendered.includes('customerPhone'), 'a shared canteen screen must not show phones');
});

runTest('The board still identifies orders by queue number', () => {
  assert(monitor.includes('ord.queueNumber'), 'queue number is how a student finds their order');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
