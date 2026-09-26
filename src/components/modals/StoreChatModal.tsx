import React, { useState, useRef, useEffect } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Store, StoreChatMessage, FoodItem } from '../../types';
import { ChatService } from '../../services/chatService';
import {
  X,
  Send,
  MessageSquare,
  Clock,
  Phone,
  FileText,
  CheckCheck,
  Store as StoreIcon,
  User,
  Sparkles,
  Info,
  Maximize2,
  UtensilsCrossed
} from 'lucide-react';
import { Button } from '../ui/Button';

interface StoreChatModalProps {
  store: Store | null;
  orderId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const StoreChatModal: React.FC<StoreChatModalProps> = ({
  store,
  orderId,
  isOpen,
  onClose
}) => {
  const {
    currentUser,
    role,
    queues,
    foodItems,
    addToCart,
    clearCart,
    setIsCartOpen,
    sendStoreChatMessage,
    getStoreChatMessages,
    openStoreContactAndTerms,
    openChatPage,
    addToast
  } = useQueue();

  const [inputMessage, setInputMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [liveMessages, setLiveMessages] = useState<StoreChatMessage[] | null>(null);

  useEffect(() => {
    if (!isOpen || !store) {
      setLiveMessages(null);
      return;
    }
    const customerId = currentUser?.id || 'guest-buyer';
    const chatId = `chat_${store.id}_${customerId}`;

    const unsub = ChatService.subscribeThreadMessages(chatId, (custMsgs) => {
      if (custMsgs && custMsgs.length > 0) {
        const mapped: StoreChatMessage[] = custMsgs.map(m => ({
          id: m.id,
          storeId: store.id,
          senderId: m.senderRole === 'merchant' ? 'merchant' : customerId,
          senderName: m.senderName,
          senderRole: m.senderRole === 'merchant' ? 'seller' : (m.senderRole === 'ai_assistant' ? 'ai_assistant' : 'buyer'),
          message: m.message,
          timestamp: m.timestamp,
          read: m.read,
          aiMeta: m.aiMeta
        }));
        setLiveMessages(mapped);
      }
    });

    return () => unsub();
  }, [isOpen, store?.id, currentUser?.id]);

  const messages: StoreChatMessage[] = liveMessages && liveMessages.length > 0
    ? liveMessages
    : (store ? getStoreChatMessages(store.id) : []);

  const handlePayBookingOrder = (
    snapshot: NonNullable<StoreChatMessage['bookingSnapshot']>
  ) => {
    if (!store) return;
    const cleanDishName = snapshot.itemsSummary
      ? snapshot.itemsSummary.replace(/x\d+\s*กล่อง/i, '').replace(/\d+\s*(กล่อง|จาน|แก้ว|ชุด|ที่)/gi, '').trim()
      : '';

    let matchedFood = foodItems.find(
      f => f.storeId === store.id && (
        f.id === snapshot.foodId ||
        (cleanDishName && f.name.toLowerCase().includes(cleanDishName.toLowerCase()))
      )
    );

    if (!matchedFood) {
      matchedFood = {
        id: snapshot.foodId || `booking-food-${Date.now()}`,
        storeId: store.id,
        storeName: store.name,
        name: cleanDishName || 'รายการสั่งจองอาหารล่วงหน้า',
        nameEn: 'Advance Pre-ordered Meal',
        price: Math.round((snapshot.total || 89) / (snapshot.quantity || 1)),
        description: `สั่งจองอาหารล่วงหน้าร้าน ${store.name} เวลานัดรับ ${snapshot.bookingTime || '12:30 น.'}`,
        category: store.category || 'rice',
        image: store.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        rating: 5.0,
        orderCount: 1,
        isAvailable: true,
        preparationMinutes: 15,
        tags: ['สั่งจองล่วงหน้า']
      };
    }

    clearCart();
    addToCart({
      food: matchedFood,
      quantity: snapshot.quantity || 1,
      selectedOptions: [],
      specialNote: `[สั่งจองล่วงหน้า เวลานัดรับ: ${snapshot.bookingTime || '12:30 น.'} (${snapshot.guestCount || 1} ท่าน)] ${snapshot.specialNote || ''}`.trim()
    });

    onClose();
    setIsCartOpen(true);
    addToast(
      'เปิดหน้าต่างชำระเงิน 💳',
      `นำรายการสั่งจองเข้าสู่ขั้นตอนชำระเงินเรียบร้อยแล้ว ยอดชำระ ฿${snapshot.total}`,
      'success'
    );
  };

  // Find active queue for this store if any
  const relatedQueue = queues.find(q => store && q.storeId === store.id && q.status !== 'COMPLETED' && q.status !== 'CANCELLED');

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isOpen]);

