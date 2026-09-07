import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectCartItems, clearCart } from '../store/cartSlice';
import { Utensils, ArrowLeft, Sparkles, AlertCircle, Clock, CheckCircle2, ShoppingBag, Store, MapPin, Calendar, Compass, Wallet, CreditCard } from 'lucide-react';
import { CartItem, Order, CustomerProfile, SelectedModifierOption } from '../types';
import { db } from '../firebase/config.js';
import {
  createAuthoritativeStoreOrder,
  getBangkokYmd,
  AllergenAlertError,
  type AllergenFlaggedItem,
} from '../services/orderCreationService';
import { soundManager } from '../utils/audioNotification.js';
import { ClientQueueTicket } from '../components/ClientQueueTicket.jsx';

interface FoodBookingPageProps {
  cartItems?: CartItem[];
  currentUser?: CustomerProfile | null;
  onBookingSuccess?: (createdOrder: Order) => void;
  onBack?: () => void;
}

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
  const dispatch = useDispatch();
  const reduxUser = useSelector((state: any) => state.auth?.user);
  const reduxCartItems = useSelector(selectCartItems);

  // Fallback to router state or local storage if props are not provided
  const locationState = location.state as {
    cartItems?: CartItem[];
    pickupTime?: string;
    bookingDate?: string;
    storeId?: string;
    storeName?: string;
    storeLocation?: string;
  } | null;

  const cartItems = propCartItems.length > 0 
    ? propCartItems 
    : ((locationState?.cartItems && locationState.cartItems.length > 0) 
        ? locationState.cartItems 
        : reduxCartItems);
  const currentUser = propCurrentUser || reduxUser || null;

  const [pickupTime, setPickupTime] = useState<string>(locationState?.pickupTime || '');
  const [pickupDate, setPickupDate] = useState<string>(() => {
    const raw = locationState?.bookingDate;
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
      return raw.trim();
    }
    return getBangkokYmd().ymd;
  });
  const [paymentMode, setPaymentMode] = useState<'DIRECT_ZERO_PAYMENT' | 'CAMPUS_WALLET'>('DIRECT_ZERO_PAYMENT');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  // Set when the server blocks the order on a recorded allergy. Holds what matched so
  // the customer can see it and decide, rather than reading a bare error string.
  const [allergenAlert, setAllergenAlert] = useState<{
    message: string;
    matchedAllergenNames: string[];
    flaggedItems: AllergenFlaggedItem[];
  } | null>(null);

  const storeId = locationState?.storeId || cartItems[0]?.menuItem?.storeId || '';
  const storeName = locationState?.storeName || (cartItems[0]?.menuItem as any)?.storeName || (storeId ? `ร้านค้า (${storeId})` : 'ร้านค้า');
  const storeLocation = locationState?.storeLocation || 'จุดรับอาหารของร้านค้า';

  const onBack = propOnBack || (() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/home');
    }
  });

  const calculateItemUnitPrice = (item: CartItem) => {
    const base = item.menuItem?.price || 0;
    const mods = Array.isArray(item.selectedModifiers) ? (item.selectedModifiers as SelectedModifierOption[]) : [];
    const modTotal = mods.reduce((sum, m) => {
      const p = typeof m.priceModifier === 'number'
        ? m.priceModifier
        : (m.priceModifierSatang ? m.priceModifierSatang / 100 : 0);
      return sum + p;
    }, 0);
    return base + modTotal;
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + calculateItemUnitPrice(item) * item.quantity, 0);
  };

  const handleConfirmOrder = async (
    e: React.FormEvent | null,
    options: { acknowledgeAllergenWarning?: boolean } = {}
  ) => {
    e?.preventDefault();
    if (isSubmittingRef.current || isSubmitting || cartItems.length === 0) return;

    if (!storeId) {
      setOrderError('ไม่พบรหัสร้านค้า กรุณาเลือกรายการอาหารใหม่อีกครั้ง');
      return;
    }

    if (!pickupTime) {
      setOrderError('กรุณาเลือกรอบเวลารับอาหาร');
      return;
    }

    const userPhone = currentUser?.phone || currentUser?.phoneNumber || '';
    if (!userPhone) {
      setOrderError('กรุณากรอกเบอร์โทรศัพท์ในหน้าโปรไฟล์ก่อนทำการจองคิวอาหาร เพื่อรับการแจ้งเตือนคิว');
      return;
    }

    const userId = currentUser?.id || currentUser?.uid;

    if (!userId) {
      setOrderError('กรุณาเข้าสู่ระบบก่อนทำการสั่งจองคิวอาหาร');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setOrderError(null);
    setAllergenAlert(null);

    try {
      const result = await createAuthoritativeStoreOrder(db, {
        storeId,
        userId,
        customerName: currentUser?.name || currentUser?.displayName || currentUser?.fullName || 'ลูกค้า QueueUp',
        customerPhone: userPhone,
        pickupTime,
        pickupDate: pickupDate || locationState?.bookingDate,
        paymentMode,
        studentId: paymentMode === 'CAMPUS_WALLET' ? userId : undefined,
        acknowledgeAllergenWarning: options.acknowledgeAllergenWarning === true,
        items: cartItems.map((c) => ({
          productId: c.menuItem.id,
          quantity: c.quantity,
          customNotes: c.customNotes || customInstructions || '',
          selectedModifiers: Array.isArray(c.selectedModifiers) ? c.selectedModifiers : []
        }))
      });

      const orderData = result.order as Order;

      // Clear Redux Cart and LocalStorage
      try {
        dispatch(clearCart());
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
      if (err instanceof AllergenAlertError) {
        setAllergenAlert({
          message: err.message,
          matchedAllergenNames: err.matchedAllergenNames,
          flaggedItems: err.flaggedItems,
        });
      } else {
        setOrderError(err?.message || 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#16100C] text-slate-800 dark:text-slate-100 py-6 sm:py-8 px-3 sm:px-6 pb-28 sm:pb-8 transition-colors">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white dark:bg-[#241C16] rounded-3xl p-6 shadow-xl border border-amber-100 dark:border-[#FF7A1A]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#16100C] dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer text-slate-700 dark:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">ยืนยันรายการและรับคิว (Order & Queue)</h1>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF] font-medium">รองรับ Zero-Payment รับคิวทันที หรือชำระด้วยกระเป๋าเงินนักเรียน</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 dark:bg-[#FF7A1A]/10 text-amber-800 dark:text-[#FF7A1A] px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200 dark:border-[#FF7A1A]/30">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-[#FF7A1A]" />
            รับแต้มสะสม CRM x2
          </div>
        </div>

        {/* Store Info Banner */}
        <div className="bg-white dark:bg-[#241C16] rounded-2xl p-4 shadow-xs border border-slate-200 dark:border-[#FF7A1A]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-[#FF7A1A]/20 text-[#8B0000] dark:text-[#FF7A1A] flex items-center justify-center font-bold">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900 dark:text-white">{storeName}</div>
              <div className="text-xs text-slate-500 dark:text-[#9CA3AF] flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#8B0000] dark:text-[#FF7A1A]" />
                {storeLocation}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full">
              🟢 ร้านเปิดให้บริการ
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {orderError && (
          <div className="bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 p-4 rounded-2xl flex items-center gap-3 animate-fade-in">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
            <div className="text-xs font-bold">{orderError}</div>
          </div>
        )}

        {/* 🛡️ Allergen warning: the server refused the order because a recorded
            allergy matched a menu item. Confirming here retries with an explicit
            acknowledgement, which the server records in its audit log. */}
        {allergenAlert && !createdOrder && (
          <div
            role="alertdialog"
            aria-labelledby="allergen-alert-title"
            className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200 p-5 rounded-2xl space-y-4 animate-fade-in"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 id="allergen-alert-title" className="text-sm font-black font-['Kanit']">
                  ⚠️ คำเตือน: อาจมีส่วนผสมที่แพ้
                </h3>
                <p className="text-xs mt-1 leading-relaxed">
                  ระบบพบว่าเมนูที่เลือกอาจมีส่วนผสมที่ตรงกับข้อมูลการแพ้อาหารที่บันทึกไว้
                </p>
              </div>
            </div>

            <ul className="space-y-2">
              {allergenAlert.flaggedItems.map((item) => (
                <li
                  key={item.productId}
                  className="bg-white/70 dark:bg-black/20 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2"
                >
                  <p className="text-xs font-bold">{item.name}</p>
                  <ul className="mt-1 space-y-0.5">
                    {item.details.map((d, idx) => (
                      <li key={idx} className="text-[11px] opacity-90">
                        • <strong>{d.allergenName}</strong> — {d.details}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            <p className="text-[11px] leading-relaxed opacity-90">
              การตรวจสอบนี้อ้างอิงจากชื่อเมนูและตัวเลือกที่เลือก ไม่ใช่สูตรอาหารจริง
              จึงอาจแจ้งเตือนเกินจริงหรือตรวจไม่พบในบางกรณี
              <strong> กรุณาสอบถามร้านค้าโดยตรงก่อนตัดสินใจ</strong>
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setAllergenAlert(null)}
                className="flex-1 min-w-[140px] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก และแก้ไขรายการ
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleConfirmOrder(null, { acknowledgeAllergenWarning: true })}
                className="flex-1 min-w-[140px] py-3 bg-white dark:bg-transparent border-2 border-amber-500 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                {isSubmitting ? 'กำลังดำเนินการ...' : 'ฉันตรวจสอบแล้ว ยืนยันสั่งซื้อ'}
              </button>
            </div>
          </div>
        )}

        {createdOrder ? (
          /* Order Created Summary View (Instant Q001 Queue Issuance) */
          <div className="bg-white dark:bg-[#241C16] rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-emerald-500 text-center space-y-6 animate-fade-in">
            <div className="inline-flex p-4 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">สั่งอาหารและออกหมายเลขคิวสำเร็จ!</h2>
              <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                ร้านค้าได้รับออเดอร์แล้ว กรุณาไปรับอาหารตามเวลาที่นัดหมาย
              </p>
            </div>
            
            {/* 🎟️ Live Interactive Queue Ticket with 5-Phase Stepper */}
            <div className="max-w-md mx-auto text-left">
              <ClientQueueTicket activeOrder={createdOrder} />
            </div>

            {/* Wayfinding Tip */}
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/50 p-4 rounded-2xl max-w-sm mx-auto text-left text-xs flex items-start gap-2.5">
              <Compass className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200 block">เส้นทางเดินรับอาหาร:</span>
                <p className="text-amber-800 dark:text-amber-300 text-[11px] mt-0.5">
                  เดินเข้าทางเข้าหลักโรงอาหาร ผ่านเสา C3 ตรงไป 40 วินาที รับที่จุด Pick-up หน้าร้านค้า
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
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#16100C] dark:hover:bg-white/10 text-slate-800 dark:text-white font-bold text-sm rounded-2xl border border-slate-300 dark:border-white/10 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                สั่งเมนูอื่นเพิ่ม
              </button>
            </div>
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleConfirmOrder} className="bg-white dark:bg-[#241C16] rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-100 dark:border-[#FF7A1A]/20 space-y-6">
            
            {/* Selected Items Summary */}
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#8B0000] dark:text-[#FF7A1A]" />
                รายการอาหารในตระกร้า ({cartItems.length} รายการ)
              </h3>
              {cartItems.length === 0 ? (
                <div className="bg-slate-50 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-center text-slate-500 dark:text-[#9CA3AF] text-sm font-medium">
                  ยังไม่มีรายการอาหารในตระกร้า กรุณาเลือกเมนูจากหน้าหลักก่อนดำเนินการ
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/10 bg-slate-50 dark:bg-[#16100C] rounded-2xl p-4 border border-slate-200 dark:border-white/10 space-y-3">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between text-sm">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 dark:text-white">{item.menuItem.name}</span>
                          <span className="text-xs text-slate-500 dark:text-[#9CA3AF] font-semibold">x{item.quantity}</span>
                        </div>
                        {Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                          <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] flex flex-wrap gap-1">
                            {(item.selectedModifiers as SelectedModifierOption[]).map((m, mIdx) => {
                              const priceMod = typeof m.priceModifier === 'number'
                                ? m.priceModifier
                                : (m.priceModifierSatang ? m.priceModifierSatang / 100 : 0);
                              return (
                                <span key={mIdx} className="bg-slate-200/80 dark:bg-white/10 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                  {m.name || m.optionId}
                                  {priceMod > 0 && ` (+฿${priceMod})`}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {item.customNotes && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 italic">คำขอ: {item.customNotes}</p>
                        )}
                      </div>
                      <span className="font-extrabold text-slate-900 dark:text-white shrink-0">
                        ฿{(calculateItemUnitPrice(item) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 flex justify-between font-black text-base text-[#8B0000] dark:text-[#FF7A1A]">
                    <span>ยอดรวมทั้งหมด:</span>
                    <span>฿{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Date Selection Review */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#8B0000] dark:text-[#FF7A1A]" />
                วันที่ต้องการรับอาหาร *
              </label>
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 rounded-2xl">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-white block">
                    {formatThaiDate(pickupDate) || pickupDate}
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ ระบบเปิดรับจองล่วงหน้า
                  </span>
                </div>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="text-xs font-bold bg-white dark:bg-[#241C16] border border-slate-300 dark:border-[#FF7A1A]/30 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-white focus:outline-none focus:border-[#8B0000] dark:focus:border-[#FF7A1A]"
                />
              </div>
            </div>

            {/* Pickup Time Select */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#8B0000] dark:text-[#FF7A1A]" />
                เลือกระบุเวลารับอาหารพักเที่ยง *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {['11:30', '11:45', '12:00', '12:15', '12:30', '12:45'].map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setPickupTime(time)}
                    className={`min-h-[44px] py-2.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center ${
                      pickupTime === time
                        ? 'bg-[#8B0000] dark:bg-[#FF7A1A] text-white border-[#8B0000] dark:border-[#FF7A1A] shadow-md'
                        : 'bg-slate-50 dark:bg-[#16100C] text-slate-700 dark:text-[#E5E7EB] border-slate-200 dark:border-white/10 hover:bg-amber-50 dark:hover:bg-white/5'
                    }`}
                  >
                    {time} น.
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#8B0000] dark:text-[#FF7A1A]" />
                เลือกวิธีการชำระเงิน (Payment Option) *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode('DIRECT_ZERO_PAYMENT')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    paymentMode === 'DIRECT_ZERO_PAYMENT'
                      ? 'border-[#8B0000] dark:border-[#FF7A1A] bg-amber-50/60 dark:bg-[#FF7A1A]/10 ring-2 ring-[#8B0000]/20 dark:ring-[#FF7A1A]/30'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#16100C] hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-900 dark:text-white">⚡ Zero-Payment รับคิวทันที</span>
                    <span className="text-[10px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full">มาตรฐาน</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mb-0">ออกคิวทันที และชำระเงินตรงกับร้านค้าเมื่อไปรับอาหาร</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('CAMPUS_WALLET')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    paymentMode === 'CAMPUS_WALLET'
                      ? 'border-[#8B0000] dark:border-[#FF7A1A] bg-amber-50/60 dark:bg-[#FF7A1A]/10 ring-2 ring-[#8B0000]/20 dark:ring-[#FF7A1A]/30'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#16100C] hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-[#8B0000] dark:text-[#FF7A1A]" /> กระเป๋าเงินนักเรียน
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">Digital Wallet</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mb-0">ตัดยอดอัตโนมัติ พร้อมตรวจเช็ควงเงินและหมวดหมู่ที่ผู้ปกครองอนุญาต</p>
                </button>
              </div>
            </div>

            {/* Custom instructions */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                คำสั่งพิเศษถึงร้านค้า (ถ้ามี)
              </label>
              <input
                type="text"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="เช่น เผ็ดน้อย, ไม่ใส่ผัก, ขอช้อนส้อม"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#8B0000] dark:focus:border-[#FF7A1A]"
              />
            </div>

            <button
              type="submit"
              disabled={cartItems.length === 0 || isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-[#8B0000] via-[#A50000] to-[#800000] dark:from-[#FF7A1A] dark:to-[#E6680D] hover:opacity-90 text-white font-black text-base rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>{isSubmitting ? 'กำลังตรวจสอบโควตาและบันทึกคิว...' : 'ยืนยันสั่งอาหาร'}</span>
            </button>

            {/* 📱 Mobile-First Sticky Checkout Bar (Fixed at bottom for mobile < 640px) */}
            <div className="fixed bottom-0 left-0 right-0 z-30 sm:hidden bg-white/95 dark:bg-[#241C16]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/10 p-3 px-4 shadow-2xl flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-slate-500 dark:text-[#9CA3AF] uppercase">ยอดรวมสุทธิ</span>
                <span className="text-lg font-black text-[#8B0000] dark:text-[#FF7A1A]">
                  ฿{calculateTotal().toLocaleString()}
                </span>
              </div>
              <button
                type="submit"
                disabled={cartItems.length === 0 || isSubmitting}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#8B0000] to-[#FF7A1A] hover:opacity-95 text-white font-extrabold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 min-h-[48px] cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันสั่งอาหาร'}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default FoodBooking;
