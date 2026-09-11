/**
 * Thai Kedmanee (TIS-820) <-> English US QWERTY Keystroke Translation Engine
 * Translates text and intercepts keystrokes when typed with the wrong keyboard layout
 * (e.g. "l;ylfg" <-> "สวัสดี", "g-hk" <-> "เข้า", "ฟหกด" <-> "asdf")
 */

export const EN_TO_TH: Record<string, string> = {
  // Row 1 (Numbers & Symbols)
  '`': '_', '1': 'ๅ', '2': '/', '3': '-', '4': 'ภ', '5': 'ถ',
  '6': 'ุ', '7': 'ึ', '8': 'ค', '9': 'ต', '0': 'จ', '-': 'ข', '=': 'ช',
  '~': '%', '!': '+', '@': '๑', '#': '๒', '$': '๓', '%': '๔',
  '^': 'ู', '&': '฿', '*': '๕', '(': '๖', ')': '๗', '_': '๘', '+': '๙',

  // Row 2 (QWERTY)
  'q': 'ๆ', 'w': 'ไ', 'e': 'ำ', 'r': 'พ', 't': 'ะ', 'y': 'ั',
  'u': 'ี', 'i': 'ร', 'o': 'น', 'p': 'ย', '[': 'บ', ']': 'ล', '\\': 'ฃ',
  'Q': '๐', 'W': '"', 'E': 'ฎ', 'R': 'ฑ', 'T': 'ธ', 'Y': 'ํ',
  'U': '๊', 'I': 'ณ', 'O': 'ฯ', 'P': 'ญ', '{': 'ฐ', '}': ',', '|': 'ฅ',

  // Row 3 (Home Row)
  'a': 'ฟ', 's': 'ห', 'd': 'ก', 'f': 'ด', 'g': 'เ', 'h': '้',
  'j': '่', 'k': 'า', 'l': 'ส', ';': 'ว', '\'': 'ง',
  'A': 'ฤ', 'S': 'ฆ', 'D': 'ฏ', 'F': 'โ', 'G': 'ฌ', 'H': '็',
  'J': '๋', 'K': 'ษ', 'L': 'ศ', ':': 'ซ', '"': '.',

  // Row 4 (Bottom Row)
  'z': 'ผ', 'x': 'ป', 'c': 'แ', 'v': 'อ', 'b': 'ิ', 'n': 'ื',
  'm': 'ท', ',': 'ม', '.': 'ใ', '/': 'ฝ',
  'Z': '(', 'X': ')', 'C': 'ฉ', 'V': 'ฮ', 'B': 'ฺ', 'N': '์',
  'M': '?', '<': 'ฒ', '>': 'ฬ', '?': 'ฦ',

  ' ': ' ',
};

export const TH_TO_EN: Record<string, string> = Object.entries(EN_TO_TH).reduce(
  (acc, [en, th]) => {
    if (!acc[th]) {
      acc[th] = en;
    }
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Checks if a single character belongs to Thai Unicode block (U+0E01 - U+0E5B)
 */
export function isThaiChar(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return code >= 0x0e01 && code <= 0x0e5b;
}

/**
 * Checks if a single character is an English alphanumeric or standard keyboard symbol
 */
export function isEnglishChar(char: string): boolean {
  if (!char || char.length !== 1) return false;
  return Boolean(EN_TO_TH[char]) || /^[a-zA-Z0-9]$/.test(char);
}

/**
 * Detects whether the given text is predominantly Thai, English, or mixed
 */
export function detectLayout(text: string): 'th' | 'en' | 'mixed' | 'unknown' {
  if (!text) return 'unknown';

  let thCount = 0;
  let enCount = 0;

  for (const char of text) {
    if (isThaiChar(char)) thCount++;
    else if (/[a-zA-Z]/.test(char)) enCount++;
  }

  if (thCount > 0 && enCount === 0) return 'th';
  if (enCount > 0 && thCount === 0) return 'en';
  if (thCount > 0 && enCount > 0) return 'mixed';
  return 'unknown';
}

/**
 * Translates text typed with an English layout into Thai Kedmanee
 * Example: "l;ylfg" -> "สวัสดี", "g-hk" -> "เข้า"
 */
export function enToTh(text: string): string {
  if (!text) return '';
  return Array.from(text)
    .map((char) => EN_TO_TH[char] ?? char)
    .join('');
}

/**
 * Translates text typed with a Thai layout into English US QWERTY
 * Example: "สวัสดี" -> "l;ylfg", "ฟหกด" -> "asdf"
 */
export function thToEn(text: string): string {
  if (!text) return '';
  return Array.from(text)
    .map((char) => TH_TO_EN[char] ?? char)
    .join('');
}

/**
 * Auto-detects text layout and translates to the opposite language
 */
export function translateText(text: string, forceDirection?: 'en2th' | 'th2en'): string {
  if (!text) return '';
  if (forceDirection === 'en2th') return enToTh(text);
  if (forceDirection === 'th2en') return thToEn(text);

  const detected = detectLayout(text);
  if (detected === 'th') return thToEn(text);
  if (detected === 'en') return enToTh(text);

  // Mixed text: translate each character according to its own language
  return Array.from(text)
    .map((char) => {
      if (isThaiChar(char)) return TH_TO_EN[char] ?? char;
      return EN_TO_TH[char] ?? char;
    })
    .join('');
}

/**
 * Translates a single keystroke character
 */
export function translateKeystroke(key: string, targetLayout: 'th' | 'en'): string {
  if (!key || key.length !== 1) return key;
  return targetLayout === 'th' ? (EN_TO_TH[key] ?? key) : (TH_TO_EN[key] ?? key);
}

/**
 * Event handler for real-time keystroke translation in HTML Input / Textarea
 */
export interface KeystrokeInputElement {
  value: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  setSelectionRange?: (start: number, end: number) => void;
  dispatchEvent?: (event: Event) => boolean;
}

export function handleKeystrokeInput(
  event: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    preventDefault: () => void;
    target: EventTarget | KeystrokeInputElement | null;
  },
  targetLayout: 'th' | 'en'
): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) {
    return false;
  }

  const typedChar = event.key;
  const translatedChar = translateKeystroke(typedChar, targetLayout);

  if (translatedChar !== typedChar && event.target && 'value' in event.target) {
    event.preventDefault();

    const input = event.target as HTMLInputElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const val = input.value;

    input.value = val.substring(0, start) + translatedChar + val.substring(end);
    if (typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(start + translatedChar.length, start + translatedChar.length);
    }

    if (typeof Event === 'function') {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  }

  return false;
}

