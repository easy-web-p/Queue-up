import { createSlice } from '@reduxjs/toolkit'
import { getEffectiveRoles, isUserSuperAdmin } from '../utils/authRoles.js'

// Read saved user session from LocalStorage for initial UI display cache
// 🔒 Security Policy: Roles NEVER trust LocalStorage and always default to ['customer'] until AuthContext onAuthStateChanged authoritatively verifies from Firebase Auth & Firestore
const getInitialUser = () => {
  if (typeof window !== 'undefined') {
    try {
      const savedUser = localStorage.getItem('queueup_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (!parsed || typeof parsed !== 'object' || !parsed.uid) return null;
        return {
          uid: String(parsed.uid),
          email: String(parsed.email || ""),
          displayName: String(parsed.displayName || parsed.name || "ผู้ใช้งาน QueueUp"),
          photoURL: String(parsed.photoURL || parsed.photo || "/yeti_mascot.jpg"),
          roles: ["customer"],
          activeRole: "customer",
          isMerchantVerified: false,
          isMerchantRegistered: false,
          isSuperAdmin: false,
          isVerifiedAuth: false,
          isTokenVerified: false,
          isFromCache: true,
          storeId: undefined,
          school: String(parsed.school || "โรงเรียน"),
        };
      }
    } catch (err) {
      console.warn('Error reading saved user session:', err);
    }
  }
  return null;
};

// Helper: Filter out sensitive fields and enforce role integrity before saving cache
const filterSafeUserSession = (rawUser) => {
  if (!rawUser) return null;
  const { uid, email, displayName, name, photo, photoURL, activeRole, school, isMerchantVerified, isMerchantRegistered, storeId } = rawUser;
  const isSuperAdmin = isUserSuperAdmin(rawUser);
  const verifiedRoles = getEffectiveRoles(rawUser);
  const isMerchant = verifiedRoles.includes("merchant");
  const verifiedActiveRole = isSuperAdmin ? (activeRole || "admin") : (isMerchant && activeRole === "merchant" ? "merchant" : "customer");

  return {
    uid: uid || "",
    email: email || "",
    displayName: displayName || name || "ผู้ใช้งาน QueueUp",
    photoURL: photoURL || photo || "/yeti_mascot.jpg",
    activeRole: verifiedActiveRole,
    roles: verifiedRoles,
    isMerchantVerified: Boolean(isMerchantVerified || isSuperAdmin),
    isMerchantRegistered: Boolean(isMerchantRegistered || isSuperAdmin),
    isSuperAdmin: isSuperAdmin,
    isVerifiedAuth: false, // 🔒 Stored cache is marked unverified
    isTokenVerified: false,
    isFromCache: true,
    storeId: storeId || (isMerchant ? "store_canteen01" : undefined),
    school: school || "โรงเรียน",
  };
};

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: getInitialUser(),
    isLoading: true, // 🔒 Start as true so route guards wait for Firebase Auth verification
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isLoading = false;
      if (typeof window !== 'undefined' && action.payload) {
        const safeSession = filterSafeUserSession(action.payload);
        localStorage.setItem('queueup_user', JSON.stringify(safeSession));
      }
    },
    switchRole: (state, action) => {
      if (state.user) {
        const requestedRole = action.payload || (state.user.activeRole === "merchant" ? "customer" : "merchant");
        const effectiveRoles = getEffectiveRoles(state.user);
        // 🔒 Guard: User can ONLY switch to roles they are officially authorized to assume
        if (!effectiveRoles.includes(requestedRole)) {
          console.warn(`[Security] Unauthorized role switch attempt to '${requestedRole}' rejected.`);
          return;
        }
        state.user = {
          ...state.user,
          activeRole: requestedRole,
        };
        if (typeof window !== 'undefined') {
          const safeSession = filterSafeUserSession(state.user);
          localStorage.setItem('queueup_user', JSON.stringify(safeSession));
        }
      }
    },
    clearUser: (state) => {
      state.user = null
      state.isLoading = false
      if (typeof window !== 'undefined') {
        localStorage.removeItem('queueup_user')
        localStorage.removeItem('queueup_secure_account_id')
      }
    },
  },
})

export const { setUser, switchRole, clearUser } = authSlice.actions
export default authSlice.reducer