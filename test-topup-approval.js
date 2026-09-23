/**
 * ============================================================================
 * WALLET TOP-UP APPROVAL TEST SUITE
 * ============================================================================
 *
 * `reviewWalletTopupRequest` was written, deployed, exported from
 * `campusWalletService.ts` — and called by nothing. Every screen in
 * `src/pages/` was searched; none imported it. So a guardian recorded a cash
 * request, walked to the office, and no member of staff had any button to press.
 * The request sat PENDING forever and the money never arrived.
 *
 * That is the shape of bug this file exists to catch: a backend half with no
 * front-end half. The first test is literally "somebody calls this function",
 * because nobody did.
 *
 * The rest is about what the two screens are allowed to claim. Pressing ยืนยัน
 * IS the capture — there is no gateway behind a cash request — so the dialog has
 * to ask about the money, not about the paperwork. And a Stripe request must
 * offer no buttons at all: `canConfirmManually` would refuse them server-side,
 * and a button that always fails is worse than no button.
 *
 * The rules half — whether staff can LIST the collection and a guardian can
 * list only their own — is in test-firestore-rules-emulator.js, against the
 * real rules engine.
 */

import { readFileSync, readdirSync } from 'node:fs';

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

const read = (rel) => readFileSync(new URL(`./${rel}`, import.meta.url), 'utf8');

