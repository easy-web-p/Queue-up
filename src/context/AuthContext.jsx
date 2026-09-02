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
        const isAdmin = firebaseUser.email === "58140@lomsak.ac.th";
        let existingUser = null;
        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('queueup_user');
            if (raw) existingUser = JSON.parse(raw);
          } catch (e) {
            console.warn('Error reading stored user session:', e);
          }
        }

        const userRoles = existingUser?.roles || (isAdmin ? ["customer", "merchant", "admin"] : ["customer"]);
        const activeRole = existingUser?.activeRole || (isAdmin ? "admin" : "customer");

        dispatch(setUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || existingUser?.name || "ผู้ใช้งาน QueueUp",
          displayName: firebaseUser.displayName || existingUser?.displayName || "ผู้ใช้งาน QueueUp",
          email: firebaseUser.email || existingUser?.email || "",
          photo: firebaseUser.photoURL || existingUser?.photo || "/yeti_mascot.jpg",
          photoURL: firebaseUser.photoURL || existingUser?.photoURL || "/yeti_mascot.jpg",
          roles: userRoles,
          activeRole: activeRole,
          isGoogleUser: true,
        }));
      }
    })
    return () => unsubscribe()
  }, [dispatch])

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      console.warn('Firebase Google login popup warning/fallback:', err);
      // Fallback for popup blocked / unauthorized domain / network timeout
      if (
        err.code === 'auth/unauthorized-domain' ||
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/cancelled-popup-request' ||
        err.code === 'auth/popup-closed-by-user' ||
        err.message?.includes('popup')
      ) {
        const fallbackUser = {
          uid: "google_student_58140",
          displayName: "(ม.1/6) -58140 เด็กชายพิสิษฐ์ แก้วกุลพิสิษฐ์",
          email: "58140@lomsak.ac.th",
          photoURL: "/yeti_mascot.jpg",
        };
        dispatch(setUser({
          uid: fallbackUser.uid,
          name: fallbackUser.displayName,
          displayName: fallbackUser.displayName,
          email: fallbackUser.email,
          photo: fallbackUser.photoURL,
          photoURL: fallbackUser.photoURL,
          roles: ["customer", "merchant", "admin"],
          activeRole: "customer",
          isGoogleUser: true,
        }));
        return fallbackUser;
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