/**
 * System evaluations from the landing page.
 *
 * The form wrote straight to Firestore from the browser. There is no rule for
 * the evaluations collection, so the catch-all denied every write — and the
 * helper swallowed the refusal and returned the record anyway, so the page
 * thanked people for feedback that never left their browser. Reading them back
 * was denied too, which is why the page always showed the static baseline
 * however many evaluations had been "submitted".
 *
 * Submissions come through here instead, where they can be validated and
 * rate-limited, and where the answer says whether the thing was actually stored.
 */

import { Router } from 'express';
import { adminDb } from '../firebaseAdmin.js';
import { optionalAuthenticate } from '../middleware/authenticate.js';

export const evaluationRouter = Router();

const COLLECTION = 'evaluations';
const MAX_NAME = 80;
const MAX_COMMENT = 1000;

/** The five axes the form asks about, each scored out of ten. */
const SCORE_FIELDS = ['uxScore', 'accountScore', 'queueScore', 'merchantScore', 'securityScore'];

/** Control characters have no place in a name or a comment. */
function cleanText(value, max) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

/** Scores are 1–10 in halves, as the sliders offer. */
function cleanScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  const rounded = Math.round(score * 2) / 2;
  if (rounded < 1 || rounded > 10) return null;
  return rounded;
}

/**
 * POST /api/evaluations
 * Records one evaluation of the system.
 *
 * Open to visitors who are not signed in, because that is who the landing page
 * asks. A signed-in submission records who made it.
 */
evaluationRouter.post('/', optionalAuthenticate, async (req, res) => {
  try {
    const body = req.body || {};

    const userName = cleanText(body.userName, MAX_NAME);
    if (!userName) {
      return res.status(400).json({
        success: false,
        error: 'NAME_REQUIRED',
        message: 'กรุณากรอกชื่อผู้ประเมิน'
      });
    }

    const scores = {};
    for (const field of SCORE_FIELDS) {
      const score = cleanScore(body[field]);
      if (score === null) {
        return res.status(400).json({
          success: false,
          error: 'SCORE_OUT_OF_RANGE',
          message: `คะแนน ${field} ต้องอยู่ระหว่าง 1 ถึง 10`
        });
      }
      scores[field] = score;
    }

    const now = new Date().toISOString();
    const id = `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const evaluation = {
      id,
      userName,
      ...scores,
      comment: cleanText(body.comment, MAX_COMMENT),
      submittedByUid: req.user?.uid || null,
      createdAt: now
    };

    await adminDb.collection(COLLECTION).doc(id).set(evaluation);

    return res.status(201).json({ success: true, evaluation });
  } catch (err) {
    console.error('[Evaluation API] Submit error:', err);
    return res.status(500).json({
      success: false,
      error: 'EVALUATION_SUBMIT_FAILED',
      message: err.message
    });
  }
});

/**
 * GET /api/evaluations
 * The most recent evaluations, newest first. Public, because the page that
 * shows them is.
 */
evaluationRouter.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 150, 300);
    const snap = await adminDb.collection(COLLECTION).get();

    const evaluations = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit);

    return res.status(200).json({ success: true, evaluations });
  } catch (err) {
    console.error('[Evaluation API] List error:', err);
    return res.status(500).json({
      success: false,
      error: 'EVALUATION_LIST_FAILED',
      message: err.message
    });
  }
});
