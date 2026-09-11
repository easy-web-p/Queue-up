import assert from 'node:assert/strict';
import {
  EN_TO_TH,
  TH_TO_EN,
  enToTh,
  thToEn,
  translateText,
  detectLayout,
  isThaiChar,
  isEnglishChar,
  translateKeystroke,
  backgroundSearchMatches,
  attachBackgroundKeystrokeTranslator,
} from './src/utils/keystrokeTranslator.ts';

console.log('🧪 Starting Thai <-> English Keystroke Translator Test Suite...\n');

// 1. Basic conversions
assert.equal(enToTh('l;ylfu'), 'สวัสดี', 'l;ylfu should translate to สวัสดี');
assert.equal(thToEn('สวัสดี'), 'l;ylfu', 'สวัสดี should translate to l;ylfu');
console.log('✅ Test 1: Basic Thai-English conversion passed ("l;ylfu" <-> "สวัสดี")');

// 2. Common Thai typing mistakes on English keyboard
assert.equal(enToTh('g-hk'), 'เข้า', 'g-hk should translate to เข้า');
assert.equal(enToTh('phkf'), 'ย้าด', 'phkf translation test');
assert.equal(enToTh('Tok8kicsj\'xitgmLwmp'), 'ธนาคารแห่งประเทศไทย', 'Bank of Thailand standard test passed');
console.log('✅ Test 2: Standard vocabulary test passed ("Tok8kicsj\'xitgmLwmp" -> "ธนาคารแห่งประเทศไทย")');

// 3. English typing mistakes on Thai keyboard
assert.equal(thToEn('ฟหกด'), 'asdf', 'ฟหกด should translate to asdf');
assert.equal(thToEn('ยบลฃ'), 'p[]\\', 'ยบลฃ should translate to p[]\\');
console.log('✅ Test 3: Home row and punctuation translation passed ("ฟหกด" -> "asdf")');

// 4. Auto-detect translation
assert.equal(translateText('l;ylfu'), 'สวัสดี', 'Auto-detect en -> th');
assert.equal(translateText('สวัสดี'), 'l;ylfu', 'Auto-detect th -> en');
console.log('✅ Test 4: Auto-detect translation passed');

// 5. Shifted numbers and symbols
assert.equal(enToTh('555+'), 'ถถถ๙', '555+ on EN keyboard maps to ถถถ๙ on TH');
assert.equal(thToEn('ถถถ๙'), '555+', 'ถถถ๙ on TH keyboard maps to 555+ on EN');
console.log('✅ Test 5: Number and shift symbol conversion passed ("555+" <-> "ถถถ๙")');

// 6. Character detection
assert.equal(isThaiChar('ก'), true, 'ก is Thai');
assert.equal(isThaiChar('a'), false, 'a is not Thai');
assert.equal(isEnglishChar('z'), true, 'z is English');
assert.equal(isEnglishChar('ช'), false, 'ช is not English');
console.log('✅ Test 6: Character detection helpers passed');

// 7. Keystroke translator helper
assert.equal(translateKeystroke('g', 'th'), 'เ', 'Keystroke "g" to Thai is "เ"');
assert.equal(translateKeystroke('เ', 'en'), 'g', 'Keystroke "เ" to English is "g"');
assert.equal(EN_TO_TH['g'], 'เ', 'EN_TO_TH map check');
assert.equal(TH_TO_EN['เ'], 'g', 'TH_TO_EN map check');
assert.equal(detectLayout('สวัสดี'), 'th', 'detectLayout Thai');
assert.equal(detectLayout('hello'), 'en', 'detectLayout English');
// 8. Background search matching test (Works 100% in the background)
assert.equal(backgroundSearchMatches('ประตูทางเข้าโรงเรียน', 'g-hk'), true, 'Typing "g-hk" matches "เข้า" in the background');
assert.equal(backgroundSearchMatches('ข้าวมันไก่', '-hk;'), true, 'Typing "-hk;" matches "ข้าว" in the background');
assert.equal(backgroundSearchMatches('ข้าวผัดกุ้ง', 'ส้มตำ'), false, 'Mismatched words return false');
assert.equal(backgroundSearchMatches('Admin Settings', 'ฟกทรื'), true, 'Typing "ฟกทรื" matches "Admin Settings" in the background');
console.log('✅ Test 8: backgroundSearchMatches passed (Seamless background cross-layout matching)');

// 9. attachBackgroundKeystrokeTranslator test
const fakeInput = {
  value: 'test ',
  listeners: {},
  addEventListener(event, fn) { this.listeners[event] = fn; },
  removeEventListener(event) { delete this.listeners[event]; },
  dispatchEvent() { return true; },
  setSelectionRange() {}
};
const cleanup = attachBackgroundKeystrokeTranslator(fakeInput);
assert.equal(typeof cleanup, 'function', 'attachBackgroundKeystrokeTranslator returns cleanup function');
cleanup();
assert.equal(fakeInput.listeners['keydown'], undefined, 'Cleanup removes keydown listener');
console.log('✅ Test 9: attachBackgroundKeystrokeTranslator passed');

console.log('\n🎉 ALL 9 KEYSTROKE TRANSLATOR TESTS PASSED SUCCESSFULLY!');
