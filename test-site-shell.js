/**
 * ============================================================================
 * SITE SHELL TEST SUITE — the parts of the page that are not a feature
 * ============================================================================
 *
 * The footer, the manifest and the page files nothing routes. None of it is a
 * feature, and all of it makes claims.
 *
 * The footer offered four social accounts (#facebook, #line, #instagram,
 * #youtube) and two app-store downloads (#ios, #android). Every one of those
 * hrefs was a bare fragment id pointing at an element that does not exist, so
 * each click scrolled nowhere. There is no Facebook page, no LINE official
 * account, and no native app — QueueUp is a web app. A school handing this page
 * to parents was publishing six support channels nobody was reading.
 *
 * public/manifest.json declared a 192x192 icon for a file that is 512x512,
 * called a wide wordmark `maskable` when an Android circle mask would clip the
 * "Q" and the "p" off it, and carried a UTF-8 BOM that makes the file fail a
 * strict `JSON.parse`.
 *
 * And two page files sat under src/pages that nothing imports: a third chat
 * implementation left over from reconciling the other two, opening with a
 * hardcoded merchant greeting no merchant sent; and a self-assessment
 * scorecard grading this codebase "Security 8.5, Production Readiness 8.5" —
 * numbers nothing measured, one route registration away from being published.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

/** Comments describe what was removed; only the markup makes a claim. */
const stripComments = (src) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

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

const root = new URL('./', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');
const readRaw = (rel) => readFileSync(new URL(rel, root));

console.log('\n🔗 The footer offers only what exists');

runTest('🚨 No footer link points at a fragment that is not on the page', () => {
  // `href="#facebook"` is not a broken link a crawler would flag — it is a
  // button that silently does nothing, which is worse.
  const footer = read('src/components/Footer.jsx');
  const fragments = [...footer.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]);
  const live = fragments.filter((id) => id && !footer.includes(`id="${id}"`));
  assertEqual(
    live.join(', '),
    '',
    `the footer links to fragment(s) nothing on the page defines: ${live.join(', ')}`
  );
});

runTest('🚨 The footer does not offer an app that cannot be downloaded', () => {
  const footer = stripComments(read('src/components/Footer.jsx'));
  for (const claim of ['App Store', 'Google Play', 'bi-apple', 'bi-google-play']) {
    assert(!footer.includes(claim), `the footer still advertises "${claim}" — there is no native app`);
  }
});

runTest('🚨 The footer does not offer social accounts that do not exist', () => {
  const footer = stripComments(read('src/components/Footer.jsx'));
  for (const icon of ['bi-facebook', 'bi-line', 'bi-instagram', 'bi-youtube', 'bi-twitter', 'bi-tiktok']) {
    // Matched with the closing quote so `bi-line` cannot be satisfied by some
    // unrelated class that merely starts the same way.
    assert(
      !new RegExp(`${icon}[\\s"']`).test(footer),
      `the footer still shows a ${icon} button with nowhere to go`
    );
  }
});

runTest('The channels it does offer are reachable', () => {
  const footer = read('src/components/Footer.jsx');
  assert(/href="tel:\d{6,}"/.test(footer), 'the phone number is gone');
  assert(/href="mailto:[^"]+@[^"]+"/.test(footer), 'the email address is gone');
  // Installing is real: manifest.json makes this a standalone PWA.
  assert(footer.includes('หน้าจอโฮม'), 'the honest install instruction is gone');
});

console.log('\n📱 The manifest describes the file that is actually there');

runTest('🚨 The manifest parses strictly, with no byte-order mark', () => {
  // A BOM makes JSON.parse throw. Browsers mostly tolerate it in a manifest;
  // nothing else that reads the file does.
  const raw = readRaw('public/manifest.json');
  assert(!(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf), 'the manifest still carries a UTF-8 BOM');
  JSON.parse(raw.toString('utf8'));
});

