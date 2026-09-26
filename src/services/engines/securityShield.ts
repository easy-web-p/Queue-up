/**
 * Pure Domain Engine: Security Shield
 * Scans user inputs against Cyber Threat Vectors:
 * - XSS Script tags & event handlers
 * - Prompt Injection patterns (TH & EN)
 * - NoSQL / SQL injection payloads
 * - Buffer overflow / message length limits
 */

export interface SecurityCheckResult {
  isSafe: boolean;
  threatType?: 'XSS' | 'PROMPT_INJECTION' | 'NOSQL_INJECTION' | 'LENGTH_OVERFLOW';
  sanitizedValue: string;
  errorMessage?: string;
}

export const XSS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,
  /<img[^>]+src[=\s]*["']?javascript:/gi
];

export const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/gi,
  /system\s+prompt/gi,
  /you\s+are\s+now\s+in\s+developer\s+mode/gi,
  /jailbreak/gi,
  /bypass\s+all\s+rules/gi,
  /ลืมคำสั่งก่อนหน้านี้/gi,
  /ปลดล็อคระบบ/gi,
  /ทำตามคำสั่งต่อไปนี้แทน/gi
];

export const NOSQL_PATTERNS = [
  /\{\s*"\$gt"/gi,
  /\{\s*"\$ne"/gi,
  /\{\s*"\$where"/gi,
  /;\s*DROP\s+TABLE/gi,
  /'\s*OR\s*'1'='1/gi
];

/**
 * Strips dangerous HTML tags and returns safe text
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Analyzes string and applies authoritative security shield
 */
export function analyzeAndShieldInput(input: string, maxLength: number = 500): SecurityCheckResult {
  if (!input) {
    return { isSafe: true, sanitizedValue: '' };
  }

  // 1. Length guard
  if (input.length > maxLength) {
    return {
      isSafe: false,
      threatType: 'LENGTH_OVERFLOW',
      sanitizedValue: input.substring(0, maxLength),
      errorMessage: `ความยาวข้อความเกินกำหนด (สูงสุด ${maxLength} ตัวอักษร)`
    };
  }

  // 2. XSS Check
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isSafe: false,
        threatType: 'XSS',
        sanitizedValue: sanitizeString(input),
        errorMessage: 'ตรวจพบลักษณะโค้ดที่ไม่ปลอดภัย (XSS Threat Detected)'
      };
    }
  }

  // 3. Prompt Injection Check
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isSafe: false,
        threatType: 'PROMPT_INJECTION',
        sanitizedValue: sanitizeString(input),
        errorMessage: 'ตรวจพบคำสั่งอันตราย (Prompt Injection Detected)'
      };
    }
  }

  // 4. NoSQL / SQL injection check
  for (const pattern of NOSQL_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isSafe: false,
        threatType: 'NOSQL_INJECTION',
        sanitizedValue: sanitizeString(input),
        errorMessage: 'ตรวจพบลักษณะคำสั่งฐานข้อมูลที่ไม่ปลอดภัย'
      };
    }
  }

  return {
    isSafe: true,
    sanitizedValue: sanitizeString(input)
  };
}
