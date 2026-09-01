import React, { useState, useEffect } from 'react';
import { Clock, Utensils, QrCode, CheckCircle2, ArrowLeft, ShieldCheck, Sparkles, MapPin, AlertCircle } from 'lucide-react';
import { MenuItem, CartItem, Order, CustomerProfile } from '../types';
import { saveOrderToFirestore } from '../lib/firebase';
import { soundManager } from '../utils/audioNotification.js';

interface FoodBookingPageProps {
  cartItems?: CartItem[];
  currentUser?: CustomerProfile | null;
  onBookingSuccess?: (createdOrder: Order) => void;
  onBack?: () => void;
}

export const FoodBooking: React.FC<FoodBookingPageProps> = ({
  cartItems = [],
  currentUser,
  onBookingSuccess,
  onBack
}) => {
  const [pickupTime, setPickupTime] = useState('12:15');
  const [paymentMethod, setPaymentMethod] = useState<'promptpay' | 'cash'>('promptpay');
  const [customInstructions, setCustomInstructions] = useState('');
  const [slipUrl, setSlipUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    setIsSubmitting(true);

    const total = calculateTotal();
    const queueNum = `A${Math.floor(10 + Math.random() * 90)}`;
    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      queueNumber: queueNum,
      customerName: currentUser?.name || 'นักเรียน QueueUp',
      customerPhone: currentUser?.phone || '081-234-5678',
      totalAmount: total,
      finalAmount: total,
      discountApplied: 0,
      pointsEarned: Math.floor(total / 10),
      items: cartItems,
      queueStatus: paymentMethod === 'promptpay' ? 'waiting' : 'waiting',
      paymentMethod,
      paymentStatus: paymentMethod === 'promptpay' ? 'verified' : 'pending',
      pickupTime,
      createdAt: new Date().toISOString(),
      estimatedReadyTime: `${pickupTime} น.`
    };

    await saveOrderToFirestore(newOrder);
    soundManager.playQueueIssuedSound();
    setIsSubmitting(false);
    setCreatedOrder(newOrder);

    if (onBookingSuccess) {
      onBookingSuccess(newOrder);
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
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">ยืนยันการจองคิวอาหาร (Queue Booking)</h1>
              <p className="text-xs text-slate-500 font-medium">สั่งอาหารล่วงหน้า รับอาหารทันทีเมื่อถึงพักเที่ยง</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200">
            <Sparkles className="w-4 h-4 text-amber-600" />
            รับแต้มสะสม CRM x2
          </div>
        </div>

        {createdOrder ? (
          /* Digital Queue Ticket View */
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-emerald-500 text-center space-y-6 animate-fade-in">
            <div className="inline-flex p-4 rounded-full bg-emerald-100 text-emerald-600 mb-2">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">ออกตั๋วคิวสำเร็จ!</h2>
            
            <div className="bg-gradient-to-r from-[#8B0000] via-[#A50000] to-[#800000] text-white p-6 rounded-3xl shadow-xl max-w-sm mx-auto">
              <span className="text-xs font-extrabold uppercase tracking-widest text-amber-200">หมายเลขคิวของคุณ</span>
              <div className="text-5xl font-black my-2 tracking-wider text-amber-300">{createdOrder.queueNumber}</div>
              <p className="text-xs text-amber-100">เวลารับอาหาร: {createdOrder.pickupTime} น.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl max-w-sm mx-auto text-left text-xs font-medium text-slate-600 space-y-2 border border-slate-200">
              <div className="flex justify-between">
                <span>ชื่อผู้สั่ง:</span>
                <span className="font-bold text-slate-800">{createdOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>ยอดรวมสุทธิ:</span>
                <span className="font-bold text-[#8B0000]">{createdOrder.totalAmount} บาท</span>
              </div>
              <div className="flex justify-between">
                <span>แต้มสะสมที่ได้รับ:</span>
                <span className="font-bold text-emerald-600">+{createdOrder.pointsEarned} แต้ม</span>
              </div>
            </div>

            {onBack && (
              <button
                onClick={onBack}
                className="px-6 py-3 bg-[#8B0000] hover:bg-[#700000] text-white font-bold text-sm rounded-2xl shadow-lg transition-all cursor-pointer"
              >
                กลับสู่หน้าหลัก
              </button>
            )}
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
                      <span className="font-extrabold text-slate-900">{item.menuItem.price * item.quantity} บาท</span>
                    </div>
                  ))}
                  <div className="pt-3 flex justify-between font-black text-base text-[#8B0000]">
                    <span>ยอดรวมทั้งหมด:</span>
                    <span>{calculateTotal()} บาท</span>
                  </div>
                </div>
              )}
            </div>

            {/* Pickup Time Select */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                เลือกระบุเวลารับอาหารพักเที่ยง *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['11:45', '12:15', '12:30'].map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setPickupTime(time)}
                    className={`py-3 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
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

            {/* Payment Method Select */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                เลือกช่องทางการชำระเงิน *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('promptpay')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    paymentMethod === 'promptpay'
                      ? 'bg-amber-50/80 border-[#8B0000] shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:bg-amber-50'
                  }`}
                >
                  <span className="text-xs font-black text-slate-900 block">PromptPay QR Code</span>
                  <span className="text-[11px] text-slate-500 font-medium">สแกนชำระทันที ยืนยันคิวอัตโนมัติ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-amber-50/80 border-[#8B0000] shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:bg-amber-50'
                  }`}
                >
                  <span className="text-xs font-black text-slate-900 block">เงินสดหน้าร้าน</span>
                  <span className="text-[11px] text-slate-500 font-medium">ชำระสดเมื่อรับอาหารที่แผง</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={cartItems.length === 0 || isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-[#8B0000] via-[#A50000] to-[#800000] hover:from-[#700000] hover:to-[#8B0000] text-white font-black text-base rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <QrCode className="w-5 h-5" />
              <span>{isSubmitting ? 'กำลังออกคิว...' : 'ยืนยันจองคิวอาหาร'}</span>
            </button>

          </form>
        )}

      </div>
    </div>
  );
};

export default FoodBooking;
