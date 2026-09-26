import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import {
  Home,
  Search,
  Ticket,
  Store,
  ChefHat,
  ShieldCheck,
  User,
  PlusCircle,
  HelpCircle,
  Settings,
  Layers,
  FileText,
  PhoneCall,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  LogOut,
  X,
  MessageSquare,
  MapPin,
  Sparkles
} from 'lucide-react';

const PATH_MAP: Record<string, string> = {
  'landing': '/',
  'about': '/about',
  'register-school': '/register-school',
  'home': '/home',
  'search': '/search',
  'store-detail': '/store',
  'food-detail': '/food',
  'user-profile': '/profile',
  'queue-tracking': '/queue-tracking',
  'order-history': '/order-history',
  'merchant-dashboard': '/merchant',
  'kds': '/kds',
  'admin-dashboard': '/admin',
  'create-store': '/create-store',
  'store-admin': '/store-admin',
  'chat': '/chat',
  'store-chat': '/chat'
};

export const AppSidebar: React.FC = () => {
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    currentView,
    setCurrentView,
    currentUser,
    role,
    userStore,
    openCreateStore,
    openStoreAdmin,
    setIsHelpModalOpen,
    setIsAccountSettingsModalOpen,
    logoutUser,
    activeQueueId,
    queues,
    cartItemCount,
    setIsCartOpen,
    openStoreContactAndTerms,
    stores,
    isAdmin,
    openStoreChat,
    openChatPage,
    openStoreChatPage,
    getStoreChatMessages,
    getStoreCustomerThreads
  } = useQueue();

  if (!isSidebarOpen || !currentUser) return null;

  const activeQueue = queues.find(q => q.id === activeQueueId) || queues[0];
  const merchantStore = userStore || (currentUser?.email?.toLowerCase() === 'hi00000087@gmail.com' ? stores.find(s => s.id === 'store-1') : null) || (role === 'merchant' ? stores[0] : null);
  const merchantCustomerThreads = merchantStore ? getStoreCustomerThreads(merchantStore.id) : [];
  const unreadCustomerCount = merchantCustomerThreads.reduce((acc, th) => acc + (th.unreadCount || 0), 0);

  const navigate = useNavigate();

  const handleNavigate = (view: any, targetPath?: string) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
    const dest = targetPath || PATH_MAP[view] || (view === 'landing' ? '/' : `/${view}`);
    if (dest) {
      navigate(dest);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        onClick={() => setIsSidebarOpen(false)}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Sidebar Panel */}
      <aside className="relative flex flex-col w-72 sm:w-80 max-w-[85vw] h-full bg-white dark:bg-zinc-900 border-r border-orange-200/80 dark:border-zinc-800 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-orange-100 dark:border-zinc-800 bg-orange-50/50 dark:bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-red-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Layers className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <span className="font-black text-stone-900 dark:text-zinc-100 text-base">
                Queue<span className="text-orange-600 dark:text-orange-400">Up</span>
              </span>
              <p className="text-[10px] text-stone-500 dark:text-zinc-400 font-medium leading-none">
                Smart Food & Queue
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="ปิดเมนู"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card if logged in */}
        {currentUser ? (
          <div className="p-4 mx-3 my-3 rounded-2xl bg-orange-50/80 dark:bg-zinc-800/60 border border-orange-200/60 dark:border-zinc-700/60 flex items-center gap-3">
            <img
              src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
              alt={currentUser.fullName}
              className="w-11 h-11 rounded-full object-cover border-2 border-orange-400 shadow-sm shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-stone-900 dark:text-white truncate">
                {currentUser.fullName}
              </h4>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate">
                {currentUser.email}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500 text-white uppercase">
                  {currentUser.role}
                </span>
                {currentUser.studentOrStoreId && (
                  <span className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">
                    {currentUser.studentOrStoreId}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 mx-3 my-3 rounded-2xl bg-stone-50 dark:bg-zinc-800/40 border border-stone-200 dark:border-zinc-700 text-center">
            <p className="text-xs text-stone-600 dark:text-zinc-300 font-medium">
              เข้าถึงทุกฟังก์ชันอย่างสะดวก
            </p>
            <button
              onClick={() => handleNavigate('landing')}
              className="mt-2 w-full py-1.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              เข้าสู่ระบบ / ลงทะเบียน
            </button>
          </div>
        )}

        {/* Scrollable Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {/* Main User Navigation */}
          <div>
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
              เมนูหลัก (Navigation)
            </span>
            <div className="mt-1.5 space-y-1">
              <button
                onClick={() => handleNavigate(currentUser ? 'home' : 'landing')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'home' || currentView === 'landing'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Home className="w-4 h-4" />
                  <span>{currentUser ? 'หน้าแรก (Home)' : 'แนะนำระบบ (Landing)'}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => handleNavigate('search')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'search'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Search className="w-4 h-4" />
                  <span>ค้นหาร้านค้า & เมนูอาหาร</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => handleNavigate('queue-tracking')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'queue-tracking'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Ticket className="w-4 h-4 text-amber-500" />
                  <span>บัตรคิวของฉัน (Live Queue)</span>
                </div>
                {activeQueue && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    {activeQueue.queueNumber}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  setIsCartOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-4 h-4 text-orange-500" />
                  <span>ตะกร้าสินค้า (Cart)</span>
                </div>
                {cartItemCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white">
                    {cartItemCount}
                  </span>
                )}
              </button>

              {currentUser && (
                <button
                  onClick={() => handleNavigate('user-profile')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentView === 'user-profile'
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4" />
                    <span>โปรไฟล์ & ประวัติคิว</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>
              )}

              {/* Chat & Messages Button */}
              <button
                onClick={() => {
                  handleNavigate('chat');
                  if (activeQueue) {
                    openChatPage(activeQueue.storeId);
                  } else {
                    openChatPage();
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentView === 'chat'
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <MessageSquare className={`w-4 h-4 ${currentView === 'chat' ? 'text-white' : 'text-orange-500'}`} />
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>แชท</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-normal ${
                        currentView === 'chat'
                          ? 'bg-white/20 text-white'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                      }`}
                    >
                      ร้านค้า & การจอง
                    </span>
                  </div>
                </div>

                {activeQueue ? (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      currentView === 'chat'
                        ? 'bg-white/25 text-white'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200'
                    }`}
                  >
                    #{activeQueue.queueNumber}
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                )}
              </button>
            </div>
          </div>

          {/* Merchant & Store Management Section */}
          <div className="pt-2 border-t border-stone-100 dark:border-zinc-800">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
              สำหรับผู้ขาย / ร้านค้า (Merchant)
            </span>
            <div className="mt-1.5 space-y-1">
              {(userStore || merchantStore) ? (
                <>
                  <button
                    onClick={() => {
                      const store = userStore || merchantStore;
                      if (store) openStoreAdmin(store.id);
                      handleNavigate('store-admin', '/store-admin');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      currentView === 'store-admin'
                        ? 'bg-emerald-600 text-white'
                        : 'text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Store className="w-4 h-4" />
                      <span className="truncate max-w-[150px]">{(userStore || merchantStore)?.name} (จัดการร้าน)</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  {/* แชทของร้าน (ตอบกลับลูกค้า) */}
                  <button
                    onClick={() => {
                      const store = userStore || merchantStore;
                      if (store) {
                        openChatPage(store.id);
                        openStoreChatPage(store.id);
                      } else {
                        openChatPage();
                      }
                      handleNavigate('chat', '/chat');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      currentView === 'chat' || currentView === 'store-chat'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : 'text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className={`w-4 h-4 ${currentView === 'chat' || currentView === 'store-chat' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                      <span>แชทของร้าน (ตอบกลับลูกค้า)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {unreadCustomerCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full font-mono font-bold text-[10px] animate-pulse ${
                          currentView === 'chat' || currentView === 'store-chat' ? 'bg-white text-emerald-800' : 'bg-red-500 text-white'
                        }`}>
                          {unreadCustomerCount}
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </div>
                  </button>

                  <button
                    onClick={() => handleNavigate('kds')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      currentView === 'kds'
                        ? 'bg-orange-500 text-white'
                        : 'text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ChefHat className="w-4 h-4 text-orange-500" />
                      <span>จอจัดการคิวในครัว (KDS)</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  <button
                    onClick={() => handleNavigate('merchant-dashboard')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      currentView === 'merchant-dashboard'
                        ? 'bg-orange-500 text-white'
                        : 'text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4" />
                      <span>แดชบอร์ดสรุปยอดขาย</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    openCreateStore();
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-zinc-800/80 hover:bg-orange-100 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>เปิดร้านค้าใหม่กับ QueueUp</span>
                </button>
              )}
            </div>
          </div>

          {/* Admin Section - Only visible to Super Admin (hi00000087@gmail.com) */}
          {isAdmin && (
            <div className="pt-2 border-t border-stone-100 dark:border-zinc-800">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                ผู้ดูแลระบบส่วนกลาง (Super Admin)
              </span>
              <div className="mt-1.5 space-y-1">
                <button
                  onClick={() => handleNavigate('admin-dashboard')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    currentView === 'admin-dashboard'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                      : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    <span>แดชบอร์ดการแอดมิน (Admin Panel)</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            </div>
          )}

          {/* Help & System Section */}
          <div className="pt-2 border-t border-stone-100 dark:border-zinc-800">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
              ความช่วยเหลือ & บริการ
            </span>
            <div className="mt-1.5 space-y-1">

              <button
                onClick={() => handleNavigate('about')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  currentView === 'about'
                    ? 'bg-orange-500 text-white font-bold shadow-xs'
                    : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  <span>เกี่ยวกับเรา (GE341511)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>

              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  setIsHelpModalOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <span>ช่วยเหลือ & เงื่อนไขบริการ</span>
              </button>

              {currentUser && (
                <button
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setIsAccountSettingsModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-stone-500" />
                  <span>ตั้งค่าบัญชีผู้ใช้</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Logout / Version */}
        <div className="p-3 border-t border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-950/30 flex items-center justify-between">
          <div className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">
            QueueUp v2.2 Production
          </div>
          {currentUser && (
            <button
              onClick={() => {
                logoutUser();
                setIsSidebarOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};
