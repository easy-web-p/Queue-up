/**
 * ============================================================================
 * ACCOUNT DELETION TEST SUITE
 * ============================================================================
 *
 * "ยืนยันการลบข้อมูลบัญชีถาวร" did this:
 *
 *     await deleteDoc(doc(db, "users", user.uid));   // swallowed on failure
 *     toast.success("ลบข้อมูลบัญชีและประวัติต่างๆ ... เรียบร้อยแล้ว");
 *
 * The Firebase Auth account survived, so signing in again recreated the
 * profile. The wallet survived with its balance. The orders, the guardian
 * links, the chats, and the student record with its allergy and health notes
 * all survived. A failed delete was logged with `console.warn` and the success
 * message appeared regardless. The PDPA page promised erasure.
 *
 * The step before it asked for a username, an email and a password, checked
 * that the three boxes were non-empty, and threw the values away — a password
 * field authenticating nothing, guarding the one irreversible action in the app.
 *
 * What is tested here is what must never come back: that deletion is refused
 * while it would destroy something, that the plan reaches every collection
 * holding this person, that the audit trail and the ledger are exempt on
 * purpose, and that a refusal reaches the person as a refusal.
 */

import { readFileSync } from 'node:fs';
import {
  OPEN_ORDER_STATUSES,
  DELETION_PLAN,
  DELETION_REFUSAL,
  ANONYMISED_ORDER_FIELDS,
  checkDeletable,
  buildOrderAnonymisationPatch,
  isOwnChatId,
} from './functions/accountDeletion.js';

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

const read = (rel) => readFileSync(new URL(`./${rel}`, import.meta.url), 'utf8');
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const OK = {
  walletBalanceSatang: 0,
  openOrderCount: 0,
  pendingTopupCount: 0,
  activeShopCount: 0,
  isLastAdmin: false,
};

console.log('\n🛑 What deletion must not destroy');

runTest('🚨 A wallet with money in it blocks deletion', () => {
  // ฿200 in a wallet is ฿200 a parent handed over. Deleting the account deletes
  // the claim on it, and nothing anywhere would show the school still holds it.
  const r = checkDeletable({ ...OK, walletBalanceSatang: 20000 });
  assert(!r.ok, 'an account with a balance was deletable');
  assertEqual(r.code, DELETION_REFUSAL.WALLET_NOT_EMPTY, 'wrong refusal');
  assert(r.message.includes('200'), 'the refusal does not say how much is left');
  assert(/คืนเงิน|ห้องธุรการ/.test(r.message), 'the refusal offers no way forward');
});

runTest('An empty wallet does not block deletion', () => {
  assert(checkDeletable({ ...OK, walletBalanceSatang: 0 }).ok, 'zero is settled');
});

runTest('🚨 An order a stall is still cooking blocks deletion', () => {
  const r = checkDeletable({ ...OK, openOrderCount: 2 });
  assert(!r.ok, 'an account with live orders was deletable');
  assertEqual(r.code, DELETION_REFUSAL.OPEN_ORDERS, 'wrong refusal');
});

runTest('Every unfinished order state counts as open', () => {
  // A state missing from this list is an order that silently stops blocking.
  for (const s of ['PENDING', 'CONFIRMED', 'PREPARING', 'READY']) {
    assert(OPEN_ORDER_STATUSES.includes(s), `${s} is food still owed, and is not counted`);
  }
  for (const s of ['COMPLETED', 'CANCELLED']) {
    assert(!OPEN_ORDER_STATUSES.includes(s), `${s} is finished and must not block deletion`);
  }
});

runTest('🚨 A pending top-up blocks deletion', () => {
  // Money may be on its way from Stripe, or sitting on a counter waiting to be
  // confirmed. Either way it lands in a wallet that would no longer exist.
  const r = checkDeletable({ ...OK, pendingTopupCount: 1 });
  assert(!r.ok, 'an account with money in flight was deletable');
  assertEqual(r.code, DELETION_REFUSAL.PENDING_TOPUP, 'wrong refusal');
});

