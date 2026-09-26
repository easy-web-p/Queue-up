import React, { useState, useRef, useEffect } from 'react';
import { useQueue } from '../../context/QueueContext';
import { NotificationType, AppNotification } from '../../types';
import {
  Bell,
  Ticket,
  Utensils,
  Store as StoreIcon,
  CheckCheck,
  ExternalLink,
  Copy,
  Heart,
  Sparkles,
  ChevronRight
} from 'lucide-react';

export const NotificationDropdown: React.FC = () => {
  const {
    notifications,
    unreadNotificationCount,
    markAllNotificationsRead,
    markNotificationRead,
    addToast,
    setCurrentView,
    setActiveStoreId,
    setActiveQueueId,
    setActiveFoodModal,
    foodItems,
    stores,
    followedStoreIds,
    toggleFollowStore
  } = useQueue();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | NotificationType>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    return n.type === activeTab;
  });

  const handleCopyCoupon = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(code);
    addToast('คัดลอกโค้ดส่วนลดแล้ว!', `โค้ด "${code}" คัดลอกลงในคลิปบอร์ดแล้ว พร้อมนำไปใช้ลดราคา`, 'success');
  };

  const handleAction = (item: AppNotification) => {
    if (item.id) {
      markNotificationRead(item.id);
    }

    // 1. Deep link handling if present
    if (item.deepLink) {
      if (item.deepLink.startsWith('/queue-tracking')) {
        try {
          const url = new URL(item.deepLink, window.location.origin);
          const orderId = url.searchParams.get('orderId');
          if (orderId) setActiveQueueId(orderId);
        } catch {
          // fallback
          const orderIdMatch = item.deepLink.match(/orderId=([^&]+)/);
          if (orderIdMatch) setActiveQueueId(orderIdMatch[1]);
        }
        setCurrentView('queue-tracking');
        setIsOpen(false);
        return;
      }
      if (item.deepLink.startsWith('/store/')) {
        const storeId = item.deepLink.replace('/store/', '');
        if (storeId) setActiveStoreId(storeId);
        setCurrentView('store-detail');
        setIsOpen(false);
        return;
      }
      if (item.deepLink.startsWith('/chat')) {
        setCurrentView('chat');
        setIsOpen(false);
        return;
      }
      if (item.deepLink.startsWith('/store-chat')) {
        setCurrentView('store-chat');
        setIsOpen(false);
        return;
      }
    }

    // 2. Type-based and data payload routing
    const targetQueueId = item.queueId || (item as any).data?.orderId;
    const targetStoreId = item.storeId || (item as any).data?.storeId;

    if (
      item.type === 'queue_call' ||
      item.type === 'ORDER_READY' ||
      item.type === 'ORDER_PREPARING' ||
      item.type === 'ORDER_ACCEPTED' ||
      item.type === 'ORDER_COMPLETED' ||
      targetQueueId
    ) {
      if (targetQueueId) {
        setActiveQueueId(targetQueueId);
      }
      setCurrentView('queue-tracking');
      setIsOpen(false);
      return;
    }

    if (item.type === 'CHAT_MESSAGE') {
      setCurrentView('chat');
      setIsOpen(false);
      return;
    }

    if (targetStoreId) {
      setActiveStoreId(targetStoreId);
      setCurrentView('store-detail');
      if (item.menuItemName) {
        const food = foodItems.find(f => f.name.includes(item.menuItemName!) || item.menuItemName!.includes(f.name));
        if (food) {
          setActiveFoodModal(food);
        }
      }
      setIsOpen(false);
      return;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(prev => !prev)}
        }
        className="relative p-2.5 rounded-xl bg-white hover:bg-orange-50/80 border border-orange-200 text-stone-800 transition-colors cursor-pointer dark:bg-zinc-900/90 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-200"
        title="การแจ้งเตือนคูปอง เมนูใหม่ และร้านค้าที่ติดตาม"
        aria-label="เปิดการแจ้งเตือน"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-bounce">
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="fixed inset-x-3 top-16 sm:inset-x-auto sm:absolute sm:right-0 sm:top-auto mt-2 w-auto sm:w-[420px] max-w-[calc(100vw-1.5rem)] sm:max-w-[420px] rounded-2xl bg-white border border-orange-200/90 shadow-2xl z-50 overflow-hidden flex flex-col text-stone-900 animate-in fade-in zoom-in-95 duration-150 dark:bg-black dark:border-zinc-800 dark:text-zinc-100 max-h-[80vh]">
          {/* Header */}
          <div className="p-4 border-b border-orange-100 dark:border-zinc-800 flex items-center justify-between bg-orange-50/60 dark:bg-zinc-950">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-stone-900 dark:text-zinc-100 flex items-center gap-1.5">
                  การแจ้งเตือนวันนี้
                  {unreadNotificationCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-500 text-white">
                      {unreadNotificationCount} ใหม่
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                  คูปอง เมนูใหม่ และร้านที่คุณติดตาม
                </p>
              </div>
            </div>

            {unreadNotificationCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors cursor-pointer"
                title="ทำเครื่องหมายว่าอ่านแล้วทั้งหมด"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>อ่านทั้งหมด</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-orange-100 dark:border-zinc-800/80 bg-white dark:bg-black overflow-x-auto scrollbar-none text-xs">
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'queue_call', label: '🔔 เรียกคิว' },
              { id: 'coupon', label: '🎟️ คูปอง' },
              { id: 'new_menu', label: '🍲 เมนูใหม่' },
              { id: 'store_open', label: '🟢 ร้านเปิดแล้ว' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-orange-50 dark:text-zinc-400 dark:hover:bg-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Followed Stores Quick Bar */}
          <div className="px-3.5 py-2 bg-orange-50/40 dark:bg-zinc-950/60 border-b border-orange-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
            <span className="text-stone-500 dark:text-zinc-400 flex items-center gap-1 font-semibold">
              <Heart className="w-3 h-3 text-red-500 fill-red-500" />
              ร้านที่คุณติดตาม ({followedStoreIds.length} ร้าน):
            </span>
            <span className="text-orange-600 dark:text-orange-400 font-bold">
              แจ้งเตือนอัตโนมัติ
            </span>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto p-2.5 space-y-2 flex-1 scrollbar-none">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-8 text-stone-500 dark:text-zinc-400 text-xs">
                ไม่มีการแจ้งเตือนในหมวดนี้
              </div>
            ) : (
              filteredNotifications.map(item => {
                const isFollowed = item.storeId ? followedStoreIds.includes(item.storeId) : false;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleAction(item)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer relative group ${
                      item.isRead
                        ? 'bg-white hover:bg-orange-50/40 border-orange-100 dark:bg-zinc-950/80 dark:hover:bg-zinc-900/90 dark:border-zinc-800/80'
                        : 'bg-orange-50/80 hover:bg-orange-100/70 border-orange-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 dark:border-orange-500/40'
                    }`}
                  >
                    {!item.isRead && (
                      <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500" />
                    )}

                    <div className="flex items-start gap-3">
                      {/* Icon or Store Logo */}
                      <div className="shrink-0 mt-0.5">
                        {item.type === 'queue_call' ? (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-xs animate-pulse">
                            <Bell className="w-5 h-5" />
                          </div>
                        ) : item.storeLogo ? (
                          <img
                            src={item.storeLogo}
                            alt="Store"
                            className="w-10 h-10 rounded-xl object-cover border border-orange-200 dark:border-zinc-700"
                          />
                        ) : item.type === 'coupon' ? (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center text-white shadow-xs">
                            <Ticket className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center dark:bg-orange-500/20 dark:text-orange-400">
                            <StoreIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold leading-tight line-clamp-1 ${!item.isRead ? 'text-stone-900 dark:text-white' : 'text-stone-700 dark:text-zinc-300'}`}>
                            {item.title}
                          </span>
                        </div>

                        <p className="text-xs text-stone-600 dark:text-zinc-400 mt-1 leading-relaxed">
                          {item.message}
                        </p>

                        {/* Special coupon card button */}
                        {item.couponCode && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-900 font-mono font-bold text-xs border border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40">
                              {item.couponCode}
                            </span>
                            <button
                              type="button"
                              onClick={e => handleCopyCoupon(item.couponCode!, e)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-orange-50 border border-orange-200 text-stone-800 transition-all active:scale-95 cursor-pointer dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                            >
                              <Copy className="w-3 h-3 text-orange-500" />
                              <span>คัดลอกโค้ด</span>
                            </button>
                          </div>
                        )}

                        {/* Bottom action row */}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-stone-400 dark:text-zinc-500">
                          <span>{item.timestamp}</span>

                          <div className="flex items-center gap-2">
                            {item.storeId && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  toggleFollowStore(item.storeId!);
                                }}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                                  isFollowed
                                    ? 'text-red-600 hover:text-red-700 dark:text-red-400'
                                    : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
                                }`}
                                title={isFollowed ? 'คลิกเพื่อเลิกติดตามร้านนี้' : 'คลิกเพื่อติดตามร้านนี้'}
                              >
                                <Heart className={`w-3 h-3 ${isFollowed ? 'fill-red-500 text-red-500' : ''}`} />
                                <span>{isFollowed ? 'ติดตามอยู่' : '+ ติดตาม'}</span>
                              </button>
                            )}

                            {item.type === 'queue_call' || item.queueId ? (
                              <span className="text-orange-600 dark:text-orange-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                <Ticket className="w-3.5 h-3.5" />
                                ดูบัตรคิว <ChevronRight className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="text-orange-600 dark:text-orange-400 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                ไปที่ร้าน <ChevronRight className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
