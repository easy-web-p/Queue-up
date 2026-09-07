/**
 * ============================================================================
 * SERVER-SIDE ALLERGEN GUARD TEST SUITE
 * ============================================================================
 *
 * The allergen check used to live only in src/utils/allergenMatcher.ts, which runs
 * in the browser and could be skipped by calling the callable directly. These tests
 * cover the enforcing copy in functions/allergenGuard.js, and — because the
 * functions directory is deployed separately and cannot import from src/ — assert
 * that the two dictionaries have not drifted apart.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  ALLERGEN_PRESET_DICTIONARY,
  cleanAllergenLabel,
  detectMatchedAllergens,
  scanOrderForAllergens,
} from './functions/allergenGuard.js';

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

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

console.log('\n🛡️  SERVER-SIDE ALLERGEN GUARD TEST SUITE\n');

// ===========================================================================
console.log('1. Detection against menu text');
// ===========================================================================

runTest('Seafood allergy is caught in a dish title (ต้มยำกุ้ง)', () => {
  const r = detectMatchedAllergens({
    studentAllergies: ['อาหารทะเล / กุ้ง (Seafood)'],
    productTitle: 'ต้มยำกุ้งน้ำข้น',
  });
  assert(r.hasAllergens, 'must flag seafood');
  assert(r.details[0].triggerSource === 'TITLE', 'must report the title as the trigger');
});

runTest('Peanut allergy is caught via a synonym (ผัดไทย)', () => {
  const r = detectMatchedAllergens({
    studentAllergies: ['ถั่วลิสง (Peanuts)'],
    productTitle: 'ผัดไทยกุ้งสด',
  });
  assert(r.hasAllergens, 'dictionary synonyms must apply');
});

runTest('An allergen introduced only by a modifier is caught', () => {
  // The dish itself is safe; the topping is not.
  const r = detectMatchedAllergens({
    studentAllergies: ['ไข่ไก่ (Eggs)'],
    productTitle: 'ข้าวผัดหมู',
    selectedModifierNames: ['เพิ่มไข่ดาว'],
  });
  assert(r.hasAllergens, 'modifier options must be scanned');
  assert(r.details.some((d) => d.triggerSource === 'MODIFIER'), 'trigger must be the modifier');
});

runTest('A modifier allergen is caught even when the dish already matched another', () => {
  const r = detectMatchedAllergens({
    studentAllergies: ['ไข่ไก่ (Eggs)', 'นมวัว / แลคโตส (Dairy)'],
    productTitle: 'ขนมปังไข่',
    selectedModifierNames: ['ราดนมข้น'],
  });
  assert(r.matchedAllergenNames.length === 2, 'both allergens must be reported');
});

runTest('A custom (non-dictionary) allergen is matched literally', () => {
  const r = detectMatchedAllergens({
    studentAllergies: ['เห็ด'],
    productTitle: 'ผัดเห็ดรวมมิตร',
  });
  assert(r.hasAllergens, 'free-text allergens must still match');
});

runTest('Category and description are scanned too', () => {
  const byCategory = detectMatchedAllergens({
    studentAllergies: ['อาหารทะเล'],
    productTitle: 'จานเด็ดประจำร้าน',
    productCategory: 'อาหารทะเล',
  });
  assert(byCategory.hasAllergens, 'category must be scanned');

  const byDescription = detectMatchedAllergens({
    studentAllergies: ['งา (Sesame)'],
    productTitle: 'สลัดผัก',
    productDescription: 'ราดด้วยน้ำสลัดงาญี่ปุ่น',
  });
  assert(byDescription.hasAllergens, 'description must be scanned');
});

runTest('An unrelated dish is not flagged', () => {
  const r = detectMatchedAllergens({
    studentAllergies: ['อาหารทะเล / กุ้ง (Seafood)'],
    productTitle: 'ข้าวเปล่า',
  });
  assert(!r.hasAllergens, 'must not raise a false alarm');
});

runTest('A student with no recorded allergies is never flagged', () => {
  const r = detectMatchedAllergens({ studentAllergies: [], productTitle: 'ต้มยำกุ้ง' });
  assert(!r.hasAllergens, 'empty profile must pass');
});

runTest('cleanAllergenLabel strips the English gloss', () => {
  assert(cleanAllergenLabel('ถั่วลิสง (Peanuts)') === 'ถั่วลิสง', 'parenthetical must be stripped');
});

// ===========================================================================
console.log('\n2. Whole-order scan (what createOrderAuthoritative calls)');
// ===========================================================================

const safeItem = { productId: 'p1', name: 'ข้าวเปล่า', category: 'ข้าว', description: '' };
const shrimpItem = { productId: 'p2', name: 'ต้มยำกุ้ง', category: 'ต้มยำ', description: '' };

runTest('An order is flagged when any one item matches', () => {
  const r = scanOrderForAllergens(['อาหารทะเล / กุ้ง (Seafood)'], [safeItem, shrimpItem]);
  assert(r.hasAllergens, 'one bad item must flag the order');
  assert(r.flaggedItems.length === 1, 'only the offending item is reported');
  assert(r.flaggedItems[0].productId === 'p2', 'the right item must be named');
});

runTest('A fully safe order passes', () => {
  const r = scanOrderForAllergens(['อาหารทะเล / กุ้ง (Seafood)'], [safeItem]);
  assert(!r.hasAllergens, 'safe order must pass');
  assert(r.flaggedItems.length === 0, 'nothing to report');
});

runTest('No recorded allergies means no scan result', () => {
  const r = scanOrderForAllergens([], [shrimpItem]);
  assert(!r.hasAllergens, 'no profile, no block');
});

runTest('Malformed allergy entries are ignored, not crashed on', () => {
  const r = scanOrderForAllergens([null, undefined, '', 123, 'อาหารทะเล'], [shrimpItem]);
  assert(r.hasAllergens, 'the one valid entry must still work');
});

runTest('A missing or malformed profile is handled', () => {
  assert(!scanOrderForAllergens(null, [shrimpItem]).hasAllergens, 'null profile');
  assert(!scanOrderForAllergens(undefined, [shrimpItem]).hasAllergens, 'undefined profile');
  assert(!scanOrderForAllergens(['กุ้ง'], null).hasAllergens, 'null items');
});

// ===========================================================================
console.log('\n3. Client and server dictionaries must not drift');
// ===========================================================================

/** Pulls `keywords: [...]` string literals per allergen id out of a source file. */
function extractDictionary(file) {
  const src = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  const start = src.indexOf('ALLERGEN_PRESET_DICTIONARY');
  assert(start !== -1, `dictionary not found in ${file}`);
  const body = src.slice(src.indexOf('{', start), src.indexOf('\n};', start));

  const out = {};
  const entryRe = /(\w+):\s*\{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*keywords:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    const keywords = [...m[4].matchAll(/'([^']*)'/g)].map((k) => k[1]);
    out[m[2]] = { label: m[3], keywords };
  }
  return out;
}