  if (!isOpen || !store) return null;

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    // Send as buyer (or seller if role === 'merchant')
    const senderRole = role === 'merchant' ? 'seller' : 'buyer';
    sendStoreChatMessage(store.id, text, orderId || relatedQueue?.id, senderRole);
    setInputMessage('');
  };

  const quickInquiries = [
    'คิวถึงไหนแล้วครับ อาหารใกล้เสร็จหรือยัง?',
    'ขอแยกน้ำจิ้ม/เครื่องปรุงให้ด้วยครับ',
    'แจ้งแพ้อาหารเพิ่มเติม ขอไม่ใส่ถั่วลิสงครับ',
    'จะไปรับอาหารช้าประมาณ 5-10 นาทีครับ'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg h-[620px] max-h-[92vh] flex flex-col rounded-3xl bg-white border border-orange-200/90 shadow-2xl overflow-hidden text-stone-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Chat Header */}
        <div className="p-4 border-b border-orange-100 dark:border-zinc-800 bg-orange-50/70 dark:bg-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <img
                src={store.logo || store.image}
                alt={store.name}
                className="w-10 h-10 rounded-2xl object-cover border border-orange-300 dark:border-zinc-700 shadow-xs"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-stone-900 dark:text-white truncate">
                  {store.name}
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  ออนไลน์
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400 truncate flex items-center gap-1">
                <span>ผู้ดูแลร้าน: {store.contactChannels?.staffOnDutyName || 'พนักงานหน้าร้าน'}</span>
                {relatedQueue && (
                  <span className="font-bold text-orange-600 dark:text-orange-400">
                    • คิว #{relatedQueue.queueNumber}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onClose();
                openChatPage(store.id);
              }}
              className="p-2 rounded-xl text-stone-500 hover:text-orange-600 hover:bg-orange-100/50 dark:text-zinc-400 dark:hover:text-orange-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="เปิดในหน้าแชทหลัก (Chat Page)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => openStoreContactAndTerms(store)}
              className="p-2 rounded-xl text-stone-500 hover:text-orange-600 hover:bg-orange-100/50 dark:text-zinc-400 dark:hover:text-orange-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="ดูเงื่อนไขการแลกเปลี่ยนของร้านนี้"
            >
              <FileText className="w-4 h-4" />
            </button>
            <a
              href={`tel:${(store.contactChannels?.phone || store.ownerPhone || '0823456789').replace(/-/g, '')}`}
              className="p-2 rounded-xl text-stone-500 hover:text-orange-600 hover:bg-orange-100/50 dark:text-zinc-400 dark:hover:text-orange-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="โทรติดต่อร้านค้า"
            >
              <Phone className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="px-4 py-2 bg-amber-50/70 border-b border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">
              ช่องทางติดต่อตรงระหว่างผู้ซื้อกับร้านค้า <strong>{store.name}</strong>
            </span>
          </div>
          <button
            onClick={() => openStoreContactAndTerms(store)}
            className="text-[10px] font-bold text-orange-600 dark:text-orange-400 underline hover:text-orange-700 shrink-0 cursor-pointer"
          >
            ดูเงื่อนไขร้าน
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/50 dark:bg-zinc-950/40">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400 dark:text-zinc-500">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-zinc-800 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-stone-700 dark:text-zinc-300">
                เริ่มบทสนทนากับร้าน {store.name}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400 max-w-xs mt-1">
                สามารถสอบถามสถานะคิว แจ้งการแพ้อาหาร หรือประสานงานการรับอาหารได้โดยตรง
              </p>
            </div>
          ) : (
            messages.map(msg => {
              const isMe =
                (role === 'merchant' && msg.senderRole === 'seller') ||
                (role !== 'merchant' && msg.senderRole === 'buyer');
              const isAi = msg.senderRole === 'ai_assistant';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 px-1">
                    <span className="text-[10px] font-bold text-stone-600 dark:text-zinc-300">
                      {msg.senderName}
                    </span>
                    {isAi && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        🤖 AI Assistant
                      </span>
                    )}
                    <span className="text-[9px] text-stone-400 dark:text-zinc-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs whitespace-pre-line ${
                      isMe
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-tr-none'
                        : isAi
                          ? 'bg-blue-50/90 border border-blue-200/90 text-blue-950 rounded-tl-none dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-100'
                          : 'bg-white border border-orange-100 text-stone-900 rounded-tl-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.message}</p>

                    {/* Interactive Pre-order Booking Payment Card */}
                    {msg.bookingSnapshot && (
                      <div className="mt-2.5 p-3 rounded-xl bg-white/95 dark:bg-zinc-900/95 border border-orange-200 dark:border-zinc-700 shadow-xs text-stone-800 dark:text-zinc-200 space-y-2 text-left not-italic font-normal">
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
                            onClick={() => handlePayBookingOrder(msg.bookingSnapshot!)}
                            className="w-full mt-2 py-2 text-xs font-bold bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 hover:from-orange-600 hover:to-emerald-600 text-white shadow-md rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <span className="text-base">💳</span>
                            <span>ชำระเงิน / ยืนยันการสั่งจอง (฿{msg.bookingSnapshot.total?.toLocaleString()})</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Question Chips */}
        <div className="p-2 border-t border-orange-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {quickInquiries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-orange-200 bg-orange-50/50 hover:bg-orange-100 text-orange-950 whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat Input Field */}
        <div className="p-3 border-t border-orange-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={`ส่งข้อความถึงร้าน ${store.name}...`}
            className="flex-1 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-zinc-900 transition-all"
          />

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim()}
            className="p-2.5 rounded-xl shrink-0 cursor-pointer"
            title="ส่งข้อความ"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
