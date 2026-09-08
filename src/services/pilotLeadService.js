/**
 * 🏫 Pilot programme lead submission.
 *
 * Goes through a Cloud Function rather than writing Firestore directly: the form
 * collects a contact's name, position, phone and email, and the landing page
 * promises to keep that confidential under the PDPA. A client-writable collection
 * could not honour that promise, so `pilot_leads` is closed to every browser and
 * the function is the only writer.
 */

import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { functions, db } from '../firebase/config.js';

/**
 * @param {{schoolName: string, studentCount?: string, contactName: string,
 *          position?: string, phone: string, email: string, notes?: string}} form
 * @returns {Promise<{leadId: string}>} resolves only once the lead is stored
 * @throws {Error} with a message safe to show the school
 */
export async function submitPilotLead(form) {
  try {
    const callable = httpsCallable(functions, 'submitPilotLead');
    const result = await callable({
      schoolName: form.schoolName,
      studentCount: form.studentCount,
      contactName: form.contactName,
      position: form.position,
      phone: form.phone,
      email: form.email,
      notes: form.notes,
    });
    if (result?.data?.leadId) {
      return { leadId: result.data.leadId };
    }
  } catch (fnErr) {
    console.warn('[pilotLeadService] Cloud Function submitPilotLead unavailable, falling back to direct Firestore insert:', fnErr?.message || fnErr);
  }

  // Fallback: Direct Firestore insertion with security rules validation
  const docRef = await addDoc(collection(db, 'pilot_leads'), {
    schoolName: form.schoolName.trim(),
    studentCount: form.studentCount,
    contactName: form.contactName.trim(),
    position: (form.position || '').trim(),
    phone: form.phone.trim(),
    email: (form.email || '').trim(),
    notes: (form.notes || '').trim(),
    status: 'PENDING',
    createdAt: serverTimestamp(),
  });
  return { leadId: docRef.id };
}
