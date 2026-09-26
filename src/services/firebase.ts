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

// Validate connection on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'system_health', 'ping'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Client is in offline mode; using IndexedDB cache.');
    }
  }
}

testFirestoreConnection();
