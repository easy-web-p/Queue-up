/**
 * ============================================================================
 * CHAT & TRUST-SCORE HONESTY TEST SUITE
 * ============================================================================
 *
 * Two screens that told the user things the system did not do.
 *
 * **Chat.** ChatModal — the one every page opens — kept conversations in
 * localStorage and opened with three invented shops carrying order ids, queue
 * numbers, prices, and messages announcing status ("คิวของคุณพร้อมรับแล้วที่
 * เคาน์เตอร์ 1 ครับ"). Nothing a customer typed left the browser, and a
 * "merchant" replied a second later from a canned string — including, to the
 * question "is my food ready?", a promise that it would be ready in 2–4 minutes.
 * The security rules admitted only the customer, so even a real message could
 * not have reached the shop.
 *
 * **Trust score.** calculateUserTrustScore returned a `privileges` object —
 * canOrder, canReview, canReportStore — computed in the browser from a score the
 * browser also computed, and the profile page rendered it as "สิทธิ์การใช้งาน
 * ของคุณ … อนุมัติ ✅". No rule and no Cloud Function read any of it.
 */

import { readFileSync } from 'node:fs';
import { calculateUserTrustScore } from './src/services/aiUserVerificationEngine.js';

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
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * The whole `match /chats/{chatId}` block, bounded by its own closing brace
 * rather than by a character count — a fixed-length slice silently stopped
 * covering the rule it was meant to check the moment the block grew.
 */
function chatRulesBlock() {
  const rules = read('firestore.rules');
  const at = rules.indexOf('match /chats/{chatId}');
  if (at < 0) throw new Error('the chats rule block is gone entirely');
  const end = rules.indexOf('\n    }', at);
  if (end < 0) throw new Error('could not find the end of the chats rule block');
  return rules.slice(at, end);
}

const chatModal = strip(read('src/components/ChatModal.jsx'));
const chatService = read('src/services/chatService.js');
const aiChat = strip(read('src/services/aiChatService.js'));
const profile = strip(read('src/pages/UserProfile.jsx'));
const engine = strip(read('src/services/aiUserVerificationEngine.js'));

console.log('\n💬 Chat says only what is true');

runTest('🚨 The three invented shops are gone', () => {
  for (const ghost of [
    'ร้านสเต็กพี่ตั้ม',
    'บราวน์ชูการ์ Express',
    '240809QUEUE01',
    'คิวพร้อมรับ A05',
    'INITIAL_CONVERSATIONS',
  ]) {
    assert(!chatModal.includes(ghost), `the fabricated conversation data ${ghost} is still seeded`);
  }
});

runTest('🚨 Messages actually leave the browser', () => {
  assert(!chatModal.includes('queueup_chat_conversations'), 'conversations are still kept in localStorage');
  assert(chatModal.includes('sendMessage('), 'messages are never sent anywhere');
  assert(chatService.includes("collection(db, 'chats', chatId, 'messages')"), 'the service does not write to Firestore');
});

runTest('🚨 An automated reply is never stored as the merchant', () => {
  // The exact bug: `sender: "merchant"` on a canned string, rendered under the
  // shop's own name and avatar.
  assert(!/sender:\s*["']merchant["']/.test(chatModal), 'the modal still writes a reply as the merchant');
  assert(chatModal.includes('SENDER.ASSISTANT'), 'the assistant is not distinguished from the shop');
});

runTest('🚨 The assistant is labelled as one on screen', () => {
  assert(/ผู้ช่วยอัตโนมัติ/.test(chatModal), 'nothing tells the reader the reply is automated');
  assert(/ไม่ใช่ข้อความจากร้าน/.test(chatModal), 'the label does not distinguish it from the shop');
});

runTest('🚨 The fallback no longer invents order status', () => {
  // Canned strings chosen by keyword, sent under the shop's name, telling
  // someone their food was ready when nothing in the system knew that.
  for (const invention of [
    'เสร็จพร้อมเสิร์ฟใน 2-4 นาที',
    'อาหารใส่กล่องร้อนๆ รอพร้อมส่งมอบ',
    'กำลังปรุงอาหารสดใหม่ตามคิว',
    'ทางพ่อครัวจัดเตรียมเมนู',
  ]) {
    assert(!aiChat.includes(invention), `the fallback still claims: ${invention}`);
  }
});

runTest('The fallback points at the screen that knows the real status', () => {
  assert(/คำสั่งซื้อของฉัน/.test(aiChat), 'the fallback does not direct the user to the real order status');
});

runTest('🚨 The chat document records the shop, or the shop cannot be admitted', () => {
  // storeId on the chat document is what the security rule reads to let the
  // shop participate. Without it the conversation is invisible to the shop.
  assert(chatService.includes('storeId'), 'the chat document carries no storeId');
  const block = chatRulesBlock();
  assert(block.includes('isStoreOwner('), 'the rules still admit only the customer');
  assert(block.includes('isChatOwner()'), 'the customer check was lost while widening');
  assert(!/allow read, write: if isAuthenticated\(\)\s*;/.test(block), 'the rule was widened back to every signed-in user');
});

runTest('Nobody can post under another person\'s uid', () => {
  const block = chatRulesBlock();
  assert(
    block.includes('request.resource.data.senderUid == request.auth.uid'),
    'the sender identity check is gone'
  );
});

console.log('\n🛡️  The trust score describes verification, not permission');

runTest('🚨 The report no longer returns privileges', () => {
  const report = calculateUserTrustScore({ email: 'a@lomsak.ac.th', phone: '0812345678' }, []);
  assert(report.privileges === undefined, 'privileges is still returned and nothing enforces it');
});

runTest('🚨 The profile page no longer claims approvals', () => {
  for (const claim of ['privileges.canOrder', 'privileges.canReview', 'privileges.canReportStore', 'สิทธิ์การใช้งานของคุณ']) {
    assert(!profile.includes(claim), `the profile still states an unenforced permission: ${claim}`);
  }
});

runTest('Nothing anywhere still reads the removed privileges', () => {
  assert(!engine.includes('canReportStore'), 'the engine still computes an unenforced privilege');
  assert(!engine.includes('maxCouponDiscount'), 'the engine still advertises a coupon cap nothing applies');
});

runTest('The verification report it does return is intact', () => {
  const full = calculateUserTrustScore(
    { email: 'student@lomsak.ac.th', phone: '0812345678', gender: 'M', birthDate: '2008-01-01', photo: 'x' },
    [{ status: 'COMPLETED' }, { status: 'COMPLETED' }]
  );
  assert(full.trustScore > 50, 'verification must still raise the score');
  assert(full.trustScore <= 100, 'the score must stay capped');
  assert(Array.isArray(full.breakdown) && full.breakdown.length > 0, 'the breakdown is what the panel shows');
  assert(typeof full.levelName === 'string' && full.levelName.length > 0, 'the level is still reported');
  assert(typeof full.trustCategory === 'string', 'the category is still reported');
});

runTest('An empty profile still produces a usable report', () => {
  const empty = calculateUserTrustScore({}, []);
  assert(empty.trustScore >= 0, 'the score must not go negative');
  assert(Array.isArray(empty.breakdown), 'the breakdown must always be an array');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
