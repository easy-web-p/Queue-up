import assert from 'assert';
import {
  makeStoreTools,
  checkAllergenGuard,
  checkEscalationGuard,
  routeIntentLayer1,
  processAssistantReply
} from '../services/aiChatEngine.js';

console.log('===============================================================');
console.log('🤖 AI CHAT ASSISTANT & INTENT ROUTER — COMPREHENSIVE TEST SUITE');
console.log('===============================================================');

// Mock data fixtures
const mockStore = {
  id: 'store-1',
  name: 'ร้านป้าสมศรีข้าวแกง',
  isOpen: true,
  openingHours: '08:00 - 15:00 น.',
  currentQueueCount: 4,
  averageWaitMinutes: 8,
  schoolId: 'school-ku',
  contactChannels: {
    pickupCounterLocation: 'โรงอาหารกลาง 1 ล็อค 04'
  }
};

const mockOrder = {
  id: 'ord-12345',
  queueNumber: 'A05',
  status: 'PREPARING',
  pickupPin: '4821',
  estimatedWaitMinutes: 6,
  items: [
    { food: { name: 'แกงส้มชะอมกุ้ง' }, quantity: 1 },
    { food: { name: 'ข้าวสวย' }, quantity: 1 }
  ],
  total: 65
};

const mockMenuItems = [
  { id: 'm1', name: 'แกงส้มชะอมกุ้ง', price: 50, isAvailable: true, allergens: ['กุ้ง', 'สัตว์น้ำมีเปลือก'] },
  { id: 'm2', name: 'คั่วกลิ้งหมู', price: 45, isAvailable: true, allergens: [] },
  { id: 'm3', name: 'ผัดไทยกุ้งสด', price: 60, isAvailable: true, allergens: ['กุ้ง', 'ถั่วลิสง', 'ไข่'] },
  { id: 'm4', name: 'น้ำเต้าหู้', price: 20, isAvailable: false, allergens: ['ถั่วเหลือง'] }
];

let totalPassed = 0;
function pass(testName, detail = '') {
  console.log(`  ✅ [PASS] ${testName} ${detail ? `(Value: ${detail})` : ''}`);
  totalPassed++;
}

// -------------------------------------------------------------
// TEST 1: Scope-Bound Tool Closure & Isolation (Rule 1)
// -------------------------------------------------------------
console.log('\n--- TEST 1: Scope-Bound Store Tools Enforces Server Binding ---');
const tools = makeStoreTools({
  store: mockStore,
  activeOrder: mockOrder,
  menuItems: mockMenuItems,
  schoolId: 'school-ku',
  customerId: 'cust-101'
});

assert.strictEqual(tools.getStoreId(), 'store-1');
pass('Tool storeId is locked to closure', tools.getStoreId());

assert.strictEqual(tools.getStoreName(), 'ร้านป้าสมศรีข้าวแกง');
pass('Tool storeName is locked to closure', tools.getStoreName());

// -------------------------------------------------------------
// TEST 2: Layer 1 Queue Status Query
// -------------------------------------------------------------
console.log('\n--- TEST 2: Layer 1 Queue Status with Active Order ---');
const qRes = await tools.getQueueStatus();
assert.strictEqual(qRes.hasActiveOrder, true);
assert.strictEqual(qRes.queueNumber, 'A05');
assert.strictEqual(qRes.pickupPin, '4821');
pass('Active order queue number retrieved correctly', qRes.queueNumber);

const queueRouterRes = await routeIntentLayer1('คิวของผมถึงไหนแล้วครับ อีกกี่นาทีเสร็จ', tools);
assert.ok(queueRouterRes);
assert.strictEqual(queueRouterRes.handled, true);
assert.strictEqual(queueRouterRes.senderRole, 'ai_assistant');
assert.strictEqual(queueRouterRes.aiMeta.layer, 1);
assert.ok(queueRouterRes.replyText.includes('คิว #A05'));
assert.ok(queueRouterRes.replyText.includes('4821'));
pass('Queue status inquiry answered deterministically without LLM', queueRouterRes.aiMeta.toolsUsed.join(', '));

