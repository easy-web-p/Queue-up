/**
 * Server-side input shield.
 *
 * The client mirror lives in src/services/engines/securityShield.ts, but a
 * browser-side check is advisory only: anything that reaches the API over curl
 * skips it entirely. This module is the enforcing copy.
 */

export const MAX_MESSAGE_LENGTH = 2000;

const XSS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /\son\w+\s*=/gi
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/gi,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/gi,
  /system\s+prompt/gi,
  /you\s+are\s+now\s+in\s+developer\s+mode/gi,
  /jailbreak/gi,
  /bypass\s+all\s+rules/gi,
  /ลืมคำสั่งก่อนหน้านี้/gi,
  /ปลดล็อคระบบ/gi,
  /ทำตามคำสั่งต่อไปนี้แทน/gi
];

const NOSQL_PATTERNS = [
  /\{\s*"?\$(gt|gte|lt|lte|ne|in|nin|where|regex)"?\s*:/gi
];

/**
 * Validates and sanitises a free-text message before it is stored or passed to
 * the assistant engine.
 *
 * @param {unknown} raw
 * @returns {{ ok: boolean, value: string, threatType?: string, message?: string }}
 */
export function inspectMessage(raw) {
  const text = typeof raw === 'string' ? raw.trim() : '';

  if (!text) {
    return { ok: false, value: '', threatType: 'EMPTY', message: 'ข้อความว่างเปล่า' };
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      value: '',
      threatType: 'LENGTH_OVERFLOW',
      message: `ข้อความยาวเกิน ${MAX_MESSAGE_LENGTH} ตัวอักษร`
    };
  }

  for (const pattern of NOSQL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return { ok: false, value: '', threatType: 'NOSQL_INJECTION', message: 'ข้อความมีรูปแบบที่ไม่ปลอดภัย' };
    }
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return { ok: false, value: '', threatType: 'PROMPT_INJECTION', message: 'ข้อความมีรูปแบบที่ไม่ปลอดภัย' };
    }
  }

  // XSS payloads are stripped rather than rejected: the intent is usually a
  // pasted snippet, and the stored value must simply never be executable.
  let sanitized = text;
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  sanitized = sanitized.replace(/[<>]/g, '');

  if (!sanitized.trim()) {
    return { ok: false, value: '', threatType: 'XSS', message: 'ข้อความมีรูปแบบที่ไม่ปลอดภัย' };
  }

  return { ok: true, value: sanitized.trim() };
}
