/**
 * 🛡️ CAMPUS ALLERGEN DETECTION & SAFETY SHIELD ENGINE
 * Intelligent allergen synonym expansion and cross-checking against menu items and selected modifiers.
 * 100% Client-Side, Zero-Latency, Zero-Cost.
 */

export interface MatchedAllergenDetail {
  allergenName: string;
  triggerSource: 'TITLE' | 'CATEGORY' | 'DESCRIPTION' | 'MODIFIER';
  triggerWord: string;
  details?: string;
}

export interface AllergenDetectionResult {
  hasAllergens: boolean;
  matchedAllergenNames: string[];
  details: MatchedAllergenDetail[];
}

export interface AllergenDictionaryEntry {
  id: string;
  label: string;
  keywords: string[];
}

export const ALLERGEN_PRESET_DICTIONARY: Record<string, AllergenDictionaryEntry> = {
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
export function cleanAllergenLabel(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\s*\(.*?\)\s*/g, '').toLowerCase().trim();
}

/**
 * Finds matching dictionary entry if allergen matches preset label.
 */
function findPresetDictionaryEntry(allergen: string): AllergenDictionaryEntry | null {
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

export interface DetectAllergensInput {
  studentAllergies: string[];
  productTitle?: string;
  productCategory?: string;
  productDescription?: string;
  selectedModifierNames?: string[];
}

/**
 * Comprehensive cross-check of student allergies against product metadata and active modifiers.
 */
export function detectMatchedAllergens(input: DetectAllergensInput): AllergenDetectionResult {
  const {
    studentAllergies = [],
    productTitle = '',
    productCategory = '',
    productDescription = '',
    selectedModifierNames = []
  } = input;

  if (!studentAllergies.length) {
    return { hasAllergens: false, matchedAllergenNames: [], details: [] };
  }

  const titleLower = productTitle.toLowerCase();
  const categoryLower = productCategory.toLowerCase();
  const descLower = productDescription.toLowerCase();

  const details: MatchedAllergenDetail[] = [];
  const matchedSet = new Set<string>();

  for (const allergy of studentAllergies) {
    if (!allergy || typeof allergy !== 'string') continue;

    const preset = findPresetDictionaryEntry(allergy);
    const rawKeywords = preset ? preset.keywords : [allergy.trim().toLowerCase(), cleanAllergenLabel(allergy)];
    const keywordsToSearch = [...rawKeywords].sort((a, b) => b.length - a.length);
    const canonicalName = preset ? preset.label : allergy.trim();

    let matched = false;

    // 1. Check in Title
    for (const kw of keywordsToSearch) {
      if (titleLower.includes(kw.toLowerCase())) {
        details.push({
          allergenName: canonicalName,
          triggerSource: 'TITLE',
          triggerWord: kw,
          details: `พบคำว่า "${kw}" ในชื่อเมนูอาหาร`
        });
        matched = true;
        matchedSet.add(canonicalName);
        break;
      }
    }

    // 2. Check in Category
    if (!matched) {
      for (const kw of keywordsToSearch) {
        if (categoryLower.includes(kw.toLowerCase())) {
          details.push({
            allergenName: canonicalName,
            triggerSource: 'CATEGORY',
            triggerWord: kw,
            details: `พบคำว่า "${kw}" ในหมวดหมู่อาหาร`
          });
          matched = true;
          matchedSet.add(canonicalName);
          break;
        }
      }
    }

    // 3. Check in Description
    if (!matched) {
      for (const kw of keywordsToSearch) {
        if (descLower.includes(kw.toLowerCase())) {
          details.push({
            allergenName: canonicalName,
            triggerSource: 'DESCRIPTION',
            triggerWord: kw,
            details: `พบคำว่า "${kw}" ในคำอธิบายเมนูอาหาร`
          });
          matched = true;
          matchedSet.add(canonicalName);
          break;
        }
      }
    }

    // 4. Check in Active Selected Modifiers
    for (const modName of selectedModifierNames) {
      const modLower = modName.toLowerCase();
      for (const kw of keywordsToSearch) {
        if (modLower.includes(kw.toLowerCase())) {
          details.push({
            allergenName: canonicalName,
            triggerSource: 'MODIFIER',
            triggerWord: kw,
            details: `เลือกตัวเลือกเพิ่มเติม "${modName}" (ตรวจพบ: ${kw})`
          });
          matched = true;
          matchedSet.add(canonicalName);
          break;
        }
      }
    }
  }

  return {
    hasAllergens: matchedSet.size > 0,
    matchedAllergenNames: Array.from(matchedSet),
    details
  };
}
