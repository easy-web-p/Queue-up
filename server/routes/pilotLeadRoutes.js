/**
 * Pilot enquiries from the landing page.
 *
 * The form wrote straight to Firestore. There is no rule for pilot_leads, so
 * the catch-all refused every write, and the helper caught the refusal and
 * returned the record anyway — so the page showed its success panel while the
 * enquiry sat in that visitor's localStorage and nowhere else. Every canteen
 * that asked to join the pilot was lost.
 *
 * Enquiries come through here now, where they are validated, rate-limited, and
 * either stored or reported as not stored.
 */

import { Router } from 'express';
import { adminDb } from '../firebaseAdmin.js';
import { optionalAuthenticate } from '../middleware/authenticate.js';

export const pilotLeadRouter = Router();

const COLLECTION = 'pilot_leads';
const MAX_SHORT = 120;
const MAX_NOTES = 2000;

function cleanText(value, max) {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .replace(/[ \t]+/g, ' ')
    .slice(0, max);
}

/** Thai numbers, with or without the spacing people type. */
function cleanPhone(value) {
  const digits = String(value ?? '').replace(/[^\d+]/g, '');
  return digits.length >= 8 && digits.length <= 20 ? digits : '';
}

/**
 * POST /api/pilot-leads
 * Records one enquiry. Open to visitors who are not signed in, because that is
 * who the landing page asks.
 */
pilotLeadRouter.post('/', optionalAuthenticate, async (req, res) => {
  try {
    const body = req.body || {};

    const contactName = cleanText(body.contactName, MAX_SHORT);
    const phone = cleanPhone(body.phone);

    if (!contactName || !phone) {
      return res.status(400).json({
        success: false,
        error: 'CONTACT_REQUIRED',
        message: 'กรุณากรอกชื่อและเบอร์โทรศัพท์สำหรับติดต่อกลับ'
      });
    }

    const now = new Date().toISOString();
    const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const lead = {
      id,
      schoolName: cleanText(body.schoolName, MAX_SHORT) || contactName,
      contactName,
      phone,
      email: cleanText(body.email, MAX_SHORT),
      position: cleanText(body.position, MAX_SHORT),
      studentCount: cleanText(body.studentCount, 40),
      notes: cleanText(body.notes, MAX_NOTES),
      submittedByUid: req.user?.uid || null,
      status: 'NEW',
      createdAt: now,
      updatedAt: now
    };

    await adminDb.collection(COLLECTION).doc(id).set(lead);
    console.log(`[Pilot API] Enquiry from ${lead.schoolName} recorded as ${id}.`);

    return res.status(201).json({ success: true, lead });
  } catch (err) {
    console.error('[Pilot API] Submit error:', err);
    return res.status(500).json({
      success: false,
      error: 'PILOT_LEAD_FAILED',
      message: err.message
    });
  }
});

/**
 * GET /api/pilot-leads
 * The enquiry list, newest first. Platform administrators only — these are
 * people's names and phone numbers.
 */
pilotLeadRouter.get('/', optionalAuthenticate, async (req, res) => {
  const { isSuperAdmin } = await import('../middleware/authenticate.js');
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'This list is restricted to platform administrators.'
    });
  }

  try {
    const snap = await adminDb.collection(COLLECTION).get();
    const leads = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, Math.min(Number(req.query.limit) || 200, 500));

    return res.status(200).json({ success: true, leads });
  } catch (err) {
    console.error('[Pilot API] List error:', err);
    return res.status(500).json({ success: false, error: 'PILOT_LEAD_LIST_FAILED', message: err.message });
  }
});
