/**
 * ============================================================================
 * KEYBOARD OPERABILITY TEST SUITE
 * ============================================================================
 *
 * Around forty-five elements across fourteen files were a `<div>` or a `<span>`
 * carrying an `onClick` and a `cursor-pointer` class, and nothing else. A
 * browser does not put a plain div in the tab order, and pressing Enter on one
 * does nothing, because there is nothing there to press.
 *
 * That was not an edge case. It was the entire left-hand navigation of the
 * profile page (seven items), the tab strips over the order list, the coupon
 * list and the profile panels, the category filter on the home page, the seven
 * feature cards below it, the avatar picker in sign-up, and thirteen controls
 * in the search bar — the account menu, the cart, the notification list, the
 * search scope. A student using a keyboard, a switch or a screen reader could
 * reach almost none of it, and what they could reach was announced as plain
 * text rather than as a control.
 *
 * The home cards were worse than unreachable. Each one ended in a
 * `<button type="button">` — "ยื่นขอเปิดร้าน ›", "จัดการกระเป๋าเงิน ›" — with
 * no handler on it at all. Tab lands on it, because a real button is
 * focusable; Enter does nothing, because the click handler was on the card
 * wrapping it. The one thing on the card that looked operable from a keyboard
 * was the one thing that definitely was not.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pressableProps } from './src/utils/pressable.js';

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

const components = execSync("git ls-files src | grep -E '\\.(jsx|tsx)$'", {
  cwd: new URL('.', root).pathname,
  encoding: 'utf8',
}).trim().split('\n');

console.log('\n⌨️  The helper behaves like a button');

runTest('🚨 It supplies a role, a tab stop and Enter/Space activation', () => {
  const props = pressableProps(() => {});
  assertEqual(props.role, 'button', 'no role, so it is not announced as a control');
  assertEqual(props.tabIndex, 0, 'not in the tab order, so it cannot be reached');
  assert(typeof props.onKeyDown === 'function', 'no keyboard handler');
  assert(typeof props.onClick === 'function', 'the mouse path was lost');
});

runTest('🚨 Enter and Space both activate it, and nothing else does', () => {
  let fired = 0;
  const props = pressableProps(() => { fired += 1; });
  const press = (key) => {
    let prevented = false;
    props.onKeyDown({ key, preventDefault: () => { prevented = true; } });
    return prevented;
  };
  assert(press('Enter'), 'Enter did not preventDefault, so a form would submit as well');
  assertEqual(fired, 1, 'Enter did not activate');
  assert(press(' '), 'Space did not preventDefault, so the page scrolls under the user');
  assertEqual(fired, 2, 'Space did not activate');
  press('Spacebar');
  assertEqual(fired, 3, 'the legacy Space key name was ignored');
  for (const key of ['a', 'Tab', 'Escape', 'ArrowDown', 'Shift']) press(key);
  assertEqual(fired, 3, 'a key that is not Enter or Space activated the control');
});

runTest('🚨 A disabled pressable is out of the tab order and does nothing', () => {
  let fired = 0;
  const props = pressableProps(() => { fired += 1; }, { disabled: true });
  assertEqual(props.tabIndex, -1, 'a disabled control is still reachable by Tab');
  assertEqual(props['aria-disabled'], true, 'nothing announces it as disabled');
  props.onClick({});
  props.onKeyDown({ key: 'Enter', preventDefault: () => {} });
  assertEqual(fired, 0, 'a disabled control still fired');
});

runTest('🚨 A toggle reports its state, and a plain control does not', () => {
  // `aria-pressed` on something that is not a toggle makes every control
  // sound like an unchecked switch.
  assertEqual(pressableProps(() => {}, { pressed: true })['aria-pressed'], true, 'an on state is not announced');
  assertEqual(pressableProps(() => {}, { pressed: false })['aria-pressed'], false, 'an off state is not announced');
  assertEqual(pressableProps(() => {})['aria-pressed'], undefined, 'a plain control claims a toggle state');
});

console.log('\n🖱️  No clickable element is mouse-only');

/** Opening tags for elements that are clickable but not controls by default. */
function clickableNonControls(src) {
  const out = [];
  const re = /<(div|span|li|td|tr|section|article|p|h[1-6])\b/g;
  let m;
  while ((m = re.exec(src))) {
    // Walk to the end of the opening tag, stepping over braces and strings.
    // An arrow function in an attribute — `e => e.stopPropagation()` — carries
    // a `>` of its own, so scanning to the first one cuts the tag in half and
    // loses the attribute that would have exempted it.
    let i = m.index + m[0].length;
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '"' || c === "'" || c === '`') {
        const q = c;
        i += 1;
        while (i < src.length && src[i] !== q) { if (src[i] === '\\') i += 1; i += 1; }
      } else if (c === '>' && depth === 0) break;
      i += 1;
    }
    const tag = src.slice(m.index, i + 1);
    if (/\bonClick=|pressableProps\(/.test(tag)) out.push(tag);
  }
  return out;
}

