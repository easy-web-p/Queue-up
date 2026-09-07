import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchParentChildLinks, fetchStudentWallet, updateCampusWalletLimits } from '../services/campusWalletService';
import { Shield, Lock, Unlock, ArrowLeft, Save, Check, Sliders } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ParentChildLink, StudentWallet } from '../types/campus';

export default function SpendingLimitSetting() {
  const { user, currentUser } = useAuth();
  const [children, setChildren] = useState<ParentChildLink[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentChildLink | null>(null);
  const [wallet, setWallet] = useState<StudentWallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [dailyLimitBaht, setDailyLimitBaht] = useState(200);
  const [weeklyLimitBaht, setWeeklyLimitBaht] = useState(1000);
  const [blockedCategories, setBlockedCategories] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const categoryOptions = [
    'Sugary Drinks', 'Fast Food', 'Snacks', 'Spicy Food', 'Dessert & Bakery', 'Energy Drinks'
  ];

  const uid = currentUser?.uid || user?.uid;

  useEffect(() => {
    if (!uid) return;
    async function loadData() {
      setIsLoading(true);
      try {
        const links = await fetchParentChildLinks(uid);
        setChildren(links);
        if (links.length > 0) {
          setSelectedChild(links[0]);
        }
      } catch (err) {
        console.error('[SpendingLimitSetting] Error loading children:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [uid]);

  useEffect(() => {
    if (!selectedChild) return;
    async function loadWallet() {
      try {
        const w = await fetchStudentWallet(selectedChild.studentId);
        setWallet(w);
        if (w) {
          setDailyLimitBaht(w.dailyLimitSatang ? w.dailyLimitSatang / 100 : 200);
          setWeeklyLimitBaht(w.weeklyLimitSatang ? w.weeklyLimitSatang / 100 : 1000);
          setBlockedCategories(w.blockedCategories || []);
          setIsLocked(!!w.isLocked);
        }
      } catch (err) {
        console.error('[SpendingLimitSetting] Error loading wallet:', err);
      }
    }
    loadWallet();
  }, [selectedChild]);

  const handleToggleCategory = (cat: string) => {
    setBlockedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      await updateCampusWalletLimits(selectedChild.studentId, {
        dailyLimitSatang: Math.round(dailyLimitBaht * 100),
        weeklyLimitSatang: Math.round(weeklyLimitBaht * 100),
        blockedCategories,
        isLocked,
      });
      setSaveStatus('บันทึกการตั้งค่าวงเงินและความปลอดภัยเรียบร้อยแล้ว');
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      console.error('[SpendingLimitSetting] Error saving limits:', err);
      setSaveStatus(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#16100C] text-slate-800 dark:text-slate-100 font-['IBM_Plex_Sans_Thai'] pb-20 transition-colors">
        {isLoading && (
          <div className="max-w-4xl mx-auto px-4 pt-4">
            <div className="bg-white/80 dark:bg-[#241C16]/80 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 dark:text-[#9CA3AF] animate-pulse">
              กำลังโหลดข้อมูล...
            </div>
          </div>
        )}
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#241C16]/95 backdrop-blur border-b border-slate-200 dark:border-white/10 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <Link
            to="/guardian/dashboard"
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#16100C] dark:hover:bg-[#FF7A1A]/10 border border-slate-200 dark:border-white/10 rounded-xl text-[#FF7A1A] transition-colors"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#FF7A1A]" />
              ตั้งค่าวงเงิน & บล็อกหมวดอาหาร (Spending Limits)
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              ควบคุมวงเงินการใช้จ่ายรายวันและกำหนดหมวดหมู่อาหารต้องห้าม
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        {/* Child Selector */}
        {children.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`px-4 py-2.5 rounded-2xl font-['Kanit'] text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedChild?.id === child.id
                    ? 'bg-[#FF7A1A] text-white shadow-lg shadow-orange-500/20'
                    : 'bg-white dark:bg-[#241C16] text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10'
                }`}
              >
                {child.studentName} ({child.studentId})
              </button>
            ))}
          </div>
        )}

        {selectedChild ? (
          <form onSubmit={handleSaveLimits} className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
            {/* Child Info Banner */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <span className="text-xs text-[#FF7A1A] font-bold uppercase tracking-wider">นักเรียนที่เลือก</span>
                <h2 className="text-2xl font-bold font-['Kanit'] text-slate-900 dark:text-white mt-1">{selectedChild.studentName}</h2>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">รหัสนักเรียน: {selectedChild.studentId}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 dark:text-[#9CA3AF]">ยอดเงินคงเหลือปัจจุบัน</span>
                <div className="text-2xl font-black font-['JetBrains_Mono'] text-[#FF7A1A]">
                  ฿{wallet ? (wallet.balanceSatang / 100).toFixed(2) : '0.00'}
                </div>
              </div>
            </div>

            {/* Daily & Weekly Limit Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700 dark:text-[#E5E7EB]">
                  วงเงินใช้จ่ายรายวัน (Daily Limit)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-lg font-bold text-[#FF7A1A]">฿</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={dailyLimitBaht}
                    onChange={(e) => setDailyLimitBaht(Number(e.target.value))}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-white/20 rounded-2xl text-slate-900 dark:text-white font-['JetBrains_Mono'] text-lg font-bold focus:outline-none focus:border-[#FF7A1A]"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[100, 150, 200, 300].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDailyLimitBaht(amt)}
                      className="px-3 py-1 bg-slate-100 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 hover:border-[#FF7A1A]/40 rounded-xl text-xs text-slate-600 dark:text-[#9CA3AF] hover:text-[#FF7A1A] font-['JetBrains_Mono'] transition-colors cursor-pointer"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700 dark:text-[#E5E7EB]">
                  วงเงินใช้จ่ายรายสัปดาห์ (Weekly Limit)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-lg font-bold text-amber-500">฿</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={weeklyLimitBaht}
                    onChange={(e) => setWeeklyLimitBaht(Number(e.target.value))}
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-white/20 rounded-2xl text-slate-900 dark:text-white font-['JetBrains_Mono'] text-lg font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[500, 1000, 1500, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setWeeklyLimitBaht(amt)}
                      className="px-3 py-1 bg-slate-100 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 hover:border-amber-400/40 rounded-xl text-xs text-slate-600 dark:text-[#9CA3AF] hover:text-amber-500 font-['JetBrains_Mono'] transition-colors cursor-pointer"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Blocked Food Categories */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-500" />
                    บล็อกหมวดหมู่อาหารต้องห้าม (Restricted Categories)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                    หากนักเรียนสั่งอาหารในหมวดเหล่านี้ ระบบจะปฏิเสธการชำระเงินอัตโนมัติ (Fail-Closed)
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400 text-xs font-bold rounded-full font-['JetBrains_Mono'] border border-red-200 dark:border-red-500/30">
                  บล็อกอยู่ {blockedCategories.length} หมวด
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {categoryOptions.map((cat) => {
                  const isBlocked = blockedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleToggleCategory(cat)}
                      className={`p-3.5 rounded-2xl border text-sm font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        isBlocked
                          ? 'bg-red-50 dark:bg-red-500/15 border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300'
                          : 'bg-slate-50 dark:bg-[#16100C] border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#9CA3AF] hover:border-slate-300 dark:hover:border-white/30'
                      }`}
                    >
                      <span>{cat}</span>
                      {isBlocked && <span className="text-xs text-red-500 font-bold">🚫</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Emergency Freeze Switch */}
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${isLocked ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-[#16100C] text-slate-700 dark:text-[#9CA3AF]'}`}>
                  {isLocked ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">ระงับการใช้งานกระเป๋าเงินฉุกเฉิน (Emergency Freeze)</h4>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">เมื่อเปิดใช้งาน นักเรียนจะไม่สามารถใช้กระเป๋าเงินซื้ออาหารได้ทุกกรณี</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocked(!isLocked)}
                className={`px-5 py-2.5 rounded-xl font-bold font-['Kanit'] text-xs transition-all cursor-pointer ${
                  isLocked ? 'bg-red-500 text-white shadow-lg' : 'bg-white dark:bg-[#16100C] text-slate-700 dark:text-[#9CA3AF] border border-slate-300 dark:border-white/10 hover:border-slate-400'
                }`}
              >
                {isLocked ? 'ปลดล็อกกระเป๋า' : 'ล็อกกระเป๋าเงิน'}
              </button>
            </div>

            {/* Save Status & Action */}
            {saveStatus && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {saveStatus}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-[#FF7A1A] hover:bg-[#E6680D] disabled:opacity-50 text-white font-bold font-['Kanit'] rounded-2xl shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'กำลังบันทึกการตั้งค่า...' : 'บันทึกการตั้งค่าวงเงินและความปลอดภัย'}
            </button>
          </form>
        ) : (
          <div className="p-12 text-center bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-3xl text-sm text-slate-600 dark:text-[#9CA3AF]">
            ไม่พบข้อมูลบุตรหลานที่ผูกบัญชีไว้ กรุณาผูกบัญชีในหน้าศูนย์ควบคุมก่อน
          </div>
        )}
      </main>
    </div>
  );
}
