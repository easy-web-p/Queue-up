/**
 * Deployment Shape Test Suite
 *
 * The app ships two ways: a long-lived process that also serves the built SPA,
 * and a serverless function that serves only the API while a CDN serves the
 * build. These assertions pin the differences that would otherwise only show up
 * as a broken production deploy.
 */

process.env.ALLOW_MOCK_AUTH = 'true';

import http from 'http';
import { createApp } from '../app.js';

console.log('===============================================================');
console.log('🚀 QUEUEUP DEPLOYMENT SHAPE TEST SUITE');
console.log('===============================================================');

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

async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function request(baseUrl, path, method = 'GET', headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, { method, headers });
  const contentType = res.headers.get('content-type') || '';
  let body = null;
  try {
    body = contentType.includes('application/json') ? await res.json() : await res.text();
  } catch { /* empty body */ }
  return { status: res.status, contentType, body };
}

async function runTests() {
  // --- Serverless shape: API only, no SPA fallback ---
  console.log('\n--- Serverless shape (Vercel) ---');
  const serverless = await listen(createApp({ serveStatic: false }));
  try {
    let res = await request(serverless.baseUrl, '/api/health');
    check(res.status === 200 && res.body?.status === 'ok',
      'The health probe answers', `status ${res.status}`);

    res = await request(serverless.baseUrl, '/api/definitely-not-a-route');
    check(res.status === 404 && res.contentType.includes('application/json'),
      'An unknown API path answers 404 JSON', `status ${res.status}`);

    // The CDN owns every non-API path. The function must not try to serve the
    // SPA itself, or a missing dist/ would turn into a 500 on every page.
    res = await request(serverless.baseUrl, '/queue-tracking');
    check(res.status === 404 && !String(res.body).includes('<div id="root">'),
      'A page route is left to the CDN, not answered with the SPA shell',
      `status ${res.status}`);

    res = await request(serverless.baseUrl, '/api/merchant/payouts', 'POST');
    check(res.status === 401, 'Authorization still applies in the serverless shape',
      `status ${res.status}`);
  } finally {
    serverless.server.close();
  }

  // --- Standalone shape: API plus the SPA ---
  console.log('\n--- Standalone shape (Cloud Run, local, any VM) ---');
  const standalone = await listen(createApp({ serveStatic: true }));
  try {
    let res = await request(standalone.baseUrl, '/api/health');
    check(res.status === 200, 'The health probe answers', `status ${res.status}`);

    res = await request(standalone.baseUrl, '/api/definitely-not-a-route');
    check(res.status === 404 && res.contentType.includes('application/json'),
      'Unknown API paths never fall through to the SPA fallback',
      `content-type ${res.contentType}`);

    // With no dist/ present this is a 500 rather than a 200; either way it must
    // be the SPA branch, not the API 404.
    res = await request(standalone.baseUrl, '/queue-tracking');
    check(res.status !== 404, 'A page route is handled by the SPA fallback', `status ${res.status}`);
  } finally {
    standalone.server.close();
  }

  // --- Scheduled jobs ---
  console.log('\n--- Cron endpoint ---');
  const priorSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-cron-secret';
  const cron = await listen(createApp({ serveStatic: false }));
  try {
    let res = await request(cron.baseUrl, '/api/cron/pickup-reminders', 'POST');
    check(res.status === 401, 'A cron run without the shared secret is rejected',
      `status ${res.status}`);

    res = await request(cron.baseUrl, '/api/cron/pickup-reminders', 'POST',
      { Authorization: 'Bearer wrong-secret' });
    check(res.status === 401, 'A wrong secret is rejected', `status ${res.status}`);

    res = await request(cron.baseUrl, '/api/cron/pickup-reminders', 'POST',
      { Authorization: 'Bearer test-cron-secret' });
    check(res.status === 200 && res.body?.job === 'pickup-reminders',
      'The correct secret runs the pickup reminder sweep', `status ${res.status}`);
  } finally {
    cron.server.close();
    if (priorSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = priorSecret;
  }

  // --- A misconfigured deployment must name what is missing ---
  // Throwing at import would take the health probe down with everything else,
  // leaving an operator with an opaque 500 and nothing to act on.
  console.log('\n--- Misconfigured deployment reports what is missing ---');
  const { execFile } = await import('child_process');
  const probe = await new Promise((resolve) => {
    execFile(process.execPath, ['-e', `
      import('./server/app.js').then(async ({ createApp }) => {
        const http = await import('http');
        const s = http.createServer(createApp({ serveStatic: false }));
        await new Promise(r => s.listen(0, '127.0.0.1', r));
        const base = 'http://127.0.0.1:' + s.address().port;
        const health = await fetch(base + '/api/health');
        const body = await health.json();
        const api = await fetch(base + '/api/orders/anything');
        const apiBody = await api.json();
        const hook = await fetch(base + '/api/webhooks/stripe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
        });
        s.close();
        console.log(JSON.stringify({
          healthStatus: health.status,
          missingRequired: body.missingRequired,
          database: body.database,
          leaksValues: JSON.stringify(body).includes('deadbeef'),
          apiStatus: api.status,
          apiError: apiBody.error,
          webhookStatus: hook.status
        }));
      }).catch(err => console.log(JSON.stringify({ crashed: err.message })));
    `], {
      cwd: process.cwd(),
      // A production environment with nothing configured: exactly the state a
      // fresh deployment is in before its variables are filled in.
      env: { ...process.env, NODE_ENV: 'production', HMAC_SECRET: '', FIREBASE_SERVICE_ACCOUNT: '', STRIPE_WEBHOOK_SECRET: '' }
    }, (err, stdout) => {
      const line = stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop();
      resolve(line ? JSON.parse(line) : { crashed: 'no output' });
    });
  });

  check(!probe.crashed, 'The app still loads with nothing configured', probe.crashed || 'loaded');
  check(probe.healthStatus === 503 && probe.database === 'unavailable',
    'The health probe answers 503 instead of dying with the app',
    `status ${probe.healthStatus}`);
  check(Array.isArray(probe.missingRequired)
    && probe.missingRequired.includes('FIREBASE_SERVICE_ACCOUNT')
    && probe.missingRequired.includes('HMAC_SECRET')
    && probe.missingRequired.includes('STRIPE_WEBHOOK_SECRET'),
    'It names every missing variable', JSON.stringify(probe.missingRequired));
  check(probe.leaksValues === false,
    'It reports names and booleans only, never a secret value');
  check(probe.apiStatus === 503 && probe.apiError === 'DATABASE_UNAVAILABLE',
    'API routes refuse rather than falling back to the local store',
    `status ${probe.apiStatus}`);
  check(probe.webhookStatus === 503,
    'The Stripe webhook refuses unsigned deliveries rather than accepting them',
    `status ${probe.webhookStatus}`);

  console.log('\n===============================================================');
  console.log(`📊 DEPLOYMENT TEST RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
  console.log('===============================================================\n');

  if (passed !== total) process.exit(1);
}

runTests().catch((err) => {
  console.error('❌ Deployment suite crashed:', err);
  process.exit(1);
});
