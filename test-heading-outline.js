/**
 * ============================================================================
 * HEADING OUTLINE TEST SUITE
 * ============================================================================
 *
 * Headings are how someone using a screen reader skims a page. Press H and you
 * move between them; the levels are the outline, and the outline is the page's
 * table of contents. Sixteen of this app's pages had one that did not describe
 * anything:
 *
 *   Home            h1 → h4 → h6 → … → h5 → h2 → h5
 *   MerchantDash    no h1 at all; opened at h2, then h3 → h5 → h6
 *   UserProfile     three h2 panel titles, and the only h1 on the page was a
 *                   points TOTAL — "🪙 0 แต้ม" — so the whole profile read as
 *                   one section by that name
 *   ProductDetail   the STALL's name was the h1 and the dish was an h2 under
 *                   it, on a page about the dish
 *   SearchResults   the only heading was the "no results" message, so a search
 *                   that found something produced a page with no headings
 *   Login           an h2 hero title before the h1, repeating it
 *
 * The levels are now assigned by walking each page in order and giving every
 * heading a depth one below its nearest open ancestor, so nesting is preserved
 * exactly and no level is skipped. Nothing about this changes what anyone
 * sees: Tailwind's Preflight resets h1–h6 to `font-size: inherit`, so a
 * heading's size comes entirely from its classes.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

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
const strip = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const pages = execSync("git ls-files src/pages | grep -E '\\.(jsx|tsx)$'", {
  cwd: new URL('.', root).pathname,
  encoding: 'utf8',
}).trim().split('\n');

const levelsIn = (file) =>
  [...strip(read(file)).matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));

/**
 * Pages that legitimately have no heading, with the reason. Not a list to add
 * to lightly: a page with content and no heading is the SearchResults bug.
 */
const NO_HEADING_OK = {
  'src/pages/Loading.jsx': 'a spinner, with no content to head',
  'src/pages/UserPurchase.jsx': 'a redirect stub that renders null',
};

/**
 * Pages whose several level-1 headings never render at the same time.
 */
const MULTIPLE_H1_OK = {
  'src/pages/MerchantOnboarding.jsx': 'wizard steps 0 and 3, rendered exclusively',
};

console.log('\n📐 Every page has an outline');

runTest('🚨 Every page with content has a heading', () => {
  for (const file of pages) {
    if (levelsIn(file).length > 0) continue;
    assert(NO_HEADING_OK[file], `${file} renders a page with no heading at all`);

    // The exemption has to keep earning itself. A page is only allowed no
    // heading while it puts no prose on the screen: the moment it renders
    // something a person reads, that something needs a heading over it. Only
    // text nodes count — the text that actually sits between two tags.
    const src = strip(read(file));
    const prose = [...src.matchAll(/>([^<>{}]+)</g)]
      .map((m) => m[1].trim())
      .filter((t) => /[\u0E00-\u0E7Fa-zA-Z]{4,}/.test(t));
    assertEqual(
      prose.length,
      0,
      `${file} is exempt from needing a heading as "${NO_HEADING_OK[file]}", but now renders text: ${prose.slice(0, 2).join(' / ').slice(0, 70)}`
    );
  }
});

runTest('🚨 Every page has exactly one level-1 heading', () => {
  for (const file of pages) {
    const levels = levelsIn(file);
    if (levels.length === 0) continue;
    const ones = levels.filter((l) => l === 1).length;
    if (ones === 1) continue;
    assert(
      ones > 1 && MULTIPLE_H1_OK[file],
      `${file} has ${ones} level-1 headings${ones === 0 ? ' — no heading says what the page is' : ''}`
    );
  }
});

runTest('🚨 No page skips a heading level', () => {
  // h1 → h4 tells a reader three sections are open that never opened.
  const offenders = [];
  for (const file of pages) {
    const levels = levelsIn(file);
    let prev = null;
    for (const level of levels) {
      if (prev !== null && level > prev + 1) offenders.push(`${file}: h${prev} → h${level}`);
      prev = level;
    }
  }
  assertEqual(offenders.join('\n       '), '', `skipped level(s):\n       ${offenders.join('\n       ')}`);
});

runTest('🚨 No page opens deeper than its own level-1 heading allows', () => {
  // Anything before the h1 in source is a section of the page, so it starts
  // at 2 — never at 1, which would be a second page.
  for (const file of pages) {
    const levels = levelsIn(file);
    const first = levels.indexOf(1);
    if (first <= 0) continue;
    const before = levels.slice(0, first);
    assert(
      before.every((l) => l >= 2),
      `${file} has a level-1 heading before its own: ${levels.join('')}`
    );
  }
});

