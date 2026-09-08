/**
 * ============================================================================
 * PILOT PROGRAMME LEAD CAPTURE TEST SUITE
 * ============================================================================
 *
 * The landing page's pilot form is the product's only inbound channel for schools.
 * It showed "บันทึกข้อมูลเรียบร้อยแล้ว" and promised a callback within 24 hours
 * while its submit handler did nothing but console.log(), so every enquiry a school
 * ever sent was discarded — silently, and with a PDPA confidentiality notice
 * printed beside the form.
 *
 * Covered here:
 *  - the validation boundaries, which are the only thing standing between an
 *    unauthenticated public endpoint and whatever a script decides to send;
 *  - that the stored document is rebuilt field by field rather than spread;
 *  - that the page cannot claim success unless the write actually happened.
 *
 * The collection's own rules are exercised against the real rules engine in
 * test-firestore-rules-emulator.js.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  validatePilotLead,
  normalisePhone,
  rateLimitKeyForAddress,
  LIMITS,
} from './functions/pilotLead.js';

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

/** A submission that should always be accepted, so each test varies one thing. */
const VALID = {
  schoolName: 'โรงเรียนสาธิตมหาวิทยาลัยขอนแก่น',
  studentCount: '1,000 - 2,500 คน',
  contactName: 'สมชาย ใจดี',
  position: 'รองผู้อำนวยการฝ่ายบริหาร',
  phone: '081-234-5678',
  email: 'Somchai@School.AC.TH',
  notes: 'ขอนัด Live Demo วันพุธหน้า',
};

console.log('\n🏫 PILOT PROGRAMME LEAD CAPTURE TEST SUITE\n');

// ===========================================================================
console.log('1. A real submission is accepted and normalised');
// ===========================================================================

runTest('A complete submission is accepted', () => {
  const result = validatePilotLead(VALID);
  assert(result.ok, `expected acceptance, got ${result.reason}`);
});

runTest('The phone number is stored as digits regardless of how it was typed', () => {
  for (const written of ['081-234-5678', '081 234 5678', '(081) 234-5678', '+66812345678', '0812345678']) {
    assertEqual(normalisePhone(written), '0812345678', `"${written}"`);
  }
});

runTest('The email is lowercased so the same address is one address', () => {
  assertEqual(validatePilotLead(VALID).lead.email, 'somchai@school.ac.th');
});

runTest('Surrounding whitespace is trimmed rather than stored', () => {
  const lead = validatePilotLead({ ...VALID, schoolName: '   โรงเรียนสาธิต   ' }).lead;
  assertEqual(lead.schoolName, 'โรงเรียนสาธิต');
});

runTest('Optional fields may be omitted entirely', () => {
  const result = validatePilotLead({
    schoolName: VALID.schoolName,
    contactName: VALID.contactName,
    phone: VALID.phone,
    email: VALID.email,
  });
  assert(result.ok, `optional fields must not be required: ${result.reason}`);
  assertEqual(result.lead.notes, '', 'an omitted field must store as empty, not undefined');
});

// ===========================================================================
console.log('\n2. The public endpoint validates what it is sent');
// ===========================================================================

runTest('🚨 Required fields are required', () => {
  for (const field of ['schoolName', 'contactName', 'phone', 'email']) {
    const result = validatePilotLead({ ...VALID, [field]: '' });
    assert(!result.ok, `${field} must be required`);
    assertEqual(result.field, field, `the rejection must name ${field}`);
  }
});

runTest('🚨 Every field is length-bounded', () => {
  const cases = [
    ['schoolName', LIMITS.schoolName.max],
    ['contactName', LIMITS.contactName.max],
    ['position', LIMITS.position.max],
    ['studentCount', LIMITS.studentCount.max],
    ['notes', LIMITS.notes.max],
  ];
  for (const [field, max] of cases) {
    const atLimit = validatePilotLead({ ...VALID, [field]: 'ก'.repeat(max) });
    assert(atLimit.ok, `${field} must accept exactly ${max} characters`);
    const overLimit = validatePilotLead({ ...VALID, [field]: 'ก'.repeat(max + 1) });
    assert(!overLimit.ok, `${field} must reject ${max + 1} characters`);
    assertEqual(overLimit.field, field, `the rejection must name ${field}`);
  }
});

