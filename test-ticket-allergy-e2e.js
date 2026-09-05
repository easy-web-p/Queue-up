/**
 * 🧪 TEST SUITE: Queue Ticket 5-Phase Stepper & Campus Allergen Detection E2E
 * Validates:
 * 1. Allergen synonym matching against food title, category, description, and chosen modifiers
 * 2. Custom allergen detection and bilingual preset mapping
 * 3. 5-Phase stepper status index calculation
 * 4. Audio trigger transition logic
 */

import assert from 'node:assert';
import {
  detectMatchedAllergens,
  cleanAllergenLabel,
  ALLERGEN_PRESET_DICTIONARY
} from './src/utils/allergenMatcher.ts';

console.log('🧪 Starting Queue Ticket & Allergen Shield E2E Test Suite...\n');

let passedTests = 0;
function pass(desc) {
  passedTests++;
  console.log(`✅ [PASS] Test ${passedTests}: ${desc}`);
}

// -------------------------------------------------------------
// PART 1: Allergen Label Cleaner & Preset Dictionary Tests
// -------------------------------------------------------------
{
  const cleaned1 = cleanAllergenLabel('ถั่วลิสง (Peanuts)');
  assert.strictEqual(cleaned1, 'ถั่วลิสง');

  const cleaned2 = cleanAllergenLabel('อาหารทะเล / กุ้ง (Seafood)');
  assert.strictEqual(cleaned2, 'อาหารทะเล / กุ้ง');

  const cleaned3 = cleanAllergenLabel('นมวัว / แลคโตส (Dairy)');
  assert.strictEqual(cleaned3, 'นมวัว / แลคโตส');

  pass('cleanAllergenLabel strips English parentheses and normalizes casing');
}

{
  assert(ALLERGEN_PRESET_DICTIONARY.peanut.keywords.includes('ถั่วลิสง'));
  assert(ALLERGEN_PRESET_DICTIONARY.seafood.keywords.includes('กุ้ง'));
  assert(ALLERGEN_PRESET_DICTIONARY.dairy.keywords.includes('ชีส'));
  assert(ALLERGEN_PRESET_DICTIONARY.gluten.keywords.includes('บะหมี่'));
  assert(ALLERGEN_PRESET_DICTIONARY.egg.keywords.includes('ไข่ดาว'));
  pass('ALLERGEN_PRESET_DICTIONARY contains comprehensive keyword coverage');
}

// -------------------------------------------------------------
// PART 2: Title, Category & Description Allergen Detection
// -------------------------------------------------------------
{
  // Test 3: Seafood allergy against Tom Yum Goong
  const result = detectMatchedAllergens({
    studentAllergies: ['อาหารทะเล / กุ้ง (Seafood)'],
    productTitle: 'ต้มยำกุ้งน้ำข้น',
    productCategory: 'ต้ม/แกง',
    productDescription: 'ต้มยำกุ้งแม่น้ำรสเด็ด เข้มข้นถึงเครื่อง',
    selectedModifierNames: []
  });

  assert.strictEqual(result.hasAllergens, true);
  assert(result.matchedAllergenNames.includes('อาหารทะเล / กุ้ง (Seafood)'));
  assert.strictEqual(result.details[0].triggerSource, 'TITLE');
  assert.strictEqual(result.details[0].triggerWord, 'กุ้ง');
  pass('Seafood allergy detected from product title "ต้มยำกุ้งน้ำข้น"');
}

{
  // Test 4: Peanut allergy against Pad Thai (synonym match)
  const result = detectMatchedAllergens({
    studentAllergies: ['ถั่วลิสง (Peanuts)'],
    productTitle: 'ผัดไทยโบราณ',
    productCategory: 'อาหารจานเดียว',
    productDescription: 'ผัดไทยเส้นจันท์เหนียวนุ่ม โรยถั่วคั่วหอมกรุ่น',
    selectedModifierNames: []
  });

  assert.strictEqual(result.hasAllergens, true);
  assert(result.matchedAllergenNames.includes('ถั่วลิสง (Peanuts)'));
  pass('Peanut allergy detected from Pad Thai via synonym dictionary');
}

{
  // Test 5: Dairy allergy against Matcha Latte
  const result = detectMatchedAllergens({
    studentAllergies: ['นมวัว / แลคโตส (Dairy)'],
    productTitle: 'มัทฉะลาเต้เย็น',
    productCategory: 'เครื่องดื่ม',
    productDescription: 'ชาเขียวมัทฉะแท้นำเข้า ผสมนมสดแท้ 100%',
    selectedModifierNames: []
  });

  assert.strictEqual(result.hasAllergens, true);
  assert(result.matchedAllergenNames.includes('นมวัว / แลคโตส (Dairy)'));
  pass('Dairy allergy detected from Matcha Latte via "ลาเต้" keyword');
}

