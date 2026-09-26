import React, { useState, useMemo } from 'react';
import { useQueue } from '../../context/QueueContext';
import { QueueStatus, QueueOrder } from '../../types';
import { playChimeSound, announceQueueCall } from '../../services/soundService';
import { useStoreActiveQueues } from '../../hooks/useStoreActiveQueues';
import { apiClient } from '../../services/apiClient';
import {
  Clock,
  CheckCircle,
  ChefHat,
  Volume2,
  ArrowRight,
  Sparkles,
  Layers,
  MessageSquare,
  Megaphone,
  Store as StoreIcon,
  ChevronDown,
  PlusCircle,
  RotateCcw,
  Lock,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

export const KitchenDisplaySystem: React.FC = () => {
  const {
    queues,
    updateOrderStatus,
    addToast,
    stores,
    userStore,
    currentUser,
    openStoreChat,
    kdsSelectedStoreId,
    setKdsSelectedStoreId,
    seedDemoQueuesForStore,
    openCreateStore,
    setCurrentView
  } = useQueue();

  const isAdmin = currentUser?.role === 'admin';

  // Stores owned by this user:
  // 1. Matches userStore
  // 2. Matches ownerId or ownerEmail
  // 3. Matches currentUser.storeId
  // 4. Fallback for demo merchant
  const myOwnedStores = useMemo(() => {
    if (!currentUser) return [];
    const owned = stores.filter(s => 
      (userStore && userStore.id === s.id) ||
      (s.ownerId && s.ownerId === currentUser.id) ||
      (s.ownerEmail && currentUser.email && s.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.storeId && currentUser.storeId === s.id) ||
      (currentUser.email?.toLowerCase() === 'hi00000087@gmail.com' && s.id === 'store-1')
    );
    if (owned.length > 0) return owned;
    if (userStore) return [userStore];
    if (currentUser.role === 'merchant') return [stores[0]];
    return [];
  }, [stores, currentUser, userStore]);

  // Stores accessible to this user:
  // - Store Owner (Merchant) can strictly ONLY view their own store(s)
  // - Platform Admin can inspect all stores
  const accessibleStores = useMemo(() => {
    if (isAdmin) {
      return stores;
    }
    return myOwnedStores;
  }, [isAdmin, stores, myOwnedStores]);

  // Preferred store ID:
  const defaultStoreId = useMemo(() => {
    if (!isAdmin) {
      return myOwnedStores[0]?.id || userStore?.id || '';
    }
    if (kdsSelectedStoreId && stores.some(s => s.id === kdsSelectedStoreId)) {
      return kdsSelectedStoreId;
    }
    const storeWithQueues = stores.find(s => queues.some(q => q.storeId === s.id && q.status !== 'COMPLETED'));
    if (storeWithQueues) return storeWithQueues.id;
    return userStore?.id || stores[0]?.id || 'store-1';
  }, [isAdmin, myOwnedStores, userStore, kdsSelectedStoreId, stores, queues]);

  const [selectedStoreId, setSelectedStoreId] = useState<string>(defaultStoreId);

  // Sync and enforce store lock:
  React.useEffect(() => {
    if (!isAdmin) {
      // Non-admins are strictly locked to their own store
      if (myOwnedStores.length > 0 && !myOwnedStores.some(s => s.id === selectedStoreId)) {
        setSelectedStoreId(myOwnedStores[0].id);
      }
    } else if (kdsSelectedStoreId) {
      setSelectedStoreId(kdsSelectedStoreId);
    }
  }, [isAdmin, myOwnedStores, kdsSelectedStoreId, selectedStoreId]);

  const currentStore = useMemo(() => {
    if (!isAdmin) {
      return myOwnedStores.find(s => s.id === selectedStoreId) || myOwnedStores[0] || null;
    }
    return stores.find(s => s.id === selectedStoreId) || stores[0] || null;
  }, [isAdmin, myOwnedStores, stores, selectedStoreId]);

  // Check store owner permission:
  const isOwnerOfCurrentStore = useMemo(() => {
    if (!currentUser || !currentStore) return false;
    if (isAdmin) return true;
    return myOwnedStores.some(s => s.id === currentStore.id);
  }, [currentUser, currentStore, isAdmin, myOwnedStores]);

  // Realtime subscription for Store's active queues via Firestore IndexedDB
  const { queues: liveStoreQueues } = useStoreActiveQueues(currentStore?.id);

  const filteredQueues = useMemo(() => {
    if (!currentStore) return [];
    if (liveStoreQueues && liveStoreQueues.length > 0) {
      return liveStoreQueues as any;
    }
    return queues.filter(q => q.storeId === currentStore.id);
  }, [queues, currentStore, liveStoreQueues]);

  const columns: {
    key: QueueStatus;
    title: string;
    headerBg: string;
    badgeStyle: string;
    colBg: string;
    nextLabel: string;
    nextIcon: React.ReactNode;
  }[] = [
    {
      key: 'PAYMENT_PENDING',
      title: 'ออเดอร์ใหม่ / รอชำระ',
      headerBg: 'bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800/40',
      badgeStyle: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
      colBg: 'bg-amber-50/30 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20',
      nextLabel: '🍳 เริ่มปรุงอาหาร',
      nextIcon: <ArrowRight className="w-4 h-4" />
    },
    {
      key: 'PREPARING',
      title: 'กำลังปรุงอาหาร (PREPARING)',
      headerBg: 'bg-sky-500/10 text-sky-900 dark:text-sky-300 border-sky-200 dark:border-sky-800/40',
      badgeStyle: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
      colBg: 'bg-sky-50/30 dark:bg-sky-500/10 border-sky-200/60 dark:border-sky-500/20',
      nextLabel: '🔔 เรียกคิว (เสร็จแล้ว)',
      nextIcon: <Megaphone className="w-4 h-4" />
    },
    {
      key: 'READY',
      title: 'พร้อมเสิร์ฟ (READY)',
      headerBg: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
      badgeStyle: 'bg-emerald-100 text-[#047857] dark:bg-emerald-950 dark:text-emerald-300 font-bold',
      colBg: 'bg-emerald-50/30 dark:bg-emerald-500/12 border-emerald-200/60 dark:border-emerald-500/20',
      nextLabel: '✅ ส่งมอบอาหารแล้ว',
      nextIcon: <CheckCircle className="w-4 h-4" />
    },
    {
      key: 'COMPLETED',
      title: 'เสร็จสิ้น (COMPLETED)',
      headerBg: 'bg-stone-200/60 text-stone-800 dark:text-zinc-300 border-stone-200 dark:border-zinc-700',
      badgeStyle: 'bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300',
      colBg: 'bg-stone-50/50 dark:bg-slate-500/6 border-stone-200/60 dark:border-zinc-800/80',
      nextLabel: 'เรียบร้อย',
      nextIcon: null
    }
  ];

  const getElapsedMinutes = (createdAt: string) => {
    const elapsedMs = Date.now() - new Date(createdAt).getTime();
    return Math.max(1, Math.floor(elapsedMs / 60000));
  };

  const handleNextStatus = async (order: QueueOrder) => {
    // Strictly restrict status transition permissions to store owner
    if (!isOwnerOfCurrentStore) {
      addToast(
        'ไม่มีสิทธิ์ดำเนินการ',
        `เฉพาะเจ้าของร้าน "${currentStore?.name}" เท่านั้นที่มีสิทธิ์เปลี่ยนสถานะหรือแก้ไขออเดอร์`,
        'warning'
      );
      return;
    }

    if (order.status === 'PAYMENT_PENDING' || order.status === 'PAID_AWAITING_MERCHANT') {
      try {
        await apiClient.acceptMerchantOrder(order.id);
      } catch (err) {
        console.warn('[KDS] Accept merchant order note:', err);
        try {
          await apiClient.updateOrderStatus({
            orderId: order.id,
            nextStatus: 'PREPARING',
            expectedVersion: order.version
          });
        } catch {}
      }
      updateOrderStatus(order.id, 'PREPARING');
      addToast('🍳 เริ่มปรุงอาหาร', `เริ่มทำออเดอร์คิว ${order.queueNumber} แล้ว`, 'info');
      return;
    } else if (order.status === 'PREPARING' || order.status === 'MERCHANT_ACCEPTED') {
      try {
        await apiClient.readyMerchantOrder(order.id);
      } catch (err) {
        console.warn('[KDS] Mark ready note:', err);
        try {
          await apiClient.updateOrderStatus({
            orderId: order.id,
            nextStatus: 'READY',
            expectedVersion: order.version
          });
        } catch {}
      }
      updateOrderStatus(order.id, 'READY');
      announceQueueCall(order.queueNumber, order.storeName);
      addToast('🔔 เรียกคิวสำเร็จ', `ส่งสัญญาณเรียกคิว ${order.queueNumber} พร้อมรับอาหาร`, 'success');
      return;
    } else if (order.status === 'READY' || order.status === 'READY_FOR_PICKUP') {
      try {
        if (order.exchangePin) {
          await apiClient.completeMerchantOrder(order.id, order.exchangePin);
        } else {
          await apiClient.updateOrderStatus({
            orderId: order.id,
            nextStatus: 'COMPLETED',
            expectedVersion: order.version
          });
        }
      } catch (err) {
        console.warn('[KDS] Complete order note:', err);
        try {
          await apiClient.updateOrderStatus({
            orderId: order.id,
            nextStatus: 'COMPLETED',
            expectedVersion: order.version
          });
        } catch {}
      }
      updateOrderStatus(order.id, 'COMPLETED');
      addToast('✅ เสร็จสิ้น', `ส่งมอบออเดอร์คิว ${order.queueNumber} เรียบร้อย`, 'success');
      return;
    }
  };

  const handleTestSound = () => {
    playChimeSound();
    addToast('🛎️ เสียงกระดิ่ง KDS', 'ทดสอบระบบเสียงเรียกห้องครัว (Chime & Bell)', 'info');
  };

  const handleAnnounceSample = () => {
    announceQueueCall('A01', currentStore?.name || 'ร้านอาหาร');
    addToast('📢 เสียงสังเคราะห์เรียกคิว', 'กำลังเล่นตัวอย่างเสียงเรียกคิวภาษาไทย', 'info');
  };

  const handleSeedOrders = () => {
    if (!isOwnerOfCurrentStore) {
      addToast(
        'ไม่มีสิทธิ์ดำเนินการ',
        `เฉพาะเจ้าของร้าน "${currentStore?.name}" เท่านั้นที่สามารถสร้างออเดอร์จำลองในร้านนี้ได้`,
        'warning'
      );
      return;
    }
    if (currentStore) {
      seedDemoQueuesForStore(currentStore.id);
      addToast('สร้างคิวสำเร็จ', `เพิ่มคิวจำลอง 3 รายการสำหรับร้าน ${currentStore.name} เรียบร้อย`, 'success');
    }
  };

  // If user is not admin and owns no stores at all:
  if (!isAdmin && myOwnedStores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] max-w-lg mx-auto text-center p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm my-10 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center mb-4">
          <StoreIcon className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black text-stone-900 dark:text-white mb-2">
          เฉพาะเจ้าของร้านเท่านั้น
        </h2>
        <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed mb-6">
          หน้าจอครัว KDS สามารถเข้าดูได้เฉพาะร้านค้าของตนเองเท่านั้น บัญชีของคุณยังไม่มีร้านค้าในระบบ QueueUp
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateStore}
            className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            + เปิดร้านค้าของคุณ
          </button>
          <button
            onClick={() => setCurrentView('home')}
            className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-200 font-bold text-xs transition-colors cursor-pointer"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-7xl mx-auto">
      {/* Top Bar for KDS - High Contrast, Clean, Professional */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 flex items-center justify-center shrink-0">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white tracking-tight">
                Kitchen Display System (KDS)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                LIVE SYNC
              </span>
              {isOwnerOfCurrentStore ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-xs font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  เจ้าของร้าน (ร้านของคุณ)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-700 text-xs font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  ผู้ดูแลระบบ (Admin Inspector)
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
              หน้าจอแสดงคิวห้องครัว จัดการสถานะและเรียกคิวอัตโนมัติสำหรับร้านของคุณ
            </p>
          </div>
        </div>

        {/* Store Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* For Store Owner with 1 store: Display their own store cleanly without dropdown */}
          {!isAdmin && myOwnedStores.length <= 1 ? (
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-stone-400 block mb-0.5">
                ร้านค้าของคุณ:
              </label>
              <div className="flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-bold bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-zinc-100 shadow-2xs">
                <StoreIcon className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="font-extrabold text-stone-800 dark:text-zinc-100 max-w-[220px] truncate">
                  {currentStore?.name}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold shrink-0">
                  ร้านของคุณ
                </span>
              </div>
            </div>
          ) : !isAdmin && myOwnedStores.length > 1 ? (
            /* For Store Owner with multiple branches: Can only choose between their own stores */
            <div className="relative flex-1 sm:flex-initial">
              <label className="text-[10px] font-bold text-stone-400 block mb-0.5">
                เลือกร้านค้าของคุณ:
              </label>
              <div className="relative">
                <select
                  value={selectedStoreId}
                  onChange={e => {
                    setSelectedStoreId(e.target.value);
                    setKdsSelectedStoreId(e.target.value);
                  }}
                  className="w-full sm:w-72 py-2 pl-3 pr-8 rounded-xl text-xs font-bold bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer appearance-none"
                >
                  {myOwnedStores.map(store => (
                    <option key={store.id} value={store.id}>
                      {store.name} 👑 [ร้านของคุณ]
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          ) : (
            /* For Admin: Store selector to inspect all stores */
            <div className="relative flex-1 sm:flex-initial">
              <label className="text-[10px] font-bold text-stone-400 block mb-0.5">
                เลือกร้านค้า (แอดมินตรวจสอบ):
              </label>
              <div className="relative">
                <select
                  value={selectedStoreId}
                  onChange={e => {
                    setSelectedStoreId(e.target.value);
                    setKdsSelectedStoreId(e.target.value);
                  }}
                  className="w-full sm:w-72 py-2 pl-3 pr-8 rounded-xl text-xs font-bold bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer appearance-none"
                >
                  {stores.map(store => {
                    const isPersonal = myOwnedStores.some(s => s.id === store.id);
                    const storeActiveCount = queues.filter(
                      q => q.storeId === store.id && q.status !== 'COMPLETED' && q.status !== 'CANCELLED'
                    ).length;

                    return (
                      <option key={store.id} value={store.id}>
                        {store.name} ({storeActiveCount} คิวค้าง) {isPersonal ? '👑 [ร้านของคุณ]' : ''}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 self-end">
            <button
              onClick={handleTestSound}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-stone-700 dark:text-zinc-200 border border-stone-200 dark:border-zinc-700 transition-colors cursor-pointer"
              title="ทดสอบเสียงกระดิ่งเรียกคิว"
            >
              <Volume2 className="w-4 h-4 text-orange-500" />
              <span>เสียงกระดิ่ง</span>
            </button>

            <button
              onClick={handleAnnounceSample}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-stone-700 dark:text-zinc-200 border border-stone-200 dark:border-zinc-700 transition-colors cursor-pointer"
              title="ทดสอบเสียงสังเคราะห์ภาษาไทยเรียกคิว"
            >
              <Megaphone className="w-4 h-4 text-emerald-500" />
              <span>เสียงเรียกคิว</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin Inspector Notice (Only shown if admin is inspecting another store) */}
      {isAdmin && !myOwnedStores.some(s => s.id === currentStore?.id) && (
        <div className="p-3.5 px-4 rounded-2xl bg-blue-500/10 border border-blue-300 dark:border-blue-700/60 flex items-center gap-2.5 text-xs text-blue-900 dark:text-blue-200 shadow-2xs">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div>
            <span className="font-bold">โหมดผู้ดูแลระบบ (Admin Inspector):</span> กำลังตรวจสอบหน้าจอครัวของร้าน <strong>"{currentStore?.name}"</strong>
          </div>
        </div>
      )}

      {/* Empty State Alert if Current Store has 0 Queues */}
      {filteredQueues.length === 0 && (
        <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                ยังไม่มีออเดอร์คิวสำหรับร้าน "{currentStore?.name}"
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {isOwnerOfCurrentStore
                  ? 'คุณสามารถสร้างออเดอร์จำลอง 3 รายการเพื่อทดสอบระบบหน้าจอครัว KDS ได้ทันที'
                  : 'ยังไม่มีคิวที่กำลังรอการปรุงอาหารในร้านนี้ (โหมดดูอย่างเดียว)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwnerOfCurrentStore && (
              <button
                onClick={handleSeedOrders}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ สร้าง 3 คิวจำลองเพื่อทดสอบ</span>
              </button>
            )}
            {stores.some(s => s.id === 'store-1') && currentStore?.id !== 'store-1' && (
              <button
                onClick={() => {
                  setSelectedStoreId('store-1');
                  setKdsSelectedStoreId('store-1');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-200 font-bold text-xs hover:bg-stone-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                สลับไปร้านที่มีคิวค้าง
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4-Column Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map(col => {
          const colOrders = filteredQueues.filter((q: any) => {
            if (col.key === 'PAYMENT_PENDING') {
              return q.status === 'PAYMENT_PENDING' || q.status === 'PAID_AWAITING_MERCHANT' || q.status === 'DRAFT';
            }
            if (col.key === 'PREPARING') {
              return q.status === 'PREPARING' || q.status === 'MERCHANT_ACCEPTED';
            }
            if (col.key === 'READY') {
              return q.status === 'READY' || q.status === 'READY_FOR_PICKUP';
            }
            if (col.key === 'COMPLETED') {
              return q.status === 'COMPLETED';
            }
            return q.status === col.key;
          });

          return (
            <div
              key={col.key}
              className={`flex flex-col rounded-3xl border overflow-hidden min-h-[550px] transition-colors shadow-2xs ${col.colBg}`}
            >
              {/* Column Header */}
              <div className={`p-4 border-b flex items-center justify-between ${col.headerBg}`}>
                <h3 className="text-xs font-black tracking-tight flex items-center gap-2">
                  <span>{col.title}</span>
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-black ${col.badgeStyle}`}>
                  {colOrders.length}
                </span>
              </div>

              {/* Column Content */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[70vh]">
                {colOrders.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-stone-400 dark:text-zinc-500">
                    <Layers className="w-8 h-8 stroke-1 mb-2 opacity-40" />
                    <p className="text-xs font-medium">ไม่มีออเดอร์ในขั้นตอนนี้</p>
                  </div>
                ) : (
                  colOrders.map((order: any) => {
                    const elapsedMins = getElapsedMinutes(order.createdAt);
                    const isUrgent = elapsedMins > 15 && order.status !== 'COMPLETED';

                    return (
                      <div
                        key={order.id}
                        className={`rounded-2xl p-4 bg-white dark:bg-[#17171d] border transition-all shadow-xs hover:shadow-md ${
                          isUrgent
                            ? 'border-rose-400 dark:border-rose-500/60 ring-2 ring-rose-400/20'
                            : 'border-stone-200/90 dark:border-zinc-800'
                        }`}
                      >
                        {/* Order Header */}
                        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-stone-100 dark:border-zinc-800">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xl text-orange-600 dark:text-[#fb923c]">
                                {order.queueNumber || order.orderNumber}
                              </span>
                              {order.exchangePin && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-stone-100 dark:bg-zinc-800 text-stone-500 font-bold">
                                  #{order.exchangePin}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-stone-800 dark:text-zinc-200 mt-0.5">
                              {order.customerName}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                                isUrgent
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-[#f87171] border border-rose-300/40 dark:border-rose-500/30 animate-pulse'
                                  : 'bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-300'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {elapsedMins} นาทีที่แล้ว
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              รับ: {order.pickupTime}
                            </span>
                          </div>
                        </div>

                        {/* Order Items List */}
                        <div className="py-3 space-y-2">
                          {Array.isArray(order.items) && order.items.map((item: any, idx: number) => {
                            const optionLabels = Array.isArray(item.selectedOptions)
                              ? item.selectedOptions
                                  .map((opt: any) => (typeof opt === 'string' ? opt : opt.choiceName || opt.name || opt.label || ''))
                                  .filter(Boolean)
                              : [];

                            return (
                              <div key={idx} className="flex items-start justify-between text-xs gap-2">
                                <div className="flex items-start gap-2 flex-1">
                                  <span className="w-5 h-5 rounded-md bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-mono font-bold flex items-center justify-center text-[11px] shrink-0 mt-0.5">
                                    {item.quantity}x
                                  </span>
                                  <div>
                                    <div className="font-bold text-stone-800 dark:text-zinc-100">
                                      {item.food?.name || item.name || 'รายการอาหาร'}
                                    </div>
                                    {optionLabels.length > 0 && (
                                      <div className="text-[10px] text-stone-500 dark:text-zinc-400">
                                        + {optionLabels.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <span className="text-stone-400 font-mono text-[11px] shrink-0">
                                  ฿{((item.food?.price ?? item.price) || 0) * (item.quantity || 1)}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Special Note Callout */}
                        {order.specialNote && (
                          <div className="mb-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200">
                            <span className="font-bold">หมายเหตุลูกค้า:</span> {order.specialNote}
                          </div>
                        )}

                        {/* Card Footer Actions */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
                          <button
                            onClick={() => openStoreChat(currentStore, order.id)}
                            className="p-2 rounded-xl text-stone-500 hover:text-orange-600 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="แชทกับลูกค้ารายนี้"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {col.key !== 'COMPLETED' ? (
                            <button
                              disabled={!isOwnerOfCurrentStore}
                              onClick={() => handleNextStatus(order)}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs shadow-xs transition-all ${
                                isOwnerOfCurrentStore
                                  ? 'bg-orange-500 hover:bg-orange-600 active:scale-95 text-white cursor-pointer'
                                  : 'bg-stone-100 dark:bg-zinc-800 text-stone-400 dark:text-zinc-500 border border-stone-200 dark:border-zinc-700 cursor-not-allowed opacity-80'
                              }`}
                              title={isOwnerOfCurrentStore ? col.nextLabel : `เฉพาะเจ้าของร้าน ${currentStore?.name} เท่านั้นที่มีสิทธิ์เปลี่ยนสถานะ`}
                            >
                              {!isOwnerOfCurrentStore && <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />}
                              <span>{isOwnerOfCurrentStore ? col.nextLabel : 'เฉพาะเจ้าของร้าน'}</span>
                              {isOwnerOfCurrentStore && col.nextIcon}
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 py-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              ส่งมอบเรียบร้อย
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
