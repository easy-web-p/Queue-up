/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { useDispatch } from 'react-redux'
import { auth, googleProvider } from '../firebase/config.js'
import { setUser, clearUser } from '../store/authSlice.js'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const dispatch = useDispatch()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const isAdmin = (firebaseUser.email || "").toLowerCase() === "58140@lomsak.ac.th";
        const userRoles = isAdmin ? ["customer", "merchant", "admin"] : ["customer"];
        const activeRole = isAdmin ? "admin" : "customer";

        dispatch(setUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || "ผู้ใช้งาน QueueUp",
          displayName: firebaseUser.displayName || "ผู้ใช้งาน QueueUp",
          email: firebaseUser.email || "",
          photo: firebaseUser.photoURL || "/yeti_mascot.jpg",
          photoURL: firebaseUser.photoURL || "/yeti_mascot.jpg",
          roles: userRoles,
          activeRole: activeRole,
          isGoogleUser: true,
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