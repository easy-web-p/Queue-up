/**
 * Pilot enquiry submission.
 *
 * This used to write straight to Firestore and swallow the refusal. There is no
 * rule for pilot_leads, so the write was refused every time, and returning the
 * record anyway meant the page showed its success panel while the enquiry
 * existed only in that visitor's localStorage. Every canteen that asked to join
 * the pilot was lost that way.
 */

export async function submitPilotLead(leadData) {
  const res = await fetch('/api/pilot-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leadData)
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || data?.error || 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
  }

  const item = data.lead;

  // Kept locally too, so a visitor who submits and comes straight back still
  // sees their own enquiry.
  try {
    const local = JSON.parse(localStorage.getItem('queueup_pilot_leads') || '[]');
    localStorage.setItem('queueup_pilot_leads', JSON.stringify([item, ...local]));
  } catch {
    // ignore
  }

  return item;
}
