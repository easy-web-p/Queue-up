/**
 * ============================================================================
 * 📊 SYSTEM EVALUATION VALIDATION
 * ============================================================================
 *
 * The evaluation wall on /queueup exists so the project's supervisor and reviewers
 * can read the scores without holding an account, and submit their own the same
 * way. That makes it a public read and an unauthenticated write — the second of
 * only two such paths in the app, alongside the pilot lead form.
 *
 * It did not work at all. The client wrote `systemEvaluations/eval_<timestamp>`
 * with five separate scores, while the rules demanded a document id equal to the
 * caller's uid, a `userId` field and a single `rating` between 1 and 5. Nothing
 * matched, so every write was rejected, the rejection was swallowed into
 * localStorage, and the page still said "ขอบคุณสำหรับผลประเมิน". Reads were
 * admin-only, so the wall fell back to three hardcoded samples and presented them
 * as "ผลประเมินจริง".
 *
 * Because anyone may submit, everything a submission can carry is bounded here,
 * and the score fields are validated as the five the page actually renders — the
 * previous mismatch is exactly what a shared, tested rule prevents.
 *
 * Pure and dependency-free so the boundaries can be exercised directly.
 */

/** The five dimensions the evaluation page scores, each out of 10. */
export const SCORE_FIELDS = [
  "uxScore",
  "accountScore",
  "queueScore",
  "merchantScore",
  "securityScore",
];

export const LIMITS = {
  userName: { min: 2, max: 80 },
  comment: { max: 500 },
  score: { min: 0, max: 10 },
};

/**
 * A name and a comment typed here are shown publicly, so control characters are
 * refused: a newline in a display name breaks the wall's layout and is the usual
 * way a single entry is made to look like several.
 */
/* eslint-disable no-control-regex */
const CONTROL_CHARS_STRICT = /[\x00-\x1F\x7F]/;
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
/* eslint-enable no-control-regex */

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Scores arrive from range inputs as strings. Half points are meaningful (the
 * page renders 9.5), so the value is kept to one decimal rather than rounded to
 * an integer.
 */
function parseScore(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
  } else {
    // Number("") and Number(null) are both 0, so an absent score would arrive as a
    // deliberate zero — the same missing-versus-zero confusion this module exists
    // to stop the page making. An empty value is absent, and absent is a refusal.
    const text = cleanString(value);
    if (!text) return null;
    value = Number(text);
    if (!Number.isFinite(value)) return null;
  }
  if (value < LIMITS.score.min || value > LIMITS.score.max) return null;
  return Math.round(value * 10) / 10;
}

/**
 * @param {object} input - the raw submission
 * @returns {{ok: true, evaluation: object} | {ok: false, field: string, reason: string, message: string}}
 */
export function validateEvaluation(input) {
  const data = input && typeof input === "object" ? input : {};
  const reject = (field, reason, message) => ({ ok: false, field, reason, message });

  const userName = cleanString(data.userName);
  const comment = cleanString(data.comment);

  if (CONTROL_CHARS_STRICT.test(userName) || CONTROL_CHARS.test(comment)) {
    return reject("userName", "CONTROL_CHARACTERS", "ข้อมูลมีอักขระที่ไม่อนุญาต");
  }

  if (userName.length < LIMITS.userName.min) {
    return reject("userName", "USER_NAME_REQUIRED", "กรุณากรอกชื่อผู้ประเมิน");
  }
  if (userName.length > LIMITS.userName.max) {
    return reject("userName", "USER_NAME_TOO_LONG", "ชื่อผู้ประเมินยาวเกินไป");
  }
  if (comment.length > LIMITS.comment.max) {
    return reject("comment", "COMMENT_TOO_LONG", "ความคิดเห็นยาวเกินไป (สูงสุด 500 ตัวอักษร)");
  }

  const scores = {};
  for (const field of SCORE_FIELDS) {
    const score = parseScore(data[field]);
    if (score === null) {
      return reject(field, "SCORE_INVALID", "คะแนนต้องเป็นตัวเลขระหว่าง 0 ถึง 10");
    }
    scores[field] = score;
  }

  // Rebuilt field by field: an unexpected key in the payload cannot reach the
  // document, and the wall renders exactly the shape validated here.
  return { ok: true, evaluation: { userName, comment, ...scores } };
}
