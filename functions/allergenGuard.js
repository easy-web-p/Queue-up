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
 * Two signals, reported separately because they are not equally trustworthy:
 *
 *   DECLARED - the store tagged this dish with the allergen (products.allergens).
 *              A statement about the recipe, and the only reliable signal here.
 *   INFERRED - a keyword matched the dish's name, category, description or a chosen
 *              option. Approximate in both directions: "ข้าวผัดพิเศษ" containing
 *              shrimp matches nothing, and a dish named for an ingredient it no
 *              longer has matches anyway.
 *
 * So the absence of a hit is not a safety guarantee, and never should be presented
 * as one. Untagged menus fall back to INFERRED alone, which is where this started.
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
    declaredAllergens = [],
  } = input || {};

  if (!Array.isArray(studentAllergies) || studentAllergies.length === 0) {
    return { hasAllergens: false, matchedAllergenNames: [], details: [] };
  }

  // What the store says this dish actually contains. Unlike the keyword scan below,
  // this is a statement about the recipe rather than an inference from the dish's
  // name, so it is checked first and reported at a different confidence.
  const declaredSet = new Set(
    (Array.isArray(declaredAllergens) ? declaredAllergens : [])
      .filter((t) => typeof t === 'string')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  );

  const titleLower = String(productTitle || '').toLowerCase();
  const categoryLower = String(productCategory || '').toLowerCase();
  const descLower = String(productDescription || '').toLowerCase();

  const details = [];
  const matchedSet = new Set();

  for (const allergy of studentAllergies) {
    if (!allergy || typeof allergy !== 'string') continue;

    const preset = findPresetDictionaryEntry(allergy);
    const canonicalName = preset ? preset.label : allergy.trim();

    // A declared ingredient settles it; there is nothing to be gained by also
    // guessing from the name.
    const declaredKeys = preset
      ? [preset.id, preset.label.toLowerCase(), cleanAllergenLabel(preset.label)]
      : [allergy.trim().toLowerCase(), cleanAllergenLabel(allergy)];
    const declaredHit = declaredKeys.find((k) => k && declaredSet.has(k));
    if (declaredHit) {
      details.push({
        allergenName: canonicalName,
        triggerSource: 'DECLARED',
        triggerWord: declaredHit,
        confidence: 'DECLARED',
        details: `ร้านค้าระบุว่าเมนูนี้มี "${canonicalName}" เป็นส่วนผสม`,
      });
      matchedSet.add(canonicalName);
      continue;
    }

    const rawKeywords = preset
      ? preset.keywords
      : [allergy.trim().toLowerCase(), cleanAllergenLabel(allergy)];
    // Longest first so the most specific keyword is the one reported.
    const keywordsToSearch = [...rawKeywords].filter(Boolean).sort((a, b) => b.length - a.length);

    const scanField = (haystack, source, describe) => {
      for (const kw of keywordsToSearch) {
        if (haystack.includes(kw.toLowerCase())) {
          details.push({
            allergenName: canonicalName,
            triggerSource: source,
            triggerWord: kw,
            confidence: 'INFERRED',
            details: describe(kw),
          });
          matchedSet.add(canonicalName);
          return true;
        }
      }
      return false;
    };

    // First hit among title, category and description wins for the base item;
    // evaluated for its side effects, so the combined result is discarded.
    void (
      scanField(titleLower, 'TITLE', (kw) => `พบคำว่า "${kw}" ในชื่อเมนูอาหาร`) ||
      scanField(categoryLower, 'CATEGORY', (kw) => `พบคำว่า "${kw}" ในหมวดหมู่อาหาร`) ||
      scanField(descLower, 'DESCRIPTION', (kw) => `พบคำว่า "${kw}" ในคำอธิบายเมนูอาหาร`)
    );

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
            confidence: 'INFERRED',
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
      declaredAllergens: item.declaredAllergens || [],
    });

    if (result.hasAllergens) {
      result.matchedAllergenNames.forEach((n) => allMatched.add(n));
      flaggedItems.push({
        productId: item.productId,
        name: item.name,
        matchedAllergenNames: result.matchedAllergenNames,
        // DECLARED when the store stated the ingredient, INFERRED when it was only
        // read off the dish's name. The two deserve very different wording.
        confidence: result.details.some((d) => d.confidence === 'DECLARED')
          ? 'DECLARED'
          : 'INFERRED',
        details: result.details,
      });
    }
  }

  return {
    hasAllergens: allMatched.size > 0,
    matchedAllergenNames: Array.from(allMatched),
    hasDeclaredMatch: flaggedItems.some((f) => f.confidence === 'DECLARED'),
    flaggedItems,
  };
}
