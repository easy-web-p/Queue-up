import React from 'react';
import { Order, QueueStatus } from '../types';
import { ChefHat, CheckCircle2, Phone, Sparkles, Flame, Clock } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      
      {/* KDS Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 text-white p-5 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold">Kitchen Display System (KDS) จอคิวห้องครัว</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            ระบบบริหารลำดับออเดอร์หน้าร้านและอัปเดตสถานะการปรุงอาหารแบบเรียลไทม์ (Zero-Payment)
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-3 py-1.5 bg-slate-800 rounded-xl text-amber-300 font-bold border border-slate-700">
            ออเดอร์รอดำเนินการ: {orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && o.queueStatus !== 'completed' && o.queueStatus !== 'cancelled').length} คิว
          </span>
        </div>
      </div>

      {/* KDS 4-Column Synchronized Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Column 1: PENDING (New Queue) */}
        <div className="bg-slate-100 rounded-3xl p-4 border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>1. คิวใหม่รอรับ ({pendingOrders.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวใหม่ขณะนี้</div>
            ) : (
              pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-xs text-orange-600 font-black block">คิว #{order.queueNumber}</span>
                      <span className="text-xs font-bold text-slate-800">{order.customerName}</span>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => {
                        onUpdateOrderStatus(order.id, 'confirmed');
                        soundManager.playNewOrderAlert();
                      }}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-950/20 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>รับออเดอร์ (CONFIRMED)</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: CONFIRMED (Accepted, Waiting to Cook) */}
        <div className="bg-blue-50/60 rounded-3xl p-4 border border-blue-100 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span>2. รับแล้วรอปรุง ({confirmedOrders.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {confirmedOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวที่รับแล้วขณะนี้</div>
            ) : (
              confirmedOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-4 border border-blue-200 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-xs text-blue-600 font-black block">คิว #{order.queueNumber}</span>
                      <span className="text-xs font-bold text-slate-800">{order.customerName}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onUpdateOrderStatus(order.id, 'cooking');
                      soundManager.playNewOrderAlert();
                    }}
                    className="w-full py-2 bg-[#8B0000] hover:bg-[#700000] text-white font-bold text-xs rounded-xl shadow-md shadow-red-950/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>เริ่มปรุงอาหาร 🔥</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: PREPARING (Cooking) */}
        <div className="bg-orange-50/60 rounded-3xl p-4 border border-orange-100 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
              <span>3. กำลังปรุง ({cookingOrders.length})</span>
            </h3>
          </div>
          <div className="space-y-3">
            {cookingOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวที่กำลังปรุงขณะนี้</div>
            ) : (
              cookingOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl p-4 border border-orange-200 shadow-sm space-y-3">
                   <div className="text-xs font-bold text-slate-800">คิว #{order.queueNumber}</div>
                   <button
                    onClick={() => {
                      onUpdateOrderStatus(order.id, 'ready');
                      soundManager.playOrderReadyChime();
                    }}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>ปรุงเสร็จแล้ว!</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 4: READY (Ready for Pickup) */}
        <div className="bg-emerald-50/60 rounded-3xl p-4 border border-emerald-100 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>4. พร้อมรับอาหาร ({readyOrders.length})</span>
            </h3>
          </div>
          <div className="space-y-3">
            {readyOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวที่พร้อมรับขณะนี้</div>
            ) : (
              readyOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl p-4 border border-emerald-300 shadow-md space-y-3">
                  <div className="text-sm text-emerald-600 font-black">คิว #{order.queueNumber}</div>
                  <button
                    onClick={() => {
                      onUpdateOrderStatus(order.id, 'completed');
                      soundManager.playQueueIssuedSound();
                    }}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>ลูกค้ารับอาหารเรียบร้อย</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default MerchantKDS;
