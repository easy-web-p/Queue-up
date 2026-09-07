/**
 * ============================================================================
 * 🛡️ SERVER-SIDE ALLERGEN GUARD
 * ============================================================================
 *
 * Cross-checks a student's recorded allergies against the menu items being
 * ordered, inside createOrderAuthoritative.
 *
 * The equivalent check already existed in src/utils/allergenMatcher.ts, but a
 * client-side check is advisory only: anyone calling the callable directly, or
 * running with a stale bundle, ordered straight past it. This module is the
 * enforcing copy.
 *
 * The dictionary below is a verbatim copy of the client's. The functions
 * directory is deployed on its own and cannot import from src/, so the
 * duplication is forced by the deployment boundary rather than chosen —
 * test-allergen-guard.js compares the two and fails if they drift apart.
 *
 * Matching is keyword-based and therefore approximate in both directions: it
 * reads names, not recipes. Treat a hit as a warning worth blocking on, not as
 * proof, and its absence as no guarantee of safety.
 */

export const ALLERGEN_PRESET_DICTIONARY = {
  peanut: {
    id: 'peanut',
    label: 'ถั่วลิสง (Peanuts)',
    keywords: [
      'ถั่วลิสง', 'ถั่ว', 'ถั่วคั่ว', 'เนยถั่ว', 'peanut', 'peanuts',
      'ผัดไทย', 'ส้มตำไทย', 'น้ำจิ้มสะเต๊ะ', 'ก๋วยเตี๋ยวต้มยำสุโขทัย'
    ]
  },
  seafood: {
    id: 'seafood',
    label: 'อาหารทะเล / กุ้ง (Seafood)',
    keywords: [
      'อาหารทะเล', 'กุ้ง', 'ปู', 'ปลาหมึก', 'หมึก', 'หอย', 'หอยแครง',
      'หอยแมลงภู่', 'หอยนางรม', 'กะปิ', 'เคย', 'มันกุ้ง', 'seafood',
      'shrimp', 'prawn', 'crab', 'squid', 'lobster', 'oyster', 'clam',
      'scallop', 'น้ำพริกกะปิ'
    ]
  },
  dairy: {
    id: 'dairy',
    label: 'นมวัว / แลคโตส (Dairy)',
    keywords: [
      'นมวัว', 'นมสด', 'นม', 'เนย', 'ชีส', 'วิปครีม', 'ครีม', 'คัสตาร์ด',
      'โยเกิร์ต', 'พุดดิ้งนมสด', 'dairy', 'milk', 'cheese', 'butter',
      'cream', 'latte', 'ลาเต้', 'แลคโตส', 'lactose'
    ]
  },
  gluten: {
    id: 'gluten',
    label: 'แป้งสาลี / กลูเตน (Gluten)',
    keywords: [
      'แป้งสาลี', 'กลูเตน', 'บะหมี่', 'หมี่เหลือง', 'บะหมี่หยก', 'ขนมปัง',
      'แป้งเกี๊ยว', 'เกี๊ยวซ่า', 'พาสต้า', 'สปาเก็ตตี้', 'gluten', 'wheat',
      'bread', 'pasta'
    ]
  },
  egg: {
    id: 'egg',
    label: 'ไข่ไก่ (Eggs)',
    keywords: [
      'ไข่ไก่', 'ไข่เป็ด', 'ไข่', 'ไข่ต้ม', 'ไข่ดาว', 'ไข่เจียว',
      'ไข่ยางมะตูม', 'ไข่ลวก', 'ไข่ข้น', 'มายองเนส', 'egg', 'eggs',
      'mayo', 'mayonnaise'
    ]
  },
  soy: {
    id: 'soy',
    label: 'ถั่วเหลือง (Soy)',
    keywords: [
      'ถั่วเหลือง', 'เต้าหู้', 'น้ำเต้าหู้', 'ซีอิ๊ว', 'ซอสถั่วเหลือง',
      'มิโซะ', 'soy', 'soya', 'tofu', 'edamame'
    ]
  },
  fish: {
    id: 'fish',
    label: 'ปลาทะเล (Fish)',
    keywords: [
      'ปลาทะเล', 'ปลา', 'ปลากะพง', 'ปลาแซลมอน', 'ปลาทูน่า', 'ปลาช่อน',
      'ลูกชิ้นปลา', 'น้ำปลา', 'fish', 'salmon', 'tuna'
    ]
  },
  sesame: {
    id: 'sesame',
    label: 'งา (Sesame)',
    keywords: ['งา', 'งาขาว', 'งาดำ', 'น้ำมันงา', 'sesame', 'tahini']
  }
};
/**
 * Normalizes an allergen entry string by trimming and stripping English parentheses.
 * e.g. "ถั่วลิสง (Peanuts)" -> "ถั่วลิสง"
 */
export function cleanAllergenLabel(raw) {
  if (!raw) return '';
  return raw.replace(/\s*\(.*?\)\s*/g, '').toLowerCase().trim();
}

