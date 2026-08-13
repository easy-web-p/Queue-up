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

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: getInitialUser(),
    isLoading: false,
  },
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload
      state.isLoading = false
      if (typeof window !== 'undefined' && action.payload) {
        localStorage.setItem('queueup_user', JSON.stringify(action.payload))
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
          localStorage.setItem('queueup_user', JSON.stringify(state.user));
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