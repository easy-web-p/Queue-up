import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  getFirestore
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import rawConfig from '../../firebase-applet-config.json';

export const firebaseConfig = rawConfig;

// 1. Initialize or reuse Firebase App
export const app: FirebaseApp = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

// Optional Analytics instance
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported && firebaseConfig.measurementId) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics is blocked or not supported in this environment
  });
}

// 2. Initialize Firestore with Offline IndexedDB Persistence
// Critical rule: DO NOT mix getFirestore() and initializeFirestore() on the same app.
// We configure persistentLocalCache with persistentMultipleTabManager for seamless multi-tab offline support.
let firestoreInstance: Firestore;

try {
  const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;

  const settings = {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  };

  if (databaseId) {
    firestoreInstance = initializeFirestore(app, settings, databaseId);
  } else {
    firestoreInstance = initializeFirestore(app, settings);
  }
  console.log('[Firebase Config] Firestore initialized with offline persistent cache.');
} catch (error) {
  // If already initialized (e.g. HMR in dev), reuse existing instance
  console.warn('[Firebase Config] Firestore already initialized or persistent cache fallback:', error);
  const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;
  firestoreInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export const db: Firestore = firestoreInstance;

// 3. Initialize Firebase Auth
// Firebase Auth provides automatic persistence via IndexedDB without duplicating AuthUser in localStorage.
export const auth = getAuth(app);
// Enforce browserLocalPersistence
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[Firebase Auth] Persistence set warning:', err);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
