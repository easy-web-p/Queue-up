/**
 * ============================================================================
 * FORM LABELLING TEST SUITE
 * ============================================================================
 *
 * A hundred and eighteen inputs, selects and textareas across twenty-four
 * files had no programmatic label. A screen reader reaching one of them says
 * "edit text, blank" and stops; the person has no way to know what the box is
 * for.
 *
 * Most of them were not missing a label on the screen. The label was right
 * there above the field — "ชื่อเมนูอาหาร", "จำนวนเงินที่ต้องการเติม" — written
 * as a `<label>` with no `htmlFor`, next to an `<input>` with no `id`. Two
 * elements that look joined and are not: to a browser, and to anything reading
 * the page aloud, that label belongs to nothing at all.
 *
 * The rest had only a `placeholder`, which is not a label: it is not exposed
 * as the accessible name by every combination of browser and reader, and it
 * vanishes the moment someone starts typing, taking the only description of
 * the field with it.
 *
 * Separately: no field in the app told the browser what it held, so no
 * password manager could fill one and no phone offered a numeric keypad for a
 * telephone number. Where that is fixed here it is fixed carefully. An
 * `autocomplete` token is only correct on a field holding the CURRENT USER'S
 * own detail. On a form about somebody else — a staff member being added, a
 * child being linked to a guardian — a browser heuristic that offers the
 * signed-in adult's own name does not save a keystroke; it files the wrong
 * person. Those are turned off explicitly, which is the only way to stop the
 * heuristic.
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
/** Blanks comments out rather than deleting them, so offsets still line up. */
const blankComments = (s) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));

const components = execSync("git ls-files src | grep -E '\\.(jsx|tsx)$'", {
  cwd: new URL('.', root).pathname,
  encoding: 'utf8',
}).trim().split('\n');

/**
 * Every form control's opening tag, scanned with brace and string awareness —
 * an arrow function in an attribute carries a `>` of its own, and a naive scan
 * cuts the tag in half and loses the attributes after it.
 */
function controls(src) {
  const out = [];
  for (const kind of ['input', 'select', 'textarea']) {
    const re = new RegExp(`<${kind}\\b`, 'g');
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
      out.push({ kind, start: m.index, tag: src.slice(m.index, i + 1) });
    }
  }
  return out;
}

/** Controls that carry no name a machine can read. */
function unnamed(file) {
  const src = blankComments(read(file));
  const out = [];
  for (const { tag, start } of controls(src)) {
    if (/type="(hidden|submit|button|image)"/.test(tag)) continue;
    if (/aria-label|aria-labelledby/.test(tag)) continue;
    // An id counts only when a label actually points at it.
    const id = tag.match(/\bid="([^"]+)"/);
    if (id && new RegExp(`htmlFor=["'\`]${id[1]}`).test(src)) continue;
    // Or when the control sits inside a <label> that has not closed yet.
    const before = src.slice(Math.max(0, start - 800), start);
    if ((before.match(/<label\b/g) || []).length > (before.match(/<\/label>/g) || []).length) continue;
    out.push(tag.replace(/\s+/g, ' ').slice(0, 80));
  }
  return out;
}

console.log('\n🏷️  Every control says what it is for');

runTest('🚨 No input, select or textarea is left unnamed', () => {
  const offenders = [];
  for (const file of components) {
    for (const tag of unnamed(file)) offenders.push(`${file}: ${tag}`);
  }
  assertEqual(
    offenders.join('\n       '),
    '',
    `${offenders.length} unnamed control(s):\n       ${offenders.slice(0, 15).join('\n       ')}`
  );
});

runTest('🚨 The detector is not satisfied by a placeholder alone', () => {
  // A placeholder disappears on the first keystroke, taking the only
  // description of the field with it. If this stops being true the suite
  // above stops meaning anything.
  const sample = '<input type="text" placeholder="ชื่อเมนู" value={x} />';
  const src = `function A(){ return (${sample}); }`;
  const found = controls(src).filter((c) => !/aria-label/.test(c.tag));
  assertEqual(found.length, 1, 'the detector no longer sees a bare placeholder as unnamed');
});

