/**
 * Firebase Bridge for QueueUp Landing & Evaluation System
 */
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
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
  // `menu_items` is canonical; `food_items` is still read so records written
  // under the old collection name keep appearing during the migration.
  const byId = new Map();

  for (const collectionName of ['food_items', 'menu_items']) {
    try {
      const snap = await getDocs(collection(db, collectionName));
      snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
    } catch (err) {
      console.warn(`[Firebase] fetchProducts ${collectionName} note:`, err);
    }
  }

  return byId.size > 0 ? Array.from(byId.values()) : FOOD_ITEMS;
}

export async function fetchEvaluationsFromFirestore() {
  try {
    const q = query(collection(db, 'evaluations'), orderBy('createdAt', 'desc'), limit(150));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const existingIds = new Set(list.map((c) => c.id));
      const remainingBaseline = SYSTEM_EVALUATIONS_DATA.filter((b) => !existingIds.has(b.id));
      return [...list, ...remainingBaseline];
    }
  } catch (err) {
    console.warn('[Firebase] fetchEvaluations fallback to local/mock:', err);
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
  const item = {
    ...newRating,
    createdAt: { seconds: Math.floor(Date.now() / 1000) },
    id: "eval_" + Date.now(),
  };

  try {
    const docRef = await addDoc(collection(db, 'evaluations'), {
      ...newRating,
      createdAt: serverTimestamp(),
    });
    item.id = docRef.id;
  } catch (err) {
    console.warn('[Firebase] submitEvaluation fallback to local:', err);
  }

  try {
    const local = JSON.parse(localStorage.getItem('queueup_user_evaluations') || '[]');
    localStorage.setItem('queueup_user_evaluations', JSON.stringify([item, ...local]));
  } catch {
    // ignore
  }

  return item;
}