runTest('🚨 An open shop blocks deletion', () => {
  const r = checkDeletable({ ...OK, activeShopCount: 1 });
  assert(!r.ok, 'a vendor could vanish leaving a shop taking orders');
  assertEqual(r.code, DELETION_REFUSAL.OWNS_ACTIVE_SHOP, 'wrong refusal');
});

runTest('🚨 The last admin cannot delete themselves', () => {
  // Nobody left to appoint another admin, grant a staff role, or review a
  // vendor application. Recovery would take a redeploy.
  const r = checkDeletable({ ...OK, isLastAdmin: true });
  assert(!r.ok, 'the system could be left with no administrator');
  assertEqual(r.code, DELETION_REFUSAL.IS_LAST_ADMIN, 'wrong refusal');
});

runTest('A clean account is deletable', () => {
  assert(checkDeletable(OK).ok, 'nothing was blocking and it still refused');
  assert(checkDeletable().ok, 'missing state should default to deletable, not throw');
});

console.log('\n🧹 The plan reaches everything about the person');

runTest('🚨 Every collection holding this person is in the plan', () => {
  // The failure mode is silent: a collection nobody remembered keeps the
  // person's data forever and no error is ever raised.
  const purged = DELETION_PLAN.purge.map((p) => p.collection);
  for (const c of [
    'users',
    'students',
    'wallets',
    'parent_child_links',
    'reviews',
    'vendor_approvals',
    'coupon_redemptions',
    'chats',
  ]) {
    assert(purged.includes(c), `${c} holds personal data and is never deleted`);
  }
});

runTest('🚨 A guardian link is found from either end', () => {
  // The uid is guardianId on one row and studentId on another. Querying one
  // field leaves the other half of every relationship in place.
  const links = DELETION_PLAN.purge.filter((p) => p.collection === 'parent_child_links');
  const fields = links.map((l) => l.where).sort();
  assertEqual(fields.join(','), 'guardianId,studentId', 'a link survives from one side');
});

runTest('🚨 Chats and their messages go together', () => {
  // A subcollection outlives its parent in Firestore. A chat deleted on its own
  // leaves every message in it readable by id.
  const chats = DELETION_PLAN.purge.find((p) => p.collection === 'chats');
  assert(chats, 'chats are never deleted');
  assertEqual(chats.subcollection, 'messages', 'the messages inside would survive the chat');
  assert(chats.byIdPrefix, 'a chat id carries the uid as a prefix, not as a field');
});

runTest('Ids that embed the uid are matched by prefix, not by a field', () => {
  // coupon_redemptions is `<uid>_<code>` and a chat is `<uid>_<storeId>`.
  // Neither carries the uid in a field, so a where() would match nothing —
  // silently, returning zero documents and reporting success.
  for (const c of ['coupon_redemptions', 'chats']) {
    const entry = DELETION_PLAN.purge.find((p) => p.collection === c);
    assert(entry.byIdPrefix, `${c} would be queried by a field it does not have`);
    assert(!entry.where, `${c} must not be queried by a field`);
  }
  assert(isOwnChatId('uid123_shop9', 'uid123'), 'own chat not matched');
  assert(!isOwnChatId('uid1234_shop9', 'uid123'), 'a longer uid must not match by prefix');
  assert(!isOwnChatId('other_shop9', 'uid123'), "someone else's chat matched");
  assert(!isOwnChatId(null, 'uid123'), 'a missing id must not match');
});

console.log('\n🧾 What survives, and why');

runTest('🚨 Orders are anonymised, not deleted', () => {
  // A vendor losing a day's takings because a customer closed their account is
  // not erasure, it is data loss for someone else.
  const purged = DELETION_PLAN.purge.map((p) => p.collection);
  assert(!purged.includes('orders'), "the stall's sales history is deleted with the customer");
  assert(
    DELETION_PLAN.anonymise.some((a) => a.collection === 'orders'),
    'orders are neither deleted nor anonymised — the name stays'
  );
});

