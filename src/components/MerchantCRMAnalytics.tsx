import React, { useState } from 'react';
import { CustomerProfile } from '../../types';
import { Users, Send, TrendingUp, Award, Phone, CheckCircle2 } from 'lucide-react';

interface Props {
  customers: CustomerProfile[];
  onSendBroadcast: (announcementText: string) => void;
}

export const MerchantCRMAnalytics: React.FC<Props> = ({ customers, onSendBroadcast }) => {
  const [broadcastText, setBroadcastText] = useState('');
  const [sentNotice, setSentNotice] = useState(false);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    onSendBroadcast(broadcastText);
    setBroadcastText('');
    setSentNotice(true);
    setTimeout(() => setSentNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top CRM Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white p-5 rounded-3xl shadow-lg space-y-1">
          <div className="flex items-center justify-between opacity-80 text-xs font-semibold">
            <span>จำนวนลูกค้าประจำทั้งหมด</span>
            <Users className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black">{customers.length} คน</div>
          <p className="text-[11px] text-orange-100">มีประวัติสั่งซื้อซ้ำในระบบ CRM</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-500 text-white p-5 rounded-3xl shadow-lg space-y-1">
          <div className="flex items-center justify-between opacity-80 text-xs font-semibold">
            <span>อัตราการกลับมาซื้อซ้ำ (Repeat Rate)</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black">78.5%</div>
          <p className="text-[11px] text-emerald-100">+12% สูงกว่าเกณฑ์เฉลี่ยโรงอาหาร</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-blue-500 text-white p-5 rounded-3xl shadow-lg space-y-1">
          <div className="flex items-center justify-between opacity-80 text-xs font-semibold">
            <span>คะแนนสะสม CRM ที่แจกแล้ว</span>
            <Award className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black">
            {customers.reduce((acc, c) => acc + c.points, 0)} แต้ม
          </div>
          <p className="text-[11px] text-blue-100">สะสมอัตโนมัติผ่านเบอร์โทรศัพท์</p>
        </div>
      </div>

      {/* Free Broadcast Notification Sender Zone */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Send className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">ระบบกระจายข่าวสารให้ลูกค้าฟรี (Free Web Broadcast)</h3>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-bold border border-emerald-500/30">
            ประหยัดค่า LINE Broadcast 0 บาท
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          ส่งข้อความแจ้งเตือนเมนูพิเศษวันนี้ โปรโมชันส่วนลด หรือแจ้งเตือนสต็อกอาหารไปยังหน้าเว็บลูกค้าทุกคนได้ทันที
        </p>

        <form onSubmit={handleBroadcast} className="flex gap-2">
          <input
            type="text"
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            placeholder="พิมพ์ข้อความข่าวสาร เช่น 'พิเศษวันนี้! สั่งผัดไทยกุ้งสดรับฟรีชานมเย็น เมื่อทานครบ 80 บาท'"
            className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shrink-0 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            <span>กระจายข่าวสาร</span>
          </button>
        </form>

        {sentNotice && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>กระจายข้อความไปยังหน้าเว็บฝั่งลูกค้าเรียบร้อยแล้ว!</span>
          </div>
        )}
      </div>

      {/* Customer Database List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-500" />
          <span>ฐานข้อมูลลูกค้าประจำ (Customer Database CRM)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[11px]">
              <tr>
                <th className="p-3">ชื่อลูกค้า</th>
                <th className="p-3">เบอร์โทรศัพท์</th>
                <th className="p-3">แต้มสะสม</th>
                <th className="p-3">จำนวนออเดอร์</th>
                <th className="p-3">เมนูโปรด</th>
                <th className="p-3">สั่งล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-800">{c.name}</td>
                  <td className="p-3 text-slate-600 font-medium flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" /> {c.phone}
                  </td>
                  <td className="p-3">
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold">
                      {c.points} แต้ม
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-slate-700">{c.ordersCount} ครั้ง</td>
                  <td className="p-3 text-orange-600 font-medium">{c.favoriteDish}</td>
                  <td className="p-3 text-slate-500">{c.lastOrderDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
