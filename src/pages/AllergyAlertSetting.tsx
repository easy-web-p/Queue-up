import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchParentChildLinks } from '../services/campusWalletService';
import { HeartPulse, ArrowLeft, Plus, X, Save, Check } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { Link } from 'react-router-dom';
import type { ParentChildLink, StudentProfile } from '../types/campus';

export default function AllergyAlertSetting() {
  const { user, currentUser } = useAuth();
  const [children, setChildren] = useState<ParentChildLink[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentChildLink | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [healthNotes, setHealthNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const commonAllergenPresets = [
    'ถั่วลิสง (Peanuts)',
    'อาหารทะเล / กุ้ง (Seafood)',
    'นมวัว / แลคโตส (Dairy)',
    'แป้งสาลี / กลูเตน (Gluten)',
    'ไข่ไก่ (Eggs)',
    'ถั่วเหลือง (Soy)',
    'ปลาทะเล (Fish)',
    'งา (Sesame)'
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
        console.error('[AllergyAlertSetting] Error loading children:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [uid]);

  useEffect(() => {
    if (!selectedChild) return;
    async function loadStudentProfile() {
      try {
        const snap = await getDoc(doc(db, 'students', selectedChild.studentId));
        if (snap.exists()) {
          const data = snap.data() as StudentProfile;
          setAllergies(data.allergyInfo || []);
          setHealthNotes(data.healthNotes || '');
        } else {
          setAllergies([]);
          setHealthNotes('');
        }
      } catch (err) {
        console.error('[AllergyAlertSetting] Error loading profile:', err);
      }
    }
    loadStudentProfile();
  }, [selectedChild]);

  const handleAddPresetAllergy = (preset: string) => {
    if (!allergies.includes(preset)) {
      setAllergies([...allergies, preset]);
    }
  };

  const handleAddCustomAllergy = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newAllergyInput.trim();
    if (clean && !allergies.includes(clean)) {
      setAllergies([...allergies, clean]);
      setNewAllergyInput('');
    }
  };

  const handleRemoveAllergy = (target: string) => {
    setAllergies(allergies.filter((a) => a !== target));
  };

  const handleSaveHealthInfo = async () => {
    if (!selectedChild) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const studentDocRef = doc(db, 'students', selectedChild.studentId);
      await setDoc(
        studentDocRef,
        {
          id: selectedChild.studentId,
          studentCode: selectedChild.studentId,
          name: selectedChild.studentName,
          allergyInfo: allergies,
          healthNotes: healthNotes.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSaveMessage('บันทึกข้อมูลการแพ้อาหารและคำแนะนำสุขภาพสำเร็จ');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      console.error('[AllergyAlertSetting] Error saving health info:', err);
      setSaveMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
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
              <HeartPulse className="w-5 h-5 text-red-500" />
              ข้อมูลแพ้อาหาร & สุขภาพ (Allergy & Health Alerts)
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              ระบุสารก่อภูมิแพ้เพื่อเตือนภัยโรงอาหารและบันทึกประวัติการปฐมพยาบาล
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
          <div className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
            {/* Child Info Banner */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <span className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">บันทึกเวชระเบียนนักเรียน</span>
                <h2 className="text-2xl font-bold font-['Kanit'] text-slate-900 dark:text-white mt-1">{selectedChild.studentName}</h2>
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">รหัสนักเรียน: {selectedChild.studentId}</p>
              </div>
              <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-full text-xs font-bold">
                Food Allergy Shield
              </span>
            </div>

            {/* Common Allergen Presets */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 dark:text-[#E5E7EB]">
                เลือกจากสารก่อภูมิแพ้ที่พบบ่อย (แตะเพื่อเพิ่ม):
              </label>
              <div className="flex flex-wrap gap-2">
                {commonAllergenPresets.map((preset) => {
                  const isSelected = allergies.includes(preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddPresetAllergy(preset)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-red-50 dark:bg-red-500/20 border-red-300 dark:border-red-500 text-red-700 dark:text-red-300'
                          : 'bg-slate-100 dark:bg-[#16100C] border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#9CA3AF] hover:border-slate-300'
                      }`}
                    >
                      {preset} {isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Allergen Input */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 dark:text-[#E5E7EB]">
                พิมพ์เพิ่มสารก่อภูมิแพ้อื่นๆ:
              </label>
              <form onSubmit={handleAddCustomAllergy} className="flex gap-2">
                <input
                  type="text"
                  value={newAllergyInput}
                  onChange={(e) => setNewAllergyInput(e.target.value)}
                  placeholder="เช่น สตรอว์เบอร์รี, ผงชูรส, สารกันบูด"
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-white/20 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> เพิ่ม
                </button>
              </form>
            </div>

            {/* Active Allergies List */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 dark:text-[#E5E7EB]">
                รายการที่บันทึกไว้ในระบบ ({allergies.length} รายการ):
              </label>
              {allergies.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-[#9CA3AF] italic bg-slate-50 dark:bg-[#16100C] p-4 rounded-xl border border-slate-200 dark:border-white/5">
                  ยังไม่ได้ระบุสารก่อภูมิแพ้ (นักเรียนไม่มีประวัติแพ้อาหาร)
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allergies.map((allergy) => (
                    <span
                      key={allergy}
                      className="px-3 py-1.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/40 text-red-800 dark:text-red-300 rounded-xl text-xs font-semibold flex items-center gap-2"
                    >
                      ⚠️ {allergy}
                      <button
                        type="button"
                        onClick={() => handleRemoveAllergy(allergy)}
                        className="p-0.5 hover:bg-red-200 dark:hover:bg-red-800 rounded-full transition-colors text-red-700 dark:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Health Notes & Emergency Instructions */}
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 dark:text-[#E5E7EB]">
                ข้อควรระวังพิเศษ & โรคประจำตัว (สำหรับคุณครูหรือห้องพยาบาล):
              </label>
              <textarea
                rows={4}
                value={healthNotes}
                onChange={(e) => setHealthNotes(e.target.value)}
                placeholder="เช่น หากมีอาการแพ้รุนแรง (ปากบวม หายใจไม่ออก) ให้รีบฉีดยา Epipen ที่อยู่ในกระเป๋า และโทรหาผู้ปกครองทันที..."
                className="w-full p-4 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-white/20 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:border-red-500 leading-relaxed"
              />
            </div>

            {/* Save Status & Action */}
            {saveMessage && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {saveMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveHealthInfo}
              disabled={isSaving}
              className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold font-['Kanit'] rounded-2xl shadow-xl shadow-red-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'กำลังบันทึกข้อมูล...' : 'บันทึกข้อมูลแพ้อาหารและคำแนะนำสุขภาพ'}
            </button>
          </div>
        ) : (
          <div className="p-12 text-center bg-white dark:bg-[#241C16] border border-slate-200 dark:border-white/10 rounded-3xl text-sm text-slate-600 dark:text-[#9CA3AF]">
            ไม่พบข้อมูลบุตรหลานที่ผูกบัญชีไว้
          </div>
        )}
      </main>
    </div>
  );
}
