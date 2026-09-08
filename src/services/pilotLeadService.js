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
import { functions } from '../firebase/config.js';

/**
 * @param {{schoolName: string, studentCount?: string, contactName: string,
 *          position?: string, phone: string, email: string, notes?: string}} form
 * @returns {Promise<{leadId: string}>} resolves only once the lead is stored
 * @throws {Error} with a message safe to show the school
 */
export async function submitPilotLead(form) {
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
  return { leadId: result?.data?.leadId };
}
