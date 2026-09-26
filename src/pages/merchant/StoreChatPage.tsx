import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQueue } from '../../context/QueueContext';
import type { StoreCustomerChatThread, CustomerChatMessage } from '../../types';
import { formatStoreCategory } from '../../data/mockData';
import { ChatService } from '../../services/chatService';
import {
  Search,
  Send,
  Ticket,
  Phone,
  ArrowLeft,
  CheckCheck,
  Sparkles,
  Heart,
  Info,
  Store as StoreIcon,
  User,
  UtensilsCrossed
} from 'lucide-react';

export const StoreChatPage: React.FC = () => {
  const {
    stores,
    currentUser,
    userStore,
    activeStoreId,
    setCurrentView,
    setActiveQueueId,
    getStoreCustomerThreads,
    sendStoreCustomerReply,
    markStoreCustomerThreadAsRead,
    customerThreadsTimestamp,
    openStoreDetail,
    addToast
  } = useQueue();

  // Strictly resolve the merchant's store (e.g., "ก๋าดัด")
  const currentStore = useMemo(() => {
    return (
      userStore ||
      (currentUser?.email?.toLowerCase() === 'hi00000087@gmail.com'
        ? stores.find(s => s.id === 'store-1')
        : null) ||
      (activeStoreId ? stores.find(s => s.id === activeStoreId) : null) ||
      stores[0]
    );
  }, [userStore, currentUser, activeStoreId, stores]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'following' | 'active_orders'>('all');
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState<boolean>(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Customer threads for this specific store
  const rawThreads = useMemo(() => {
    if (!currentStore) return [];
    return getStoreCustomerThreads(currentStore.id);
  }, [currentStore, getStoreCustomerThreads, customerThreadsTimestamp]);

  // Set default selected thread if none is selected
  useEffect(() => {
    if (rawThreads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(rawThreads[0].id);
    }
  }, [rawThreads, selectedThreadId]);

  // Active selected thread
  const activeThread = useMemo(() => {
    return rawThreads.find(t => t.id === selectedThreadId) || rawThreads[0] || null;
  }, [rawThreads, selectedThreadId]);

  // Real-time message listener for active selected thread
  const [activeThreadLiveMessages, setActiveThreadLiveMessages] = useState<CustomerChatMessage[] | null>(null);

  useEffect(() => {
    if (!activeThread?.id) {
      setActiveThreadLiveMessages(null);
      return;
    }
    const unsub = ChatService.subscribeThreadMessages(activeThread.id, (msgs) => {
      if (msgs && msgs.length > 0) {
        setActiveThreadLiveMessages(msgs);
      }
    });
    return () => unsub();
  }, [activeThread?.id]);

  const currentMessages = useMemo(() => {
    if (activeThreadLiveMessages && activeThreadLiveMessages.length > 0) {
      return activeThreadLiveMessages;
    }
    return activeThread?.messages || [];
  }, [activeThreadLiveMessages, activeThread?.messages]);

  // Mark thread as read when selected
  const markedThreadRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (currentStore && activeThread && activeThread.unreadCount > 0 && !markedThreadRef.current[activeThread.id]) {
      markedThreadRef.current[activeThread.id] = true;
      markStoreCustomerThreadAsRead(currentStore.id, activeThread.id);
    }
  }, [currentStore, activeThread?.id, activeThread?.unreadCount]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, selectedThreadId, isMobileChatOpen]);

  // Filtered customer threads
  const filteredThreads = useMemo(() => {
    return rawThreads.filter(thread => {
      // Tab filter
      if (filterTab === 'active_orders' && !thread.queueNumber) {
        return false;
      }
      if (filterTab === 'following' && !thread.queueNumber && !thread.orderSummary) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = (thread.customerName || '').toLowerCase().includes(query);
        const matchPhone = thread.customerPhone?.toLowerCase().includes(query);
        const matchQueue = thread.queueNumber?.toLowerCase().includes(query);
        const matchMsg = thread.lastMessage?.toLowerCase().includes(query);
        const matchOrder = thread.orderSummary?.toLowerCase().includes(query);
        return matchName || matchPhone || matchQueue || matchMsg || matchOrder;
      }

      return true;
    });
  }, [rawThreads, filterTab, searchQuery]);

  const handleSelectCustomer = (threadId: string) => {
    setSelectedThreadId(threadId);
    if (currentStore) {
      markStoreCustomerThreadAsRead(currentStore.id, threadId);
    }
    setIsMobileChatOpen(true);
  };

  const handleSendReply = (customText?: string) => {
    const text = (customText || inputMessage).trim();
    if (!text || !currentStore || !activeThread) return;

    const optMsg: CustomerChatMessage = {
      id: `cm-${Date.now()}`,
      senderRole: 'merchant',
      senderName: currentStore.name || 'ร้านค้า',
      message: text,
      timestamp: new Date().toISOString(),
      read: true
    };
    setActiveThreadLiveMessages(prev => [...(prev || activeThread.messages || []), optMsg]);

    sendStoreCustomerReply(currentStore.id, activeThread.id, text);
    setInputMessage('');
    addToast('ส่งข้อความสำเร็จ', `ส่งถึง ${activeThread.customerName || 'ลูกค้า'} เรียบร้อย`, 'success');
  };


  const merchantQuickChips = [
    'รับทราบคำขอเรียบร้อยครับ กำลังปรุงอาหารให้ครับ 🙏',
    'อาหารปรุงเสร็จแล้วครับ มารับที่เคาน์เตอร์หน้าร้านได้เลยครับ 🍽️',
    'จัดเตรียมช้อนส้อมและเครื่องปรุงพิเศษให้เรียบร้อยครับ ✨',
    'ขออภัยในความล่าช้าครับ กำลังเร่งมือให้อย่างเต็มที่ครับ 🔥',
    'ขอบคุณคุณลูกค้าที่มาอุดหนุนครับผม 😊'
  ];

  // Helper to format timestamps consistently
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Main 2-Column Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[780px] max-h-[85vh]">
        {/* Left Column: Customer Conversations List */}
        <div
          className={`lg:col-span-4 xl:col-span-4 flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-orange-200/80 dark:border-zinc-800 overflow-hidden shadow-xs ${
            isMobileChatOpen ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Header & Search */}
          <div className="p-4 border-b border-orange-100 dark:border-zinc-800 space-y-3 bg-stone-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-stone-500 dark:text-zinc-400 flex items-center gap-1.5">
                <StoreIcon className="w-3.5 h-3.5 text-orange-500" />
                กล่องข้อความลูกค้า ({filteredThreads.length})
              </span>
              <span className="text-[11px] text-stone-400 dark:text-zinc-500">
                อัปเดตเรียลไทม์
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า หรือข้อความ..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-zinc-800/80 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setFilterTab('all')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-white text-orange-600 shadow-xs dark:bg-zinc-700 dark:text-orange-400'
                    : 'text-stone-500 dark:text-zinc-400 hover:text-stone-900'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setFilterTab('following')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  filterTab === 'following'
                    ? 'bg-white text-orange-600 shadow-xs dark:bg-zinc-700 dark:text-orange-400'
                    : 'text-stone-500 dark:text-zinc-400 hover:text-stone-900'
                }`}
              >
                <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                <span>ที่ติดตาม ({rawThreads.filter(t => t.queueNumber || t.orderSummary).length})</span>
              </button>
              <button
                onClick={() => setFilterTab('active_orders')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  filterTab === 'active_orders'
                    ? 'bg-white text-orange-600 shadow-xs dark:bg-zinc-700 dark:text-orange-400'
                    : 'text-stone-500 dark:text-zinc-400 hover:text-stone-900'
                }`}
              >
                <Ticket className="w-3 h-3 text-amber-500" />
                <span>มีคิว/ออเดอร์</span>
              </button>
            </div>
          </div>

          {/* Quick Customers Horizontal Bar */}
          {rawThreads.length > 0 && filterTab === 'all' && (
            <div className="px-4 py-2.5 border-b border-stone-100 dark:border-zinc-800/80 bg-orange-50/30 dark:bg-zinc-800/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 block mb-1.5">
                ลูกค้าที่ติดต่อล่าสุด
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {rawThreads.slice(0, 6).map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => handleSelectCustomer(thread.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 transition-all cursor-pointer ${
                      activeThread?.id === thread.id
                        ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 border-stone-200 dark:border-zinc-700 hover:border-orange-300'
                    }`}
                  >
                    <img
                      src={thread.customerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                      alt={thread.customerName || 'ลูกค้า'}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                    <span className="truncate max-w-[100px]">{(thread.customerName || 'ลูกค้า').replace('คุณ', '')}</span>
                  </button>

                ))}
              </div>
            </div>
          )}

          {/* Customer Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800/80">
            {filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-stone-400 dark:text-zinc-500 flex flex-col items-center justify-center h-full">
                <StoreIcon className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs font-semibold">ไม่พบรายการแชทลูกค้าที่ตรงกัน</p>
                <p className="text-[11px] mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองด้านบน</p>
              </div>
            ) : (
              filteredThreads.map(thread => {
                const isSelected = activeThread?.id === thread.id;

                return (
                  <div
                    key={thread.id}
                    onClick={() => handleSelectCustomer(thread.id)}
                    className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 relative ${
                      isSelected
                        ? 'bg-orange-50/90 dark:bg-zinc-800/90 border-l-4 border-l-orange-500'
                        : 'hover:bg-stone-50 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Customer Avatar & Online indicator */}
                    <div className="relative shrink-0 mt-0.5">
                      <img
                        src={thread.customerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                        alt={thread.customerName}
                        className="w-11 h-11 rounded-2xl object-cover border border-stone-200 dark:border-zinc-700 shadow-xs"
                      />
                      <span
                        className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 bg-emerald-500"
                      />
                    </div>

                    {/* Customer Info & Last Message */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="text-xs font-bold text-stone-900 dark:text-zinc-100 truncate">
                            {thread.customerName || 'ลูกค้า'}
                          </h4>
                          <Heart className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />
                        </div>


                        {thread.lastTimestamp && (
                          <span className="text-[10px] text-stone-400 dark:text-zinc-500 whitespace-nowrap">
                            {formatTime(thread.lastTimestamp)}
                          </span>
                        )}
                      </div>

                      {/* Active Queue pill if any */}
                      {thread.queueNumber && (
                        <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">
                          <Ticket className="w-3 h-3" />
                          <span>คิว #{thread.queueNumber}</span>
                          <span className="font-normal opacity-80">({thread.orderStatus || 'กำลังปรุง'})</span>
                        </div>
                      )}

                      {/* Snippet */}
                      <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate leading-relaxed">
                        {thread.lastMessage || 'ยังไม่มีประวัติการพูดคุย กดเพื่อเริ่มสนทนา'}
                      </p>
                    </div>

                    {/* Unread badge if any */}
                    {thread.unreadCount > 0 && (
                      <span className="absolute top-3.5 right-3 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation Room */}
        <div
          className={`lg:col-span-8 xl:col-span-8 flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-orange-200/80 dark:border-zinc-800 overflow-hidden shadow-xs ${
            isMobileChatOpen ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {activeThread ? (
            <>
              {/* Chat Room Top Bar */}
              <div className="p-3.5 sm:p-4 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-900 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back button for mobile */}
                  <button
                    onClick={() => setIsMobileChatOpen(false)}
                    className="lg:hidden p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                    title="กลับไปยังรายชื่อลูกค้า"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="relative shrink-0">
                    <img
                      src={activeThread.customerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                      alt={activeThread.customerName || 'ลูกค้า'}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border border-stone-200 dark:border-zinc-700 shadow-xs"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 bg-emerald-500" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-zinc-100 truncate">
                        {activeThread.customerName || 'ลูกค้า'}
                      </h3>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                        ออนไลน์
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                      <span>{formatStoreCategory(currentStore?.category)}</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        ร้านค้า: {currentStore?.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5">
                    <StoreIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">ร้านของคุณ</span>
                  </span>

                  {currentStore && (
                    <button
                      onClick={() => openStoreDetail(currentStore.id)}
                      className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-xs font-bold border border-orange-200 dark:border-orange-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="ดูเมนูร้าน"
                    >
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">ดูเมนูร้าน</span>
                    </button>
                  )}

                  <button
                    onClick={() => setIsInfoModalOpen(true)}
                    className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                    title="ข้อมูลลูกค้าและออเดอร์"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Order / Queue Context Banner if active queue exists */}
              {activeThread.queueNumber && (
                <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      #{activeThread.queueNumber}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-950 dark:text-amber-200">
                          ออเดอร์คิว #{activeThread.queueNumber}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                          {activeThread.orderStatus || 'กำลังปรุง'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-400 truncate">
                        {activeThread.orderSummary || 'รายการอาหาร'} {activeThread.orderTotal ? `(฿${activeThread.orderTotal})` : ''}
                      </p>
                    </div>
                  </div>

                  {activeThread.customerPhone && (
                    <a
                      href={`tel:${activeThread.customerPhone}`}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Phone className="w-3 h-3" />
                      <span>โทรหาลูกค้า</span>
                    </a>
                  )}
                </div>
              )}

              {/* Message Bubble Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-stone-50/30 dark:bg-zinc-950/20">
                <div className="text-center my-2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400">
                    การสนทนาปลอดภัยระหว่างคุณและลูกค้า {activeThread.customerName || 'ลูกค้า'}
                  </span>
                </div>

                {currentMessages.length === 0 ? (
                  <div className="py-12 text-center text-stone-400 dark:text-zinc-500 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-3xl border-2 border-dashed border-orange-300 dark:border-zinc-700 flex items-center justify-center mb-3 text-orange-400">
                      <StoreIcon className="w-8 h-8 opacity-60" />
                    </div>
                    <p className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                      ยังไม่มีการสนทนาในห้องนี้
                    </p>
                    <p className="text-[11px] mt-1 max-w-xs text-stone-400 dark:text-zinc-500">
                      คุณสามารถพิมพ์สอบถาม หรือแจ้งข้อมูลการปรุงอาหารให้ลูกค้าทราบได้เลย
                    </p>
                  </div>
                ) : (
                  currentMessages.map(msg => {
                    const isMe = msg.senderRole === 'merchant';
                    const isAi = msg.senderRole === 'ai_assistant';

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 max-w-[85%] sm:max-w-[75%] ${
                          isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                        }`}
                      >
                        {/* Avatar */}
                        {isMe ? (
                          <div className="w-7 h-7 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                            <StoreIcon className="w-4 h-4" />
                          </div>
                        ) : isAi ? (
                          <div className="w-7 h-7 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                            <Sparkles className="w-4 h-4" />
                          </div>
                        ) : (
                          <img
                            src={activeThread.customerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                            alt={activeThread.customerName || 'ลูกค้า'}
                            className="w-7 h-7 rounded-xl object-cover shrink-0 mt-1 border border-stone-200 dark:border-zinc-700"
                          />
                        )}

                        <div className="flex flex-col space-y-1">
                          {/* Sender name */}
                          {isMe ? (
                            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 mr-1 text-right">
                              ร้านของคุณ ({currentStore?.name || 'ร้านค้า'})
                            </span>
                          ) : isAi ? (
                            <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 ml-1 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-sky-500" />
                              ผู้ช่วยอัตโนมัติ (AI Bot)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-stone-500 dark:text-zinc-400 ml-1">
                              {msg.senderName || activeThread.customerName || 'ลูกค้า'}
                            </span>
                          )}


                          {/* Message Bubble */}
                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                              isMe
                                ? 'bg-orange-500 text-white rounded-tr-xs'
                                : isAi
                                  ? 'bg-sky-50 dark:bg-sky-950/40 text-stone-900 dark:text-zinc-100 border border-sky-200 dark:border-sky-800 rounded-tl-xs'
                                  : 'bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 border border-stone-200/80 dark:border-zinc-700 rounded-tl-xs'
                            }`}
                          >
                            {/* Text Content */}
                            <p className="whitespace-pre-line">{msg.message}</p>

                            {/* Timestamp & read checkmark */}
                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                                isMe ? 'text-orange-100' : isAi ? 'text-sky-400 dark:text-sky-500' : 'text-stone-400 dark:text-zinc-500'
                              }`}
                            >
                              <span>{formatTime(msg.timestamp)}</span>
                              {isMe && <CheckCheck className="w-3 h-3 text-orange-200" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Chip Inquiries */}
              <div className="px-4 py-2 border-t border-stone-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto no-scrollbar flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  ด่วน:
                </span>
                {merchantQuickChips.map((chip, index) => (
                  <button
                    key={index}
                    onClick={() => handleSendReply(chip)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 hover:bg-orange-100 hover:text-orange-800 dark:hover:bg-zinc-700 shrink-0 transition-colors cursor-pointer border border-stone-200/60 dark:border-zinc-700"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 sm:p-4 border-t border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  placeholder={`พิมพ์ข้อความตอบกลับลูกค้าในนามร้าน ${currentStore?.name || 'ร้านค้า'}...`}
                  className="flex-1 px-4 py-2.5 rounded-full text-xs bg-stone-100/90 dark:bg-zinc-800 border border-stone-200/80 dark:border-zinc-700 text-stone-900 dark:text-zinc-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />

                <button
                  type="button"
                  onClick={() => handleSendReply()}
                  disabled={!inputMessage.trim()}
                  className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md ${
                    inputMessage.trim()
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20 cursor-pointer scale-100 active:scale-95'
                      : 'bg-orange-200 text-white dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ส่ง</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-400">
              <StoreIcon className="w-12 h-12 mb-3 opacity-30 text-orange-500" />
              <p className="text-sm font-bold text-stone-700 dark:text-zinc-300">
                เลือกบทสนทนาของลูกค้า
              </p>
              <p className="text-xs text-stone-400 dark:text-zinc-500 mt-1 max-w-sm">
                เลือกลูกค้าจากรายชื่อฝั่งซ้ายเพื่อดูข้อความ ประวัติคำสั่งซื้อ และพิมพ์ข้อความตอบกลับ
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Customer Info Modal */}
      {isInfoModalOpen && activeThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full border border-stone-200 dark:border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                <User className="w-4 h-4 text-orange-500" />
                ข้อมูลลูกค้าและออเดอร์
              </h3>
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={activeThread.customerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                alt={activeThread.customerName || 'ลูกค้า'}
                className="w-12 h-12 rounded-2xl object-cover"
              />
              <div>
                <h4 className="font-bold text-stone-900 dark:text-zinc-100">{activeThread.customerName || 'ลูกค้า'}</h4>

                {activeThread.customerPhone && (
                  <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-stone-400" />
                    {activeThread.customerPhone}
                  </p>
                )}
              </div>
            </div>

            {activeThread.queueNumber && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span>คิว #{activeThread.queueNumber}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px]">
                    {activeThread.orderStatus}
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">{activeThread.orderSummary}</p>
                {activeThread.orderTotal && (
                  <p className="text-xs font-black text-amber-900 dark:text-amber-200">
                    ยอดรวม: ฿{activeThread.orderTotal}
                  </p>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              {activeThread.customerPhone && (
                <a
                  href={`tel:${activeThread.customerPhone}`}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  โทรหาลูกค้า
                </a>
              )}
              <button
                onClick={() => setIsInfoModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-bold text-xs hover:bg-stone-200"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
