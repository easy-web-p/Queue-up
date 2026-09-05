import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { soundManager } from '../utils/audioNotification.js';
import {
  Clock,
  CheckCircle2,
  Utensils,
  BellRing,
  Store,
  MapPin,
  MessageCircle,
  Tv,
  Volume2,
  QrCode,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X
} from 'lucide-react';

const PHASES = [
  { id: 'PENDING', label: 'รอร้านรับออเดอร์', shortLabel: 'รอยืนยัน', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500' },
  { id: 'CONFIRMED', label: 'ร้านรับออเดอร์แล้ว', shortLabel: 'ยืนยันแล้ว', icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-500' },
  { id: 'PREPARING', label: 'กำลังปรุงอาหารในครัว', shortLabel: 'กำลังปรุง', icon: Utensils, color: 'text-orange-500', bg: 'bg-orange-500' },
  { id: 'READY', label: 'อาหารเสร็จแล้ว พร้อมรับ!', shortLabel: 'พร้อมรับ', icon: BellRing, color: 'text-emerald-500', bg: 'bg-emerald-500' },
  { id: 'COMPLETED', label: 'รับอาหารเสร็จสิ้น', shortLabel: 'สำเร็จ', icon: CheckCircle2, color: 'text-slate-400', bg: 'bg-slate-500' }
];

export const ClientQueueTicket = ({
  activeOrder: initialOrder = null,
  orderId: initialOrderId = undefined,
  onOpenChat = undefined,
  onClose = undefined,
  compact = false
} = {}) => {
  const navigate = useNavigate();
  const [liveOrderOverride, setLiveOrderOverride] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showItemsDetail, setShowItemsDetail] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const prevPhaseIndexRef = useRef(1);
  const resolvedOrderId = initialOrderId || initialOrder?.id || initialOrder?.orderId;

  // 1. Real-time Firestore Synchronization
  useEffect(() => {
    if (!resolvedOrderId || typeof resolvedOrderId !== 'string') return;

    const unsub = onSnapshot(
      doc(db, 'orders', resolvedOrderId),
      (snap) => {
        if (snap.exists()) {
          setLiveOrderOverride({ id: snap.id, ...snap.data() });
        }
      },
      (err) => {
        console.warn('[ClientQueueTicket] Firestore live listener warning:', err);
      }
    );

    return () => unsub();
  }, [resolvedOrderId]);

  // 2. Determine Current Phase Index (1 to 5, or -1 for cancelled)
  const order = liveOrderOverride || initialOrder;
  const statusUpper = (order?.status || '').toUpperCase();
  const queueStatusLower = (order?.queueStatus || '').toLowerCase();

  const isCancelled = statusUpper === 'CANCELLED' || queueStatusLower === 'cancelled';
  const isCompleted = statusUpper === 'COMPLETED' || queueStatusLower === 'completed';
  const isReady = statusUpper === 'READY_FOR_PICKUP' || statusUpper === 'TO_RECEIVE' || queueStatusLower === 'ready';
  const isPreparing = statusUpper === 'PREPARING' || queueStatusLower === 'cooking';
  const isConfirmed = statusUpper === 'CONFIRMED' || queueStatusLower === 'confirmed';

  let currentPhaseIndex = 1;
  if (isCancelled) currentPhaseIndex = -1;
  else if (isCompleted) currentPhaseIndex = 5;
  else if (isReady) currentPhaseIndex = 4;
  else if (isPreparing) currentPhaseIndex = 3;
  else if (isConfirmed) currentPhaseIndex = 2;
  else currentPhaseIndex = 1;

  // 3. Audio Chime Trigger on Transition to Phase 4 (READY)
  useEffect(() => {
    if (currentPhaseIndex === 4 && prevPhaseIndexRef.current < 4) {
      try {
        soundManager.playOrderReadyChime();
      } catch (err) {
        console.warn('Could not play audio chime:', err);
      }
    }
    prevPhaseIndexRef.current = currentPhaseIndex;
  }, [currentPhaseIndex]);

  const handleTestSound = async () => {
    await soundManager.unlockAudio();
    soundManager.playOrderReadyChime();
    setAudioUnlocked(true);
  };

  const handleChatStore = () => {
    if (onOpenChat) {
      onOpenChat(order);
    } else {
      const storeName = order?.storeName || order?.shopName || 'ร้านค้า';
      navigate(`/user/account/profile?tab=bookings&chatOrderId=${resolvedOrderId}&chatStoreName=${encodeURIComponent(storeName)}`);
    }
  };

  if (!order) {
    return (
      <div className="bg-[#1E1915] text-white p-6 rounded-3xl border border-amber-900/30 text-center shadow-lg">
        <Clock className="w-10 h-10 text-amber-500 mb-2 mx-auto animate-pulse" />
        <h6 className="font-bold text-base mb-1">ยังไม่มีคิวอาหารที่กำลังดำเนินการ</h6>
        <p className="text-xs text-stone-400 mb-4">
          สั่งอาหารล่วงหน้าจากศูนย์อาหาร เพื่อรับตั๋วคิวดิจิทัลและการแจ้งเตือนพร้อมรับ
        </p>
        <button
          onClick={() => navigate('/home')}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
        >
          เลือกสั่งอาหารตอนนี้
        </button>
      </div>
    );
  }

  const storeName = order.storeName || order.shopName || (order.storeId ? `ร้านค้า (${order.storeId})` : 'ร้านค้าศูนย์อาหาร');
  const storeLocation = order.storeLocation || order.location || 'จุด Pick-up โรงอาหารกลาง';
  const queueNo = order.queueNumber || order.queueNo || 'Q001';
  const pickupTime = order.pickupTime || order.estimatedReadyTime || '12:00';
  const totalAmount = order.totalAmount ?? order.totalPrice ?? 0;
  const items = order.items || [];

  return (
    <div className={`bg-gradient-to-br from-[#1A1412] via-[#221B17] to-[#16110F] text-white rounded-3xl shadow-2xl border border-amber-500/30 relative overflow-hidden font-['IBM_Plex_Sans_Thai'] ${compact ? 'p-4 space-y-3' : 'p-5 sm:p-6 space-y-5'}`}>
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      {isReady && (
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 animate-pulse" />
      )}

      {/* Top Bar: Store Info, Sound Toggle, Close */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400/80 block">
              Campus Smart Queue
            </span>
            <h4 className="font-black text-sm text-white leading-tight">{storeName}</h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestSound}
            title="ทดสอบและเปิดการแจ้งเตือนด้วยเสียง (Web Audio)"
            className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-amber-400 hover:text-amber-300 border border-stone-700 text-xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">{audioUnlocked ? 'เปิดเสียงแล้ว' : 'ทดสอบเสียง'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hero Queue Number & Status Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-stone-900/60 p-4 rounded-2xl border border-stone-800">
        <div className="text-center sm:text-left">
          <span className="text-xs text-stone-400 font-medium">หมายเลขคิวของคุณ</span>
          <div className="text-5xl sm:text-6xl font-black text-amber-400 tracking-wider font-['Kanit'] my-0.5">
            {queueNo}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>เวลานัดรับ: <b className="text-white">{pickupTime} น.</b></span>
          </div>
        </div>

        <div className="text-center sm:text-right space-y-2">
          {isCancelled ? (
            <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-red-950/80 text-red-400 border border-red-800 text-xs font-black">
              <AlertTriangle className="w-4 h-4" /> ออเดอร์ถูกยกเลิก
            </span>
          ) : isReady ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500 text-stone-950 text-xs font-black shadow-lg shadow-emerald-500/30 animate-bounce">
              <BellRing className="w-4 h-4" /> พร้อมรับอาหารแล้ว!
            </span>
          ) : isPreparing ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 text-xs font-black animate-pulse">
              <Utensils className="w-4 h-4" /> กำลังปรุงอาหารในครัว
            </span>
          ) : isConfirmed ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-xs font-black">
              <CheckCircle2 className="w-4 h-4" /> ร้านรับออเดอร์แล้ว
            </span>
          ) : isCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-700 text-stone-200 text-xs font-black">
              <CheckCircle2 className="w-4 h-4" /> รับอาหารเรียบร้อย
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
              <Clock className="w-4 h-4" /> รอดำเนินการ (PENDING)
            </span>
          )}

          <div className="text-[11px] text-stone-400 flex items-center justify-center sm:justify-end gap-1">
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            <span>{storeLocation}</span>
          </div>
        </div>
      </div>

      {/* 5-Phase Visual Stepper */}
      {!isCancelled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 px-1">
            <span>ความคืบหน้าของอาหาร:</span>
            <span className="text-amber-400">
              {currentPhaseIndex >= 1 && currentPhaseIndex <= 5
                ? PHASES[currentPhaseIndex - 1]?.label
                : 'รอดำเนินการ'}
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="relative pt-2 pb-1">
            <div className="absolute top-5 left-0 w-full h-1 bg-stone-800 -translate-y-1/2 rounded-full" />
            <div
              className="absolute top-5 left-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 -translate-y-1/2 rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(0, Math.min(100, ((currentPhaseIndex - 1) / (PHASES.length - 1)) * 100))}%`
              }}
            />

            <div className="relative flex justify-between">
              {PHASES.map((phase, idx) => {
                const phaseNum = idx + 1;
                const isPassed = currentPhaseIndex >= phaseNum;
                const isCurrent = currentPhaseIndex === phaseNum;
                const IconComponent = phase.icon;

                return (
                  <div key={phase.id} className="flex flex-col items-center group">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        isCurrent
                          ? `${phase.bg} text-stone-950 ring-4 ring-amber-400/20 scale-110 shadow-lg`
                          : isPassed
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-800 text-stone-500 border border-stone-700'
                      }`}
                    >
                      <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span
                      className={`text-[10px] mt-1.5 font-bold transition-colors ${
                        isCurrent
                          ? 'text-amber-400'
                          : isPassed
                          ? 'text-stone-300'
                          : 'text-stone-600'
                      }`}
                    >
                      {phase.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Ordered Items List */}
      <div className="bg-stone-900/40 rounded-2xl border border-stone-800 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowItemsDetail(!showItemsDetail)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-300 hover:text-white transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-amber-500" />
            รายการอาหาร ({items.length} รายการ) • ยอดรวม ฿{Number(totalAmount).toFixed(2)}
          </span>
          {showItemsDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showItemsDetail && (
          <div className="px-4 pb-3 pt-1 border-t border-stone-800/80 space-y-1.5 text-xs text-stone-300">
            {items.map((it, i) => {
              const name = it.menuItem?.name || it.name || 'รายการอาหาร';
              const price = it.menuItem?.price || it.price || 0;
              const q = it.quantity || it.qty || 1;
              return (
                <div key={i} className="flex justify-between items-center py-0.5">
                  <div className="truncate pr-2">
                    <span className="text-white font-medium">• {name}</span>
                    <span className="text-stone-500 ml-1">x{q}</span>
                    {it.notes && <span className="text-stone-400 text-[10px] block pl-3">({it.notes})</span>}
                  </div>
                  <span className="font-bold text-amber-400/90 shrink-0">฿{(price * q).toFixed(2)}</span>
                </div>
              );
            })}
            <div className="flex justify-between font-bold text-amber-400 border-t border-stone-800 pt-2 mt-2">
              <span>รวมทั้งสิ้น:</span>
              <span>฿{Number(totalAmount).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons: Chat, Canteen Monitor, Pickup Token */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          onClick={handleChatStore}
          className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-stone-700 transition-colors cursor-pointer"
        >
          <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
          <span className="truncate">แชทร้านค้า</span>
        </button>

        <Link
          to="/campus/monitor"
          className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-stone-700 transition-colors text-center truncate"
        >
          <Tv className="w-3.5 h-3.5 text-[#FF7A1A]" />
          <span className="truncate">จอมอนิเตอร์</span>
        </Link>

        <button
          type="button"
          onClick={() => setShowQrModal(true)}
          className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer truncate"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span className="truncate">รหัสรับอาหาร</span>
        </button>
      </div>

      {/* Digital Pickup Code & QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-stone-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-stone-200 text-center space-y-4 animate-scale-in">
            <div className="flex justify-between items-center pb-2 border-b border-stone-200">
              <span className="text-xs font-black uppercase text-amber-700">Digital Pickup Token</span>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-full hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <span className="text-xs text-stone-500 block">แสดงหมายเลขนี้ให้ร้านค้าเมื่อถึงคิว</span>
              <div className="text-5xl font-black text-amber-600 font-['Kanit'] my-2">{queueNo}</div>
              <p className="text-xs font-medium text-stone-600">
                ร้านค้า: <b>{storeName}</b>
              </p>
            </div>

            {/* Simulated Digital Barcode & Token */}
            <div className="bg-stone-50 p-4 rounded-2xl border-2 border-dashed border-stone-300">
              <div className="font-mono text-sm tracking-widest font-black text-stone-800 mb-1">
                {resolvedOrderId ? `TOKEN-${String(resolvedOrderId).slice(-8).toUpperCase()}` : `ORDER-${queueNo}`}
              </div>
              <div className="h-12 flex items-center justify-center gap-1 my-2">
                {[4, 2, 6, 3, 5, 2, 7, 4, 3, 6, 2, 5, 4, 3, 6, 2, 4, 5, 3].map((h, idx) => (
                  <div key={idx} className="bg-stone-800 rounded-sm w-1 sm:w-1.5" style={{ height: `${h * 5}px` }} />
                ))}
              </div>
              <span className="text-[10px] text-stone-400 block">สแกนหรือแจ้งหมายเลขคิวหน้าร้าน</span>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientQueueTicket;