runTest('🚨 Every declared icon size is the size of the actual PNG', () => {
  // The manifest listed the same 512x512 file twice, once as 192x192. A
  // declared size is what the browser picks on, so it has to be the truth.
  const manifest = JSON.parse(read('public/manifest.json'));
  assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'the manifest declares no icon');

  for (const icon of manifest.icons) {
    const file = readRaw(`public${icon.src}`);
    assertEqual(file.toString('ascii', 1, 4), 'PNG', `${icon.src} is not a PNG`);
    // IHDR width and height are big-endian uint32 at bytes 16 and 20.
    const width = file.readUInt32BE(16);
    const height = file.readUInt32BE(20);
    for (const declared of String(icon.sizes).split(/\s+/)) {
      assertEqual(declared, `${width}x${height}`, `${icon.src} is declared ${declared} but is ${width}x${height}`);
    }
  }
});

runTest('🚨 The wordmark is not declared maskable', () => {
  // A maskable icon promises a safe zone inside the central 80%. The logo is a
  // wide wordmark, so Android's circle mask clips the "Q" and the "p".
  const manifest = JSON.parse(read('public/manifest.json'));
  for (const icon of manifest.icons) {
    assert(
      !String(icon.purpose || '').includes('maskable'),
      `${icon.src} claims to be maskable; a circle mask would crop the wordmark`
    );
  }
});

runTest('The manifest still describes an installable app', () => {
  // The install instruction in the footer is only honest while this holds.
  const manifest = JSON.parse(read('public/manifest.json'));
  assertEqual(manifest.display, 'standalone', 'the app is no longer installable');
  assert(manifest.name && manifest.short_name, 'the installed app would have no name');
  assert(read('index.html').includes('rel="manifest"'), 'the manifest is not linked from the page');
  const largest = Math.max(
    ...manifest.icons.map((i) => Math.max(...String(i.sizes).split(/\s+/).map((s) => Number(s.split('x')[0]) || 0)))
  );
  assert(largest >= 192, `the largest declared icon is ${largest}px; an install prompt needs at least 192`);
});

console.log('\n🗂️  Nothing sits in src/pages that no route renders');

runTest('🚨 Every page file is routed', () => {
  // A page nothing imports is not harmless: About.jsx graded this codebase
  // "Security 8.5" out of nothing, one route registration away from being
  // published as a finding.
  // "Routed" is not quite the bar: Loading.jsx is a page that ProtectedRoute
  // renders directly. The bar is that something imports it.
  const importers = execSync(
"git ls-files src | grep -E '\\.(js|jsx|ts|tsx)$' | xargs cat",
    { cwd: new URL('.', root).pathname, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const orphans = readdirSync(new URL('src/pages/', root))
    .filter((f) => /\.(jsx|tsx)$/.test(f))
    .map((f) => f.replace(/\.(jsx|tsx)$/, ''))
    .filter((name) => !new RegExp(`pages/${name}\\.(jsx|tsx)`).test(importers));
  assertEqual(orphans.join(', '), '', `page file(s) nothing imports: ${orphans.join(', ')}`);

  // And the ones that are pages rather than helpers are reachable by URL.
  const app = read('src/App.jsx');
  assert(app.includes('pages/StudentWallet.'), 'the wallet page lost its route');
});

runTest('🚨 The third chat implementation and the scorecard are gone', () => {
  const files = readdirSync(new URL('src/pages/', root));
  for (const gone of ['Chat.tsx', 'About.jsx', 'About.css']) {
    assert(!files.includes(gone), `${gone} is back — it is dead code nothing routes`);
  }
  // The chat that survives is the one wired to Firestore.
  // The chat that survives reads live messages through chatService, rather
  // than opening with a greeting no merchant sent.
  const modal = read('src/components/ChatModal.jsx');
  assert(modal.includes('subscribeToMessages('), 'the surviving chat no longer reads live messages');
});

console.log('\n📄 No source file carries a byte-order mark');

runTest('🚨 No tracked source file starts with a BOM', () => {
  // A BOM breaks a strict JSON parse, and in a .ts or .js file it survives
  // concatenation into the bundle as an invisible character.
  const tracked = execSync('git ls-files', { cwd: new URL('.', root).pathname, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(json|js|jsx|ts|tsx|css|html|rules|md)$/.test(f));
  assert(tracked.length > 50, `only ${tracked.length} tracked source files were scanned`);

  const withBom = tracked.filter((f) => {
    const head = readFileSync(new URL(f, root)).subarray(0, 3);
    return head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
  });
  assertEqual(withBom.join(', '), '', `file(s) start with a UTF-8 BOM: ${withBom.join(', ')}`);
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
