import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { AuthUser, UserRole } from '../types';
import { auth } from '../config/firebase';
import { signInWithGoogle as fbSignIn, signOutUser as fbSignOut } from '../services/firebase';
import { userRepository } from '../repositories/userRepository';

interface AuthContextType {
  user: AuthUser | null;
  firebaseUser: FirebaseUser | null;
  role: UserRole | string;
  claims: Record<string, unknown>;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: AuthUser, initialRole?: UserRole | string) => void;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  switchRole: (newRole: UserRole | string) => void;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
  hasRole: (allowedRoles?: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | string>('customer');
  const [claims, setClaims] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Subscribe to Firebase Auth state directly
  // Note: NO AuthUser or token is stored in localStorage!
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setIsLoading(true);
      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          const tokenResult = await fbUser.getIdTokenResult();
          const customClaims = tokenResult.claims || {};
          setClaims(customClaims);

          const determinedRole: UserRole = (customClaims.role as UserRole) || 
            (customClaims.admin ? 'admin' : (customClaims.storeId ? 'merchant' : 'customer'));
          setRole(determinedRole);

          // Read private profile from Firestore
          const privateProfile = await userRepository.getPrivateProfile(fbUser.uid);
          if (privateProfile) {
            setUser({
              id: fbUser.uid,
              fullName: privateProfile.displayName || fbUser.displayName || 'ผู้ใช้งาน',
              email: privateProfile.email || fbUser.email || '',
              phone: privateProfile.phone || '',
              role: privateProfile.role || determinedRole,
              avatar: privateProfile.avatar || fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              authProvider: 'google',
              studentOrStoreId: privateProfile.studentOrStoreId,
              storeId: privateProfile.storeId,
              allergies: privateProfile.allergies || [],
              registeredAt: privateProfile.memberSince || new Date().toISOString()
            });
          } else {
            // First time login: create initial profile object in state
            const initialUser: AuthUser = {
              id: fbUser.uid,
              fullName: fbUser.displayName || 'ผู้ใช้งาน',
              email: fbUser.email || '',
              phone: '',
              role: determinedRole,
              avatar: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              authProvider: 'google',
              allergies: [],
              registeredAt: new Date().toISOString()
            };
            setUser(initialUser);

            // Persist initial private profile to Firestore
            await userRepository.updatePrivateProfile(fbUser.uid, {
              id: fbUser.uid,
              displayName: initialUser.fullName,
              email: initialUser.email,
              phone: '',
              role: determinedRole,
              avatar: initialUser.avatar || null,
              allergies: [],
              memberSince: initialUser.registeredAt
            });
          }
        } catch (err) {
          console.warn('[AuthContext] Error loading user claims or profile:', err);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
        setRole('customer');
        setClaims({});
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (userData: AuthUser, initialRole?: UserRole | string) => {
    setUser(userData);
    if (initialRole) setRole(initialRole);
  };

  const logout = async () => {
    try {
      await fbSignOut();
    } catch (e) {
      console.warn('Signout warning:', e);
    }
    setUser(null);
    setFirebaseUser(null);
    setRole('customer');
    setClaims({});
  };

  const signInWithGoogle = async () => {
    await fbSignIn();
    // onAuthStateChanged will handle profile and token updates automatically
  };

  const switchRole = (newRole: UserRole | string) => {
    setRole(newRole);
  };

  const hasRole = (allowedRoles?: string[]) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    if (role === 'admin' || claims.admin) return true;
    return allowedRoles.includes(String(role));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        role,
        claims,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        signInWithGoogle,
        switchRole,
        setUser,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
