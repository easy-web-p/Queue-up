import React from 'react';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  isPositive = true,
  icon,
  subtitle
}) => {
  return (
    <Card variant="glass" padding="md" className="flex flex-col justify-between transition-all hover:border-orange-300 dark:hover:border-zinc-700 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-xs font-bold text-stone-700 dark:text-zinc-300 tracking-wide">{title}</span>
        <div className="w-10 h-10 rounded-2xl bg-stone-100 dark:bg-zinc-800/90 border border-stone-200 dark:border-zinc-700/60 flex items-center justify-center shrink-0 shadow-xs">
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-stone-900 dark:text-white">
          {value}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs flex-wrap">
          {change && (
            <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
              isPositive
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                : 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
            }`}>
              {change}
            </span>
          )}
          {subtitle && <span className="text-stone-600 dark:text-zinc-400 text-xs font-medium">{subtitle}</span>}
        </div>
      </div>
    </Card>
  );
};