runTest('🚨 Every clickable div or span is reachable and operable', () => {
  // The exception is a modal backdrop: a click on the dimmed area is a mouse
  // shortcut for "close", whose keyboard equivalent is Escape, not a tab stop
  // announced as a button. Those are held to that instead, in
  // test-dialog-a11y.js.
  const offenders = [];
  for (const file of components) {
    for (const tag of clickableNonControls(strip(read(file)))) {
      if (/pressableProps\(/.test(tag)) continue;
      if (/role=/.test(tag) && /tabIndex/.test(tag) && /onKey/.test(tag)) continue;
      const isBackdrop = /fixed inset-0|overlay|backdrop/.test(tag);
      const stopsPropagation = /stopPropagation/.test(tag);
      if (isBackdrop || stopsPropagation) continue;
      offenders.push(`${file}: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`);
    }
  }
  assertEqual(offenders.join('\n       '), '', `mouse-only control(s):\n       ${offenders.join('\n       ')}`);
});

runTest('🚨 No button is focusable but wired to nothing', () => {
  // A real button with no handler is the worst of both: Tab stops on it,
  // a screen reader calls it a button, and Enter does nothing. Seven of the
  // home page's feature cards ended in one.
  const dead = [];
  for (const file of components) {
    const src = strip(read(file));
    for (const tag of (src.match(/<button\b[^>]*>/g) || [])) {
      if (/onClick|type="submit"|onMouseDown|onPointerDown|\.\.\./.test(tag)) continue;
      dead.push(`${file}: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`);
    }
  }
  assertEqual(dead.join('\n       '), '', `button(s) that do nothing:\n       ${dead.join('\n       ')}`);
});

runTest('🚨 No control is nested inside another control', () => {
  // A pressable card containing a real button is invalid, and the two
  // announce over each other.
  const src = strip(read('src/pages/Home.jsx'));
  const cards = [...src.matchAll(/<div\n\s+className="p-5 rounded-2xl[\s\S]*?\n {12}<\/div>/g)];
  assert(cards.length >= 7, `expected the feature cards, found ${cards.length}`);
  for (const [card] of cards) {
    assert(card.includes('pressableProps('), 'a feature card is not operable from a keyboard');
    assert(!/<button/.test(card), 'a feature card still nests a button inside a control');
  }
});

runTest('🚨 Every pressable card says what it does', () => {
  // With the call-to-action no longer a button, the name has to come from
  // somewhere: otherwise the reader reads the heading, the description and
  // the call-to-action as one run-on label.
  const src = strip(read('src/pages/Home.jsx'));
  const cards = [...src.matchAll(/<div\n\s+className="p-5 rounded-2xl[^"]*"\n\s+([^\n]*)\n/g)];
  assert(cards.length >= 7, `expected the feature cards, found ${cards.length}`);
  for (const [, nextLine] of cards) {
    assert(/aria-label="[^"]+"/.test(nextLine), `a feature card has no accessible name: ${nextLine.trim()}`);
  }
});

console.log('\n🏷️  The roles that are used are complete');

runTest('🚨 No half-finished ARIA role is handed out', () => {
  // `role="tab"` outside a tablist, `option` outside a listbox and `radio`
  // outside a radiogroup each name a role and then give the reader no set to
  // place the control in. The tab strips report `aria-pressed` instead.
  for (const file of components) {
    const src = strip(read(file));
    for (const role of ['tab', 'option', 'radio', 'menuitem', 'treeitem']) {
      const used = new RegExp(`role:\\s*["']${role}["']|role="${role}"`).test(src);
      if (!used) continue;
      const container = { tab: 'tablist', option: 'listbox', radio: 'radiogroup', menuitem: 'menu', treeitem: 'tree' }[role];
      assert(
        new RegExp(`role="${container}"`).test(src),
        `${file} uses role="${role}" with no ${container} around it`
      );
    }
  }
});

runTest('🚨 Every tab strip announces which one is selected', () => {
  // The three strips, by the class that draws them — not every caller of the
  // handler. The membership badge beside the avatar also jumps to a tab, and
  // it is a shortcut rather than one of a set, so it has no selected state to
  // report and `aria-pressed` on it would be a third wrong answer.
  const profile = strip(read('src/pages/UserProfile.jsx'));
  const strips = ['shopee-sidebar-nav-item', 'shopee-coupon-tab-item', 'shopee-tab-item'];
  let checked = 0;
  for (const tag of clickableNonControls(profile)) {
    if (!strips.some((cls) => tag.includes(cls))) continue;
    if (!/handleTabChange|setCouponTab|setOrderStatusTab/.test(tag)) continue;
    assert(/pressed:/.test(tag), `a tab does not report whether it is selected: ${tag.slice(0, 90)}`);
    checked += 1;
  }
  assert(checked >= 8, `expected the profile's three tab strips, checked ${checked}`);
});

runTest('A decorative element is not given a tab stop', () => {
  // The logo takes an optional handler. Without one it is a picture, and a
  // picture announced as "button" is its own defect.
  const logo = strip(read('src/components/QueueUpLogo.tsx'));
  assert(
    /onClick \? pressableProps\(onClick\) : \{\}/.test(logo),
    'the logo is a tab stop even when it does nothing'
  );
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
