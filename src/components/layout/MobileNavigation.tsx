import React from 'react';
import { useQueue } from '../../context/QueueContext';
import { Home, Search, ShoppingBag, User, MessageSquare } from 'lucide-react';

export const MobileNavigation: React.FC = () => {
  const { currentView, setCurrentView, cartItemCount, setIsCartOpen, openUserProfile, currentUser, openChatPage } = useQueue();

  if (currentView === 'landing' || !currentUser) {
    return null;
  }

  const handleHomeClick = () => {
    if (currentUser) {
      setCurrentView('home');
    } else {
      setCurrentView('landing');
    }
  };

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 border-t border-orange-200 backdrop-blur-xl px-2 py-1.5 flex items-center justify-around shadow-2xl dark:bg-black/95 dark:border-zinc-800 transition-colors">
      <button
        onClick={handleHomeClick}
        className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
          currentView === 'home'
            ? 'text-orange-600 font-bold dark:text-orange-400'
            : 'text-stone-500 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-300'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-0.5">หน้าแรก</span>
      </button>

      <button
        onClick={() => setCurrentView('search')}
        className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
          currentView === 'search'
            ? 'text-orange-600 font-bold dark:text-orange-400'
            : 'text-stone-500 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-300'
        }`}
      >
        <Search className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-0.5">ค้นหา</span>
      </button>

      <button
        onClick={() => openChatPage()}
        className={`relative flex flex-col items-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
          currentView === 'chat'
            ? 'text-orange-600 font-bold dark:text-orange-400'
            : 'text-stone-500 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-300'
        }`}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-0.5">แชท</span>
        <span className="absolute top-1 right-3 w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
      </button>

      <button
        onClick={() => setIsCartOpen(true)}
        className="relative flex flex-col items-center py-1 px-3 rounded-xl text-stone-500 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-300 cursor-pointer"
      >
        <ShoppingBag className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-0.5">ตะกร้า</span>
        {cartItemCount > 0 && (
          <span className="absolute top-0 right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
            {cartItemCount}
          </span>
        )}
      </button>

      <button
        onClick={() => openUserProfile()}
        className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
          currentView === 'user-profile'
            ? 'text-orange-600 font-bold dark:text-orange-400'
            : 'text-stone-500 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-zinc-300'
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-0.5">โปรไฟล์</span>
      </button>
    </div>
  );
};
