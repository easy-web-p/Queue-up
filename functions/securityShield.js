/**
 * SERVER-SIDE SECURITY SHIELD ENGINE (functions/securityShield.js)
 *
 * Protection against XSS, Prompt Injection, SQL/NoSQL Injection, and Malicious Input.
 * Parity enforced with src/services/aiSecurityShield.js via test-security-shield.js.
 */

export const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /onerror\s*=/gi,
  /onload\s*=/gi,
  /eval\s*\(/gi,
  /document\.cookie/gi,
];

export const PROMPT_INJECTION_PATTERNS = [
  /ignore previous instructions/gi,
  /disregard system prompt/gi,
  /you are now in developer mode/gi,
  /system override/gi,
  /reveal system prompt/gi,
  /bypass security/gi,
  /ให้ลืมคำสั่งก่อนหน้า/gi,
  /ข้ามมาตรการความปลอดภัย/gi,
];

export const NOSQL_PATTERNS = [
  /\{\s*"\$gt"\s*:/gi,
  /\{\s*"\$ne"\s*:/gi,
  /SELECT\s+.*\s+FROM/gi,
  /DROP\s+TABLE/gi,
  /UNION\s+SELECT/gi,
];

/**
 * AI Threat Detection & Input Shield Engine (Server-side)
 * @param {string} input - Input text to scan
 * @returns {object} { safe: boolean, threats: string[], sanitized: string, riskLevel: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL' }
 */
export function analyzeAndShieldInput(input) {
  if (typeof input !== "string") {
    return { safe: true, threats: [], sanitized: input, riskLevel: "LOW" };
  }

  const threats = [];
  let riskLevel = "LOW";
  let cleanText = input;

  // A. XSS & HTML Script Injection Detection
  for (const pattern of XSS_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      threats.push("Cross-Site Scripting (XSS) / Script Injection pattern detected");
      riskLevel = "CRITICAL";
      break;
    }
  }

  // B. AI Prompt Injection Detection (Attacks trying to override AI system instructions)
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      threats.push("AI Prompt Injection Attack attempt detected");
      if (riskLevel !== "CRITICAL") riskLevel = "HIGH";
      break;
    }
  }

  // C. SQL / NoSQL Injection Detection
  for (const pattern of NOSQL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      threats.push("Database Injection (SQL/NoSQL) pattern detected");
      riskLevel = "CRITICAL";
      break;
    }
  }

  // Strip markup, keep text
  cleanText = cleanText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\bjavascript:/gi, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

  if (threats.length > 0) {
    console.warn("[securityShield] Threat blocked:", {
      riskLevel,
      threats,
      sample: input.substring(0, 50),
    });
  }

  return {
    safe: threats.length === 0,
    threats,
    sanitized: cleanText,
    riskLevel,
  };
}
