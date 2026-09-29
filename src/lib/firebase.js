/**
 * Firebase Bridge for QueueUp Landing & Evaluation System
 */
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { STORES, FOOD_ITEMS } from '../data/mockData';
import { SYSTEM_EVALUATIONS_DATA } from '../data/canteenEvaluationData';

export { db, auth };

export async function fetchShopsFromFirestore() {
  try {
    const snap = await getDocs(collection(db, 'stores'));
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('[Firebase] fetchShops fallback to mock:', err);
  }
  return STORES;
}

export async function fetchProductsFromFirestore() {
  // menu_items is the canonical collection and the only one rules expose to a
  // client. The old food_items name was read here too, but there is no rule for
  // it, so that read was refused on every call and contributed nothing except a
  // console warning on each page load.
  const byId = new Map();

  try {
    const snap = await getDocs(collection(db, 'menu_items'));
    snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[Firebase] fetchProducts note:', err);
  }

  return byId.size > 0 ? Array.from(byId.values()) : FOOD_ITEMS;
}

export async function fetchEvaluationsFromFirestore() {
  // Read through the API. There is no rule for the evaluations collection, so a
  // direct client read is refused by the catch-all — which is why this page only
  // ever showed the baseline, however many evaluations had been submitted.
  try {
    const res = await fetch('/api/evaluations?limit=150');
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.evaluations) && data.evaluations.length > 0) {
      const existingIds = new Set(data.evaluations.map((c) => c.id));
      const remainingBaseline = SYSTEM_EVALUATIONS_DATA.filter((b) => !existingIds.has(b.id));
      return [...data.evaluations, ...remainingBaseline];
    }
  } catch (err) {
    console.warn('[Evaluations] fetch fallback to local/baseline:', err);
  }

  try {
    const local = JSON.parse(localStorage.getItem('queueup_user_evaluations') || '[]');
    if (Array.isArray(local) && local.length > 0) {
      const existingIds = new Set(local.map((c) => c.id));
      const remainingBaseline = SYSTEM_EVALUATIONS_DATA.filter((b) => !existingIds.has(b.id));
      return [...local, ...remainingBaseline];
    }
  } catch {
    // ignore
  }

  // 107 real system architecture evaluations from evaluation file
  return SYSTEM_EVALUATIONS_DATA;
}

export async function submitEvaluationToFirestore(newRating) {
  // Submitted through the API, and a failure is raised rather than swallowed.
  // Writing straight to Firestore was refused by rules every time, and this
  // function caught the refusal and returned the record anyway — so the page
  // thanked people for an evaluation that had gone nowhere.
  const res = await fetch('/api/evaluations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newRating)
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || data?.error || 'ไม่สามารถบันทึกผลประเมินได้');
  }

  const item = data.evaluation;

  // Kept locally as well, so the submitter still sees their own entry straight
  // away even if the list is served from a cache.
  try {
    const local = JSON.parse(localStorage.getItem('queueup_user_evaluations') || '[]');
    localStorage.setItem('queueup_user_evaluations', JSON.stringify([item, ...local]));
  } catch {
    // ignore
  }

  return item;
}
