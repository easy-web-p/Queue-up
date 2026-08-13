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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        dispatch(setUser({
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          photo: user.photoURL,
        }))
      } else {
        dispatch(clearUser())
      }
    })
    return () => unsubscribe()
  }, [dispatch])

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      console.error('Google login error:', err)
    }
  }

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export { useAuth } from './useAuth.js'