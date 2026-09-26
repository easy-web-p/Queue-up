/**
 * Institutional Administration Test Suite
 *
 * Covers the two things that did not exist before: a server-side roster import
 * that survives a closed tab, and the issuing of the custom claims that both
 * firestore.rules and the client authorise on.
 */

process.env.ALLOW_MOCK_AUTH = 'true';
process.env.SUPER_ADMIN_EMAILS = 'root@queueup.test';

import http from 'http';
import express from 'express';
import { schoolRouter } from '../routes/schoolRoutes.js';
import { adminDb, adminAuth } from '../firebaseAdmin.js';

console.log('===============================================================');
console.log('🏫 QUEUEUP INSTITUTIONAL ADMINISTRATION TEST SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/api/schools', schoolRouter);
const server = http.createServer(app);

let total = 0;
let passed = 0;

function check(condition, message, detail = '') {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}${detail ? ` (${detail})` : ''}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}${detail ? ` (${detail})` : ''}`);
    process.exitCode = 1;
  }
}

async function startServer() {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

async function request(baseUrl, path, method = 'GET', body = null, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
}

function as(uid, extra = {}) {
  return {
    'x-mock-user-id': uid,
    'x-mock-user-role': extra.role || 'customer',
    'x-mock-user-email': extra.email || `${uid}@kku.ac.th`,
    ...(extra.schoolId ? { 'x-mock-school-id': extra.schoolId } : {})
  };
}

const ROOT = as('platform-root', { email: 'root@queueup.test' });
const SCHOOL = 'KKU';
const APPLICATION_ID = 'app-school-test-1';

async function seed() {
  await adminDb.collection('school_applications').doc(APPLICATION_ID).set({
    id: APPLICATION_ID,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    schoolData: {
      schoolCode: SCHOOL,
      schoolName: 'มหาวิทยาลัยขอนแก่น',
      province: 'ขอนแก่น',
      contactEmail: 'contact@kku.ac.th',
      contactPhone: '043-009-700'
    },
    parsedMembers: [
      { type: 'admin', id: 'EMP-001', fullName: 'อาจารย์สมหญิง ดูแลดี', email: 'somying@kku.ac.th' },
      { type: 'student', id: 'STD-6501094', fullName: 'สมชาย รักเรียน', email: 'somchai@kku.ac.th', classRoom: 'CS-4' },
      { type: 'student', id: 'STD-6501095', fullName: 'สมศรี ตั้งใจ', email: 'somsri@kku.ac.th', classRoom: 'CS-4' },
      // Unusable rows: the import must skip them rather than abort.
      { type: 'student', id: '', fullName: 'ไม่มีรหัส', email: 'norid@kku.ac.th' },
      { type: 'student', id: 'STD-6501099', fullName: 'ไม่มีอีเมล', email: '' }
    ]
  });
}

async function runTests() {
  const baseUrl = await startServer();

  try {
    await seed();

    // --- Approval is restricted to platform admins ---
    console.log('\n--- Application approval ---');
    let res = await request(baseUrl, `/api/schools/applications/${APPLICATION_ID}/approve`, 'POST', {});
    check(res.status === 401, 'Anonymous approval is rejected', `status ${res.status}`);

    res = await request(baseUrl, `/api/schools/applications/${APPLICATION_ID}/approve`, 'POST', {},
      as('random-student'));
    check(res.status === 403, 'A regular account cannot approve a school', `status ${res.status}`);

    res = await request(baseUrl, `/api/schools/applications/${APPLICATION_ID}/approve`, 'POST', {}, ROOT);
    check(res.status === 200 && res.data?.schoolId === SCHOOL,
      'A platform admin approves the application', `schoolId ${res.data?.schoolId}`);
    check(res.data?.importedMemberCount === 3,
      'Three valid roster rows are imported', `imported ${res.data?.importedMemberCount}`);
    check(res.data?.skippedMemberCount === 2,
      'Two unusable rows are skipped, not fatal', `skipped ${res.data?.skippedMemberCount}`);

    const schoolSnap = await adminDb.collection('schools').doc(SCHOOL).get();
    check(schoolSnap.exists && schoolSnap.data().status === 'active', 'The school document is created and active');
    check(schoolSnap.data().totalStudents === 2 && schoolSnap.data().totalAdmins === 1,
      'Member counts are derived from the imported rows');

    res = await request(baseUrl, `/api/schools/applications/${APPLICATION_ID}/approve`, 'POST', {}, ROOT);
    check(res.status === 200 && res.data?.alreadyApproved === true,
      'Approving twice is idempotent', `alreadyApproved ${res.data?.alreadyApproved}`);

    // --- Roster import ---
    console.log('\n--- Roster import ---');
    res = await request(baseUrl, `/api/schools/${SCHOOL}/roster`, 'POST', {
      members: [{ id: 'STD-7000001', fullName: 'นักศึกษาใหม่', email: 'newbie@kku.ac.th', type: 'student' }]
    }, as('random-student'));
    check(res.status === 403, 'A non-admin cannot import a roster', `status ${res.status}`);

    res = await request(baseUrl, `/api/schools/${SCHOOL}/roster`, 'POST', { members: [] }, ROOT);
    check(res.status === 400 && res.data?.error === 'EMPTY_ROSTER',
      'An empty roster is refused', `error ${res.data?.error}`);

    res = await request(baseUrl, `/api/schools/unknown-school/roster`, 'POST', {
      members: [{ id: 'X', fullName: 'Y', email: 'y@z.com' }]
    }, ROOT);
    check(res.status === 404, 'Importing into an unknown school is refused', `status ${res.status}`);

    // A 600-row import crosses the 500-operation batch limit.
    const bulkRows = Array.from({ length: 600 }, (_, i) => ({
      type: 'student',
      id: `STD-BULK-${i}`,
      fullName: `นักศึกษา ${i}`,
      email: `bulk${i}@kku.ac.th`
    }));
    res = await request(baseUrl, `/api/schools/${SCHOOL}/roster`, 'POST', { members: bulkRows }, ROOT);
    check(res.status === 200 && res.data?.importedMemberCount === 600,
      'A roster larger than one Firestore batch imports fully',
      `imported ${res.data?.importedMemberCount}`);

    const bulkSnap = await adminDb.collection('school_members').doc(`${SCHOOL}_STD-BULK-599`).get();
    check(bulkSnap.exists, 'The last row of the oversized batch is present');

    // --- Membership claim and custom claims ---
    console.log('\n--- Membership claim issues custom claims ---');
    res = await request(baseUrl, '/api/schools/membership/claim', 'POST', {},
      as('uid-nobody', { email: 'stranger@example.com' }));
    check(res.status === 404 && res.data?.error === 'NOT_ON_ANY_ROSTER',
      'An email absent from every roster cannot claim', `error ${res.data?.error}`);

    res = await request(baseUrl, '/api/schools/membership/claim', 'POST', {},
      as('uid-somchai', { email: 'somchai@kku.ac.th' }));
    check(res.status === 200 && res.data?.schoolId === SCHOOL,
      'A rostered student claims their membership', `schoolId ${res.data?.schoolId}`);

    let claims = (await adminAuth.getUser('uid-somchai')).customClaims;
    check(claims?.schoolId === SCHOOL, 'schoolId is issued as a custom claim', `schoolId ${claims?.schoolId}`);
    check(claims?.role === 'customer', 'A student is issued the customer role', `role ${claims?.role}`);

    res = await request(baseUrl, '/api/schools/membership/claim', 'POST', {},
      as('uid-somying', { email: 'somying@kku.ac.th' }));
    claims = (await adminAuth.getUser('uid-somying')).customClaims;
    check(res.status === 200 && claims?.role === 'admin',
      'A rostered school admin is issued the admin role', `role ${claims?.role}`);

    res = await request(baseUrl, '/api/schools/membership/claim', 'POST', {},
      as('uid-impostor', { email: 'somchai@kku.ac.th' }));
    check(res.status === 409 && res.data?.error === 'ROSTER_ALREADY_CLAIMED',
      'A second account cannot claim the same roster row', `error ${res.data?.error}`);

    res = await request(baseUrl, '/api/schools/membership/claim', 'POST', {},
      as('uid-somchai', { email: 'somchai@kku.ac.th' }));
    check(res.status === 200, 'The original owner can re-claim idempotently', `status ${res.status}`);

    // --- Administering claims directly ---
    console.log('\n--- Platform claim administration ---');
    res = await request(baseUrl, '/api/schools/users/uid-somchai/claims', 'POST',
      { role: 'super_admin' }, as('random-student'));
    check(res.status === 403, 'A regular account cannot grant itself claims', `status ${res.status}`);

    res = await request(baseUrl, '/api/schools/users/uid-merchant/claims', 'POST',
      { role: 'not-a-role' }, ROOT);
    check(res.status === 400 && res.data?.error === 'INVALID_ROLE',
      'An unknown role is refused', `error ${res.data?.error}`);

    res = await request(baseUrl, '/api/schools/users/uid-merchant/claims', 'POST',
      { role: 'merchant', storeId: 'store-1' }, ROOT);
    check(res.status === 200 && res.data?.claims?.storeId === 'store-1',
      'A platform admin pins a merchant to their store', `storeId ${res.data?.claims?.storeId}`);

    res = await request(baseUrl, '/api/schools/users/uid-merchant/claims', 'POST',
      { schoolId: SCHOOL }, ROOT);
    check(res.data?.claims?.role === 'merchant' && res.data?.claims?.schoolId === SCHOOL,
      'A partial update keeps the claims it does not set');

    res = await request(baseUrl, '/api/schools/users/uid-merchant/claims', 'GET', null, ROOT);
    check(res.status === 200 && res.data?.claims?.storeId === 'store-1',
      'Claims can be read back for the admin console');

    console.log('\n===============================================================');
    console.log(`📊 INSTITUTIONAL TEST RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Institutional suite crashed:', err);
  process.exit(1);
});
