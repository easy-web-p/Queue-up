/**
 * ============================================================================
 * ACCOUNT CODE TEST SUITE
 * ============================================================================
 *
 * The profile's "รหัสบัญชี" panel was four separate claims, none of them true.
 *
 *  1. **It was a secret.** Masked behind `••••••••••••••••` with an eye
 *     toggle — and a copy button on the same row that handed over the whole
 *     value regardless. Nothing authenticates with it and nothing looks
 *     anything up by it, so the mask taught people to protect something that
 *     protects nothing.
 *
 *  2. **It was verified.** "แก้ไขรหัสบัญชี" opened a modal titled
 *     "ยืนยันตัวตนด้วยรหัสผ่าน" whose entire check was
 *     `if (!verifyPasswordInput.trim())`. Type any character and it wrote the
 *     new value and announced "ยืนยันรหัสผ่านสำเร็จ!". The panel two rows below
 *     says "วิธีการเข้าสู่ระบบ: Google Account" — there is no password to type.
 *     A check that verifies nothing and then reports success is worse than no
 *     check, because someone reading that screen now believes one happened.
 *
 *  3. **It was cryptographic.** `generateSecureAccountId` was documented as
 *     "128-bit Security" and produced `(array[0] ^ array[1])` of two Uint32
 *     values — 32 bits — on the end of a date, a clock minute, and a
 *     "sequential user index" that was the literal constant 58140 at two of
 *     its three call sites.
 *
 *  4. **It was an identifier.** It was read from localStorage, so it differed
 *     per device; regenerated on the email-login path whenever the profile
 *     document lacked the field, so it differed per login; and editable to any
 *     string the user typed.
 *
 * What replaces it is derived from the uid: the same code on every device, on
 * every login, forever, and not stored anywhere to drift from.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { deriveAccountCode, isAccountCode } from './src/utils/accountCode.ts';

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
const stripComments = (src) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

console.log('\n🆔 The code identifies one account, always the same way');

runTest('🚨 The same uid always gives the same code', () => {
  // The whole point. The old one was minted from the clock, so it changed
  // between two logins a minute apart.
  const uid = 'x9Xk2LmNoPqRsTuV';
  const first = deriveAccountCode(uid);
  for (let i = 0; i < 50; i += 1) {
    assertEqual(deriveAccountCode(uid), first, 'the code changed between calls');
  }
  assert(isAccountCode(first), `${first} is not shaped like an account code`);
});

runTest('🚨 Two hundred thousand uids give two hundred thousand codes', () => {
  // The code is eight base-28 characters, and it is derived from two hash
  // rounds over different seeds rather than one. That is not decoration: with
  // a single 32-bit round this same population collides about ten times, and
  // a collision means two students reading out the same reference. Run at a
  // size where the difference is unambiguous.
  const seen = new Map();
  const N = 300000;
  let collisions = 0;
  for (let i = 0; i < N; i += 1) {
    const uid = `uid_${i}`;
    const code = deriveAccountCode(uid);
    if (seen.has(code)) collisions += 1;
    else seen.set(code, uid);
  }
  assert(
    collisions <= 2,
    `${collisions} collisions in ${N} codes — the derivation lost most of its space`
  );
  assert(isAccountCode(seen.keys().next().value), 'the codes are not the right shape');
});

runTest('🚨 The alphabet cannot be misheard or misread', () => {
  // A child reads this to canteen staff across a counter.
  const banned = ['O', '0', 'I', '1', 'L'];
  for (let i = 0; i < 3000; i += 1) {
    const code = deriveAccountCode(`uid_${i}`).slice(4);
    for (const ch of banned) {
      assert(!code.includes(ch), `${code} contains ${ch}, which is read wrong`);
    }
  }
});

runTest('🚨 A code cannot come out as a word', () => {
  // No vowels in the alphabet, so nothing spells anything a school would have
  // to explain.
  for (const vowel of ['A', 'E', 'I', 'O', 'U']) {
    for (let i = 0; i < 2000; i += 1) {
      assert(
        !deriveAccountCode(`uid_${i}`).slice(4).includes(vowel),
        `a code contains the vowel ${vowel}`
      );
    }
  }
});

runTest('No uid means no code, rather than a code belonging to nobody', () => {
  for (const empty of [null, undefined, '', '   ', 42, {}]) {
    assertEqual(deriveAccountCode(empty), null, `${JSON.stringify(empty)} produced a code`);
  }
  assert(!isAccountCode(null) && !isAccountCode('QUP-0000-0000'), 'the shape check is not checking');
});

console.log('\n🔓 It is not presented as a secret');

runTest('🚨 The profile does not mask the code', () => {
  // Masking it while a copy button beside the mask hands over the whole value
  // is not protection; it is instruction to treat it as protected.
  const profile = stripComments(read('src/pages/UserProfile.jsx'));
  assert(!profile.includes('••••••'), 'the account code is still masked');
  assert(!/showAccountId/.test(profile), 'the reveal toggle is still there');
});

runTest('🚨 The profile says what the code is for, and what it is not', () => {
  const profile = read('src/pages/UserProfile.jsx');
  assert(profile.includes('ไม่ใช่รหัสผ่าน'), 'nothing tells the reader it is not a password');
  assert(profile.includes('เจ้าหน้าที่'), 'nothing says who to give it to');
});

console.log('\n🚫 Nothing fakes a password check');

runTest('🚨 The password-verification modal is gone', () => {
  // Its whole check was that the box was non-empty, and then it reported
  // success — on accounts that have no password at all.
  const profile = stripComments(read('src/pages/UserProfile.jsx'));
  for (const trace of [
    'isPasswordVerifyModalOpen',
    'verifyPasswordInput',
    'newAccountIdInput',
    'handleConfirmAccountEdit',
    'ยืนยันรหัสผ่านสำเร็จ',
  ]) {
    assert(!profile.includes(trace), `${trace} is still in the profile`);
  }
});

runTest('🚨 No screen claims a password was verified without verifying one', () => {
  // The same shape anywhere else is the same bug. A real check calls
  // reauthenticate; a `.trim()` on an input and a success toast is not one.
  const pages = readdirSync(new URL('src/pages/', root)).filter((f) => /\.(jsx|tsx)$/.test(f));
  assert(pages.length > 10, `only ${pages.length} pages were scanned`);

  for (const file of pages) {
    const src = stripComments(read(`src/pages/${file}`));
    const claimsVerified = /ยืนยันรหัสผ่านสำเร็จ|password verified/i.test(src);
    if (!claimsVerified) continue;
    assert(
      /reauthenticate|signInWithEmailAndPassword|EmailAuthProvider/.test(src),
      `${file} reports a password as verified without ever checking one`
    );
  }
});

runTest('The account deletion flow still does verify, because that one must', () => {
  // The neighbouring flow in the same file was fixed for this exact bug once;
  // this test is what stops it regressing back alongside its twin.
  const profile = read('src/pages/UserProfile.jsx');
  assert(/reauthenticate/i.test(profile), 'account deletion no longer proves who is asking');
});

console.log('\n🧹 The old generator and its storage are gone');

runTest('🚨 generateSecureAccountId no longer exists', () => {
  const security = read('src/utils/security.js');
  assert(
    !/export const generateSecureAccountId/.test(security),
    'the generator is back — 32 bits under a comment claiming 128'
  );
  assert(!security.includes('128-bit Security'), 'the false entropy claim is back');
  for (const file of ['src/pages/Login.jsx', 'src/pages/UserProfile.jsx']) {
    assert(
      !stripComments(read(file)).includes('generateSecureAccountId'),
      `${file} still calls the generator`
    );
  }
});

runTest('🚨 The code is not read from or written to localStorage', () => {
  // Per-device storage made it a different code on every device. Sign-out
  // paths may still clear the stale key; nothing may set or read it.
  for (const file of ['src/pages/Login.jsx', 'src/pages/UserProfile.jsx']) {
    const src = stripComments(read(file));
    assert(
      !/localStorage\.(setItem|getItem)\(\s*["']queueup_secure_account_id/.test(src),
      `${file} still reads or writes the code in localStorage`
    );
  }
});

runTest('🚨 The code is derived at every place it is shown', () => {
  const profile = stripComments(read('src/pages/UserProfile.jsx'));
  assert(profile.includes('deriveAccountCode('), 'the profile no longer derives the code');
  assert(!/setAccountId/.test(profile), 'something can still assign the code a different value');

  const login = stripComments(read('src/pages/Login.jsx'));
  assert(login.includes('deriveAccountCode('), 'login no longer derives the code');
  assert(!/58140/.test(login), 'the hardcoded "sequential user index" is back');
  assert(!/Math\.random\(\)/.test(login.slice(login.indexOf('GoogleAuthProvider'))), 'a random id is back');
});

runTest('🚨 No stale copy is stored beside the uid it comes from', () => {
  // A derived value written next to its own input is how the two drift. The
  // document carries `uid`; the code is a function of it.
  const login = stripComments(read('src/pages/Login.jsx'));
  assert(
    !/accountId:\s*(accountId|finalAccountId)\b/.test(login),
    'login writes the derived code into the profile document again'
  );
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