runTest('🚨 Anonymising an order removes every naming field', () => {
  const SENTINEL = '<<deleted>>';
  const patch = buildOrderAnonymisationPatch(SENTINEL);

  for (const f of ['customerPhone', 'customerEmail', 'userId', 'studentId', 'allergyNotes']) {
    assertEqual(patch[f], SENTINEL, `${f} survives anonymisation`);
  }
  // studentId in particular: paired with wallet_transactions it would re-link
  // the ledger back to a named order.
  assert(ANONYMISED_ORDER_FIELDS.includes('studentId'), 'the order stays linkable to the ledger');
  assert(
    typeof patch.customerName === 'string' && patch.customerName.length > 0,
    'an empty name reads as a bug rather than a deleted customer'
  );
  assertEqual(patch.deletedCustomer, true, 'nothing marks the order as belonging to nobody');
});

runTest('🚨 The audit trail is retained on purpose, not by omission', () => {
  // audit_logs records who read a child's medical data. Erasure does not reach
  // a record kept to prove a legal obligation — and naming it here is how the
  // next person to touch this sees the decision was made.
  const retained = DELETION_PLAN.retain.map((r) => r.collection);
  for (const c of ['audit_logs', 'emergency_audit_logs']) {
    assert(retained.includes(c), `${c} is not declared as retained`);
    const entry = DELETION_PLAN.retain.find((r) => r.collection === c);
    assertEqual(entry.reason, 'LEGAL_OBLIGATION', `${c} has no stated reason to be kept`);
  }
  const purged = DELETION_PLAN.purge.map((p) => p.collection);
  for (const c of ['audit_logs', 'emergency_audit_logs']) {
    assert(!purged.includes(c), `${c} is deleted, destroying the security record`);
  }
});

console.log('\n🔐 The server does it, and says what happened');

const live = stripComments(read('functions/index.js'));
const fnBody = (() => {
  const at = live.indexOf('export const deleteMyAccount');
  if (at < 0) throw new Error('deleteMyAccount does not exist');
  return live.slice(at, live.indexOf('\nexport const', at + 10));
})();

runTest('🚨 The Firebase Auth account is actually deleted', () => {
  // Without this the person signs in again and the profile is recreated. The
  // old flow deleted one document and called that erasure.
  assert(fnBody.includes('deleteUser(uid)'), 'the login itself survives the deletion');
});

runTest('🚨 The Auth account goes last', () => {
  // Deleted first, a failure part-way through strands whatever remains with no
  // owner and no way back in to retry.
  const authAt = fnBody.indexOf('deleteUser(uid)');
  const purgeAt = fnBody.indexOf('DELETION_PLAN.purge');
  const anonAt = fnBody.indexOf('buildOrderAnonymisationPatch');
  assert(purgeAt > 0 && anonAt > 0, 'the purge or the anonymisation is missing');
  assert(authAt > purgeAt, 'the account is deleted before its data');
  assert(authAt > anonAt, 'the account is deleted before its orders are anonymised');
});

runTest('🚨 Deletion is refused before anything is touched', () => {
  const checkAt = fnBody.indexOf('checkDeletable(');
  const purgeAt = fnBody.indexOf('DELETION_PLAN.purge');
  assert(checkAt > 0, 'nothing checks whether deletion would destroy something');
  assert(checkAt < purgeAt, 'data is removed before the refusal is evaluated');
});

runTest('🚨 The audit entry is written first, and awaited', () => {
  // A deletion that fails half-way still happened to whatever it reached. An
  // entry written at the end would be missing for exactly those cases.
  const auditAt = fnBody.indexOf('ACCOUNT_DELETED');
  const purgeAt = fnBody.indexOf('DELETION_PLAN.purge');
  assert(auditAt > 0, 'a permanent deletion is never recorded');
  assert(auditAt < purgeAt, 'the audit entry is written after the data is gone');
  assert(/await auditRef\.set\(/.test(fnBody), 'the audit write is not awaited');
});

runTest('A subcollection is never orphaned', () => {
  assert(fnBody.includes('recursiveDelete'), 'a parent is deleted leaving its subcollections');
});

runTest('🚨 The last-admin count includes bootstrap super-admins', () => {
  // Their rights come from an email in config/super-admins.js, not a custom
  // claim. Counting claims alone reports "no admins left" while one is a
  // sign-in away — and blocks the last claim-admin from leaving when someone
  // can still get back in.
  const at = fnBody.indexOf('isLastAdmin');
  assert(at > 0, 'nothing checks for the last admin');
  const body = fnBody.slice(at, fnBody.indexOf('throwIfRefused', at));
  assert(
    body.includes('isBootstrapSuperAdmin(u.email'),
    'a bootstrap super-admin is not counted as an admin'
  );
  assert(body.includes('u.uid === uid'), 'the account being deleted counts itself as another admin');
});

runTest('isCallerAdmin is called with the bootstrap predicate it requires', () => {
  // Its second parameter is not optional: `isBootstrapSuperAdmin(token.email)`
  // on undefined throws, taking the whole call down.
  for (const m of fnBody.match(/isCallerAdmin\([^)]*\)/g) || []) {
    assert(m.includes(','), `isCallerAdmin called with one argument: ${m}`);
  }
});

