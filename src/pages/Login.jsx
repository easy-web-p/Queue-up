import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQueue } from '../context/QueueContext';
import { User, Shield, Sparkles, ChefHat, GraduationCap, Users } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signInWithGoogle } = useAuth();
  const { setRole: setGlobalRole, addToast } = useQueue();
  const [selectedRole, setSelectedRole] = useState('customer');

  const from = location.state?.from?.pathname || '/queueup';

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      setGlobalRole(selectedRole);
      addToast('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับเข้าสู่ QueueUp ในบทบาท ${selectedRole}`, 'success');
      navigate(from, { replace: true });
    } catch {
      // Fallback fast login for testing
      handleQuickLogin(selectedRole);
    }
  };

  const handleQuickLogin = (roleToSet) => {
    const mockUsers = {
      customer: { id: 'user-demo-1', name: 'สมชาย ใจดี (นักศึกษา มข.)', email: 'somchai@kkumail.com', role: 'customer' },
      merchant: { id: 'merchant-demo-1', name: 'เจ๊ณี ข้าวมันไก่ คอมเพล็กซ์', email: 'jenee@kku-food.com', role: 'merchant' },
      student_vendor: { id: 'sv-demo-1', name: 'ธนวัฒน์ พรหมวิชัย (ร้านนักศึกษา)', email: 'thanawat.p@kkumail.com', role: 'student_vendor' },
      staff_supervisor: { id: 'staff-demo-1', name: 'อาจารย์ผู้ดูแลศูนย์อาหาร มข.', email: 'supervisor@kku.ac.th', role: 'staff_supervisor' },
      guardian: { id: 'guard-demo-1', name: 'คุณแม่พรพิมล (ผู้ปกครอง)', email: 'guardian@gmail.com', role: 'guardian' },
      admin: { id: 'admin-root-1', name: 'Admin ผู้ดูแลระบบ QueueUp', email: 'admin@queueup.kku.ac.th', role: 'admin' }
    };

    const targetUser = mockUsers[roleToSet] || mockUsers.customer;
    login(targetUser, roleToSet);
    setGlobalRole(roleToSet);
    addToast('เข้าสู่ระบบสำเร็จ', `เข้าสู่ระบบในฐานะ ${targetUser.name}`, 'success');
    navigate(from, { replace: true });
  };

  const rolesList = [
    { id: 'customer', title: 'นักศึกษา / บุคลากร (ลูกค้า)', desc: 'สั่งอาหาร จองคิวล่วงหน้า รับการแจ้งเตือนสด', icon: User, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/40' },
    { id: 'merchant', title: 'ผู้ประกอบการ / ร้านค้า', desc: 'รับออเดอร์ จัดการคิว KDS รายงานยอดขาย', icon: ChefHat, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' },
    { id: 'student_vendor', title: 'นักศึกษาผู้ประกอบการ', desc: 'เปิดร้านค้าฝึกอาชีพ ไม่มีค่าธรรมเนียม', icon: GraduationCap, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40' },
    { id: 'guardian', title: 'ผู้ปกครอง (Guardian)', desc: 'กำหนดวงเงินค่าอาหาร ติดตามประวัติและแจ้งเตือนแพ้อาหาร', icon: Users, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/40' },
    { id: 'staff_supervisor', title: 'กรรมการ / เจ้าหน้าที่ มข.', desc: 'อนุมัติร้านค้า ตรวจสุขอนามัย มอนิเตอร์คิว', icon: Shield, color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40' },
    { id: 'admin', title: 'ผู้ดูแลระบบกลาง (Admin)', desc: 'ควบคุมระบบคลังข้อมูล ร้านค้า และคิวทั้งหมด', icon: Sparkles, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40' }
  ];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200 dark:border-zinc-800">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md mb-3">
            Q
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-white">เข้าสู่ระบบ QueueUp</h1>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
            ระบบจองคิวและสั่งอาหารอัจฉริยะ 12 ศูนย์อาหาร มหาวิทยาลัยขอนแก่น
          </p>
        </div>

        {/* Role Selector */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-stone-700 dark:text-zinc-300 mb-2">
            เลือกบทบาทผู้ใช้งานที่ต้องการเข้าใช้งาน:
          </label>
          <div className="grid grid-cols-1 gap-2">
            {rolesList.map(r => {
              const Icon = r.icon;
              const isSelected = selectedRole === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id)}
                  className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-950/30 ring-2 ring-orange-500/20'
                      : 'border-stone-200 dark:border-zinc-800 hover:border-stone-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${r.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs sm:text-sm text-stone-900 dark:text-white">{r.title}</div>
                    <div className="text-[11px] text-stone-500 dark:text-zinc-400 line-clamp-1">{r.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleQuickLogin(selectedRole)}
            className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            เข้าสู่ระบบทันที (โหมด {selectedRole})
          </button>

          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 bg-white dark:bg-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-700 active:scale-[0.99] text-stone-800 dark:text-white border border-stone-300 dark:border-zinc-700 rounded-2xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.26v3.15C3.25 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.59H1.26C.46 8.18 0 9.99 0 12s.46 3.82 1.26 5.41l4.02-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.26 6.59l4.02 3.15c.95-2.84 3.6-4.99 6.72-4.99z" />
            </svg>
            เข้าสู่ระบบด้วย Google Account (KKU Mail)
          </button>
        </div>

        <div className="mt-6 text-center text-[11px] text-stone-500 dark:text-zinc-400">
          การเข้าสู่ระบบถือว่าคุณยอมรับ{' '}
          <Link to="/pdpa" className="text-orange-600 hover:underline">ข้อกำหนดและนโยบายความเป็นส่วนตัว (PDPA)</Link>
        </div>
      </div>
    </div>
  );
}
