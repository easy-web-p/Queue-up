import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice.js';
import cartReducer from './cartSlice';
import queueReducer from './queueSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    queue: queueReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
