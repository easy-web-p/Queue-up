import React, { useState } from 'react';
import { Order, QueueStatus } from '../types';
import { ChefHat, CheckCircle2, Eye, Phone, Sparkles } from 'lucide-react';
import { soundManager } from '../utils/audioNotification.js';

interface Props {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, newStatus: QueueStatus) => void;
  onVerifyPayment?: (orderId: string) => void;
}

export const MerchantKDS: React.FC<Props> = ({
  orders,
  onUpdateOrderStatus,
}) => {

  const [selectedSlipUrl, setSelectedSlipUrl] = useState<string | null>(null);

  const waitingOrders = orders.filter((o) => o.queueStatus === 'waiting');
  const cookingOrders = orders.filter((o) => o.queueStatus === 'cooking');
  const readyOrders = orders.filter((o) => o.queueStatus === 'ready');


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
            จัดการลำดับออเดอร์หน้าร้าน ตรวจสอบสลิป และอัปเดตสถานะคิวอาหารแบบเรียลไทม์
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-3 py-1.5 bg-slate-800 rounded-xl text-amber-300 font-bold border border-slate-700">
            ออเดอร์รอดำเนินการ: {orders.filter((o) => o.queueStatus !== 'completed' && o.queueStatus !== 'cancelled').length} คิว
          </span>
        </div>
      </div>

      {/* KDS Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Column 1: Waiting / Pending Slip */}
        <div className="bg-slate-100 rounded-3xl p-4 border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>1. คิวใหม่ / รอตรวจสลิป ({waitingOrders.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {waitingOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวใหม่ขณะนี้</div>
            ) : (
              waitingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-xs text-orange-600 font-black block">
                        คิว #{order.queueNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{order.customerName}</span>
                    </div>
                    <span className="text-[11px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">
                      นัดรับ {order.pickupTime} น.
                    </span>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-1 text-xs text-slate-700">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>
                          • {it.menuItem.name} x{it.quantity}
                          {it.customNotes && (
                            <span className="block text-[10px] text-orange-600 ml-3">
                              ({it.customNotes})
                            </span>
                          )}
                        </span>
                        <span className="font-semibold">{it.menuItem.price * it.quantity}฿</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => {
                        onUpdateOrderStatus(order.id, 'cooking');
                        soundManager.playNewOrderAlert();
                      }}
                      className="w-full py-2 bg-[#8B0000] hover:bg-[#700000] text-white font-bold text-xs rounded-xl shadow-md shadow-red-950/20 transition-all cursor-pointer"
                    >
                      รับออเดอร์ & เริ่มปรุงอาหาร 🔥
                    </button>
                  </div>
                </div>
              ))
            )}

          </div>
        </div>

        {/* Column 2: Cooking */}
        <div className="bg-orange-50/60 rounded-3xl p-4 border border-orange-100 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
              <span>2. กำลังปรุง (Cooking) ({cookingOrders.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {cookingOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวที่กำลังปรุงขณะนี้</div>
            ) : (
              cookingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-4 border border-orange-200 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-xs text-orange-600 font-black block">
                        คิว #{order.queueNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{order.customerName}</span>
                    </div>
                    <span className="text-[11px] bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full font-bold">
                      พร้อมรับใน {order.estimatedReadyTime}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-700">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between font-semibold">
                        <span>
                          • {it.menuItem.name} x{it.quantity}
                          {it.customNotes && (
                            <span className="block text-[11px] text-orange-600 ml-3">
                              ({it.customNotes})
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      onUpdateOrderStatus(order.id, 'ready');
                      soundManager.playOrderReadyChime();
                    }}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>ปรุงเสร็จแล้ว! เปลี่ยนเป็นพร้อมรับ</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Ready for Pickup */}
        <div className="bg-emerald-50/60 rounded-3xl p-4 border border-emerald-100 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>3. พร้อมรับอาหาร (Ready) ({readyOrders.length})</span>
            </h3>
          </div>

          <div className="space-y-3">
            {readyOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">ไม่มีคิวที่พร้อมรับขณะนี้</div>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-4 border border-emerald-300 shadow-md space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-sm text-emerald-600 font-black block">
                        คิว #{order.queueNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{order.customerName}</span>
                    </div>
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="text-xs text-slate-500 hover:text-orange-600 flex items-center gap-1 font-semibold"
                    >
                      <Phone className="w-3 h-3" /> {order.customerPhone}
                    </a>
                  </div>

                  <div className="space-y-1 text-xs text-slate-700">
                    {order.items.map((it, idx) => (
                      <div key={idx}>
                        • {it.menuItem.name} x{it.quantity}
                      </div>
                    ))}
                  </div>

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

      {/* Slip Preview Modal */}
      {selectedSlipUrl && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-slate-900 text-sm">ตรวจสอบสลิปการโอนเงิน</h4>
              <button
                onClick={() => setSelectedSlipUrl(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>
            <img
              src={selectedSlipUrl}
              alt="Slip"
              className="w-full rounded-2xl border border-slate-200 object-cover max-h-80"
            />
            <button
              onClick={() => setSelectedSlipUrl(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
