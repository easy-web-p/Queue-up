import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchParentChildLinks,
  fetchStudentWallet,
  fetchWalletTransactions,
  updateCampusWalletLimits,
  topupCampusWallet,
  createParentChildLink,
} from '../services/campusWalletService';
import {
  Wallet,
  Shield,
  CreditCard,
  Lock,
  Unlock,
  History,
  AlertTriangle,
  Plus,
  ArrowLeft,
  DollarSign,
  TrendingDown,
  User,
  HeartPulse,
  Save,
  Check,
} from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { Link } from 'react-router-dom';
import type { ParentChildLink, StudentWallet, WalletTransaction, StudentProfile } from '../types/campus';

export default function GuardianDashboard() {
  const { user, currentUser } = useAuth();
  const [children, setChildren] = useState<ParentChildLink[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentChildLink | null>(null);
  const [wallet, setWallet] = useState<StudentWallet | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Limit Settings state
  const [dailyLimitBaht, setDailyLimitBaht] = useState(200);
  const [weeklyLimitBaht, setWeeklyLimitBaht] = useState(1000);
  const [blockedCategories, setBlockedCategories] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Allergy & Health Notes State
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [healthNotes, setHealthNotes] = useState('');
  const [isSavingHealth, setIsSavingHealth] = useState(false);
  const [healthSaveMessage, setHealthSaveMessage] = useState<string | null>(null);

  // Top-up Modal State
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [topupAmountBaht, setTopupAmountBaht] = useState(100);
  const [isTopupProcessing, setIsTopupProcessing] = useState(false);

  // Link Child Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [relationship, setRelationship] = useState<'FATHER' | 'MOTHER' | 'GUARDIAN'>('GUARDIAN');

  const categoryOptions = [
    'Sugary Drinks', 'Fast Food', 'Snacks', 'Spicy Food', 'Dessert & Bakery', 'Energy Drinks'
  ];

  const commonAllergenPresets = [
    'ถั่วลิสง (Peanuts)',
    'อาหารทะเล / กุ้ง (Seafood)',
    'นมวัว / แลคโตส (Dairy)',
    'แป้งสาลี / กลูเตน (Gluten)',
    'ไข่ไก่ (Eggs)',
    'ถั่วเหลือง (Soy)'
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
        console.error('[GuardianDashboard] Error loading parent child links:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [uid]);

  useEffect(() => {
    if (!selectedChild) {
      setWallet(null);
      setTransactions([]);
      setStudentProfile(null);
      return;
    }

    async function loadChildWalletAndProfile() {
      try {
        const w = await fetchStudentWallet(selectedChild.studentId);
        setWallet(w);
        if (w) {
          setDailyLimitBaht((w.dailyLimitSatang || 20000) / 100);
          setWeeklyLimitBaht((w.weeklyLimitSatang || 100000) / 100);
          setBlockedCategories(w.blockedCategories || []);
          setIsLocked(w.isLocked || false);
        }
        const txs = await fetchWalletTransactions(selectedChild.studentId);
        setTransactions(txs);

        // Load student medical profile
        const stuSnap = await getDoc(doc(db, 'students', selectedChild.studentId));
        if (stuSnap.exists()) {
          const sData = stuSnap.data() as StudentProfile;
          setStudentProfile(sData);
          setAllergies(sData.allergyInfo || []);
          setHealthNotes(sData.healthNotes || '');
        } else {
          setAllergies([]);
          setHealthNotes('');
        }
      } catch (err) {
        console.error('[GuardianDashboard] Error loading student data:', err);
      }
    }
    loadChildWalletAndProfile();
  }, [selectedChild]);

  const handleSaveLimits = async () => {
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
      setSaveStatus('บันทึกการตั้งค่าวงเงินและหมวดหมู่ที่จำกัดสำเร็จ');
      const w = await fetchStudentWallet(selectedChild.studentId);
      setWallet(w);
    } catch (err: any) {
      setSaveStatus('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'Unknown'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveHealthProfile = async () => {
    if (!selectedChild) return;
    setIsSavingHealth(true);
    setHealthSaveMessage(null);
    try {
      const studentRef = doc(db, 'students', selectedChild.studentId);
      await setDoc(
        studentRef,
        {
          studentId: selectedChild.studentId,
          name: selectedChild.studentName,
          guardianIds: [uid],
          allergyInfo: allergies,
          healthNotes: healthNotes.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setHealthSaveMessage('บันทึกข้อมูลภูมิแพ้และสุขภาพสำเร็จ พร้อมเชื่อมโยงกับระบบแจ้งเตือนและระบบฉุกเฉิน');
    } catch (err: any) {
      setHealthSaveMessage('เกิดข้อผิดพลาด: ' + (err.message || 'Unknown'));
    } finally {
      setIsSavingHealth(false);
    }
  };

  const handleToggleAllergyPreset = (preset: string) => {
    if (allergies.includes(preset)) {
      setAllergies(allergies.filter((a) => a !== preset));
    } else {
      setAllergies([...allergies, preset]);
    }
  };

  const handleAddCustomAllergy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllergyInput.trim()) return;
    if (!allergies.includes(newAllergyInput.trim())) {
      setAllergies([...allergies, newAllergyInput.trim()]);
    }
    setNewAllergyInput('');
  };

  const handleTopup = async () => {
    if (!selectedChild || topupAmountBaht <= 0) return;
    setIsTopupProcessing(true);
    try {
      await topupCampusWallet(selectedChild.studentId, Math.round(topupAmountBaht * 100));
      setIsTopupOpen(false);
      const w = await fetchStudentWallet(selectedChild.studentId);
      setWallet(w);
      const txs = await fetchWalletTransactions(selectedChild.studentId);
      setTransactions(txs);
    } catch (err: any) {
      alert('เติมเงินไม่สำเร็จ: ' + (err.message || 'Unknown'));
    } finally {
      setIsTopupProcessing(false);
    }
  };

  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !newStudentId.trim() || !newStudentName.trim()) return;
    try {
      await createParentChildLink(
        uid,
        user?.displayName || 'ผู้ปกครอง',
        newStudentId.trim(),
        newStudentName.trim(),
        relationship
      );
      setIsLinkModalOpen(false);
      setNewStudentId('');
      setNewStudentName('');
      const links = await fetchParentChildLinks(uid);
      setChildren(links);
      if (links.length === 1) setSelectedChild(links[0]);
    } catch (err: any) {
      alert('ผูกบัญชีไม่สำเร็จ: ' + (err.message || 'Unknown'));
    }
  };

  const toggleBlockedCategory = (cat: string) => {
    if (blockedCategories.includes(cat)) {
      setBlockedCategories(blockedCategories.filter((c) => c !== cat));
    } else {
      setBlockedCategories([...blockedCategories, cat]);
    }
  };

  return (
    <div className="min-h-screen bg-[#16100C] text-white font-['IBM_Plex_Sans_Thai'] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#241C16]/95 backdrop-blur border-b border-[#FF7A1A]/20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/home" className="p-2 bg-[#16100C] border border-[#FF7A1A]/30 rounded-xl text-[#FF7A1A] hover:bg-[#FF7A1A]/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-['Kanit'] text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#FF7A1A]" />
              แดชบอร์ดผู้ปกครอง (Guardian Oversight & Campus Wallet)
            </h1>
            <p className="text-xs text-[#9CA3AF]">ติดตามการใช้จ่าย กำหนดวงเงินรายวัน บล็อกอาหารไม่พึงประสงค์ และบันทึกข้อมูลแพ้อาหาร</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {/* Child Selector / Multi-child switcher */}
        <div className="flex items-center justify-between bg-[#241C16] border border-[#FF7A1A]/20 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-[#FF7A1A] mr-2">บุตรหลานในความดูแล:</span>
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedChild(c)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  selectedChild?.id === c.id
                    ? 'bg-[#FF7A1A] text-white shadow-lg shadow-orange-950/40'
                    : 'bg-[#16100C] text-[#E5E7EB] hover:border-[#FF7A1A]/30 border border-white/10'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                {c.studentName} ({c.studentId})
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="px-3 py-2 bg-[#FF7A1A]/20 hover:bg-[#FF7A1A]/30 text-[#FF7A1A] border border-[#FF7A1A]/30 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> เพิ่มบุตรหลาน
          </button>
        </div>

        {selectedChild ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1 & 2: Wallet Overview & Controls */}
            <div className="lg:col-span-2 space-y-6">
              {/* Wallet Card */}
              <div className="bg-gradient-to-br from-[#2D1B10] via-[#241C16] to-[#1A120D] border border-[#FF7A1A]/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Wallet className="w-48 h-48 text-[#FF7A1A]" />
                </div>

                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase text-[#FF7A1A] tracking-wider font-['JetBrains_Mono']">
                      Campus Digital Wallet
                    </span>
                    <h2 className="text-2xl font-bold font-['Kanit'] text-white mt-1">
                      {selectedChild.studentName}
                    </h2>
                    <p className="text-xs text-[#9CA3AF] font-['JetBrains_Mono']">
                      Student ID: {selectedChild.studentId}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsLocked(!isLocked)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                      isLocked
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    }`}
                  >
                    {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    {isLocked ? 'กระเป๋าเงินถูกล็อค' : 'กระเป๋าเงินพร้อมใช้งาน'}
                  </button>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#16100C]/70 backdrop-blur p-4 rounded-2xl border border-white/10">
                    <span className="text-xs text-[#9CA3AF]">ยอดเงินคงเหลือ</span>
                    <p className="text-2xl font-bold font-['JetBrains_Mono'] text-white mt-1">
                      {((wallet?.balanceSatang || 0) / 100).toFixed(2)} <span className="text-sm font-normal text-[#FF7A1A]">฿</span>
                    </p>
                  </div>
                  <div className="bg-[#16100C]/70 backdrop-blur p-4 rounded-2xl border border-white/10">
                    <span className="text-xs text-[#9CA3AF]">ใช้ไปแล้ววันนี้</span>
                    <p className="text-xl font-bold font-['JetBrains_Mono'] text-amber-400 mt-1">
                      {((wallet?.spentTodaySatang || 0) / 100).toFixed(2)} <span className="text-sm font-normal text-[#9CA3AF]">฿</span>
                    </p>
                  </div>
                  <div className="bg-[#16100C]/70 backdrop-blur p-4 rounded-2xl border border-white/10">
                    <span className="text-xs text-[#9CA3AF]">วงเงินสูงสุดต่อวัน</span>
                    <p className="text-xl font-bold font-['JetBrains_Mono'] text-[#E5E7EB] mt-1">
                      {dailyLimitBaht} <span className="text-sm font-normal text-[#9CA3AF]">฿</span>
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setIsTopupOpen(true)}
                    className="px-5 py-3 bg-[#FF7A1A] hover:bg-[#E6680D] text-white font-bold font-['Kanit'] text-sm rounded-xl shadow-lg shadow-orange-950/40 flex items-center gap-2 transition-all"
                  >
                    <CreditCard className="w-4 h-4" /> เติมเงินให้บุตรหลาน
                  </button>
                </div>
              </div>

              {/* Spending Rules & Restrictions Form */}
              <div className="bg-[#241C16] border border-[#FF7A1A]/20 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h3 className="text-lg font-bold font-['Kanit'] text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#FF7A1A]" />
                    กำหนดวงเงินและควบคุมพฤติกรรมการบริโภค
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">ระบบจะปฏิเสธการสั่งซื้อโดยอัตโนมัติหากเกินวงเงินหรืออยู่ในหมวดที่บล็อก</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#E5E7EB] mb-2">
                      วงเงินการใช้จ่ายรายวัน (บาท/วัน)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={dailyLimitBaht}
                      onChange={(e) => setDailyLimitBaht(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-[#16100C] border border-[#FF7A1A]/30 rounded-xl text-white font-['JetBrains_Mono'] focus:outline-none focus:border-[#FF7A1A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#E5E7EB] mb-2">
                      วงเงินการใช้จ่ายรายสัปดาห์ (บาท/สัปดาห์)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={weeklyLimitBaht}
                      onChange={(e) => setWeeklyLimitBaht(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-[#16100C] border border-[#FF7A1A]/30 rounded-xl text-white font-['JetBrains_Mono'] focus:outline-none focus:border-[#FF7A1A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#E5E7EB] mb-2">
                    บล็อกหมวดหมู่อาหารที่ไม่พึงประสงค์ (Blocked Food Categories)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categoryOptions.map((cat) => {
                      const isBlocked = blockedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleBlockedCategory(cat)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            isBlocked
                              ? 'bg-red-950/60 border-red-500/50 text-red-300'
                              : 'bg-[#16100C] border-white/20 text-[#9CA3AF] hover:border-[#FF7A1A]/40'
                          }`}
                        >
                          {isBlocked ? '🚫 ' : '+ '} {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {saveStatus && (
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-[#E5E7EB]">
                    {saveStatus}
                  </div>
                )}

                <button
                  onClick={handleSaveLimits}
                  disabled={isSaving}
                  className="w-full py-3 bg-[#FF7A1A] hover:bg-[#E6680D] disabled:opacity-50 text-white font-bold font-['Kanit'] rounded-xl shadow-lg transition-all"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าการควบคุม'}
                </button>
              </div>

              {/* Allergy & Medical Notes Card */}
              <div className="bg-[#241C16] border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h3 className="text-lg font-bold font-['Kanit'] text-white flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-red-500" />
                    ประวัติการแพ้อาหารและข้อมูลสุขภาพ (Allergy & Health Notes)
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    ข้อมูลนี้จะแจ้งเตือนเมื่อนักเรียนเลือกเมนูอาหาร และเข้าถึงได้โดยพยาบาลโรงเรียนในกรณีฉุกเฉิน
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#E5E7EB] mb-2">
                    เลือกสารก่อภูมิแพ้ที่พบบ่อย (Common Allergens)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {commonAllergenPresets.map((preset) => {
                      const isSelected = allergies.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleToggleAllergyPreset(preset)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-red-600 text-white border-red-500 shadow-md'
                              : 'bg-[#16100C] text-[#9CA3AF] border-white/20 hover:border-red-400'
                          }`}
                        >
                          {isSelected ? '⚠️ ' : '+ '} {preset}
                        </button>
                      );
                    })}
                  </div>

                  <form onSubmit={handleAddCustomAllergy} className="flex gap-2">
                    <input
                      type="text"
                      value={newAllergyInput}
                      onChange={(e) => setNewAllergyInput(e.target.value)}
                      placeholder="เพิ่มสารก่อภูมิแพ้อื่นๆ (เช่น ผงชูรส, สีผสมอาหาร)"
                      className="flex-1 px-4 py-2.5 bg-[#16100C] border border-red-500/30 rounded-xl text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-red-600/80 hover:bg-red-600 text-white text-xs font-bold rounded-xl"
                    >
                      เพิ่ม
                    </button>
                  </form>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#E5E7EB] mb-2">
                    ข้อควรระวังสุขภาพ / โรคประจำตัว
                  </label>
                  <textarea
                    rows={3}
                    value={healthNotes}
                    onChange={(e) => setHealthNotes(e.target.value)}
                    placeholder="เช่น แพ้อาหารรุนแรงต้องพกยา EpiPen, ภาวะ G6PD ห้ามทานถั่วปากอ้า, โรคหอบหืด..."
                    className="w-full px-4 py-3 bg-[#16100C] border border-white/20 rounded-xl text-white text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                {healthSaveMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300">
                    {healthSaveMessage}
                  </div>
                )}

                <button
                  onClick={handleSaveHealthProfile}
                  disabled={isSavingHealth}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold font-['Kanit'] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSavingHealth ? 'กำลังบันทึก...' : 'บันทึกข้อมูลการแพ้อาหาร'}
                </button>
              </div>
            </div>

            {/* Column 3: Transaction Feed */}
            <div className="bg-[#241C16] border border-[#FF7A1A]/20 rounded-3xl p-6 shadow-xl flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <h3 className="text-base font-bold font-['Kanit'] text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-[#FF7A1A]" />
                  ประวัติการใช้จ่ายล่าสุด
                </h3>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-[#9CA3AF] text-xs">
                    ยังไม่มีรายการใช้จ่าย
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 bg-[#16100C] border border-white/5 rounded-2xl flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {tx.storeName || tx.note || 'รายการใช้จ่าย'}
                        </p>
                        <span className="text-[10px] text-[#9CA3AF] font-['JetBrains_Mono']">
                          {tx.type}
                        </span>
                      </div>
                      <span className={`text-xs font-bold font-['JetBrains_Mono'] ${
                        tx.type === 'TOPUP' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {tx.type === 'TOPUP' ? '+' : '-'}{(tx.amountSatang / 100).toFixed(2)} ฿
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center bg-[#241C16] border border-[#FF7A1A]/20 rounded-3xl">
            <User className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3 opacity-40" />
            <h3 className="text-lg font-bold font-['Kanit'] text-[#E5E7EB]">ยังไม่มีข้อมูลบุตรหลานที่ผูกไว้</h3>
            <p className="text-xs text-[#9CA3AF] mt-1 mb-4">กดปุ่มด้านล่างเพื่อผูกบัญชีนักเรียนเพื่อเริ่มต้นใช้งาน</p>
            <button
              onClick={() => setIsLinkModalOpen(true)}
              className="px-4 py-2 bg-[#FF7A1A] hover:bg-[#E6680D] text-white font-bold rounded-xl text-xs transition-colors"
            >
              ผูกบัญชีนักเรียน
            </button>
          </div>
        )}

        {/* Top-up Modal */}
        {isTopupOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#241C16] border border-[#FF7A1A]/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-bold font-['Kanit'] text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#FF7A1A]" />
                เติมเงินเข้ากระเป๋าบุตรหลาน
              </h3>
              <p className="text-xs text-[#9CA3AF]">
                เติมเงินให้: <strong className="text-white">{selectedChild?.studentName}</strong>
              </p>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#E5E7EB]">จำนวนเงิน (บาท)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[50, 100, 200, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopupAmountBaht(amt)}
                      className={`py-2 rounded-xl text-xs font-bold font-['JetBrains_Mono'] ${
                        topupAmountBaht === amt
                          ? 'bg-[#FF7A1A] text-white'
                          : 'bg-[#16100C] text-[#E5E7EB] border border-white/10'
                      }`}
                    >
                      {amt} ฿
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  value={topupAmountBaht}
                  onChange={(e) => setTopupAmountBaht(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[#16100C] border border-[#FF7A1A]/30 rounded-xl text-white font-['JetBrains_Mono'] text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsTopupOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isTopupProcessing}
                  onClick={handleTopup}
                  className="px-4 py-2 bg-[#FF7A1A] hover:bg-[#E6680D] text-white text-xs font-semibold rounded-xl"
                >
                  {isTopupProcessing ? 'กำลังประมวลผล...' : 'ยืนยันการเติมเงิน'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Link Child Modal */}
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleLinkChild} className="bg-[#241C16] border border-[#FF7A1A]/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-bold font-['Kanit'] text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#FF7A1A]" />
                ผูกบัญชีนักเรียนในความดูแล
              </h3>
              <div>
                <label className="block text-xs font-semibold text-[#E5E7EB] mb-1">รหัสประจำตัวนักเรียน (Student Code / ID) *</label>
                <input
                  type="text"
                  required
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  placeholder="เช่น STU58492 หรือ UID"
                  className="w-full px-4 py-3 bg-[#16100C] border border-[#FF7A1A]/30 rounded-xl text-white font-['JetBrains_Mono'] text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#E5E7EB] mb-1">ชื่อ - นามสกุล นักเรียน *</label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="เช่น ด.ช. ชลธี มีโชค"
                  className="w-full px-4 py-3 bg-[#16100C] border border-[#FF7A1A]/30 rounded-xl text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#E5E7EB] mb-1">ความสัมพันธ์</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value as any)}
                  className="w-full px-4 py-3 bg-[#16100C] border border-[#FF7A1A]/30 rounded-xl text-white text-xs"
                >
                  <option value="FATHER">บิดา (Father)</option>
                  <option value="MOTHER">มารดา (Mother)</option>
                  <option value="GUARDIAN">ผู้ปกครองตามกฎหมาย (Guardian)</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF7A1A] hover:bg-[#E6680D] text-white text-xs font-semibold rounded-xl"
                >
                  ส่งคำขอผูกบัญชี
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
