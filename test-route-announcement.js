/**
 * ============================================================================
 * ROUTE ANNOUNCEMENT TEST SUITE
 * ============================================================================
 *
 * A single-page app swaps the contents of the document without a page load, so
 * a browser announces nothing — from its point of view nothing happened. This
 * app never put any of it back, and three things went wrong quietly.
 *
 *  1. **Every route shared one title.** index.html sets
 *     "QueueUp - School Canteen Smart Pre-Order & Queue Platform" and nothing
 *     ever changed it, so all fifty-odd screens produced the same history
 *     entry, the same tab label and the same bookmark. A parent with the
 *     wallet and the order history open in two tabs could not tell them apart,
 *     and Back through five screens was five identical lines.
 *
 *  2. **A screen reader was told nothing** on navigation, and carried on
 *     reading the screen that had just been replaced.
 *
 *  3. **Focus was stranded** on the link that had been clicked, which the new
 *     route had usually unmounted, so the next Tab restarted from the top of
 *     the document.
 *
 * The route table is data, so the interesting part is testable directly: every
 * path the router serves has to resolve to a name, and no two screens that a
 * person would need to tell apart may share one.
 */

import { readFileSync } from 'node:fs';
import { APP_NAME, routeName, routeTitle } from './src/utils/routeTitles.js';

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
const strip = (s) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const app = strip(read('src/App.jsx'));

