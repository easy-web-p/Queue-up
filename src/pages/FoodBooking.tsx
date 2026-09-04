import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Utensils, ArrowLeft, Sparkles, AlertCircle, Clock, CheckCircle2, ShoppingBag, Store, MapPin, Calendar, Compass, ChevronRight } from 'lucide-react';
import { CartItem, Order, CustomerProfile } from '../types';
import { db } from '../firebase/config.js';
import { createAuthoritativeStoreOrder } from '../services/orderCreationService';
import { soundManager } from '../utils/audioNotification.js';

interface FoodBookingPageProps {
  cartItems?: CartItem[];
  currentUser?: CustomerProfile | null;
  onBookingSuccess?: (createdOrder: Order) => void;
  onBack?: () => void;
}

const getTodayYmdStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatThaiDate = (ymdStr?: string) => {
  if (!ymdStr) return '';
  try {
    const parts = ymdStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10) + 543;
      const monthNames = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return `${day} ${monthNames[monthIndex] || ''} ${year}`;
    }
  } catch {
    // fallback
  }
  return ymdStr;
};

export const FoodBooking: React.FC<FoodBookingPageProps> = ({
  cartItems: propCartItems = [],
  currentUser: propCurrentUser,
  onBookingSuccess,
  onBack: propOnBack
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const reduxUser = useSelector((state: any) => state.auth?.user);

  // Fallback to router state or local storage if props are not provided
  const locationState = location.state as {
    cartItems?: CartItem[];
    pickupTime?: string;
    bookingDate?: string;
    storeId?: string;
    storeName?: string;
    storeLocation?: string;
  } | null;

  const cartItems = propCartItems.length > 0 ? propCartItems : (locationState?.cartItems || []);
  const currentUser = propCurrentUser || reduxUser || (() => {
    try {
      const saved = localStorage.getItem('queueup_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  const [pickupTime, setPickupTime] = useState(locationState?.pickupTime || '12:15');
  const [pickupDate, setPickupDate] = useState<string>(() => {
    const raw = locationState?.bookingDate;
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
      return raw.trim();
    }
    return getTodayYmdStr();
  });
  const [customInstructions, setCustomInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  const storeName = locationState?.storeName || 'ร้านป้าแดง ตามสั่ง & ไก่ทอด';
  const storeLocation = locationState?.storeLocation || 'ล็อค 02 โรงอาหารกลาง 1 (ชั้น 1)';

  const onBack = propOnBack || (() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/home');
    }
  });

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    const userPhone = currentUser?.phone || currentUser?.phoneNumber || '';
    if (!userPhone) {
      setOrderError('กรุณากรอกเบอร์โทรศัพท์ในหน้าโปรไฟล์ก่อนทำการจองคิวอาหาร เพื่อรับการแจ้งเตือนคิว');
      return;
    }

    setIsSubmitting(true);
    setOrderError(null);

    const storeId = locationState?.storeId || cartItems[0]?.menuItem?.storeId || 'store_canteen01';
    const userId = currentUser?.id || currentUser?.uid;

    if (!userId) {
      setOrderError('กรุณาเข้าสู่ระบบก่อนทำการสั่งจองคิวอาหาร');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await createAuthoritativeStoreOrder(db, {
        storeId,
        userId,
        customerName: currentUser?.name || currentUser?.displayName || currentUser?.fullName || 'ลูกค้า QueueUp',
        customerPhone: userPhone,
        pickupTime,
        pickupDate: pickupDate || locationState?.bookingDate,
        items: cartItems.map((c) => ({
          productId: c.menuItem.id,
          quantity: c.quantity,
          customNotes: c.customNotes || customInstructions || '',
          selectedModifiers: Array.isArray(c.selectedModifiers) ? c.selectedModifiers : []
        }))

      });

      const orderData = result.order as Order;

      // Update local history cache for instant UI rendering and clear cart
      try {
        const existing = JSON.parse(localStorage.getItem('queueup_user_orders') || '[]');
        localStorage.setItem('queueup_user_orders', JSON.stringify([orderData, ...existing]));
        localStorage.removeItem('queueup_cart');
      } catch {
        // ignore
      }

      soundManager.playQueueIssuedSound();
      setCreatedOrder(orderData);

      if (onBookingSuccess) {
        onBookingSuccess(orderData);
      }
    } catch (err: any) {
      console.error('Order creation failed:', err);
      setOrderError(err?.message || 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer text-slate-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">ยืนยันรายการและรับคิว (Order & Queue)</h1>
              <p className="text-xs text-slate-500 font-medium">ระบบ Zero-Payment สั่งปุ๊บรับหมายเลขคิวทันที</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200">
            <Sparkles className="w-4 h-4 text-amber-600" />
            รับแต้มสะสม CRM x2
          </div>
        </div>

        {/* Store Info Banner */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-[#8B0000] flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900">{storeName}</div>
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#8B0000]" />
                {storeLocation}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
              🟢 ร้านเปิดให้บริการ
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {orderError && (
          <div className="bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-2xl flex items-center gap-3 animate-fade-in">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
            <div className="text-xs font-bold">{orderError}</div>
          </div>
        )}

        {createdOrder ? (
          /* Order Created Summary View (Instant Q001 Queue Issuance) */
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-emerald-500 text-center space-y-6 animate-fade-in">
            <div className="inline-flex p-4 rounded-full bg-emerald-100 text-emerald-600 mb-2">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">สั่งอาหารและออกหมายเลขคิวสำเร็จ!</h2>
              <p className="text-xs text-slate-500 mt-1">
                ร้านค้าได้รับออเดอร์แล้ว กรุณาไปรับอาหารตามเวลาที่นัดหมาย
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-[#8B0000] via-[#A50000] to-[#800000] text-white p-6 rounded-3xl shadow-xl max-w-sm mx-auto">
              <span className="text-xs font-extrabold uppercase tracking-widest text-amber-200">หมายเลขคิวของคุณ (Queue Number)</span>
              <div className="text-6xl font-black my-2 tracking-wider text-amber-300">{createdOrder.queueNumber || 'Q001'}</div>
              <div className="inline-block px-3 py-1 bg-emerald-400 text-emerald-950 rounded-full text-xs font-black">
                คิวรอทำอาหาร (PENDING)
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl max-w-sm mx-auto text-left text-xs font-medium text-slate-600 space-y-2 border border-slate-200">
              <div className="flex justify-between">
                <span>ร้านค้า:</span>
                <span className="font-bold text-slate-800">{storeName}</span>
              </div>
              <div className="flex justify-between">
                <span>ตำแหน่งร้าน:</span>
                <span className="font-bold text-slate-800">{storeLocation}</span>
              </div>
              <div className="flex justify-between">
                <span>วันที่นัดรับ:</span>
                <span className="font-bold text-slate-800">{formatThaiDate(pickupDate)}</span>
              </div>
              <div className="flex justify-between">
                <span>เวลารับอาหาร:</span>
                <span className="font-bold text-slate-800">{createdOrder.pickupTime} น.</span>
              </div>
              <div className="flex justify-between">
                <span>ชื่อผู้สั่ง:</span>
                <span className="font-bold text-slate-800">{createdOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>ยอดรวมสุทธิ:</span>
                <span className="font-bold text-[#8B0000]">฿{Number(createdOrder.totalAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>สถานะคิว:</span>
                <span className="font-bold text-emerald-600">ยืนยันคิวแล้ว (Confirmed)</span>
              </div>
            </div>

            {/* Wayfinding Tip */}
            <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl max-w-sm mx-auto text-left text-xs flex items-start gap-2.5">
              <Compass className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900 block">เส้นทางเดินรับอาหาร:</span>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  เดินเข้าทางเข้าหลักโรงอาหาร ผ่านเสา C3 ตรงไป 40 วินาที รับที่จุด Pick-up หน้าล็อค 02
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={() => navigate('/user/account/profile?tab=bookings')}
                className="px-6 py-3 bg-[#8B0000] hover:bg-[#700000] text-white font-bold text-sm rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                ดูสถานะคิวในบัญชีของฉัน
              </button>

              <button
                type="button"
                onClick={() => navigate('/home')}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-2xl border border-slate-300 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                สั่งเมนูอื่นเพิ่ม
              </button>
            </div>
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleConfirmOrder} className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-100 space-y-6">
            
            {/* Selected Items Summary */}
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#8B0000]" />
                รายการอาหารในตระกร้า ({cartItems.length} รายการ)
              </h3>
              {cartItems.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-sm font-medium">
                  ยังไม่มีรายการอาหารในตระกร้า กรุณาเลือกเมนูจากหน้าหลักก่อนดำเนินการ
                </div>
              ) : (
                <div className="divide-y divide-slate-100 bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-bold text-slate-800">{item.menuItem.name}</span>
                        <span className="text-xs text-slate-500 ml-2">x{item.quantity}</span>
                        {item.customNotes && (
                          <p className="text-xs text-amber-700 italic">คำขอ: {item.customNotes}</p>
                        )}
                      </div>
                      <span className="font-extrabold text-slate-900">฿{(item.menuItem.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pt-3 flex justify-between font-black text-base text-[#8B0000]">
                    <span>ยอดรวมทั้งหมด:</span>
                    <span>฿{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Date Selection Review */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#8B0000]" />
                วันที่ต้องการรับอาหาร *
              </label>
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    {formatThaiDate(pickupDate) || pickupDate}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold">
                    ✓ ระบบเปิดรับจองล่วงหน้า
                  </span>
                </div>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-[#8B0000]"
                />
              </div>
            </div>

            {/* Pickup Time Select */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#8B0000]" />
                เลือกระบุเวลารับอาหารพักเที่ยง *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {['11:30', '11:45', '12:00', '12:15', '12:30', '12:45'].map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setPickupTime(time)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      pickupTime === time
                        ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-md'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50'
                    }`}
                  >
                    {time} น.
                  </button>
                ))}
              </div>
            </div>

            {/* Custom instructions */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                คำสั่งพิเศษถึงร้านค้า (ถ้ามี)
              </label>
              <input
                type="text"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="เช่น เผ็ดน้อย, ไม่ใส่ผัก, ขอช้อนส้อม"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#8B0000]"
              />
            </div>

            <button
              type="submit"
              disabled={cartItems.length === 0 || isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-[#8B0000] via-[#A50000] to-[#800000] hover:from-[#700000] hover:to-[#8B0000] text-white font-black text-base rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>{isSubmitting ? 'กำลังตรวจสอบโควตาและบันทึกคิว...' : 'ยืนยันสั่งอาหาร'}</span>
            </button>

          </form>
        )}

      </div>
    </div>
  );
};

export default FoodBooking;