/**
 * Comments removed before a source assertion, trailing ones included.
 *
 * A check for `f(` in the source is satisfied by `// f(` otherwise, so
 * commenting a call out would leave the test green. Line comments are matched
 * only when not preceded by `:`, so `https://` survives.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const APPROVAL_PAGE = 'src/pages/WalletTopupApproval.tsx';

console.log('\n🧾 The other half exists');

runTest('🚨 Some screen actually calls reviewWalletTopupRequest', () => {
  // The bug itself. The function existed for weeks with no caller, so a
  // guardian's cash request could never be settled by anyone.
  const callers = [];
  for (const dir of ['src/pages', 'src/components']) {
    for (const entry of readdirSync(new URL(`./${dir}`, import.meta.url).pathname)) {
      if (!/\.(tsx|jsx)$/.test(entry)) continue;
      if (stripComments(read(`${dir}/${entry}`)).includes('reviewWalletTopupRequest(')) {
        callers.push(`${dir}/${entry}`);
      }
    }
  }
  assert(
    callers.length > 0,
    'no screen calls reviewWalletTopupRequest — a cash top-up can never be confirmed'
  );
});

runTest('🚨 The screen is routed, and only for staff and admins', () => {
  // Confirming a top-up moves real money. A route without allowedRoles is one
  // any signed-in student can open.
  const app = stripComments(read('src/App.jsx'));
  assert(app.includes('WalletTopupApproval'), 'the approval screen has no route');

  // Matched per line rather than with a `[^>]*` element regex: a <Route>
  // wraps <ProtectedRoute>, so the first `>` is nowhere near the end.
  const routes = app
    .split('\n')
    .filter((line) => line.includes('<Route') && line.includes('WalletTopupApproval'));
  assert(routes.length > 0, 'the component is imported but never routed');
  for (const route of routes) {
    assert(
      /allowedRoles=\{\["staff_supervisor", "admin"\]\}/.test(route),
      `a route to the approval screen is not staff-gated: ${route.slice(0, 120)}`
    );
  }
});

runTest('Staff can reach it without knowing the URL', () => {
  const home = read('src/pages/Home.jsx');
  assert(
    home.includes('/campus/topup-approvals'),
    'nothing links to the approval screen, so staff would have to type the URL'
  );
});

console.log('\n💵 What pressing ยืนยัน claims');

runTest('🚨 The confirm dialog asks about the money, not the paperwork', () => {
  // There is no gateway behind a cash request: this click IS the capture. Staff
  // have to be told that, or they will confirm requests that merely look valid.
  const page = read(APPROVAL_PAGE);
  const at = page.indexOf('const handleDecision');
  assert(at > 0, 'the decision handler is gone');
  const body = page.slice(at, page.indexOf('return (', at));

  assert(body.includes('toast.confirm'), 'a top-up is credited with no confirmation step');
  assert(
    body.includes('การกดยืนยันของเจ้าหน้าที่คือการรับเงิน'),
    'the dialog does not say that confirming is the capture'
  );
  assert(
    /เข้ากระเป๋า.*ทันที/s.test(body),
    'the dialog does not say the money moves immediately'
  );
});

runTest('🚨 A Stripe request offers no confirm button', () => {
  // canConfirmManually refuses one server-side. Rendering the buttons anyway
  // would give staff a control that always errors — and imply the credit is
  // theirs to grant.
  const page = stripComments(read(APPROVAL_PAGE));
  assert(
    /const canReview =[^;]*!isStripe/.test(page),
    'the action buttons are not gated on the request being a cash one'
  );
  assert(
    /\{canReview && \(/.test(page),
    'the buttons render regardless of whether the request can be reviewed'
  );
  assert(
    page.includes('เจ้าหน้าที่ยืนยันด้วยตนเองไม่ได้'),
    'a Stripe row does not explain why there is nothing to press'
  );
});

runTest('The screen distinguishes loading, empty and denied', () => {
  // Three different outcomes that collapsed into one blank list everywhere else
  // in this app. A staff member seeing nothing needs to know which it is.
  const page = read(APPROVAL_PAGE);
  assert(page.includes('กำลังโหลดคำขอเติมเงิน'), 'no loading state');
  assert(page.includes('ไม่มีคำขอเติมเงินที่รอยืนยัน'), 'no empty state');
  assert(
    page.includes('staff_supervisor หรือ admin'),
    'a permission failure is not distinguished from an empty list'
  );
});

console.log('\n👪 What the guardian can see');

runTest('🚨 A guardian can see that their request exists', () => {
  // Without this the parent records a request and never sees it again: the
  // balance simply does not change, with nothing to say why.
  const dash = stripComments(read('src/pages/GuardianDashboard.tsx'));
  assert(dash.includes('fetchMyTopupRequests'), 'the dashboard never reads the parent’s requests');
  assert(dash.includes('pendingTopups'), 'nothing renders them');
  assert(
    dash.includes('รอเจ้าหน้าที่ยืนยันว่าได้รับเงินที่ห้องธุรการแล้ว'),
    'a waiting cash request does not say what it is waiting for'
  );
});

runTest('🚨 A settled request is not counted twice', () => {
  // A CONFIRMED request already appears in the ledger as a TOPUP. Listing it as
  // pending as well would have the parent adding the same money up twice.
  const dash = stripComments(read('src/pages/GuardianDashboard.tsx'));
  const at = dash.indexOf('const pendingTopups');
  assert(at > 0, 'the pending list is gone');
  const expr = dash.slice(at, dash.indexOf(';', at));
  assert(expr.includes("'PENDING'"), 'settled requests are listed as pending');
  assert(
    expr.includes('selectedChild?.studentId'),
    "one child's requests would show under the other child"
  );
});

runTest("🚨 The guardian's query is one the rules can allow", () => {
  // A guardian may read their own requests and nobody else's, so an unfiltered
  // query is refused outright — not trimmed to what they may see.
  const svc = stripComments(read('src/services/campusWalletService.ts'));
  const at = svc.indexOf('export async function fetchMyTopupRequests');
  assert(at > 0, 'the fetch is gone');
  const body = svc.slice(at, svc.indexOf('\n}', at));
  assert(
    body.includes("where('requestedBy', '==', guardianUid)"),
    'the query is not filtered to the caller, so the rules will refuse it'
  );
  assert(
    body.includes("orderBy('createdAt', 'desc')"),
    'limit applies before any sort done afterwards, so this returns an arbitrary handful'
  );
});

runTest('🚨 The composite index that query needs is declared', () => {
  // where + orderBy on different fields needs one. Without it the query throws
  // at runtime with a console link nobody deploying from CI will click.
  const indexes = JSON.parse(read('firestore.indexes.json'));
  const match = indexes.indexes.find(
    (i) =>
      i.collectionGroup === 'wallet_topup_requests' &&
      i.fields.some((f) => f.fieldPath === 'requestedBy') &&
      i.fields.some((f) => f.fieldPath === 'createdAt' && f.order === 'DESCENDING')
  );
  assert(!!match, 'no (requestedBy, createdAt desc) index for wallet_topup_requests');
});

console.log('\n🔒 The browser still credits nothing');

runTest('🚨 Neither screen writes a wallet or a request row', () => {
  // wallet_topup_requests is `allow write: if false;` and wallets move only
  // server-side. A client write here would be the whole mechanism undone.
  for (const f of [APPROVAL_PAGE, 'src/pages/GuardianDashboard.tsx']) {
    const src = read(f);
    assert(!/balanceSatang\s*:/.test(src), `${f} writes a balance`);
    assert(
      !/(setDoc|updateDoc|addDoc)\s*\(\s*doc\(\s*db\s*,\s*['"](wallets|wallet_topup_requests|wallet_transactions)['"]/.test(
        src
      ),
      `${f} writes a money collection directly`
    );
  }
});

runTest('The amount shown is the stored satang, converted once', () => {
  const page = read(APPROVAL_PAGE);
  assert(
    page.includes('satangToBahtText'),
    'the screen rolls its own baht conversion instead of the shared one'
  );
  assert(!/\*\s*100/.test(page), 'a ×100 appears where only ÷100 belongs');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
