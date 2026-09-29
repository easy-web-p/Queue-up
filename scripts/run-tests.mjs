#!/usr/bin/env node
/**
 * Runs every server suite, each against its own fresh local store.
 *
 * The suites used to chain with && and share one file-backed store, so every
 * suite inherited whatever earlier ones had written — and the file survived
 * between runs, growing to megabytes. Code that scans a whole collection then
 * behaved differently depending on what had run before it: the settlement sweep
 * started expiring unrelated orders, and rewriting the whole store on each write
 * stalled the event loop until a live connection reset mid-test.
 *
 * Isolating the store also makes the totals honest, which a chain of && could
 * never report: it stops at the first failure and says nothing about the rest.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SUITES = [
  'ledgerIntegrity',
  'capacityService',
  'capacityTransaction',
  'aiChatEngine',
  'aiIntentRouter',
  'aiLayer2',
  'chatRoutes',
  'authorization',
  'schoolRoutes',
  'customerWallet',
  'deployment',
  'payoutLifecycle',
  'orderCancellation',
  'paymentSettlement',
  'settlementSweeps',
  'platformOperations',
  'orderHandover',
  'chatIsolation',
  'identityTrust',
  'storeCreation',
  'evaluations'
];

// A suite on disk that nobody listed here would never run, and a test that never
// runs is worse than no test: it reads as coverage without being any.
const onDisk = readdirSync(path.join('server', 'tests'))
  .filter((file) => file.endsWith('.test.js'))
  .map((file) => file.replace(/\.test\.js$/, ''))
  // The rules suite needs the Firestore emulator, so it runs under npm run test:rules.
  .filter((name) => name !== 'firestoreRules');

const unlisted = onDisk.filter((name) => !SUITES.includes(name));
if (unlisted.length > 0) {
  console.error(
    `❌ These suites exist but are not listed in scripts/run-tests.mjs, so they never run: ${unlisted.join(', ')}`
  );
  process.exit(1);
}

const missing = SUITES.filter((name) => !onDisk.includes(name));
if (missing.length > 0) {
  console.error(`❌ Listed suites with no file: ${missing.join(', ')}`);
  process.exit(1);
}

const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const suites = only.length > 0 ? SUITES.filter((s) => only.includes(s)) : SUITES;
const keepGoing = process.argv.includes('--keep-going');

const storeDir = path.resolve('.test-db');
rmSync(storeDir, { recursive: true, force: true });
mkdirSync(storeDir, { recursive: true });

let totalPassed = 0;
let totalChecks = 0;
const failures = [];

for (const suite of suites) {
  const file = path.join('server', 'tests', `${suite}.test.js`);
  if (!existsSync(file)) {
    failures.push(`${suite} (no such suite)`);
    continue;
  }

  const result = spawnSync(process.execPath, [file], {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: {
      ...process.env,
      TZ: process.env.TZ || 'UTC',
      QUEUEUP_LOCAL_DB: path.join('.test-db', `${suite}.json`)
    }
  });

  const output = result.stdout?.toString() || '';
  process.stdout.write(output);

  const tally = output.match(/(\d+)\/(\d+) Passed/);
  if (tally) {
    totalPassed += Number(tally[1]);
    totalChecks += Number(tally[2]);
  }

  if (result.status !== 0) {
    failures.push(tally ? `${suite} (${tally[1]}/${tally[2]})` : `${suite} (crashed)`);
    if (!keepGoing) break;
  }
}

console.log('\n===============================================================');
console.log(`🧪 ${suites.length} suite(s) · ${totalPassed}/${totalChecks} checks passed`);
if (failures.length > 0) {
  console.log(`❌ FAILED: ${failures.join(', ')}`);
} else {
  console.log('✅ ALL SUITES PASSED');
}
console.log('===============================================================\n');

process.exit(failures.length > 0 ? 1 : 0);
