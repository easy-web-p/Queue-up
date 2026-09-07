/**
 * ============================================================================
 * UI STATE & PRESENTATION TEST SUITE
 * ============================================================================
 *
 * A screen that fetches has three outcomes — still loading, nothing there, and
 * the read failed — and this app collapsed all three into one. The menu pages
 * held a hardcoded catalogue in their initial state, and fetchProductsFromFirestore
 * returned that same catalogue both when the collection was empty and when the
 * read threw. So a student saw a full canteen of dishes that were not in the
 * database: tappable, configurable, addable to the cart, and refused at ordering
 * with "PRODUCT_NOT_FOUND: ไม่พบสินค้ารหัส ... ในระบบ". A permissions error looked
 * exactly like a well-stocked lunch service.
 *
 * Also covered: the presentation details measured across the app — lazy loading
 * that must not touch the LCP image, and touch targets a thumb can actually hit.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(ROOT + f, 'utf8');

/**
 * Source with comments removed.
 *
 * These assertions are about what the code does, not what it says about itself —
 * a comment explaining a fix must not read as the bug still being present.
 */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const lib = read('src/lib/firebase.js');
const home = stripComments(read('src/pages/Home.jsx'));
const search = stripComments(read('src/pages/SearchResults.jsx'));
const states = read('src/components/LoadingStates.jsx');
const admin = read('src/pages/StoreAdminPage.tsx');

console.log('\n🎨 UI STATE & PRESENTATION TEST SUITE\n');

// ===========================================================================
console.log('1. The menu is the real menu');
// ===========================================================================

runTest('🚨 An empty products collection is not filled with a hardcoded catalogue', () => {
  const fn = lib.slice(lib.indexOf('export const fetchProductsFromFirestore'));
  const body = fn.slice(0, fn.indexOf('\n};'));
  assert(
    !/return INITIAL_PRODUCTS/.test(body),
    'returning the seed catalogue puts dishes on screen that cannot be ordered'
  );
  assert(/return products;/.test(body), 'it must return what the collection holds');
});

runTest('🚨 A failed read is not disguised as a stocked canteen', () => {
  const fn = lib.slice(lib.indexOf('export const fetchProductsFromFirestore'));
  const body = fn.slice(0, fn.indexOf('\n};'));
  assert(
    !/catch/.test(body),
    'a swallowed error made a permissions failure look like a full menu'
  );
});

runTest('🚨 Home no longer seeds its menu with fabricated products', () => {
  assert(
    !/useState\(DEFAULT_MENU_ITEMS\)/.test(home),
    'the initial state must not be a hardcoded catalogue'
  );
  assert(!/DEFAULT_MENU_ITEMS/.test(home), 'and the constant must be gone with it');
  assert(/useState\(\[\]\)/.test(home), 'it must start empty');
});

runTest('🚨 Search results no longer open on fabricated matches', () => {
  assert(!/MOCK_SEARCH_PRODUCTS/.test(search), 'a search must not render invented results');
  assert(!/SHARED_PRODUCTS/.test(search), 'and must not import a mock catalogue at all');
  assert(/useState\(\[\]\)/.test(search), 'it must start empty');
});

// ===========================================================================
console.log('\n2. Loading, empty and failed are three different things');
// ===========================================================================

for (const [label, src, name] of [['Home', home, 'menuStatus'], ['SearchResults', search, 'status']]) {
  runTest(`${label} distinguishes all three states`, () => {
    assert(src.includes(`${name} === "loading"`), 'a loading state must exist');
    assert(src.includes(`${name} === "error"`), 'a failed read must be its own state');
    assert(src.includes(`${name} === "ready"`), 'and success must be explicit');
  });

  runTest(`${label} shows a skeleton rather than a blank screen`, () => {
    assert(src.includes('FoodGridSkeleton'), 'the layout must not appear from nothing');
  });

  runTest(`🚨 ${label} offers a retry when the read fails`, () => {
    // An error with no way forward is where the session ends.
    assert(/ErrorState/.test(src), 'a failure must be shown');
    assert(/onRetry=/.test(src), 'and must be recoverable');
  });
}

runTest('🚨 Home tells an empty menu apart from an empty filter', () => {
  // "the canteen has no menu" and "this category is empty" need different answers.
  assert(home.includes('menuItems.length === 0'), 'the two empties must be distinguished');
  assert(home.includes('ยังไม่มีเมนูอาหารในระบบ'), 'an unstocked canteen must say so');
  assert(home.includes('ไม่พบเมนูในหมวดนี้'), 'an empty filter must say so');
});

runTest('The skeleton is announced to assistive technology', () => {
  assert(states.includes('aria-busy="true"'), 'a busy region must say it is busy');
  assert(states.includes('aria-live="polite"'), 'and announce when it settles');
  assert(states.includes('sr-only'), 'with text a screen reader can read');
});

runTest('The error state is announced, not just coloured red', () => {
  const block = states.slice(states.indexOf('export function ErrorState'));
  assert(block.includes('role="alert"'), 'a failure must reach a screen reader');
});

