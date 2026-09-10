import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  ArrowLeft,
  Clock,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  Store,
  QrCode,
  AlertTriangle,
  Phone,
  User,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  selectCartItems,
  selectCartTotalAmount,
  clearCart,
} from '../../../store/cartSlice';
import { useCampus } from '../../identity/context/CampusContext';
import { useAuth } from '../../../context/AuthContext';
import {
  createAuthoritativeStoreOrder,
  AllergenAlertError,
  AllergenFlaggedItem,
  getBangkokYmd,
  getBangkokCurrentTime,
  OrderItemRequest,
  OrderCreationResult,
} from '../../../services/orderCreationService';
import { db } from '../../../firebase/config.js';
import { doc, onSnapshot } from 'firebase/firestore';

export const MarketplaceCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { activeCampus } = useCampus();
  const { user } = useAuth();

  const cartItems = useSelector(selectCartItems);
  const cartAmount = useSelector(selectCartTotalAmount);

  // Customer contact state
  const [customerPhone, setCustomerPhone] = useState(user?.phoneNumber || user?.phone || '');
  const [customerName, setCustomerName] = useState(user?.displayName || user?.name || 'ลูกค้า QueueUp');

  // Payment & Slot selection
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'PROMPTPAY' | 'PAY_AT_STORE'>('WALLET');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic upcoming time slots in Bangkok timezone
  const upcomingSlots = useMemo(() => {
    const now = new Date();
    const currentBangkok = getBangkokCurrentTime(now); // "HH:mm"
    const [currH, currM] = currentBangkok.split(':').map(Number);
    const currentMinutes = currH * 60 + currM;

    // Generate slots from 07:00 to 18:00 every 15 minutes
    const slots = [];
    for (let h = 7; h <= 18; h++) {
      for (let m = 0; m < 60; m += 15) {
        const slotMinutes = h * 60 + m;
        // Only include slots at least 5 minutes in the future today
        if (slotMinutes > currentMinutes + 5) {
          const hh = String(h).padStart(2, '0');
          const mm = String(m).padStart(2, '0');
          const time = `${hh}:${mm}`;
          let discount = 'ปกติ';
          if (slotMinutes < 11 * 60 + 45) discount = '-15% Early';
          else if (slotMinutes >= 11 * 60 + 45 && slotMinutes <= 12 * 60 + 30) discount = 'ช่วงพีค';
          else if (slotMinutes > 13 * 60) discount = '-10% บ่าย';

          slots.push({
            time,
            label: `${time} น.`,
            discount,
          });
        }
      }
    }

    if (slots.length === 0) {
      // If past 18:00, provide default evening slots
      return [
        { time: '18:30', label: '18:30 น.', discount: 'รอบพิเศษ' },
        { time: '18:45', label: '18:45 น.', discount: 'รอบพิเศษ' },
      ];
    }

    return slots.slice(0, 8); // Top upcoming slots
  }, []);

  const [selectedSlot, setSelectedSlot] = useState<string>(() => upcomingSlots[0]?.time || '12:00');

  // Allergen Alert modal state
  const [allergenWarning, setAllergenWarning] = useState<{
    message: string;
    matchedAllergenNames: string[];
    flaggedItems: AllergenFlaggedItem[];
  } | null>(null);

  // PromptPay QR modal state
  const [promptPayModal, setPromptPayModal] = useState<{
    orderId: string;
    queueNumber: string;
    qrImageUrl?: string;
    qrPayload?: string;
    expiresAt?: string;
    expiresInSeconds: number;
    amount: number;
  } | null>(null);
  const [promptPayTimeLeft, setPromptPayTimeLeft] = useState<number>(900);
  const [isPromptPayPaid, setIsPromptPayPaid] = useState<boolean>(false);

  // Real-time listener for PromptPay payment status
  useEffect(() => {
    if (!promptPayModal?.orderId) return;

    const timer = setInterval(() => {
      setPromptPayTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const orderRef = doc(db, 'orders', promptPayModal.orderId);
    const unsubscribe = onSnapshot(orderRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.paymentStatus === 'PAID') {
          setIsPromptPayPaid(true);
        }
      }
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [promptPayModal?.orderId]);

  // Order Submission
  const handleSubmitOrder = async (acknowledgeAllergen = false) => {
    if (isSubmitting) return;

    // Contact validation
    const cleanPhone = customerPhone.trim();
    if (!cleanPhone || cleanPhone.length < 9) {
      setErrorMessage('กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (อย่างน้อย 9 หลัก) สำหรับรับคิว');
      return;
    }

    if (!user || !user.uid) {
      setErrorMessage('กรุณาเข้าสู่ระบบก่อนทำการสั่งอาหาร');
      return;
    }

    if (cartItems.length === 0) {
      setErrorMessage('ไม่มีรายการอาหารในตะกร้า');
      return;
    }

    const storeId =
      cartItems[0]?.menuItem?.storeId ||
      (cartItems[0] as any)?.storeId ||
      '';

    if (!storeId) {
      setErrorMessage('ไม่พบข้อมูลร้านค้าในรายการอาหาร กรุณาลองใหม่อีกครั้ง');
      return;
    }

    const items: OrderItemRequest[] = cartItems.map((item) => ({
      productId: item.menuItem?.id || (item as any).productId || (item as any).id || '',
      quantity: item.quantity || 1,
      selectedModifiers: Array.isArray(item.selectedModifiers) ? item.selectedModifiers : [],
      customNotes: item.customNotes || '',
    }));

    const bangkokToday = getBangkokYmd().ymd;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result: OrderCreationResult = await createAuthoritativeStoreOrder({
        storeId,
        userId: user.uid,
        customerName: customerName.trim() || 'ลูกค้า QueueUp',
        customerPhone: cleanPhone,
        items,
        pickupTime: selectedSlot,
        pickupDate: bangkokToday,
        paymentMethod,
        acknowledgeAllergenWarning: acknowledgeAllergen,
      });

      // Handle PromptPay Modal flow
      if (paymentMethod === 'PROMPTPAY' && result.promptPay) {
        dispatch(clearCart());
        setPromptPayModal({
          orderId: result.orderId,
          queueNumber: result.queueNumber,
          qrImageUrl: result.promptPay.qrImageUrl,
          qrPayload: result.promptPay.qrPayload,
          expiresAt: result.promptPay.expiresAt,
          expiresInSeconds: result.promptPay.expiresInSeconds || 900,
          amount: cartAmount,
        });
        setPromptPayTimeLeft(result.promptPay.expiresInSeconds || 900);
        setIsSubmitting(false);
        return;
      }

      // Wallet or Pay at store -> immediately confirmed
      dispatch(clearCart());
      navigate(`/app/orders/${result.orderId}`);
    } catch (err: any) {
      console.error('[Checkout] Submission error:', err);

      if (err instanceof AllergenAlertError) {
        setAllergenWarning({
          message: err.message,
          matchedAllergenNames: err.matchedAllergenNames,
          flaggedItems: err.flaggedItems,
        });
      } else {
        setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง');
      }
      setIsSubmitting(false);
    }
  };

  if (cartItems.length === 0 && !promptPayModal) {
    return (
      <div className="max-w-md mx-auto p-8 text-center bg-[#241C16] border border-white/10 rounded-2xl space-y-4 my-8">
        <p className="text-sm text-slate-300">ไม่มีรายการอาหารในตะกร้า</p>
        <button
          onClick={() => navigate('/app')}
          className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-semibold hover:bg-orange-500 transition-colors"
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-[#241C16] border border-white/10 text-slate-300 hover:text-white transition-colors"
          aria-label="ย้อนกลับ"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-extrabold text-lg font-kanit text-white">ยืนยันคำสั่งซื้อและเวลานัดรับ</h1>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-200">
            <div className="font-bold">ไม่สามารถสร้างคำสั่งซื้อได้</div>
            <div className="mt-0.5">{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Customer Information Card */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white font-kanit">
          <User className="w-4 h-4 text-orange-400" />
          <span>ข้อมูลผู้รับและติดต่อ</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">ชื่อผู้สั่ง</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-[#1A1410] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              placeholder="ระบุชื่อผู้รับอาหาร"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block">เบอร์โทรศัพท์ (สำหรับแจ้งเตือนคิว) *</label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-[#1A1410] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                placeholder="เช่น 0812345678"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pickup Location Card */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-white font-kanit">
          <MapPin className="w-4 h-4 text-orange-400" />
          <span>สถานที่รับอาหาร</span>
        </div>
        <div className="p-3 bg-[#1A1410] rounded-xl border border-white/5 text-xs text-slate-300">
          <div className="font-semibold text-white">{activeCampus.name}</div>
          <div className="text-slate-400 mt-0.5">{activeCampus.location}</div>
        </div>
      </div>

      {/* Step 2: Time Slot Selection */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white font-kanit">
            <Clock className="w-4 h-4 text-orange-400" />
            <span>เลือกรอบเวลานัดรับอาหาร (Time Slot ประจำวันนี้)</span>
          </div>
          <span className="text-[10px] text-orange-400 font-semibold">กระจายคิวลดแออัด</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {upcomingSlots.map((slot) => (
            <button
              key={slot.time}
              type="button"
              onClick={() => setSelectedSlot(slot.time)}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedSlot === slot.time
                  ? 'bg-orange-500/15 border-orange-500 text-white font-bold ring-1 ring-orange-500'
                  : 'bg-[#1A1410] border-white/5 text-slate-300 hover:border-white/20'
              }`}
            >
              <div className="text-sm font-jetbrains">{slot.label}</div>
              <div className="text-[10px] text-orange-400 font-normal mt-0.5">{slot.discount}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Allergen Safety Check Indicator */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <div className="font-bold text-emerald-300">ระบบตรวจสอบสารก่อภูมิแพ้อัตโนมัติ (Server-Side Allergen Guard)</div>
          <div className="mt-0.5 text-slate-400">
            ระบบจะตรวจสอบรายการอาหารและเครื่องปรุงกับประวัติสุขภาพนักเรียนบนเซิร์ฟเวอร์ก่อนออกตั๋วคิวทุกครั้ง
          </div>
        </div>
      </div>

      {/* Step 4: Payment Method Selection */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-3">
        <h3 className="text-xs font-bold text-white font-kanit">เลือกช่องทางการชำระเงิน</h3>

        <div className="space-y-2">
          <label
            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
              paymentMethod === 'WALLET'
                ? 'bg-orange-500/15 border-orange-500 text-white font-semibold ring-1 ring-orange-500'
                : 'bg-[#1A1410] border-white/5 text-slate-300 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-orange-400" />
              <div>
                <div className="text-xs font-semibold">กระเป๋าเงินดิจิทัลโรงเรียน (Campus Wallet)</div>
                <div className="text-[10px] text-slate-400">ตัดยอดทันที ไร้ค่าธรรมเนียม ตรวจสอบวงเงินต่อวันอัตโนมัติ</div>
              </div>
            </div>
            <input
              type="radio"
              name="payment"
              value="WALLET"
              checked={paymentMethod === 'WALLET'}
              onChange={() => setPaymentMethod('WALLET')}
              className="text-orange-600 focus:ring-0"
            />
          </label>

          <label
            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
              paymentMethod === 'PROMPTPAY'
                ? 'bg-blue-500/15 border-blue-500 text-white font-semibold ring-1 ring-blue-500'
                : 'bg-[#1A1410] border-white/5 text-slate-300 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <QrCode className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-xs font-semibold">PromptPay Dynamic QR Code</div>
                <div className="text-[10px] text-slate-400">สแกนชำระผ่านโมบายแบงก์กิ้งทุกธนาคาร (ล็อคยอด 15 นาที)</div>
              </div>
            </div>
            <input
              type="radio"
              name="payment"
              value="PROMPTPAY"
              checked={paymentMethod === 'PROMPTPAY'}
              onChange={() => setPaymentMethod('PROMPTPAY')}
              className="text-blue-600 focus:ring-0"
            />
          </label>

          <label
            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
              paymentMethod === 'PAY_AT_STORE'
                ? 'bg-amber-500/15 border-amber-500 text-white font-semibold ring-1 ring-amber-500'
                : 'bg-[#1A1410] border-white/5 text-slate-300 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-xs font-semibold">ชำระเงินสดหน้าร้าน (Pay at Store)</div>
                <div className="text-[10px] text-slate-400">ชำระขณะรับอาหารที่ล็อคร้านค้าเมื่ออาหารปรุงเสร็จ</div>
              </div>
            </div>
            <input
              type="radio"
              name="payment"
              value="PAY_AT_STORE"
              checked={paymentMethod === 'PAY_AT_STORE'}
              onChange={() => setPaymentMethod('PAY_AT_STORE')}
              className="text-amber-600 focus:ring-0"
            />
          </label>
        </div>
      </div>

      {/* Order Summary & Submit Button */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>เวลานัดรับ</span>
          <span className="font-bold text-white font-jetbrains">{selectedSlot} น.</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>จำนวนอาหาร</span>
          <span className="font-bold text-white">{cartItems.length} รายการ</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-sm font-bold text-white">
          <span>ยอดชำระสุทธิ</span>
          <span className="text-lg text-orange-400 font-jetbrains">฿{cartAmount}</span>
        </div>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => handleSubmitOrder(false)}
          aria-label="ยืนยันคำสั่งซื้อและรับตั๋วคิว"
          className="w-full py-3.5 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-950/40 disabled:opacity-50 mt-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>กำลังตรวจสอบสต็อกและออกตั๋วคิว...</span>
            </>
          ) : (
            <span>ยืนยันคำสั่งซื้อและรับตั๋วคิว</span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* ⚠️ Allergen Alert Modal                                  */}
      {/* ======================================================== */}
      {allergenWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full bg-[#1F1712] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base font-kanit text-amber-300">แจ้งเตือนสารก่อภูมิแพ้ในอาหาร</h3>
                <p className="text-xs text-slate-300 mt-1">
                  ระบบตรวจสอบพบสารก่อภูมิแพ้ที่ตรงกับประวัติสุขภาพของคุณ:
                </p>
              </div>
            </div>

            {/* Matched Allergens Badge */}
            <div className="flex flex-wrap gap-2 pt-1">
              {allergenWarning.matchedAllergenNames.map((name) => (
                <span
                  key={name}
                  className="px-2.5 py-1 bg-red-500/20 text-red-300 border border-red-500/40 rounded-lg text-xs font-semibold"
                >
                  ⚠️ {name}
                </span>
              ))}
            </div>

            {/* Flagged Items Detail */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {allergenWarning.flaggedItems.map((item) => (
                <div key={item.productId} className="p-3 bg-[#16100C] rounded-xl border border-white/5 text-xs">
                  <div className="font-bold text-white">{item.name}</div>
                  <div className="text-[11px] text-amber-300/80 mt-0.5">
                    ตรวจพบ: {item.matchedAllergenNames.join(', ')}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              การกดยืนยันดำเนินการต่อ จะถือว่าลูกค้ารับทราบความเสี่ยงและระบบจะบันทึก Audit Log การยินยอมไว้เป็นหลักฐาน
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAllergenWarning(null)}
                className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-semibold text-xs transition-colors"
              >
                ยกเลิก / แก้ไขเมนู
              </button>
              <button
                type="button"
                onClick={() => {
                  setAllergenWarning(null);
                  handleSubmitOrder(true);
                }}
                className="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors shadow-lg shadow-amber-950/40"
              >
                ยืนยันสั่งซื้อต่อ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 💳 PromptPay Dynamic QR Modal                           */}
      {/* ======================================================== */}
      {promptPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="max-w-md w-full bg-[#18120E] border border-blue-500/30 rounded-3xl p-6 shadow-2xl space-y-4 text-white text-center">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                <QrCode className="w-4 h-4" />
                <span>PromptPay Dynamic QR Code</span>
              </div>
              <span className="text-xs font-jetbrains px-2.5 py-0.5 bg-orange-500/20 text-orange-400 rounded-full font-bold">
                คิว #{promptPayModal.queueNumber}
              </span>
            </div>

            {/* Paid Success Banner */}
            {isPromptPayPaid ? (
              <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-emerald-300 text-sm font-kanit">ชำระเงินสำเร็จเรียบร้อย!</h4>
                <p className="text-xs text-slate-300">คำสั่งซื้อได้รับการยืนยันและส่งเข้าห้องครัวแล้ว</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="text-2xl font-bold font-jetbrains text-white">฿{promptPayModal.amount}</div>
                  <div className="text-[11px] text-slate-400">สแกนชำระผ่านแอปพลิเคชันธนาคารทุกแห่ง</div>
                </div>

                {/* QR Code Display */}
                <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-lg">
                  {promptPayModal.qrImageUrl ? (
                    <img
                      src={promptPayModal.qrImageUrl}
                      alt="PromptPay QR Code"
                      loading="lazy"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-slate-100 text-slate-700 text-xs">
                      กำลังสร้าง QR Code...
                    </div>
                  )}
                </div>

                {/* Countdown Timer */}
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-400">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>
                    หมดอายุใน:{' '}
                    {Math.floor(promptPayTimeLeft / 60)}:
                    {String(promptPayTimeLeft % 60).padStart(2, '0')} นาที
                  </span>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => navigate(`/app/orders/${promptPayModal.orderId}`)}
                className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-orange-950/40"
              >
                <span>{isPromptPayPaid ? 'ไปที่หน้าตั๋วคิวของคุณ' : 'ไปที่หน้าติดตามคิว'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              {!isPromptPayPaid && (
                <button
                  type="button"
                  onClick={() => navigate(`/app/orders/${promptPayModal.orderId}`)}
                  className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-medium text-xs transition-colors"
                >
                  ชำระภายหลังในหน้าประวัติ
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceCheckoutPage;