/** Every path the router actually serves, with the catch-all left out. */
const routedPaths = [...app.matchAll(/path="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((p) => p !== '*');

console.log('\n🧭 Every screen has a name of its own');

runTest('🚨 Every routed path resolves to a name', () => {
  // A path the table does not know reads "ไม่พบหน้านี้" in the tab, which is
  // a lie about a page that loaded perfectly well.
  assert(routedPaths.length >= 40, `only ${routedPaths.length} routes were found`);
  const unnamed = routedPaths.filter((p) => routeName(p.replace(/:\w+/g, 'sample')) === null);
  assertEqual(unnamed.join(', '), '', `route(s) with no title: ${unnamed.join(', ')}`);
});

runTest('🚨 A parameterised route is named by its shape, not its value', () => {
  // /product/:id serves a different dish every time and must not need a table
  // entry per dish.
  for (const id of ['abc123', 'menu-1', '9f8a2b7c']) {
    assertEqual(routeName(`/product/${id}`), 'รายละเอียดเมนู', `/product/${id} lost its name`);
  }
});

runTest('🚨 A prefix only matches at a path boundary', () => {
  // Answering /guardian/spending-limits with "แดชบอร์ดผู้ปกครอง" would put four
  // different guardian screens under one name again. And a prefix that matched
  // on characters rather than on segments would make /campus/guardian-links —
  // a staff approvals queue — report itself as a parent's dashboard.
  assertEqual(routeName('/guardian'), 'แดชบอร์ดผู้ปกครอง', 'the section itself lost its name');
  assertEqual(routeName('/guardian/spending-limits'), 'ตั้งค่าวงเงินการใช้จ่าย', 'a longer path was swallowed by its section');
  assertEqual(routeName('/guardian/allergy-alert'), 'ตั้งค่าการแจ้งเตือนภูมิแพ้', 'a longer path was swallowed by its section');
  assertEqual(routeName('/guardian/order-history'), 'ประวัติการสั่งอาหารของบุตรหลาน', 'a longer path was swallowed by its section');

  assertEqual(routeName('/campus/guardian'), 'แดชบอร์ดผู้ปกครอง', 'the guardian alias lost its name');
  assertEqual(routeName('/campus/guardian-links'), 'ยืนยันบัญชีผู้ปกครอง', 'a sibling path was matched as a child path');
  assertEqual(routeName('/campus/monitor'), 'จอแสดงคิวโรงอาหารสด', 'the monitor lost its name');
  assertEqual(routeName('/campus/monitoring-x'), null, 'a longer word matched a shorter prefix');
});

runTest('🚨 Screens a person must tell apart do not share a title', () => {
  // The bug this replaces was every screen sharing one name. Aliases for the
  // SAME screen may share; different screens may not.
  const byName = new Map();
  for (const p of routedPaths) {
    const name = routeName(p.replace(/:\w+/g, 'sample'));
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(p);
  }
  // Distinct destinations, by the component each route renders.
  const componentOf = (path) => {
    const m = app.match(new RegExp(`path="${path.replace(/[/:*]/g, (c) => `\\${c}`)}"[^>]*element=\\{[\\s\\S]{0,160}?<(\\w+)`));
    return m ? m[1] : path;
  };
  for (const [name, paths] of byName) {
    const components = new Set(paths.map(componentOf).filter((c) => c !== 'ProtectedRoute'));
    assertEqual(
      components.size <= 1,
      true,
      `"${name}" names ${components.size} different screens: ${paths.join(', ')}`
    );
  }
  assert(byName.size >= 20, `only ${byName.size} distinct titles across ${routedPaths.length} routes`);
});

runTest('🚨 An unknown path says so rather than borrowing the app name', () => {
  for (const bogus of ['/nope', '/guardian-x', '/admin/nothing-here', '/wallets']) {
    assertEqual(routeName(bogus), null, `${bogus} matched a real screen`);
    assert(routeTitle(bogus).startsWith('ไม่พบหน้านี้'), `${bogus} does not read as a missing page`);
  }
});

runTest('Case and trailing slashes do not change the answer', () => {
  assertEqual(routeName('/CAMPUS/Monitor'), routeName('/campus/monitor'), 'case changed the title');
  assertEqual(routeName('/orders/'), routeName('/orders'), 'a trailing slash changed the title');
  assertEqual(routeName(''), null, 'an empty path resolved to a screen');
  assertEqual(routeName(null), null, 'a missing path resolved to a screen');
});

runTest('Every title carries the app name, so a tab is identifiable', () => {
  for (const p of routedPaths) {
    const title = routeTitle(p.replace(/:\w+/g, 'sample'));
    assert(title.includes(APP_NAME), `${p} produces a title with no app name: ${title}`);
    assert(title.length < 80, `${p} produces a title too long for a tab: ${title}`);
  }
});

console.log('\n📣 The change is announced, and focus follows it');

const announcer = strip(read('src/components/RouteAnnouncer.jsx'));

runTest('🚨 The title is set on every navigation', () => {
  assert(/document\.title = routeTitle\(pathname\)/.test(announcer), 'the title is never updated');
  assert(/\[pathname/.test(announcer), 'the effect does not re-run when the route changes');
});

runTest('🚨 A polite live region announces the new screen', () => {
  assert(/aria-live="polite"/.test(announcer), 'nothing is announced on navigation');
  assert(/aria-atomic="true"/.test(announcer), 'a partial update would be read as a fragment');
  assert(/sr-only/.test(announcer), 'the announcement is visible on screen');
  // Written into the node: replacing the whole region through React state is
  // not reliably read as a change to it.
  assert(/liveRef\.current\.textContent = /.test(announcer), 'the region is re-rendered rather than updated');
});

runTest('🚨 Focus moves into the new content, but not on first load', () => {
  // Landing on a URL directly is an ordinary page load; stealing focus there
  // scrolls someone past the header they arrived to read.
  // A named flag is not the property; returning before the focus call is.
  const effect = announcer.slice(announcer.indexOf('useEffect'), announcer.indexOf('}, [pathname'));
  const guard = effect.match(/if \(\s*(\w+)\.current\s*\)\s*\{[^}]*return;/);
  assert(guard, 'nothing stops the first render from stealing focus');
  assert(
    effect.indexOf(guard[0]) < effect.indexOf('.focus('),
    'the first-render guard sits after focus has already moved'
  );
  assert(/getElementById\(mainId\)/.test(announcer), 'focus never moves to the new content');
  assert(/focus\(\{ preventScroll: true \}\)/.test(announcer), 'the focus jump fights scroll restoration');
});

runTest('🚨 It is mounted, and the target it focuses exists', () => {
  assert(app.includes('<RouteAnnouncer />'), 'the announcer is not mounted');
  const mount = app.indexOf('<RouteAnnouncer />');
  const router = app.indexOf('<BrowserRouter');
  assert(router >= 0 && mount > router, 'the announcer sits outside the router, so it sees no navigation');
  assert(app.includes('id="main-content"'), 'the focus target does not exist');
  assert(/id="main-content"[^>]*tabIndex=\{-1\}/.test(app), 'the focus target cannot receive focus');
});

runTest('The static title is still there for the first paint', () => {
  // Before React runs, the document needs a name; the table takes over after.
  const html = read('index.html');
  assert(/<title>[^<]{10,}<\/title>/.test(html), 'index.html has no title to start from');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
