/**
 * Landing Page Intake Suite
 *
 * Three forms on the landing page — the pilot enquiry, the fifteen-question
 * satisfaction survey, and the system evaluation — all wrote straight to
 * Firestore collections that have no rule. The catch-all refused every write,
 * each helper caught the refusal and returned the record anyway, and all three
 * reported success while storing nothing. The survey is the data this project's
 * own report is built on; the enquiries were canteens asking to sign up.
 */

process.env.ALLOW_MOCK_AUTH = 'true';
process.env.SUPER_ADMIN_EMAILS = 'boss@queueup.test';

import http from 'http';
import express from 'express';
import { pilotLeadRouter } from '../routes/pilotLeadRoutes.js';
import { surveyRouter } from '../routes/surveyRoutes.js';
import { adminDb } from '../firebaseAdmin.js';

console.log('===============================================================');
console.log('📬 QUEUEUP LANDING INTAKE SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api/pilot-leads', pilotLeadRouter);
app.use('/api/surveys', surveyRouter);
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

const suffix = Date.now();
let baseUrl = '';

async function api(path, method = 'GET', body = null, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

const ANSWERS = Object.fromEntries(
  Array.from({ length: 15 }, (_, i) => [`q${i + 1}`, 5])
);

async function runTests() {
  baseUrl = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });

  try {
    // --- A canteen asks to join ---
    console.log('\n--- A pilot enquiry ---');
    let res = await api('/api/pilot-leads', 'POST', {
      schoolName: `โรงอาหารคณะวิศวะ ${suffix}`,
      contactName: '  คุณสมชาย  ',
      phone: '092-197-5525',
      email: 'somchai@kku.ac.th',
      notes: 'สนใจแพ็กเกจนำร่อง'
    });
    const lead = res.data?.lead;
    check(res.status === 201 && Boolean(lead?.id),
      'A visitor who is not signed in can send an enquiry', `status ${res.status}`);
    check(lead?.contactName === 'คุณสมชาย', 'The name is trimmed', `"${lead?.contactName}"`);
    check(lead?.phone === '0921975525', 'The phone number is normalised', `${lead?.phone}`);
    check(lead?.status === 'NEW', 'It arrives as new work', `status ${lead?.status}`);

    const storedLead = (await adminDb.collection('pilot_leads').doc(lead.id).get()).data();
    check(Boolean(storedLead),
      'And it is stored where somebody can act on it, not only in a browser');

    res = await api('/api/pilot-leads', 'POST', { contactName: 'ไม่มีเบอร์' });
    check(res.status === 400 && res.data?.error === 'CONTACT_REQUIRED',
      'An enquiry with no phone number is refused', `error ${res.data?.error}`);

    res = await api('/api/pilot-leads', 'POST', { contactName: 'สั้นไป', phone: '123' });
    check(res.status === 400, 'So is one with an impossible number', `status ${res.status}`);

    // --- The list is not public ---
    console.log('\n--- Who may read the enquiries ---');
    res = await api('/api/pilot-leads');
    check(res.status === 403, 'Names and phone numbers are not public', `status ${res.status}`);

    res = await api('/api/pilot-leads', 'GET', null, {
      'x-mock-user-id': `nosy-${suffix}`, 'x-mock-user-role': 'customer',
      'x-mock-user-email': `nosy-${suffix}@kku.ac.th`
    });
    check(res.status === 403, 'Nor readable by any signed-in account', `status ${res.status}`);

    res = await api('/api/pilot-leads', 'GET', null, {
      'x-mock-user-id': `boss-${suffix}`, 'x-mock-user-role': 'admin',
      'x-mock-user-email': 'boss@queueup.test'
    });
    check(res.status === 200 && (res.data?.leads || []).some((l) => l.id === lead.id),
      'A platform administrator sees them', `status ${res.status}`);

    // --- The satisfaction survey ---
    console.log('\n--- The fifteen-question survey ---');
    res = await api('/api/surveys', 'POST', {
      userName: 'ปี 3', yearLevel: 'ปี 3', faculty: 'วิศวกรรมศาสตร์',
      answers: { ...ANSWERS, q7: 4, q12: 3 },
      comment: 'ใช้งานง่ายดีครับ'
    });
    const survey = res.data?.survey;
    check(res.status === 201 && Boolean(survey?.id),
      'A student can submit without signing in', `status ${res.status}`);
    check(survey?.answers?.q7 === 4 && survey?.answers?.q12 === 3,
      'Every answer is kept as given', `q7 ${survey?.answers?.q7}, q12 ${survey?.answers?.q12}`);
    check(Object.keys(survey?.answers || {}).length === 15,
      'All fifteen questions are recorded', `${Object.keys(survey?.answers || {}).length}`);

    const storedSurvey = (await adminDb.collection('canteen_surveys').doc(survey.id).get()).data();
    check(Boolean(storedSurvey),
      'And the response is actually collected — this is the project\'s own data');

    res = await api('/api/surveys', 'POST', { yearLevel: 'ปี 1', answers: { ...ANSWERS, q9: 9 } });
    check(res.status === 400 && res.data?.error === 'ANSWER_OUT_OF_RANGE',
      'An answer off the five point scale is refused', `error ${res.data?.error}`);

    res = await api('/api/surveys', 'POST', { yearLevel: 'ปี 1', answers: { q1: 5 } });
    check(res.status === 400,
      'A partial submission missing fourteen answers is refused', `status ${res.status}`);

    res = await api('/api/surveys', 'POST', { answers: ANSWERS });
    check(res.status === 400 && res.data?.error === 'YEAR_LEVEL_REQUIRED',
      'And one with no year level', `error ${res.data?.error}`);

    console.log('\n--- Reading the survey back ---');
    res = await api('/api/surveys?limit=200');
    check(res.status === 200 && (res.data?.surveys || []).some((s) => s.id === survey.id),
      'The page charts what was actually collected', `${(res.data?.surveys || []).length} response(s)`);

    console.log('\n===============================================================');
    console.log(`📊 LANDING INTAKE RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Landing intake suite crashed:', err);
  process.exit(1);
});