runTest('🚨 The admin menu load handles the throw it can now receive', () => {
  // fetchMenuItemsFromFirestore throws instead of returning a catalogue, so an
  // unhandled rejection would leave the page silently stale.
  const loads = admin.split('fetchMenuItemsFromFirestore()').slice(1);
  assert(loads.length >= 2, 'both call sites must be present');
  for (const [i, block] of loads.entries()) {
    assert(/\.catch\(/.test(block.slice(0, 600)), `call site ${i + 1} must handle a failure`);
  }
});

runTest('🚨 The admin price reset confirms only after the reload returns', () => {
  const handler = admin.slice(admin.indexOf('รีเซ็ตราคากลับสู่มาตรฐาน') - 900, admin.indexOf('รีเซ็ตราคากลับสู่มาตรฐาน') + 200);
  const thenIdx = handler.indexOf('.then(');
  const okIdx = handler.indexOf("setToastMsg('รีเซ็ตราคากลับสู่มาตรฐาน");
  assert(thenIdx !== -1 && okIdx > thenIdx, 'success was declared before the reload finished');
});

// ===========================================================================
console.log('\n3. Images');
// ===========================================================================

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function collect(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collect(full));
    else if (/\.(jsx|tsx)$/.test(entry)) found.push(full);
  }
  return found;
}
const componentFiles = collect(join(ROOT, 'src'));

function allImgTags() {
  const tags = [];
  for (const f of componentFiles) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<img\b[^>]*>/gs)) {
      tags.push({ file: f, tag: m.group ? m.group(0) : m[0] });
    }
  }
  return tags;
}

runTest('Every image carries alt text', () => {
  const missing = allImgTags().filter((t) => !t.tag.includes('alt='));
  assert(missing.length === 0, `${missing.length} images without alt`);
});

runTest('🚨 Off-screen images are deferred', () => {
  const tags = allImgTags();
  const eager = tags.filter((t) => !t.tag.includes('loading="lazy"'));
  // Only deliberate above-the-fold exceptions may load eagerly.
  for (const t of eager) {
    assert(
      t.tag.includes('fetchPriority="high"') || t.tag.includes('src="/logo.png"'),
      `${t.file} has an eager image that is not a declared hero or logo`
    );
  }
  assert(tags.length - eager.length > 20, 'most images should be lazy');
});

runTest('🚨 The LCP hero is NOT lazy', () => {
  // Lazy-loading the largest contentful paint element makes the page slower, not
  // faster — the opposite of what the attribute is for.
  for (const [file, marker] of [
    ['src/pages/Login.jsx', 'src={selectedAvatar}'],
    ['src/pages/Home.jsx', 'src="/crispy_fried_chicken.jpg"'],
  ]) {
    const s = read(file);
    const idx = s.indexOf(marker);
    assert(idx !== -1, `${file}: hero image not found`);
    const tagStart = s.lastIndexOf('<img', idx);
    const tag = s.slice(tagStart, idx);
    assert(!tag.includes('loading="lazy"'), `${file}: the hero must not be lazy`);
    assert(tag.includes('fetchPriority="high"'), `${file}: the hero should be prioritised`);
  }
});

// ===========================================================================
console.log('\n4. Touch targets');
// ===========================================================================

runTest('🚨 No interactive element declares a box under 44px without a minimum', () => {
  const offenders = [];
  for (const f of componentFiles) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<(?:button|a|Link)\b[^>]*?className="([^"]*)"[^>]*>/g)) {
      const cls = m[1];
      const w = cls.match(/\bw-(\d+)\b/);
      const h = cls.match(/\bh-(\d+)\b/);
      if (!w || !h) continue;
      if (Number(w[1]) * 4 >= 44 && Number(h[1]) * 4 >= 44) continue;
      if (/min-w-\[44px\]/.test(cls) && /min-h-\[44px\]/.test(cls)) continue;
      offenders.push(`${f}:${s.slice(0, m.index).split('\n').length} (${Number(w[1]) * 4}x${Number(h[1]) * 4}px)`);
    }
  }
  assert(offenders.length === 0, `targets a thumb cannot hit:\n       ${offenders.join('\n       ')}`);
});

// ===========================================================================
console.log('\n5. Dependencies');
// ===========================================================================

runTest('react-bootstrap is not a dependency of an app that never imports it', () => {
  const pkg = JSON.parse(read('package.json'));
  assert(!pkg.dependencies['react-bootstrap'], 'an unused dependency is weight and risk');
  const used = componentFiles.some((f) => readFileSync(f, 'utf8').includes('react-bootstrap'));
  assert(!used, 'and it must genuinely be unused');
});

runTest('No preload points at a file the build does not emit', () => {
  // A preload for a hashed asset named without its hash 404s on every page load.
  const html = read('index.html');
  for (const m of html.matchAll(/<link[^>]*rel="preload"[^>]*href="([^"]+)"/g)) {
    assert(!m[1].startsWith('/assets/'), `${m[1]} cannot be referenced before the build hashes it`);
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
