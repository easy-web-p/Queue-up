/**
 * Pure Domain Engine: Allergen Guard
 * Scans food items and modifiers for allergen indicators (peanuts, seafood, dairy, gluten, eggs, etc.)
 * Authoritative security component for student & customer dietary protection.
 */

export interface AllergenMatchResult {
  detectedAllergens: string[];
  hasCriticalAllergen: boolean;
  warningMessage?: string;
}

export const ALLERGEN_PATTERNS: Record<string, string[]> = {
  seafood: ['กุ้ง', 'ปู', 'หมึก', 'หอย', 'ปลา', 'shrimp', 'crab', 'squid', 'fish', 'seafood'],
  peanuts: ['ถั่ว', 'ถั่วลิสง', 'peanut', 'nuts', 'เม็ดมะม่วง'],
  dairy: ['นม', 'ชีส', 'เนย', 'milk', 'cheese', 'butter', 'cream'],
  gluten: ['แป้งสาลี', 'บะหมี่', 'ขนมปัง', 'wheat', 'gluten', 'bread', 'pasta'],
  eggs: ['ไข่', 'egg']
};

export const ALLERGEN_LABELS_TH: Record<string, string> = {
  seafood: 'อาหารทะเล (กุ้ง/ปู/หมึก/ปลา)',
  peanuts: 'ถั่วลิสง / ถั่วเปลือกแข็ง',
  dairy: 'ผลิตภัณฑ์จากนม / ชีส / เนย',
  gluten: 'แป้งสาลี / กลูเตน',
  eggs: 'ไข่ไก่ / ผลิตภัณฑ์จากไข่'
};

/**
 * Clean and normalize allergen label for display
 */
export function cleanAllergenLabel(allergenKey: string): string {
  return ALLERGEN_LABELS_TH[allergenKey] || allergenKey;
}

/**
 * Detect matched allergens in a food name, description, tags, or modifier text
 */
export function detectMatchedAllergens(text: string): string[] {
  if (!text) return [];
  const normalized = text.toLowerCase();
  const matched = new Set<string>();

  for (const [allergenKey, patterns] of Object.entries(ALLERGEN_PATTERNS)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern.toLowerCase())) {
        matched.add(allergenKey);
        break;
      }
    }
  }

  return Array.from(matched);
}

/**
 * Scans an entire order's items and option choices against student/customer known allergies
 */
export function scanOrderForAllergens(
  items: Array<{
    name: string;
    description?: string;
    tags?: string[];
    specialNote?: string;
    selectedOptions?: Array<{ groupName: string; choiceName: string }>;
  }>,
  studentKnownAllergies?: string[]
): AllergenMatchResult {
  const allDetected = new Set<string>();

  for (const item of items) {
    // Scan item name & description
    detectMatchedAllergens(item.name).forEach(a => allDetected.add(a));
    if (item.description) {
      detectMatchedAllergens(item.description).forEach(a => allDetected.add(a));
    }
    if (item.tags) {
      item.tags.forEach(tag => detectMatchedAllergens(tag).forEach(a => allDetected.add(a)));
    }
    if (item.specialNote) {
      detectMatchedAllergens(item.specialNote).forEach(a => allDetected.add(a));
    }
    if (item.selectedOptions) {
      item.selectedOptions.forEach(opt => {
        detectMatchedAllergens(opt.choiceName).forEach(a => allDetected.add(a));
      });
    }
  }

  const detectedList = Array.from(allDetected);
  let hasCriticalAllergen = false;
  let conflictList: string[] = [];

  if (studentKnownAllergies && studentKnownAllergies.length > 0) {
    const normalizedKnown = studentKnownAllergies.map(k => k.toLowerCase());
    conflictList = detectedList.filter(d => normalizedKnown.includes(d.toLowerCase()));
    if (conflictList.length > 0) {
      hasCriticalAllergen = true;
    }
  }

  const warningMessage = hasCriticalAllergen
    ? `คำเตือนการแพ้อาหาร: พบวัตถุดิบที่ตรงกับประวัติภูมิแพ้ (${conflictList.map(cleanAllergenLabel).join(', ')})`
    : detectedList.length > 0
    ? `รายการอาหารนี้มีส่วนประกอบของ: ${detectedList.map(cleanAllergenLabel).join(', ')}`
    : undefined;

  return {
    detectedAllergens: detectedList,
    hasCriticalAllergen,
    warningMessage
  };
}
