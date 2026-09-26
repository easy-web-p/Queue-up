import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, role } = useAuth();
  const location = useLocation();

  // If user is not logged in, redirect to /login keeping redirect path
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role is specified, check role
  if (allowedRoles && allowedRoles.length > 0) {
    const isSuperAdmin = role === 'admin';
    const isAllowed = isSuperAdmin || allowedRoles.includes(role);
    if (!isAllowed) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl font-bold mb-4">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white mb-2">ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
          <p className="text-stone-600 dark:text-zinc-400 text-sm max-w-md mb-6">
            บัญชีของคุณ ({role}) ไม่ได้รับอนุญาตให้เข้าใช้งานในส่วนนี้ หากคุณมีบทบาทอื่น โปรดเปลี่ยนบทบาทหรือติดต่อผู้ดูแลระบบ
          </p>
          <a
            href="/queueup"
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium text-sm transition-all"
          >
            กลับสู่หน้าหลัก
          </a>
        </div>
      );
    }
  }

  return <>{children}</>;
};
