/**
 * Types for authSlice.js.
 *
 * Without these the slice's state was inferred from getInitialUser()'s return
 * literal, which produced a shape that disagreed with every user object
 * actually dispatched into it — and pages reading `phone` or `id` off it were
 * type errors even though those fields are present at runtime.
 */

import type { AuthSessionUser } from '../types';

export interface AuthState {
  user: AuthSessionUser | null;
  isLoading: boolean;
}

export declare const setUser: (user: AuthSessionUser | null) => {
  type: string;
  payload: AuthSessionUser | null;
};
export declare const switchRole: (role: string) => { type: string; payload: string };
export declare const clearUser: () => { type: string };

declare const reducer: (state: AuthState | undefined, action: { type: string; payload?: unknown }) => AuthState;
export default reducer;
