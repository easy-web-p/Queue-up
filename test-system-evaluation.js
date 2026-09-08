/**
 * ============================================================================
 * SYSTEM EVALUATION WALL TEST SUITE
 * ============================================================================
 *
 * The evaluation wall on /queueup is public on purpose: the project's supervisor
 * and reviewers read the scores, and add their own, without holding an account.
 *
 * It had never worked. The client wrote five scores under a timestamp document id
 * while the rules demanded a uid-keyed document carrying a single `rating` field,
 * so — confirmed against the real rules engine — every write was rejected and
 * every read denied. The rejection was swallowed into localStorage and the page
 * said "ขอบคุณสำหรับผลประเมิน" regardless, so each evaluation existed only in the
 * browser that submitted it, and the wall showed three hardcoded samples under the
 * heading "ผลประเมินจริง".
 *
 * Covered here: the validation bounds on a public endpoint, the closed document
 * shape that stops the two halves disagreeing again, and the arithmetic and
 * wording that decide what a reviewer is actually shown. The collection's rules
 * are exercised in test-firestore-rules-emulator.js.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateEvaluation, SCORE_FIELDS, LIMITS } from './functions/systemEvaluation.js';

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

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message}\n       expected: ${expected}\n       actual:   ${actual}`);
  }
}

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(ROOT + f, 'utf8');

const VALID = {
  userName: 'อาจารย์ประจำวิชา CRM',
  uxScore: 9.5,
  accountScore: 9,
  queueScore: 10,
  merchantScore: 10,
  securityScore: 8.5,
  comment: 'สถาปัตยกรรมระบบสอดคล้องกับ Persona',
};

console.log('\n📊 SYSTEM EVALUATION WALL TEST SUITE\n');

// ===========================================================================
console.log('1. A submission from a reviewer without an account');
// ===========================================================================

runTest('A complete evaluation is accepted', () => {
  const result = validateEvaluation(VALID);
  assert(result.ok, `expected acceptance, got ${result.reason}`);
});

runTest('Scores typed into a range input arrive as strings and still count', () => {
  const result = validateEvaluation({ ...VALID, uxScore: '9.5', queueScore: '10' });
  assert(result.ok, 'string scores must be accepted');
  assertEqual(result.evaluation.uxScore, 9.5, 'and parsed as numbers');
});

runTest('Half points survive rather than being rounded to integers', () => {
  assertEqual(validateEvaluation({ ...VALID, uxScore: 8.5 }).evaluation.uxScore, 8.5);
});

runTest('A comment is optional', () => {
  const result = validateEvaluation({ ...VALID, comment: undefined });
  assert(result.ok, 'scores alone must be a valid evaluation');
  assertEqual(result.evaluation.comment, '', 'and store as empty rather than undefined');
});

// ===========================================================================
console.log('\n2. The public endpoint bounds what it is sent');
// ===========================================================================

runTest('🚨 Every one of the five scores is required', () => {
  for (const field of SCORE_FIELDS) {
    const result = validateEvaluation({ ...VALID, [field]: undefined });
    assert(!result.ok, `${field} must be required`);
    assertEqual(result.field, field, `the rejection must name ${field}`);
  }
});

runTest('🚨 A score outside 0-10 is refused', () => {
  for (const bad of [-1, 10.1, 100, 'ดีมาก', NaN, Infinity, null]) {
    const result = validateEvaluation({ ...VALID, uxScore: bad });
    assert(!result.ok, `${JSON.stringify(bad)} must be refused`);
  }
});

runTest('🚨 Zero is a real score, not a missing one', () => {
  // The page used to read a score with `Number(item.uxScore || 9)`, which turns a
  // deliberate 0 into 9 — the harshest review is the one silently rewritten.
  const result = validateEvaluation({ ...VALID, uxScore: 0 });
  assert(result.ok, '0 must be accepted');
  assertEqual(result.evaluation.uxScore, 0, '0 must survive validation intact');
});

runTest('Both ends of the range are accepted', () => {
  assert(validateEvaluation({ ...VALID, uxScore: LIMITS.score.min }).ok, 'the minimum');
  assert(validateEvaluation({ ...VALID, uxScore: LIMITS.score.max }).ok, 'the maximum');
});

runTest('🚨 A name is required and length-bounded', () => {
  assert(!validateEvaluation({ ...VALID, userName: '' }).ok, 'a name is required');
  assert(!validateEvaluation({ ...VALID, userName: 'ก' }).ok, 'one character is not a name');
  assert(validateEvaluation({ ...VALID, userName: 'ก'.repeat(LIMITS.userName.max) }).ok, 'at the limit');
  assert(!validateEvaluation({ ...VALID, userName: 'ก'.repeat(LIMITS.userName.max + 1) }).ok, 'over it');
});

runTest('🚨 A comment is length-bounded', () => {
  assert(validateEvaluation({ ...VALID, comment: 'ก'.repeat(LIMITS.comment.max) }).ok, 'at the limit');
  const over = validateEvaluation({ ...VALID, comment: 'ก'.repeat(LIMITS.comment.max + 1) });
  assert(!over.ok, 'over the limit must be refused');
  assertEqual(over.field, 'comment');
});

runTest('🚨 A name cannot carry control characters onto a public page', () => {
  // A newline in a display name breaks the wall's layout and is the usual way one
  // entry is made to read as several.
  const result = validateEvaluation({ ...VALID, userName: 'อาจารย์\n\n⭐⭐⭐ 10/10' });
  assert(!result.ok, 'a name with a newline must be refused');
  assertEqual(result.reason, 'CONTROL_CHARACTERS');
});

runTest('🚨 A NUL byte is refused in a comment', () => {
  assert(!validateEvaluation({ ...VALID, comment: 'ok' + '\u0000' + 'hidden' }).ok, 'NUL must never pass');
});

runTest('Line breaks are still allowed in a comment', () => {
  assert(validateEvaluation({ ...VALID, comment: 'ข้อดี\nข้อเสีย' }).ok, 'a multi-line comment');
});

runTest('A non-object payload is refused rather than crashing', () => {
  for (const junk of [null, undefined, 'string', 42, []]) {
    assert(!validateEvaluation(junk).ok, `${JSON.stringify(junk)} must be refused`);
  }
});

// ===========================================================================
console.log('\n3. One shape, in one place');
// ===========================================================================

runTest('🚨 The stored shape is exactly what the wall renders', () => {
  // The whole failure was two halves disagreeing about the document: five scores
  // written, a single `rating` demanded. The shape is asserted here so a change to
  // one half without the other fails a test rather than production.
  const keys = Object.keys(validateEvaluation(VALID).evaluation).sort();
  assertEqual(
    keys.join(','),
    'accountScore,comment,merchantScore,queueScore,securityScore,userName,uxScore',
    'the document shape must be closed'
  );
});

runTest('🚨 An unexpected key cannot ride along into storage', () => {
  const result = validateEvaluation({ ...VALID, rating: 5, userId: 'admin_root', createdAt: 'forged' });
  assert(result.ok, 'the valid fields must still be accepted');
  for (const forged of ['rating', 'userId', 'createdAt']) {
    assert(!(forged in result.evaluation), `"${forged}" must not survive validation`);
  }
});

runTest('The function rebuilds the document rather than spreading the request', () => {
  const src = read('functions/index.js');
  const block = src.slice(src.indexOf('export const submitSystemEvaluation'));
  const body = block.slice(0, block.indexOf('\n);'));
  assert(body.includes('...validation.evaluation'), 'the validated result must be what is written');
  assert(!/\.\.\.request\.data|\.\.\.data\b/.test(body), 'the raw request must never be spread');
});

runTest('🚨 Submissions are rate limited', () => {
  const src = read('functions/index.js');
  const block = src.slice(src.indexOf('export const submitSystemEvaluation'));
  const body = block.slice(0, block.indexOf('\n);'));
  assert(body.includes('consumeRateLimit'), 'an unauthenticated write path must be limited');
  assert(body.includes('evaluation_rate_limits'), 'it must use its own counter collection');
});

// ===========================================================================
console.log('\n4. Public to read, backend-only to write');
// ===========================================================================

const rules = read('firestore.rules');

function rulesBlock(path) {
  const start = rules.indexOf(`match ${path}`);
  assert(start !== -1, `no rules block for ${path}`);
  const bodyStart = rules.indexOf('\n', start);
  const end = rules.indexOf('\n    }', bodyStart);
  assert(end !== -1, `unterminated rules block for ${path}`);
  return rules.slice(bodyStart, end);
}

runTest('🚨 Anyone can read the wall, with or without an account', () => {
  const body = rulesBlock('/systemEvaluations/');
  assert(/allow read: if true/.test(body), 'a supervisor without an account must be able to read it');
});

runTest('🚨 No client can write an evaluation directly', () => {
  const body = rulesBlock('/systemEvaluations/');
  assert(/allow write: if false/.test(body), 'the browser must never write an evaluation');
  assert(!/allow create: if isAuthenticated/.test(body), 'the old mismatched rule must be gone');
});

runTest('🚨 The rate-limit counter is fully closed', () => {
  const body = rulesBlock('/evaluation_rate_limits/');
  assert(/allow read, write: if false/.test(body), 'a resettable quota is not a quota');
});

// ===========================================================================
console.log('\n5. The page reports what is actually there');
// ===========================================================================

const lib = read('src/lib/firebase.js');
const page = read('src/pages/Queueup.jsx');

runTest('🚨 A failed submission is no longer swallowed into localStorage', () => {
  const fn = lib.slice(lib.indexOf('export const submitEvaluationToFirestore'));
  const body = fn.slice(0, fn.indexOf('\n};'));
  assert(body.includes('httpsCallable'), 'the write must go through the Cloud Function');
  assert(!/localStorage/.test(body), 'a rejected write must not be reported as saved');
  assert(!/catch/.test(body), 'a failure must reach the caller');
});

runTest('🚨 The thank-you is shown only after the evaluation is stored', () => {
  const handler = page.slice(page.indexOf('const handleEvalSubmit'), page.indexOf('// Scroll listener'));
  const awaitIdx = handler.indexOf('await submitEvaluationToFirestore');
  const thanksIdx = handler.indexOf('toast.success');
  assert(awaitIdx !== -1, 'the submission must be awaited');
  assert(thanksIdx > awaitIdx, 'thanks must not precede the write');
  assert(handler.includes('catch'), 'a failure must be shown, not ignored');
  assert(handler.includes('toast.error'), 'and shown as an error');
});

runTest('🚨 An empty wall is empty, not filled with samples', () => {
  // The heading counts them as "ผลประเมินจริง". Three hardcoded entries under that
  // heading is a fabricated result shown to the reviewer the page exists for.
  assert(!/INITIAL_EVALUATIONS/.test(lib), 'the seed substitution must be gone');
  assert(!/INITIAL_EVALUATIONS/.test(page), 'and unused by the page');
  const fetchFn = lib.slice(lib.indexOf('export const fetchEvaluationsFromFirestore'));
  const body = fetchFn.slice(0, fetchFn.indexOf('\n};'));
  assert(!/localStorage/.test(body), 'a real empty collection must read as empty');
});

runTest('🚨 No headline score is invented when nobody has evaluated', () => {
  // It used to return a 9.2/10 average beside "จากผลประเมินจริง 0 รายการ".
  const memo = page.slice(page.indexOf('const scores = useMemo'), page.indexOf('const showScore'));
  assert(/count === 0/.test(memo), 'the empty case must be handled explicitly');
  assert(/total: null/.test(memo), 'and must produce no score at all');
  assert(!/total: 9\.2|ux: 9\.5/.test(memo), 'no invented averages may remain');
});

runTest('🚨 A score of 0 is not read as a missing score', () => {
  // `Number(item.uxScore || 9)` reads a deliberate 0 as 9. Any numeric ||-fallback
  // in the score arithmetic does the same, whichever field it is written against,
  // so the whole region is checked rather than the two literals that used to be
  // there — a renamed variable would otherwise slip the same bug back in.
  const region = page.slice(
    page.indexOf('const scores = useMemo'),
    page.indexOf('// Handle User Evaluation Form Submission')
  );
  assert(region.length > 0, 'the score arithmetic must be locatable');
  // `|| 0` is exempt: substituting zero for an absent value cannot turn a real
  // zero into something else, and the bar-width helper needs it.
  const fallbacks = region.match(/\|\|\s*[1-9]/g) || [];
  assert(
    fallbacks.length === 0,
    `a non-zero ||-fallback rewrites a real 0: found ${fallbacks.join(', ')}`
  );
  assert(/Number\.isFinite/.test(region), 'a present-but-zero score must be distinguished from absent');
});

runTest('🚨 A blank comment is not replaced with invented praise', () => {
  // An evaluator who scored the system without commenting was quoted saying
  // "สถาปัตยกรรมระบบสมบูรณ์และใช้งานได้จริงดีเยี่ยม" — words they never wrote.
  assert(
    !page.includes('item.comment || "สถาปัตยกรรมระบบสมบูรณ์'),
    'no words may be put in an evaluator\'s mouth'
  );
});

runTest('Evaluators are told their name and comment are public', () => {
  assert(page.includes('แสดงต่อสาธารณะ'), 'publishing a name requires saying so');
});

// ===========================================================================
console.log('\n6. The contact form on the same page also reaches someone');
// ===========================================================================

runTest('🚨 The contact form no longer fakes a send with setTimeout', () => {
  const handler = page.slice(page.indexOf('const handleContactSubmit'), page.indexOf('// Form Inputs for Rating'));
  assert(!/setTimeout/.test(handler), 'a 600ms timer is not a submission');
  assert(handler.includes('await submitPilotLead'), 'the enquiry must actually be sent');
  const successIdx = handler.indexOf('setIsContactSuccess(true)');
  const awaitIdx = handler.indexOf('await submitPilotLead');
  assert(successIdx > awaitIdx, 'success must not be declared before the send returns');
  assert(handler.includes('toast.error'), 'a failure must be shown');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
