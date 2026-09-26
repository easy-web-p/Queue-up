import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'outline';
  size?: 'sm' | 'md';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  icon
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium'
  }[size];

  const variantClasses = {
    default: 'bg-orange-50 text-stone-700 border border-orange-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800',
    primary: 'bg-orange-100 text-orange-800 border border-orange-300 font-semibold dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40',
    warning: 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/40',
    danger: 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40',
    info: 'bg-sky-50 text-sky-800 border border-sky-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40',
    outline: 'bg-transparent text-stone-700 border border-orange-300 dark:text-zinc-300 dark:border-zinc-700'
  }[variant];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full whitespace-nowrap ${sizeClasses} ${variantClasses} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
