import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'elevated' | 'solid' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'glass',
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6 sm:p-7'
  }[padding];

  const variantClasses = {
    glass: 'bg-white/95 backdrop-blur-xl border border-orange-200/80 shadow-md shadow-orange-500/5 text-stone-900 dark:bg-black/90 dark:border-zinc-800/80 dark:shadow-xl dark:shadow-black/40 dark:text-zinc-100',
    elevated: 'bg-white backdrop-blur-xl border border-orange-200 shadow-xl shadow-orange-500/8 text-stone-900 dark:bg-[#0a0a0c] dark:border-zinc-800 dark:shadow-2xl dark:shadow-black/60 dark:text-zinc-100',
    solid: 'bg-white border border-orange-200/90 shadow-sm text-stone-900 dark:bg-black dark:border-zinc-800/80 dark:text-zinc-100',
    interactive: 'bg-white hover:bg-orange-50/50 backdrop-blur-xl border border-orange-200/80 hover:border-orange-400 hover:shadow-xl shadow-md text-stone-900 transition-all duration-200 cursor-pointer active:scale-[0.99] dark:bg-black/85 dark:hover:bg-zinc-950 dark:border-zinc-800/80 dark:hover:border-zinc-700 dark:text-zinc-100'
  }[variant];

  return (
    <div
      className={`rounded-2xl overflow-hidden ${variantClasses} ${paddingClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
