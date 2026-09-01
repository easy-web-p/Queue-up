import { createSlice } from '@reduxjs/toolkit'

// Read saved user session from LocalStorage for auto-login persistence
const getInitialUser = () => {
  if (typeof window !== 'undefined') {
    try {
      const savedUser = localStorage.getItem('queueup_user')
      if (savedUser) {
        return JSON.parse(savedUser)
      }
    } catch (err) {
      console.warn('Error reading saved user session:', err)
    }
  }
  return null
}

// Helper: Filter out sensitive fields before saving user session to LocalStorage
const filterSafeUserSession = (rawUser) => {
  if (!rawUser) return null;
  const { uid, email, displayName, name, photo, photoURL, activeRole, roles, role, school } = rawUser;
  return {
    uid: uid || "",
    email: email || "",
    displayName: displayName || name || "ผู้ใช้งาน QueueUp",
    photoURL: photoURL || photo || "/yeti_mascot.jpg",
    activeRole: activeRole || role || "customer",
    roles: roles || [activeRole || role || "customer"],
    school: school || "โรงเรียน",
  };
};

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: getInitialUser(),
    isLoading: false,
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
        const newRole = action.payload || (state.user.activeRole === "merchant" ? "customer" : "merchant");
        state.user = {
          ...state.user,
          activeRole: newRole,
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