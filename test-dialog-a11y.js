/**
 * ============================================================================
 * DIALOG TEST SUITE
 * ============================================================================
 *
 * This app had seven modal surfaces and no two of them agreed on what a modal
 * is:
 *
 *   ChatModal             no role, no label, no Escape
 *   SellerAssistantModal  no role, no label, no Escape
 *   PdpaPolicyModal       no role, no label, no Escape
 *   ClientCartModal       role + label on the backdrop, no Escape
 *   ClientLoyaltyDrawer   role + label + Escape
 *   ToastProvider         role + label on the backdrop
 *   UserProfile           two deletion dialogs with none of it
 *
 * and not one of the seven trapped focus, restored it on close, or held the
 * page still behind it. In order of what it costs the person:
 *
 *  - **Tab walks out of the back.** Focus leaves the dialog and lands on the
 *    page underneath, which is still focusable and now invisible behind a dim
 *    layer. In the account-deletion dialog, what is back there is the profile
 *    being deleted.
 *  - **Escape did nothing** in four of the seven. The only way out was to find
 *    the ✕ or click the backdrop, and clicking a backdrop is not something a
 *    keyboard can do. That backdrop click is also why several of these looked
 *    like unreachable controls in the keyboard audit; the answer was never to
 *    make the dimmed layer a tab stop.
 *  - **Where the role did exist it was on the wrong element** — on the
 *    backdrop, which covers the whole viewport, so the "dialog" a screen
 *    reader was told about contained the entire page.
 *
 * Everything here goes through one hook, so there is one place to be right.
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
const strip = (s) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const components = execSync("git ls-files src | grep -E '\\.(jsx|tsx)$'", {
  cwd: new URL('.', root).pathname,
  encoding: 'utf8',
}).trim().split('\n');

/** Every file that paints a full-screen dimmed layer, i.e. every modal. */
function filesWithOverlays() {
  return components.filter((f) => {
    const src = strip(read(f));
    return /className="[^"]*(fixed inset-0|modal-overlay|assistant-backdrop|chat-overlay)/.test(src);
  });
}

const HOOK = 'src/hooks/useDialog.js';

console.log('\n🪟 The hook does the five things a dialog owes');

const hook = read(HOOK);

runTest('🚨 Escape closes, and the page behind does not also act on it', () => {
  assert(/event\.key === 'Escape'/.test(hook), 'Escape does not close the dialog');
  assert(/stopPropagation\(\)/.test(hook), 'Escape reaches the page behind the dialog as well');
});

runTest('🚨 Tab is trapped inside, in both directions', () => {
  assert(/event\.key !== 'Tab'/.test(hook), 'Tab is not handled at all');
  assert(/event\.shiftKey && active === first/.test(hook), 'Shift+Tab escapes off the front');
  assert(/!event\.shiftKey && active === last/.test(hook), 'Tab escapes off the end');
  assert(/!node \|\| !node\.contains\(active\)/.test(hook), 'focus already outside is never pulled back');
});

runTest('🚨 Focus moves in on open and returns to the opener on close', () => {
  assert(/openerRef\.current = document\.activeElement/.test(hook), 'the opener is never remembered');
  assert(/opener\.focus\(\)/.test(hook), 'focus is never returned');
  assert(/document\.contains\(opener\)/.test(hook), 'focus is returned to an element no longer on the page');
  assert(/focusableWithin\(node\)\[0\]/.test(hook), 'focus never enters the dialog');
});

runTest('🚨 The page behind is held still', () => {
  assert(/document\.body\.style\.overflow = 'hidden'/.test(hook), 'the page scrolls behind the dialog');
  assert(/document\.body\.style\.overflow = previous/.test(hook), 'the lock is never released');
});

runTest('🚨 A backdrop click closes only when it is really the backdrop', () => {
  // A drag that starts on text inside the dialog and releases outside it
  // would otherwise close the dialog and throw the selection away.
  assert(
    /event\.target !== event\.currentTarget/.test(hook),
    'a release outside the dialog closes it even when the press began inside'
  );
  assert(/closeOnBackdrop/.test(hook), 'a dialog cannot opt out of closing on a stray click');
});

