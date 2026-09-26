import React, { useState, useRef, useEffect } from 'react';
import { useQueue } from '../../context/QueueContext';
import { AuthUser } from '../../types';
import { ImageUploader } from '../../components/ui/ImageUploader';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useCustomerOrders } from '../../hooks/useCustomerOrders';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
  Ticket,
  Heart,
  Edit3,
  Save,
  Copy,
  Check,
  ArrowLeft,
  ShoppingBag,
  Clock,
  ChevronRight,
  ExternalLink,
  Store,
  Sparkles,
  Camera,
  AlertCircle,
  X,
  Plus,
  RefreshCw,
  Award,
  Layers,
  Upload
} from 'lucide-react';

// Preset mock profiles to allow viewing different User IDs
const MOCK_PROFILES: Record<string, AuthUser> = {
  'USR-89241': {
    id: 'USR-89241',
    fullName: 'ธนากร สุขเกษม',
    email: 'hi00000087@gmail.com',
    phone: '089-876-5432',
    role: 'customer',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    authProvider: 'google',
    studentOrStoreId: 'STD-6501094',
    allergies: ['กุ้ง', 'ถั่วลิสง'],
    registeredAt: '2024-01-15T08:30:00.000Z'
  },
  'USR-30419': {
    id: 'USR-30419',
    fullName: 'ดร. ศิริพร รัตนเจริญ',
    email: 'siriporn.prof@tu.ac.th',
    phone: '081-998-7766',
    role: 'customer',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    authProvider: 'google',
    studentOrStoreId: 'EMP-90412',
    allergies: ['นมวัว (Lactose)'],
    registeredAt: '2023-11-02T10:15:00.000Z'
  },
  'USR-55102': {
    id: 'USR-55102',
    fullName: 'อภิสิทธิ์ วงศ์วิจิตร',
    email: 'apisit.w@merchant.queueup.app',
    phone: '086-554-3210',
    role: 'merchant',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    authProvider: 'email',
    studentOrStoreId: 'STR-001-KITCHEN',
    allergies: ['ไม่ใส่ผงชูรส'],
    registeredAt: '2023-08-20T14:00:00.000Z'
  }
};

const COMMON_ALLERGIES = [
  'กุ้ง/อาหารทะเล',
  'ถั่วลิสง',
  'นมวัว (Lactose)',
  'ไข่ไก่',
  'แป้งสาลี (Gluten)',
  'ถั่วเหลือง',
  'เนื้อวัว',
  'ไม่ใส่ผงชูรส (MSG Free)',
  'มังสวิรัติ (Vegetarian)',
  'ฮาลาล (Halal)'
];

