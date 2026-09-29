import {
  signInWithPopup,
  signOut,
  User as FirebaseUser,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { app, auth, db, googleProvider, firebaseConfig, analytics } from '../config/firebase';

export { app, auth, db, googleProvider, firebaseConfig, analytics };

export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('[Auth] Google Sign-in error:', err);
    throw err;
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sign Out Failed';
    console.error('Sign Out Error:', err);
    return { success: false, error: message };
  }
}

export function logAnalyticsEvent(eventName: string, params?: Record<string, unknown>) {
  if (analytics) {
    // Matches the dynamic import in config/firebase.ts; by the time `analytics`
    // is non-null the module is already in the browser's module cache.
    import('firebase/analytics')
      .then(({ logEvent }) => logEvent(analytics!, eventName, params))
      .catch((e) => console.warn('[Analytics] Log event failed:', e));
  }
  console.log(`[Analytics] ${eventName}:`, params);
}

/**
 * Reports whether Firestore is reachable on boot.
 *
 * This read a document in system_health, a collection with no rule, so the
 * answer was always permission-denied and the probe learned nothing — it only
 * checked for the offline message and ignored everything else. A refusal is
 * still the backend answering, so it now counts as reachable: only a genuinely
 * offline client is worth warning about, and the read targets a collection the
 * rules actually expose.
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'stores', '__connectivity_probe__'));
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('the client is offline') || message.includes('Failed to get document')) {
      console.warn('[Firestore] Client is in offline mode; using IndexedDB cache.');
      return false;
    }
    // Anything else — including permission-denied — means the service answered.
    return true;
  }
}

testFirestoreConnection();
