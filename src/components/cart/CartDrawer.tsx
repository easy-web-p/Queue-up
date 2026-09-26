import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { CheckoutModal } from './CheckoutModal';
import { apiClient, SlotCapacityInfo } from '../../services/apiClient';
import {
  getCanonicalSlotId,
  formatSlotDisplay,
  getTodayDateString,
  getUpcomingSlots
} from '../../services/engines/slotHelper';
import {
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShoppingBag,
  Clock,
  Zap,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown
} from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateCartQuantity,
    cartTotal,
    clearCart,
    currentUser,
    addToast
  } = useQueue();

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [pickupType, setPickupType] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [capacitySlots, setCapacitySlots] = useState<SlotCapacityInfo[]>([]);
  const [isLoadingCapacity, setIsLoadingCapacity] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [reservationData, setReservationData] = useState<{
    reservationId: string;
    slotId: string;
    expiresAt: number;
  } | null>(null);

  const discountAmount = cartTotal > 200 ? 20 : 0;
  const grandTotal = Math.max(0, cartTotal - discountAmount);
  const activeStoreId = cart[0]?.food?.storeId || 'store-1';
  const activeStoreName = cart[0]?.food?.storeName || 'ร้านค้า';

  // 1. Calculate Authoritative Workload Points of the current cart
  const cartWorkload = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [cart]);

  // 2. Canonical current 15-minute slot for "NOW"
  const currentSlotId = useMemo(() => getCanonicalSlotId(), []);

  // 3. Upcoming 15-minute slots for "SCHEDULED"
  const upcomingSlots = useMemo(() => getUpcomingSlots(8), []);

  // Initialize selectedSlotId once
  useEffect(() => {
    if (!selectedSlotId) {
      setSelectedSlotId(currentSlotId);
    }
  }, [currentSlotId, selectedSlotId]);

  // 4. Fetch live capacity data from Express backend for the active store & today
  const loadCapacityData = useCallback(async () => {
    if (!activeStoreId) return;
    try {
      setIsLoadingCapacity(true);
      const todayStr = getTodayDateString();
      const res = await apiClient.getCapacity(activeStoreId, todayStr);
      if (res && Array.isArray(res.slots)) {
        setCapacitySlots(res.slots);
      }
    } catch (err) {
      console.warn('[CartDrawer] Could not fetch capacity slots:', err);
    } finally {
      setIsLoadingCapacity(false);
    }
  }, [activeStoreId]);

  useEffect(() => {
    if (isCartOpen && cart.length > 0) {
      loadCapacityData();
    }
  }, [isCartOpen, cart.length, loadCapacityData]);

  // Helper: Get capacity metrics for any slot
  const getSlotMetrics = (slotId: string): SlotCapacityInfo | undefined => {
    return capacitySlots.find(s => s.slotId === slotId);
  };

  // Active target slot ID based on pickup mode
  const effectiveSlotId = pickupType === 'NOW' ? currentSlotId : selectedSlotId;
  const activeSlotMetrics = getSlotMetrics(effectiveSlotId);

  // Check if active slot has sufficient capacity for cart workload
  const isSlotFull = useMemo(() => {
    if (!activeSlotMetrics) return false;
    return (
      activeSlotMetrics.status === 'FULL' ||
      activeSlotMetrics.remainingWorkload < cartWorkload
    );
  }, [activeSlotMetrics, cartWorkload]);

  // Human-readable pickup label
  const displayPickupTime = useMemo(() => {
    if (pickupType === 'NOW') {
      return `ทันที (${formatSlotDisplay(currentSlotId)})`;
    }
    return formatSlotDisplay(effectiveSlotId);
  }, [pickupType, currentSlotId, effectiveSlotId]);

  // 5. Reserve slot atomically before opening checkout modal
  const handleOpenCheckout = async () => {
    if (cart.length === 0) return;

    if (isSlotFull) {
      addToast(
        'สล็อตเวลานี้มีคิวเต็มแล้ว',
        `รอบเวลานี้เหลือความจุ ${activeSlotMetrics?.remainingWorkload ?? 0} หน่วย แต่ออเดอร์ของคุณต้องใช้ ${cartWorkload} หน่วย กรุณาเลือกรอบเวลาถัดไปค่ะ`,
        'warning'
      );
      return;
    }

    setIsReserving(true);
    try {
      const result = await apiClient.reserveCapacity({
        storeId: activeStoreId,
        scheduledSlotId: effectiveSlotId,
        pickupType,
        customerId: currentUser?.id || 'guest-user',
        schoolId: currentUser?.schoolId || 'school-default',
        items: cart.map(i => ({
          menuItemId: i.food.id,
          quantity: i.quantity,
          workload: 1
        })),
        ttlMs: 10 * 60 * 1000 // 10 minutes TTL
      });

      setReservationData({
        reservationId: result.reservationId,
        slotId: result.slotId,
        expiresAt: result.expiresAt
      });

      setIsCheckoutModalOpen(true);
    } catch (err: any) {
      console.error('[CartDrawer] Reservation error:', err);
      addToast(
        'โควตาครัวไม่เพียงพอ',
        err.message || 'ครัวไม่สามารถรับออเดอร์เพิ่มในรอบเวลานี้ได้ กรุณาเลือกรอบเวลาอื่น',
        'error'
      );
      // Refresh capacity to reflect current state
      loadCapacityData();
    } finally {
      setIsReserving(false);
    }
  };

  return (
    <>
      <Drawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        title="ตะกร้าสินค้า & การจอง"
        subtitle={cart.length > 0 ? `${cart.length} รายการจากร้านค้า` : undefined}
      >
        {cart.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<ShoppingBag className="w-10 h-10 text-orange-500" />}
              title="ไม่มีรายการในตะกร้า"
              description="เลือกเมนูอาหารแสนอร่อยที่คุณชื่นชอบ แล้วกดสั่งซื้อเพื่อรับบัตรคิวออนไลน์ได้ทันที"
              actionText="เลือกดูเมนูอาหาร"
              onAction={() => setIsCartOpen(false)}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full justify-between gap-6 text-stone-900 dark:text-zinc-100">
            {/* Cart Items List */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-orange-100 dark:border-zinc-800">
                <span className="text-xs font-semibold text-stone-600 dark:text-zinc-400">
                  ร้าน: <span className="text-orange-600 font-bold dark:text-orange-400">{activeStoreName}</span>
                </span>
                <button
                  onClick={clearCart}
                  className="text-xs text-red-600 hover:text-red-700 font-bold transition-colors cursor-pointer dark:text-red-400"
                >
                  ล้างตะกร้า
                </button>
              </div>

              {cart.map(item => (
                <div
                  key={item.cartItemId}
                  className="p-3.5 rounded-2xl bg-white border border-orange-200/80 dark:bg-zinc-950 dark:border-zinc-800 flex gap-3.5 items-start shadow-xs"
                >
                  <img
                    src={item.food.image}
                    alt={item.food.name}
                    className="w-16 h-16 rounded-xl object-cover shrink-0 border border-orange-100 dark:border-zinc-700"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-stone-900 dark:text-white line-clamp-1">
                        {item.food.name}
                      </h4>
                      <button
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="text-stone-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                        aria-label="ลบรายการ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Selected Options summary */}
                    {item.selectedOptions.length > 0 && (
                      <div className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1 space-y-0.5">
                        {item.selectedOptions.map((opt, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>• {opt.choiceName}</span>
                            {opt.priceDelta > 0 && <span>+{opt.priceDelta}฿</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Special instruction note */}
                    {item.specialNote && (
                      <p className="text-[11px] text-orange-700 dark:text-amber-300 italic mt-1 bg-orange-50 dark:bg-zinc-900 px-2 py-0.5 rounded border border-orange-200/60 dark:border-zinc-800">
                        หมายเหตุ: {item.specialNote}
                      </p>
                    )}

                    {/* Quantity & Subtotal */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-orange-100 dark:border-zinc-800/80">
                      <div className="flex items-center bg-stone-100 dark:bg-zinc-900 px-2 py-1 rounded-lg border border-stone-200 dark:border-zinc-800">
                        <button
                          onClick={() => updateCartQuantity(item.cartItemId, -1)}
                          className="text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                          aria-label="ลดจำนวน"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold w-4 text-center text-stone-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.cartItemId, 1)}
                          className="text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                          aria-label="เพิ่มจำนวน"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
                        ฿{item.subtotal}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* ============================================================== */}
              {/* SMART PRE-ORDER & DYNAMIC CAPACITY PICKUP BLOCK                 */}
              {/* ============================================================== */}
              <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200/90 dark:bg-zinc-950 dark:border-zinc-800 mt-2 space-y-3 shadow-xs">
                {/* Header with Kitchen Workload Metrics */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-800 dark:text-zinc-200">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span>เวลารับอาหาร / จองรอบคิว</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60">
                    ภาระครัว: {cartWorkload} หน่วย
                  </span>
                </div>

                {/* Mode Selector Tabs: NOW vs SCHEDULED */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/80 dark:bg-zinc-900 rounded-xl border border-orange-200/60 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setPickupType('NOW');
                      setSelectedSlotId(currentSlotId);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      pickupType === 'NOW'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    รับทันที (รอบนี้)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPickupType('SCHEDULED');
                      if (upcomingSlots.length > 0 && selectedSlotId === currentSlotId) {
                        setSelectedSlotId(upcomingSlots[0].slotId);
                      }
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      pickupType === 'SCHEDULED'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    จองรอบล่วงหน้า
                  </button>
                </div>

                {/* Tab 1: NOW Mode Content */}
                {pickupType === 'NOW' && (
                  <div className="p-3 bg-white dark:bg-zinc-900/90 rounded-xl border border-orange-100 dark:border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-600 dark:text-zinc-400 font-medium">
                        รอบเวลารับประทาน:
                      </span>
                      <span className="font-extrabold text-stone-900 dark:text-white">
                        {formatSlotDisplay(currentSlotId)}
                      </span>
                    </div>

                    {/* Capacity Telemetry Badge */}
                    <div className="flex items-center gap-1.5 text-xs pt-1 border-t border-stone-100 dark:border-zinc-800">
                      {isLoadingCapacity ? (
                        <div className="flex items-center gap-1 text-stone-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังตรวจสอบสถานะครัว...</span>
                        </div>
                      ) : activeSlotMetrics?.status === 'FULL' || (activeSlotMetrics && activeSlotMetrics.remainingWorkload < cartWorkload) ? (
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>ครัวเต็มสำหรับรอบนี้ (เหลือ {activeSlotMetrics?.remainingWorkload ?? 0} หน่วย)</span>
                        </div>
                      ) : activeSlotMetrics?.status === 'NEAR_CAPACITY' ? (
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>คิวหนาแน่น (รับได้อีก {activeSlotMetrics.remainingWorkload} หน่วย)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>ครัวพร้อมปรุง (รับได้อีก {activeSlotMetrics?.remainingWorkload ?? 30} หน่วย)</span>
                        </div>
                      )}
                    </div>

                    {/* Prompt to switch if NOW is full */}
                    {isSlotFull && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-900/60">
                        ⚠️ ครัวไม่สามารถรับออเดอร์ทันทีได้ กรุณากดแถบ <b>"จองรอบล่วงหน้า"</b> เพื่อเลือกรอบเวลาถัดไป
                      </p>
                    )}
                  </div>
                )}

                {/* Tab 2: SCHEDULED Mode Content */}
                {pickupType === 'SCHEDULED' && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400">
                      เลือกรอบเวลา 15 นาทีที่สะดวกมารับ:
                    </span>

                    {/* Quick selection chips for the next 3 upcoming slots */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {upcomingSlots.slice(0, 3).map(slot => {
                        const metrics = getSlotMetrics(slot.slotId);
                        const isOverloaded = metrics ? (metrics.status === 'FULL' || metrics.remainingWorkload < cartWorkload) : false;
                        const isSelected = selectedSlotId === slot.slotId;

                        return (
                          <button
                            key={slot.slotId}
                            type="button"
                            disabled={isOverloaded}
                            onClick={() => setSelectedSlotId(slot.slotId)}
                            className={`p-2 rounded-xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                              isOverloaded
                                ? 'bg-stone-100 border-stone-200 text-stone-400 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600 opacity-60 cursor-not-allowed'
                                : isSelected
                                ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                                : 'bg-white border-orange-200 text-stone-700 hover:bg-orange-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            <span className="text-xs font-bold">{slot.startTime}</span>
                            <span className={`text-[10px] ${
                              isOverloaded
                                ? 'text-red-500 dark:text-red-400 font-bold'
                                : isSelected
                                ? 'text-orange-100'
                                : 'text-stone-500 dark:text-zinc-400'
                            }`}>
                              {isOverloaded ? 'เต็ม' : metrics ? `เหลือ ${metrics.remainingWorkload}` : 'ว่าง'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Dropdown for all available slots of the day */}
                    <div className="relative pt-1">
                      <select
                        value={selectedSlotId}
                        onChange={e => setSelectedSlotId(e.target.value)}
                        className="w-full text-xs font-semibold py-2 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-orange-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      >
                        {upcomingSlots.map(slot => {
                          const metrics = getSlotMetrics(slot.slotId);
                          const isOverloaded = metrics ? (metrics.status === 'FULL' || metrics.remainingWorkload < cartWorkload) : false;
                          return (
                            <option
                              key={slot.slotId}
                              value={slot.slotId}
                              disabled={isOverloaded}
                            >
                              {slot.displayTime} {isOverloaded ? '🔴 [เต็ม]' : metrics ? `🟢 [ว่าง ${metrics.remainingWorkload} หน่วย]` : '🟢 [ว่าง]'}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-3.5 pointer-events-none" />
                    </div>

                    {/* Capacity Warning if selected scheduled slot is full */}
                    {isSlotFull && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-900/60 font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>รอบเวลานี้มีกำลังผลิตไม่พอ (ต้องการ {cartWorkload} หน่วย) กรุณาเลือกรอบอื่น</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Price Summary & Primary CTA */}
            <div className="pt-4 border-t border-orange-100 dark:border-zinc-800 flex flex-col gap-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-500 dark:text-zinc-400">
                  <span>ยอดรวมค่าอาหาร (Subtotal)</span>
                  <span className="text-stone-900 dark:text-zinc-200 font-semibold">฿{cartTotal}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-red-600 dark:text-orange-400 font-bold">
                    <span>ส่วนลดโปรโมชั่นพิเศษ</span>
                    <span>-฿{discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-stone-900 dark:text-white pt-2 border-t border-orange-100 dark:border-zinc-800">
                  <span>ยอดชำระสุทธิ (Total)</span>
                  <span className="text-xl text-orange-600 dark:text-orange-400">฿{grandTotal}</span>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isSlotFull || isReserving || cart.length === 0}
                onClick={handleOpenCheckout}
                rightIcon={isReserving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              >
                {isReserving
                  ? 'กำลังจองโควตาครัว...'
                  : isSlotFull
                  ? 'รอบเวลานี้เต็มแล้ว (กรุณาเปลี่ยนรอบ)'
                  : 'ดำเนินการชำระเงิน & รับคิว'}
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
        pickupTime={displayPickupTime}
        reservationId={reservationData?.reservationId}
        slotId={reservationData?.slotId}
      />
    </>
  );
};