/** Finds the matching dictionary entry if an allergen matches a preset label. */
function findPresetDictionaryEntry(allergen) {
  const clean = cleanAllergenLabel(allergen);
  const lowerRaw = allergen.toLowerCase().trim();

  for (const entry of Object.values(ALLERGEN_PRESET_DICTIONARY)) {
    const entryClean = cleanAllergenLabel(entry.label);
    if (
      lowerRaw === entry.label.toLowerCase() ||
      lowerRaw.includes(entryClean) ||
      entryClean.includes(clean)
    ) {
      return entry;
    }
  }
  return null;
}

/**
 * Cross-checks one menu item against a student's recorded allergies.
 *
 * Scans the item's name, category, description and the modifier options actually
 * selected. Customer free-text notes are deliberately NOT scanned: "ไม่ใส่ถั่ว"
 * (no peanuts) contains the very keyword it rules out.
 *
 * @returns {{hasAllergens: boolean, matchedAllergenNames: string[], details: object[]}}
 */
export function detectMatchedAllergens(input) {
  const {
    studentAllergies = [],
    productTitle = '',
    productCategory = '',
    productDescription = '',
    selectedModifierNames = [],
  } = input || {};

  if (!Array.isArray(studentAllergies) || studentAllergies.length === 0) {
    return { hasAllergens: false, matchedAllergenNames: [], details: [] };
  }

  const titleLower = String(productTitle || '').toLowerCase();
  const categoryLower = String(productCategory || '').toLowerCase();
  const descLower = String(productDescription || '').toLowerCase();

  const details = [];
  const matchedSet = new Set();

  for (const allergy of studentAllergies) {
    if (!allergy || typeof allergy !== 'string') continue;

    const preset = findPresetDictionaryEntry(allergy);
    const rawKeywords = preset
      ? preset.keywords
      : [allergy.trim().toLowerCase(), cleanAllergenLabel(allergy)];
    // Longest first so the most specific keyword is the one reported.
    const keywordsToSearch = [...rawKeywords].filter(Boolean).sort((a, b) => b.length - a.length);
    const canonicalName = preset ? preset.label : allergy.trim();

    const scanField = (haystack, source, describe) => {
      for (const kw of keywordsToSearch) {
        if (haystack.includes(kw.toLowerCase())) {
          details.push({
            allergenName: canonicalName,
            triggerSource: source,
            triggerWord: kw,
            details: describe(kw),
          });
          matchedSet.add(canonicalName);
          return true;
        }
      }
      return false;
    };

    const matched =
      scanField(titleLower, 'TITLE', (kw) => `พบคำว่า "${kw}" ในชื่อเมนูอาหาร`) ||
      scanField(categoryLower, 'CATEGORY', (kw) => `พบคำว่า "${kw}" ในหมวดหมู่อาหาร`) ||
      scanField(descLower, 'DESCRIPTION', (kw) => `พบคำว่า "${kw}" ในคำอธิบายเมนูอาหาร`);
    void matched;

    // Modifiers are always scanned, even when the base item already matched: a
    // topping can introduce a different allergen than the dish itself.
    for (const modName of selectedModifierNames) {
      if (!modName || typeof modName !== 'string') continue;
      const modLower = modName.toLowerCase();
      for (const kw of keywordsToSearch) {
        if (modLower.includes(kw.toLowerCase())) {
          details.push({
            allergenName: canonicalName,
            triggerSource: 'MODIFIER',
            triggerWord: kw,
            details: `เลือกตัวเลือกเพิ่มเติม "${modName}" (ตรวจพบ: ${kw})`,
          });
          matchedSet.add(canonicalName);
          break;
        }
      }
    }
  }

  return {
    hasAllergens: matchedSet.size > 0,
    matchedAllergenNames: Array.from(matchedSet),
    details,
  };
}

/**
 * Scans a whole order.
 *
 * @param {string[]} studentAllergies - from students/{studentId}.allergyInfo
 * @param {Array<{productId, name, category, description, modifierNames}>} scanItems
 * @returns {{hasAllergens: boolean, matchedAllergenNames: string[], flaggedItems: object[]}}
 */
export function scanOrderForAllergens(studentAllergies, scanItems) {
  if (!Array.isArray(studentAllergies) || studentAllergies.length === 0) {
    return { hasAllergens: false, matchedAllergenNames: [], flaggedItems: [] };
  }

  const allMatched = new Set();
  const flaggedItems = [];

  for (const item of scanItems || []) {
    const result = detectMatchedAllergens({
      studentAllergies,
      productTitle: item.name,
      productCategory: item.category,
      productDescription: item.description,
      selectedModifierNames: item.modifierNames || [],
    });

    if (result.hasAllergens) {
      result.matchedAllergenNames.forEach((n) => allMatched.add(n));
      flaggedItems.push({
        productId: item.productId,
        name: item.name,
        matchedAllergenNames: result.matchedAllergenNames,
        details: result.details,
      });
    }
  }

  return {
    hasAllergens: allMatched.size > 0,
    matchedAllergenNames: Array.from(allMatched),
    flaggedItems,
  };
}
