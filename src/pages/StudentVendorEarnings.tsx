import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { TrendingUp, Users, ShieldCheck, ArrowLeft, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TeamMember {
  name: string;
  role: string;
  sharePercent: number;
}

export default function StudentVendorEarnings() {
  const { user, currentUser } = useAuth();
  const uid = currentUser?.uid || user?.uid;

  const [orders, setOrders] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { name: user?.displayName || 'หัวหน้าร้าน (ตัวคุณ)', role: 'จัดเตรียม & ปรุงอาหาร', sharePercent: 60 },
    { name: 'เพื่อนร่วมทีม 1', role: 'จัดคิว & บัญชี', sharePercent: 40 }
  ]);

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [newMemberPercent, setNewMemberPercent] = useState(20);
  const [costRatioPercent, setCostRatioPercent] = useState(40); // 40% estimated ingredient cost

  useEffect(() => {
    if (!uid) return;
    const storeId = `shop_${uid}`;

    const q = query(
      collection(db, 'orders'),
      where('storeId', 'in', [storeId, uid])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = snapshot.docs.map((d) => d.data());
      setOrders(ords);
    }, (err) => {
      console.warn('[StudentVendorEarnings] Error loading orders:', err);
    });

    return () => unsubscribe();
  }, [uid]);

  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  const totalGrossSatang = completedOrders.reduce((sum, o) => sum + (Number(o.totalAmountSatang) || Math.round((Number(o.totalAmount) || 0) * 100)), 0);
  const totalGrossBaht = totalGrossSatang / 100;

  const totalCostBaht = (totalGrossBaht * costRatioPercent) / 100;
  const netProfitBaht = Math.max(0, totalGrossBaht - totalCostBaht);

  // Trust Score calculation (Base 80 + orders completed + rating points)
  const trustScore = Math.min(100, Math.round(80 + (completedOrders.length * 1.5)));

  const handleAddTeamMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setTeamMembers([...teamMembers, { name: newMemberName.trim(), role: newMemberRole || 'ทีมงาน', sharePercent: newMemberPercent }]);
    setNewMemberName('');
    setNewMemberRole('');
  };

  const handleRemoveTeamMember = (idx: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== idx));
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#16100C] text-slate-800 dark:text-slate-100 font-['IBM_Plex_Sans_Thai'] pb-20 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#241C16]/95 backdrop-blur border-b border-slate-200 dark:border-[#FF7A1A]/20 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <Link
            to="/merchant/dashboard"
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#16100C] dark:hover:bg-[#FF7A1A]/10 border border-slate-200 dark:border-[#FF7A1A]/30 rounded-xl text-[#FF7A1A] transition-colors"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#FF7A1A]" />
              แดชบอร์ดรายได้ & การแบ่งปันผลกำไร (Student Vendor Earnings)
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              ระบบคำนวณกำไร-ต้นทุน และจัดสรรรายได้อัตโนมัติสำหรับธุรกิจนักเรียน
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-6">
        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/30 rounded-3xl p-5 shadow-md">
            <span className="text-xs text-slate-500 dark:text-[#9CA3AF] font-bold">ยอดขายรวม (Gross Revenue)</span>
            <div className="text-3xl font-black font-['JetBrains_Mono'] text-slate-900 dark:text-white mt-2">
              {totalGrossBaht.toFixed(2)} <span className="text-sm font-normal text-[#FF7A1A]">฿</span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-[#9CA3AF] mt-1">{completedOrders.length} ออเดอร์ที่เสร็จสมบูรณ์</p>
          </div>

          <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/30 rounded-3xl p-5 shadow-md">
            <span className="text-xs text-slate-500 dark:text-[#9CA3AF] font-bold">ประมาณการต้นทุนวัตถุดิบ</span>
            <div className="text-3xl font-black font-['JetBrains_Mono'] text-amber-600 dark:text-amber-400 mt-2">
              {totalCostBaht.toFixed(2)} <span className="text-sm font-normal text-slate-400 dark:text-[#9CA3AF]">฿</span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-[#9CA3AF] mt-1">อิงจากสัดส่วนต้นทุน {costRatioPercent}%</p>
          </div>

          <div className="bg-white dark:bg-[#241C16] border border-emerald-300 dark:border-emerald-500/30 rounded-3xl p-5 shadow-md bg-gradient-to-br from-emerald-50/50 dark:from-[#241C16] to-emerald-100/50 dark:to-[#122419]">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">กำไรสุทธิพร้อมจัดสรร (Net Profit)</span>
            <div className="text-3xl font-black font-['JetBrains_Mono'] text-emerald-600 dark:text-emerald-300 mt-2">
              {netProfitBaht.toFixed(2)} <span className="text-sm font-normal text-emerald-600 dark:text-emerald-400">฿</span>
            </div>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">กำไรจริงหลังหักต้นทุน</p>
          </div>

          <div className="bg-white dark:bg-[#241C16] border border-purple-300 dark:border-purple-500/30 rounded-3xl p-5 shadow-md bg-gradient-to-br from-purple-50/50 dark:from-[#241C16] to-purple-100/50 dark:to-[#20142A]">
            <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">คะแนนความน่าเชื่อถือ (Trust Score)</span>
            <div className="text-3xl font-black font-['JetBrains_Mono'] text-purple-700 dark:text-purple-300 mt-2 flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              {trustScore} <span className="text-sm font-normal text-purple-600 dark:text-purple-400">/ 100</span>
            </div>
            <p className="text-[11px] text-purple-600/80 dark:text-purple-300/80 mt-1">เกรด A+ คุณภาพอาหารยอดเยี่ยม</p>
          </div>
        </div>

        {/* Team Revenue Share & Cost Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Revenue Split */}
          <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/20 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="text-lg font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FF7A1A]" />
                ระบบจัดสรรรายได้สมาชิกทีม (Team Revenue Share)
              </h3>
            </div>

            <div className="space-y-3">
              {teamMembers.map((member, idx) => {
                const memberProfitShare = (netProfitBaht * member.sharePercent) / 100;
                return (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{member.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">{member.role} • สัดส่วน {member.sharePercent}%</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveTeamMember(idx)}
                        className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                      >
                        นำออกจากทีม
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black font-['JetBrains_Mono'] text-emerald-600 dark:text-emerald-400">
                        +{memberProfitShare.toFixed(2)} ฿
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-[#9CA3AF]">ส่วนแบ่งกำไรสุทธิ</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Team Member */}
            <form onSubmit={handleAddTeamMember} className="pt-2 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="ชื่อเพื่อนร่วมทีม"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/20 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#FF7A1A]"
              />
              <input
                type="text"
                placeholder="บทบาทหน้าที่"
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className="w-32 px-3 py-2 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/20 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#FF7A1A]"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newMemberPercent}
                  onChange={(e) => setNewMemberPercent(Number(e.target.value))}
                  className="w-16 px-2 py-2 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/20 rounded-xl text-xs text-slate-900 dark:text-white font-['JetBrains_Mono'] focus:outline-none focus:border-[#FF7A1A]"
                />
                <span className="text-xs text-slate-500 dark:text-[#9CA3AF]">%</span>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#FF7A1A] hover:bg-[#E6680D] text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer"
              >
                เพิ่ม
              </button>
            </form>
          </div>

          {/* Cost Ratio & Financial Calculator */}
          <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/20 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="text-lg font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#FF7A1A]" />
                ปรับแต่งสัดส่วนต้นทุนวัตถุดิบ (Cost Percentage)
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">
                สัดส่วนต้นทุนวัตถุดิบต่อยอดขาย ({costRatioPercent}%)
              </label>
              <input
                type="range"
                min="10"
                max="80"
                value={costRatioPercent}
                onChange={(e) => setCostRatioPercent(Number(e.target.value))}
                className="w-full accent-[#FF7A1A] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-[#9CA3AF] mt-1">
                <span>10% (กำไรสูงสุด)</span>
                <span>40% (มาตรฐานร้านอาหาร)</span>
                <span>80% (ต้นทุนสูง)</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#9CA3AF]">รายรับรวม (Gross):</span>
                <span className="font-['JetBrains_Mono'] font-bold text-slate-900 dark:text-white">{totalGrossBaht.toFixed(2)} ฿</span>
              </div>
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>หัก ต้นทุนวัตถุดิบ ({costRatioPercent}%):</span>
                <span className="font-['JetBrains_Mono'] font-bold">-{totalCostBaht.toFixed(2)} ฿</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-white/10 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                <span>กำไรสุทธิคงเหลือ (Net Profit):</span>
                <span className="font-['JetBrains_Mono'] font-black">{netProfitBaht.toFixed(2)} ฿</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-300">
              💡 <strong>คำแนะนำทางการศึกษา:</strong> ควรบันทึกค่าใช้จ่ายวัตถุดิบจริงทุกวันเพื่อฝึกทักษะการทำบัญชีธุรกิจเบื้องต้น
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
