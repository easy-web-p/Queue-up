#!/usr/bin/env node
/**
 * Every Firestore collection the browser touches must have a rule.
 *
 * Four features had been written against collections with no rule at all:
 * creating a shop, submitting an evaluation, sending a pilot enquiry and
 * logging a search. The catch-all denied every one of those writes, each call
 * site caught the refusal and carried on, and all four reported success while
 * storing nothing. They looked like working features for months.
 *
 * A collection named in client code and absent from firestore.rules is that bug
 * again, so it fails here instead.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = 'src';
const RULES = 'firestore.rules';

/**
 * Collections the browser is allowed to write to directly. Everything else it
 * writes must go through the API, where the write is validated and the caller
 * finds out whether it was stored.
 *
 * Merely having a rule is not enough to be on this list: canteen_surveys has a
 * rule that denies writes, and a client write against it would be refused just
 * as silently as one with no rule at all.
 */
const CLIENT_WRITABLE = new Set([
  'chats',        // messages and typing presence, scoped by participant
  'notifications', // the recipient marking their own as read
  'user_devices',  // a device registering its own push token
  'users'          // a person editing their own profile
]);

/**
 * Collections that are deliberately server-only: client code may name them in a
 * type, a comment or a path string, but never reads or writes them directly.
 */
const SERVER_ONLY = new Set([
  'ledger_entries',
  'merchant_balances',
  'payout_requests',
  'refund_requests',
  'payment_exceptions',
  'payments',
  'payment_webhook_events',
  'idempotency_records',
  'evaluations',
  'pilot_leads',
  'school_applications'
]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const rules = readFileSync(RULES, 'utf8');
const ruled = new Set(
  [...rules.matchAll(/match\s+\/([a-zA-Z_][a-zA-Z0-9_]*)\//g)].map((m) => m[1])
);

// collection(db, 'name') / doc(db, 'name', ...) — a direct client access.
const ACCESS = /\b(?:collection|doc)\(\s*db\s*,\s*['"]([a-z_][a-z0-9_]*)['"]/g;
// The write calls, matched on the same line as the reference they act on.
const WRITE_CALL = /\b(?:setDoc|addDoc|updateDoc|deleteDoc|writeBatch)\s*\(/;

const unruled = new Map();
const writes = new Map();

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');

  for (const match of source.matchAll(ACCESS)) {
    const name = match[1];
    const line = source.slice(0, match.index).split('\n').length - 1;

    if (!ruled.has(name) && !SERVER_ONLY.has(name)) {
      if (!unruled.has(name)) unruled.set(name, new Set());
      unruled.get(name).add(file);
    }

    // A write is on the same line, or on one of the two before it — the shape
    // `await setDoc(\n  doc(db, 'x', id),` spreads across lines.
    const context = lines.slice(Math.max(0, line - 2), line + 1).join('\n');
    if (WRITE_CALL.test(context) && !CLIENT_WRITABLE.has(name)) {
      if (!writes.has(name)) writes.set(name, new Set());
      writes.get(name).add(`${file}:${line + 1}`);
    }
  }
}

let failed = false;

if (unruled.size > 0) {
  failed = true;
  console.error('❌ Client code touches collections with no rule in firestore.rules.');
  console.error('   The catch-all denies these, and a swallowed refusal looks exactly like success.\n');
  for (const [name, files] of unruled) console.error(`   ${name} — ${[...files].join(', ')}`);
  console.error('');
}

if (writes.size > 0) {
  failed = true;
  console.error('❌ Client code writes to collections it is not allowed to write to.');
  console.error('   Route the write through the API, where it is validated and its failure is reported.\n');
  for (const [name, places] of writes) console.error(`   ${name} — ${[...places].join(', ')}`);
  console.error('');
}

if (failed) {
  console.error('   Fix by adding a rule, routing through the API, or — when the access is');
  console.error('   genuinely allowed — listing the collection in scripts/check-client-collections.mjs.');
  process.exit(1);
}

console.log(
  `✅ Client Firestore access is accounted for: ${ruled.size} ruled collections, `
  + `${CLIENT_WRITABLE.size} writable from the browser, ${SERVER_ONLY.size} server-only.`
);
