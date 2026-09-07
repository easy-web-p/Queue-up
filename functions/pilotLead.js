/**
 * ============================================================================
 * 🏫 PILOT PROGRAMME LEAD VALIDATION
 * ============================================================================
 *
 * The landing page's pilot-programme form is the product's only inbound channel
 * for schools. It collects a school name, a contact person's name and position, a
 * phone number and an email address — personal data under the PDPA, which the page
 * itself promises to keep confidential.
 *
 * That promise means the data must not pass through a client-writable collection:
 * anything a browser can write, a browser can be tricked into writing, and anything
 * a browser can read is not confidential. Leads are therefore written only by the
 * Cloud Function, into a collection closed to every client.
 *
 * This module holds the validation rules alone — no firebase-admin, no network — so
 * every boundary can be exercised directly rather than inferred from a deployed
 * function's behaviour.
 */

/** Field limits. Generous enough for real Thai school and person names. */
export const LIMITS = {
  schoolName: { min: 2, max: 200 },
  contactName: { min: 2, max: 120 },
  position: { max: 120 },
  studentCount: { max: 60 },
  phone: { minDigits: 9, maxDigits: 10 },
  email: { max: 254 },
  notes: { max: 1000 },
};

/**
 * Control characters have no place in any of these fields, and a newline smuggled
 * into a name is how a lead notification email grows headers it should not have.
 * Notes are the one field where line breaks are meaningful, so they keep \n and \r.
 *
 * The control characters are the point of these patterns, so the lint rule that
 * flags them as probable accidents does not apply.
 */
/* eslint-disable no-control-regex */
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
const CONTROL_CHARS_STRICT = /[\x00-\x1F\x7F]/;
/* eslint-enable no-control-regex */

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Thai numbers are written with spaces, dashes and sometimes a +66 country code.
 * All of those are the same number, so they are reduced to digits before counting.
 */
export function normalisePhone(raw) {
  const digits = cleanString(raw).replace(/[\s\-().]/g, "");
  if (/^\+66\d{8,9}$/.test(digits)) return `0${digits.slice(3)}`;
  return digits;
}

/**
 * Deliberately permissive: one @, something either side, a dot in the domain, no
 * whitespace. A stricter pattern rejects addresses that are perfectly valid, and the
 * only check that actually proves an address works is sending to it.
 */
function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= LIMITS.email.max;
}

/**
 * @param {object} input - the raw form payload
 * @returns {{ok: true, lead: object} | {ok: false, field: string, reason: string, message: string}}
 */
export function validatePilotLead(input) {
  const data = input && typeof input === "object" ? input : {};

  const schoolName = cleanString(data.schoolName);
  const contactName = cleanString(data.contactName);
  const position = cleanString(data.position);
  const studentCount = cleanString(data.studentCount);
  const email = cleanString(data.email).toLowerCase();
  const notes = cleanString(data.notes);
  const phone = normalisePhone(data.phone);

  const reject = (field, reason, message) => ({ ok: false, field, reason, message });

  const singleLine = { schoolName, contactName, position, studentCount, email };
  for (const [field, value] of Object.entries(singleLine)) {
    if (CONTROL_CHARS_STRICT.test(value)) {
      return reject(field, "CONTROL_CHARACTERS", "ข้อมูลมีอักขระที่ไม่อนุญาต");
    }
  }
  if (CONTROL_CHARS.test(notes)) {
    return reject("notes", "CONTROL_CHARACTERS", "ข้อมูลมีอักขระที่ไม่อนุญาต");
  }

  if (schoolName.length < LIMITS.schoolName.min) {
    return reject("schoolName", "SCHOOL_NAME_REQUIRED", "กรุณากรอกชื่อสถานศึกษา");
  }
  if (schoolName.length > LIMITS.schoolName.max) {
    return reject("schoolName", "SCHOOL_NAME_TOO_LONG", "ชื่อสถานศึกษายาวเกินไป");
  }

  if (contactName.length < LIMITS.contactName.min) {
    return reject("contactName", "CONTACT_NAME_REQUIRED", "กรุณากรอกชื่อผู้ติดต่อ");
  }
  if (contactName.length > LIMITS.contactName.max) {
    return reject("contactName", "CONTACT_NAME_TOO_LONG", "ชื่อผู้ติดต่อยาวเกินไป");
  }

  if (position.length > LIMITS.position.max) {
    return reject("position", "POSITION_TOO_LONG", "ตำแหน่งยาวเกินไป");
  }
  if (studentCount.length > LIMITS.studentCount.max) {
    return reject("studentCount", "STUDENT_COUNT_TOO_LONG", "จำนวนนักเรียนยาวเกินไป");
  }

  if (!/^\d+$/.test(phone)) {
    return reject("phone", "PHONE_REQUIRED", "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง");
  }
  if (phone.length < LIMITS.phone.minDigits || phone.length > LIMITS.phone.maxDigits) {
    return reject("phone", "PHONE_INVALID", "เบอร์โทรศัพท์ต้องมี 9-10 หลัก");
  }

  if (!looksLikeEmail(email)) {
    return reject("email", "EMAIL_INVALID", "กรุณากรอกอีเมลให้ถูกต้อง");
  }

  if (notes.length > LIMITS.notes.max) {
    return reject("notes", "NOTES_TOO_LONG", "ข้อความเพิ่มเติมยาวเกินไป");
  }

  // Only the validated fields are returned, so an unexpected key in the payload
  // cannot ride along into the stored document.
  return {
    ok: true,
    lead: { schoolName, contactName, position, studentCount, phone, email, notes },
  };
}

/**
 * A rate-limit key for an unauthenticated caller.
 *
 * The form takes no sign-in, so there is no uid to key a quota on and the caller's
 * address is the only thing left. IPv6 addresses carry colons and an address can be
 * missing entirely behind a proxy, so the value is reduced to a safe document id and
 * an unknown address shares one bucket rather than escaping the limit.
 */
export function rateLimitKeyForAddress(address) {
  const clean = cleanString(address).replace(/[^a-zA-Z0-9]/g, "_").slice(0, 200);
  return clean || "unknown";
}