console.log('\n🧾 The headings are headings');

runTest('🚨 A figure is not a heading', () => {
  // The only h1 on the profile was the points total, so heading navigation
  // announced the whole page as "🪙 0 แต้ม".
  const profile = strip(read('src/pages/UserProfile.jsx'));
  const headings = [...profile.matchAll(/<h[1-6][^>]*>([\s\S]{0,120}?)<\/h[1-6]>/g)].map((m) => m[1]);
  for (const text of headings) {
    assert(
      !/\{\s*\w*[Pp]oints?\w*\.toLocaleString\(\)/.test(text),
      `a points total is marked up as a heading: ${text.trim().slice(0, 60)}`
    );
  }
  assert(profile.includes('<h1 className="sr-only">บัญชีของฉัน</h1>'), 'the profile has no heading of its own');
});

runTest('🚨 The product page is headed by the dish, not by the stall', () => {
  const pd = strip(read('src/pages/ProductDetail.jsx'));
  const h1 = pd.match(/<h1[^>]*>([\s\S]{0,80}?)<\/h1>/);
  assert(h1, 'the product page has no level-1 heading');
  assert(/product\.name/.test(h1[1]), `the product page is headed by something else: ${h1[1].trim().slice(0, 60)}`);
  assert(!/queue-pd-shop-title/.test(h1[0]), "the stall's name is the page heading again");
});

runTest('🚨 A search that finds something still has a heading', () => {
  // The only heading used to be inside the empty state.
  const sr = strip(read('src/pages/SearchResults.jsx'));
  const h1 = sr.match(/<h1[^>]*>/);
  assert(h1, 'the search page has no level-1 heading');
  assert(
    /shopee-search-hint-header/.test(h1[0]),
    'the search page is headed by something other than the result header'
  );
  const emptyState = sr.indexOf('shopee-empty-title');
  const headingAt = sr.indexOf(h1[0]);
  assert(headingAt < emptyState, 'the page heading only exists inside the empty state');
});

runTest('🚨 Changing a level cannot change what anyone sees', () => {
  // The re-levelling rests on this. Tailwind's Preflight sets h1-h6 to
  // font-size: inherit, but the Bootstrap compatibility layer loads after it
  // and puts the per-level sizes back — so a heading whose classes set no size
  // is sized BY ITS LEVEL, and moving it would resize it. Those carry an
  // explicit fs-N instead, which only holds while .fs-N and hN agree.
  const compat = read('src/styles/bootstrap-compat.css');
  // The layer writes the rule in several shapes — at the top level, inside a
  // media query, and sometimes paired with its .hN twin — so a size counts
  // wherever the selector starts a rule.
  const sizesFor = (selector) =>
    [...compat.matchAll(new RegExp(`(?:^|\\}|\\{|,)${selector}(?:,[.\\w-]+)?\\{[^}]*?font-size:([^;!}]+)`, 'g'))]
      .map((m) => m[1].trim())
      .sort();

  let compared = 0;
  for (let level = 1; level <= 6; level += 1) {
    const element = sizesFor(`h${level}`);
    const utility = sizesFor(`\\.fs-${level}`);
    assert(element.length > 0, `the layer no longer sizes h${level}, so pinning is measuring nothing`);
    assertEqual(
      utility.join(' | '),
      element.join(' | '),
      `.fs-${level} does not render at the same size as an h${level}, so every heading pinned with it moved`
    );
    compared += 1;
  }
  assertEqual(compared, 6, 'not every level was compared');
});

runTest('🚨 A pinned heading pins exactly one size', () => {
  // Two size classes on one heading is a coin toss decided by source order.
  for (const file of pages) {
    for (const [, attrs] of strip(read(file)).matchAll(/<h[1-6]\b([^>]*)/g)) {
      const cls = attrs.match(/className="([^"]*)"/);
      if (!cls) continue;
      const sizes = cls[1].split(/\s+/).filter((c) => /^(fs-\d|display-\d|text-(xs|sm|base|lg|xl|\dxl))$/.test(c));
      assert(sizes.length <= 1, `${file}: a heading declares ${sizes.length} sizes at once: ${sizes.join(', ')}`);
    }
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
