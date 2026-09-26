import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5',
    md: 'px-4 py-2.5 text-sm font-semibold rounded-xl gap-2',
    lg: 'px-6 py-3.5 text-base font-semibold rounded-2xl gap-2.5'
  }[size];

  const variantClasses = {
    // Light: Orange-Amber-Red gradient with pure White text
    // Dark: High-contrast Luminous Solar Orange with sharp black text & standout glow
    primary: 'bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 hover:from-orange-600 hover:via-amber-600 hover:to-red-600 text-white font-bold shadow-md shadow-orange-500/25 active:scale-[0.98] transition-all dark:from-orange-500 dark:via-orange-400 dark:to-amber-400 dark:text-black dark:font-black dark:shadow-orange-500/30',
    secondary: 'bg-orange-50/90 hover:bg-orange-100 text-stone-900 border border-orange-200/90 active:scale-[0.98] transition-all dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-800',
    outline: 'bg-white/80 hover:bg-orange-50/60 text-stone-800 border border-orange-300 hover:border-orange-500 transition-all dark:bg-transparent dark:hover:bg-zinc-900/80 dark:text-zinc-200 dark:border-zinc-800 dark:hover:border-zinc-700',
    ghost: 'bg-transparent hover:bg-orange-100/60 text-stone-700 hover:text-stone-950 transition-all dark:hover:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
    danger: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-300 dark:border-red-800/60'
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span className="whitespace-nowrap">{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};
