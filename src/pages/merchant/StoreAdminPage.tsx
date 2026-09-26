import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import {
  Store as StoreIcon,
  ChefHat,
  Clock,
  MapPin,
  Phone,
  CreditCard,
  UserCheck,
  TrendingUp,
  ShoppingBag,
  Bell,
  CheckCircle,
  AlertTriangle,
  Send,
  Plus,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  Headphones,
  HelpCircle,
  Radio,
  Eye,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Sliders,
  DollarSign,
  MessageSquare
} from 'lucide-react';
import { QueueStatus } from '../../types';

interface SupportTicket {
  id: string;
  category: string;
  title: string;
  status: 'pending' | 'in_progress' | 'resolved';
  createdAt: string;
}

export const StoreAdminPage: React.FC = () => {
  const {
    stores,
    foodItems,
    queues,
    updateOrderStatus,
    toggleFoodAvailability,
    currentUser,
    userStore,
    activeStore,
    activeStoreId,
    setActiveStoreId,
    openStoreDetail,
    setCurrentView,
    addToast,
    openStoreChatPage,
    getStoreCustomerThreads,
    updateStore,
    addFoodItem
  } = useQueue();

  const navigate = useNavigate();

  // Active store to display: userStore strictly for 1-user-per-store model
  const currentStore = userStore || (currentUser?.email?.toLowerCase() === 'hi00000087@gmail.com' ? stores.find(s => s.id === 'store-1') : null) || (activeStoreId ? stores.find(s => s.id === activeStoreId) : null) || stores[0];

  const merchantThreads = currentStore ? getStoreCustomerThreads(currentStore.id) : [];
  const unreadCustomerMessages = merchantThreads.reduce((acc, th) => acc + (th.unreadCount || 0), 0);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'menu' | 'support' | 'settings'>('overview');

  // Store Open / Closed toggle
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(currentStore?.isOpen ?? true);

  // Sync state if store changes
  useEffect(() => {
    if (currentStore) {
      setIsStoreOpen(currentStore.isOpen ?? true);
    }
  }, [currentStore?.id, currentStore?.isOpen]);

  // New Menu Form state
  const [isAddingMenu, setIsAddingMenu] = useState<boolean>(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('rice');
  const [newMenuPrepTime, setNewMenuPrepTime] = useState('10');

  // Support Ticket state
  const [ticketCategory, setTicketCategory] = useState('ขอสแตนดี้ QR Code ตั้งโต๊ะชุดใหม่');
  const [ticketDetails, setTicketDetails] = useState('');
  const [ticketUrgency, setTicketUrgency] = useState<'normal' | 'urgent'>('normal');
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([
    {
      id: 'TCK-8821',
      category: 'ขอสแตนดี้ QR Code ตั้งโต๊ะชุดใหม่',
      title: 'ขอสแตนดี้ตั้งโต๊ะขนาด A5 จำนวน 4 จุดหน้าร้าน',
      status: 'resolved',
      createdAt: 'เมื่อวานนี้ 14:20 น.'
    },
    {
      id: 'TCK-9014',
      category: 'ตรวจสอบยอดโอนพร้อมเพย์',
      title: 'ยอดโอนรอบ 11:30 - 12:00 น. ตรวจสอบผ่านระบบเรียบร้อย',
      status: 'in_progress',
      createdAt: 'วันนี้ 10:15 น.'
    }
  ]);

  if (!currentStore) {
    return (
      <div className="text-center py-16 space-y-4">
        <StoreIcon className="w-16 h-16 mx-auto text-stone-300" />
        <h2 className="text-xl font-bold text-stone-800 dark:text-zinc-100">ยังไม่พบข้อมูลร้านค้า</h2>
        <button
          onClick={() => setCurrentView('create-store')}
          className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-xs"
        >
          สร้างร้านค้าใหม่ทันที
        </button>
      </div>
    );
  }

  // Filter orders for this specific store
  const storeOrders = queues.filter(q => q.storeId === currentStore.id);
  const activeOrders = storeOrders.filter(q => q.status !== 'COMPLETED' && q.status !== 'CANCELLED');
  const completedOrders = storeOrders.filter(q => q.status === 'COMPLETED');

  // Store Food items
  const storeFoods = foodItems.filter(f => f.storeId === currentStore.id);

  // Today's total sales
  const todayRevenue = storeOrders
    .filter(q => q.status === 'COMPLETED' || q.status === 'READY' || q.status === 'PREPARING')
    .reduce((sum, q) => sum + (q.total || 0), 0);

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDetails.trim()) return;

    const newTicket: SupportTicket = {
      id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
      category: ticketCategory,
      title: ticketDetails.trim(),
      status: 'pending',
      createdAt: 'เมื่อสักครู่'
    };

    setSupportTickets(prev => [newTicket, ...prev]);
    setTicketDetails('');
    addToast('ส่งคำขอซัพพอร์ตสำเร็จ!', 'ทีมงานดูแลพาร์ทเนอร์ร้านค้าได้รับเรื่องแล้ว จะติดต่อกลับทางโทรศัพท์หรือ LINE', 'success');
  };

  const handleAddNewMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuName.trim() || !newMenuPrice) return;
    addFoodItem({
      storeId: currentStore.id,
      name: newMenuName.trim(),
      price: parseFloat(newMenuPrice) || 0,
      category: newMenuCategory,
      preparationMinutes: parseInt(newMenuPrepTime) || 10,
      isAvailable: true,
      description: `เมนูสร้างใหม่โดย ${currentStore.name}`,
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60'
    });
    addToast('เพิ่มเมนูอาหารใหม่สำเร็จ!', `เมนู "${newMenuName}" พร้อมเปิดให้ลูกค้าสั่งแล้ว`, 'success');
    setIsAddingMenu(false);
    setNewMenuName('');
    setNewMenuPrice('');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">

      {/* Top Store Header Banner */}
      <div className="bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
        {/* Cover image banner */}
        <div className="h-32 sm:h-44 w-full relative bg-stone-200 dark:bg-zinc-800">
          <img
            src={currentStore.coverImage || currentStore.image}
            alt={currentStore.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={() => openStoreDetail(currentStore.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-stone-900 text-xs font-bold backdrop-blur-md shadow-md transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-orange-600" />
              <span>ดูหน้าร้านมุมมองลูกค้า</span>
            </button>
            <button
              onClick={() => setCurrentView('kds')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>จอครัว KDS</span>
            </button>
          </div>
        </div>

        {/* Store Info & Connected User Identification */}
        <div className="p-5 sm:p-7 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            <div className="flex items-end gap-4">
              <img
                src={currentStore.logo || currentStore.image}
                alt={currentStore.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white dark:border-zinc-900 shadow-md bg-white shrink-0"
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">
                    {currentStore.name}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 text-[10px] font-bold">
                    แอดมินร้านค้า
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-orange-500" />
                  <span>{currentStore.address}</span>
                </p>
              </div>
            </div>

            {/* Open / Close Store toggle button & Chat button */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => {
                  openStoreChatPage(currentStore.id);
                  navigate('/chat');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold bg-white dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 border border-stone-200 dark:border-zinc-700 shadow-xs hover:border-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all cursor-pointer"
                title="เปิดระบบแชทของร้านเพื่อตอบกลับลูกค้า"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>แชทของร้าน (ตอบลูกค้า)</span>
                {unreadCustomerMessages > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white font-mono font-bold text-[10px] animate-pulse">
                    {unreadCustomerMessages}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  const nextState = !isStoreOpen;
                  setIsStoreOpen(nextState);
                  updateStore(currentStore.id, { isOpen: nextState });
                  addToast(
                    nextState ? 'เปิดรับออเดอร์แล้ว' : 'ปิดร้านชั่วคราวแล้ว',
                    nextState ? 'ลูกค้าสามารถกดสั่งอาหารและรับบัตรคิวได้ทันที' : 'ระบบหยุดรับออเดอร์ใหม่ชั่วคราว',
                    nextState ? 'success' : 'info'
                  );
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                  isStoreOpen
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-stone-200 hover:bg-stone-300 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isStoreOpen ? 'animate-pulse' : ''}`} />
                <span>{isStoreOpen ? 'เปิดรับออเดอร์คิวปกติ' : 'ปิดรับออเดอร์ชั่วคราว'}</span>
              </button>
            </div>
          </div>

          {/* Connected User ID Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-orange-50/80 dark:bg-zinc-950/60 border border-orange-200/80 dark:border-zinc-800 text-xs">
            <div className="flex items-center gap-2 text-stone-700 dark:text-zinc-300">
              <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>เชื่อมต่อกับ:</strong> {currentStore.ownerName || currentUser?.fullName || 'ผู้ดูแลร้าน'}
              </span>
              <span className="text-stone-400">•</span>
              <span className="font-mono text-[11px] bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-stone-200 dark:border-zinc-700">
                User ID: {currentStore.ownerId || currentUser?.id || 'USR-89241'}
              </span>
              <span className="text-stone-400">•</span>
              <span className="font-mono text-[11px] bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-stone-200 dark:border-zinc-700">
                Store ID: {currentStore.id}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-stone-600 dark:text-zinc-400">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span>พร้อมเพย์รับเงิน: <strong className="font-mono">{currentStore.promptPayNumber || '089-876-5432'}</strong></span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-t border-stone-200 dark:border-zinc-800 px-4 sm:px-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>ภาพรวมและยอดขาย</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'orders'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>จัดการคิวสด & ออเดอร์</span>
            {activeOrders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-orange-500 text-white text-[10px]">
                {activeOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'menu'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>เมนูและสต็อกร้านค้า</span>
            <span className="text-stone-400 text-[10px]">({storeFoods.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('support')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'support'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Headphones className="w-4 h-4 text-amber-500" />
            <span>ระบบซัพพอร์ตร้านค้านี้</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>ตั้งค่าร้านค้า</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Overview & Analytics */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-stone-500 dark:text-zinc-400 text-xs">
                <span>ยอดขายวันนี้</span>
                <span className="p-2 rounded-xl bg-orange-50 text-orange-600 dark:bg-zinc-800 dark:text-orange-400">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-stone-900 dark:text-white">
                ฿{todayRevenue.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                +14% จากช่วงเวลาเดียวกันเมื่อวาน
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-stone-500 dark:text-zinc-400 text-xs">
                <span>คิวที่กำลังรอทำ</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-zinc-800 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {activeOrders.length} <span className="text-sm font-normal text-stone-500">คิว</span>
              </div>
              <span className="text-[11px] text-stone-500 dark:text-zinc-400">
                เวลารอประมาณ {activeOrders.length * (currentStore.averageWaitMinutes || 8)} นาที
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-stone-500 dark:text-zinc-400 text-xs">
                <span>ออเดอร์สำเร็จทั้งหมด</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-zinc-800 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-stone-900 dark:text-white">
                {completedOrders.length + 8} <span className="text-sm font-normal text-stone-500">ออเดอร์</span>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                อัตราเคลียร์คิวตรงเวลา 98%
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-stone-500 dark:text-zinc-400 text-xs">
                <span>คะแนนรีวิวร้าน</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-500 dark:bg-zinc-800">
                  <Sparkles className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-stone-900 dark:text-white">
                4.9 <span className="text-sm font-normal text-stone-500">/ 5.0</span>
              </div>
              <span className="text-[11px] text-stone-500 dark:text-zinc-400">
                จากลูกค้า 48 คนในศูนย์อาหาร
              </span>
            </div>
          </div>

          {/* Quick Actions & Support Highlight */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md space-y-3">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5" />
                <h3 className="font-bold text-sm">เริ่มจัดการครัวและรับคิว</h3>
              </div>
              <p className="text-xs text-orange-100 leading-relaxed">
                เปิดหน้าจอ KDS จอใหญ่สำหรับแม่ครัวหรือหน้าร้านเพื่อกดเรียกคิวและเปลี่ยนสถานะแบบสัมผัสเร็ว
              </p>
              <button
                onClick={() => setCurrentView('kds')}
                className="w-full py-2.5 rounded-xl bg-white text-orange-800 font-bold text-xs hover:bg-orange-50 transition-colors cursor-pointer"
              >
                เปิดหน้าจอครัว KDS ทันที
              </button>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 text-stone-900 dark:text-white">
                <Headphones className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">บริการซัพพอร์ตร้านค้าเฉพาะคุณ</h3>
              </div>
              <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
                ต้องการกระดาษพิมพ์บัตรคิว ป้าย QR ตั้งโต๊ะ หรือความช่วยเหลือทางเทคนิค? ทีมงานพร้อมดูแลทันที
              </p>
              <button
                onClick={() => setActiveTab('support')}
                className="w-full py-2.5 rounded-xl border border-orange-300 hover:bg-orange-50 text-orange-800 dark:border-zinc-700 dark:text-orange-400 dark:hover:bg-zinc-800 font-bold text-xs transition-colors cursor-pointer"
              >
                เข้าสู่ระบบซัพพอร์ตร้านค้า
              </button>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 space-y-3">
              <div className="flex items-center gap-2 text-stone-900 dark:text-white">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm">จัดการเมนูและโปรโมชั่น</h3>
              </div>
              <p className="text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">
                เพิ่มเมนูใหม่ ปรับเปลี่ยนราคา หรือตั้งสถานะของหมดชั่วคราวเพื่อแจ้งลูกค้าทันที
              </p>
              <button
                onClick={() => setActiveTab('menu')}
                className="w-full py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 font-bold text-xs transition-colors cursor-pointer"
              >
                จัดการเมนูอาหาร ({storeFoods.length} รายการ)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Live Kitchen & Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">
                ออเดอร์และคิวสดเฉพาะร้าน "{currentStore.name}"
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                ควบคุมสถานะคิว แจ้งเตือนลูกค้าเมื่ออาหารพร้อมเสิร์ฟ
              </p>
            </div>
            <span className="text-xs font-bold text-stone-600 dark:text-zinc-400">
              คิวทั้งหมด: {storeOrders.length} ออเดอร์
            </span>
          </div>

          {storeOrders.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-stone-200 dark:border-zinc-800 space-y-3">
              <ChefHat className="w-12 h-12 mx-auto text-stone-300" />
              <h3 className="font-bold text-sm text-stone-800 dark:text-zinc-200">
                ยังไม่มีออเดอร์เข้ามาในร้านนี้ขณะนี้
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                เมื่อลูกค้ากดสั่งอาหารผ่านเมนู บัตรคิวและรายละเอียดออเดอร์จะแสดงขึ้นที่นี่ทันที
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storeOrders.map(order => (
                <div
                  key={order.id}
                  className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 shadow-sm space-y-3.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-xl bg-orange-600 text-white font-mono font-black text-sm">
                        {order.queueNumber}
                      </span>
                      <div>
                        <span className="font-bold text-xs text-stone-900 dark:text-white block">
                          {order.customerName}
                        </span>
                        <span className="text-[10px] text-stone-500">{order.customerPhone}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        order.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : order.status === 'READY'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 animate-pulse'
                          : order.status === 'PREPARING'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                          : 'bg-stone-100 text-stone-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {order.status === 'COMPLETED'
                        ? 'รับอาหารแล้ว'
                        : order.status === 'READY'
                        ? 'พร้อมรับอาหาร'
                        : order.status === 'PREPARING'
                        ? 'กำลังปรุง'
                        : 'รอชำระเงิน'}
                    </span>
                  </div>

                  {/* Items list */}
                  <div className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-950 border border-stone-100 dark:border-zinc-800/80 space-y-1 text-xs">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-stone-800 dark:text-zinc-200">
                        <span>
                          {item.quantity}x {item.food?.name || 'เมนูอาหาร'}
                        </span>
                        <span className="font-mono">฿{item.subtotal || (item.food?.price ? item.food.price * item.quantity : 0)}</span>
                      </div>
                    ))}
                    {order.specialNote && (
                      <div className="pt-1 mt-1 border-t border-stone-200 dark:border-zinc-800 text-[11px] text-amber-600 dark:text-amber-400">
                        โน้ต: {order.specialNote}
                      </div>
                    )}
                  </div>

                  {/* Status update buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {order.status === 'PREPARING' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'READY')}
                        className="flex-1 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
                      >
                        🔔 เรียกคิว (พร้อมรับอาหาร)
                      </button>
                    )}
                    {order.status === 'READY' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                        className="flex-1 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
                      >
                        ✓ มอบอาหารแล้ว (เสร็จสิ้น)
                      </button>
                    )}
                    {order.status === 'PAYMENT_PENDING' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                        className="flex-1 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs"
                      >
                        🍳 รับออเดอร์และเริ่มปรุง
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Menu & Stock Management */}
      {activeTab === 'menu' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">
                รายการเมนูของร้าน ({storeFoods.length} เมนู)
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                เปิด/ปิดสถานะมีจำหน่าย หรือเพิ่มเมนูใหม่เพื่อขายในโรงอาหาร
              </p>
            </div>

            <button
              onClick={() => setIsAddingMenu(!isAddingMenu)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddingMenu ? 'ปิดฟอร์ม' : 'เพิ่มเมนูอาหารใหม่'}</span>
            </button>
          </div>

          {/* Add Menu Form Drawer/Card */}
          {isAddingMenu && (
            <form
              onSubmit={handleAddNewMenuItem}
              className="p-5 rounded-3xl bg-orange-50/70 dark:bg-zinc-950 border border-orange-200 dark:border-zinc-800 space-y-4 animate-in slide-in-from-top-2 duration-200"
            >
              <h3 className="font-bold text-xs text-orange-950 dark:text-orange-300">
                ฟอร์มเพิ่มเมนูอาหารใหม่เข้าร้าน {currentStore.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-zinc-300 mb-1">
                    ชื่อเมนูอาหาร *
                  </label>
                  <input
                    type="text"
                    required
                    value={newMenuName}
                    onChange={e => setNewMenuName(e.target.value)}
                    placeholder="เช่น ข้าวกะเพราเป็ดกรอบไข่เยี่ยวม้า"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white dark:bg-zinc-900 dark:border-zinc-700 text-stone-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 dark:text-zinc-300 mb-1">
                    ราคา (บาท) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newMenuPrice}
                    onChange={e => setNewMenuPrice(e.target.value)}
                    placeholder="65"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white dark:bg-zinc-900 dark:border-zinc-700 text-stone-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingMenu(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-stone-300 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
                >
                  บันทึกเมนูใหม่
                </button>
              </div>
            </form>
          )}

          {/* Foods list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {storeFoods.map(food => (
              <div
                key={food.id}
                className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm flex items-center gap-3.5"
              >
                <img
                  src={food.image}
                  alt={food.name}
                  className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-stone-100 dark:border-zinc-800"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-stone-900 dark:text-white truncate">
                    {food.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-black text-orange-600 dark:text-orange-400 font-mono">
                      ฿{food.price}
                    </span>
                    <span className="text-[10px] text-stone-400">• ~{food.preparationMinutes || 10} นาที</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => toggleFoodAvailability(food.id)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                        food.isAvailable !== false
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                      }`}
                    >
                      {food.isAvailable !== false ? '✓ มีจำหน่าย' : '✕ ของหมดชั่วคราว'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Dedicated Store Support & Helpdesk */}
      {activeTab === 'support' && (
        <div className="space-y-6">
          {/* Support Hotline & Direct Contacts */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-[10px] font-black tracking-wide">
                  <Headphones className="w-3 h-3" />
                  <span>ระบบซัพพอร์ตเฉพาะร้านค้า (Merchant Dedicated Support)</span>
                </span>
                <h2 className="text-xl font-black">
                  ฝ่ายดูแลพาร์ทเนอร์และช่วยเหลือทางเทคนิคสำหรับร้าน "{currentStore.name}"
                </h2>
                <p className="text-xs text-amber-100">
                  บริการให้คำปรึกษา จัดส่งอุปกรณ์ ป้าย QR และแก้ไขปัญหาขัดข้องตลอดเวลาทำการ
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href="tel:021234567"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-orange-900 font-black text-xs shadow-md hover:bg-orange-50 transition-colors"
                >
                  <Phone className="w-4 h-4 text-orange-600" />
                  <span>สายด่วน 02-123-4567 (ต่อ 2)</span>
                </a>
              </div>
            </div>

            {/* Direct Contacts Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20">
                <span className="text-[10px] text-orange-100 block">LINE สำหรับร้านค้า</span>
                <strong className="text-sm">@queueup_merchant</strong>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20">
                <span className="text-[10px] text-orange-100 block">ผู้จัดการโซนโรงอาหาร</span>
                <strong className="text-sm">คุณวิภาวรรณ (ซัพพอร์ตโซนกลาง)</strong>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20">
                <span className="text-[10px] text-orange-100 block">ระยะเวลาตอบกลับเฉลี่ย</span>
                <strong className="text-sm">&lt; 3 นาที ในช่วงเวลาทำการ</strong>
              </div>
            </div>
          </div>

          {/* System Health Check & Device Status */}
          <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>การตรวจเช็คสุขภาพระบบร้านค้า (Store System & Cloud Health)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                <div>
                  <span className="font-bold text-stone-800 dark:text-zinc-200 block">ระบบคิวเรียลไทม์</span>
                  <span className="text-[10px] text-emerald-600">เชื่อมต่อเซิร์ฟเวอร์สมบูรณ์</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <div>
                  <span className="font-bold text-stone-800 dark:text-zinc-200 block">ระบบแจ้งเตือนเรียกลูกค้า</span>
                  <span className="text-[10px] text-emerald-600">พร้อมส่งสัญญาณเตือน</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <div>
                  <span className="font-bold text-stone-800 dark:text-zinc-200 block">เกตเวย์พร้อมเพย์</span>
                  <span className="text-[10px] text-emerald-600">บัญชีพร้อมรับเงิน</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Support Request Form & Tickets History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Submit Request Form */}
            <form
              onSubmit={handleCreateTicket}
              className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 shadow-sm space-y-4"
            >
              <div className="flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-zinc-800">
                <HelpCircle className="w-4 h-4 text-orange-600" />
                <h3 className="font-bold text-xs text-stone-900 dark:text-white">
                  แจ้งปัญหาหรือส่งคำขอซัพพอร์ต (Submit Support Ticket)
                </h3>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-zinc-300 mb-1">
                  ประเภทคำขอ
                </label>
                <select
                  value={ticketCategory}
                  onChange={e => setTicketCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white dark:bg-zinc-950 dark:border-zinc-700 text-stone-900 dark:text-white cursor-pointer"
                >
                  <option value="ขอสแตนดี้ QR Code ตั้งโต๊ะชุดใหม่">ขอสแตนดี้ QR Code ตั้งโต๊ะชุดใหม่</option>
                  <option value="แจ้งปัญหาเครื่องพิมพ์บัตรคิว / กระดาษหมด">แจ้งปัญหาเครื่องพิมพ์บัตรคิว / กระดาษหมด</option>
                  <option value="ตรวจสอบยอดโอนพร้อมเพย์">ตรวจสอบยอดโอนพร้อมเพย์</option>
                  <option value="สัญญาณอินเทอร์เน็ต / จอครัวขัดข้อง">สัญญาณอินเทอร์เน็ต / จอครัวขัดข้อง</option>
                  <option value="ขอคำแนะนำการจัดเซ็ตเมนูขายดี">ขอคำแนะนำการจัดเซ็ตเมนูขายดี</option>
                  <option value="เรื่องอื่นๆ">เรื่องอื่นๆ</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 dark:text-zinc-300 mb-1">
                  รายละเอียดปัญหา หรือ สิ่งที่ต้องการให้ช่วย *
                </label>
                <textarea
                  rows={3}
                  required
                  value={ticketDetails}
                  onChange={e => setTicketDetails(e.target.value)}
                  placeholder="เช่น สแตนดี้ตั้งโต๊ะชุดเดิมเริ่มเก่า ขอสแตนดี้ขนาด A5 เพิ่ม 2 อันสำหรับวางหน้าเคาน์เตอร์..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white dark:bg-zinc-950 dark:border-zinc-700 text-stone-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-stone-500">
                  ส่งถึง: ทีมซัพพอร์ตโซนโรงอาหาร
                </span>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ส่งคำขอซัพพอร์ต</span>
                </button>
              </div>
            </form>

            {/* Tickets History List */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-zinc-800">
                <h3 className="font-bold text-xs text-stone-900 dark:text-white">
                  ประวัติคำขอซัพพอร์ตของร้านนี้ ({supportTickets.length})
                </h3>
                <span className="text-[10px] text-stone-400">อัปเดตอัตโนมัติ</span>
              </div>

              <div className="space-y-3">
                {supportTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className="p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-stone-400">{ticket.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          ticket.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : ticket.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                        }`}
                      >
                        {ticket.status === 'resolved'
                          ? '✓ ดำเนินการเรียบร้อย'
                          : ticket.status === 'in_progress'
                          ? '⏳ กำลังดำเนินการ'
                          : '📩 ได้รับเรื่องแล้ว'}
                      </span>
                    </div>

                    <h4 className="font-bold text-stone-900 dark:text-white text-xs">
                      {ticket.category}
                    </h4>
                    <p className="text-[11px] text-stone-600 dark:text-zinc-300">
                      {ticket.title}
                    </p>
                    <span className="text-[10px] text-stone-400 block pt-1">
                      {ticket.createdAt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Store Settings */}
      {activeTab === 'settings' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 shadow-sm space-y-5">
          <div className="pb-3 border-b border-stone-100 dark:border-zinc-800">
            <h2 className="text-base font-bold text-stone-900 dark:text-white">
              ตั้งค่าข้อมูลร้านค้า
            </h2>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              แก้ไขข้อมูลร้านค้า เวลาเปิด-ปิด และหมายเลขบัญชีรับเงิน
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
                ชื่อร้านค้า
              </label>
              <input
                type="text"
                defaultValue={currentStore.name}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white dark:bg-zinc-950 dark:border-zinc-700 text-stone-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
                เลขที่ซุ้ม / สถานที่ตั้ง
              </label>
              <input
                type="text"
                defaultValue={currentStore.address}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white dark:bg-zinc-950 dark:border-zinc-700 text-stone-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
                เวลารอคิวเฉลี่ย (นาที)
              </label>
              <input
                type="number"
                defaultValue={currentStore.averageWaitMinutes || 10}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white dark:bg-zinc-950 dark:border-zinc-700 text-stone-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
                หมายเลขพร้อมเพย์รับเงิน
              </label>
              <input
                type="text"
                defaultValue={currentStore.promptPayNumber || '0898765432'}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white dark:bg-zinc-950 dark:border-zinc-700 text-stone-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => addToast('บันทึกการตั้งค่าร้านค้าแล้ว', 'ข้อมูลร้านค้าของคุณได้รับการอัปเดตเรียบร้อย', 'success')}
              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs cursor-pointer shadow-xs"
            >
              บันทึกการเปลี่ยนแปลง
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
