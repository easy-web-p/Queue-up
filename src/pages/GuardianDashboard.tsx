import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  fetchParentChildLinks,
  createParentChildLink,
} from '../services/campusWalletService';
import {
  Shield,
  History,
  Plus,
  ArrowLeft,
  User,
  HeartPulse,
  Save,
  Utensils,
  Ban,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { Link } from 'react-router-dom';
import type { ParentChildLink, StudentProfile } from '../types/campus';
import { useToast } from '../components/ToastProvider.jsx';

interface RecentOrder {
  id: string;
  queueNumber: string;
  storeName?: string;
  pickupTime: string;
  status: string;
  items: Array<{ name: string; quantity: number }>;
  createdAt?: any;
}

export default function GuardianDashboard() {
  const toast = useToast();
  const { user, currentUser } = useAuth();
  const [children, setChildren] = useState<ParentChildLink[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentChildLink | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Food Restriction state
  const [blockedCategories, setBlockedCategories] = useState<string[]>([]);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferenceSaveStatus, setPreferenceSaveStatus] = useState<string | null>(null);

  // Allergy & Health Notes State
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [healthNotes, setHealthNotes] = useState('');
  const [isSavingHealth, setIsSavingHealth] = useState(false);
  const [healthSaveMessage, setHealthSaveMessage] = useState<string | null>(null);

  // Link Child Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [relationship, setRelationship] = useState<'FATHER' | 'MOTHER' | 'GUARDIAN'>('GUARDIAN');

  const categoryOptions = [
    'เครื่องดื่มหวาน / น้ำอัดลม (Sugary Drinks)',
    'อาหารฟาสต์ฟู้ด / ของทอด (Fast Food)',
    'ขนมขบเคี้ยว / เบเกอรี่ (Snacks & Bakery)',
    'อาหารรสจัด / เผ็ดมาก (Spicy Food)',
    'เครื่องดื่มคาเฟอีน (Caffeine / Energy Drinks)',
  ];

  const commonAllergenPresets = [
    'ถั่วลิสง (Peanuts)',
    'อาหารทะเล / กุ้ง (Seafood)',
    'นมวัว / แลคโตส (Dairy)',
    'แป้งสาลี / กลูเตน (Gluten)',
    'ไข่ไก่ (Eggs)',
    'ถั่วเหลือง (Soy)',
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
    const currentChild = selectedChild;
    if (!currentChild) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecentOrders([]);
      return;
    }

    const targetStudentId = currentChild.studentId;
    async function loadChildProfileAndOrders(studentId: string) {
      try {
        // Load student medical profile & preferences
        const stuSnap = await getDoc(doc(db, 'students', studentId));
        if (stuSnap.exists()) {
          const sData = stuSnap.data() as StudentProfile & { blockedCategories?: string[] };
          setAllergies(sData.allergyInfo || []);
          setHealthNotes(sData.healthNotes || '');
          setBlockedCategories(sData.blockedCategories || []);
        } else {
          setAllergies([]);
          setHealthNotes('');
          setBlockedCategories([]);
        }

        // Load recent food orders for this student
        try {
          const q = query(
            collection(db, 'orders'),
            where('studentId', '==', studentId),
            limit(10)
          );
          const snap = await getDocs(q);
          const ords = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as RecentOrder[];

          ords.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          });

          setRecentOrders(ords);
        } catch (ordErr) {
          console.warn('[GuardianDashboard] Orders query notice:', ordErr);
        }
      } catch (err) {
        console.error('[GuardianDashboard] Error loading student profile:', err);
      }
    }
    loadChildProfileAndOrders(targetStudentId);
  }, [selectedChild]);

  const handleSavePreferences = async () => {
    if (!selectedChild) return;
    setIsSavingPreferences(true);
    setPreferenceSaveStatus(null);
    try {
      const studentRef = doc(db, 'students', selectedChild.studentId);
      await setDoc(
        studentRef,
        {
          blockedCategories,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setPreferenceSaveStatus('บันทึกการจำกัดหมวดหมู่อาหารสำเร็จ');
      toast.success('บันทึกการจำกัดหมวดหมู่อาหารเรียบร้อย');
    } catch (err: any) {
      setPreferenceSaveStatus('เกิดข้อผิดพลาดในการบันทึก: ' + (err.message || 'Unknown'));
      toast.error('บันทึกไม่สำเร็จ: ' + (err.message || 'Unknown'));
    } finally {
      setIsSavingPreferences(false);
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
      setHealthSaveMessage('บันทึกข้อมูลภูมิแพ้และสุขภาพสำเร็จ ข้อมูลเชื่อมโยงกับระบบแจ้งเตือนเมนูอาหารและห้องพยาบาล');
      toast.success('บันทึกข้อมูลภูมิแพ้สำเร็จ');
    } catch (err: any) {
      setHealthSaveMessage('เกิดข้อผิดพลาด: ' + (err.message || 'Unknown'));
      toast.error('บันทึกไม่สำเร็จ: ' + (err.message || 'Unknown'));
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
      toast.success('ส่งคำขอผูกบัญชีนักเรียนเรียบร้อย');
      const links = await fetchParentChildLinks(uid);
      setChildren(links);
      if (links.length === 1) setSelectedChild(links[0]);
    } catch (err: any) {
      toast.error('ผูกบัญชีไม่สำเร็จ: ' + (err.message || 'Unknown'));
    }
  };

  const toggleBlockedCategory = (cat: string) => {
    if (blockedCategories.includes(cat)) {
      setBlockedCategories(blockedCategories.filter((c) => c !== cat));
    } else {
      setBlockedCategories([...blockedCategories, cat]);
    }
  };

  const getOrderStatusText = (status: string) => {
    switch (status) {
      case 'READY':
      case 'READY_FOR_PICKUP':
        return { text: 'พร้อมรับอาหาร', className: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30' };
      case 'PREPARING':
        return { text: 'กำลังปรุงอาหาร', className: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30' };
      case 'CONFIRMED':
        return { text: 'รับออเดอร์แล้ว', className: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30' };
      case 'COMPLETED':
        return { text: 'รับอาหารแล้ว', className: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10' };
      case 'CANCELLED':
        return { text: 'ยกเลิกแล้ว', className: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/30' };
      default:
        return { text: 'รอดำเนินการ', className: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/30' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#16100C] text-slate-800 dark:text-slate-100 font-['IBM_Plex_Sans_Thai'] pb-20 transition-colors">
      {isLoading && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-white/80 dark:bg-[#241C16]/80 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-slate-500 dark:text-[#9CA3AF] animate-pulse">
            กำลังโหลดข้อมูลการดูแลบุตรหลาน...
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#241C16]/95 backdrop-blur border-b border-slate-200 dark:border-[#FF7A1A]/20 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <Link
            to="/home"
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#16100C] dark:hover:bg-[#FF7A1A]/10 border border-slate-200 dark:border-[#FF7A1A]/30 rounded-xl text-[#FF7A1A] transition-colors"
            aria-label="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#FF7A1A]" />
              ศูนย์ดูแลบุตรหลานและสุขภาพ (Guardian Health & Food Oversight)
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              ติดตามคิวอาหาร จัดการข้อมูลสารก่อภูมิแพ้ และกำหนดข้อจำกัดโภชนาการสำหรับนักเรียน
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {/* Child Selector / Multi-child switcher */}
        <div className="flex items-center justify-between bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/20 rounded-2xl p-4 mb-6 shadow-xs flex-wrap gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-[#FF7A1A] mr-2 shrink-0">บุตรหลานในความดูแล:</span>
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedChild(c)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  selectedChild?.id === c.id
                    ? 'bg-[#FF7A1A] text-white shadow-md shadow-orange-500/20'
                    : 'bg-slate-100 dark:bg-[#16100C] text-slate-700 dark:text-[#E5E7EB] hover:border-[#FF7A1A]/40 border border-slate-200 dark:border-white/10'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                {c.studentName} ({c.studentId})
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="px-3 py-2 bg-orange-50 hover:bg-orange-100 dark:bg-[#FF7A1A]/20 dark:hover:bg-[#FF7A1A]/30 text-orange-700 dark:text-[#FF7A1A] border border-orange-300 dark:border-[#FF7A1A]/30 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> เพิ่มบุตรหลาน
          </button>
        </div>

        {selectedChild ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1 & 2: Health Profile & Nutrition Restrictions */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Card Banner */}
              <div className="bg-gradient-to-br from-orange-50/80 via-white to-amber-50/80 dark:from-[#2D1B10] dark:via-[#241C16] dark:to-[#1A120D] border border-orange-200 dark:border-[#FF7A1A]/30 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Shield className="w-48 h-48 text-[#FF7A1A]" />
                </div>

                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase text-[#FF7A1A] tracking-wider font-['JetBrains_Mono']">
                      Student Health Profile
                    </span>
                    <h2 className="text-2xl font-bold font-['Kanit'] text-slate-900 dark:text-white mt-1">
                      {selectedChild.studentName}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#9CA3AF] font-['JetBrains_Mono']">
                      รหัสนักเรียน: {selectedChild.studentId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 rounded-full text-xs font-bold flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> ระบบดูแลความปลอดภัยเปิดใช้งาน
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white/90 dark:bg-[#16100C]/70 backdrop-blur p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
                    <span className="text-xs text-slate-500 dark:text-[#9CA3AF]">รายการสารก่อภูมิแพ้ที่บันทึกไว้</span>
                    <p className="text-xl font-bold font-['Kanit'] text-red-600 dark:text-red-400 mt-1">
                      {allergies.length > 0 ? `${allergies.length} รายการ` : 'ไม่มีประวัติแพ้'}
                    </p>
                  </div>
                  <div className="bg-white/90 dark:bg-[#16100C]/70 backdrop-blur p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
                    <span className="text-xs text-slate-500 dark:text-[#9CA3AF]">หมวดหมู่อาหารที่จำกัด</span>
                    <p className="text-xl font-bold font-['Kanit'] text-amber-600 dark:text-amber-400 mt-1">
                      {blockedCategories.length > 0 ? `${blockedCategories.length} หมวดหมู่` : 'ไม่มีการจำกัด'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Hub */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  to="/guardian/allergies"
                  className="bg-white dark:bg-[#1C1510] border border-slate-200 dark:border-white/10 hover:border-red-500/50 p-5 rounded-2xl transition-all group shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-500 dark:text-red-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <HeartPulse className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold font-['Kanit'] text-slate-900 dark:text-white group-hover:text-red-500 transition-colors">
                      จัดการข้อมูลภูมิแพ้ละเอียด
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                      บันทึกรายการสารก่อภูมิแพ้และคำแนะนำสำหรับห้องพยาบาล
                    </p>
                  </div>
                  <span className="text-xs font-bold text-red-500 dark:text-red-400 mt-4 flex items-center gap-1">
                    เปิดหน้าจัดการภูมิแพ้ <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </Link>

                <Link
                  to="/guardian/history"
                  className="bg-white dark:bg-[#1C1510] border border-slate-200 dark:border-white/10 hover:border-amber-400/50 p-5 rounded-2xl transition-all group shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <History className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold font-['Kanit'] text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                      ประวัติคิวอาหารของบุตรหลาน
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1">
                      ตรวจสอบรายการอาหารและสถานะคิวที่บุตรหลานสั่งทั้งหมด
                    </p>
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-4 flex items-center gap-1">
                    ดูประวัติทั้งหมด <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </div>

              {/* Allergy & Health Notes Section */}
              <div className="bg-white dark:bg-[#241C16] border border-red-200 dark:border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
                <div className="border-b border-slate-100 dark:border-white/10 pb-4">
                  <h3 className="text-lg font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-red-500" />
                    ข้อมูลภูมิแพ้และข้อควรระวังสุขภาพ (Allergy & Health Guard)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                    ระบบจะตรวจสอบเมนูอาหารที่สั่งโดยอัตโนมัติ และแจ้งเตือนหากมีส่วนผสมตรงกับสารก่อภูมิแพ้
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">
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
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-red-600 text-white border-red-500 shadow-xs'
                              : 'bg-slate-100 dark:bg-[#16100C] text-slate-700 dark:text-[#9CA3AF] border-slate-200 dark:border-white/20 hover:border-red-400'
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
                      placeholder="เพิ่มสารก่อภูมิแพ้อื่นๆ (เช่น ผงชูรส, สีผสมอาหาร, เมล็ดงา)"
                      className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-red-500/30 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      เพิ่ม
                    </button>
                  </form>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">
                    ข้อควรระวังสุขภาพ / โรคประจำตัว
                  </label>
                  <textarea
                    rows={3}
                    value={healthNotes}
                    onChange={(e) => setHealthNotes(e.target.value)}
                    placeholder="เช่น ภาวะ G6PD ห้ามทานถั่วปากอ้า, มีอาการหอบหืด, แพ้อาหารรุนแรงพกยาฉุกเฉิน..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-white/20 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:border-red-500"
                  />
                </div>

                {healthSaveMessage && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 rounded-xl text-xs text-red-800 dark:text-red-300">
                    {healthSaveMessage}
                  </div>
                )}

                <button
                  onClick={handleSaveHealthProfile}
                  disabled={isSavingHealth}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold font-['Kanit'] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSavingHealth ? 'กำลังบันทึก...' : 'บันทึกข้อมูลสุขภาพ & ภูมิแพ้'}
                </button>
              </div>

              {/* Food Category Restrictions Form */}
              <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/20 rounded-3xl p-6 sm:p-8 shadow-md space-y-6">
                <div className="border-b border-slate-100 dark:border-white/10 pb-4">
                  <h3 className="text-lg font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
                    <Ban className="w-5 h-5 text-[#FF7A1A]" />
                    กำหนดหมวดหมู่อาหารที่ไม่พึงประสงค์ (Nutrition & Category Control)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
                    เลือกหมวดหมู่ที่ต้องการให้ระบบแจ้งเตือนบุตรหลานเพื่อสุขภาพและโภชนาการที่ดี
                  </p>
                </div>

                <div>
                  <div className="flex flex-wrap gap-2">
                    {categoryOptions.map((cat) => {
                      const isBlocked = blockedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleBlockedCategory(cat)}
                          className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isBlocked
                              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-[#16100C] border-slate-200 dark:border-white/20 text-slate-700 dark:text-[#9CA3AF] hover:border-[#FF7A1A]/40'
                          }`}
                        >
                          {isBlocked ? '🚫 ' : '+ '} {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {preferenceSaveStatus && (
                  <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-[#E5E7EB]">
                    {preferenceSaveStatus}
                  </div>
                )}

                <button
                  onClick={handleSavePreferences}
                  disabled={isSavingPreferences}
                  className="w-full py-3 bg-[#FF7A1A] hover:bg-[#E6680D] disabled:opacity-50 text-white font-bold font-['Kanit'] rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                >
                  {isSavingPreferences ? 'กำลังบันทึก...' : 'บันทึกการจำกัดหมวดอาหาร'}
                </button>
              </div>
            </div>

            {/* Column 3: Recent Child Orders Queue Feed */}
            <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/20 rounded-3xl p-6 shadow-md flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-4 mb-4">
                <h3 className="text-base font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-[#FF7A1A]" />
                  คิวอาหารล่าสุดของบุตรหลาน
                </h3>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                {recentOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 dark:text-[#9CA3AF] text-xs">
                    ยังไม่มีรายการสั่งอาหารล่าสุด
                  </div>
                ) : (
                  recentOrders.map((ord) => {
                    const statusInfo = getOrderStatusText(ord.status);
                    return (
                      <div
                        key={ord.id}
                        className="p-3.5 bg-slate-50 dark:bg-[#16100C] border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-['JetBrains_Mono'] font-bold text-sm text-[#FF7A1A]">
                            คิว {ord.queueNumber}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.className}`}>
                            {statusInfo.text}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {ord.storeName || 'ร้านอาหารในโรงเรียน'}
                          </p>
                          <div className="mt-1 space-y-0.5">
                            {ord.items?.map((it, idx) => (
                              <p key={idx} className="text-[11px] text-slate-600 dark:text-[#9CA3AF]">
                                • {it.name} x{it.quantity}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-white/5 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> นัดรับ: {ord.pickupTime} น.
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/20 rounded-3xl shadow-sm">
            <User className="w-12 h-12 text-slate-400 dark:text-[#9CA3AF] mx-auto mb-3 opacity-40" />
            <h3 className="text-lg font-bold font-['Kanit'] text-slate-800 dark:text-[#E5E7EB]">ยังไม่มีข้อมูลบุตรหลานที่ผูกไว้</h3>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF] mt-1 mb-4">กดปุ่มด้านล่างเพื่อผูกบัญชีนักเรียนเพื่อเริ่มต้นใช้งานการดูแล</p>
            <button
              onClick={() => setIsLinkModalOpen(true)}
              className="px-4 py-2 bg-[#FF7A1A] hover:bg-[#E6680D] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              ผูกบัญชีนักเรียน
            </button>
          </div>
        )}

        {/* Link Child Modal */}
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleLinkChild} className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-bold font-['Kanit'] text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#FF7A1A]" />
                ผูกบัญชีนักเรียนในความดูแล
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-1">รหัสประจำตัวนักเรียน (Student Code / ID) *</label>
                <input
                  type="text"
                  required
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  placeholder="เช่น STU58492 หรือ UID"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/30 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-['JetBrains_Mono'] text-xs focus:outline-none focus:border-[#FF7A1A]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-1">ชื่อ - นามสกุล นักเรียน *</label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="เช่น ด.ช. ชลธี มีโชค"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/30 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs focus:outline-none focus:border-[#FF7A1A]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-1">ความสัมพันธ์</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/30 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#FF7A1A]"
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FF7A1A] hover:bg-[#E6680D] text-white text-xs font-semibold rounded-xl cursor-pointer"
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
