import React from 'react';
import { Order, QueueStatus } from '../types';
import { ChefHat, CheckCircle2, Phone, Sparkles, Flame, Clock, Wallet, DollarSign, MessageSquare } from 'lucide-react';
import { soundManager } from '../utils/audioNotification.js';

interface Props {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, newStatus: QueueStatus) => void;
}

export const MerchantKDS: React.FC<Props> = ({
  orders,
  onUpdateOrderStatus,
}) => {
  const pendingOrders = orders.filter((o) => o.status === 'PENDING' || (o.queueStatus === 'waiting' && o.status !== 'CONFIRMED'));
  const confirmedOrders = orders.filter((o) => o.status === 'CONFIRMED' || (o.queueStatus === 'confirmed'));
  const cookingOrders = orders.filter((o) => o.status === 'PREPARING' || o.queueStatus === 'cooking');
  const readyOrders = orders.filter((o) => o.status === 'READY' || o.queueStatus === 'ready');

  const renderOrderCard = (order: Order, nextStatus: QueueStatus, btnLabel: string, btnIcon: React.ReactNode, btnClass: string, soundAction: () => void) => {
    const isCampusWallet = (order as any).paymentMode === 'CAMPUS_WALLET';
    const isPaid = isCampusWallet || (order as any).paymentStatus === 'PAID';

    return (
      <div
        key={order.id}
        className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 transition-all hover:shadow-md"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black font-['JetBrains_Mono'] text-orange-600 block">
                คิว #{order.queueNumber}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isPaid
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {isPaid ? '💳 Wallet (จ่ายแล้ว)' : '⚡ จ่ายหน้าร้าน'}
              </span>
            </div>
            <span className="text-xs font-bold text-slate-800 mt-1 block">
              {order.customerName}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1 font-['JetBrains_Mono']">
              <Clock className="w-3 h-3 text-red-600" />
              {order.pickupTime || '--:--'} น.
            </span>
          </div>
        </div>

        {/* Item list */}
        <div className="space-y-1.5 text-xs text-slate-700 py-1 max-h-32 overflow-y-auto">
          {(order.items || []).map((it: any, idx: number) => (
            <div key={idx} className="flex justify-between items-start border-b border-slate-50 pb-1">
              <div>
                <span className="font-bold text-slate-900">{it.name}</span>
                <span className="text-slate-500 font-semibold ml-1">x{it.quantity}</span>
                {Array.isArray(it.selectedModifiers) && it.selectedModifiers.length > 0 && (
                  <div className="text-[10px] text-slate-500">
                    {it.selectedModifiers.map((m: any) => m.name || m.optionId).join(', ')}
                  </div>
                )}
                {it.customNotes && (
                  <div className="text-[10px] text-amber-700 italic">คำขอ: {it.customNotes}</div>
                )}
              </div>
              <span className="font-semibold text-slate-600 font-['JetBrains_Mono'] shrink-0">
                ฿{(it.subtotal || it.unitPrice * it.quantity || 0).toFixed(0)}
              </span>
            </div>
          ))}
        </div>

        {/* Total & Action */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs font-black text-slate-900">
            รวม: ฿{(Number(order.totalAmount) || 0).toFixed(2)}
          </div>
          {order.customerPhone && (
            <a
              href={`tel:${order.customerPhone}`}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg bg-slate-50 hover:bg-slate-100"
              title="โทรติดต่อลูกค้า"
            >
              <Phone className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <button
          onClick={() => {
            onUpdateOrderStatus(order.id, nextStatus);
            soundAction();
          }}
          className={`w-full py-2.5 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${btnClass}`}
        >
          {btnIcon}
          <span>{btnLabel}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KDS Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-[#FF7A1A]" />
            <h2 className="text-xl font-bold font-['Kanit']">Kitchen Display System (KDS) จอคิวห้องครัว</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            ระบบบริหารลำดับออเดอร์หน้าร้านและอัปเดตสถานะการปรุงอาหารแบบเรียลไทม์ Real-Time Firebase Sync
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-3.5 py-1.5 bg-slate-800 rounded-xl text-[#FF7A1A] font-bold border border-slate-700 font-['JetBrains_Mono']">
            ออเดอร์รอดำเนินการ: {orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && o.queueStatus !== 'completed' && o.queueStatus !== 'cancelled').length} คิว
          </span>
        </div>
      </div>

      {/* KDS 4-Column Synchronized Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Column 1: PENDING (New Queue) */}
        <div className="bg-slate-100 rounded-3xl p-4 border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 font-['Kanit']">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>1. คิวใหม่รอรับ ({pendingOrders.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวใหม่ขณะนี้</div>
            ) : (
              pendingOrders.map((order) =>
                renderOrderCard(
                  order,
                  'confirmed',
                  'รับออเดอร์ (CONFIRMED)',
                  <Clock className="w-3.5 h-3.5" />,
                  'bg-blue-600 hover:bg-blue-700 shadow-blue-950/20',
                  () => soundManager.playNewOrderAlert()
                )
              )
            )}
          </div>
        </div>

        {/* Column 2: CONFIRMED (Accepted, Waiting to Cook) */}
        <div className="bg-blue-50/60 rounded-3xl p-4 border border-blue-100 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 font-['Kanit']">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span>2. รับแล้วรอปรุง ({confirmedOrders.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {confirmedOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวที่รับแล้วขณะนี้</div>
            ) : (
              confirmedOrders.map((order) =>
                renderOrderCard(
                  order,
                  'cooking',
                  'เริ่มปรุงอาหาร 🔥',
                  <Flame className="w-3.5 h-3.5" />,
                  'bg-[#8B0000] hover:bg-[#700000] shadow-red-950/20',
                  () => soundManager.playNewOrderAlert()
                )
              )
            )}
          </div>
        </div>

        {/* Column 3: PREPARING (Cooking) */}
        <div className="bg-orange-50/60 rounded-3xl p-4 border border-orange-100 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 font-['Kanit']">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
              <span>3. กำลังปรุง ({cookingOrders.length})</span>
            </h3>
          </div>
          <div className="space-y-3">
            {cookingOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวที่กำลังปรุงขณะนี้</div>
            ) : (
              cookingOrders.map((order) =>
                renderOrderCard(
                  order,
                  'ready',
                  'ปรุงเสร็จแล้ว! (READY)',
                  <Sparkles className="w-4 h-4" />,
                  'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20',
                  () => soundManager.playOrderReadyChime()
                )
              )
            )}
          </div>
        </div>

        {/* Column 4: READY (Ready for Pickup) */}
        <div className="bg-emerald-50/60 rounded-3xl p-4 border border-emerald-100 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 font-['Kanit']">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>4. พร้อมรับอาหาร ({readyOrders.length})</span>
            </h3>
          </div>
          <div className="space-y-3">
            {readyOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวที่พร้อมรับขณะนี้</div>
            ) : (
              readyOrders.map((order) =>
                renderOrderCard(
                  order,
                  'completed',
                  'ลูกค้ารับอาหารเรียบร้อย',
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
                  'bg-slate-900 hover:bg-slate-800 shadow-slate-950/20',
                  () => soundManager.playQueueIssuedSound()
                )
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchantKDS;
