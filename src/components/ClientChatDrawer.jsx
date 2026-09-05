import { useState, useEffect } from 'react';
import { fetchShopsFromFirestore } from '../lib/firebase';
import { Send, MessageSquare, X, Store, Sparkles } from 'lucide-react';

export const ClientChatDrawer = ({
  isOpen,
  onClose,
  messages = [],
  onSendMessage,
  currentUserType = 'client',
  onOpenChat,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState(null);

  useEffect(() => {
    fetchShopsFromFirestore().then((remoteShops) => {
      if (remoteShops && remoteShops.length > 0) {
        setShops(remoteShops);
        setSelectedShopId(remoteShops[0].id);
      }
    });
  }, []);

  const activeShop = shops.find((s) => s.id === selectedShopId) || shops[0] || null;

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedImage) return;

    onSendMessage(inputText, selectedImage || undefined);
    setInputText('');
    setSelectedImage(null);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={onOpenChat || onClose}
          type="button"
          aria-label="เปิดหน้าต่างแชทสด"
          className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-['Kanit'] font-bold rounded-full shadow-2xl hover:shadow-orange-500/30 flex items-center gap-2 px-4 py-3 transition-all duration-300 hover:scale-105 active:scale-95 border border-white/20 cursor-pointer"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
          </div>
          <span className="text-sm">แชทร้านค้า</span>
          {messages.length > 0 && (
            <span className="bg-white text-red-600 font-extrabold text-xs px-2 py-0.5 rounded-full shadow-sm">
              {messages.length}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[95vw] sm:w-[680px] h-[520px] max-h-[88vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col font-['IBM_Plex_Sans_Thai'] animate-scale-in">
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-stone-900 to-slate-950 text-white flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center shadow-md">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-['Kanit'] font-black text-base text-white">QueueUp Live Chat</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Sparkles className="w-3 h-3" /> ออนไลน์
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  {activeShop ? activeShop.shopName : 'ร้านค้าโรงอาหาร'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Body */}
          <div className="flex-1 flex overflow-hidden">
            {/* Shop Selection Sidebar */}
            <div className="w-48 sm:w-56 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-y-auto p-3 space-y-1.5 shrink-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-amber-500" />
                <span>เลือกร้านค้า</span>
              </div>

              {shops.map((shop) => {
                const isSelected = selectedShopId === shop.id;
                return (
                  <button
                    key={shop.id}
                    onClick={() => setSelectedShopId(shop.id)}
                    type="button"
                    className={`w-full text-left p-2.5 rounded-2xl transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md font-bold'
                        : 'hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate leading-tight">{shop.shopName}</div>
                    <div className={`text-[10px] mt-0.5 truncate ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
                      {shop.building || 'โรงอาหารกลาง'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Chat Feed & Input */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
              {/* Message History */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-950/30 dark:to-slate-900">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="text-xs font-medium">เริ่มต้นพิมพ์ข้อความเพื่อสอบถามร้านค้า</p>
                    <span className="text-[10px] text-slate-400 mt-1">สอบถามระดับความเผ็ด เวลาทำ หรือเปลี่ยนเมนู</span>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe =
                      (currentUserType === 'client' && msg.sender === 'client') ||
                      (currentUserType === 'merchant' && msg.sender === 'merchant');
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-sm ${
                            isMe
                              ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-br-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 rounded-bl-xs'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input Form */}
              <form
                onSubmit={handleSend}
                className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="พิมพ์ข้อความสอบถามร้านค้า..."
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() && !selectedImage}
                  className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
