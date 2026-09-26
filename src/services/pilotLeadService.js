/**
 * Pilot Lead Submission Service
 */
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function submitPilotLead(leadData) {
  const item = {
    ...leadData,
    id: 'lead_' + Date.now(),
    createdAt: new Date().toISOString()
  };

  try {
    if (db) {
      const docRef = await addDoc(collection(db, 'pilot_leads'), {
        ...leadData,
        createdAt: serverTimestamp()
      });
      item.id = docRef.id;
    }
  } catch (err) {
    console.warn('[PilotLeadService] Firestore save error:', err);
  }

  try {
    const local = JSON.parse(localStorage.getItem('queueup_pilot_leads') || '[]');
    localStorage.setItem('queueup_pilot_leads', JSON.stringify([item, ...local]));
  } catch {
    // ignore
  }

  return item;
}
