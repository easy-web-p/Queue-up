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
 * The fix keeps the auth handler on the app's own origin. Two pieces have to hold
 * together for that, and both fail silently if disturbed:
 *
 *   - vercel.json must proxy /__/auth/* BEFORE the SPA catch-all, or the catch-all
 *     swallows the handler and serves index.html to it;
 *   - firebase/config.js must only claim an origin as its authDomain where that
 *     proxy actually exists.
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
const vercel = JSON.parse(read('vercel.json'));
const config = read('src/firebase/config.js');

console.log('\n🔑 AUTH HANDLER ORIGIN TEST SUITE\n');

// ===========================================================================
console.log('1. The auth handler is proxied onto the app origin');
// ===========================================================================

runTest('vercel.json proxies /__/auth/* to the Firebase auth handler', () => {
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
console.log('\n2. authDomain only claims an origin that serves the handler');
// ===========================================================================

runTest('config.js resolves authDomain rather than hard-coding it', () => {
  assert(config.includes('resolveAuthDomain()'), 'authDomain must be resolved per host');
  assert(!/authDomain:\s*import\.meta\.env/.test(config), 'the old static authDomain is gone');
});

runTest('firebaseapp.com and web.app are treated as same-origin', () => {
  // There the app and the handler share a domain, so no proxy is needed.
  assert(config.includes('.firebaseapp.com'), 'firebaseapp.com host check');
  assert(config.includes('.web.app'), 'web.app host check');
});

runTest('🚨 Every host claiming same-origin auth is proxied in vercel.json', () => {
  // Claiming an origin whose /__/auth is not proxied breaks sign-in outright: the
  // handler would 404 into the SPA instead of loading.
  const listed = [...config.matchAll(/SAME_ORIGIN_AUTH_HOSTS\s*=\s*\[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((h) => h[1]));
  assert(listed.length > 0, 'no same-origin hosts declared');
  const hasProxy = (vercel.rewrites || []).some((r) => r.source.startsWith('/__/auth'));
  assert(hasProxy, `hosts ${listed.join(', ')} claim same-origin auth but nothing proxies /__/auth`);
});

runTest('An unknown host falls back to the Firebase auth domain', () => {
  assert(config.includes('return DEFAULT_AUTH_DOMAIN'), 'unrecognised hosts need a fallback');
});

runTest('An explicit VITE_FIREBASE_AUTH_DOMAIN still wins', () => {
  assert(
    config.includes('import.meta.env.VITE_FIREBASE_AUTH_DOMAIN'),
    'the env override must remain available for other deployments'
  );
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
