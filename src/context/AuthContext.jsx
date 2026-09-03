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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let userDocData = null;
        try {
          const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userSnap.exists()) {
            userDocData = userSnap.data();
          }
        } catch (e) {
          console.warn("Could not fetch user profile from Firestore:", e);
        }

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
      } else {
        // When Firebase session expires / signs out externally, clear state
        dispatch(clearUser());
      }
    });
    return () => unsubscribe();
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