import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, ShieldCheck, Heart, Cookie, Mail, UserPlus, Sparkles, UtensilsCrossed } from 'lucide-react';
import { useQueue } from '../../context/QueueContext';

export const Footer: React.FC = () => {
  const { setCurrentView, setIsRegisterModalOpen } = useQueue();
  const navigate = useNavigate();

  const handleOpenCookieSettings = () => {
    window.dispatchEvent(new CustomEvent('open-cookie-preferences'));
  };

  const handleScrollToContact = () => {
    setCurrentView('landing');
    setTimeout(() => {
      const elem = document.getElementById('contact-developer');
      elem?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleGoToAbout = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentView('about');
    navigate('/about');
  };

  return (
    <footer className="w-full border-t border-orange-200/80 bg-orange-50/50 py-8 sm:py-10 text-stone-600 text-xs mt-auto dark:border-zinc-800/80 dark:bg-black dark:text-zinc-400 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
        {/* Top Row: Brand & Quick Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-orange-200/60 dark:border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-xs">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-stone-900 dark:text-zinc-100">
              Queue<span className="text-orange-600 dark:text-orange-400">Up</span>
            </span>
            <span className="text-stone-400 dark:text-zinc-600">•</span>
            <span className="text-stone-600 dark:text-zinc-400">ระบบจัดการคิวและสั่งอาหารล่วงหน้าดิจิทัล</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-stone-600 dark:text-zinc-400">
            <a
              href="/about"
              onClick={handleGoToAbout}
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors flex items-center gap-1 cursor-pointer no-underline text-stone-600 dark:text-zinc-400"
            >
              <Sparkles className="w-3 h-3 text-orange-500" />
              <span>เกี่ยวกับเรา (GE341511)</span>
            </a>
            <button
              onClick={() => setCurrentView('landing')}
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>ภาพรวมระบบ</span>
            </button>
            <button
              onClick={() => setCurrentView('home')}
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <UtensilsCrossed className="w-3 h-3" />
              <span>สั่งอาหารโรงอาหาร</span>
            </button>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="hover:text-orange-700 dark:hover:text-orange-400 transition-colors flex items-center gap-1 text-orange-600 font-bold cursor-pointer"
            >
              <UserPlus className="w-3 h-3" />
              <span>สมัครสมาชิก</span>
            </button>
            <button
              onClick={handleScrollToContact}
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Mail className="w-3 h-3" />
              <span>ติดต่อผู้พัฒนา</span>
            </button>
            <button
              onClick={handleOpenCookieSettings}
              className="hover:text-amber-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-1 cursor-pointer"
              title="เปิดการตั้งค่าคุกกี้"
            >
              <Cookie className="w-3 h-3 text-amber-500" />
              <span>ตั้งค่าคุกกี้ (PDPA)</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: System info & Credits */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-stone-500 dark:text-zinc-500 text-[11px]">
          <div className="flex items-center gap-3">
            <span>© {new Date().getFullYear()} QueueUp Engineering Team. All rights reserved.</span>
            <span>•</span>
            <span className="text-stone-600 dark:text-zinc-400">Bangkok, Thailand</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" /> Real-time KDS Sync
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              Made with <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> for Smart Campus Dining
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
