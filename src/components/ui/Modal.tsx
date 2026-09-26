import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth,
  size
}) => {
  const effectiveSize = size || maxWidth || 'md';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }[effectiveSize];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal dialog */}
      <div
        className={`relative w-full ${maxWidthClass} bg-white text-stone-900 dark:bg-zinc-950 dark:text-zinc-100 border border-orange-200/90 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200`}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-orange-100 dark:border-zinc-800 bg-orange-50/50 dark:bg-black/60">
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">{title}</h3>
            <IconButton
              ariaLabel="ปิดหน้าต่าง"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="w-5 h-5 text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200" />
            </IconButton>
          </div>
        )}
        <div className="overflow-y-auto p-6 scrollbar-none">
          {children}
        </div>
      </div>
    </div>
  );
};
