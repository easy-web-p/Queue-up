/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { useDispatch } from 'react-redux'
import { auth, googleProvider, db, doc, getDoc } from '../firebase/config.js'
import { setUser, clearUser } from '../store/authSlice.js'

import { getEffectiveRoles } from '../utils/authRoles.js'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const dispatch = useDispatch()

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
        let userDocData = null;
        try {
          const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          // If a subsequent auth event or logout occurred while awaiting Firestore, drop this stale execution
          if (thisSeq !== currentSeq) return;
          if (userSnap.exists()) {
            userDocData = userSnap.data();
          }
        } catch (docErr) {
          console.warn("Could not fetch user profile from Firestore:", docErr);
        }

        if (thisSeq !== currentSeq) return;

        const mergedUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          isVerifiedAuth: true,
          isTokenVerified: true,
          isFromCache: false,
          ...userDocData,
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
          isGoogleUser: isGoogle,
          isMerchantVerified: isMerchantVerified,
          isMerchantRegistered: isMerchantRegistered,
          isSuperAdmin: isAdminUser,
          isVerifiedAuth: true,
          isTokenVerified: true,
          isFromCache: false,
          storeId: userDocData?.storeId || (isMerchant ? "store_canteen01" : undefined),
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
          }));
        }
      }
    });

    return () => {
      currentSeq++;
      unsubscribe();
    };
  }, [dispatch])

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      console.warn('Firebase Google login popup error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User closed the popup, cancel gracefully
        return null;
      }
      if (err.code === 'auth/unauthorized-domain') {
        const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'queue-up-nu.vercel.app';
        alert(`⚠️ โดเมน "${currentHostname}" ยังไม่ถูกเพิ่มใน Authorized Domains ของ Firebase Console\n(กรุณาเพิ่มใน Firebase Console > Authentication > Settings > Authorized domains หรือเข้าสู่ระบบด้วยอีเมล/รหัสผ่าน)`);
        return null;
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