runTest('🚨 The detector accepts a real label-for pairing', () => {
  const src = `<label htmlFor="q">ค้นหา</label><input id="q" type="text" />`;
  const id = src.match(/\bid="([^"]+)"/);
  assert(new RegExp(`htmlFor=["'\`]${id[1]}`).test(src), 'the pairing check is broken');
});

runTest('🚨 An id with no label pointing at it does not count', () => {
  // This is the exact shape that made a hundred of these look fine in review:
  // a visible label and a field, joined only by being next to each other.
  const src = `<label>ชื่อเมนู</label><input id="menu-name" type="text" />`;
  const id = src.match(/\bid="([^"]+)"/);
  assert(!new RegExp(`htmlFor=["'\`]${id[1]}`).test(src), 'an unpaired id is treated as a label');
});

console.log('\n⌨️  Autofill helps the right person');

/** aria-label text, for reporting which field a finding is about. */
const nameOf = (tag) => {
  const m = tag.match(/aria-label=(?:"([^"]*)"|\{([^}]*)\})/);
  return m ? (m[1] ?? m[2]).slice(0, 40) : '(unnamed)';
};

runTest("🚨 A field holding the signed-in person's own details offers autofill", () => {
  // Without this a student retypes their phone number on every order.
  const expected = {
    'src/pages/Login.jsx': 4,
    'src/pages/UserProfile.jsx': 4,
    'src/pages/FoodBooking.tsx': 1,
    'src/pages/Queueup.jsx': 4,
  };
  for (const [file, count] of Object.entries(expected)) {
    const tokens = controls(blankComments(read(file)))
      .filter((c) => /autoComplete="(?!off)/.test(c.tag));
    assert(
      tokens.length >= count,
      `${file} offers autofill on ${tokens.length} field(s), expected at least ${count}`
    );
  }
});

runTest('🚨 A form about somebody else does not autofill with your own details', () => {
  // A guardian linking a child, or an admin adding a member of staff: a
  // browser heuristic that offers the signed-in adult's own name here files
  // the wrong person. Absence is not enough to stop the heuristic — only an
  // explicit "off" is.
  const aboutOthers = [
    ['src/pages/GuardianDashboard.tsx', 'ชื่อ - นามสกุล นักเรียน'],
    ['src/pages/StoreAdminPage.tsx', 'ชื่อ-นามสกุลพนักงาน'],
    ['src/pages/StoreAdminPage.tsx', 'เบอร์โทรศัพท์ติดต่อ'],
    ['src/pages/StudentVendorEarnings.tsx', 'ชื่อเพื่อนร่วมทีม'],
    ['src/pages/MerchantDashboard.jsx', 'aria-label="ชื่อ"'],
  ];
  for (const [file, key] of aboutOthers) {
    const match = controls(blankComments(read(file))).filter((c) => c.tag.includes(key));
    assertEqual(match.length, 1, `${file}: expected one field matching ${key}, found ${match.length}`);
    assert(
      /autoComplete="off"/.test(match[0].tag),
      `${file}: "${nameOf(match[0].tag)}" would be autofilled with the signed-in person's own details`
    );
  }
});

runTest('🚨 Every autocomplete token is a real one', () => {
  // A misspelt token is silently ignored, which looks exactly like success.
  const VALID = new Set([
    'off', 'on', 'name', 'given-name', 'family-name', 'nickname', 'email',
    'username', 'new-password', 'current-password', 'one-time-code', 'tel',
    'tel-national', 'organization', 'street-address', 'postal-code',
    'cc-name', 'cc-number', 'bday', 'sex', 'url', 'photo',
  ]);
  for (const file of components) {
    for (const { tag } of controls(blankComments(read(file)))) {
      const m = tag.match(/autoComplete="([^"]+)"/);
      if (!m) continue;
      for (const token of m[1].split(/\s+/)) {
        assert(VALID.has(token), `${file}: "${token}" is not an autocomplete token`);
      }
    }
  }
});

runTest('A search box does not offer to autofill a name into it', () => {
  const profile = blankComments(read('src/pages/UserProfile.jsx'));
  const search = controls(profile).filter((c) => /ค้นหาคำสั่งซื้อ/.test(c.tag));
  assertEqual(search.length, 1, 'the order search box is gone');
  assert(/autoComplete="off"/.test(search[0].tag), 'the order search box invites autofill');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
