/**
 * AI Intent Router Answer-Quality Suite
 *
 * Layer 1 answers from store data. What matters is not that it replies, but
 * that the reply is the right one: a price question must return the price, a
 * sold-out item must be reported sold out, and anything the store has not
 * published must escalate rather than be invented.
 *
 * The matching cases exist because Thai is written without spaces. Splitting a
 * question on whitespace produced one token, so a dish name was never found and
 * every price question answered with the whole catalogue instead.
 */

import { processAssistantReply } from '../services/aiChatEngine.js';

console.log('===============================================================');
console.log('🧭 QUEUEUP AI INTENT ROUTER — ANSWER QUALITY SUITE');
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

const store = {
  id: 'store-router',
  name: 'ร้านข้าวมันไก่โกฮับ',
  isOpen: true,
  openingHours: '08:00 - 16:30 น.',
  currentQueueCount: 4,
  averageWaitMinutes: 12,
  contactChannels: { pickupCounterLocation: 'ช่องรับอาหาร A3', phone: '081-234-5678' },
  exchangeTerms: {
    pickupWindowMinutes: 15,
    pickupPolicy: 'แสดงรหัส PIN 4 หลักที่หน้าร้าน',
    paymentTerms: 'รองรับ PromptPay QR, Campus Wallet และเงินสดหน้าร้าน',
    cancellationPolicy: 'ยกเลิกได้ก่อนร้านกดเริ่มปรุง'
  }
};

const menuItems = [
  { id: 'm1', name: 'ข้าวมันไก่ต้ม', price: 45, isAvailable: true, orderCount: 120, rating: 4.8, preparationMinutes: 6, tags: [] },
  { id: 'm2', name: 'ข้าวมันไก่ทอด', price: 50, isAvailable: true, orderCount: 310, rating: 4.9, preparationMinutes: 8, tags: [] },
  { id: 'm3', name: 'น้ำเก๊กฮวย', price: 15, isAvailable: false, orderCount: 80, rating: 4.5, tags: [] },
  { id: 'm4', name: 'ข้าวผัดเจ', price: 40, isAvailable: true, orderCount: 12, rating: 4.2, tags: ['เจ'] }
].map((i) => ({ ...i, storeId: store.id }));

async function ask(message, overrides = {}) {
  return processAssistantReply({
    message,
    chatThread: { id: 'c1', storeId: store.id, customerId: 'cust-1', aiAutoReply: true },
    store,
    activeOrder: null,
    menuItems,
    ...overrides
  });
}

async function runTests() {
  // --- Thai has no word boundaries: the dish name is inside the sentence ---
  console.log('\n--- Menu matching in unsegmented Thai ---');
  let r = await ask('ข้าวมันไก่ทอดราคาเท่าไหร่');
  check(r.replyText.includes('฿50') && r.replyText.includes('ข้าวมันไก่ทอด'),
    'A price question answers with that item\'s price', r.replyText.split('\n')[1]);
  check(!r.replyText.includes('ข้าวมันไก่ต้ม'),
    'It does not fall back to printing the whole catalogue');

  r = await ask('ข้าวมันไก่ต้มกี่บาท');
  check(r.replyText.includes('฿45'), 'The longest matching name wins, not the first');

  r = await ask('น้ำเก๊กฮวยมีไหม');
  check(r.replyText.includes('หมดชั่วคราว'),
    'A sold-out item is reported sold out rather than escalated');

  r = await ask('มีเมนูอะไรบ้าง');
  check(r.replyText.includes('ข้าวมันไก่ต้ม') && r.replyText.includes('ข้าวมันไก่ทอด'),
    'An open-ended menu question still lists the catalogue');

  // --- Recommendations answer, rather than reprinting the menu ---
  console.log('\n--- Recommendations ---');
  r = await ask('เมนูไหนขายดีที่สุด');
  check(r.replyText.includes('ข้าวมันไก่ทอด') && /310/.test(r.replyText),
    'The best seller is ranked by real order counts', 'ข้าวมันไก่ทอด 310');
  check(r.aiMeta.escalated === false, 'It is answered, not escalated');

  // --- Service questions the store has published ---
  console.log('\n--- Published service information ---');
  r = await ask('รับอาหารตรงไหน');
  check(r.replyText.includes('ช่องรับอาหาร A3') && !r.aiMeta.escalated,
    'The pickup point is answered from store data');

  r = await ask('รับเงินสดไหม');
  check(r.replyText.includes('เงินสด') && !r.aiMeta.escalated,
    'Payment methods are answered from the store\'s own terms');

  r = await ask('ออเดอร์ผมถึงไหนแล้ว', {
    activeOrder: {
      id: 'ord-1', status: 'PREPARING', queueNumber: 'A07',
      exchangePin: '1234', estimatedWaitMinutes: 7,
      items: [{ name: 'ข้าวมันไก่ทอด', quantity: 1 }]
    }
  });
  check(r.replyText.includes('A07') && !r.aiMeta.escalated,
    'An order-status phrasing reaches the queue tool', 'queue A07');

  // --- Greetings must not page the merchant ---
  console.log('\n--- Greetings ---');
  r = await ask('สวัสดีครับ');
  check(!r.aiMeta.escalated && r.replyText.includes('สวัสดี'),
    'A greeting is answered without notifying the store');

  r = await ask('ขอบคุณครับ');
  check(!r.aiMeta.escalated, 'Thanks is answered without notifying the store');

  // A greeting wrapped around a real question must not swallow it.
  r = await ask('สวัสดีครับ ร้านเปิดกี่โมง');
  check(r.replyText.includes('08:00'),
    'A greeting attached to a question still answers the question');

  // --- What the assistant must refuse to guess ---
  console.log('\n--- Honest escalation ---');
  r = await ask('มีเมนูเจไหม');
  check(r.replyText.includes('ข้าวผัดเจ') && !r.aiMeta.escalated,
    'A dietary question is answered when the store tagged the item');

  r = await ask('มีเมนูฮาลาลไหม');
  check(r.aiMeta.escalated && !/ฮาลาล.*มี|ปลอดภัย/.test(r.replyText),
    'An untagged dietary question escalates instead of guessing');

  r = await ask('ขอลดราคาหน่อยได้ไหม');
  check(r.aiMeta.escalated, 'A discount request is never granted on the store\'s behalf');

  r = await ask('ผมแพ้กุ้ง กินต้มยำกุ้งได้ไหม');
  check(r.aiMeta.escalated && r.replyText.includes('Allergen'),
    'An allergy question is hard-blocked to a human');

  r = await ask('มีที่จอดรถไหม');
  check(r.aiMeta.escalated, 'A genuinely unknown question still escalates');

  console.log('\n===============================================================');
  console.log(`📊 INTENT ROUTER TEST RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
  console.log('===============================================================\n');

  if (passed !== total) process.exit(1);
}

runTests().catch((err) => {
  console.error('❌ Intent router suite crashed:', err);
  process.exit(1);
});