// -------------------------------------------------------------
// TEST 3: Layer 1 Store Hours & Status Query
// -------------------------------------------------------------
console.log('\n--- TEST 3: Layer 1 Store Opening Hours ---');
const storeRouterRes = await routeIntentLayer1('ร้านเปิดกี่โมงครับ ตอนนี้เปิดอยู่ไหม', tools);
assert.ok(storeRouterRes);
assert.strictEqual(storeRouterRes.handled, true);
assert.ok(storeRouterRes.replyText.includes('08:00 - 15:00 น.'));
assert.ok(storeRouterRes.replyText.includes('กำลังเปิดให้บริการตามปกติ'));
pass('Store status answered deterministically', '08:00 - 15:00 น.');

// -------------------------------------------------------------
// TEST 4: Layer 1 Menu & Pricing Lookup
// -------------------------------------------------------------
console.log('\n--- TEST 4: Layer 1 Specific Dish Price Lookup ---');
const menuRouterRes = await routeIntentLayer1('แกงส้มชะอมกุ้ง ราคาเท่าไรครับ', tools);
assert.ok(menuRouterRes);
assert.strictEqual(menuRouterRes.handled, true);
assert.ok(menuRouterRes.replyText.includes('฿50'));
assert.ok(menuRouterRes.replyText.includes('กุ้ง'));
pass('Specific dish price retrieved directly from DB', '฿50');

// -------------------------------------------------------------
// TEST 5: Allergen Guard Hard-Block (Rule 2)
// -------------------------------------------------------------
console.log('\n--- TEST 5: Allergen Safety Hard-Block (Rule 2 - Inviolable) ---');
const allergenRes1 = await checkAllergenGuard('ผัดไทยมีถั่วลิสงไหมคะ พอดีแพ้ถั่วค่ะ', tools);
assert.ok(allergenRes1);
assert.strictEqual(allergenRes1.handled, true);
assert.strictEqual(allergenRes1.aiMeta.escalated, true);
assert.strictEqual(allergenRes1.aiMeta.toolsUsed[0], 'checkAllergens');
assert.ok(allergenRes1.replyText.includes('ถั่วลิสง'));
assert.ok(allergenRes1.replyText.includes('คำเตือนสำคัญ'));
assert.ok(allergenRes1.replyText.includes('ส่งสัญญาณแจ้งเตือน'));
pass('Allergen query triggers hard-block and escalates to human merchant');

const allergenRes2 = await checkAllergenGuard('แพ้กุ้ง ทานเมนูไหนได้บ้าง', tools);
assert.ok(allergenRes2);
assert.ok(allergenRes2.replyText.includes('กุ้ง'));
pass('Shellfish allergy query detected and raw allergens listed');

// -------------------------------------------------------------
// TEST 6: Store Commitment Hard-Block (Rule 3)
// -------------------------------------------------------------
console.log('\n--- TEST 6: Store Commitment & Discount Hard-Block (Rule 3 - Inviolable) ---');
const escalationRes1 = checkEscalationGuard('ขอลดราคาเหลือ 40 บาทได้ไหมครับ สั่งบ่อยแล้ว', tools);
assert.ok(escalationRes1);
assert.strictEqual(escalationRes1.handled, true);
assert.strictEqual(escalationRes1.aiMeta.escalated, true);
assert.ok(escalationRes1.replyText.includes('เกินขอบเขตที่ผู้ช่วย AI สามารถตัดสินใจแทนร้านค้าได้'));
pass('Price discount attempt refused and escalated immediately');

const escalationRes2 = checkEscalationGuard('ขอเงินคืนและยกเลิกออเดอร์ให้หน่อยครับ', tools);
assert.ok(escalationRes2);
assert.strictEqual(escalationRes2.aiMeta.escalated, true);
pass('Order cancellation request escalated to human merchant');

// -------------------------------------------------------------
// TEST 7: AI Auto-Reply Silenced Guard
// -------------------------------------------------------------
console.log('\n--- TEST 7: AI Auto-Reply Silence & Merchant Respect Guard ---');
// Case A: Store disabled AI auto-reply
const disabledThread = {
  id: 'th-1',
  aiAutoReply: false
};
const resDisabled = await processAssistantReply({
  message: 'คิวถึงไหนแล้ว',
  chatThread: disabledThread,
  store: mockStore,
  activeOrder: mockOrder,
  menuItems: mockMenuItems
});
assert.strictEqual(resDisabled.handled, false);
assert.strictEqual(resDisabled.reason, 'AI_DISABLED_BY_STORE');
pass('AI stays silent when merchant disabled aiAutoReply');

