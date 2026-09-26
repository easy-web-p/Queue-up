import React from 'react';
import { QueueStatus } from '../../types';
import { Clock, ChefHat, BellRing, CheckCircle2, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: QueueStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  className = ''
}) => {
  const configs: Record<QueueStatus, { label: string; icon: React.ReactNode; styles: string; dotColor: string }> = {
    DRAFT: {
      label: 'แบบร่าง',
      icon: <Clock className="w-3.5 h-3.5" />,
      styles: 'bg-slate-700/30 text-slate-300 border-slate-600/30',
      dotColor: 'bg-slate-400'
    },
    PAYMENT_PENDING: {
      label: 'รอชำระเงิน',
      icon: <Clock className="w-3.5 h-3.5" />,
      styles: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      dotColor: 'bg-amber-400'
    },
    PAID_AWAITING_MERCHANT: {
      label: 'ชำระแล้ว - รอร้านรับออเดอร์',
      icon: <Clock className="w-3.5 h-3.5 animate-pulse" />,
      styles: 'bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-sm font-semibold',
      dotColor: 'bg-orange-400 animate-ping'
    },
    MERCHANT_ACCEPTED: {
      label: 'ร้านรับออเดอร์แล้ว',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      styles: 'bg-blue-500/15 text-blue-300 border-blue-500/30 font-semibold',
      dotColor: 'bg-blue-400'
    },
    PREPARING: {
      label: 'กำลังปรุงอาหาร',
      icon: <ChefHat className="w-3.5 h-3.5 animate-pulse" />,
      styles: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      dotColor: 'bg-sky-400 animate-ping'
    },
    READY: {
      label: 'พร้อมรับอาหารแล้ว',
      icon: <BellRing className="w-3.5 h-3.5 animate-bounce" />,
      styles: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20 font-bold',
      dotColor: 'bg-emerald-400'
    },
    READY_FOR_PICKUP: {
      label: 'พร้อมรับอาหารแล้ว',
      icon: <BellRing className="w-3.5 h-3.5 animate-bounce" />,
      styles: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20 font-bold',
      dotColor: 'bg-emerald-400'
    },
    COMPLETED: {
      label: 'เสร็จสิ้น',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      styles: 'bg-slate-800/60 text-slate-400 border-slate-700/60',
      dotColor: 'bg-slate-500'
    },
    MERCHANT_REJECTED: {
      label: 'ร้านปฏิเสธ (ระบบคืนเงินแล้ว)',
      icon: <XCircle className="w-3.5 h-3.5" />,
      styles: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold',
      dotColor: 'bg-rose-400'
    },
    CUSTOMER_CANCELLED: {
      label: 'ลูกค้ายกเลิก',
      icon: <XCircle className="w-3.5 h-3.5" />,
      styles: 'bg-slate-800/60 text-slate-400 border-slate-700/60',
      dotColor: 'bg-slate-500'
    },
    CANCELLED: {
      label: 'ยกเลิกแล้ว',
      icon: <XCircle className="w-3.5 h-3.5" />,
      styles: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      dotColor: 'bg-rose-400'
    },
    EXPIRED: {
      label: 'หมดเวลาตอบรับ (ระบบคืนเงินแล้ว)',
      icon: <Clock className="w-3.5 h-3.5" />,
      styles: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/40',
      dotColor: 'bg-zinc-500'
    }
  };

  const config = configs[status] || configs.PAYMENT_PENDING;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-3 py-1 text-xs font-semibold gap-2',
    lg: 'px-4 py-1.5 text-sm font-bold gap-2.5'
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border backdrop-blur-sm whitespace-nowrap ${config.styles} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {showIcon && <span className="shrink-0">{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
};
