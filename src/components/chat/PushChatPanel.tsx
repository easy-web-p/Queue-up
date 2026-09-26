import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQueue } from '../../context/QueueContext';
import { StoreChatMessage, Store } from '../../types';
import { playChimeSound } from '../../services/soundService';
import {
  MessageSquare,
  Send,
  X,
  ChevronDown,
  Maximize2,
  Clock,
  Sparkles,
  ChevronRight,
  CheckCheck,
  PanelRightClose,
  PanelRightOpen,
  ArrowRight,
  Heart,
  Bell
} from 'lucide-react';

interface StoreChatNotification {
  id: string;
  storeId: string;
  storeName: string;
  storeLogo: string;
  message: string;
  timestamp: string;
  isFollowed: boolean;
}

export const PushChatPanel: React.FC = () => {
  const {
    currentView,
    stores,
    queues,
    currentUser,
    userStore,
    openChatPage,
    getStoreChatMessages,
    sendStoreChatMessage,
    followedStoreIds,
    isSideChatOpen,
    setIsSideChatOpen,
    toggleSideChat
  } = useQueue();

  // Find preferred default store
  const defaultStore = useMemo(() => {
    // If merchant, show their store
    if (currentUser?.role === 'merchant' && userStore) {
      return userStore;
    }
    // If customer has an active queue, show that store first
    const activeQueue = queues.find(
      q => q.status !== 'COMPLETED' && q.status !== 'CANCELLED'
    );
    if (activeQueue) {
      const match = stores.find(s => s.id === activeQueue.storeId);
      if (match) return match;
    }
    // Default to store-2 (ข้าวกะเพราถาด พริกแห้งเตาถ่าน 1990) or stores[0]
    return stores.find(s => s.id === 'store-2') || stores[0];
  }, [currentUser, userStore, queues, stores]);

  const [selectedStoreId, setSelectedStoreId] = useState<string>(defaultStore?.id || 'store-2');
  const [inputText, setInputText] = useState('');
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentStore = useMemo(() => {
    return stores.find(s => s.id === selectedStoreId) || defaultStore || stores[0];
  }, [stores, selectedStoreId, defaultStore]);

  // Hover state for floating trigger button
  const [isHoverMenuOpen, setIsHoverMenuOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Incoming Store Chat Notification State
  const [activeNotification, setActiveNotification] = useState<StoreChatNotification | null>(null);
  const [buttonTempLabel, setButtonTempLabel] = useState<string | null>(null);
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const buttonLabelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastKnownMessageIdRef = useRef<Record<string, string>>({});
  const initializedRef = useRef<boolean>(false);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHoverMenuOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverMenuOpen(false);
    }, 250);
  };

  // Trigger store chat notification popup & button name animation
  const triggerStoreNotification = (notif: StoreChatNotification) => {
    if (isSideChatOpen && selectedStoreId === notif.storeId) return;

    setActiveNotification(notif);
    playChimeSound();

    // Change button text to the store name for 3 seconds
    setButtonTempLabel(notif.storeName);
    if (buttonLabelTimerRef.current) clearTimeout(buttonLabelTimerRef.current);
    buttonLabelTimerRef.current = setTimeout(() => {
      setButtonTempLabel(null);
    }, 3000);

    // Auto dismiss notification card after ~80 seconds (1-2 minutes)
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    notificationTimerRef.current = setTimeout(() => {
      setActiveNotification(null);
    }, 80000);
  };

  // Listen for new incoming seller messages across stores & demo notification
  useEffect(() => {
    if (!initializedRef.current) {
      stores.forEach(s => {
        const msgs = getStoreChatMessages(s.id);
        if (msgs && msgs.length > 0) {
          lastKnownMessageIdRef.current[s.id] = msgs[msgs.length - 1].id;
        }
      });
      initializedRef.current = true;

      // Initial simulation demo after 5 seconds
      const demoTimer = setTimeout(() => {
        const targetStore = stores.find(s => s.id === 'store-2') || stores[0];
        if (targetStore && !isSideChatOpen && currentView !== 'chat') {
          triggerStoreNotification({
            id: `demo-${Date.now()}`,
            storeId: targetStore.id,
            storeName: targetStore.name,
            storeLogo: targetStore.logo,
            message: '🍳 เชฟกำลังปรุงเมนูพิเศษตามคิวให้คุณอย่างพิถีพิถัน พร้อมเสิร์ฟในอีกสักครู่ครับ!',
            timestamp: new Date().toISOString(),
            isFollowed: followedStoreIds.includes(targetStore.id)
          });
        }
      }, 5000);

      return () => clearTimeout(demoTimer);
    }

    // Check for incoming seller messages
    stores.forEach(s => {
      const msgs = getStoreChatMessages(s.id);
      if (!msgs || msgs.length === 0) return;
      const lastMsg = msgs[msgs.length - 1];

      if (
        lastMsg &&
        lastMsg.senderRole === 'seller' &&
        lastKnownMessageIdRef.current[s.id] !== lastMsg.id
      ) {
        lastKnownMessageIdRef.current[s.id] = lastMsg.id;
        triggerStoreNotification({
          id: lastMsg.id,
          storeId: s.id,
          storeName: s.name,
          storeLogo: s.logo,
          message: lastMsg.message,
          timestamp: lastMsg.timestamp,
          isFollowed: followedStoreIds.includes(s.id)
        });
      }
    });
  }, [stores, getStoreChatMessages, followedStoreIds, isSideChatOpen, currentView]);

  // Clean up all timers
  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
      if (buttonLabelTimerRef.current) clearTimeout(buttonLabelTimerRef.current);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Automatically close side chat if navigating to full chat page to avoid duplicate views
  useEffect(() => {
    if (currentView === 'chat' && isSideChatOpen) {
      setIsSideChatOpen(false);
    }
  }, [currentView, isSideChatOpen, setIsSideChatOpen]);

  const handleOpenFullScreenChat = () => {
    setIsSideChatOpen(false);
    openChatPage(currentStore?.id);
  };

  // List of stores with chat history, followed, or active queue
  const chatHistoryStores = useMemo(() => {
    const list = stores.filter(store => {
      const hasChats = getStoreChatMessages(store.id).length > 0;
      const isFollowed = followedStoreIds.includes(store.id);
      const hasQueue = queues.some(
        q => q.storeId === store.id && q.status !== 'COMPLETED' && q.status !== 'CANCELLED'
      );
      return hasChats || isFollowed || hasQueue;
    });

    if (list.length === 0) {
      return stores.slice(0, 4);
    }
    return list;
  }, [stores, followedStoreIds, queues, getStoreChatMessages]);

  // Active customer queue for this store
  const activeQueue = useMemo(() => {
    return queues.find(
      q => q.storeId === currentStore?.id && q.status !== 'COMPLETED' && q.status !== 'CANCELLED'
    );
  }, [queues, currentStore]);

  // Fetch live chat messages for this store
  const messages: StoreChatMessage[] = useMemo(() => {
    if (!currentStore) return [];
    return getStoreChatMessages(currentStore.id);
  }, [currentStore, getStoreChatMessages]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isSideChatOpen) {
      scrollToBottom();
    }
  }, [isSideChatOpen, messages.length]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentStore) return;

    sendStoreChatMessage(
      currentStore.id,
      inputText.trim(),
      activeQueue?.id,
      currentUser?.role === 'merchant' ? 'seller' : 'buyer'
    );

    playChimeSound();
    setInputText('');
  };

  const handleQuickTag = (tagText: string) => {
    if (!currentStore) return;
    sendStoreChatMessage(
      currentStore.id,
      tagText,
      activeQueue?.id,
      currentUser?.role === 'merchant' ? 'seller' : 'buyer'
    );
    playChimeSound();
  };

  // Do not render floating buyer chat panel on landing page or dedicated chat pages
  if (currentView === 'landing' || currentView === 'store-chat' || currentView === 'chat') {
    return null;
  }

  return (
    <>
      {/* 1. Floating Trigger Button & Hover Store Preview (Visible only on Desktop, Laptop, and Tablet when side panel is closed) */}
      {!isSideChatOpen && (
        <div
          className="fixed bottom-6 right-6 z-40 hidden sm:flex flex-col items-end w-64"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Active Store Incoming Notification Popup (Auto-dismisses in 1-2 mins, or click to open) */}
          {activeNotification ? (
            <div
              onClick={() => {
                setSelectedStoreId(activeNotification.storeId);
                setIsSideChatOpen(true);
                setActiveNotification(null);
              }}
              className="w-full mb-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-2 border-orange-500/90 dark:border-orange-500/90 rounded-2xl shadow-2xl overflow-hidden cursor-pointer hover:shadow-orange-500/25 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 group"
            >
              {/* Header with store message indicator & dismiss button */}
              <div className="px-3 py-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  <Bell className="w-3.5 h-3.5 animate-bounce" />
                  <span>แจ้งเตือนข้อความใหม่</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveNotification(null);
                  }}
                  className="hover:bg-white/20 p-0.5 rounded-full transition-colors cursor-pointer"
                  title="ปิดการแจ้งเตือน"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>

              {/* Single Store details */}
              <div className="p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <img
                      src={activeNotification.storeLogo}
                      alt={activeNotification.storeName}
                      className="w-8 h-8 rounded-lg object-cover border border-stone-200 dark:border-zinc-700 shadow-2xs"
                    />
                    <span className="w-2 h-2 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 border border-white dark:border-zinc-900 animate-pulse" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-stone-900 dark:text-zinc-100 truncate block">
                        {activeNotification.storeName}
                      </span>
                      {activeNotification.isFollowed && (
                        <Heart className="w-2.5 h-2.5 text-red-500 fill-red-500 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-stone-400 dark:text-zinc-500 block truncate">
                      ตอบกลับแชทเมื่อสักครู่
                    </span>
                  </div>
                </div>

                {/* Message preview */}
                <div className="p-2 rounded-xl bg-orange-50 dark:bg-zinc-800/80 border border-orange-100 dark:border-zinc-700 text-stone-800 dark:text-zinc-200 text-xs leading-relaxed line-clamp-3">
                  {activeNotification.message}
                </div>

                {/* Footer CTA */}
                <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-zinc-800 text-[10px]">
                  <span className="text-orange-600 dark:text-orange-400 font-bold group-hover:underline flex items-center gap-1">
                    คลิกเพื่อเปิดแชทกับร้านนี้
                    <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="text-[9px] text-stone-400 font-mono">1-2 นาที</span>
                </div>
              </div>
            </div>
          ) : isHoverMenuOpen ? (
            /* Hover Strip Panel - Matches the exact width of the button */
            <div className="w-full mb-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-2">
              {/* Mini Header */}
              <div className="px-3 py-2 bg-stone-50 dark:bg-zinc-950/60 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3 text-orange-500" />
                  แชทร้านที่ติดตาม & ล่าสุด
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                  {chatHistoryStores.length} ร้าน
                </span>
              </div>

              {/* Stores List */}
              <div className="max-h-56 overflow-y-auto p-1 divide-y divide-stone-100 dark:divide-zinc-800/60">
                {chatHistoryStores.map(store => {
                  const storeMessages = getStoreChatMessages(store.id);
                  const lastMsg = storeMessages[storeMessages.length - 1];
                  const isFollowed = followedStoreIds.includes(store.id);
                  const storeQueue = queues.find(
                    q => q.storeId === store.id && q.status !== 'COMPLETED' && q.status !== 'CANCELLED'
                  );

                  return (
                    <button
                      key={store.id}
                      onClick={() => {
                        setSelectedStoreId(store.id);
                        setIsSideChatOpen(true);
                        setIsHoverMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-orange-50 dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer group"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={store.logo}
                          alt={store.name}
                          className="w-7 h-7 rounded-lg object-cover border border-stone-200 dark:border-zinc-700"
                        />
                        <span className="w-2 h-2 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 border border-white dark:border-zinc-900" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-stone-900 dark:text-zinc-100 truncate group-hover:text-orange-600 transition-colors">
                            {store.name}
                          </span>
                          {isFollowed && (
                            <Heart className="w-2.5 h-2.5 text-red-500 fill-red-500 shrink-0" />
                          )}
                        </div>

                        <div className="flex items-center gap-1 mt-0.5">
                          {storeQueue ? (
                            <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 font-mono truncate">
                              คิว #{storeQueue.queueNumber} ({storeQueue.status})
                            </span>
                          ) : lastMsg ? (
                            <p className="text-[10px] text-stone-400 dark:text-zinc-500 truncate">
                              {lastMsg.message}
                            </p>
                          ) : (
                            <p className="text-[9px] text-stone-400">
                              {isFollowed ? 'ร้านที่คุณติดตาม' : 'กดเพื่อเริ่มแชท'}
                            </p>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-orange-500 transition-transform group-hover:translate-x-0.5 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Floating Trigger Button */}
          <button
            onClick={() => {
              if (activeNotification) {
                setSelectedStoreId(activeNotification.storeId);
                setActiveNotification(null);
              }
              setIsSideChatOpen(true);
              setIsHoverMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-white font-bold text-xs shadow-xl transition-all cursor-pointer border border-white/20 group ${
              buttonTempLabel
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 shadow-orange-500/50 ring-2 ring-amber-300 animate-pulse'
                : 'bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-orange-500/30 hover:shadow-orange-500/40'
            }`}
            title="เปิดแชทกับร้านค้า (ดันหน้าจอเบียดออก)"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="relative shrink-0">
                <MessageSquare className={`w-4 h-4 transition-transform group-hover:scale-110 ${buttonTempLabel ? 'animate-bounce text-yellow-200' : ''}`} />
                <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-pulse" />
              </div>
              <span className="truncate">
                {buttonTempLabel ? buttonTempLabel : 'แชทกับร้านค้า'}
              </span>
            </div>
            {activeQueue && (
              <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-mono font-black shrink-0">
                #{activeQueue.queueNumber}
              </span>
            )}
          </button>
        </div>
      )}

      {/* 2. Docked Push Chat Panel (Takes physical width in layout, pushing left content to the left) */}
      <aside
        aria-label="แชทกลุ่มร้านค้า"
        className={`hidden sm:flex flex-col shrink-0 border-l border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out h-[calc(100vh-65px)] sticky top-[65px] z-30 shadow-xs ${
          isSideChatOpen
            ? 'w-[380px] md:w-[410px] lg:w-[440px] opacity-100'
            : 'w-0 border-l-0 overflow-hidden opacity-0 pointer-events-none'
        }`}
      >
        {isSideChatOpen && (
          <div className="flex flex-col h-full w-[380px] md:w-[410px] lg:w-[440px]">
            {/* Panel Header */}
            <div className="p-3.5 border-b border-stone-200/80 dark:border-zinc-800 flex items-center justify-between gap-2 bg-stone-50/50 dark:bg-zinc-950/50 shrink-0">
              {/* Store Switcher Dropdown */}
              <div className="relative flex-1 min-w-0">
                <button
                  onClick={() => setIsStoreDropdownOpen(!isStoreDropdownOpen)}
                  className="flex items-center gap-2.5 text-left w-full hover:bg-stone-100 dark:hover:bg-zinc-800 p-1 rounded-xl transition-colors cursor-pointer"
                >
                  <img
                    src={currentStore?.logo}
                    alt={currentStore?.name}
                    className="w-8 h-8 rounded-xl object-cover border border-stone-200 dark:border-zinc-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-xs text-stone-900 dark:text-white truncate block">
                        {currentStore?.name}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-stone-500 dark:text-zinc-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>แชทกลุ่มร้าน (ออนไลน์)</span>
                    </div>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isStoreDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-full bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-1.5 divide-y divide-stone-100 dark:divide-zinc-800">
                    <div className="px-2 py-1 text-[10px] font-bold text-stone-400">
                      เลือกร้านค้าเพื่อพูดคุย:
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1 space-y-0.5">
                      {stores.map(s => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setSelectedStoreId(s.id);
                            setIsStoreDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                            s.id === currentStore?.id
                              ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold'
                              : 'hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300'
                          }`}
                        >
                          <img
                            src={s.logo}
                            alt={s.name}
                            className="w-6 h-6 rounded-lg object-cover shrink-0"
                          />
                          <span className="truncate">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Fullscreen & Push Back (Collapse) */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handleOpenFullScreenChat}
                  className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
                  title="เปิดหน้าแชทแบบเต็มจอ (ย่อแผงข้างนี้ออก)"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsSideChatOpen(false)}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
                  title="ย่อแชท (ดันหน้าจอกลับ)"
                >
                  <PanelRightClose className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-[11px] font-bold text-stone-600 dark:text-zinc-300">ย่อ</span>
                </button>
              </div>
            </div>

            {/* Active Queue Banner if available */}
            {activeQueue && (
              <div className="px-3.5 py-2 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-b border-orange-200/60 dark:border-zinc-800 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-orange-600 dark:text-orange-400">
                    คิวของคุณ: {activeQueue.queueNumber}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                    {activeQueue.status}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-zinc-400 font-medium">
                  <Clock className="w-3 h-3 text-orange-500" />
                  <span>เวลารับ: {activeQueue.pickupTime}</span>
                </div>
              </div>
            )}

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/30 dark:bg-zinc-950/20">
              <div className="text-center my-2">
                <span className="text-[10px] font-medium text-stone-400 dark:text-zinc-500 bg-white dark:bg-zinc-800 px-3 py-1 rounded-full border border-stone-200/60 dark:border-zinc-700 shadow-2xs">
                  เริ่มต้นการสนทนากับร้าน {currentStore?.name}
                </span>
              </div>

              {messages.map(msg => {
                const isMe = msg.senderRole === (currentUser?.role === 'merchant' ? 'seller' : 'buyer');
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-semibold text-stone-500 dark:text-zinc-400">
                        {msg.senderName}
                      </span>
                      {msg.senderRole === 'seller' && (
                        <span className="px-1 py-0.2 rounded text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 font-bold">
                          แม่ครัว/เจ้าของร้าน
                        </span>
                      )}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs leading-relaxed ${
                        isMe
                          ? 'bg-orange-500 text-white rounded-br-xs font-medium'
                          : 'bg-white dark:bg-zinc-800 text-stone-800 dark:text-zinc-100 border border-stone-200/80 dark:border-zinc-700 rounded-bl-xs'
                      }`}
                    >
                      <p>{msg.message}</p>
                    </div>

                    <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-stone-400 dark:text-zinc-500 font-mono">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && <CheckCheck className="w-3 h-3 text-orange-500 dark:text-orange-400" />}
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Chips */}
            <div className="px-3 py-2 border-t border-stone-100 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 overflow-x-auto flex items-center gap-1.5 shrink-0 scrollbar-none">
              <button
                onClick={() => handleQuickTag('📌 สอบถามสถานะคิวตอนนี้ครับ')}
                className="px-2.5 py-1 rounded-xl text-[11px] bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300 font-medium whitespace-nowrap transition-colors cursor-pointer"
              >
                📌 ถามคิว
              </button>
              <button
                onClick={() => handleQuickTag('🥢 รบกวนขอช้อนส้อมและพริกน้ำปลาเพิ่มด้วยครับ')}
                className="px-2.5 py-1 rounded-xl text-[11px] bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300 font-medium whitespace-nowrap transition-colors cursor-pointer"
              >
                🥢 ขอช้อนส้อมเพิ่ม
              </button>
              <button
                onClick={() => handleQuickTag('⏰ คิวของผมใกล้เสร็จหรือยังครับ')}
                className="px-2.5 py-1 rounded-xl text-[11px] bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300 font-medium whitespace-nowrap transition-colors cursor-pointer"
              >
                ⏰ ใกล้เสร็จยัง
              </button>
              <button
                onClick={() => handleQuickTag('🌿 ขอไม่ใส่ผักชีและกระเทียมเจียวครับ')}
                className="px-2.5 py-1 rounded-xl text-[11px] bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300 font-medium whitespace-nowrap transition-colors cursor-pointer"
              >
                🌿 ไม่ใส่ผักชี
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={`พิมพ์ข้อความถึง ${currentStore?.name}...`}
                className="flex-1 py-2.5 px-3.5 rounded-2xl bg-stone-100 dark:bg-zinc-800 border-none text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`p-2.5 rounded-2xl transition-all cursor-pointer ${
                  inputText.trim()
                    ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20 active:scale-95'
                    : 'bg-stone-100 dark:bg-zinc-800 text-stone-400 cursor-not-allowed'
                }`}
                title="ส่งข้อความ"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </aside>
    </>
  );
};