console.log('\n🖥️  The screen stops claiming what it used to');

const profile = stripComments(read('src/pages/UserProfile.jsx'));

runTest('🚨 The browser no longer deletes the user document itself', () => {
  assert(
    !/deleteDoc\(\s*doc\(db,\s*["']users["']/.test(profile),
    'the client still deletes the profile directly'
  );
  assert(profile.includes('deleteMyAccount('), 'nothing calls the server');
});

runTest('🚨 A refused deletion is reported as a refusal', () => {
  // Reported as success, the person walks away believing their data is gone
  // while their wallet, orders and child's allergy record are all still there.
  const at = profile.indexOf('const handleFinalDeleteAccount');
  assert(at > 0, 'the delete handler is gone');
  const body = profile.slice(at, profile.indexOf('const handleCopyAccountId', at));

  assert(body.includes('toast.error('), 'a failure is never shown');
  const successAt = body.indexOf('toast.success(');
  const catchAt = body.indexOf('} catch');
  assert(successAt > 0 && catchAt > successAt, 'success is reported outside the try');
  assert(!body.includes('console.warn'), 'a failure is swallowed into the console');
});

runTest('🚨 The password box authenticates something', () => {
  // It used to check the field was non-empty and discard the value. Anyone at
  // an unlocked screen could type four characters and erase the account.
  const at = profile.indexOf('const handleStep1DeleteSubmit');
  assert(at > 0, 'the verification step is gone');
  const body = profile.slice(at, profile.indexOf('const handleFinalDeleteAccount', at));

  assert(body.includes('reauthenticateForDeletion('), 'the password is still thrown away');
  const reauthAt = body.indexOf('reauthenticateForDeletion(');
  const advanceAt = body.indexOf('setIsFinalConfirmModalOpen(true)');
  assert(advanceAt > reauthAt, 'the flow advances before identity is proven');
  assert(body.includes('catch'), 'a failed identity check does not stop the flow');
});

runTest('Reauthentication handles an account with no password', () => {
  const svc = stripComments(read('src/services/accountService.ts'));
  assert(svc.includes('reauthenticateWithPopup'), 'a Google-only account could never confirm');
  assert(svc.includes("providerId === 'password'"), 'the provider is never checked');
});

runTest('🚨 The warning says what is kept, not just what is deleted', () => {
  // "ลบทุกอย่างถาวร" would be a promise the system deliberately does not keep.
  const at = profile.indexOf('ยืนยันการลบข้อมูลบัญชีถาวร');
  assert(at > 0, 'the final warning is gone');
  const body = profile.slice(at, at + 2500);
  assert(body.includes('ไม่ระบุตัวตน'), 'the warning does not mention what is kept anonymised');
  assert(/ตามกฎหมาย/.test(body), 'the warning does not mention what is retained by law');
});

runTest('🚨 The policy page describes the deletion the app performs', () => {
  const pdpa = read('src/pages/PdpaPolicy.jsx');
  assert(pdpa.includes('การลบบัญชีด้วยตนเอง'), 'the policy never mentions self-service deletion');
  assert(pdpa.includes('ไม่ระบุตัวตน'), 'the policy implies orders are deleted outright');
  assert(pdpa.includes('Audit Logs'), 'the policy does not say the audit trail is retained');
  assert(
    /ยอดคงเหลือ/.test(pdpa),
    'the policy does not mention that an unsettled wallet blocks deletion'
  );
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
