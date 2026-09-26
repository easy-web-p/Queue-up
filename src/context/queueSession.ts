import { AuthUser, UserRole } from '../types';

/**
 * View identifiers used by QueueProvider and mapped to URLs in App.tsx.
 */
export type AppView =
  | 'landing'
  | 'about'
  | 'register-school'
  | 'home'
  | 'search'
  | 'store-detail'
  | 'food-detail'
  | 'user-profile'
  | 'queue-tracking'
  | 'order-history'
  | 'merchant-dashboard'
  | 'kds'
  | 'admin-dashboard'
  | 'create-store'
  | 'store-admin'
  | 'chat'
  | 'store-chat';

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export const ADMIN_EMAIL = 'hi00000087@gmail.com';

/**
 * UI-level admin check only.
 *
 * This decides what the interface offers; it is not an authorization boundary.
 * The server checks SUPER_ADMIN_EMAILS and firestore.rules checks the account's
 * custom claims, neither of which a browser can influence.
 */
export const isSuperAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
};

export const SESSION_STORAGE_KEY = 'queueup_session_v1';

export const DEFAULT_DEMO_USER: AuthUser = {
  id: 'USR-89241',
  fullName: 'ธนากร สุขเกษม',
  email: 'hi00000087@gmail.com',
  phone: '089-876-5432',
  role: 'merchant',
  storeId: 'store-1',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  authProvider: 'google',
  studentOrStoreId: 'STD-6501094',
  allergies: ['กุ้ง', 'ถั่วลิสง'],
  registeredAt: '2024-01-15T08:30:00.000Z'
};

/**
 * Restores the locally cached session and decides the first screen.
 *
 * Runs synchronously during the provider's first render so the app does not
 * flash the landing page before Firebase Auth resolves. The cached role only
 * selects the initial view — every privileged action is re-checked server-side.
 */
export const getInitialSession = (): { user: AuthUser | null; view: AppView; role: UserRole } => {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isAbout = currentPath === '/about' || currentPath === '/queueup';

  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as AuthUser;
      if (parsed && (parsed.email || parsed.fullName)) {
        const isUserAdmin = isSuperAdmin(parsed.email);
        const resolvedRole: UserRole = isUserAdmin ? 'admin' : (parsed.role === 'admin' ? 'customer' : (parsed.role || 'customer'));
        let targetView: AppView = isAbout ? 'about' : (resolvedRole === 'merchant' ? 'kds' : (resolvedRole === 'admin' ? 'admin-dashboard' : 'home'));
        if (targetView === 'admin-dashboard' && !isUserAdmin) {
          targetView = 'home';
        }
        // Link the platform owner's account directly to their store
        const storeId = parsed.storeId || (parsed.email?.toLowerCase() === ADMIN_EMAIL ? 'store-1' : undefined);
        return {
          user: {
            ...parsed,
            storeId,
            role: resolvedRole
          },
          view: targetView,
          role: resolvedRole
        };
      }
    }
  } catch (err) {
    console.error('Session load error:', err);
  }

  return {
    user: null, // Initial guest: not registered yet
    view: isAbout ? 'about' : 'landing',
    role: 'customer'
  };
};