runTest('🚨 A malformed phone number is refused', () => {
  // A lead nobody can call back is not a lead. Each of these otherwise reaches the
  // "we will contact you within 24 hours" panel.
  for (const bad of ['12345', 'ไม่มี', '08123456789012', 'someone@example.com', '']) {
    assert(!validatePilotLead({ ...VALID, phone: bad }).ok, `"${bad}" must be refused`);
  }
});

runTest('Both 9- and 10-digit Thai numbers are accepted', () => {
  assert(validatePilotLead({ ...VALID, phone: '021234567' }).ok, 'a 9-digit landline');
  assert(validatePilotLead({ ...VALID, phone: '0812345678' }).ok, 'a 10-digit mobile');
});

runTest('🚨 A malformed email is refused', () => {
  for (const bad of ['not-an-email', 'a@b', '@example.com', 'a b@example.com']) {
    assert(!validatePilotLead({ ...VALID, email: bad }).ok, `"${bad}" must be refused`);
  }
});

runTest('🚨 Control characters cannot be smuggled into a single-line field', () => {
  // A newline in a contact name is how a lead notification grows headers it should
  // not have, and how a console or spreadsheet view is made to lie about a row.
  const injected = 'สมชาย\r\nBcc: attacker@example.com';
  const result = validatePilotLead({ ...VALID, contactName: injected });
  assert(!result.ok, 'a name carrying CRLF must be refused');
  assertEqual(result.reason, 'CONTROL_CHARACTERS');
});

runTest('Line breaks are still allowed in the notes field', () => {
  // It is a textarea; refusing newlines there would refuse ordinary use.
  const result = validatePilotLead({ ...VALID, notes: 'บรรทัดหนึ่ง\nบรรทัดสอง' });
  assert(result.ok, 'a multi-line note must be accepted');
});

runTest('🚨 A NUL byte is refused even in notes', () => {
  assert(!validatePilotLead({ ...VALID, notes: 'ok' + '\u0000' + 'hidden' }).ok, 'NUL must never pass');
});

runTest('A non-object payload is refused rather than crashing', () => {
  for (const junk of [null, undefined, 'string', 42, []]) {
    const result = validatePilotLead(junk);
    assert(!result.ok, `${JSON.stringify(junk)} must be refused`);
  }
});

// ===========================================================================
console.log('\n3. Only validated fields reach the document');
// ===========================================================================

runTest('🚨 An unexpected key cannot ride along into storage', () => {
  const result = validatePilotLead({ ...VALID, status: 'CONVERTED', isAdmin: true, createdAt: 'forged' });
  assert(result.ok, 'the valid fields must still be accepted');
  for (const forged of ['status', 'isAdmin', 'createdAt']) {
    assert(!(forged in result.lead), `"${forged}" must not survive validation`);
  }
});

runTest('The stored shape is exactly the seven form fields', () => {
  const keys = Object.keys(validatePilotLead(VALID).lead).sort();
  assertEqual(
    keys.join(','),
    'contactName,email,notes,phone,position,schoolName,studentCount',
    'the document shape must be closed'
  );
});

runTest('The function rebuilds the document rather than spreading the request', () => {
  const src = read('functions/index.js');
  const block = src.slice(src.indexOf('export const submitPilotLead'));
  const body = block.slice(0, block.indexOf('\n);'));
  assert(body.includes('...validation.lead'), 'the validated result must be what is written');
  assert(
    !/\.\.\.request\.data|\.\.\.data\b/.test(body),
    'the raw request must never be spread into the document'
  );
});

// ===========================================================================
console.log('\n4. The endpoint is unauthenticated, so it is rate limited');
// ===========================================================================