const clientDict = extractDictionary('src/utils/allergenMatcher.ts');
const serverDict = extractDictionary('functions/allergenGuard.js');

runTest('The extraction actually found the presets (guards the test itself)', () => {
  assert(Object.keys(clientDict).length >= 8, `client dict looks empty: ${Object.keys(clientDict)}`);
  assert(Object.keys(serverDict).length >= 8, `server dict looks empty: ${Object.keys(serverDict)}`);
});

runTest('Both dictionaries define exactly the same allergens', () => {
  const c = Object.keys(clientDict).sort().join(',');
  const s = Object.keys(serverDict).sort().join(',');
  assert(c === s, `allergen ids differ\n       client: ${c}\n       server: ${s}`);
});

runTest('Every allergen has identical labels and keywords on both sides', () => {
  for (const id of Object.keys(clientDict)) {
    assert(
      clientDict[id].label === serverDict[id].label,
      `label drift on "${id}": ${clientDict[id].label} vs ${serverDict[id].label}`
    );
    const c = clientDict[id].keywords.join('|');
    const s = serverDict[id].keywords.join('|');
    assert(c === s, `keyword drift on "${id}"\n       client: ${c}\n       server: ${s}`);
  }
});

runTest('The runtime dictionary matches what is written in the file', () => {
  // Catches the module being edited without the source text agreeing.
  for (const id of Object.keys(serverDict)) {
    assert(ALLERGEN_PRESET_DICTIONARY[id], `${id} missing from the imported module`);
    assert(
      ALLERGEN_PRESET_DICTIONARY[id].keywords.join('|') === serverDict[id].keywords.join('|'),
      `runtime/source mismatch on ${id}`
    );
  }
});

// ===========================================================================
console.log('\n4. Enforcement is wired into createOrderAuthoritative');
// ===========================================================================

const fnSrc = fs.readFileSync(path.resolve(process.cwd(), 'functions/index.js'), 'utf8');

runTest('The order function runs the scan', () => {
  assert(fnSrc.includes('scanOrderForAllergens('), 'createOrderAuthoritative must scan');
});

runTest('A match blocks the order unless explicitly acknowledged', () => {
  assert(
    fnSrc.includes('allergenScan.hasAllergens && acknowledgeAllergenWarning !== true'),
    'a hit must block by default'
  );
  assert(fnSrc.includes('ALLERGEN_ALERT'), 'the refusal must be identifiable by the client');
});

runTest('The scan reads the authoritative product docs, not client-supplied text', () => {
  // The scan entry is built from prodData inside the transaction.
  assert(
    fnSrc.includes('name: prodData.name || ""'),
    'menu text must come from Firestore, not from the request'
  );
});

runTest('🚨 An override is written to the audit log', () => {
  assert(fnSrc.includes('ALLERGEN_WARNING_OVERRIDDEN'), 'overrides must be audited');
});

runTest('The audit entry is written in the same transaction as the order', () => {
  // An override must not be able to exist without its audit record.
  const auditIdx = fnSrc.indexOf('ALLERGEN_WARNING_OVERRIDDEN');
  const txEnd = fnSrc.indexOf('} catch (err) {', auditIdx);
  assert(auditIdx !== -1 && txEnd !== -1, 'audit write not found inside the transaction');
  assert(
    fnSrc.slice(auditIdx - 400, auditIdx).includes('tx.set('),
    'the audit entry must be part of the atomic write'
  );
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
