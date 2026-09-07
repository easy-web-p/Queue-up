import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { submitVendorApproval } from '../services/campusWalletService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { Store, Send, CheckCircle2, Clock, XCircle, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { VendorApprovalRequest } from '../types/campus';

export default function StudentVendorOnboarding() {
  const { user, currentUser } = useAuth();
  const navigate = useNavigate();

  const [studentName, setStudentName] = useState(user?.displayName || '');
  const [studentCode, setStudentCode] = useState('');
  const [className, setClassName] = useState('');
  const [room, setRoom] = useState('');
  const [shopName, setShopName] = useState('');
  const [requestedZone, setRequestedZone] = useState('Zone A (Main Canteen)');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Snacks']);
  const [menuItems, setMenuItems] = useState<Array<{ name: string; price: number; description?: string }>>([
    { name: '', price: 20, description: '' }
  ]);

  const [existingRequest, setExistingRequest] = useState<VendorApprovalRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Available Canteen Zones
  const zones = [
    'Zone A (Main Canteen)',
    'Zone B (Snack & Dessert Corner)',
    'Building 3 Canteen (High School Area)',
    'North Hall Beverage Court',
    'Outdoor Activity Kiosk'
  ];

  const categoryOptions = [
    'Snacks', 'Beverages', 'Dessert & Bakery', 'Fast Food', 'Healthy Snacks', 'Stationery & Supplies'
  ];

  // Real-time listener for current user's existing application
  useEffect(() => {
    const uid = currentUser?.uid || user?.uid;
    if (!uid) return;

    const q = query(
      collection(db, 'vendor_approvals'),
      where('studentVendorId', '==', uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data() as VendorApprovalRequest;
        setExistingRequest({
          id: snapshot.docs[0].id,
          ...docData
        });
      } else {
        setExistingRequest(null);
      }
    });

    return () => unsubscribe();
  }, [currentUser, user]);

  const handleAddMenuItem = () => {
    setMenuItems([...menuItems, { name: '', price: 20, description: '' }]);
  };

  const handleRemoveMenuItem = (idx: number) => {
    setMenuItems(menuItems.filter((_, i) => i !== idx));
  };

  const handleMenuItemChange = (idx: number, field: string, val: string | number) => {
    const updated = [...menuItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setMenuItems(updated);
  };

  const handleToggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter((c) => c !== cat));
      }
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!studentName.trim() || !studentCode.trim() || !shopName.trim()) {
      setStatusMessage({ type: 'error', text: 'กรุณากรอกข้อมูลส่วนตัวและชื่อร้านค้าให้ครบถ้วน' });
      return;
    }

    const validMenuItems = menuItems.filter((m) => m.name.trim() !== '');
    if (validMenuItems.length === 0) {
      setStatusMessage({ type: 'error', text: 'กรุณาระบุตัวอย่างเมนูอย่างน้อย 1 รายการ' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitVendorApproval({
        studentName,
        studentCode,
        class: className,
        room,
        shopName,
        requestedZone,
        productCategories: selectedCategories,
        menuPreview: validMenuItems,
      });

      setStatusMessage({ type: 'success', text: res.message || 'ส่งคำขอเปิดร้านค้าสำเร็จ' });
    } catch (err: any) {
      console.error('[StudentVendorOnboarding] Submit Error:', err);
      setStatusMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการยื่นคำขอ' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#16100C] text-slate-800 dark:text-slate-100 font-['IBM_Plex_Sans_Thai'] pb-20 transition-colors">
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
              <Store className="w-5 h-5 text-[#FF7A1A]" />
              ยื่นขอเปิดร้านค้านักเรียน (Student Entrepreneur)
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">
              ระบบบ่มเพาะและจำลองการประกอบการธุรกิจโรงอาหารในสถานศึกษา
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8">
        {/* Status Banner if application already submitted */}
        {existingRequest && (
          <div className="mb-8 p-6 rounded-2xl bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/30 shadow-xl">
            <div className="flex items-start gap-4">
              {existingRequest.status === 'PENDING' && (
                <Clock className="w-8 h-8 text-amber-500 shrink-0 mt-1" />
              )}
              {existingRequest.status === 'APPROVED' && (
                <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0 mt-1" />
              )}
              {existingRequest.status === 'REJECTED' && (
                <XCircle className="w-8 h-8 text-red-500 shrink-0 mt-1" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-lg font-bold font-['Kanit'] text-slate-900 dark:text-white">
                    สถานะใบสมัคร: {existingRequest.shopName}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold font-['JetBrains_Mono'] ${
                    existingRequest.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                      : existingRequest.status === 'REJECTED'
                      ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400 border border-red-300 dark:border-red-500/30'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30'
                  }`}>
                    {existingRequest.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-[#E5E7EB] mt-2">
                  โซนที่ขอ: <strong className="text-slate-900 dark:text-white">{existingRequest.requestedZone}</strong> | หมวดหมู่: <strong className="text-slate-900 dark:text-white">{existingRequest.productCategories?.join(', ')}</strong>
                </p>
                {existingRequest.status === 'APPROVED' && (
                  <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30">
                    <p className="text-sm text-emerald-800 dark:text-emerald-300 font-semibold">
                      🎉 ยินดีด้วย! ร้านค้าของคุณผ่านการอนุมัติแล้ว คุณสามารถเข้าสู่ Merchant Dashboard เพื่อจัดการเมนูและรับออเดอร์ได้ทันที
                    </p>
                    <button
                      onClick={() => navigate('/merchant/dashboard')}
                      className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                    >
                      ไปยัง Merchant Dashboard
                    </button>
                  </div>
                )}
                {existingRequest.status === 'REJECTED' && (
                  <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-sm text-red-800 dark:text-red-300">
                    <p className="font-semibold">เหตุผลการปฏิเสธ:</p>
                    <p>{existingRequest.rejectionReason || 'ข้อมูลหรือเมนูอาหารไม่ผ่านเกณฑ์ความปลอดภัยของโรงเรียน'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#241C16] border border-slate-200 dark:border-[#FF7A1A]/20 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-200 dark:border-white/10 pb-4">
            <h2 className="text-xl font-bold font-['Kanit'] text-slate-900 dark:text-white">1. ข้อมูลผู้ประกอบการนักเรียน</h2>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">กรอกข้อมูลสำหรับการตรวจสอบสถานะนักเรียน</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">ชื่อ - นามสกุล นักเรียน *</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/30 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#FF7A1A] transition-colors"
                placeholder="เช่น ด.ช. สุขุม สุขสำราญ"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">รหัสประจำตัวนักเรียน *</label>
              <input
                type="text"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/30 rounded-xl text-slate-900 dark:text-white font-['JetBrains_Mono'] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#FF7A1A] transition-colors"
                placeholder="เช่น STU58492"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">ระดับชั้น (Class / Grade)</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/30 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#FF7A1A] transition-colors"
                placeholder="เช่น ม.4/2 หรือ Grade 10"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">ห้องเรียน / อาคารประจำ</label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/30 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#FF7A1A] transition-colors"
                placeholder="เช่น ห้อง 421 อาคาร 4"
              />
            </div>
          </div>

          <div className="border-b border-slate-200 dark:border-white/10 pb-4 pt-4">
            <h2 className="text-xl font-bold font-['Kanit'] text-slate-900 dark:text-white">2. ข้อมูลร้านค้าและจุดจำหน่าย</h2>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">ระบุโซนและประเภทอาหารที่ประสงค์จะจัดจำหน่าย</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">ชื่อร้านค้า (Shop Name) *</label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/30 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#FF7A1A] transition-colors"
                placeholder="เช่น ปังปิ้งหลังคาแดง, ชาเขียวม.ปลาย"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">โซนโรงอาหารที่ต้องการ *</label>
              <select
                value={requestedZone}
                onChange={(e) => setRequestedZone(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#16100C] border border-slate-300 dark:border-[#FF7A1A]/30 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#FF7A1A] transition-colors"
              >
                {zones.map((z) => (
                  <option key={z} value={z} className="bg-white dark:bg-[#16100C] text-slate-900 dark:text-white">{z}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#E5E7EB] mb-2">หมวดหมู่สินค้าที่จำหน่าย</label>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleToggleCategory(cat)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#FF7A1A] border-[#FF7A1A] text-white shadow-md shadow-orange-500/20'
                        : 'bg-slate-100 dark:bg-[#16100C] border-slate-200 dark:border-white/20 text-slate-700 dark:text-[#E5E7EB] hover:border-[#FF7A1A]/60'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-b border-slate-200 dark:border-white/10 pb-4 pt-4">
            <h2 className="text-xl font-bold font-['Kanit'] text-slate-900 dark:text-white">3. ตัวอย่างรายการเมนู (Menu Preview)</h2>
            <p className="text-xs text-slate-500 dark:text-[#9CA3AF]">ระบุอย่างน้อย 1 เมนูเพื่อประกอบการพิจารณาด้านสุขอนามัยและโภชนาการ</p>
          </div>

          <div className="space-y-3">
            {menuItems.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-[#16100C] border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col md:flex-row gap-3 items-start md:items-center">
                <input
                  type="text"
                  placeholder="ชื่อเมนู (เช่น ขนมปังปิ้งเนยนม)"
                  value={item.name}
                  onChange={(e) => handleMenuItemChange(idx, 'name', e.target.value)}
                  className="flex-1 w-full px-3 py-2 bg-white dark:bg-[#241C16] border border-slate-300 dark:border-[#FF7A1A]/20 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#FF7A1A]"
                />
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <span className="text-xs font-bold text-slate-600 dark:text-[#9CA3AF]">ราคา (บาท):</span>
                  <input
                    type="number"
                    min="1"
                    value={item.price}
                    onChange={(e) => handleMenuItemChange(idx, 'price', Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-white dark:bg-[#241C16] border border-slate-300 dark:border-[#FF7A1A]/20 rounded-xl text-slate-900 dark:text-white font-['JetBrains_Mono'] text-sm focus:outline-none focus:border-[#FF7A1A]"
                  />
                </div>
                {menuItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMenuItem(idx)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                    title="ลบเมนู"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddMenuItem}
              className="px-4 py-2 border border-dashed border-[#FF7A1A]/50 text-[#FF7A1A] hover:bg-orange-50 dark:hover:bg-[#FF7A1A]/10 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> เพิ่มเมนูตัวอย่าง
            </button>
          </div>

          {statusMessage && (
            <div className={`p-4 rounded-xl text-sm font-semibold ${
              statusMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30' : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-500/30'
            }`}>
              {statusMessage.text}
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-[#FF7A1A] hover:bg-[#E6680D] disabled:opacity-50 text-white font-bold font-['Kanit'] rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <span>กำลังบันทึกข้อมูล...</span>
              ) : (
                <>
                  <Send className="w-5 h-5" /> ยื่นใบสมัครเปิดร้านค้านักเรียน
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
