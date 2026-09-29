/**
 * Evaluation Submission Suite
 *
 * The landing page wrote evaluations straight to Firestore. No rule covers that
 * collection, so the catch-all refused every write — and the helper caught the
 * refusal and returned the record anyway, so the page thanked people for
 * feedback that never left their browser. Reading them back was refused too,
 * which is why the page always showed the static baseline.
 */

process.env.ALLOW_MOCK_AUTH = 'true';

import http from 'http';
import express from 'express';
import { evaluationRouter } from '../routes/evaluationRoutes.js';
import { adminDb } from '../firebaseAdmin.js';

console.log('===============================================================');
console.log('📝 QUEUEUP EVALUATION SUBMISSION SUITE');
console.log('===============================================================');

const app = express();
app.use(express.json());
app.use('/api/evaluations', evaluationRouter);
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

const FULL = {
  uxScore: 9.5, accountScore: 8, queueScore: 10, merchantScore: 7.5, securityScore: 9
};

async function runTests() {
  baseUrl = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });

  try {
    // --- A visitor submits one ---
    console.log('\n--- Submitting an evaluation ---');
    let res = await api('/api/evaluations', 'POST', {
      userName: `  นภัส ${suffix}  `,
      ...FULL,
      comment: 'ระบบคิวใช้งานง่ายมากค่ะ'
    });
    const saved = res.data?.evaluation;
    check(res.status === 201 && Boolean(saved?.id),
      'A visitor who is not signed in can still submit', `status ${res.status}`);
    check(saved?.userName === `นภัส ${suffix}`, 'The name is trimmed', `"${saved?.userName}"`);
    check(saved?.uxScore === 9.5, 'A half-point score survives', `${saved?.uxScore}`);
    check(saved?.submittedByUid === null, 'And is recorded as anonymous');

    const stored = (await adminDb.collection('evaluations').doc(saved.id).get()).data();
    check(Boolean(stored),
      'It is stored where the server can read it back, not only in a browser');

    // --- Signed in, it is attributed ---
    console.log('\n--- Signed in ---');
    res = await api('/api/evaluations', 'POST', {
      userName: 'อาจารย์ที่ปรึกษา', ...FULL
    }, {
      'x-mock-user-id': `uid-eval-${suffix}`,
      'x-mock-user-role': 'customer',
      'x-mock-user-email': `eval-${suffix}@kku.ac.th`
    });
    check(res.data?.evaluation?.submittedByUid === `uid-eval-${suffix}`,
      'A signed-in submission records who made it',
      `${res.data?.evaluation?.submittedByUid}`);

    // --- What it refuses ---
    console.log('\n--- What it refuses ---');
    res = await api('/api/evaluations', 'POST', { userName: '   ', ...FULL });
    check(res.status === 400 && res.data?.error === 'NAME_REQUIRED',
      'A nameless evaluation is refused', `error ${res.data?.error}`);

    res = await api('/api/evaluations', 'POST', { userName: 'ทดสอบ', ...FULL, uxScore: 9999 });
    check(res.status === 400 && res.data?.error === 'SCORE_OUT_OF_RANGE',
      'A score off the scale is refused, not stored', `error ${res.data?.error}`);

    res = await api('/api/evaluations', 'POST', { userName: 'ทดสอบ', ...FULL, securityScore: 0 });
    check(res.status === 400, 'Nor is zero, since the sliders start at one', `status ${res.status}`);

    res = await api('/api/evaluations', 'POST', { userName: 'ทดสอบ', uxScore: 8 });
    check(res.status === 400,
      'Nor a partial submission missing four of the five axes', `status ${res.status}`);

    res = await api('/api/evaluations', 'POST', {
      userName: 'ทดสอบ', ...FULL, comment: 'ก'.repeat(5000)
    });
    check((res.data?.evaluation?.comment || '').length === 1000,
      'A very long comment is capped rather than rejected',
      `${(res.data?.evaluation?.comment || '').length} chars`);

    // --- Reading them back ---
    console.log('\n--- Reading them back ---');
    res = await api('/api/evaluations?limit=150');
    const list = res.data?.evaluations || [];
    check(res.status === 200 && list.some((e) => e.id === saved.id),
      'The page can read submissions back', `${list.length} evaluation(s)`);
    check(list.length > 1 && new Date(list[0].createdAt) >= new Date(list[1].createdAt),
      'Newest first');

    console.log('\n===============================================================');
    console.log(`📊 EVALUATION RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
    console.log('===============================================================\n');

    if (passed !== total) process.exit(1);
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Evaluation suite crashed:', err);
  process.exit(1);
});
