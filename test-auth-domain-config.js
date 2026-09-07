/**
 * ============================================================================
 * AUTH HANDLER ORIGIN TEST SUITE
 * ============================================================================
 *
 * Google sign-in on iPad Safari died with auth/missing-initial-state: Safari
 * partitions storage per origin, and the popup landed on
 * queueup-65e82.firebaseapp.com/__/auth/handler, which could not read the state the
 * app had written before opening it. The user was left looking at a bare Firebase
 * error page in an orphaned tab.
 *
 * Claiming a custom origin instead turned out to trade that for a worse failure:
 * Google rejects a redirect_uri it has not been told about, with
 * "Error 400: redirect_uri_mismatch" and no fallback. So authDomain now only takes
 * the app's own origin on *.firebaseapp.com and *.web.app, which are same-origin AND
 * already registered with Google, and falls back to the project's Firebase domain
 * everywhere else — where the redirect fallback in AuthContext carries sign-in
 * through instead.
 *
 * The rule lives in firebase/authDomain.js so these tests can call it. They used to
 * assert the text of config.js, which let a change that stopped consulting a constant
 * pass unnoticed: the declaration survived, the behaviour did not.
 */

import fs from 'node:fs';
import { resolveAuthDomainForHost, DEFAULT_AUTH_DOMAIN } from './src/firebase/authDomain.js';
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

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n       expected: ${expected}\n       actual:   ${actual}`);
  }
}

const read = (f) => fs.readFileSync(path.resolve(process.cwd(), f), 'utf8');
const vercel = JSON.parse(read('vercel.json'));
const config = read('src/firebase/config.js');

console.log('\n🔑 AUTH HANDLER ORIGIN TEST SUITE\n');

// ===========================================================================
console.log('1. The auth handler is proxied onto the app origin');
// ===========================================================================

// The proxy is not currently load-bearing: authDomain resolves to the Firebase
// domain everywhere except firebaseapp.com/web.app, which serve the handler
// themselves. It is kept because it is one of the two things a custom authDomain
// needs — the other being the redirect URI registered in Google Cloud Console.
runTest('vercel.json still carries the /__/auth proxy a custom domain would need', () => {
  const rule = (vercel.rewrites || []).find((r) => r.source.startsWith('/__/auth'));
  assert(rule, '/__/auth rewrite is missing — Google sign-in breaks on Safari');
  assert(
    /^https:\/\/[\w-]+\.firebaseapp\.com\/__\/auth\//.test(rule.destination),
    `unexpected destination: ${rule.destination}`
  );
});

runTest('🚨 The proxy is matched BEFORE the SPA catch-all', () => {
  // Vercel applies rewrites in order. Behind the catch-all the handler would be
  // served index.html, and sign-in would fail with no obvious cause.
  const rewrites = vercel.rewrites || [];
  const authIdx = rewrites.findIndex((r) => r.source.startsWith('/__/auth'));
  const catchAllIdx = rewrites.findIndex((r) => r.source === '/(.*)');
  assert(authIdx !== -1, 'no /__/auth rewrite');
  assert(catchAllIdx !== -1, 'no SPA catch-all');
  assert(
    authIdx < catchAllIdx,
    `the catch-all at index ${catchAllIdx} precedes the auth proxy at ${authIdx}`
  );
});

runTest('The SPA catch-all still serves the app', () => {
  const rule = (vercel.rewrites || []).find((r) => r.source === '/(.*)');
  assert(rule && rule.destination === '/index.html', 'SPA routing must survive');
});

// ===========================================================================
console.log('\n2. authDomain resolution (exercised, not read off the source)');
// ===========================================================================
//
// These used to assert the text of config.js — that a constant was declared and a
// proxy existed. That let a change which stopped consulting the constant pass
// unnoticed: the declaration survived, the behaviour did not. They now call the
// rule.

runTest('An app served from firebaseapp.com uses its own origin', () => {
  assertEqual(
    resolveAuthDomainForHost('queueup-65e82.firebaseapp.com', undefined),
    'queueup-65e82.firebaseapp.com',
    'same-origin and pre-registered with Google'
  );
});

runTest('An app served from web.app uses its own origin', () => {
  assertEqual(resolveAuthDomainForHost('queueup-65e82.web.app', undefined), 'queueup-65e82.web.app');
});

runTest('🚨 A custom host falls back to the Firebase domain', () => {
  // Claiming a custom origin without registering it in Google Cloud Console fails
  // with redirect_uri_mismatch, which — unlike the Safari popup problem — has no
  // fallback path at all.
  for (const host of ['queue-up-nu.vercel.app', 'queueup.example.ac.th', 'localhost']) {
    assertEqual(resolveAuthDomainForHost(host, undefined), DEFAULT_AUTH_DOMAIN, host);
  }
});

runTest('An explicit VITE_FIREBASE_AUTH_DOMAIN overrides everything', () => {
  assertEqual(
    resolveAuthDomainForHost('queueup-65e82.firebaseapp.com', 'auth.example.ac.th'),
    'auth.example.ac.th',
    'a deliberate setting wins'
  );
  assertEqual(resolveAuthDomainForHost('anything', '  spaced.example.com  '), 'spaced.example.com');
});

runTest('A blank or missing override is ignored rather than used', () => {
  for (const configured of ['', '   ', undefined, null]) {
    assertEqual(resolveAuthDomainForHost('example.com', configured), DEFAULT_AUTH_DOMAIN);
  }
});

runTest('Off-browser (no host) resolves to the Firebase domain', () => {
  assertEqual(resolveAuthDomainForHost(undefined, undefined), DEFAULT_AUTH_DOMAIN);
});

runTest('🚨 A lookalike host does not pass as a Firebase domain', () => {
  // endsWith on a bare string would accept an attacker-controlled lookalike.
  assertEqual(
    resolveAuthDomainForHost('evil-firebaseapp.com', undefined),
    DEFAULT_AUTH_DOMAIN,
    'must require the dot-prefixed suffix'
  );
});

runTest('config.js delegates rather than re-implementing the rule', () => {
  assert(config.includes('resolveAuthDomainForHost('), 'config must use the shared rule');
});

// ===========================================================================
console.log('\n3. Sign-in survives a browser where the popup cannot work');
// ===========================================================================

const authCtx = read('src/context/AuthContext.jsx');

runTest('🚨 auth/missing-initial-state falls back to redirect', () => {
  assert(authCtx.includes("'auth/missing-initial-state'"), 'the Safari failure must be handled');
  assert(authCtx.includes('signInWithRedirect'), 'a fallback route must exist');
});

runTest('A blocked or unsupported popup also falls back', () => {
  for (const code of ['auth/popup-blocked', 'auth/web-storage-unsupported']) {
    assert(authCtx.includes(`'${code}'`), `${code} must be handled`);
  }
});

runTest('The redirect is completed when the browser returns', () => {
  assert(authCtx.includes('getRedirectResult'), 'a redirect sign-in must be completed');
});

runTest('Closing the popup is still treated as a cancellation, not a failure', () => {
  assert(authCtx.includes("'auth/popup-closed-by-user'"), 'user dismissal must stay silent');
  const popupClosedIdx = authCtx.indexOf("'auth/popup-closed-by-user'");
  const fallbackIdx = authCtx.indexOf('POPUP_UNAVAILABLE_CODES.includes');
  assert(popupClosedIdx < fallbackIdx, 'dismissal must be handled before the fallback');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
