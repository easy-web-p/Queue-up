import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, LogIn, Store as StoreIcon } from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { UserRole } from '../../types';
import { Button } from '../ui/Button';

/**
 * Route guard for pages that belong to a particular kind of account.
 *
 * Every signed-in visitor used to reach the Kitchen Display System, the
 * merchant dashboard and the store admin page, because the only check was
 * "is someone logged in". The server refuses the data either way, so a
 * customer who wandered in saw an empty board rather than anything dangerous —
 * but an empty board is a broken-looking app, and a merchant-only control
 * surface should not be presented to a customer at all.
 *
 * Being turned away is not the same as being signed out. A signed-out visitor
 * is sent to the landing page to sign in; a signed-in visitor who simply lacks
 * the role is told so, rather than bounced to a page that implies their session
 * expired.
 */
interface RequireRoleProps {
  allow: UserRole[];
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ allow, children }) => {
  const { currentUser, role, isAdmin, setCurrentView } = useQueue();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/landing" replace state={{ from: location.pathname }} />;
  }

  // Platform admins are not locked out of the surfaces they support.
  if (isAdmin || allow.includes(role as UserRole)) {
    return <>{children}</>;
  }

  const wantsMerchant = allow.includes('merchant');

  return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-stone-200 dark:border-zinc-800 shadow-sm space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-stone-900 dark:text-white">
            หน้านี้สำหรับ{wantsMerchant ? 'ร้านค้า' : 'ผู้ดูแลระบบ'}เท่านั้น
          </h1>
          <p className="text-sm text-stone-600 dark:text-zinc-400">
            บัญชีของคุณเข้าสู่ระบบอยู่แล้ว แต่ยังไม่มีสิทธิ์
            {wantsMerchant ? 'จัดการร้านค้า' : 'ดูแลระบบ'}ค่ะ
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
          <Button variant="primary" onClick={() => setCurrentView('home')}>
            กลับไปหน้าแรก
          </Button>
          {wantsMerchant && (
            <Button
              variant="secondary"
              leftIcon={<StoreIcon className="w-4 h-4" />}
              onClick={() => setCurrentView('create-store')}
            >
              เปิดร้านค้าของคุณ
            </Button>
          )}
        </div>

        <p className="text-[11px] text-stone-400 dark:text-zinc-600 flex items-center justify-center gap-1.5">
          <LogIn className="w-3 h-3" />
          หากคุณเป็นเจ้าของร้าน ให้เข้าสู่ระบบด้วยบัญชีที่ผูกกับร้าน
        </p>
      </div>
    </div>
  );
};
