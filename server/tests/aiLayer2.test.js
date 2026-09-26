/**
 * AI Layer 2 Test Suite
 *
 * Layer 2 lets a model phrase an answer from this store's real data. The
 * properties worth pinning are structural, so they hold without calling the
 * model: the tool surface offers no way to name another store, exposes nothing
 * that writes, and any failure degrades to human escalation rather than
 * breaking the conversation. The tool loop itself runs against an injected
 * client.
 */

import { runLayer2, isLayer2Enabled, invokeTool, FUNCTION_DECLARATIONS } from '../services/aiLayer2.js';
import { makeStoreTools, processAssistantReply } from '../services/aiChatEngine.js';

console.log('===============================================================');
console.log('🤖 QUEUEUP AI LAYER 2 (SCOPE-BOUND TOOL CALLING) TEST SUITE');
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
  id: 'store-layer2',
  name: 'ร้านข้าวมันไก่โกฮับ',
  isOpen: true,
  openingHours: '08:00 - 16:30 น.',
  currentQueueCount: 4,
  averageWaitMinutes: 12,
  schoolId: 'KKU'
};

const menuItems = [
  { id: 'm1', storeId: 'store-layer2', name: 'ข้าวมันไก่ต้ม', price: 45, isAvailable: true, category: 'ข้าว' },
  { id: 'm2', storeId: 'store-layer2', name: 'ข้าวมันไก่ทอด', price: 50, isAvailable: true, category: 'ข้าว' },
  { id: 'm3', storeId: 'store-layer2', name: 'น้ำเก๊กฮวย', price: 15, isAvailable: false, category: 'เครื่องดื่ม' }
];

const tools = makeStoreTools({ store, activeOrder: null, menuItems, schoolId: 'KKU', customerId: 'cust-1' });

/** A model client that replays a scripted sequence of responses. */
function scriptedClient(script) {
  let turn = 0;
  const seen = [];
  return {
    seen,
    models: {
      generateContent: async ({ contents }) => {
        seen.push(structuredClone(contents));
        const next = script[Math.min(turn, script.length - 1)];
        turn += 1;
        return next;
      }
    }
  };
}

async function runTests() {
  // --- The tool surface cannot name another tenant ---
  console.log('\n--- Tool surface is scope-bound ---');
  const declaredParams = FUNCTION_DECLARATIONS.flatMap(
    (fn) => Object.keys(fn.parameters?.properties || {})
  );
  const tenantKeys = declaredParams.filter((key) =>
    /storeid|customerid|schoolid|uid|orderid/i.test(key)
  );
  check(tenantKeys.length === 0,
    'No declared tool parameter can name a store, customer or school',
    `declared: ${declaredParams.join(', ') || 'none'}`);

  const writeVerbs = FUNCTION_DECLARATIONS.filter((fn) =>
    /create|update|delete|cancel|pay|refund|send|set|accept|reject/i.test(fn.name)
  );
  check(writeVerbs.length === 0,
    'Only read-only tools are exposed to the model',
    `tools: ${FUNCTION_DECLARATIONS.map((f) => f.name).join(', ')}`);

  // --- Tool dispatch is bound to the closure, not to arguments ---
  console.log('\n--- Tool dispatch ---');
  const statusResult = await invokeTool(tools, 'getStoreStatus', { storeId: 'some-other-store' });
  check(statusResult.storeId === 'store-layer2',
    'A storeId smuggled into the arguments is ignored',
    `resolved ${statusResult.storeId}`);

  const menu = await invokeTool(tools, 'getMenuCatalog', { categoryFilter: 'เครื่องดื่ม' });
  check(menu.itemCount === 0,
    'Unavailable items are filtered out of the catalogue', `itemCount ${menu.itemCount}`);

  const unknown = await invokeTool(tools, 'deleteEverything', {});
  check(unknown.error === 'UNKNOWN_TOOL',
    'A hallucinated tool name is reported, not thrown', `error ${unknown.error}`);

  // --- Opt-in gating ---
  console.log('\n--- Opt-in gating ---');
  const priorKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  check(isLayer2Enabled() === false, 'Layer 2 is off when no API key is configured');
  check((await runLayer2({ message: 'อะไรก็ได้', tools })) === null,
    'runLayer2 returns null while disabled');

  const escalation = await processAssistantReply({
    message: 'ร้านมีที่จอดรถไหมครับ',
    chatThread: { id: 'c1', storeId: store.id, customerId: 'cust-1', aiAutoReply: true },
    store,
    activeOrder: null,
    menuItems
  });
  check(escalation.handled && escalation.aiMeta.escalated === true,
    'With Layer 2 off, an unrecognised question still escalates to the store');

  // --- The tool loop, against an injected client ---
  console.log('\n--- Tool-calling loop ---');
  const client = scriptedClient([
    { functionCalls: [{ name: 'findMenuItem', args: { queryText: 'ข้าวมันไก่ทอด' } }] },
    { functionCalls: [], text: 'ข้าวมันไก่ทอดราคา 50 บาทค่ะ ตอนนี้ร้านเปิดอยู่ค่ะ' }
  ]);

  const result = await runLayer2({ message: 'ข้าวมันไก่ทอดราคาเท่าไหร่', tools, client });
  check(result?.replyText?.includes('50'),
    'The model answers from the tool result', `reply: ${result?.replyText?.slice(0, 40)}`);
  check(result?.toolsUsed?.includes('findMenuItem'),
    'The tool actually invoked is reported back', `toolsUsed ${result?.toolsUsed?.join(', ')}`);

  const secondRequest = client.seen[1];
  const functionResponsePart = secondRequest
    .flatMap((c) => c.parts || [])
    .find((part) => part.functionResponse);
  check(Boolean(functionResponsePart),
    'The tool result is fed back into the next model turn');

  // --- Failure modes degrade, never break ---
  console.log('\n--- Failure handling ---');
  const throwingClient = {
    models: { generateContent: async () => { throw new Error('upstream 503'); } }
  };
  check((await runLayer2({ message: 'สวัสดี', tools, client: throwingClient })) === null,
    'An upstream failure degrades to null rather than throwing');

  const loopingClient = scriptedClient([
    { functionCalls: [{ name: 'getStoreStatus', args: {} }] }
  ]);
  check((await runLayer2({ message: 'วนไปเรื่อย ๆ', tools, client: loopingClient })) === null,
    'A model that only ever calls tools is cut off after the round limit');

  const longClient = scriptedClient([{ functionCalls: [], text: 'ก'.repeat(900) }]);
  const longResult = await runLayer2({ message: 'ยาว ๆ', tools, client: longClient });
  check((longResult?.replyText?.length || 0) <= 601,
    'An overlong reply is truncated', `length ${longResult?.replyText?.length}`);

  if (priorKey !== undefined) process.env.GEMINI_API_KEY = priorKey;

  console.log('\n===============================================================');
  console.log(`📊 AI LAYER 2 TEST RESULTS: ${passed}/${total} Passed (${passed === total ? 'ALL PASSED' : 'FAILURES DETECTED'})`);
  console.log('===============================================================\n');

  if (passed !== total) process.exit(1);
}

runTests().catch((err) => {
  console.error('❌ Layer 2 suite crashed:', err);
  process.exit(1);
});
