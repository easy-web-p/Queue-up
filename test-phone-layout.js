/**
 * ============================================================================
 * PHONE LAYOUT TEST SUITE
 * ============================================================================
 *
 * Students order lunch on a phone, standing in a queue, one-handed. Four things
 * were working against that, and none of them show up on a desktop screen.
 *
 *  1. Ten form fields were set between 11.5px and 14px. iOS Safari zooms the
 *     whole page in when a field under 16px takes focus and does not zoom back
 *     out, so tapping the search box threw the layout sideways every time.
 *
 *  2. Nothing in the app knew about the notch or the home indicator. Fixed
 *     elements sat at a flat bottom: 20-24px, which on any iPhone since the X is
 *     underneath the home bar — the button is drawn, but the swipe takes the tap.
 *
 *  3. On the product page the order buttons were at the end of an options column
 *     that runs to roughly two thousand pixels on a 360px screen: gallery, store,
 *     price, four option groups, a note, a quantity stepper, a seven-day calendar
 *     and eight time slots. The one thing the customer came to do was the last
 *     thing they could reach, and no running total was visible while they chose.
 *     `.queue-pd-action-bar` had mobile styling in the CSS and appeared nowhere in
 *     the JSX — the rule had been dead the whole time.
 *
 *  4. The cookie banner and the floating chat button both claimed the bottom
 *     edge, so whatever went there would be covered.
 *
 * Verified in Chromium at 390x844: no horizontal scroll on the public pages, no
 * field under 16px, the bar pinned at the viewport bottom with 48px targets, and
 * 76px of page padding so the last line clears it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

function collect(dir, pattern) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collect(full, pattern));
    else if (pattern.test(entry)) found.push(full);
  }
  return found;
}
const cssFiles = collect(join(ROOT, 'src'), /\.css$/);
const indexCss = read('src/index.css');
const productCss = read('src/pages/ProductDetail.css');
const productJsx = read('src/pages/ProductDetail.jsx');

console.log('\n📱 PHONE LAYOUT TEST SUITE\n');

// ===========================================================================
console.log('1. Tapping a field does not zoom the page');
// ===========================================================================

runTest('🚨 Form controls are at least 16px on phones', () => {
  // Below 16px, iOS Safari zooms in on focus and stays zoomed. The rule has to
  // win over ten existing per-component sizes, which is what !important is for
  // here — it is overriding, not asserting.
  const mobile = indexCss.slice(indexCss.indexOf('@media (max-width: 767px)'));
  const block = mobile.slice(0, mobile.indexOf('\n}'));
  assert(/font-size:\s*16px/.test(block), 'a 16px floor must exist for phones');
  for (const control of ['input', 'select', 'textarea']) {
    assert(new RegExp(`(^|[\\s,])${control}[\\s,]`, 'm').test(block), `${control} must be covered`);
  }
});

runTest('The floor applies only to phones', () => {
  // Desktop keeps its own compact sizes; this is a phone problem.
  const idx = indexCss.indexOf('font-size: 16px !important');
  assert(idx !== -1, 'the rule must exist');
  const before = indexCss.slice(0, idx);
  const lastMedia = before.lastIndexOf('@media');
  assert(/max-width:\s*767px/.test(before.slice(lastMedia, lastMedia + 60)), 'it must sit inside the phone media query');
});

// ===========================================================================
console.log('\n2. The notch and the home indicator');
// ===========================================================================

runTest('🚨 The viewport opts into the safe-area insets', () => {
  // Read the meta tag, not the file: the comment above it explains what
  // viewport-fit=cover does, so a plain search finds the word with the attribute
  // deleted.
  const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
  const meta = html.match(/<meta\s+name="viewport"[^>]*>/);
  assert(meta, 'the viewport meta must exist');
  assert(/viewport-fit=cover/.test(meta[0]), 'without it env(safe-area-inset-*) is always 0');
});

runTest('🚨 The safe-area tokens are defined', () => {
  for (const token of ['--safe-bottom', '--safe-top']) {
    assert(indexCss.includes(`${token}:`), `${token} must be defined`);
  }
  assert(/env\(safe-area-inset-bottom/.test(indexCss), 'and read from the real inset');
  assert(/env\(safe-area-inset-bottom,\s*0px\)/.test(indexCss), 'with a fallback for every other device');
});

runTest('🚨 Everything pinned to the bottom clears the home indicator', () => {
  // A flat bottom: 20px puts a control under the home bar, where the swipe
  // gesture takes the tap and the button simply does not work.
  const offenders = [];
  for (const f of cssFiles) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = m;
      if (!/position\s*:\s*fixed/.test(body)) continue;
      // `bottom`, not `border-bottom` — the loose pattern reported
      // `border-bottom: 1px solid ...` as a pinned offset.
      const bottom = body.match(/(?:^|[;{]|\s)bottom\s*:\s*([^;]+);/);
      if (!bottom) continue;
      const value = bottom[1];
      if (/^\s*(0|0px|auto)\s*$/.test(value)) continue; // flush to the edge is fine
      if (/safe-area-inset-bottom|--safe-bottom/.test(value)) continue;
      offenders.push(`${relative(ROOT, f)}: ${selector.trim().split('\n').pop().slice(0, 40)} → bottom: ${value.trim()}`);
    }
  }
  assert(offenders.length === 0, `pinned above the edge without a safe area:\n       ${offenders.join('\n       ')}`);
});

// ===========================================================================
console.log('\n3. The order action is always in reach');
// ===========================================================================

runTest('🚨 The phone order bar exists in the markup, not just the stylesheet', () => {
  // `.queue-pd-action-bar` was styled for phones and rendered nowhere — the rule
  // had been dead since it was written.
  assert(productJsx.includes('queue-pd-order-bar'), 'the bar must be rendered');
  assert(productCss.includes('.queue-pd-order-bar'), 'and styled');
  assert(
    !/\.queue-pd-action-bar/.test(productCss),
    'the dead rule must be gone rather than left to mislead the next reader'
  );
});

runTest('🚨 It is pinned, and above the chat button', () => {
  const bar = productCss.slice(productCss.indexOf('.queue-pd-order-bar {'));
  const mobile = productCss.slice(productCss.indexOf('@media (max-width: 991px)'));
  assert(/display:\s*none/.test(bar.slice(0, 80)), 'it must not appear on desktop');
  assert(/position:\s*fixed/.test(mobile), 'on a phone it must stay put');
  const z = mobile.match(/z-index:\s*(\d+)/);
  assert(z && Number(z[1]) > 1000, `z-index ${z?.[1]} must clear the floating chat button (1000)`);
});

runTest('🚨 Nothing is left underneath it', () => {
  assert(productJsx.includes('queue-pd-has-order-bar'), 'the page must reserve the space');
  const mobile = productCss.slice(productCss.indexOf('@media (max-width: 991px)'));
  assert(
    /\.queue-pd-has-order-bar\s*\{[^}]*padding-bottom:[^}]*--order-bar-height/.test(mobile),
    'the reserved space must match the bar height'
  );
  assert(indexCss.includes('--order-bar-height'), 'and that height is one shared value');
});

runTest('🚨 The chat button was moved out of the way', () => {
  const mobile = productCss.slice(productCss.indexOf('@media (max-width: 991px)'));
  assert(
    /\.queue-floating-chat-btn\s*\{[^}]*--order-bar-height/.test(mobile),
    'it sat at bottom: 24px, exactly where the bar now is'
  );
});

runTest('The bar shows what it will cost, and what for', () => {
  const bar = productJsx.slice(productJsx.indexOf('queue-pd-order-bar"'));
  assert(bar.includes('totalCalculatedPrice'), 'the running total must be on it');
  assert(bar.includes('selectedTimeSlot'), 'and the slot being ordered');
  assert(bar.includes('aria-label'), 'the icon-only cart button needs a name');
  assert(bar.includes('role="region"'), 'and the bar itself should be findable');
});

runTest('🚨 The two copies cannot disagree about whether the store is open', () => {
  // The same three-part condition used to be written out at each button.
  assert(productJsx.includes('const isOrderingBlocked'), 'the condition must be named once');
  const uses = (productJsx.match(/disabled=\{isOrderingBlocked\}/g) || []).length;
  assert(uses >= 4, `both copies of both buttons must use it, found ${uses}`);
  assert(
    !/disabled=\{store\?\.isOpen === false/.test(productJsx),
    'no inline copy of the condition may remain'
  );
});

runTest('Only one copy of the footer shows at a time', () => {
  const mobile = productCss.slice(productCss.indexOf('@media (max-width: 991px)'));
  assert(
    /\.queue-pd-footer-inline\s*\{\s*display:\s*none/.test(mobile),
    'showing both asks the customer which one is real'
  );
  assert(productJsx.includes('queue-pd-footer-inline'), 'the desktop copy must carry the class');
});

// ===========================================================================
console.log('\n4. The bottom edge is shared, not fought over');
// ===========================================================================

runTest('🚨 The cookie banner sits above the order bar', () => {
  const banner = read('src/components/CookieConsentBanner.css');
  const mobile = banner.slice(banner.indexOf('@media (max-width: 991px)'));
  assert(mobile.length > 0, 'the banner needs a phone rule');
  assert(
    /--order-bar-height/.test(mobile),
    'at z-index 10000 it covered the buy button entirely'
  );
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
