import React, { useState, useRef, useEffect } from 'react';
import { useQueue } from '../../context/QueueContext';
import {
  User,
  Settings,
  LogOut,
  Store,
  ChefHat,
  ShieldCheck,
  UserCheck,
  Mail,
  Phone,
  ShieldAlert,
  ChevronRight,
  LogIn,
  UserPlus
} from 'lucide-react';

export const UserProfileDropdown: React.FC = () => {
  const {
    currentUser,
    logoutUser,
    role,
    setRole,
    setIsRegisterModalOpen,
    setIsAccountSettingsModalOpen,
    setIsCreateStoreModalOpen,
    userStore,
    openCreateStore,
    openStoreAdmin,
    loginWithGoogle,
    setCurrentView,
    openUserProfile,
    isAdmin
  } = useQueue();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  const roleNames: Record<string, string> = {
    customer: 'ลูกค้าทั่วไป',
    merchant: 'เจ้าของร้าน & เชฟ (KDS)',
    admin: 'ผู้ดูแลระบบกลาง (Super Admin)'
  };

  // If no user is logged in, do not render this circular dropdown button
  if (!currentUser) {
    return null;
  }

  return (
    <div
      className="relative"
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Circular Profile Avatar Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full ring-2 ring-orange-400/80 hover:ring-orange-500 focus:outline-none focus:ring-orange-500 overflow-hidden shadow-xs cursor-pointer transition-all active:scale-95 group flex items-center justify-center bg-orange-100 dark:bg-zinc-800"
        title={`โปรไฟล์: ${currentUser.fullName}`}
        aria-label="เมนูโปรไฟล์ผู้ใช้งาน"
        aria-expanded={isOpen}
      >
        {currentUser.avatar ? (
          <img
            src={currentUser.avatar}
            alt={currentUser.fullName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white font-bold text-sm">
            {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
          </div>
        )}

        {/* Active online dot */}
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />
      </button>

      {/* Profile & Account Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white border border-orange-200/90 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-stone-900 dark:bg-black dark:border-zinc-800 dark:text-zinc-100">
          {currentUser ? (
            <>
              {/* Profile Overview Header - Click to open User Profile Page */}
              <div 
                onClick={() => {
                  openUserProfile(currentUser.id);
                  setIsOpen(false);
                }}
                className="p-3 rounded-xl bg-orange-50/70 border border-orange-100 hover:border-orange-300 dark:bg-zinc-950 dark:border-zinc-800/80 dark:hover:border-zinc-700 mb-2 cursor-pointer transition-colors group"
                title="คลิกเพื่อเปิดหน้าเพจโปรไฟล์เต็ม"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-orange-400 shrink-0 bg-white dark:bg-zinc-800 group-hover:scale-105 transition-transform">
                    {currentUser.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white font-black text-lg">
                        {currentUser.fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-stone-900 dark:text-zinc-100 truncate group-hover:text-orange-600 transition-colors">
                        {currentUser.fullName}
                      </h4>
                      <span className="text-[10px] font-mono font-bold text-orange-600 dark:text-orange-400">
                        #{currentUser.id}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-zinc-400 truncate flex items-center gap-1">
                      <Mail className="w-3 h-3 text-orange-500 shrink-0" />
                      {currentUser.email}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-200/80 text-orange-900 dark:bg-orange-500/20 dark:text-orange-300">
                        {roleNames[role] || 'สมาชิก'}
                      </span>
                      {currentUser.authProvider === 'google' && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          Google Account
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {currentUser.phone && (
                  <div className="mt-2 pt-2 border-t border-orange-200/60 dark:border-zinc-800 flex items-center justify-between text-[11px] text-stone-600 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-stone-400" />
                      {currentUser.phone}
                    </span>
                    {currentUser.allergies && currentUser.allergies.length > 0 && (
                      <span className="text-red-600 dark:text-red-400 font-semibold truncate max-w-[120px]">
                        แพ้: {currentUser.allergies.join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Menu Items */}
              <div className="space-y-1 text-xs">
                {/* 1. ข้อมูลโปรไฟล์ */}
                <button
                  onClick={() => {
                    openUserProfile(currentUser.id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-stone-700 hover:text-stone-950 hover:bg-orange-50/80 transition-colors cursor-pointer dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="font-semibold">หน้าเพจโปรไฟล์ (#{currentUser.id})</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                </button>

                {/* 2. การตั้งค่าบัญชี & แก้ไขข้อมูล */}
                <button
                  onClick={() => {
                    openUserProfile(currentUser.id);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-stone-700 hover:text-stone-950 hover:bg-orange-50/80 transition-colors cursor-pointer dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="font-semibold">แก้ไขบัญชี & สารก่อภูมิแพ้</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                </button>

                {/* 3. ประวัติการสั่งซื้อและคิว */}
                <button
                  onClick={() => {
                    setCurrentView('queue-tracking');
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl text-stone-700 hover:text-stone-950 hover:bg-orange-50/80 transition-colors cursor-pointer dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center gap-2.5">
                    <User className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="font-semibold">ประวัติบัตรคิวและออเดอร์ของฉัน</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                </button>

                {/* 4. ร้านค้าของฉัน / สร้างร้านค้า */}
                {userStore ? (
                  <button
                    onClick={() => {
                      openStoreAdmin(userStore.id);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/90 text-emerald-950 transition-colors cursor-pointer dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={userStore.logo || userStore.image}
                        alt={userStore.name}
                        className="w-4 h-4 rounded-md object-cover border border-emerald-300 dark:border-emerald-600 shrink-0"
                      />
                      <span className="font-bold truncate text-xs">{userStore.name} (แอดมิน & ซัพพอร์ต)</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      openCreateStore();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-orange-50/70 hover:bg-orange-100/90 text-orange-950 transition-colors cursor-pointer dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-orange-300 border border-orange-200/80 dark:border-zinc-700"
                  >
                    <div className="flex items-center gap-2.5">
                      <Store className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <span className="font-bold text-xs">สร้างร้านค้าใหม่ (เปิดร้าน)</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-orange-500" />
                  </button>
                )}

                {/* 5. แดชบอร์ดการแอดมิน (เฉพาะ hi00000087@gmail.com เท่านั้น) */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      setCurrentView('admin-dashboard');
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-purple-50/80 hover:bg-purple-100 text-purple-950 transition-colors cursor-pointer dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="font-bold text-xs">แดชบอร์ดการแอดมิน (Super Admin)</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-purple-500" />
                  </button>
                )}

                {/* 6. ออกจากระบบ */}
                <div className="pt-2 border-t border-orange-100 dark:border-zinc-800/80">
                  <button
                    onClick={() => {
                      logoutUser();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors cursor-pointer font-bold"
                  >
                    <div className="flex items-center gap-2.5">
                      <LogOut className="w-4 h-4" />
                      <span>ออกจากระบบ</span>
                    </div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Guest State: Prompt to sign in or register */
            <div className="p-3 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mx-auto dark:bg-zinc-800 dark:text-orange-400">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
                  ยินดีต้อนรับสู่ QueueUp
                </h4>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                  เข้าสู่ระบบเพื่อรับสิทธิพิเศษ บัตรคิวดิจิทัล และคูปองอาหาร
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {/* Google Login button */}
                <button
                  onClick={() => {
                    loginWithGoogle();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>เข้าสู่ระบบด้วย Google</span>
                </button>

                {/* Email Register button */}
                <button
                  onClick={() => {
                    setIsRegisterModalOpen(true);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>สมัครสมาชิกใหม่</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