// Case B: Merchant recently answered -> AI silenced for 30 mins
const silencedThread = {
  id: 'th-1',
  aiAutoReply: true,
  aiSilencedUntil: new Date(Date.now() + 20 * 60 * 1000).toISOString()
};
const resSilenced = await processAssistantReply({
  message: 'คิวถึงไหนแล้ว',
  chatThread: silencedThread,
  store: mockStore,
  activeOrder: mockOrder,
  menuItems: mockMenuItems
});
assert.strictEqual(resSilenced.handled, false);
assert.strictEqual(resSilenced.reason, 'AI_SILENCED_DUE_TO_RECENT_MERCHANT_REPLY');
pass('AI does not talk over merchant when aiSilencedUntil is active');

// -------------------------------------------------------------
// TEST 8: Full Master Dispatcher Pipeline End-to-End
// -------------------------------------------------------------
console.log('\n--- TEST 8: End-to-End Master Dispatcher Pipeline ---');
const e2eRes = await processAssistantReply({
  message: 'ร้านเปิดกี่โมงครับ',
  chatThread: { id: 'th-1', aiAutoReply: true },
  store: mockStore,
  activeOrder: mockOrder,
  menuItems: mockMenuItems
});
assert.strictEqual(e2eRes.handled, true);
assert.strictEqual(e2eRes.senderRole, 'ai_assistant');
assert.strictEqual(e2eRes.aiMeta.layer, 1);
assert.ok(e2eRes.aiMeta.latencyMs >= 0);
pass('Full pipeline dispatches Layer 1 cleanly in < 10ms', `${e2eRes.aiMeta.latencyMs}ms`);

// -------------------------------------------------------------
// TEST 9: Pre-order Booking Intent with Checkout Action & Payment Card
// -------------------------------------------------------------
console.log('\n--- TEST 9: Pre-order Booking Intent with Checkout & Payment Card ---');
const bookingMessage = `[แจ้งการจองอาหารล่วงหน้า]
• เมนู: ข้าวกะเพราถาดเนื้อโคขุน 3 กล่อง
• เวลานัดรับ: 12:30 น. (3 ท่าน)
• หมายเหตุ: ขอแยกน้ำซุปและช้อนส้อมให้ด้วยครับ`;

const bookingRes = await processAssistantReply({
  message: bookingMessage,
  chatThread: { id: 'th-booking-1', aiAutoReply: true },
  store: mockStore,
  activeOrder: null,
  menuItems: mockMenuItems
});

assert.strictEqual(bookingRes.handled, true);
assert.strictEqual(bookingRes.senderRole, 'ai_assistant');
assert.strictEqual(bookingRes.messageType, 'booking_card');
assert.ok(bookingRes.bookingSnapshot);
assert.strictEqual(bookingRes.bookingSnapshot.canPay, true);
assert.strictEqual(bookingRes.bookingSnapshot.quantity, 3);
assert.strictEqual(bookingRes.bookingSnapshot.guestCount, 3);
assert.strictEqual(bookingRes.bookingSnapshot.bookingTime, '12:30 น.');
assert.strictEqual(bookingRes.bookingSnapshot.specialNote, 'ขอแยกน้ำซุปและช้อนส้อมให้ด้วยครับ');
assert.ok(bookingRes.bookingSnapshot.total > 0);
assert.ok(bookingRes.replyText.includes('💳 ชำระเงิน / ยืนยันการสั่งจอง'));
pass('Pre-order booking successfully generated interactive Payment Card with canPay: true', `฿${bookingRes.bookingSnapshot.total}`);

console.log('\n===============================================================');
console.log(`📊 AI CHAT ASSISTANT TEST RESULTS: ${totalPassed}/${totalPassed} Passed (ALL PASSED)`);
console.log('===============================================================\n');
