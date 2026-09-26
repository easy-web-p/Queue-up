import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import { NotificationDropdown } from './NotificationDropdown';
import { UserProfileDropdown } from './UserProfileDropdown';
import { ThemeSelectorDropdown } from './ThemeSelectorDropdown';
import {
  Layers,
  ShoppingBag,
  Ticket,
  PlusCircle,
  HelpCircle,
  Search,
  Store,
  Menu,
  MessageSquare,
  LogIn,
  Sparkles
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    cart,
    setIsCartOpen,
    userActiveQueue,
    activeQueueId,
    setActiveQueueId,
    setIsCreateStoreModalOpen,
    setIsHelpModalOpen,
    setIsRegisterModalOpen,
    userStore,
    openCreateStore,
    openStoreAdmin,
    role,
    currentUser,
    setIsSidebarOpen,
    openChatPage
  } = useQueue();

  const navigate = useNavigate();

  const handleLogoClick = () => {
    if (currentUser) {
      setCurrentView('home');
    } else {
      setCurrentView('landing');
    }
  };

  const handleGoToAbout = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentView('about');
    navigate('/about');
  };

  const activeQueue = userActiveQueue;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-orange-200/80 bg-white/95 text-stone-900 dark:border-zinc-800/80 dark:bg-black/90 dark:text-zinc-100 backdrop-blur-xl transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left: Hamburger Menu Button + Brand Logo & App Name */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentUser && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 sm:p-2.5 rounded-xl border border-orange-200 hover:border-orange-400 bg-orange-50/70 hover:bg-orange-100/80 text-orange-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center"
              title="เปิดเมนูด้านข้าง (Sidebar Menu)"
              aria-label="เปิดเมนูด้านข้าง"
            >
              <Menu className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </button>
          )}

          <div
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 cursor-pointer group"
            title={currentUser ? "ไปที่หน้าแรก Homepage (เข้าสู่ระบบแล้ว)" : "ไปที่หน้า Landing Page"}
          >
            {/* Logo in Orange/Amber Circle */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Layers className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            {/* App Name */}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-stone-900 dark:text-zinc-100 font-sans">
                  Queue<span className="text-orange-600 dark:text-orange-400">Up</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40">
                  LIVE
                </span>
              </div>
              <p className="text-[10px] text-stone-500 dark:text-zinc-400 hidden sm:block">
                Smart Food & Queue Platform
              </p>
            </div>
          </div>
        </div>

        {/* Right side controls: Clean, high craftsmanship, responsive */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
          {!currentUser ? (
            <>
              {/* 1. ปุ่มเข้าสู่ระบบ / สมัครสมาชิก (Orange Gradient Pill) */}
              <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-black bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/25 active:scale-95 transition-all cursor-pointer"
                title="เข้าสู่ระบบหรือลงทะเบียนเพื่อสั่งอาหาร"
              >
                <LogIn className="w-4 h-4 shrink-0 stroke-[2.5]" />
                <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
              </button>

              {/* 2. ปุ่มเกี่ยวกับเรา (Outline Pill) */}
              <a
                href="/about"
                onClick={handleGoToAbout}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold border border-stone-200/90 hover:border-orange-300 bg-white hover:bg-orange-50/60 text-stone-700 hover:text-stone-900 dark:bg-zinc-900/90 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all cursor-pointer no-underline shadow-2xs"
                title="เกี่ยวกับเรา และรายงานโครงการ"
              >
                <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
                <span>เกี่ยวกับเรา</span>
              </a>

              {/* 3. ปุ่มช่วยเหลือ (Outline Pill) */}
              <button
                onClick={() => setIsHelpModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold border border-stone-200/90 hover:border-orange-300 bg-white hover:bg-orange-50/60 text-stone-700 hover:text-stone-900 dark:bg-zinc-900/90 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-2xs"
                title="ระบบช่วยเหลือผู้ใช้งาน"
              >
                <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>ช่วยเหลือ</span>
              </button>

              {/* 4. ปุ่มสลับธีม (Circular Button) */}
              <div className="flex items-center">
                <ThemeSelectorDropdown className="rounded-full! p-2.5!" />
              </div>
            </>
          ) : (
            <>
              {/* Quick Search trigger - hidden on mobile, shown on md+ */}
              <button
                onClick={() => setCurrentView('search')}
                className={`hidden md:flex p-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer items-center gap-1.5 ${
                  currentView === 'search'
                    ? 'bg-orange-100/80 border-orange-400 text-orange-800 dark:bg-zinc-800 dark:border-orange-500 dark:text-orange-400'
                    : 'bg-white hover:bg-orange-50/80 border-orange-200 text-stone-700 hover:text-stone-950 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-300'
                }`}
                title="ค้นหาอาหารหรือร้านค้า"
              >
                <Search className="w-4 h-4 text-orange-500 shrink-0" />
                <span>ค้นหา</span>
              </button>

              {/* Queue Button / Active Queue Ticket Pill - Always visible on mobile and desktop */}
              {activeQueue ? (
                <button
                  onClick={() => {
                    setActiveQueueId(activeQueue.id);
                    setCurrentView('queue-tracking');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs active:scale-95 ${
                    currentView === 'queue-tracking'
                      ? 'bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-400/30 dark:bg-zinc-900 dark:border-amber-400 dark:text-amber-300'
                      : 'bg-white hover:bg-amber-50 border-amber-300 text-amber-800 dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:border-zinc-800 dark:text-amber-400'
                  }`}
                  title={`ดูบัตรคิว ${activeQueue.queueNumber}`}
                >
                  <Ticket className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
                  <span className="font-mono text-xs font-extrabold">คิว {activeQueue.queueNumber}</span>
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping shrink-0" />
                </button>
              ) : (
                <button
                  onClick={() => setCurrentView('queue-tracking')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-95 ${
                    currentView === 'queue-tracking'
                      ? 'bg-amber-100 border-amber-400 text-amber-900 dark:bg-zinc-900 dark:border-amber-400 dark:text-amber-300'
                      : 'bg-white hover:bg-orange-50 border-orange-200 text-stone-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300'
                  }`}
                  title="ดูคิวของฉัน"
                >
                  <Ticket className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-xs">คิวของฉัน</span>
                </button>
              )}

              {/* ปุ่มกระดิ่งแจ้งเตือน */}
              <NotificationDropdown />

              {/* ปุ่มร้านของฉัน / สร้างร้านค้า */}
              <div className="hidden lg:flex items-center">
                {userStore ? (
                  <button
                    onClick={() => openStoreAdmin(userStore.id)}
                    className="flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold border border-emerald-300/90 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-700/60 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition-all cursor-pointer shadow-sm group active:scale-95"
                    title={`เข้าสู่ระบบแอดมิน: ${userStore.name}`}
                  >
                    <img
                      src={userStore.logo || userStore.image}
                      alt={userStore.name}
                      className="w-6 h-6 rounded-lg object-cover border border-emerald-300 dark:border-emerald-600 shrink-0 group-hover:scale-105 transition-transform"
                    />
                    <div className="flex flex-col text-left leading-tight">
                      <span className="font-black text-stone-900 dark:text-white max-w-[110px] lg:max-w-[130px] truncate text-xs">
                        {userStore.name}
                      </span>
                      <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-medium">
                        ร้านของฉัน • แอดมิน
                      </span>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={openCreateStore}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold border border-orange-300/80 bg-orange-50/70 hover:bg-orange-100 text-orange-800 dark:bg-zinc-900/90 dark:border-zinc-700 dark:text-orange-400 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="สร้างร้านค้าและลงทะเบียนเปิดร้านใหม่"
                  >
                    <PlusCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                    <span>สร้างร้านค้า</span>
                  </button>
                )}
              </div>

              {/* ปุ่มช่วยเหลือ */}
              <button
                onClick={() => setIsHelpModalOpen(true)}
                className="hidden lg:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold border border-orange-200 bg-white hover:bg-orange-50 text-stone-700 dark:bg-zinc-900/90 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                title="ระบบช่วยเหลือผู้ใช้งาน & คู่มือสั่งอาหาร"
              >
                <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>ช่วยเหลือ</span>
              </button>

              {/* ตะกร้าสินค้า */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="hidden sm:flex relative p-2.5 rounded-xl bg-white hover:bg-orange-50 border border-orange-200 text-stone-800 transition-colors cursor-pointer dark:bg-zinc-900/90 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-200"
                title="เปิดตะกร้าสินค้า"
                aria-label="เปิดตะกร้าสินค้า"
              >
                <ShoppingBag className="w-4 h-4" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-in zoom-in">
                    {cartItemCount}
                  </span>
                )}
              </button>

              {/* โหมดเปลี่ยนสี */}
              <div className="hidden md:block">
                <ThemeSelectorDropdown />
              </div>

              {/* Circular User Profile Avatar */}
              <div className="hidden sm:block">
                <UserProfileDropdown />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
