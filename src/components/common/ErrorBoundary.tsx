import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home, ChevronDown } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    showDetails: true
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleReload = () => {
    try {
      window.location.href = window.location.pathname + '?_t=' + Date.now();
    } catch {
      window.location.reload();
    }
  };

  public handleClearCacheAndReset = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Clear chat & orders caches that might have had bad JSON
        localStorage.removeItem('queueup_merchant_customer_threads_v1');
        localStorage.removeItem('queueup_store_chats_v2');
        localStorage.removeItem('queueup_orders_v1');
        localStorage.removeItem('queueup_notifications_v1');
      }
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.clear();
      }
    } catch (e) {
      console.warn('Could not clear localStorage:', e);
    }
    window.location.href = '/?_reset=' + Date.now();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="p-4 bg-red-950/60 border border-red-800 text-red-400 rounded-3xl mb-5 shadow-lg">
            <AlertTriangle className="w-14 h-14" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white mb-3">
            เกิดข้อผิดพลาดในการแสดงผล
          </h1>

          <p className="text-stone-300 text-sm max-w-lg mb-6 leading-relaxed">
            ระบบตรวจพบความขัดข้องชั่วคราวในการโหลดหน้าจอ คุณสามารถรีเฟรชหน้าเว็บ หรือล้างข้อมูลแคชชั่วคราวเพื่อกลับเข้าสู่ระบบได้ทันที
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <button
              onClick={this.handleReload}
              className="px-5 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-4 h-4" /> รีเฟรชหน้านี้
            </button>

            <button
              onClick={this.handleClearCacheAndReset}
              className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-2xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Trash2 className="w-4 h-4 text-amber-400" /> ล้างแคชและเริ่มใหม่
            </button>

            <a
              href="/"
              className="px-5 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-2xl text-sm font-semibold flex items-center gap-2 transition-all"
            >
              <Home className="w-4 h-4" /> กลับสู่หน้าหลัก
            </a>
          </div>

          {/* Technical Details Toggle */}
          {this.state.error && (
            <div className="w-full max-w-xl text-left">
              <button
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                className="text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1 mx-auto mb-2 cursor-pointer"
              >
                <span>รายละเอียดข้อผิดพลาด (Technical Details)</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${this.state.showDetails ? 'rotate-180' : ''}`} />
              </button>

              {this.state.showDetails && (
                <div className="p-4 bg-black/60 rounded-2xl border border-zinc-800 text-left font-mono text-xs text-red-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  <div className="font-bold text-red-400 mb-1">{this.state.error.name}: {this.state.error.message}</div>
                  <div className="text-[11px] text-zinc-400">{this.state.error.stack}</div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
