import React, { useState, useEffect } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { apiClient } from '../../services/apiClient';
import {
  QrCode,
  CreditCard,
  Banknote,
  ShieldCheck,
  CheckCircle,
  Clock,
  UtensilsCrossed,
  ShoppingBag,
  FileText,
  ExternalLink,
  Lock
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  pickupTime: string;
  reservationId?: string;
  slotId?: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  pickupTime,
  reservationId,
  slotId
}) => {
  const { cart, cartTotal, placeOrder, currentUser, stores, addToast } = useQueue();
  const [customerName, setCustomerName] = useState(currentUser?.fullName || 'คุณลูกค้า');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '089-123-4567');
  const [diningType, setDiningType] = useState<'dine-in' | 'takeaway'>('dine-in');
  const [specialNote, setSpecialNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'promptpay' | 'credit_card' | 'cash'>('promptpay');
  const [payOnlineViaStripe, setPayOnlineViaStripe] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync with currentUser when modal opens or user profile updates
  useEffect(() => {
    if (currentUser) {
      if (currentUser.fullName) setCustomerName(currentUser.fullName);
      if (currentUser.phone) setCustomerPhone(currentUser.phone);
    }
  }, [currentUser, isOpen]);

  const discountAmount = cartTotal > 200 ? 20 : 0;
  const grandTotal = Math.max(0, cartTotal - discountAmount);

  const activeStoreName = cart[0]?.food?.storeName || 'ร้านค้าพาร์ทเนอร์';

  const handleConfirmOrder = async () => {
    setIsProcessing(true);
    const combinedNote = [
      diningType === 'dine-in' ? '[ทานที่ร้าน]' : '[รับกลับบ้าน]',
      specialNote.trim()
    ].filter(Boolean).join(' ');

    try {
      // 1. Create authoritative order via Command Model (with reservationId -> orderId = reservationId)
      const newOrder = placeOrder({
        customerName: customerName.trim() || currentUser?.fullName || 'คุณลูกค้า',
        customerPhone: customerPhone.trim() || currentUser?.phone || '089-123-4567',
        pickupTime,
        paymentMethod,
        specialNote: combinedNote || undefined,
        reservationId,
        slotId
      });

      // Sync authoritative order with Express backend transaction
      try {
        await apiClient.createOrder({
          storeId: cart[0]?.food?.storeId || 'store-1',
          items: cart.map(i => ({
            menuItemId: i.food.id,
            quantity: i.quantity,
            selectedOptions: i.selectedOptions?.map(o => ({
              groupName: o.groupName || '',
              choiceName: o.choiceName,
              priceDelta: o.priceDelta
            })),
            specialNote: i.specialNote
          })),
          paymentMethod,
          allergenAcknowledged: true,
          customerId: currentUser?.id,
          customerEmail: currentUser?.email,
          customerName: customerName.trim() || currentUser?.fullName || 'คุณลูกค้า',
          customerPhone: customerPhone.trim() || currentUser?.phone || '089-123-4567',
          pickupTime,
          specialNote: combinedNote || undefined,
          reservationId,
          slotId,
          workload: cart.reduce((s, it) => s + (it.quantity || 1), 0)
        });
      } catch (backendErr) {
        console.warn('[CheckoutModal] Express backend createOrder sync note:', backendErr);
      }

      // 2. If online payment is selected for PromptPay or Card, initiate Stripe Checkout
      if (payOnlineViaStripe && (paymentMethod === 'promptpay' || paymentMethod === 'credit_card')) {
        addToast('กำลังเชื่อมต่อไปยัง Stripe...', 'เปิดระบบชำระเงินปลอดภัยเพื่อสแกน QR หรือใส่บัตร', 'info');

        try {
          const session = await apiClient.createCheckoutSession({
            orderId: newOrder.id,
            amount: grandTotal,
            storeName: activeStoreName,
            items: cart.map(i => ({
              name: i.food.name,
              price: i.food.price,
              quantity: i.quantity
            })),
            customerEmail: currentUser?.email,
            paymentMethodType: paymentMethod === 'credit_card' ? 'card' : 'promptpay',
            returnUrl: window.location.href
          });

          if (session && session.url) {
            window.location.href = session.url;
            return;
          }
        } catch (stripeErr) {
          console.warn('[Checkout] Stripe checkout fallback to manual view:', stripeErr);
          addToast('เข้าสู่หน้าคิวแล้ว', 'คุณสามารถสแกนชำระผ่าน PromptPay QR หรือที่หน้าร้านได้เช่นกัน', 'info');
        }
      }

      setIsProcessing(false);
      onClose();
    } catch (err) {
      console.error('Order/Payment creation failed:', err);
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ยืนยันการสั่งซื้อและชำระเงิน" maxWidth="md">
      <div className="flex flex-col gap-4 text-stone-900 dark:text-zinc-100 -m-1">
        {/* Dining Type Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            รูปแบบการรับประทาน
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setDiningType('dine-in')}
              className={`flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all cursor-pointer ${
                diningType === 'dine-in'
                  ? 'bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                  : 'bg-stone-50 dark:bg-zinc-900/60 border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-400 hover:border-stone-300'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4 text-orange-500" />
              <span className="text-xs">ทานที่ร้าน (Dine-in)</span>
            </button>
            <button
              type="button"
              onClick={() => setDiningType('takeaway')}
              className={`flex items-center justify-center gap-2 p-3 rounded-2xl border transition-all cursor-pointer ${
                diningType === 'takeaway'
                  ? 'bg-orange-500/10 border-orange-500 text-orange-600 dark:text-orange-400 font-bold shadow-xs'
                  : 'bg-stone-50 dark:bg-zinc-900/60 border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-400 hover:border-stone-300'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-orange-500" />
              <span className="text-xs">รับกลับบ้าน (Takeaway)</span>
            </button>
          </div>
        </div>

        {/* Customer Information */}
        <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-zinc-800">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            ข้อมูลผู้ติดต่อรับคิว ({activeStoreName})
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="ชื่อผู้สั่ง"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="กรุณากรอกชื่อ"
            />
            <Input
              label="เบอร์โทรศัพท์ (สำหรับแจ้งเตือน)"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              placeholder="08x-xxx-xxxx"
            />
          </div>
        </div>

        {/* Order Special Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-stone-400" />
            <span>หมายเหตุรวมถึงแม่ครัว / ร้านค้า (ไม่บังคับ)</span>
          </label>
          <input
            type="text"
            value={specialNote}
            onChange={e => setSpecialNote(e.target.value)}
            placeholder="เช่น แยกน้ำซุป, ไม่ใส่ผักชี, เผ็ดน้อยมาก, มีอาการแพ้ถั่ว"
            className="w-full text-xs px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        {/* Payment Methods */}
        <div className="space-y-2.5 pt-2 border-t border-stone-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
              วิธีชำระเงิน
            </label>
            <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
              <Lock className="w-3 h-3" />
              <span>Stripe Gateway</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'promptpay', label: 'พร้อมเพย์ QR', icon: <QrCode className="w-4 h-4" /> },
              { id: 'credit_card', label: 'บัตรเครดิต', icon: <CreditCard className="w-4 h-4" /> },
              { id: 'cash', label: 'เงินสดหน้าร้าน', icon: <Banknote className="w-4 h-4" /> },
            ].map(method => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id as any)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  paymentMethod === method.id
                    ? 'bg-orange-500/15 border-orange-500 text-orange-600 dark:text-orange-400 font-bold'
                    : 'bg-stone-50 dark:bg-zinc-900/60 border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-400 hover:border-stone-300'
                }`}
              >
                <div className="mb-1.5">{method.icon}</div>
                <span className="text-xs">{method.label}</span>
              </button>
            ))}
          </div>

          {/* Stripe Online Payment Option Card */}
          {(paymentMethod === 'promptpay' || paymentMethod === 'credit_card') && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2 mt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-xs tracking-wider">
                    stripe
                  </div>
                  <span className="text-xs font-bold text-stone-800 dark:text-zinc-200">
                    ชำระเงินออนไลน์ทันที (แนะนำ)
                  </span>
                </div>
                <input
                  type="checkbox"
                  id="stripe-toggle"
                  checked={payOnlineViaStripe}
                  onChange={e => setPayOnlineViaStripe(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-stone-600 dark:text-zinc-400">
                {paymentMethod === 'promptpay'
                  ? 'ระบบจะสร้าง PromptPay QR แบบไดนามิกผ่าน Stripe ปรับยอดและตัดคิวทันทีหลังสแกนสำเร็จ'
                  : 'รองรับบัตรเครดิต/เดบิต Visa, Mastercard, JCB พร้อมระบบความปลอดภัย 3D Secure'}
              </p>
            </div>
          )}

          {paymentMethod === 'cash' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-zinc-900 border border-amber-200 dark:border-zinc-800 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2.5">
              <Banknote className="w-5 h-5 text-amber-600 shrink-0" />
              <span>คุณสามารถชำระเงินสดหรือสแกนที่เคาน์เตอร์ร้านเมื่อเรียกหมายเลขคิวของคุณ</span>
            </div>
          )}
        </div>

        {/* Summary note */}
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>ระบบจะส่งคิวเข้าสู่จอครัว (KDS) แบบเรียลไทม์ทันที และสร้างรหัส PIN ยืนยันตัวตน</span>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-stone-500 dark:text-zinc-400">เวลารับอาหาร:</span>
            <div className="text-sm font-bold text-stone-900 dark:text-white">{pickupTime}</div>
          </div>
          <Button
            variant="primary"
            size="lg"
            isLoading={isProcessing}
            onClick={handleConfirmOrder}
            leftIcon={payOnlineViaStripe && paymentMethod !== 'cash' ? <ExternalLink className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          >
            {payOnlineViaStripe && paymentMethod !== 'cash'
              ? `ชำระผ่าน Stripe (฿${grandTotal})`
              : `ยืนยัน & รับบัตรคิว (฿${grandTotal})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
