import { Link, useLocation } from 'react-router-dom';
import { QueueUpLogo } from './QueueUpLogo.tsx';
import { Tv, ShieldHeart, Utensils, Store, Home } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();

  const navItems = [
    { path: '/home', label: 'โรงอาหาร', icon: Home },
    { path: '/food-booking', label: 'จองคิวอาหาร', icon: Utensils },
    { path: '/campus/monitor', label: 'จอมอนิเตอร์คิว', icon: Tv },
    { path: '/guardian', label: 'ผู้ปกครอง', icon: ShieldHeart },
    { path: '/merchant/dashboard', label: 'ร้านค้า', icon: Store }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 font-['Kanit']">
      {/* Brand accent top stripe */}
      <div className="h-[3px] w-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-400" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          {/* Logo & Branding */}
          <Link
            to="/home"
            className="flex items-center gap-2 group cursor-pointer"
          >
            <QueueUpLogo textSize="sm" lightText={false} />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
