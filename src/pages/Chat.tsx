import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, ArrowLeft, Store, Image as ImageIcon, CheckCheck, ShieldCheck } from 'lucide-react';
import { ChatMessage, MerchantShop, CustomerProfile } from '../types';
import { fetchShopsFromFirestore } from '../lib/firebase';

interface ChatPageProps {
  currentUser?: CustomerProfile | null;
  activeShop?: MerchantShop | null;
  onBack?: () => void;
}

export const Chat: React.FC<ChatPageProps> = ({
  currentUser,
  activeShop: propShop,
  onBack
}) => {
  const [shops, setShops] = useState<MerchantShop[]>([]);
  const [selectedShop, setSelectedShop] = useState<MerchantShop | null>(propShop || null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'merchant',
      text: 'สวัสดีครับยินดีต้อนรับสู่ร้านค้าในโรงอาหาร มีข้อสงสัยเกี่ยวกับเมนูอาหารหรือคิวสอบถามได้เลยครับ!',
      timestamp: '10:00 น.'
    }
  ]);
  const [inputMsg, setInputMsg] = useState('');

  useEffect(() => {
    fetchShopsFromFirestore().then((remoteShops) => {
      if (remoteShops && remoteShops.length > 0) {
        setShops(remoteShops);
        if (!selectedShop) setSelectedShop(remoteShops[0]);
      }
    });
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'client',
      text: inputMsg.trim(),
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMsg('');

    // Simulated merchant auto reply
    setTimeout(() => {
      const autoReply: ChatMessage = {
        id: `msg-reply-${Date.now()}`,
        sender: 'merchant',
        text: 'รับทราบครับ ทางร้านได้รับข้อความแล้ว จะรีบจัดเตรียมอาหารให้อย่างรวดเร็วครับ!',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
      };
      setMessages((prev) => [...prev, autoReply]);
    }, 1200);
  };

  const targetShop = selectedShop || propShop;

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-6 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-amber-100 overflow-hidden flex flex-col h-[80vh]">
        
        {/* Chat Top Header */}
        <div className="bg-gradient-to-r from-[#8B0000] via-[#A50000] to-[#800000] text-white p-4 sm:p-6 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all cursor-pointer text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
              {targetShop?.logoUrl ? (
                <img src={targetShop.logoUrl} alt={targetShop.shopName} className="w-full h-full object-cover" />
              ) : (
                <Store className="w-6 h-6 text-amber-300" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">{targetShop?.shopName || 'แชทติดต่อร้านค้า'}</h1>
              <p className="text-xs text-amber-200 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {targetShop?.building || 'โรงอาหารกลาง'} • ตอบกลับภายใน 2 นาที
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-xs font-bold text-amber-200">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            แชทปลอดภัยในระบบ QueueUp
          </div>
        </div>

        {/* Shop Switcher Bar */}
        {shops.length > 1 && (
          <div className="bg-slate-50 border-b border-slate-200 p-3 flex gap-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-bold text-slate-500 flex items-center shrink-0 px-2">เลือกร้านค้า:</span>
            {shops.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedShop(s)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  targetShop?.id === s.id
                    ? 'bg-[#8B0000] text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-50'
                }`}
              >
                {s.shopName}
              </button>
            ))}
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((m) => {
            const isMe = m.sender === 'client';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] sm:max-w-[70%] p-4 rounded-2xl shadow-sm text-sm font-medium leading-relaxed ${
                    isMe
                      ? 'bg-[#8B0000] text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-xs'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1 px-1">
                  {m.timestamp}
                  {isMe && <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />}
                </span>
              </div>
            );
          })}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-200 flex items-center gap-3">
          <button
            type="button"
            className="p-2.5 text-slate-400 hover:text-amber-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            title="แนบรูปภาพ"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="พิมพ์ข้อความสอบถามร้านค้า..."
            className="flex-1 px-4 py-2.5 bg-slate-100 rounded-2xl text-sm font-medium border border-transparent focus:border-[#8B0000] focus:bg-white focus:outline-none transition-all"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-gradient-to-r from-[#8B0000] to-[#A50000] hover:from-[#700000] hover:to-[#8B0000] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>ส่ง</span>
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
