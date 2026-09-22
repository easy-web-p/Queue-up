/**
 * Types for ToastProvider.jsx.
 *
 * Without these, TypeScript inferred the whole API from the fallback object in
 * useToast() — `(m) => window.alert(m)` and a confirm taking only {title,
 * message} — so every call that passed a duration or a confirmLabel was a type
 * error even though the real implementation has accepted both all along. The
 * fallback is a degraded path, not the contract.
 */

import type { ReactNode } from 'react';

export interface ToastOptions {
  /**
   * How long the toast stays, in milliseconds. Default 5000.
   *
   * Ignored for the `error` tone: errors stay until dismissed, because they
   * usually carry something the reader has to act on and a message that
   * vanishes mid-read is worse than none.
   */
  duration?: number;
}

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Text on the confirming button. Default "ยืนยัน". */
  confirmLabel?: string;
  /** Text on the dismissing button. Default "ยกเลิก". */
  cancelLabel?: string;
  /** Colours the dialog. Use `error` for anything destructive. Default "warning". */
  tone?: ToastTone;
}

export interface ToastApi {
  success(message: string, options?: ToastOptions): number | null;
  error(message: string, options?: ToastOptions): number | null;
  warning(message: string, options?: ToastOptions): number | null;
  info(message: string, options?: ToastOptions): number | null;
  dismiss(id: number): void;
  /** Resolves true if the reader confirmed, false if they dismissed it. */
  confirm(options: ConfirmOptions): Promise<boolean>;
}

export declare function ToastProvider(props: { children?: ReactNode }): JSX.Element;

/**
 * The toast API for the surrounding provider.
 *
 * Outside a provider this falls back to window.alert / window.confirm, so a
 * component rendered in isolation still communicates rather than throwing.
 */
export declare function useToast(): ToastApi;
