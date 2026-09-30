/**
 * The fifteen-question satisfaction survey from the landing page.
 *
 * Responses were written straight to Firestore. There is no rule for
 * canteen_surveys, so the catch-all refused every write, and the helper caught
 * the refusal and returned the record anyway — so the page thanked each student
 * while their answers stayed in that browser's localStorage. This is the data
 * the project's own report is built on, and none of it was being collected.
 */

import { Router } from 'express';
import { adminDb } from '../firebaseAdmin.js';
import { optionalAuthenticate } from '../middleware/authenticate.js';
import { resolveQueryLimit } from '../services/queryLimit.js';

export const surveyRouter = Router();

const COLLECTION = 'canteen_surveys';
const QUESTION_COUNT = 15;
const QUESTION_IDS = Array.from({ length: QUESTION_COUNT }, (_, i) => `q${i + 1}`);
const MAX_SHORT = 120;
const MAX_COMMENT = 2000;

function cleanText(value, max) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .replace(/[ \t]+/g, ' ')
    .slice(0, max);
}

/** Each question is answered on a five point scale. */
function cleanAnswer(value) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 5) return null;
  return score;
}

/**
 * POST /api/surveys
 * Records one response. Open to students who are not signed in, because that is
 * who the page asks.
 */
surveyRouter.post('/', optionalAuthenticate, async (req, res) => {
  try {
    const body = req.body || {};

    const yearLevel = cleanText(body.yearLevel || body.userName, MAX_SHORT);
    if (!yearLevel) {
      return res.status(400).json({
        success: false,
        error: 'YEAR_LEVEL_REQUIRED',
        message: 'กรุณาเลือกชั้นปี'
      });
    }

    const rawAnswers = body.answers || {};
    const answers = {};
    for (const id of QUESTION_IDS) {
      const answer = cleanAnswer(rawAnswers[id]);
      if (answer === null) {
        return res.status(400).json({
          success: false,
          error: 'ANSWER_OUT_OF_RANGE',
          message: `คำตอบข้อ ${id} ต้องเป็นคะแนน 1 ถึง 5`
        });
      }
      answers[id] = answer;
    }

    const now = new Date().toISOString();
    const id = `survey_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const survey = {
      id,
      userName: cleanText(body.userName, MAX_SHORT) || yearLevel,
      yearLevel,
      faculty: cleanText(body.faculty, MAX_SHORT) || 'นักศึกษา',
      answers,
      comment: cleanText(body.comment, MAX_COMMENT),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) ? body.date : now.slice(0, 10),
      submittedByUid: req.user?.uid || null,
      createdAt: now
    };

    await adminDb.collection(COLLECTION).doc(id).set(survey);

    return res.status(201).json({ success: true, survey });
  } catch (err) {
    console.error('[Survey API] Submit error:', err);
    return res.status(500).json({ success: false, error: 'SURVEY_SUBMIT_FAILED', message: err.message });
  }
});

/**
 * GET /api/surveys
 * Responses, newest first. Public, like the page that charts them.
 */
surveyRouter.get('/', async (req, res) => {
  try {
    const limit = resolveQueryLimit(req.query.limit, 200, 500);
    const snap = await adminDb.collection(COLLECTION).get();

    const surveys = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit);

    return res.status(200).json({ success: true, surveys });
  } catch (err) {
    console.error('[Survey API] List error:', err);
    return res.status(500).json({ success: false, error: 'SURVEY_LIST_FAILED', message: err.message });
  }
});

export { QUESTION_IDS };
