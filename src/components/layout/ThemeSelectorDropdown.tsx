import React from 'react';
import { useQueue } from '../../context/QueueContext';
import { Sun, Moon, Clock } from 'lucide-react';

interface ThemeSelectorDropdownProps {
  className?: string;
}

export const ThemeSelectorDropdown: React.FC<ThemeSelectorDropdownProps> = ({ className }) => {
  const { themeMode, toggleTheme } = useQueue();

  return (
    <button
      onClick={toggleTheme}
      className={`p-2.5 rounded-xl border border-stone-200/90 hover:border-orange-300 bg-white hover:bg-orange-50/80 text-stone-800 transition-all cursor-pointer dark:bg-zinc-900/90 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-200 active:scale-95 shadow-2xs flex items-center justify-center ${className || ''}`}
      aria-label="เปลี่ยนโหมดสี (สว่าง / มืด / ออโต้)"
      title="เปลี่ยนโหมดสี"
    >
      {themeMode === 'auto' ? (
        <Clock className="w-4 h-4 text-orange-500 animate-in zoom-in-75 duration-150" />
      ) : themeMode === 'dark' ? (
        <Moon className="w-4 h-4 text-amber-400 animate-in zoom-in-75 duration-150" />
      ) : (
        <Sun className="w-4 h-4 text-amber-500 animate-in zoom-in-75 duration-150" />
      )}
    </button>
  );
};