export interface BackgroundTranslatorOptions {
  /**
   * 'auto': Translates keystrokes based on detected input language
   * 'force-th': Always converts English keystrokes into Thai Kedmanee
   * 'force-en': Always converts Thai keystrokes into English US QWERTY
   */
  mode?: 'auto' | 'force-th' | 'force-en';
  /**
   * 'realtime': Converts key-by-key in the background as the user types
   * 'word': Converts word silently when space or enter is pressed
   */
  strategy?: 'realtime' | 'word';
}

/**
 * Attaches a silent background listener to an HTML input or textarea.
 * Operates 100% in the background without any visible UI, hints, or popups.
 * Returns an unbind cleanup function.
 */
export function attachBackgroundKeystrokeTranslator(
  element: HTMLInputElement | HTMLTextAreaElement,
  options: BackgroundTranslatorOptions = {}
): () => void {
  const { mode = 'auto', strategy = 'realtime' } = options;

  if (strategy === 'realtime') {
    const handleKeyDown = (evt: Event) => {
      const e = evt as KeyboardEvent;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;

      const char = e.key;
      let targetLayout: 'th' | 'en';

      if (mode === 'force-th') targetLayout = 'th';
      else if (mode === 'force-en') targetLayout = 'en';
      else {
        targetLayout = isEnglishChar(char) ? 'th' : 'en';
      }

      handleKeystrokeInput(e, targetLayout);
    };

    element.addEventListener('keydown', handleKeyDown);
    return () => element.removeEventListener('keydown', handleKeyDown);
  }

  // Strategy 'word': Silent word-level correction on space/enter
  const handleKeyDown = (evt: Event) => {
    const e = evt as KeyboardEvent;
    if (e.key === ' ' || e.key === 'Enter') {
      const val = element.value;
      const start = element.selectionStart ?? val.length;
      const beforeCursor = val.slice(0, start);
      const words = beforeCursor.split(/\s+/);
      const lastWord = words[words.length - 1];

      if (lastWord && lastWord.length > 0) {
        const translated = translateText(lastWord);
        if (translated !== lastWord) {
          const wordStart = beforeCursor.lastIndexOf(lastWord);
          const afterCursor = val.slice(start);
          element.value = val.slice(0, wordStart) + translated + afterCursor;
          const newPos = wordStart + translated.length;
          element.setSelectionRange(newPos, newPos);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  };

  element.addEventListener('keydown', handleKeyDown);
  return () => element.removeEventListener('keydown', handleKeyDown);
}

/**
 * Transparent background matcher for search bars, command palettes, and auto-completes.
 * Silently matches if the target contains the raw query OR the layout-translated query.
 * Operates 100% in the background with zero UI changes.
 */
export function backgroundSearchMatches(targetText: string, searchQuery: string): boolean {
  if (!targetText || !searchQuery) return false;

  const q = searchQuery.trim().toLowerCase();
  if (!q) return false;

  const target = targetText.toLowerCase();
  if (target.includes(q)) return true;

  const translated = translateText(q).toLowerCase();
  if (translated && translated !== q && target.includes(translated)) {
    return true;
  }

  return false;
}