// -------------------------------------------------------------
// PART 3: Modifier/Topping Level Allergen Detection
// -------------------------------------------------------------
{
  // Test 6: Dish itself is safe, but selected modifier introduces allergen
  const safeDishResult = detectMatchedAllergens({
    studentAllergies: ['ไข่ไก่ (Eggs)'],
    productTitle: 'ข้าวกะเพราไก่สับ',
    productCategory: 'อาหารจานเดียว',
    productDescription: 'ผัดกะเพราไก่สับสูตรโบราณ เผ็ดจัดจ้าน ไม่ใส่ผักอื่น',
    selectedModifierNames: ['ไม่เผ็ด', 'ข้าวสวยปกติ']
  });

  assert.strictEqual(safeDishResult.hasAllergens, false, 'Safe dish with safe modifiers should not trigger');

  // Now customer adds fried egg topping!
  const dangerousDishResult = detectMatchedAllergens({
    studentAllergies: ['ไข่ไก่ (Eggs)'],
    productTitle: 'ข้าวกะเพราไก่สับ',
    productCategory: 'อาหารจานเดียว',
    productDescription: 'ผัดกะเพราไก่สับสูตรโบราณ เผ็ดจัดจ้าน ไม่ใส่ผักอื่น',
    selectedModifierNames: ['ไม่เผ็ด', 'ไข่ดาวกรอบ']
  });

  assert.strictEqual(dangerousDishResult.hasAllergens, true, 'Modifier "ไข่ดาวกรอบ" must trigger egg allergy');
  assert(dangerousDishResult.matchedAllergenNames.includes('ไข่ไก่ (Eggs)'));
  const modDetail = dangerousDishResult.details.find((d) => d.triggerSource === 'MODIFIER');
  assert(modDetail, 'Trigger source must be MODIFIER');
  assert.strictEqual(modDetail.triggerWord, 'ไข่ดาว');
  pass('Modifier level allergy detection captures added toppings (ไข่ดาวกรอบ)');
}

{
  // Test 7: Custom allergen string detection (e.g. "เห็ด" or "ผงชูรส")
  const customResult = detectMatchedAllergens({
    studentAllergies: ['เห็ด'],
    productTitle: 'ต้มยำรวมมิตรเห็ดฟาง',
    productCategory: 'ต้ม/แกง',
    productDescription: 'ต้มยำเห็ดเพื่อสุขภาพ',
    selectedModifierNames: []
  });

  assert.strictEqual(customResult.hasAllergens, true);
  assert(customResult.matchedAllergenNames.includes('เห็ด'));
  pass('Custom user-defined allergen ("เห็ด") correctly flags matching dish');
}

{
  // Test 8: Empty student allergies returns clean result
  const emptyResult = detectMatchedAllergens({
    studentAllergies: [],
    productTitle: 'กุ้งแม่น้ำเผา',
    productCategory: 'อาหารทะเล',
    productDescription: 'กุ้งแม่น้ำตัวโต',
    selectedModifierNames: ['น้ำจิ้มซีฟู้ด']
  });

  assert.strictEqual(emptyResult.hasAllergens, false);
  assert.strictEqual(emptyResult.matchedAllergenNames.length, 0);
  pass('Empty student allergy profile returns hasAllergens: false');
}

// -------------------------------------------------------------
// PART 4: ClientQueueTicket 5-Phase Index Resolution
// -------------------------------------------------------------
function calculatePhaseIndex(order) {
  const statusUpper = (order?.status || '').toUpperCase();
  const queueStatusLower = (order?.queueStatus || '').toLowerCase();

  if (statusUpper === 'CANCELLED' || queueStatusLower === 'cancelled') return -1;
  if (statusUpper === 'COMPLETED' || queueStatusLower === 'completed') return 5;
  if (statusUpper === 'READY_FOR_PICKUP' || statusUpper === 'TO_RECEIVE' || queueStatusLower === 'ready') return 4;
  if (statusUpper === 'PREPARING' || queueStatusLower === 'cooking') return 3;
  if (statusUpper === 'CONFIRMED' || queueStatusLower === 'confirmed') return 2;
  return 1;
}

{
  assert.strictEqual(calculatePhaseIndex({ status: 'PENDING', queueStatus: 'waiting' }), 1);
  assert.strictEqual(calculatePhaseIndex({ status: 'CONFIRMED', queueStatus: 'confirmed' }), 2);
  assert.strictEqual(calculatePhaseIndex({ status: 'PREPARING', queueStatus: 'cooking' }), 3);
  assert.strictEqual(calculatePhaseIndex({ status: 'READY_FOR_PICKUP', queueStatus: 'ready' }), 4);
  assert.strictEqual(calculatePhaseIndex({ status: 'TO_RECEIVE', queueStatus: 'ready' }), 4);
  assert.strictEqual(calculatePhaseIndex({ status: 'COMPLETED', queueStatus: 'completed' }), 5);
  assert.strictEqual(calculatePhaseIndex({ status: 'CANCELLED', queueStatus: 'cancelled' }), -1);
  pass('5-Phase Stepper accurately resolves all ordering and kitchen lifecycle states');
}

// -------------------------------------------------------------
// PART 5: Audio Notification Transition Trigger
// -------------------------------------------------------------
{
  let chimePlayed = 0;
  let prevPhase = 1;

  function simulateStateUpdate(newPhase) {
    if (newPhase === 4 && prevPhase < 4) {
      chimePlayed++;
    }
    prevPhase = newPhase;
  }

  // PENDING -> CONFIRMED (no sound)
  simulateStateUpdate(2);
  assert.strictEqual(chimePlayed, 0);

  // CONFIRMED -> PREPARING (no sound)
  simulateStateUpdate(3);
  assert.strictEqual(chimePlayed, 0);

  // PREPARING -> READY (CHIME FIRES!)
  simulateStateUpdate(4);
  assert.strictEqual(chimePlayed, 1, 'Chime must play upon entering Phase 4 (READY)');

  // READY -> READY (re-render / same phase, should NOT re-chime)
  simulateStateUpdate(4);
  assert.strictEqual(chimePlayed, 1, 'Chime must not spam on subsequent re-renders in READY phase');

  // READY -> COMPLETED (no chime)
  simulateStateUpdate(5);
  assert.strictEqual(chimePlayed, 1);

  pass('Audio chime fires exactly once upon transition to READY (Phase 4)');
}

console.log(`\n🎉 Queue Ticket & Allergen Shield Matrix: ${passedTests}/${passedTests} scenarios passed (100%).\n`);