runTest('🚨 Submissions are rate limited', () => {
  const src = read('functions/index.js');
  const block = src.slice(src.indexOf('export const submitPilotLead'));
  const body = block.slice(0, block.indexOf('\n);'));
  assert(body.includes('consumeRateLimit'), 'an unauthenticated write path must be limited');
  assert(body.includes('pilot_lead_rate_limits'), 'it must use its own counter collection');
});

runTest('An address is reduced to a usable, non-empty document id', () => {
  assertEqual(rateLimitKeyForAddress('203.0.113.7'), '203_0_113_7', 'IPv4');
  assertEqual(rateLimitKeyForAddress('2001:db8::1'), '2001_db8__1', 'IPv6 colons are not doc-id safe');
});

runTest('🚨 A missing address shares one bucket rather than escaping the limit', () => {
  // Behind a proxy rawRequest.ip can be absent. Returning "" would make the doc id
  // invalid and, if that threw or was skipped, hand out an unlimited quota.
  for (const missing of [undefined, null, '', '   ']) {
    assertEqual(rateLimitKeyForAddress(missing), 'unknown', JSON.stringify(missing));
  }
});

// ===========================================================================
console.log('\n5. Leads are never client-readable or client-writable');
// ===========================================================================

const rules = read('firestore.rules');

/**
 * The body of one `match` block. Slicing to the first "}" would stop inside the
 * path's own wildcard — `match /pilot_leads/{leadId}` — and read nothing.
 */
function rulesBlock(path) {
  const start = rules.indexOf(`match ${path}`);
  assert(start !== -1, `no rules block for ${path}`);
  const bodyStart = rules.indexOf('\n', start);
  const end = rules.indexOf('\n    }', bodyStart);
  assert(end !== -1, `unterminated rules block for ${path}`);
  return rules.slice(bodyStart, end);
}

runTest('🚨 pilot_leads is closed to client writes', () => {
  const body = rulesBlock('/pilot_leads/');
  assert(/allow write: if false/.test(body), 'the browser must never write a lead');
  assert(/allow read: if isAdmin\(\)/.test(body), 'reads must be admin-only');
});

runTest('🚨 The rate-limit counter is fully closed', () => {
  const body = rulesBlock('/pilot_lead_rate_limits/');
  assert(/allow read, write: if false/.test(body), 'a resettable quota is not a quota');
});

runTest('The client goes through the Cloud Function, not Firestore', () => {
  const service = read('src/services/pilotLeadService.js');
  assert(service.includes('httpsCallable'), 'the lead must be submitted through the function');
  assert(!/addDoc|setDoc|collection\(/.test(service), 'no direct Firestore write may remain');
});

// ===========================================================================
console.log('\n6. The page cannot claim success it did not achieve');
// ===========================================================================

const page = read('src/pages/LandingPage.tsx');

runTest('🚨 The form no longer discards the lead into console.log', () => {
  assert(!/console\.log\([^)]*form/.test(page), 'the submission must leave the browser');
  assert(page.includes('submitPilotLead'), 'it must call the service');
});

runTest('🚨 The success panel is shown only after the lead is stored', () => {
  // It promises a callback within 24 hours. Shown on a failed write, that promise
  // is made to a school nobody can see.
  const handler = page.slice(page.indexOf('const handleSubmit'), page.indexOf('return ('));
  const awaitIdx = handler.indexOf('await submitPilotLead');
  const successIdx = handler.indexOf('setSubmitted(true)');
  assert(awaitIdx !== -1, 'the submission must be awaited');
  assert(successIdx > awaitIdx, 'success must not be declared before the write returns');
  assert(handler.includes('catch'), 'a failure must be caught rather than thrown at the user');
});

runTest('A failure is shown to the school with a way to reach the team', () => {
  assert(page.includes('sendError'), 'the error must reach the UI');
  assert(page.includes('role="alert"'), 'and be announced, not just painted');
  assert(page.includes('092-197-5525'), 'a failed form must still offer a route through');
});

runTest('The submit button cannot be fired twice while in flight', () => {
  assert(page.includes('disabled={isSending}'), 'a double submit would create duplicate leads');
  assert(page.includes('if (isSending) return'), 'and the handler must guard too');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
