import React, { useState, useEffect } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Modal } from '../ui/Modal';
import { ImageUploader } from '../ui/ImageUploader';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Bell,
  AlertTriangle,
  Save,
  Check,
  ExternalLink,
  Camera
} from 'lucide-react';

export const AccountSettingsModal: React.FC = () => {
  const { isAccountSettingsModalOpen, setIsAccountSettingsModalOpen, currentUser, updateUserProfile, openUserProfile } = useQueue();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [couponNotifs, setCouponNotifs] = useState(true);
  const [queueNotifs, setQueueNotifs] = useState(true);
  const [menuNotifs, setMenuNotifs] = useState(true);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || '');
      setPhone(currentUser.phone || '');
      setAvatar(currentUser.avatar || '');
      setAllergiesText((currentUser.allergies || []).join(', '));
    }
  }, [currentUser]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const allergies = allergiesText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    updateUserProfile({
      fullName,
      phone,
      avatar,
      allergies
    });

    setIsAccountSettingsModalOpen(false);
  };

  return (
    <Modal
      isOpen={isAccountSettingsModalOpen}
      onClose={() => setIsAccountSettingsModalOpen(false)}
      title="⚙️ การตั้งค่าบัญชี & ข้อมูลส่วนตัว"
      size="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* User Avatar & Image Uploader */}
        <div className="p-3.5 bg-orange-50/70 dark:bg-zinc-900 rounded-2xl border border-orange-200/80 dark:border-zinc-800 space-y-3">
          <ImageUploader
            value={avatar}
            onChange={setAvatar}
            label="รูปภาพโปรไฟล์ผู้ใช้งาน (อัปโหลดจากเครื่อง หรือเลือกรูป)"
            helperText="รองรับไฟล์ JPG, PNG ถ่ายจากกล้องหรืออัปโหลดจากมือถือ/คอมพิวเตอร์"
            aspectRatio="avatar"
            presets={[
              { label: 'รูปโปรไฟล์ 1', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80' },
              { label: 'รูปโปรไฟล์ 2', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80' },
              { label: 'รูปโปรไฟล์ 3', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
              { label: 'รูปโปรไฟล์ 4', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80' }
            ]}
          />
        </div>

        {/* User Info Quick View */}
        <div className="flex items-center justify-between px-3 py-2 bg-stone-50 dark:bg-zinc-950 rounded-xl text-xs border border-stone-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <span className="text-stone-600 dark:text-zinc-400 truncate max-w-[200px]">
              {currentUser?.email || 'ยังไม่ได้เข้าสู่ระบบ'}
            </span>
          </div>
          {currentUser?.id && (
            <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
              #{currentUser.id}
            </span>
          )}
        </div>

        {/* Go to full Profile Page */}
        <button
          type="button"
          onClick={() => {
            setIsAccountSettingsModalOpen(false);
            openUserProfile(currentUser?.id);
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-orange-100 hover:bg-orange-200 dark:bg-orange-500/20 dark:hover:bg-orange-500/30 text-orange-900 dark:text-orange-300 text-xs font-bold transition-colors cursor-pointer border border-orange-200 dark:border-orange-500/30"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>เปิดหน้าเพจโปรไฟล์ ID เต็ม (Full User Profile Page)</span>
        </button>

        {/* Form Inputs */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              ชื่อ - นามสกุล *
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="ชื่อ-นามสกุลของคุณ"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              เบอร์โทรศัพท์มือถือ (สำหรับติดต่อรับอาหาร)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              ประวัติการแพ้อาหาร (ระบบจะแจ้งเตือนอัตโนมัติเมื่อสั่ง)
            </label>
            <div className="relative">
              <AlertTriangle className="w-4 h-4 absolute left-3 top-2.5 text-amber-500" />
              <input
                type="text"
                value={allergiesText}
                onChange={e => setAllergiesText(e.target.value)}
                placeholder="เช่น กุ้ง, ถั่วลิสง, นมวัว, แป้งสาลี (คั่นด้วยจุลภาค)"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="pt-2 border-t border-stone-200 dark:border-zinc-800">
          <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-orange-500" />
            การตั้งค่าการแจ้งเตือน
          </label>
          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between p-2 rounded-lg bg-stone-50 dark:bg-zinc-900/60 cursor-pointer">
              <span className="text-stone-700 dark:text-zinc-300">แจ้งเตือนสถานะคิวเมื่อพร้อมรับ</span>
              <input
                type="checkbox"
                checked={queueNotifs}
                onChange={e => setQueueNotifs(e.target.checked)}
                className="accent-orange-500 w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between p-2 rounded-lg bg-stone-50 dark:bg-zinc-900/60 cursor-pointer">
              <span className="text-stone-700 dark:text-zinc-300">แจ้งเตือนคูปองและโปรโมชั่นใหม่ประจำวัน</span>
              <input
                type="checkbox"
                checked={couponNotifs}
                onChange={e => setCouponNotifs(e.target.checked)}
                className="accent-orange-500 w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between p-2 rounded-lg bg-stone-50 dark:bg-zinc-900/60 cursor-pointer">
              <span className="text-stone-700 dark:text-zinc-300">แจ้งเตือนเมนูใหม่จากร้านที่ติดตาม</span>
              <input
                type="checkbox"
                checked={menuNotifs}
                onChange={e => setMenuNotifs(e.target.checked)}
                className="accent-orange-500 w-4 h-4"
              />
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setIsAccountSettingsModalOpen(false)}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกข้อมูล</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
