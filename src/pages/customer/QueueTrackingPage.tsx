import React, { useState, useEffect, useRef } from 'react';
import { useQueue } from '../../context/QueueContext';
import { QueueStatus } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import {
  announceQueueCall,
  sendBrowserNotification,
  requestNotificationPermission,
  getNotificationPermission
} from '../../services/soundService';
import { enablePushNotifications } from '../../services/pushTokenService';
import { auth } from '../../services/firebase';
import { apiClient } from '../../services/apiClient';
import {
  Clock,
  ChefHat,
  BellRing,
  CheckCircle2,
  Store,
  Volume2,
  ExternalLink,
  ReceiptText,
  KeyRound,
  ShieldCheck,
  MessageCircle,
  Info,
  Copy,
  Check,
  Share2,
  Utensils,
  Ticket
} from 'lucide-react';

export const QueueTrackingPage: React.FC = () => {
  const {
    userQueues,
    userActiveQueue,
    activeQueueId,
    setActiveQueueId,
    updateOrderStatus,
    cancelOrder,
    setRole,
    setCurrentView,
    addToast,
    stores,
    openStoreChat,
    openStoreContactAndTerms
  } = useQueue();

  const [copied, setCopied] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return getNotificationPermission();
  });

  const activeQueue = userActiveQueue || userQueues.find(q => q.id === activeQueueId) || userQueues[0] || null;

  const prevStatusRef = useRef(activeQueue?.status);

  const handleRequestNotificationPermission = async () => {
    try {
      const result = await enablePushNotifications();
      if (result.success) {
        setNotificationPermission('granted');
        addToast('เปิดการแจ้งเตือนสำเร็จ', 'ระบบจะส่งข้อความแจ้งเตือนเมื่อคิวของคุณพร้อมรับอาหาร แม้สลับหน้าจอหรือพับโทรศัพท์', 'success');
        sendBrowserNotification('เปิดการแจ้งเตือนสำเร็จ!', {
          body: `คุณจะได้รับการแจ้งเตือนเมื่อคิว #${activeQueue?.queueNumber} พร้อมรับอาหาร`,
          icon: activeQueue?.storeLogo
        });
      } else {
        const perm = getNotificationPermission();
        setNotificationPermission(perm);
        addToast(
          'การแจ้งเตือนยังไม่เปิดใช้งาน',
          result.error === 'PERMISSION_DENIED_OR_UNSUPPORTED'
            ? 'กรุณาอนุญาตการแจ้งเตือนในการตั้งค่าเบราว์เซอร์เพื่อรับการแจ้งเตือน'
            : 'เกิดข้อผิดพลาดในการลงทะเบียนรับการแจ้งเตือน',
          'warning'
        );
      }
    } catch (err) {
      console.warn('[QueueTracking] Notification permission error:', err);
    }
  };

  // Check and verify Stripe Checkout return session
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const orderId = params.get('order_id');
      const payment = params.get('payment');

      const urlOrderId = params.get('orderId') || params.get('order_id');
      if (urlOrderId && payment !== 'success') {
        setActiveQueueId(urlOrderId);
      }

      if (sessionId && orderId && payment === 'success') {
        apiClient.verifyPaymentSession(sessionId, orderId)
          .then(res => {
            if (res.paid) {
              addToast('ชำระเงินสำเร็จ!', 'การชำระเงินสำเร็จแล้ว รอร้านค้ายืนยันรับออเดอร์และออกหมายเลขคิว', 'success');
              updateOrderStatus(orderId, 'PAID_AWAITING_MERCHANT');
              setActiveQueueId(orderId);
            }
          })
          .catch(err => {
            console.warn('[QueueTracking] Payment verification error:', err);
          })
          .finally(() => {
            window.history.replaceState({}, document.title, window.location.pathname);
          });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (activeQueue) {
      if (prevStatusRef.current && prevStatusRef.current !== 'READY' && (activeQueue.status === 'READY' || activeQueue.status === 'READY_FOR_PICKUP')) {
        announceQueueCall(activeQueue.queueNumber, activeQueue.storeName);
        sendBrowserNotification(`🔔 คิว ${activeQueue.queueNumber} พร้อมรับอาหารแล้ว!`, {
          body: `ร้าน ${activeQueue.storeName}: อาหารปรุงเสร็จเรียบร้อย กรุณาแสดงหน้ารหัส PIN หรือบัตรคิวเพื่อรับอาหาร`,
          icon: activeQueue.storeLogo
        });
        addToast('🔔 อาหารพร้อมรับแล้ว!', `คิว ${activeQueue.queueNumber} กรุณาไปรับอาหารที่หน้าร้านค่ะ`, 'success');
      }
      prevStatusRef.current = activeQueue.status;
    }
  }, [activeQueue?.status, activeQueue?.queueNumber, activeQueue?.storeName, activeQueue?.storeLogo]);

  if (!activeQueue) {
    return (
      <div className="py-24 text-center text-stone-500 dark:text-zinc-400 max-w-md mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-orange-100 dark:bg-zinc-800 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-4 border border-orange-200 dark:border-zinc-700">
          <Ticket className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-1">ไม่พบบัตรคิวที่กำลังดำเนินการ</h3>
        <p className="text-xs text-stone-500 dark:text-zinc-400 mb-6">คุณยังไม่มีรายการสั่งอาหารที่รอรับในขณะนี้ สั่งอาหารจากร้านเด็ดเพื่อรับบัตรคิวดิจิทัลแบบเรียลไทม์</p>
        <Button
          variant="primary"
          onClick={() => setCurrentView('home')}
        >
          กลับหน้าหลักเพื่อสั่งอาหาร
        </Button>
      </div>
    );
  }

  const steps: { key: QueueStatus; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      key: 'PAYMENT_PENDING',
      label: 'รอชำระเงิน',
      desc: 'สแกน QR หรือชำระที่ร้าน',
      icon: <Clock className="w-4 h-4" />
    },
    {
      key: 'PAID_AWAITING_MERCHANT',
      label: 'รอร้านรับออเดอร์',
      desc: 'ร้านตรวจสอบคิวและวัตถุดิบ',
      icon: <Clock className="w-4 h-4 animate-spin" />
    },
    {
      key: 'PREPARING',
      label: 'กำลังปรุงอาหาร',
      desc: 'แม่ครัวกำลังจัดเตรียมตามออเดอร์',
      icon: <ChefHat className="w-4 h-4" />
    },
    {
      key: 'READY',
      label: 'พร้อมรับอาหาร',
      desc: 'อาหารปรุงเสร็จแล้ว กรุณาไปรับ',
      icon: <BellRing className="w-4 h-4" />
    },
    {
      key: 'COMPLETED',
      label: 'เสร็จสิ้น',
      desc: 'รับอาหารเรียบร้อย อร่อยกับมื้ออาหาร!',
      icon: <CheckCircle2 className="w-4 h-4" />
    }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === activeQueue.status);

  // Simulated buzzer test & backend push trigger
  const handleSimulateBuzzer = async () => {
    announceQueueCall(activeQueue.queueNumber, activeQueue.storeName);

    // Call backend live push notification test pipeline if authenticated
    try {
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken();
        await fetch('/api/notifications/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({
            title: `🔔 คิว ${activeQueue.queueNumber} พร้อมรับอาหารแล้ว!`,
            body: `ร้าน ${activeQueue.storeName}: อาหารปรุงเสร็จเรียบร้อย กรุณาแสดงหน้ารหัส PIN เพื่อรับอาหาร`,
            deepLink: `/queue-tracking?orderId=${activeQueue.id}`
          })
        });
      }
    } catch (err) {
      console.warn('[QueueTracking] Push test error:', err);
    }

    sendBrowserNotification(`🔔 จำลองเรียกคิว ${activeQueue.queueNumber}`, {
      body: `ร้าน ${activeQueue.storeName}: อาหารปรุงเสร็จแล้วค่ะ!`,
      icon: activeQueue.storeLogo
    });
    addToast('🔊 ทดสอบสัญญาณเรียกคิว', `คิว ${activeQueue.queueNumber} ส่งสัญญาณ Push & เสียงเตือนเรียบร้อยแล้วค่ะ!`, 'success');
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-20 text-stone-900 dark:text-zinc-100">
      {/* Multi-queue selector if user has more than 1 queue */}
      {userQueues.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto p-1 scrollbar-none">
          <span className="text-xs text-stone-500 dark:text-zinc-400 font-bold shrink-0">คิวทั้งหมดของคุณ:</span>
          {userQueues.map(q => (
            <button
              key={q.id}
              onClick={() => setActiveQueueId(q.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                q.id === activeQueue.id
                  ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                  : 'bg-white border-stone-200 text-stone-700 hover:bg-orange-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              คิว {q.queueNumber} ({q.status === 'READY' ? 'พร้อมรับ' : q.status === 'PREPARING' ? 'กำลังทำ' : 'รอ'})
            </button>
          ))}
        </div>
      )}

      {/* Flagship Digital Queue Ticket */}
      <div className="relative rounded-3xl bg-white dark:bg-zinc-950 border border-orange-200/80 dark:border-zinc-800 shadow-xl overflow-hidden">
        {/* Ticket Header Notch */}
        <div className="bg-orange-50/60 dark:bg-black px-4 sm:px-6 py-3.5 border-b border-orange-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <span className="text-xs font-bold text-stone-900 dark:text-zinc-100">{activeQueue.storeName}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quick Chat with Kitchen / Store button */}
            <button
              onClick={() => {
                const targetStore = stores.find(s => s.id === activeQueue.storeId) || stores[0];
                if (targetStore) {
                  openStoreChat(targetStore, activeQueue.id);
                } else {
                  addToast('ระบบแชท', 'ไม่พบข้อมูลร้านค้าในระบบ', 'error');
                }
              }}
              title="แชทติดต่อทางร้านหรือแจ้งแม่ครัว"
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-900 hover:bg-orange-50 dark:hover:bg-zinc-800 border border-orange-200 dark:border-zinc-700 text-[11px] font-bold text-orange-700 dark:text-orange-400 transition-colors cursor-pointer shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>แชทร้าน</span>
            </button>

            {/* Store Contact & Exchange Policy */}
            <button
              onClick={() => {
                const targetStore = stores.find(s => s.id === activeQueue.storeId);
                if (targetStore) {
                  openStoreContactAndTerms(targetStore, 'terms');
                } else {
                  addToast('ข้อกำหนดร้านค้า', 'ร้านค้านี้ปฏิบัติตามมาตรฐานศูนย์อาหาร QueueUp ปลอดภัย สะอาด ได้มาตรฐาน', 'info');
                }
              }}
              title="ดูข้อกำหนดการรับสินค้าและช่องทางติดต่อ"
              className="p-1 rounded-xl bg-white dark:bg-zinc-900 hover:bg-orange-50 dark:hover:bg-zinc-800 border border-orange-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300 transition-colors cursor-pointer shadow-xs"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {/* Browser Push Notification Permission / Status */}
            {typeof window !== 'undefined' && 'Notification' in window && (
              notificationPermission === 'granted' ? (
                <span
                  title="เปิดรับการแจ้งเตือนระดับเบราว์เซอร์แล้ว แม้พับหน้าจอระบบจะส่งสัญญาณเตือน"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"
                >
                  <BellRing className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">แจ้งเตือนเบราว์เซอร์เปิดอยู่</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestNotificationPermission}
                  title="เปิดรับแจ้งเตือนเมื่อคิวพร้อมรับอาหาร (แจ้งเตือนระดับ OS แม้พับหน้าจอ)"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/40 dark:hover:bg-orange-900/50 border border-orange-300 dark:border-orange-800 text-[11px] font-bold text-orange-800 dark:text-orange-300 transition-colors cursor-pointer shadow-2xs"
                >
                  <BellRing className="w-3 h-3 text-orange-600 dark:text-orange-400 animate-pulse" />
                  <span>เปิดเตือนหน้าจอ</span>
                </button>
              )
            )}

            <StatusBadge status={activeQueue.status} size="sm" />
          </div>
        </div>

        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
          <span className="text-xs uppercase tracking-widest text-orange-600 dark:text-orange-400 font-mono font-bold">
            DIGITAL QUEUE PASS
          </span>

          {/* Large Queue Number Hero */}
          <div className="my-4 relative w-full">
            {activeQueue.status === 'PAID_AWAITING_MERCHANT' ? (
              <div className="py-4 px-6 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex flex-col items-center gap-2">
                <span className="animate-spin text-orange-500 text-3xl">⏳</span>
                <span className="text-xl sm:text-2xl font-black text-orange-500 dark:text-orange-400">
                  รอร้านค้ายืนยันรับออเดอร์
                </span>
                <span className="text-xs text-stone-600 dark:text-zinc-400 max-w-xs">
                  ระบบได้บันทึกการชำระเงินของท่านแล้ว เมื่อร้านกดยืนยันรับออเดอร์ หมายเลขคิวจะปรากฏที่นี่ทันที
                </span>
              </div>
            ) : activeQueue.status === 'MERCHANT_REJECTED' ? (
              <div className="py-4 px-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col items-center gap-2">
                <span className="text-rose-500 text-3xl">⚠️</span>
                <span className="text-xl sm:text-2xl font-black text-rose-500">
                  ร้านค้าปฏิเสธออเดอร์
                </span>
                <span className="text-xs text-stone-600 dark:text-zinc-400 max-w-xs">
                  เนื่องจากวัตถุดิบหมดหรือคิวเต็ม ระบบได้ส่งคำสั่งคืนเงินอัตโนมัติเข้าบัญชีของคุณเรียบร้อยแล้ว
                </span>
              </div>
            ) : (
              <>
                <div className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 dark:from-orange-400 dark:via-yellow-400 dark:to-red-400">
                  {activeQueue.queueNumber}
                </div>
                <div className="text-xs text-stone-500 dark:text-zinc-400 font-mono mt-1">
                  สั่งเมื่อ: {new Date(activeQueue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} น.
                </div>
              </>
            )}
          </div>

          {/* Time & Waiting Indicator */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-2">
            <div className="p-3 rounded-2xl bg-orange-50/50 dark:bg-zinc-900 border border-orange-200/70 dark:border-zinc-800 flex flex-col items-center">
              <span className="text-[11px] text-stone-500 dark:text-zinc-400 font-medium">เวลารับโดยประมาณ</span>
              <span className="text-base font-extrabold text-orange-600 dark:text-orange-400 mt-0.5">
                {activeQueue.estimatedCompletionTime} น.
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-orange-50/50 dark:bg-zinc-900 border border-orange-200/70 dark:border-zinc-800 flex flex-col items-center">
              <span className="text-[11px] text-stone-500 dark:text-zinc-400 font-medium">สถานะการชำระ</span>
              <span className="text-base font-extrabold text-stone-900 dark:text-white mt-0.5">
                {activeQueue.paymentStatus === 'PAID' ? 'ชำระแล้ว (PAID)' : 'รอชำระเงิน'}
              </span>
            </div>
          </div>

          {/* Secure 4-Digit Pickup PIN */}
          {activeQueue.exchangePin && (
            <div className="mt-4 px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-zinc-900 border border-amber-300 dark:border-amber-600/50 flex items-center justify-between gap-3 w-full max-w-sm shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-amber-800 dark:text-amber-400 font-bold uppercase tracking-wider block">
                    รหัส PIN รับอาหาร
                  </span>
                  <span className="text-[10px] text-stone-500 dark:text-zinc-400">
                    แจ้งพนักงานเพื่อยืนยันตัวตน
                  </span>
                </div>
              </div>
              <div className="px-3 py-1 rounded-xl bg-white dark:bg-black border border-amber-300 dark:border-amber-500 text-lg font-black font-mono tracking-widest text-amber-900 dark:text-amber-300 shadow-inner">
                {activeQueue.exchangePin}
              </div>
            </div>
          )}

          {/* Step Progression Timeline */}
          <div className="w-full mt-8 pt-6 border-t border-dashed border-orange-200 dark:border-zinc-800">
            <div className="grid grid-cols-4 gap-2 relative">
              {steps.map((step, idx) => {
                const isPassed = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                return (
                  <div key={step.key} className="flex flex-col items-center text-center group">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCurrent
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30 scale-110'
                          : isPassed
                          ? 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/40'
                          : 'bg-stone-100 text-stone-400 dark:bg-zinc-800 dark:text-zinc-500'
                      }`}
                    >
                      {step.icon}
                    </div>
                    <span
                      className={`text-[11px] sm:text-xs font-semibold mt-2 line-clamp-1 ${
                        isCurrent ? 'text-orange-600 font-bold dark:text-orange-400' : isPassed ? 'text-stone-800 dark:text-zinc-200' : 'text-stone-400 dark:text-zinc-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Barcode representation for counter scanning */}
          <div className="mt-8 p-4 rounded-2xl bg-white border border-stone-200 text-stone-900 w-full max-w-xs flex flex-col items-center shadow-xs">
            {/* SVG barcode */}
            <div className="flex items-center justify-between w-full h-12 px-2">
              {[4, 2, 6, 1, 3, 5, 2, 4, 1, 6, 3, 2, 5, 1, 4, 2, 5, 3, 1, 4, 2].map((w, i) => (
                <div key={i} className="bg-black h-full" style={{ width: `${w * 1.5}px` }} />
              ))}
            </div>
            <span className="text-xs font-mono font-black tracking-widest mt-1 text-stone-700">
              *QU-{activeQueue.id.slice(-6).toUpperCase()}*
            </span>
          </div>

          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-3">
            แสดงหน้าจอนี้ให้พนักงานหน้าร้านเมื่อมีสัญญาณเรียก
          </p>
        </div>

        {/* Order Items Breakdown */}
        <div className="p-6 bg-orange-50/40 dark:bg-black border-t border-orange-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-zinc-300 uppercase tracking-wider mb-3">
            <ReceiptText className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            รายการอาหารในคิว ({activeQueue.items.length} รายการ)
          </div>

          <div className="divide-y divide-orange-100 dark:divide-zinc-800/60">
            {activeQueue.items.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-start justify-between text-xs">
                <div>
                  <span className="font-semibold text-stone-900 dark:text-zinc-200">
                    {item.food.name} <span className="text-orange-600 dark:text-orange-400 font-bold">x{item.quantity}</span>
                  </span>
                  {item.selectedOptions.length > 0 && (
                    <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                      {item.selectedOptions.map(o => o.choiceName).join(', ')}
                    </div>
                  )}
                  {item.specialNote && (
                    <div className="text-[10px] text-orange-700 dark:text-amber-300 italic mt-0.5">
                      โน้ต: {item.specialNote}
                    </div>
                  )}
                </div>
                <span className="font-bold text-stone-900 dark:text-zinc-200">฿{item.subtotal}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-orange-100 dark:border-zinc-800 flex justify-between items-center text-sm font-extrabold text-stone-900 dark:text-white">
            <span>ยอดชำระสุทธิ</span>
            <span className="text-orange-600 dark:text-orange-400 text-base">฿{activeQueue.total}</span>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Status Simulator */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-orange-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulateBuzzer}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-100 hover:bg-orange-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-orange-800 dark:text-orange-400 border border-orange-300 dark:border-zinc-700 transition-colors cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            ทดสอบสัญญาณเรียก
          </button>

          {activeQueue.status !== 'COMPLETED' && activeQueue.status !== 'CANCELLED' && (
            <button
              onClick={() => cancelOrder(activeQueue.id)}
              className="text-xs text-red-500 hover:text-red-700 underline font-bold cursor-pointer"
            >
              ยกเลิกคิวนี้
            </button>
          )}
        </div>

        {/* Demo Fast-Forward Status (convenient for testing UI state transitions) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 dark:text-zinc-400">ทดสอบเปลี่ยนสถานะ:</span>
          {activeQueue.status === 'PAYMENT_PENDING' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => updateOrderStatus(activeQueue.id, 'PREPARING')}
            >
              จำลอง: ชำระแล้ว → เริ่มปรุง
            </Button>
          )}
          {activeQueue.status === 'PREPARING' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => updateOrderStatus(activeQueue.id, 'READY')}
            >
              จำลอง: ปรุงเสร็จ → พร้อมรับ!
            </Button>
          )}
          {activeQueue.status === 'READY' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateOrderStatus(activeQueue.id, 'COMPLETED')}
            >
              จำลอง: ลูกค้ารับอาหารแล้ว
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setRole('merchant')}
            rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            เปิดดูในจอครัว KDS
          </Button>
        </div>
      </div>
    </div>
  );
};