runTest('The focusable set skips what cannot actually be reached', () => {
  assert(/tabindex="-1"/.test(hook), 'elements removed from the tab order are still trapped into');
  assert(/offsetParent !== null/.test(hook), 'a hidden control becomes an invisible stop in the cycle');

  // Every selector for something that can be disabled has to exclude the
  // disabled case, not just the first one in the list — a trap that stops on
  // a greyed-out button is a trap with no way forward.
  const list = hook.slice(hook.indexOf('const FOCUSABLE'), hook.indexOf('].join('));
  for (const el of ['button', 'input', 'select', 'textarea']) {
    const line = list.split('\n').find((l) => l.includes(`'${el}`));
    assert(line, `${el} is no longer counted as focusable`);
    assert(/:not\(\[disabled\]\)/.test(line), `a disabled <${el}> is treated as a focus stop`);
  }
});

console.log('\n📐 Every dialog in the app uses it');

runTest('🚨 No modal is left hand-rolled', () => {
  const missing = filesWithOverlays().filter((f) => !/useDialog\(/.test(strip(read(f))));
  assertEqual(
    missing.join(', '),
    '',
    `file(s) painting a modal without the dialog behaviour: ${missing.join(', ')}`
  );
});

runTest('🚨 The role sits on the panel, never on the backdrop', () => {
  // A role on the dimmed layer names the whole viewport as the dialog. Read
  // the backdrop's WHOLE opening tag: an attribute written before `className`
  // is just as much on the backdrop as one written after it.
  for (const file of filesWithOverlays()) {
    const src = strip(read(file));
    const re = /<div\b/g;
    let m;
    while ((m = re.exec(src))) {
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
      if (!/fixed inset-0|modal-overlay|assistant-backdrop|chat-overlay/.test(tag)) continue;
      assert(
        !/role="(dialog|alertdialog)"|dialogProps/.test(tag),
        `${file} declares the dialog on the backdrop rather than the panel: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`
      );
    }
  }
});

runTest('🚨 Every dialog is announced with a name', () => {
  for (const file of filesWithOverlays()) {
    const src = strip(read(file));
    for (const [, call] of src.matchAll(/useDialog\(\{([\s\S]*?)\}\)/g)) {
      assert(
        /labelledBy:|label:/.test(call),
        `${file} opens a dialog that a screen reader cannot name`
      );
      const m = call.match(/labelledBy:\s*['"]([^'"]+)['"]/);
      if (m) {
        assert(src.includes(`id="${m[1]}"`), `${file} points aria-labelledby at a missing id "${m[1]}"`);
      }
    }
  }
});

runTest('🚨 A confirmation cannot be dismissed by a stray tap beside it', () => {
  // Deleting an account and agreeing to a policy are not answers you give by
  // missing.
  for (const [file, count] of [['src/pages/UserProfile.jsx', 2], ['src/components/PdpaPolicyModal.jsx', 1]]) {
    const src = strip(read(file));
    const optedOut = [...src.matchAll(/closeOnBackdrop:\s*false/g)].length;
    assertEqual(optedOut, count, `${file} has ${optedOut} of ${count} dialogs guarded against a stray click`);
  }
});

runTest('🚨 The last step of deleting an account is an alertdialog', () => {
  const profile = strip(read('src/pages/UserProfile.jsx'));
  assert(/role:\s*["']alertdialog["']/.test(profile), 'the final deletion warning is an ordinary dialog');
});

runTest('A hook is never placed behind an early return', () => {
  // `if (!isOpen) return null` above a useDialog call is a hook order
  // violation that only shows up once the dialog opens.
  for (const file of filesWithOverlays()) {
    const src = strip(read(file));
    const early = src.indexOf('if (!isOpen) return null');
    const hookAt = src.indexOf('useDialog({');
    if (early < 0 || hookAt < 0) continue;
    assert(hookAt < early, `${file} calls useDialog after an early return`);
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
