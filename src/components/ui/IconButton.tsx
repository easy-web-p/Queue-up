import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  ariaLabel: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  ariaLabel,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-sm',
    md: 'w-10 h-10 rounded-xl text-base',
    lg: 'w-12 h-12 rounded-2xl text-lg'
  }[size];

  const variantClasses = {
    primary: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-sm active:scale-95 transition-all dark:from-orange-500 dark:to-amber-400 dark:text-black',
    secondary: 'bg-orange-50/90 hover:bg-orange-100 text-stone-800 border border-orange-200 active:scale-95 transition-all dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-800',
    ghost: 'bg-transparent hover:bg-orange-100/70 text-stone-600 hover:text-stone-900 transition-all dark:hover:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
    outline: 'bg-white hover:bg-orange-50/50 border border-orange-200 hover:border-orange-400 text-stone-700 transition-all dark:bg-transparent dark:border-zinc-800 dark:hover:border-zinc-700 dark:text-zinc-300',
    glass: 'bg-white/80 backdrop-blur-md border border-orange-200/80 text-stone-800 hover:bg-white transition-all dark:bg-zinc-900/80 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-zinc-800'
  }[variant];

  return (
    <button
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