export const UserProfilePage: React.FC = () => {
  const {
    currentUser,
    updateUserProfile,
    selectedUserId,
    setSelectedUserId,
    setCurrentView,
    openStoreDetail,
    queues,
    stores,
    followedStoreIds,
    addToast
  } = useQueue();

  // Active user to display: either current logged in user or the selected profile
  const activeProfile: AuthUser = (currentUser && (!selectedUserId || selectedUserId === currentUser.id))
    ? currentUser
    : (selectedUserId && MOCK_PROFILES[selectedUserId])
      ? MOCK_PROFILES[selectedUserId]
      : currentUser || MOCK_PROFILES['USR-89241'];

  const isOwnProfile = !currentUser || (currentUser.id === activeProfile.id);

  // Production Firestore profile hook (separates public and private data)
  const {
    publicProfile,
    privateProfile,
    stats,
    updateProfile: updateFirestoreProfile
  } = useUserProfile(activeProfile.id);

  // Production Authoritative Orders (queried strictly by customerId)
  const { orders: customerOrders } = useCustomerOrders(activeProfile.id);

  // Form states for editing
  const [fullName, setFullName] = useState(privateProfile?.displayName || activeProfile.fullName);
  const [email, setEmail] = useState(privateProfile?.email || activeProfile.email);
  const [phone, setPhone] = useState(privateProfile?.phone || activeProfile.phone);
  const [studentId, setStudentId] = useState(privateProfile?.studentOrStoreId || activeProfile.studentOrStoreId || '');
  const [allergies, setAllergies] = useState<string[]>(privateProfile?.allergies || activeProfile.allergies || []);
  const [customAllergy, setCustomAllergy] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(activeProfile.avatar || '');
  const [defaultNote, setDefaultNote] = useState('ไม่หวานมาก ขอแยกน้ำซุปถ้ามี');
  const [isCopiedId, setIsCopiedId] = useState(false);

  // Sync form states whenever activeProfile or loaded privateProfile changes
  useEffect(() => {
    setFullName(privateProfile?.displayName || activeProfile.fullName || '');
    setEmail(privateProfile?.email || activeProfile.email || '');
    setPhone(privateProfile?.phone || activeProfile.phone || '');
    setStudentId(privateProfile?.studentOrStoreId || activeProfile.studentOrStoreId || '');
    setAllergies(privateProfile?.allergies || activeProfile.allergies || []);
    setAvatarUrl(activeProfile.avatar || '');
  }, [
    activeProfile.id,
    activeProfile.fullName,
    activeProfile.email,
    activeProfile.phone,
    activeProfile.studentOrStoreId,
    activeProfile.avatar,
    privateProfile?.displayName,
    privateProfile?.email,
    privateProfile?.phone,
    privateProfile?.studentOrStoreId,
    privateProfile?.allergies
  ]);

  // Active tab inside profile page: 'profile' | 'queues' | 'followed' | 'switch'
  const [activeTab, setActiveTab] = useState<'profile' | 'queues' | 'followed' | 'switch'>('profile');

  // Copy User ID handler
  const handleCopyUserId = () => {
    navigator.clipboard?.writeText(activeProfile.id);
    setIsCopiedId(true);
    addToast('คัดลอกรหัสผู้ใช้งานแล้ว', `User ID: ${activeProfile.id}`, 'info');
    setTimeout(() => setIsCopiedId(false), 2000);
  };

  // Toggle allergy tag
  const handleToggleAllergy = (allergy: string) => {
    if (allergies.includes(allergy)) {
      setAllergies(allergies.filter(a => a !== allergy));
    } else {
      setAllergies([...allergies, allergy]);
    }
  };

  // Add custom allergy
  const handleAddCustomAllergy = () => {
    if (!customAllergy.trim()) return;
    if (!allergies.includes(customAllergy.trim())) {
      setAllergies([...allergies, customAllergy.trim()]);
    }
    setCustomAllergy('');
  };

  // Save changes handler with Firestore Private Profile sync
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      fullName,
      email,
      phone,
      studentOrStoreId: studentId,
      allergies,
      avatar: avatarUrl
    });

    if (isOwnProfile && activeProfile.id) {
      try {
        await updateFirestoreProfile({
          displayName: fullName,
          email,
          phone,
          studentOrStoreId: studentId,
          allergies,
          avatar: avatarUrl
        });
      } catch (err) {
        console.warn('Firestore profile sync error:', err);
      }
    }

    addToast('อัปเดตโปรไฟล์สำเร็จ', `บันทึกข้อมูลของรหัส ${activeProfile.id} เรียบร้อย`, 'success');
  };

  // User's queues and orders: prefer authoritative customerId query from Firestore cache
  const userQueues = customerOrders.length > 0
    ? (customerOrders as any)
    : queues.filter(q => q.customerPhone === activeProfile.phone || q.customerName.includes(activeProfile.fullName.split(' ')[0]));
  const followedStoresList = stores.filter(s => followedStoreIds.includes(s.id));

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-black text-stone-900 dark:text-zinc-100 transition-colors pb-24">
      {/* Top Navigation Bar / Breadcrumb */}
      <div className="bg-white/95 dark:bg-zinc-950/95 border-b border-orange-200/80 dark:border-zinc-800 sticky top-16 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentView('home')}
            className="flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับหน้าหลัก</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-stone-500 dark:text-zinc-400">
              User Profile Page
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300">
              #{activeProfile.id}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Profile Hero Header Card */}
        <div className="rounded-3xl border border-orange-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl overflow-hidden">
          {/* Header Banner */}
          <div className="h-36 sm:h-44 bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 relative p-6 flex items-end justify-between">
            <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
            <div className="relative z-10 flex items-center gap-2 text-white">
              <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold flex items-center gap-1.5 border border-white/30">
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>สมาชิก QueueUp Digital Passport</span>
              </span>
            </div>
            <div className="relative z-10 text-right text-white">
              <span className="text-[11px] opacity-90 block">วันลงทะเบียน</span>
              <span className="text-xs font-bold">
                {new Date(activeProfile.registeredAt).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>

          {/* Profile Identity Details */}
          <div className="px-6 pb-6 pt-0 relative">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-14 mb-4">
              {/* Avatar & Core Badges */}
              <div className="flex items-end gap-4">
                <div className="relative group">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-white dark:border-zinc-950 shadow-2xl overflow-hidden bg-orange-100 dark:bg-zinc-900 shrink-0">
                    {activeProfile.avatar ? (
                      <img
                        src={activeProfile.avatar}
                        alt={activeProfile.fullName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white font-black text-3xl">
                        {activeProfile.fullName.charAt(0)}
                      </div>
                    )}
                  </div>
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        const newUrl = prompt('ใส่ลิงก์รูปภาพโปรไฟล์ใหม่ (Image URL):', avatarUrl);
                        if (newUrl && newUrl.trim()) {
                          setAvatarUrl(newUrl.trim());
                          updateUserProfile({ avatar: newUrl.trim() });
                        }
                      }}
                      className="absolute bottom-1 right-1 p-2 rounded-xl bg-orange-600 text-white shadow-lg hover:bg-orange-700 active:scale-95 transition-all cursor-pointer"
                      title="เปลี่ยนรูปโปรไฟล์"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white tracking-tight">
                      {activeProfile.fullName}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30">
                      {activeProfile.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : activeProfile.role === 'merchant' ? 'เจ้าของร้าน (Merchant)' : 'ลูกค้าสมาชิก (Diner)'}
                    </span>
                  </div>

                  {/* User ID Badge with Copy Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyUserId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-orange-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-xs font-mono font-bold border border-stone-200 dark:border-zinc-800 transition-colors cursor-pointer group"
                      title="กดเพื่อคัดลอก User ID"
                    >
                      <span>ID: {activeProfile.id}</span>
                      {isCopiedId ? (
                        <Check className="w-3 h-3 text-green-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-stone-400 group-hover:text-orange-600 dark:group-hover:text-orange-400" />
                      )}
                    </button>

                    {activeProfile.studentOrStoreId && (
                      <span className="text-xs font-mono font-medium text-stone-500 dark:text-zinc-400">
                        ({activeProfile.studentOrStoreId})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                      : 'bg-stone-100 dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>แก้ไขข้อมูล</span>
                </button>
                <button
                  onClick={() => setActiveTab('queues')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'queues'
                      ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                      : 'bg-stone-100 dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>บัตรคิว & ออเดอร์ ({userQueues.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('followed')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'followed'
                      ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                      : 'bg-stone-100 dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>ร้านโปรด ({followedStoresList.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab('switch')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'switch'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                      : 'bg-stone-100 dark:bg-zinc-900 text-stone-700 dark:text-zinc-300 hover:bg-amber-50 dark:hover:bg-zinc-800'
                  }`}
                  title="ดูตัวอย่างโปรไฟล์ ID อื่น"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>สลับดู ID อื่น</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-orange-100 dark:border-zinc-800">
              <div className="p-3 rounded-2xl bg-orange-50/60 dark:bg-zinc-900/60 border border-orange-100 dark:border-zinc-800">
                <span className="text-[11px] text-stone-500 dark:text-zinc-400 font-medium block">
                  ประวัติคิวทั้งหมด
                </span>
                <span className="text-lg font-black text-stone-900 dark:text-zinc-100 font-mono">
                  {stats?.totalOrders !== undefined ? stats.totalOrders : userQueues.length} คิว
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-orange-50/60 dark:bg-zinc-900/60 border border-orange-100 dark:border-zinc-800">
                <span className="text-[11px] text-stone-500 dark:text-zinc-400 font-medium block">
                  ร้านค้าที่ติดตาม
                </span>
                <span className="text-lg font-black text-orange-600 dark:text-orange-400 font-mono">
                  {followedStoreIds.length} ร้าน
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-orange-50/60 dark:bg-zinc-900/60 border border-orange-100 dark:border-zinc-800">
                <span className="text-[11px] text-stone-500 dark:text-zinc-400 font-medium block">
                  สถานะการยืนยันตัวตน
                </span>
                <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>ยืนยันแล้ว ({activeProfile.authProvider || 'Google'})</span>
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-orange-50/60 dark:bg-zinc-900/60 border border-orange-100 dark:border-zinc-800">
                <span className="text-[11px] text-stone-500 dark:text-zinc-400 font-medium block">
                  สารก่อภูมิแพ้ที่บันทึก
                </span>
                <span className="text-xs font-bold text-red-600 dark:text-red-400 mt-1 block truncate">
                  {allergies.length > 0 ? `${allergies.length} รายการ` : 'ไม่มีประวัติแพ้'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content 1: Edit Profile Information */}
        {activeTab === 'profile' && (
          <div className="rounded-3xl border border-orange-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-orange-100 dark:border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-stone-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-orange-500" />
                  <span>แก้ไขข้อมูลโปรไฟล์ผู้ใช้งาน (User ID: {activeProfile.id})</span>
                </h2>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  ข้อมูลนี้จะถูกใช้เพื่ออำนวยความสะดวกในการเรียกคิว ตรวจสอบความปลอดภัยของอาหาร และระบุตัวตน
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300">
                ID: {activeProfile.id}
              </span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-orange-500" />
                    <span>ชื่อ - นามสกุล</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                    placeholder="เช่น ธนากร สุขเกษม"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-orange-500" />
                    <span>อีเมลติดต่อ</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                    placeholder="name@email.com"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-orange-500" />
                    <span>เบอร์โทรศัพท์มือถือ (รับแจ้งเตือน SMS คิว)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                    placeholder="08X-XXX-XXXX"
                  />
                </div>

                {/* Student / Store ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-orange-500" />
                    <span>รหัสนักศึกษา / รหัสประจำตัวบุคลากร</span>
                  </label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                    placeholder="เช่น STD-6501094"
                  />
                </div>
              </div>

              {/* Dietary Requirements & Allergies Section */}
              <div className="pt-4 border-t border-orange-100 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-stone-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span>สารก่อภูมิแพ้ & ข้อจำกัดอาหารประจำตัว (Allergies & Dietary Restrictions)</span>
                    </label>
                    <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                      ระบบจะแจ้งเตือนอัตโนมัติหากเมนูที่คุณสั่งมีส่วนผสมที่อาจก่อให้เกิดอาการแพ้
                    </p>
                  </div>
                  {allergies.length > 0 && (
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">
                      เลือกแล้ว {allergies.length} ข้อ
                    </span>
                  )}
                </div>

                {/* Common Allergies Quick Selector */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {COMMON_ALLERGIES.map(item => {
                    const isSelected = allergies.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleToggleAllergy(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-red-500 border-red-500 text-white shadow-sm shadow-red-500/20'
                            : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 text-stone-700 dark:text-zinc-300 hover:border-orange-300'
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 text-stone-400" />}
                        <span>{item}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Allergy Input */}
                <div className="flex gap-2 max-w-md pt-2">
                  <input
                    type="text"
                    value={customAllergy}
                    onChange={e => setCustomAllergy(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomAllergy();
                      }
                    }}
                    placeholder="พิมพ์สารก่อภูมิแพ้อื่นๆ..."
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomAllergy}
                    className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition-colors cursor-pointer dark:bg-zinc-800 dark:hover:bg-zinc-700"
                  >
                    เพิ่ม
                  </button>
                </div>
              </div>

              {/* Default Kitchen Note */}
              <div className="pt-2 border-t border-orange-100 dark:border-zinc-800 space-y-1.5">
                <label className="text-xs font-bold text-stone-700 dark:text-zinc-300">
                  หมายเหตุเพิ่มเติมถึงร้านค้าที่เป็นค่าเริ่มต้น
                </label>
                <input
                  type="text"
                  value={defaultNote}
                  onChange={e => setDefaultNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                  placeholder="เช่น ไม่หวานมาก, ขอช้อนส้อมพลาสติก"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentView('home')}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-zinc-800 text-xs font-bold text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs font-bold shadow-lg shadow-orange-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกการเปลี่ยนแปลงโปรไฟล์</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab Content 2: Active & Past Queues */}
        {activeTab === 'queues' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-orange-500" />
                  <span>ประวัติบัตรคิวและออเดอร์ของรหัส #{activeProfile.id}</span>
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  รายการจองคิวอาหารทั้งหมดที่เชื่อมโยงกับเบอร์ {activeProfile.phone}
                </p>
              </div>
              <button
                onClick={() => setCurrentView('queue-tracking')}
                className="px-3 py-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-900 dark:bg-orange-500/20 dark:text-orange-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>เปิดหน้าติดตามคิวสด</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {userQueues.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userQueues.map((queue: any) => (
                  <div
                    key={queue.id}
                    className="p-5 rounded-2xl border border-orange-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-md space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-800 dark:bg-zinc-900 dark:text-orange-400 flex items-center justify-center font-black font-mono text-sm">
                          {queue.queueNumber || queue.orderNumber}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-stone-900 dark:text-white">
                            {queue.storeName}
                          </h4>
                          <span className="text-[11px] text-stone-500 dark:text-zinc-400">
                            {new Date(queue.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                          </span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        queue.status === 'READY'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300'
                          : queue.status === 'PREPARING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-stone-100 text-stone-800 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {queue.status === 'READY' ? 'พร้อมรับแล้ว' : queue.status === 'PREPARING' ? 'กำลังปรุง' : queue.status}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-stone-100 dark:border-zinc-800 text-xs space-y-1">
                      {Array.isArray(queue.items) && queue.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-stone-600 dark:text-zinc-300">
                          <span>{item.food?.name || item.name || 'รายการอาหาร'} x{item.quantity}</span>
                          <span className="font-mono">฿{item.subtotal}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-1 font-bold text-stone-900 dark:text-white border-t border-stone-100 dark:border-zinc-800 items-center">
                        <div className="flex items-center gap-2">
                          <span>รวมทั้งสิ้น</span>
                          {queue.exchangePin && (
                            <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
                              PIN: #{queue.exchangePin}
                            </span>
                          )}
                        </div>
                        <span className="text-orange-600 dark:text-orange-400 font-mono">฿{queue.total}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-white dark:bg-zinc-950 rounded-2xl border border-stone-200 dark:border-zinc-800 space-y-2">
                <Ticket className="w-10 h-10 text-stone-400 mx-auto" />
                <h4 className="text-sm font-bold text-stone-800 dark:text-zinc-200">ยังไม่มีประวัติการจองคิว</h4>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  เมื่อคุณสั่งอาหารในระบบ ข้อมูลบัตรคิวและเวลาปรุงจะแสดงที่นี่
                </p>
                <button
                  onClick={() => setCurrentView('home')}
                  className="mt-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors cursor-pointer"
                >
                  ไปสั่งอาหารเลย
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 3: Followed Stores */}
        {activeTab === 'followed' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                <span>ร้านค้าที่ติดตาม ({followedStoresList.length} ร้าน)</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                คุณจะได้รับการแจ้งเตือนสิทธิพิเศษ เมนูใหม่ และคิวว่างจากร้านเหล่านี้ก่อนใคร
              </p>
            </div>

            {followedStoresList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {followedStoresList.map(store => (
                  <div
                    key={store.id}
                    onClick={() => openStoreDetail(store.id)}
                    className="p-4 rounded-2xl border border-orange-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:shadow-lg hover:border-orange-400 transition-all cursor-pointer group flex items-center gap-3.5"
                  >
                    <img
                      src={store.logo}
                      alt={store.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-xl object-cover border border-orange-100 dark:border-zinc-800 shrink-0 group-hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate group-hover:text-orange-600 transition-colors">
                        {store.name}
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-zinc-400 truncate">
                        {store.address}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-medium text-stone-600 dark:text-zinc-400">
                        <span className="text-amber-500 font-bold">★ {store.rating}</span>
                        <span>•</span>
                        <span>รอประมาณ {store.averageWaitMinutes} นาที</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-orange-500 transition-colors" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-white dark:bg-zinc-950 rounded-2xl border border-stone-200 dark:border-zinc-800 space-y-2">
                <Store className="w-10 h-10 text-stone-400 mx-auto" />
                <h4 className="text-sm font-bold text-stone-800 dark:text-zinc-200">ยังไม่ได้กดติดตามร้านค้าใดๆ</h4>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  กดปุ่ม "ติดตามร้าน" ในหน้ารายละเอียดร้านค้าเพื่อรับแจ้งเตือนเมนูใหม่
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 4: Switch / View Different User IDs */}
        {activeTab === 'switch' && (
          <div className="rounded-3xl border border-orange-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-500" />
                <span>จำลองการเปิดดูหน้าโปรไฟล์ตาม User ID ต่างๆ</span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                เลือก User ID ด้านล่างเพื่อดูว่าระบบโหลดข้อมูลโปรไฟล์ ข้อจำกัดอาหาร และรหัสประจำตัวของผู้ใช้นั้นๆ ขึ้นมาอย่างไร
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              {Object.values(MOCK_PROFILES).map(profile => {
                const isSelected = activeProfile.id === profile.id;
                return (
                  <div
                    key={profile.id}
                    onClick={() => {
                      setSelectedUserId(profile.id);
                      setFullName(profile.fullName);
                      setEmail(profile.email);
                      setPhone(profile.phone);
                      setStudentId(profile.studentOrStoreId || '');
                      setAllergies(profile.allergies || []);
                      setAvatarUrl(profile.avatar || '');
                      addToast('เปิดโปรไฟล์ผู้ใช้สำเร็จ', `กำลังแสดงข้อมูลของ ${profile.fullName} (ID: ${profile.id})`, 'info');
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/70 dark:bg-zinc-900 shadow-md ring-2 ring-orange-500/20'
                        : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={profile.avatar}
                        alt={profile.fullName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border border-stone-200 dark:border-zinc-800"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400">
                            #{profile.id}
                          </span>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-600 text-white">
                              กำลังดู
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate">
                          {profile.fullName}
                        </h4>
                        <span className="text-[11px] text-stone-500 dark:text-zinc-400 block truncate">
                          {profile.role === 'admin' ? 'Super Admin' : profile.role === 'merchant' ? 'เจ้าของร้าน' : 'นักศึกษา / ลูกค้า'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
