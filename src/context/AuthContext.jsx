/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth'
import { useDispatch } from 'react-redux'
import { auth, googleProvider, db, doc, getDoc } from '../firebase/config.js'
import { setUser, clearUser } from '../store/authSlice.js'

import { getEffectiveRoles } from '../utils/authRoles.js'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const dispatch = useDispatch()

  // Completes a Google sign-in that fell back to redirect. The session itself
  // arrives through onAuthStateChanged below; this is what surfaces a failure
  // instead of returning the user to a login screen with no explanation.
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      if (err?.code === 'auth/no-auth-event') return; // no redirect was in flight
      console.error('Firebase Google login redirect result error:', err);
      alert(
        'การเข้าสู่ระบบด้วย Google ไม่สำเร็จ (' + (err?.code || 'unknown') + ')\n' +
        'กรุณาลองใหม่ หรือเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน'
      );
    });
  }, []);

  useEffect(() => {
    let currentSeq = 0;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const thisSeq = ++currentSeq;

      if (!firebaseUser) {
        // Explicitly clear user session and turn off loading
        dispatch(clearUser());
        return;
      }

      try {
        // 🔒 Verified custom claims are the only trusted source of privileged roles.
        // The Firestore profile doc below is written by the user themselves and can
        // never grant admin / staff_supervisor — see utils/authRoles.js.
        let tokenClaims = {};
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          tokenClaims = tokenResult?.claims || {};
        } catch (tokenErr) {
          console.warn("Could not read ID token claims:", tokenErr);
        }
        if (thisSeq !== currentSeq) return;

        let userDocData = null;
        let profileFetchError = false;
        try {
          const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          // If a subsequent auth event or logout occurred while awaiting Firestore, drop this stale execution
          if (thisSeq !== currentSeq) return;
          if (userSnap.exists()) {
            userDocData = userSnap.data();
          }
        } catch (docErr) {
          console.warn("Could not fetch user profile from Firestore:", docErr);
          profileFetchError = true;
        }

        if (thisSeq !== currentSeq) return;

        const mergedUser = {
          ...userDocData,
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          tokenClaims,
          isVerifiedAuth: true,
          isTokenVerified: true,
          isFromCache: false,
          isProfileLoaded: Boolean(userDocData),
          isProfileError: profileFetchError,
        };

        const roles = getEffectiveRoles(mergedUser);
        const isAdminUser = roles.includes("admin");
        const isMerchant = roles.includes("merchant");
        const isMerchantVerified = userDocData?.isMerchantVerified === true || isAdminUser;
        const isMerchantRegistered = userDocData?.isMerchantRegistered === true || isAdminUser;

        const activeRole = isAdminUser
          ? (userDocData?.activeRole || "admin")
          : (userDocData?.activeRole || (isMerchant ? "merchant" : "customer"));

        const isGoogle = Boolean(firebaseUser.providerData?.some(p => p.providerId === 'google.com'));

        dispatch(setUser({
          uid: firebaseUser.uid,
          name: userDocData?.name || firebaseUser.displayName || "ผู้ใช้งาน QueueUp",
          displayName: userDocData?.displayName || firebaseUser.displayName || "ผู้ใช้งาน QueueUp",
          email: firebaseUser.email || "",
          photo: userDocData?.photo || firebaseUser.photoURL || "/yeti_mascot.jpg",
          photoURL: userDocData?.photoURL || firebaseUser.photoURL || "/yeti_mascot.jpg",
          roles: roles,
          activeRole: activeRole,
          // Carried through so role checks re-derived from the Redux user (e.g. in
          // ProtectedRoute) resolve identically to the check performed here.
          tokenClaims,
          isGoogleUser: isGoogle,
          isMerchantVerified: isMerchantVerified,
          isMerchantRegistered: isMerchantRegistered,
          isSuperAdmin: isAdminUser,
          isVerifiedAuth: true,
          isTokenVerified: true,
          isFromCache: false,
          isProfileLoaded: Boolean(userDocData),
          isProfileError: profileFetchError,
          storeId: userDocData?.storeId || undefined,
        }));
      } catch (fatalErr) {
        console.error("Fatal error during auth state resolution:", fatalErr);
        // Fallback: Dispatch safe customer session with verified auth so user is NEVER left in infinite loading
        if (thisSeq === currentSeq) {
          dispatch(setUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || "ผู้ใช้งาน QueueUp",
            displayName: firebaseUser.displayName || "ผู้ใช้งาน QueueUp",
            email: firebaseUser.email || "",
            photo: firebaseUser.photoURL || "/yeti_mascot.jpg",
            photoURL: firebaseUser.photoURL || "/yeti_mascot.jpg",
            roles: ["customer"],
            activeRole: "customer",
            isGoogleUser: Boolean(firebaseUser.providerData?.some(p => p.providerId === 'google.com')),
            isMerchantVerified: false,
            isMerchantRegistered: false,
            isSuperAdmin: false,
            isVerifiedAuth: true,
            isTokenVerified: true,
            isFromCache: false,
            isProfileLoaded: false,
            isProfileError: true,
          }));
        }
      }
    });

    return () => {
      currentSeq++;
      unsubscribe();
    };
  }, [dispatch])

  /**
   * Errors that mean the popup route cannot work in this browser at all, as opposed
   * to the user declining it. Safari and iOS/iPadOS Safari partition storage per
   * origin, so the popup lands on the auth handler unable to read the state the app
   * wrote before opening it — reported as auth/missing-initial-state, and previously
   * left as a bare Firebase error page in an orphaned tab with the app none the wiser.
   */
  const POPUP_UNAVAILABLE_CODES = [
    'auth/popup-blocked',
    'auth/missing-initial-state',
    'auth/web-storage-unsupported',
    'auth/operation-not-supported-in-this-environment',
  ];

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      console.warn('Firebase Google login popup error:', err);

      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // The user dismissed it; nothing is wrong.
        return null;
      }

      if (err.code === 'auth/unauthorized-domain') {
        const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'queue-up-nu.vercel.app';
        alert(`⚠️ โดเมน "${currentHostname}" ยังไม่ถูกเพิ่มใน Authorized Domains ของ Firebase Console\n(กรุณาเพิ่มใน Firebase Console > Authentication > Settings > Authorized domains หรือเข้าสู่ระบบด้วยอีเมล/รหัสผ่าน)`);
        return null;
      }

      if (POPUP_UNAVAILABLE_CODES.includes(err.code)) {
        // Same-tab redirect instead. It survives storage partitioning provided the
        // auth handler is same-origin — see resolveAuthDomain in firebase/config.js.
        // This navigates away, so nothing after it runs; the session is picked up by
        // getRedirectResult and onAuthStateChanged when the browser comes back.
        try {
          await signInWithRedirect(auth, googleProvider);
          return null;
        } catch (redirectErr) {
          console.error('Firebase Google login redirect error:', redirectErr);
          alert(
            'ไม่สามารถเข้าสู่ระบบด้วย Google บนเบราว์เซอร์นี้ได้\n' +
            'กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านแทน'
          );
          return null;
        }
      }

      throw err;
    }
  }

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("SignOut warning:", e);
    }
    dispatch(clearUser());
    if (typeof window !== 'undefined') {
      localStorage.removeItem('queueup_user');
      localStorage.removeItem('queueup_secure_account_id');
    }
  }

  return (
    <AuthContext.Provider value={{ loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export { useAuth } from './useAuth.js'