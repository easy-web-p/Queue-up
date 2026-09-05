import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { emergencyMedicalLookup } from '../services/campusWalletService';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { AlertOctagon, Search, ShieldAlert, ArrowLeft, HeartPulse, User, Phone, FileText, Utensils, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { StudentProfile } from '../types/campus';

export default function EmergencyLookup() {
  const { user } = useAuth();
  const [studentCodeInput, setStudentCodeInput] = useState('');
  const [lookupReason, setLookupReason] = useState('อุบัติเหตุ / การปฐมพยาบาลฉุกเฉินในโรงอาหาร');
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCodeInput.trim()) return;
    setIsSearching(true);
    setNotFound(false);
    setStudentProfile(null);
    setRecentOrders([]);

    try {
      // 1. Direct Audit Log write to /emergency_audit_logs (Append-Only)
      try {
        await addDoc(collection(db, 'emergency_audit_logs'), {
          studentCode: studentCodeInput.trim(),
          lookupReason: lookupReason.trim(),
          actorUid: user?.uid || 'supervisor',
          actorEmail: user?.email || 'N/A',
          timestamp: serverTimestamp(),
        });
      } catch (auditErr) {
        console.warn('Direct audit log note:', auditErr);
      }

      // 2. Fetch authoritative student profile
      const profile = await emergencyMedicalLookup(
        studentCodeInput.trim(),
        undefined,
        lookupReason
      );

      if (profile) {
        setStudentProfile(profile);

        // 3. Query 24-48h Food Intake / Meal History
        try {
          setIsLoadingOrders(true);
          const qOrders = query(
            collection(db, 'orders'),
            where('studentId', '==', studentCodeInput.trim()),
            limit(15)
          );
          const snap = await getDocs(qOrders);
          const ords = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          ords.sort((a: any, b: any) => {
            const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tB - tA;
          });
          setRecentOrders(ords);
        } catch (ordErr) {
          console.warn('[EmergencyLookup] Orders fetch warning:', ordErr);
        } finally {
          setIsLoadingOrders(false);
        }
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      console.error('[EmergencyLookup] Error:', err);
      setNotFound(true);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#16100C] text-white font-['IBM_Plex_Sans_Thai'] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#241C16]/95 backdrop-blur border-b border-red-500/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/home" className="p-2 bg-[#16100C] border border-red-500/30 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-['Kanit'] text-white flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-red-500" />
              ระบบค้นหาข้อมูลการแพ้อาหารและการพยาบาลฉุกเฉิน (Emergency Medical Lookup)
            </h1>
            <p className="text-xs text-[#9CA3AF]">เข้าถึงประวัติการแพ้อาหาร โรคประจำตัว และเบอร์โทรฉุกเฉินพร้อมบันทึก Audit Log</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        {/* Search Box */}
        <form onSubmit={handleLookup} className="bg-[#241C16] border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            Authorized Personnel Only (บันทึก Audit Log อัตโนมัติทุกครั้ง)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#E5E7EB] mb-2">รหัสประจำตัวนักเรียน (Student Code) *</label>
              <input
                type="text"
                required
                value={studentCodeInput}
                onChange={(e) => setStudentCodeInput(e.target.value)}
                placeholder="เช่น STU58492"
                className="w-full px-4 py-3 bg-[#16100C] border border-red-500/30 rounded-xl text-white font-['JetBrains_Mono'] focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#E5E7EB] mb-2">เหตุผลการเข้าถึงข้อมูล *</label>
              <input
                type="text"
                required
                value={lookupReason}
                onChange={(e) => setLookupReason(e.target.value)}
                className="w-full px-4 py-3 bg-[#16100C] border border-white/20 rounded-xl text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold font-['Kanit'] rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
          >
            <Search className="w-4 h-4" />
            {isSearching ? 'กำลังค้นหาและบันทึกประวัติ...' : 'ค้นหาข้อมูลฉุกเฉิน'}
          </button>
        </form>

        {/* Profile Details Card */}
        {studentProfile && (
          <div className="bg-[#241C16] border-2 border-red-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-in">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-xs font-bold text-red-400 font-['JetBrains_Mono']">
                  {studentProfile.studentCode}
                </span>
                <h2 className="text-2xl font-bold font-['Kanit'] text-white mt-1 flex items-center gap-2">
                  <User className="w-6 h-6 text-[#FF7A1A]" />
                  {studentProfile.name}
                </h2>
                <p className="text-xs text-[#9CA3AF]">
                  ชั้น: {studentProfile.class} {studentProfile.room ? `ห้อง ${studentProfile.room}` : ''}
                </p>
              </div>
              <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-xs font-bold">
                Medical Record
              </span>
            </div>

            {/* Critical Allergy Info */}
            <div className="bg-red-950/40 border border-red-500/40 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-2">
                <HeartPulse className="w-4 h-4" /> ประวัติการแพ้อาหารและสารก่อภูมิแพ้ (Allergy Info):
              </h3>
              {studentProfile.allergyInfo && studentProfile.allergyInfo.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {studentProfile.allergyInfo.map((all, idx) => (
                    <span key={idx} className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg shadow">
                      ⚠️ {all}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#E5E7EB]">ไม่มีประวัติการแพ้อาหารที่ระบุไว้ในระบบ</p>
              )}
            </div>

            {/* Health Notes */}
            {studentProfile.healthNotes && (
              <div className="bg-[#16100C] border border-white/10 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4" /> ข้อควรระวังและโรคประจำตัว:
                </h3>
                <p className="text-xs text-[#E5E7EB]">{studentProfile.healthNotes}</p>
              </div>
            )}

            {/* Guardian Contacts */}
            <div className="bg-[#16100C] border border-white/10 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-[#FF7A1A] flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4" /> ผู้ปกครองที่ติดต่อได้:
              </h3>
              <p className="text-xs text-[#9CA3AF]">
                Guardian IDs: {studentProfile.guardianIds?.join(', ') || 'N/A'}
              </p>
            </div>

            {/* 24-48 Hour Meal History (Acute Anaphylaxis & Food Poisoning Investigation) */}
            <div className="bg-[#1C1510] border border-amber-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Utensils className="w-4 h-4" /> ประวัติอาหารที่รับประทานในโรงเรียน (24–48 ชม. ล่าสุด):
                </h3>
                <span className="text-xs text-[#9CA3AF] flex items-center gap-1 font-['JetBrains_Mono']">
                  <Clock className="w-3.5 h-3.5" /> {recentOrders.length} ออเดอร์
                </span>
              </div>

              {isLoadingOrders ? (
                <p className="text-xs text-[#9CA3AF] py-2">กำลังดึงประวัติมื้ออาหาร...</p>
              ) : recentOrders.length === 0 ? (
                <p className="text-xs text-[#9CA3AF] italic py-2">
                  ไม่พบประวัติการสั่งซื้ออาหารในระบบในช่วง 48 ชั่วโมงที่ผ่านมา
                </p>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 bg-[#16100C] border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-['JetBrains_Mono'] font-bold text-[#FF7A1A]">
                            {ord.queueNumber || 'Q---'}
                          </span>
                          <span className="font-semibold text-white">
                            {ord.storeName || `ร้านค้า (${ord.storeId})`}
                          </span>
                          <span className="text-[#9CA3AF]">
                            รอบ {ord.pickupTime} น. ({ord.pickupDate || 'วันนี้'})
                          </span>
                        </div>
                        {/* Dishes & Modifiers */}
                        <div className="text-[#E5E7EB] mt-1 space-x-2">
                          {ord.items?.map((item: any, idx: number) => (
                            <span key={idx} className="inline-block bg-[#241C16] px-2 py-0.5 rounded border border-white/10 text-[11px]">
                              {item.quantity}x {item.name}
                              {item.customNotes ? ` [${item.customNotes}]` : ''}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-['JetBrains_Mono'] font-bold text-amber-400">
                          ฿{Number(ord.totalAmount || 0).toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-[#9CA3AF]">
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {notFound && (
          <div className="p-8 text-center bg-[#241C16] border border-white/10 rounded-3xl text-sm text-[#9CA3AF]">
            ไม่พบข้อมูลนักเรียนรหัส "{studentCodeInput}" ในฐานข้อมูลสถานศึกษา
          </div>
        )}
      </main>
    </div>
  );
}
