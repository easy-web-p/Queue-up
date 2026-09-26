import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQueue } from '../../context/QueueContext';
import {
  TypingPublisher,
  subscribeToTyping,
  type TypingPresence
} from '../../services/typingPresenceService';
import type { Store, FoodItem, StoreChatMessage, StoreCustomerChatThread } from '../../types';
import {
  MessageSquare,
  Search,
  Heart,
  Send,
  Clock,
  Phone,
  Ticket,
  Store as StoreIcon,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Check,
  CheckCheck,
  Sparkles,
  Info,
  UtensilsCrossed,
  User,
  Users
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { formatStoreCategory } from '../../data/mockData';
import { ChatService, type CustomerStoreChatThread } from '../../services/chatService';

export const ChatPage: React.FC = () => {
  const {
    stores,
    foodItems,
    queues,
    currentUser,
    role,
    userStore,
    activeChatStoreId,
    setActiveChatStoreId,
    chatRoomTimestamp,
    customerThreadsTimestamp,
    getStoreChatMessages,
    sendStoreChatMessage,
    markStoreChatAsRead,
    followedStoreIds,
    toggleFollowStore,
    isStoreFollowed,
    openStoreDetail,
    setActiveQueueId,
    setCurrentView,
    openStoreContactAndTerms,
    openStoreChatPage,
    getStoreCustomerThreads,
    sendStoreCustomerReply,
    markStoreCustomerThreadAsRead,
    addToCart,
    clearCart,
    setIsCartOpen,
    addToast
  } = useQueue();

  // Resolve merchant store if user is a store owner or hi00000087@gmail.com
  const merchantStore = useMemo(() => {
    return (
      userStore ||
      (currentUser?.email?.toLowerCase() === 'hi00000087@gmail.com'
        ? stores.find(s => s.id === 'store-1')
        : null) ||
      (currentUser?.role === 'merchant' ? stores[0] : null)
    );
  }, [userStore, currentUser, stores]);

  // Mode: if user is merchant, default to 'merchant_customers' (customer list in left sidebar)
  const [chatScope, setChatScope] = useState<'merchant_customers' | 'all_stores'>(() => {
    return merchantStore ? 'merchant_customers' : 'all_stores';
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'following' | 'active_orders'>('all');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState<boolean>(() => !!activeChatStoreId);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [isCustomerInfoModalOpen, setIsCustomerInfoModalOpen] = useState<boolean>(false);

  // Selected customer thread for merchant view
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');

  // Pre-order form state (for buyer mode)
  const [bookingMealSummary, setBookingMealSummary] = useState<string>('ข้าวกะเพราถาดเนื้อโคขุน 3 กล่อง');
  const [bookingTime, setBookingTime] = useState<string>('12:30 น.');
  const [bookingGuestCount, setBookingGuestCount] = useState<number>(3);
  const [bookingNotes, setBookingNotes] = useState<string>('ขอแยกน้ำซุปและช้อนส้อมให้ด้วยครับ');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ==========================================
  // MERCHANT CUSTOMERS MODE DATA
  // ==========================================
  const rawCustomerThreads = useMemo(() => {
    if (!merchantStore) return [];
    return getStoreCustomerThreads(merchantStore.id);
  }, [merchantStore, getStoreCustomerThreads, customerThreadsTimestamp]);

  // Default select first customer thread
  useEffect(() => {
    if (chatScope === 'merchant_customers' && rawCustomerThreads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(rawCustomerThreads[0].id);
    }
  }, [chatScope, rawCustomerThreads, selectedThreadId]);

  const activeCustomerThread = useMemo(() => {
    if (chatScope !== 'merchant_customers') return null;
    return rawCustomerThreads.find(t => t.id === selectedThreadId) || rawCustomerThreads[0] || null;
  }, [chatScope, rawCustomerThreads, selectedThreadId]);

  // Mark customer thread as read on select
  const markedThreadRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (merchantStore && activeCustomerThread && activeCustomerThread.unreadCount > 0 && !markedThreadRef.current[activeCustomerThread.id]) {
      markedThreadRef.current[activeCustomerThread.id] = true;
      markStoreCustomerThreadAsRead(merchantStore.id, activeCustomerThread.id);
    }
  }, [merchantStore, activeCustomerThread?.id, activeCustomerThread?.unreadCount]);

  const filteredCustomerThreads = useMemo(() => {
    return rawCustomerThreads.filter(thread => {
      // Tab filter
      if (filterTab === 'active_orders' && !thread.queueNumber) return false;
      if (filterTab === 'following' && !thread.queueNumber && !thread.orderSummary) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = (thread.customerName || '').toLowerCase().includes(query);
        const matchPhone = thread.customerPhone?.toLowerCase().includes(query);
        const matchQueue = thread.queueNumber?.toLowerCase().includes(query);
        const matchMsg = thread.lastMessage?.toLowerCase().includes(query);
        return matchName || matchPhone || matchQueue || matchMsg;
      }
      return true;
    });
  }, [rawCustomerThreads, filterTab, searchQuery]);


  // ==========================================
  // BUYER / ALL STORES MODE DATA
  // ==========================================
  const selectedStore = useMemo(() => {
    if (activeChatStoreId) {
      const found = stores.find(s => s.id === activeChatStoreId);
      if (found) return found;
    }
    return stores[0] || null;
  }, [stores, activeChatStoreId]);

  // Real-time Firebase customer threads (pull data from Firebase)
  const [customerFirebaseThreads, setCustomerFirebaseThreads] = useState<CustomerStoreChatThread[]>([]);

  useEffect(() => {
    if (chatScope !== 'all_stores') return;
    const customerId = currentUser?.id || 'guest-buyer';
    const unsub = ChatService.subscribeCustomerThreads(customerId, (threads) => {
      if (Array.isArray(threads)) {
        setCustomerFirebaseThreads(threads);
      }
    });
    return () => unsub();
  }, [chatScope, currentUser?.id]);

  // Typing presence.
  //
  // This used to be a local timer: sending a message flipped "the shop is
  // typing" on for 2.4 seconds whether or not anyone was there, and the
  // merchant's own indicator was declared but never set. Both sides now
  // publish presence and watch for the other's.
  const [typingInStoreThread, setTypingInStoreThread] = useState<TypingPresence[]>([]);
  const [typingInCustomerThread, setTypingInCustomerThread] = useState<TypingPresence[]>([]);
  const storeTypingPublisherRef = useRef<TypingPublisher | null>(null);
  const customerTypingPublisherRef = useRef<TypingPublisher | null>(null);

  // Thread the customer is viewing, and the one the merchant has open.
  const customerFacingChatId = useMemo(
    () => (selectedStore && currentUser?.id ? `chat_${selectedStore.id}_${currentUser.id}` : ''),
    [selectedStore?.id, currentUser?.id]
  );
  const merchantFacingChatId = activeCustomerThread?.id || '';

  // Customer side: publish while typing to the store, watch for the store/AI.
  useEffect(() => {
    if (!customerFacingChatId || !currentUser?.id) {
      storeTypingPublisherRef.current = null;
      setTypingInStoreThread([]);
      return;
    }
    const publisher = new TypingPublisher(
      customerFacingChatId,
      currentUser.id,
      currentUser.fullName || 'ลูกค้า',
      'customer'
    );
    storeTypingPublisherRef.current = publisher;
    const unsubscribe = subscribeToTyping(customerFacingChatId, currentUser.id, setTypingInStoreThread);

    return () => {
      publisher.stop();
      storeTypingPublisherRef.current = null;
      unsubscribe();
    };
  }, [customerFacingChatId, currentUser?.id, currentUser?.fullName]);

  // Merchant side: publish while replying, watch for the customer.
  useEffect(() => {
    if (!merchantFacingChatId || !currentUser?.id) {
      customerTypingPublisherRef.current = null;
      setTypingInCustomerThread([]);
      return;
    }
    const publisher = new TypingPublisher(
      merchantFacingChatId,
      currentUser.id,
      merchantStore?.name || 'ร้านค้า',
      'merchant'
    );
    customerTypingPublisherRef.current = publisher;
    const unsubscribe = subscribeToTyping(merchantFacingChatId, currentUser.id, setTypingInCustomerThread);

    return () => {
      publisher.stop();
      customerTypingPublisherRef.current = null;
      unsubscribe();
    };
  }, [merchantFacingChatId, currentUser?.id, merchantStore?.name]);

  const isStoreTyping = typingInStoreThread.length > 0;
  const isCustomerTyping = typingInCustomerThread.length > 0;

  // Live messages for customer view
  const [liveStoreMessages, setLiveStoreMessages] = useState<StoreChatMessage[] | null>(null);

  useEffect(() => {
    if (chatScope !== 'all_stores' || !selectedStore) {
      setLiveStoreMessages(null);
      return;
    }
    const customerId = currentUser?.id || 'guest-buyer';
    const chatId = `chat_${selectedStore.id}_${customerId}`;

    const unsub = ChatService.subscribeThreadMessages(chatId, (custMsgs) => {
      if (custMsgs && custMsgs.length > 0) {
        const mapped: StoreChatMessage[] = custMsgs.map(m => ({
          id: m.id,
          storeId: selectedStore.id,
          senderId: m.senderRole === 'merchant' ? 'merchant' : customerId,
          senderName: m.senderName,
          senderRole: m.senderRole === 'merchant' ? 'seller' : (m.senderRole === 'ai_assistant' ? 'ai_assistant' : 'buyer'),
          message: m.message,
          timestamp: m.timestamp,
          read: m.read,
          aiMeta: m.aiMeta
        }));
        setLiveStoreMessages(mapped);
      }
    });
    return () => unsub();
  }, [chatScope, selectedStore?.id, currentUser?.id]);

  const currentStoreMessages = useMemo(() => {
    if (liveStoreMessages && liveStoreMessages.length > 0) {
      return liveStoreMessages;
    }
    if (!selectedStore) return [];
    return getStoreChatMessages(selectedStore.id);
  }, [liveStoreMessages, selectedStore, getStoreChatMessages, chatRoomTimestamp]);

  const relatedQueue = useMemo(() => {
    if (!selectedStore) return null;
    return queues.find(
      q => q.storeId === selectedStore.id && q.status !== 'COMPLETED' && q.status !== 'CANCELLED'
    );
  }, [selectedStore, queues]);

  const storeListWithDetails = useMemo(() => {
    return stores.map(store => {
      const localMessages = getStoreChatMessages(store.id);
      const localLastMsg = localMessages[localMessages.length - 1];

      // Find matching thread from Firebase
      const fbThread = customerFirebaseThreads.find(t => t.storeId === store.id);

      let lastMessage: { message: string; timestamp: string; senderRole?: string } | undefined = undefined;
      if (fbThread && fbThread.lastMessage) {
        const fbTime = new Date(fbThread.lastTimestamp).getTime();
        const localTime = localLastMsg ? new Date(localLastMsg.timestamp).getTime() : 0;
        if (fbTime >= localTime) {
          const lastCustMsg = fbThread.messages && fbThread.messages.length > 0 ? fbThread.messages[fbThread.messages.length - 1] : null;
          lastMessage = {
            message: fbThread.lastMessage,
            timestamp: fbThread.lastTimestamp,
            senderRole: lastCustMsg?.senderRole === 'customer' ? 'buyer' : 'seller'
          };
        } else {
          lastMessage = localLastMsg;
        }
      } else {
        lastMessage = localLastMsg;
      }

      const activeQueueForStore = queues.find(
        q => q.storeId === store.id && q.status !== 'COMPLETED' && q.status !== 'CANCELLED'
      );
      const isFollowed = isStoreFollowed(store.id);

      // Unread count: local unread seller messages + Firebase unread
      const localUnread = localMessages.filter(m => !m.read && m.senderRole === 'seller').length;
      const fbUnread = fbThread ? (fbThread.unreadCountCustomer ?? fbThread.unreadCount ?? 0) : 0;
      const unreadCount = Math.max(localUnread, fbUnread);

      return {
        store,
        messages: localMessages,
        lastMessage,
        activeQueueForStore,
        isFollowed,
        unreadCount
      };
    });
  }, [stores, customerFirebaseThreads, getStoreChatMessages, queues, isStoreFollowed, chatRoomTimestamp]);

  // Mark customer store chat as read when viewing or switching to a store
  const markedStoreRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (chatScope === 'all_stores' && selectedStore) {
      const details = storeListWithDetails.find(s => s.store.id === selectedStore.id);
      if (details && details.unreadCount > 0 && !markedStoreRef.current[selectedStore.id]) {
        markedStoreRef.current[selectedStore.id] = true;
        markStoreChatAsRead(selectedStore.id);
      }
    }
  }, [chatScope, selectedStore?.id, storeListWithDetails, markStoreChatAsRead]);

  const filteredStoreList = useMemo(() => {
    return storeListWithDetails.filter(item => {
      if (filterTab === 'following' && !item.isFollowed) return false;
      if (filterTab === 'active_orders' && !item.activeQueueForStore) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = item.store.name.toLowerCase().includes(query);
        const matchCategory = item.store.category.toLowerCase().includes(query);
        const matchLastMsg = item.lastMessage?.message.toLowerCase().includes(query);
        return matchName || matchCategory || matchLastMsg;
      }
      return true;
    });
  }, [storeListWithDetails, filterTab, searchQuery]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [
    chatScope,
    currentStoreMessages.length,
    activeCustomerThread?.messages?.length,
    selectedThreadId,
    activeChatStoreId,
    isMobileChatOpen,
    isStoreTyping,
    isCustomerTyping
  ]);

  // Handlers
  const handleSelectCustomerThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    if (merchantStore) {
      markStoreCustomerThreadAsRead(merchantStore.id, threadId);
    }
    setIsMobileChatOpen(true);
  };

  const handleSelectStore = (storeId: string) => {
    setActiveChatStoreId(storeId);
    markedStoreRef.current[storeId] = true;
    markStoreChatAsRead(storeId);
    setIsMobileChatOpen(true);
  };

  const handleSendMessage = (customText?: string) => {
    const text = (customText || inputMessage).trim();
    if (!text) return;

    if (chatScope === 'merchant_customers' && merchantStore && activeCustomerThread) {
      // Merchant replies to the selected customer thread
      sendStoreCustomerReply(merchantStore.id, activeCustomerThread.id, text);
      setInputMessage('');
      // The reply has been sent: stop advertising that we are still typing.
      customerTypingPublisherRef.current?.stop();
      addToast('ส่งข้อความสำเร็จ', `ส่งถึง ${activeCustomerThread.customerName || 'ลูกค้า'} เรียบร้อย`, 'success');
      return;
    }

    if (selectedStore) {
      // Customer sends message to the store
      sendStoreChatMessage(selectedStore.id, text, relatedQueue?.id, 'buyer');
      setInputMessage('');
      // The message has been sent: stop advertising that we are still typing.
      storeTypingPublisherRef.current?.stop();
    }
  };

  const handleSendBookingOrder = () => {
    if (!selectedStore) return;
    const bookingSummary = `[แจ้งการจองอาหารล่วงหน้า]\n• เมนู: ${bookingMealSummary}\n• เวลานัดรับ: ${bookingTime} (${bookingGuestCount} ท่าน)\n• หมายเหตุ: ${bookingNotes}`;

    sendStoreChatMessage(selectedStore.id, bookingSummary, relatedQueue?.id, 'buyer');

    setIsBookingModalOpen(false);
    addToast('ส่งคำขอจองอาหารแล้ว', `ส่งการจองไปยังร้าน ${selectedStore.name} เรียบร้อย`, 'success');
  };

  const handlePayBookingOrder = (
    snapshot: NonNullable<StoreChatMessage['bookingSnapshot']>,
    targetStore: Store
  ) => {
    // 1. Try to find matching food item in the store
    const cleanDishName = snapshot.itemsSummary
      ? snapshot.itemsSummary.replace(/x\d+\s*กล่อง/i, '').replace(/\d+\s*(กล่อง|จาน|แก้ว|ชุด|ที่)/gi, '').trim()
      : '';

    let matchedFood = foodItems.find(
      f => f.storeId === targetStore.id && (
        f.id === snapshot.foodId ||
        (cleanDishName && f.name.toLowerCase().includes(cleanDishName.toLowerCase()))
      )
    );

    // If not found in store, create a dynamic pre-order FoodItem
    if (!matchedFood) {
      matchedFood = {
        id: snapshot.foodId || `booking-food-${Date.now()}`,
        storeId: targetStore.id,
        storeName: targetStore.name,
        name: cleanDishName || 'รายการสั่งจองอาหารล่วงหน้า',
        nameEn: 'Advance Pre-ordered Meal',
        price: Math.round((snapshot.total || 89) / (snapshot.quantity || 1)),
        description: `สั่งจองอาหารล่วงหน้าร้าน ${targetStore.name} เวลานัดรับ ${snapshot.bookingTime || '12:30 น.'}`,
        category: targetStore.category || 'rice',
        image: targetStore.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        rating: 5.0,
        orderCount: 1,
        isAvailable: true,
        preparationMinutes: 15,
        tags: ['สั่งจองล่วงหน้า']
      };
    }

    // 2. Clear previous cart and add this booking item
    clearCart();
    addToCart({
      food: matchedFood,
      quantity: snapshot.quantity || 1,
      selectedOptions: [],
      specialNote: `[สั่งจองล่วงหน้า เวลานัดรับ: ${snapshot.bookingTime || '12:30 น.'} (${snapshot.guestCount || 1} ท่าน)] ${snapshot.specialNote || ''}`.trim()
    });

    // 3. Open Cart Drawer for immediate checkout & PromptPay
    setIsCartOpen(true);
    addToast(
      'เปิดหน้าต่างชำระเงิน 💳',
      `นำรายการสั่งจองเข้าสู่ขั้นตอนชำระเงินเรียบร้อยแล้ว ยอดชำระ ฿${snapshot.total}`,
      'success'
    );
  };

  const merchantQuickChips = [
    'รับทราบคำขอเรียบร้อยครับ กำลังปรุงอาหารให้ครับ 🙏',
    'อาหารปรุงเสร็จแล้วครับ มารับที่เคาน์เตอร์หน้าร้านได้เลยครับ 🍽️',
    'จัดเตรียมช้อนส้อมและเครื่องปรุงพิเศษให้เรียบร้อยครับ ✨',
    'ขออภัยในความล่าช้าครับ กำลังเร่งมือให้อย่างเต็มที่ครับ 🔥',
    'ขอบคุณคุณลูกค้าที่มาอุดหนุนครับผม 😊'
  ];

  const customerQuickChips = [
    'อาหารใกล้เสร็จหรือยังครับ ⏱️',
    'ขอเผ็ดน้อย ไม่ใส่ผงชูรส 🌶️',
    'ขอช้อนส้อมและเครื่องปรุงเพิ่ม 🥢',
    'จะเดินไปรับช้าประมาณ 5 นาทีครับ 🚶',
    'สั่งแยกน้ำแกง/น้ำซุปให้ด้วยครับ 🍲'
  ];

  const quickChips = chatScope === 'merchant_customers' ? merchantQuickChips : customerQuickChips;

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
      {/* Switcher Banner if user owns a store */}
      {merchantStore && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 rounded-2xl bg-orange-50/60 dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <StoreIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-stone-900 dark:text-zinc-100 block">
                {chatScope === 'merchant_customers'
                  ? `ระบบแชทตอบกลับลูกค้าของร้าน: ${merchantStore.name}`
                  : `กล่องแชทผู้ซื้อ (คุยกับร้านค้าอื่นๆ)`}
              </span>
              <span className="text-[11px] text-stone-500 dark:text-zinc-400">
                {chatScope === 'merchant_customers'
                  ? `แสดงรายชื่อลูกค้าที่เคยทักมา และประวัติการสนทนาโต้ตอบแบบเรียลไทม์`
                  : `สลับกลับไปดูแชทลูกค้าของร้านคุณได้ตลอดเวลา`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-2xs">
            <button
              onClick={() => {
                setChatScope('merchant_customers');
                setIsMobileChatOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chatScope === 'merchant_customers'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>แชทลูกค้าของร้าน ({rawCustomerThreads.length})</span>
            </button>
            <button
              onClick={() => {
                setChatScope('all_stores');
                setIsMobileChatOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                chatScope === 'all_stores'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900'
              }`}
            >
              <StoreIcon className="w-3.5 h-3.5" />
              <span>แชทร้านค้าทั่วไป ({stores.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[780px] max-h-[85vh]">
        {/* ========================================================
            LEFT COLUMN: Thread History (Customers or Stores)
            ======================================================== */}
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
                {chatScope === 'merchant_customers'
                  ? `กล่องข้อความลูกค้า (${filteredCustomerThreads.length})`
                  : `กล่องข้อความร้านค้า (${filteredStoreList.length})`}
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
                placeholder={
                  chatScope === 'merchant_customers'
                    ? 'ค้นหาชื่อลูกค้า หรือข้อความ...'
                    : 'ค้นหาชื่อร้าน หรือข้อความ...'
                }
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
                <span>
                  {chatScope === 'merchant_customers'
                    ? `ที่ติดตาม (${rawCustomerThreads.filter(t => t.queueNumber || t.orderSummary).length})`
                    : `ที่ติดตาม (${followedStoreIds.length})`}
                </span>
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

          {/* Quick Horizontal Contact Bar */}
          {chatScope === 'merchant_customers' ? (
            rawCustomerThreads.length > 0 && filterTab === 'all' && (
              <div className="px-4 py-2.5 border-b border-stone-100 dark:border-zinc-800/80 bg-orange-50/30 dark:bg-zinc-800/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 block mb-1.5">
                  ลูกค้าที่ติดต่อล่าสุด
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {rawCustomerThreads.slice(0, 6).map(thread => (
                    <button
                      key={thread.id}
                      onClick={() => handleSelectCustomerThread(thread.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 transition-all cursor-pointer ${
                        activeCustomerThread?.id === thread.id
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
            )
          ) : (
            followedStoreIds.length > 0 && filterTab === 'all' && (
              <div className="px-4 py-2.5 border-b border-stone-100 dark:border-zinc-800/80 bg-orange-50/30 dark:bg-zinc-800/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400 block mb-1.5">
                  ร้านโปรดที่ติดตามด่วน
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {stores
                    .filter(s => followedStoreIds.includes(s.id))
                    .map(store => (
                      <button
                        key={store.id}
                        onClick={() => handleSelectStore(store.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 transition-all cursor-pointer ${
                          selectedStore?.id === store.id
                            ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                            : 'bg-white dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 border-stone-200 dark:border-zinc-700 hover:border-orange-300'
                        }`}
                      >
                        <img
                          src={store.logo || store.image}
                          alt={store.name}
                          className="w-4 h-4 rounded-full object-cover"
                        />
                        <span className="truncate max-w-[100px]">{store.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )
          )}

          {/* Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800/80">
            {chatScope === 'merchant_customers' ? (
              // 1. Merchant View: Customer list
              filteredCustomerThreads.length === 0 ? (
                <div className="p-8 text-center text-stone-400 dark:text-zinc-500 flex flex-col items-center justify-center h-full">
                  <Users className="w-10 h-10 mb-2 opacity-30 text-orange-500" />
                  <p className="text-xs font-semibold">ไม่พบรายการแชทลูกค้าที่ตรงกัน</p>
                  <p className="text-[11px] mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองด้านบน</p>
                </div>
              ) : (
                filteredCustomerThreads.map(thread => {
                  const isSelected = activeCustomerThread?.id === thread.id;

                  return (
                    <div
                      key={thread.id}
                      onClick={() => handleSelectCustomerThread(thread.id)}
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
                          alt={thread.customerName || 'ลูกค้า'}
                          className="w-11 h-11 rounded-2xl object-cover border border-stone-200 dark:border-zinc-700 shadow-xs"
                        />
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 bg-emerald-500" />
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

                        {/* Snippet & Badge */}
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate leading-relaxed flex-1">
                            {thread.lastMessage || 'ยังไม่มีประวัติการพูดคุย กดเพื่อเริ่มสนทนา'}
                          </p>

                          {thread.unreadCount > 0 && (
                            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs animate-in zoom-in-75 duration-200">
                              {thread.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              // 2. Buyer View: Store list
              filteredStoreList.length === 0 ? (
                <div className="p-8 text-center text-stone-400 dark:text-zinc-500 flex flex-col items-center justify-center h-full">
                  <StoreIcon className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-xs font-semibold">ไม่พบรายการแชทที่ตรงกัน</p>
                  <p className="text-[11px] mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองด้านบน</p>
                </div>
              ) : (
                filteredStoreList.map(({ store, lastMessage, activeQueueForStore, isFollowed, unreadCount }) => {
                  const isSelected = selectedStore?.id === store.id;

                  return (
                    <div
                      key={store.id}
                      onClick={() => handleSelectStore(store.id)}
                      className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 relative ${
                        isSelected
                          ? 'bg-orange-50/90 dark:bg-zinc-800/90 border-l-4 border-l-orange-500'
                          : 'hover:bg-stone-50 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="relative shrink-0 mt-0.5">
                        <img
                          src={store.logo || store.image}
                          alt={store.name}
                          className="w-11 h-11 rounded-2xl object-cover border border-stone-200 dark:border-zinc-700 shadow-xs"
                        />
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${
                            store.isOpen ? 'bg-emerald-500' : 'bg-stone-400'
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="text-xs font-bold text-stone-900 dark:text-zinc-100 truncate">
                              {store.name}
                            </h4>
                            {isFollowed && (
                              <Heart className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />
                            )}
                          </div>

                          {lastMessage && (
                            <span className="text-[10px] text-stone-400 dark:text-zinc-500 whitespace-nowrap">
                              {formatTime(lastMessage.timestamp)}
                            </span>
                          )}
                        </div>

                        {activeQueueForStore && (
                          <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold">
                            <Ticket className="w-3 h-3" />
                            <span>คิว #{activeQueueForStore.queueNumber}</span>
                            <span className="font-normal opacity-80">({activeQueueForStore.status})</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate leading-relaxed flex-1">
                            {lastMessage ? (
                              <>
                                {lastMessage.senderRole === 'buyer' && <span className="font-medium text-stone-700 dark:text-zinc-300">คุณ: </span>}
                                {lastMessage.message}
                              </>
                            ) : (
                              'ยังไม่มีประวัติการพูดคุย กดเพื่อเริ่มสนทนา'
                            )}
                          </p>

                          {unreadCount > 0 && (
                            <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black flex items-center justify-center shadow-xs animate-in zoom-in-75 duration-200">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* ========================================================
            RIGHT COLUMN: Active Conversation Room
            ======================================================== */}
        <div
          className={`lg:col-span-8 xl:col-span-8 flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-orange-200/80 dark:border-zinc-800 overflow-hidden shadow-xs ${
            isMobileChatOpen ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {chatScope === 'merchant_customers' ? (
            // ==========================================
            // MERCHANT CHAT ROOM WITH SELECTED CUSTOMER
            // ==========================================
            activeCustomerThread ? (
              <>
                {/* Chat Room Top Bar */}
                <div className="p-3.5 sm:p-4 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-900 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setIsMobileChatOpen(false)}
                      className="lg:hidden p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                      title="กลับไปยังรายชื่อลูกค้า"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="relative shrink-0">
                      <img
                        src={activeCustomerThread.customerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                        alt={activeCustomerThread.customerName || 'ลูกค้า'}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border border-stone-200 dark:border-zinc-700 shadow-xs"
                      />
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 bg-emerald-500" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-zinc-100 truncate">
                          {activeCustomerThread.customerName || 'ลูกค้า'}
                        </h3>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                          ออนไลน์
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                        <span>{formatStoreCategory(merchantStore?.category)}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          ร้านค้า: {merchantStore?.name || 'ร้านของคุณ'}
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

                    {merchantStore && (
                      <button
                        onClick={() => openStoreDetail(merchantStore.id)}
                        className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-xs font-bold border border-orange-200 dark:border-orange-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="ดูเมนูร้าน"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">ดูเมนูร้าน</span>
                      </button>
                    )}

                    <button
                      onClick={() => setIsCustomerInfoModalOpen(true)}
                      className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                      title="ข้อมูลลูกค้าและออเดอร์"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Order / Queue Context Banner if active queue exists */}
                {activeCustomerThread.queueNumber && (
                  <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        #{activeCustomerThread.queueNumber}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-950 dark:text-amber-200">
                            ออเดอร์คิว #{activeCustomerThread.queueNumber}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                            {activeCustomerThread.orderStatus || 'กำลังปรุง'}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800 dark:text-amber-400 truncate">
                          {activeCustomerThread.orderSummary || 'รายการอาหาร'} {activeCustomerThread.orderTotal ? `(฿${activeCustomerThread.orderTotal})` : ''}
                        </p>
                      </div>
                    </div>

                    {activeCustomerThread.customerPhone && (
                      <a
                        href={`tel:${activeCustomerThread.customerPhone}`}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Phone className="w-3 h-3" />
                        <span>โทรหาลูกค้า</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Message Bubble Stream: Customer & Store conversation */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-stone-50/30 dark:bg-zinc-950/20">
                  <div className="text-center my-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400">
                      การสนทนาปลอดภัยระหว่างคุณและร้านค้า {merchantStore?.name || 'ร้านค้า'} กับ {activeCustomerThread.customerName || 'ลูกค้า'}
                    </span>
                  </div>

                  {(!activeCustomerThread.messages || activeCustomerThread.messages.length === 0) ? (
                    <div className="py-12 text-center text-stone-400 dark:text-zinc-500 flex flex-col items-center">
                      <div className="w-16 h-16 rounded-3xl border-2 border-dashed border-orange-300 dark:border-zinc-700 flex items-center justify-center mb-3 text-orange-400">
                        <MessageSquare className="w-8 h-8 opacity-60" />
                      </div>
                      <p className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                        ยังไม่มีการสนทนาในห้องนี้
                      </p>
                      <p className="text-[11px] mt-1 max-w-xs text-stone-400 dark:text-zinc-500">
                        คุณสามารถพิมพ์สอบถาม สั่งจองอาหารล่วงหน้า หรือระบุข้อจำกัดการปรุงได้เลย
                      </p>
                    </div>
                  ) : (
                    (activeCustomerThread.messages || []).map(msg => {
                      const isMe = msg.senderRole === 'merchant';

                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-2.5 max-w-[85%] sm:max-w-[75%] ${
                            isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                          }`}
                        >
                          {!isMe ? (
                            <img
                              src={activeCustomerThread.customerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                              alt={activeCustomerThread.customerName || 'ลูกค้า'}
                              className="w-7 h-7 rounded-xl object-cover shrink-0 mt-1 border border-stone-200 dark:border-zinc-700"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                              <StoreIcon className="w-4 h-4" />
                            </div>
                          )}

                          <div className="flex flex-col space-y-1">
                            {isMe ? (
                              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 mr-1 text-right">
                                ร้านของคุณ ({merchantStore?.name || 'ร้านค้า'})
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-stone-500 dark:text-zinc-400 ml-1">
                                {msg.senderName || activeCustomerThread.customerName || 'ลูกค้า'}
                              </span>
                            )}


                            <div
                              className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                                isMe
                                  ? 'bg-orange-500 text-white rounded-tr-xs'
                                  : 'bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 border border-stone-200/80 dark:border-zinc-700 rounded-tl-xs'
                              }`}
                            >
                              <p className="whitespace-pre-line">{msg.message}</p>

                              <div
                                className={`flex items-center justify-end gap-1.5 mt-1 text-[9px] select-none ${
                                  isMe ? 'text-orange-100' : 'text-stone-400 dark:text-zinc-500'
                                }`}
                              >
                                <span>{formatTime(msg.timestamp)}</span>
                                {isMe && (
                                  msg.read ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-white/20 dark:bg-black/20 text-white font-medium text-[9px] shadow-2xs transition-all duration-300 animate-in fade-in zoom-in-75">
                                      <span>อ่านแล้ว</span>
                                      <CheckCheck className="w-3.5 h-3.5 text-emerald-300 stroke-[2.5] animate-in zoom-in-50 duration-300" />
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] text-orange-200/90 font-normal">
                                      <span>ส่งแล้ว</span>
                                      <Check className="w-3 h-3 text-orange-200/90 stroke-[2]" />
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Typing Indicator for Merchant View */}
                  {isCustomerTyping && activeCustomerThread && (
                    <div className="flex items-end gap-2.5 max-w-[80%] mr-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <img
                        src={activeCustomerThread.customerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                        alt={activeCustomerThread.customerName || 'ลูกค้า'}
                        className="w-7 h-7 rounded-xl object-cover shrink-0 mb-1 border border-stone-200 dark:border-zinc-700 shadow-xs"
                      />
                      <div className="flex flex-col space-y-1">
                        <span className="text-[10px] font-bold text-stone-500 dark:text-zinc-400 ml-1">
                          {typingInCustomerThread[0]?.displayName || activeCustomerThread.customerName || 'ลูกค้า'} กำลังพิมพ์...
                        </span>
                        <div className="bg-white dark:bg-zinc-800 border border-stone-200/80 dark:border-zinc-700/80 rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-xs flex items-center gap-1.5 w-fit">
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce"></span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Chip Inquiries */}
                <div className="px-4 py-2 border-t border-stone-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto no-scrollbar flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    ด่วน:
                  </span>
                  {quickChips.map((chip, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(chip)}
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
                    onChange={e => {
                      setInputMessage(e.target.value);
                      // Throttled inside the publisher; safe to call per keystroke.
                      customerTypingPublisherRef.current?.keystroke();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`พิมพ์ข้อความตอบกลับลูกค้าในนามร้าน ${merchantStore?.name || 'ร้านค้า'}...`}
                    className="flex-1 px-4 py-2.5 rounded-full text-xs bg-stone-100/90 dark:bg-zinc-800 border border-stone-200/80 dark:border-zinc-700 text-stone-900 dark:text-zinc-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />

                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
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
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-stone-400 dark:text-zinc-500">
                <Users className="w-12 h-12 mb-3 text-orange-400 opacity-40" />
                <h3 className="text-sm font-bold text-stone-700 dark:text-zinc-300">
                  เลือกบทสนทนาของลูกค้าจากรายชื่อด้านซ้าย
                </h3>
                <p className="text-xs mt-1 max-w-sm">
                  คลิกที่ชื่อลูกค้าเพื่อดูประวัติข้อความ หรือพิมพ์ตอบกลับ
                </p>
              </div>
            )
          ) : (
            // ==========================================
            // BUYER CHAT ROOM WITH SELECTED STORE
            // ==========================================
            selectedStore ? (
              <>
                {/* Chat Room Top Bar */}
                <div className="p-3.5 sm:p-4 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-900 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setIsMobileChatOpen(false)}
                      className="lg:hidden p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                      title="กลับไปยังรายชื่อร้านค้า"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="relative shrink-0">
                      <img
                        src={selectedStore.logo || selectedStore.image}
                        alt={selectedStore.name}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border border-stone-200 dark:border-zinc-700 shadow-xs"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${
                          selectedStore.isOpen ? 'bg-emerald-500' : 'bg-stone-400'
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-zinc-100 truncate">
                          {selectedStore.name}
                        </h3>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
                          {selectedStore.isOpen ? 'เปิดบริการ' : 'ปิดชั่วคราว'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                        <span>{selectedStore.category}</span>
                        <span>•</span>
                        {isStoreTyping ? (
                          <span className="text-orange-500 font-bold animate-pulse flex items-center gap-1">
                            กำลังพิมพ์ตอบกลับ...
                            <span className="inline-flex gap-0.5">
                              <span className="w-1 h-1 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.3s]"></span>
                              <span className="w-1 h-1 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.15s]"></span>
                              <span className="w-1 h-1 rounded-full bg-orange-500 animate-bounce"></span>
                            </span>
                          </span>
                        ) : (
                          <span>ตอบกลับเฉลี่ย ~3 นาที</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Top Action Buttons */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                      onClick={() => toggleFollowStore(selectedStore.id)}
                      className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                        isStoreFollowed(selectedStore.id)
                          ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400'
                          : 'bg-white text-stone-700 border-stone-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 hover:border-orange-300'
                      }`}
                      title={isStoreFollowed(selectedStore.id) ? 'เลิกติดตาม' : 'กดติดตามร้านนี้'}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          isStoreFollowed(selectedStore.id) ? 'fill-red-500 text-red-500' : ''
                        }`}
                      />
                      <span className="hidden sm:inline">
                        {isStoreFollowed(selectedStore.id) ? 'ติดตามแล้ว' : 'ติดตาม'}
                      </span>
                    </button>

                    <button
                      onClick={() => openStoreDetail(selectedStore.id)}
                      className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-xs font-bold border border-orange-200 dark:border-orange-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="ดูเมนูร้าน"
                    >
                      <UtensilsCrossed className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">ดูเมนูร้าน</span>
                    </button>

                    <button
                      onClick={() => openStoreContactAndTerms(selectedStore, 'contact')}
                      className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
                      title="ข้อมูลติดต่อร้าน"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Related Queue Banner */}
                {relatedQueue && (
                  <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        #{relatedQueue.queueNumber}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-950 dark:text-amber-200">
                            ออเดอร์คิว #{relatedQueue.queueNumber}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                            {relatedQueue.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800 dark:text-amber-400 truncate">
                          {relatedQueue.items.map(i => `${i.food?.name || 'อาหาร'} x${i.quantity}`).join(', ')} (฿{relatedQueue.total})
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setActiveQueueId(relatedQueue.id);
                        setCurrentView('queue-tracking');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-100 transition-colors cursor-pointer shrink-0"
                    >
                      ดูบัตรคิว
                    </button>
                  </div>
                )}

                {/* Stream */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-stone-50/30 dark:bg-zinc-950/20">
                  <div className="text-center my-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400">
                      การสนทนาปลอดภัยระหว่างคุณและร้านค้า {selectedStore.name}
                    </span>
                  </div>

                  {currentStoreMessages.length === 0 ? (
                    <div className="py-12 text-center text-stone-400 dark:text-zinc-500 flex flex-col items-center">
                      <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-orange-500" />
                      <p className="text-xs font-semibold text-stone-600 dark:text-zinc-300">
                        ยังไม่มีการสนทนาในห้องนี้
                      </p>
                      <p className="text-[11px] mt-1 max-w-xs">
                        คุณสามารถพิมพ์สอบถาม สั่งจองอาหารล่วงหน้า หรือระบุข้อจำกัดการปรุงได้เลย
                      </p>
                    </div>
                  ) : (
                    currentStoreMessages.map(msg => {
                      const isMe = msg.senderRole === 'buyer';

                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-2.5 max-w-[85%] sm:max-w-[75%] ${
                            isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                          }`}
                        >
                          {!isMe && (
                            <img
                              src={selectedStore.logo || selectedStore.image}
                              alt={selectedStore.name}
                              className="w-7 h-7 rounded-xl object-cover shrink-0 mt-1 border border-stone-200 dark:border-zinc-700"
                            />
                          )}

                          <div className="flex flex-col space-y-1">
                            {!isMe && (
                              <div className="flex items-center gap-1.5 ml-1">
                                <span className="text-[10px] font-bold text-stone-600 dark:text-zinc-300">
                                  {msg.senderName}
                                </span>
                                {msg.senderRole === 'ai_assistant' && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    🤖 AI Assistant
                                  </span>
                                )}
                              </div>
                            )}

                            <div
                              className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs whitespace-pre-line ${
                                isMe
                                  ? 'bg-orange-500 text-white rounded-tr-xs'
                                  : msg.senderRole === 'ai_assistant'
                                    ? 'bg-blue-50/90 border border-blue-200/90 text-blue-950 rounded-tl-xs dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-100'
                                    : 'bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-100 border border-stone-200/80 dark:border-zinc-700 rounded-tl-xs'
                              }`}
                            >
                              <p className="whitespace-pre-line">{msg.message}</p>

                              {/* Interactive Pre-order Booking Payment Card */}
                              {msg.bookingSnapshot && (
                                <div className="mt-3 p-3 rounded-xl bg-white/95 dark:bg-zinc-900/95 border border-orange-200 dark:border-zinc-700 shadow-xs text-stone-800 dark:text-zinc-200 space-y-2 text-left not-italic font-normal">
                                  <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-1.5">
                                    <span className="text-[11px] font-extrabold flex items-center gap-1.5 text-stone-800 dark:text-zinc-100">
                                      <UtensilsCrossed className="w-3.5 h-3.5 text-orange-500" />
                                      สรุปรายการสั่งจองอาหารล่วงหน้า
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                      {msg.bookingSnapshot.status || 'รอการชำระเงิน'}
                                    </span>
                                  </div>

                                  <div className="text-[11px] space-y-1.5">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="text-stone-500 dark:text-zinc-400 shrink-0">เมนูอาหาร:</span>
                                      <span className="font-bold text-stone-900 dark:text-zinc-100 text-right">{msg.bookingSnapshot.itemsSummary}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-stone-500 dark:text-zinc-400">เวลานัดรับ:</span>
                                      <span className="font-semibold text-stone-800 dark:text-zinc-200">{msg.bookingSnapshot.bookingTime} ({msg.bookingSnapshot.guestCount || 1} ท่าน)</span>
                                    </div>
                                    {msg.bookingSnapshot.specialNote && (
                                      <div className="flex justify-between items-start gap-2">
                                        <span className="text-stone-500 dark:text-zinc-400 shrink-0">หมายเหตุ:</span>
                                        <span className="text-stone-700 dark:text-zinc-300 italic text-right">{msg.bookingSnapshot.specialNote}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center pt-1.5 border-t border-dashed border-stone-200 dark:border-zinc-800">
                                      <span className="font-bold text-stone-700 dark:text-zinc-300">ยอดรวมทั้งสิ้น:</span>
                                      <span className="text-sm font-black text-orange-600 dark:text-orange-400">฿{msg.bookingSnapshot.total?.toLocaleString()}</span>
                                    </div>
                                  </div>

                                  {msg.bookingSnapshot.canPay && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handlePayBookingOrder(msg.bookingSnapshot!, selectedStore)}
                                      className="w-full mt-2 py-2 text-xs font-bold bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 hover:from-orange-600 hover:to-emerald-600 text-white shadow-md rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                                    >
                                      <span className="text-base">💳</span>
                                      <span>ชำระเงิน / ยืนยันการสั่งจอง (฿{msg.bookingSnapshot.total?.toLocaleString()})</span>
                                    </Button>
                                  )}
                                </div>
                              )}

                              <div
                                className={`flex items-center justify-end gap-1.5 mt-1 text-[9px] select-none ${
                                  isMe ? 'text-orange-100' : 'text-stone-400 dark:text-zinc-500'
                                }`}
                              >
                                <span>{formatTime(msg.timestamp)}</span>
                                {isMe && (
                                  msg.read ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-white/20 dark:bg-black/20 text-white font-medium text-[9px] shadow-2xs transition-all duration-300 animate-in fade-in zoom-in-75">
                                      <span>อ่านแล้ว</span>
                                      <CheckCheck className="w-3.5 h-3.5 text-emerald-300 stroke-[2.5] animate-in zoom-in-50 duration-300" />
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] text-orange-200/90 font-normal">
                                      <span>ส่งแล้ว</span>
                                      <Check className="w-3 h-3 text-orange-200/90 stroke-[2]" />
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Typing Indicator for Buyer View */}
                  {isStoreTyping && (
                    <div className="flex items-end gap-2.5 max-w-[80%] mr-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <img
                        src={selectedStore.logo || selectedStore.image}
                        alt={selectedStore.name}
                        className="w-7 h-7 rounded-xl object-cover shrink-0 mb-1 border border-stone-200 dark:border-zinc-700 shadow-xs"
                      />
                      <div className="flex flex-col space-y-1">
                        <span className="text-[10px] font-bold text-stone-500 dark:text-zinc-400 ml-1 flex items-center gap-1">
                          <span>{typingInStoreThread[0]?.displayName || selectedStore.name} กำลังพิมพ์ตอบกลับ...</span>
                        </span>
                        <div className="bg-white dark:bg-zinc-800 border border-stone-200/80 dark:border-zinc-700/80 rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-xs flex items-center gap-1.5 w-fit">
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce"></span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Chips */}
                <div className="px-4 py-2 border-t border-stone-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto no-scrollbar flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    ด่วน:
                  </span>
                  {customerQuickChips.map((chip, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(chip)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 hover:bg-orange-100 hover:text-orange-800 dark:hover:bg-zinc-700 shrink-0 transition-colors cursor-pointer border border-stone-200/60 dark:border-zinc-700"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="p-3 sm:p-4 border-t border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBookingModalOpen(true)}
                    className="p-2 sm:px-3 sm:py-2.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800/60 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="แจ้งการจองอาหารหรือสั่งล่วงหน้า"
                  >
                    <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">แจ้งจองอาหาร</span>
                  </button>

                  <input
                    type="text"
                    value={inputMessage}
                    onChange={e => {
                      setInputMessage(e.target.value);
                      // Throttled inside the publisher; safe to call per keystroke.
                      storeTypingPublisherRef.current?.keystroke();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`พิมพ์ข้อความถึงร้าน ${selectedStore.name}...`}
                    className="flex-1 px-4 py-2.5 rounded-full text-xs bg-stone-100/90 dark:bg-zinc-800 border border-stone-200/80 dark:border-zinc-700 text-stone-900 dark:text-zinc-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />

                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
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
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-stone-400 dark:text-zinc-500">
                <StoreIcon className="w-12 h-12 mb-3 text-orange-400 opacity-40" />
                <h3 className="text-sm font-bold text-stone-700 dark:text-zinc-300">
                  เลือกบทสนทนาจากร้านค้าด้านซ้าย
                </h3>
              </div>
            )
          )}
        </div>
      </div>

      {/* Customer Info Modal (Merchant View) */}
      {isCustomerInfoModalOpen && activeCustomerThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full border border-stone-200 dark:border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                <User className="w-4 h-4 text-orange-500" />
                ข้อมูลลูกค้าและออเดอร์
              </h3>
              <button
                onClick={() => setIsCustomerInfoModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={activeCustomerThread.customerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                alt={activeCustomerThread.customerName || 'ลูกค้า'}
                className="w-12 h-12 rounded-2xl object-cover"
              />
              <div>
                <h4 className="font-bold text-stone-900 dark:text-zinc-100">{activeCustomerThread.customerName || 'ลูกค้า'}</h4>
                {activeCustomerThread.customerPhone && (
                  <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-stone-400" />
                    {activeCustomerThread.customerPhone}
                  </p>
                )}
              </div>
            </div>

            {activeCustomerThread.queueNumber && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span>คิว #{activeCustomerThread.queueNumber}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px]">
                    {activeCustomerThread.orderStatus}
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">{activeCustomerThread.orderSummary}</p>
                {activeCustomerThread.orderTotal && (
                  <p className="text-xs font-black text-amber-900 dark:text-amber-200">
                    ยอดรวม: ฿{activeCustomerThread.orderTotal}
                  </p>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              {activeCustomerThread.customerPhone && (
                <a
                  href={`tel:${activeCustomerThread.customerPhone}`}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  โทรหาลูกค้า
                </a>
              )}
              <button
                onClick={() => setIsCustomerInfoModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-bold text-xs hover:bg-stone-200"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-order / Booking Modal (Buyer View) */}
      {isBookingModalOpen && selectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-orange-200 dark:border-zinc-800 shadow-2xl p-5 text-stone-900 dark:text-zinc-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black">แจ้งจองอาหารล่วงหน้า</h3>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                    ร้าน {selectedStore.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBookingModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 my-4 text-xs">
              <div>
                <label className="font-bold block mb-1">เมนูที่ต้องการจอง / สั่งล่วงหน้า:</label>
                <input
                  type="text"
                  value={bookingMealSummary}
                  onChange={e => setBookingMealSummary(e.target.value)}
                  placeholder="เช่น ข้าวกะเพราถาด 3 กล่อง, ต้มยำรวมมิตร..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">เวลานัดรับ:</label>
                  <input
                    type="text"
                    value={bookingTime}
                    onChange={e => setBookingTime(e.target.value)}
                    placeholder="เช่น 12:30 น."
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">จำนวนคน / กล่อง:</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={bookingGuestCount}
                    onChange={e => setBookingGuestCount(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">หมายเหตุเพิ่มเติม:</label>
                <input
                  type="text"
                  value={bookingNotes}
                  onChange={e => setBookingNotes(e.target.value)}
                  placeholder="เช่น ขอไม่ใส่พริก, แยกน้ำซุป, ขอช้อนส้อม..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setIsBookingModalOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={handleSendBookingOrder}
              >
                ส่งข้อมูลการจองไปยังแชท
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
