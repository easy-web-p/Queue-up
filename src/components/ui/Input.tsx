import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 text-stone-400 dark:text-zinc-500 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full rounded-xl bg-white border text-stone-900 text-sm placeholder:text-stone-400 py-2.5 transition-all focus:outline-none focus:ring-2 dark:bg-black dark:text-zinc-100 dark:placeholder:text-zinc-500 ${
            leftIcon ? 'pl-10' : 'pl-3.5'
          } ${rightIcon ? 'pr-10' : 'pr-3.5'} ${
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500'
              : 'border-orange-200 focus:border-orange-500 focus:ring-orange-500/30 dark:border-zinc-800 dark:focus:border-orange-500'
          } ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 text-stone-400 dark:text-zinc-500">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <span className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</span>}
      {!error && helperText && <span className="text-xs text-stone-500 dark:text-zinc-500">{helperText}</span>}
    </div>
  );
};
