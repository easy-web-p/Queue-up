/* eslint-disable react-refresh/only-export-components */
/**
 * 🔔 Toast notifications — the in-app replacement for window.alert().
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ToastTone;
}

export interface ToastApi {
  success: (message: string, options?: any) => void;
  error: (message: string, options?: any) => void;
  warning: (message: string, options?: any) => void;
  info: (message: string, options?: any) => void;
  dismiss: (id: number) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE: Record<ToastTone, {
  icon: any;
  ring: string;
  bg: string;
  fg: string;
  iconFg: string;
}> = {
  success: {
    icon: CheckCircle2,
    ring: 'border-emerald-400 dark:border-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    fg: 'text-emerald-900 dark:text-emerald-200',
    iconFg: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: AlertCircle,
    ring: 'border-red-400 dark:border-red-600',
    bg: 'bg-red-50 dark:bg-red-950/60',
    fg: 'text-red-900 dark:text-red-200',
    iconFg: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'border-amber-400 dark:border-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    fg: 'text-amber-900 dark:text-amber-200',
    iconFg: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    ring: 'border-[#FF7A1A]/50',
    bg: 'bg-white dark:bg-[#241C16]',
    fg: 'text-slate-800 dark:text-[#E5E7EB]',
    iconFg: 'text-[#FF7A1A]',
  },
};

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
}

interface DialogState {
  title?: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const nextId = useRef(0);
  const dialogResolver = useRef<((val: boolean) => void) | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, { duration = 4000 } = {}) => {
      const id = ++nextId.current;
      setToasts((prev) => [...prev, { id, message, tone, duration }]);
      if (duration > 0 && tone !== 'error') {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const confirm = useCallback(
    ({ title, message, confirmLabel = 'ยืนยัน', cancelLabel = 'ยกเลิก', tone = 'warning' }: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        dialogResolver.current = resolve;
        setDialog({ title, message, confirmLabel, cancelLabel, tone });
      }),
    []
  );

  const closeDialog = useCallback((result: boolean) => {
    setDialog(null);
    const resolve = dialogResolver.current;
    dialogResolver.current = null;
    if (resolve) resolve(result);
  }, []);

  const api: ToastApi = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      warning: (m, o) => push('warning', m, o),
      info: (m, o) => push('info', m, o),
      dismiss,
      confirm,
    }),
    [push, dismiss, confirm]
  );

  const dialogTone = dialog ? TONE[dialog.tone] || TONE.warning : null;
  const DialogIcon = dialogTone?.icon;

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Live region for accessibility */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-[99999990] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => {
          const tone = TONE[t.tone] || TONE.info;
          const Icon = tone.icon;
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border-2 px-4 py-3 shadow-lg font-['IBM_Plex_Sans_Thai'] ${tone.ring} ${tone.bg} ${tone.fg}`}
            >
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${tone.iconFg}`} aria-hidden="true" />
              <p className="text-xs font-bold leading-relaxed flex-1 whitespace-pre-line">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="ปิดการแจ้งเตือน"
                className="shrink-0 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {dialog && (
        <div
          className="fixed inset-0 z-[99999995] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="toast-dialog-title"
          onClick={() => closeDialog(false)}
        >
          <div
            className="bg-white dark:bg-[#241C16] border-2 border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 font-['IBM_Plex_Sans_Thai']"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {DialogIcon && (
                <DialogIcon className={`w-6 h-6 shrink-0 mt-0.5 ${dialogTone.iconFg}`} aria-hidden="true" />
              )}
              <div>
                {dialog.title && (
                  <h2
                    id="toast-dialog-title"
                    className="text-base font-black font-['Kanit'] text-slate-900 dark:text-white"
                  >
                    {dialog.title}
                  </h2>
                )}
                {dialog.message && (
                  <p className="text-xs text-slate-600 dark:text-[#9CA3AF] mt-1 leading-relaxed whitespace-pre-line">
                    {dialog.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                autoFocus
                onClick={() => closeDialog(false)}
                className="flex-1 min-w-[120px] py-3 bg-slate-100 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#E5E7EB] font-bold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                {dialog.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => closeDialog(true)}
                className={`flex-1 min-w-[120px] py-3 font-bold text-xs rounded-xl text-white transition-colors cursor-pointer ${
                  dialog.tone === 'error' || dialog.tone === 'warning'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-[#FF7A1A] hover:bg-[#E6680D]'
                }`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return (
    ctx || {
      success: (m) => window.alert(m),
      error: (m) => window.alert(m),
      warning: (m) => window.alert(m),
      info: (m) => window.alert(m),
      dismiss: () => {},
      confirm: async (opt) => window.confirm(opt.message || opt.title || 'ยืนยันหรือไม่?'),
    }
  );
}

export default ToastProvider;
