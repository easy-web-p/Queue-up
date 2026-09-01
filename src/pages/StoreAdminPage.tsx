import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Store,
  Settings,
  Users,
  Utensils,
  DollarSign,
  QrCode,
  ShieldCheck,
  Bell,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  Edit,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ArrowLeft,
  ChefHat,
  Search,
  Filter,
  BarChart3,
  KeyRound,
  FileText,
  UserPlus,
  Download
} from 'lucide-react';
import { MenuItem, Order, CustomerProfile, MerchantShop } from '../types';
import { fetchMenuItemsFromFirestore, fetchOrdersFromFirestore, fetchShopsFromFirestore, fetchUsersFromFirestore } from '../lib/firebase';

interface StoreAdminPageProps {
  menuItems?: MenuItem[];
  onUpdatePrice?: (id: string, newPrice: number) => void;
  onToggleStock?: (id: string) => void;
  onUpdateStock?: (id: string, newStock: number) => void;
  onAddNewItem?: (item: Omit<MenuItem, 'id'>) => void;
  onNavigateToStore?: () => void;
  onNavigateToLogin?: () => void;
}

export const StoreAdminPage: React.FC<StoreAdminPageProps> = ({
  menuItems: propsMenuItems,
  onUpdatePrice,
  onToggleStock: propsOnToggleStock,
  onUpdateStock: propsOnUpdateStock,
  onAddNewItem,
  onNavigateToStore,
  onNavigateToLogin,
}) => {
  const navigate = useNavigate();
  const { user } = useSelector((state: any) => state.auth);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'menu_admin' | 'orders' | 'payments' | 'staff' | 'crm' | 'logs'
  >('overview');

  // Store Configuration State
  const [shopInfo, setShopInfo] = useState<MerchantShop | null>(null);
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [autoAcceptOrders, setAutoAcceptOrders] = useState(true);
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [prepTimeDefault, setPrepTimeDefault] = useState(10);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Menu Items State
  const [localMenuItems, setLocalMenuItems] = useState<MenuItem[]>([]);
  const menuItems = propsMenuItems && propsMenuItems.length > 0 ? propsMenuItems : localMenuItems;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // New Item Form State
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number>(50);
  const [newItemCategory, setNewItemCategory] = useState('single_dish');
  const [newItemDesc, setNewItemDesc] = useState('');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchShopsFromFirestore().then((shops) => {
      if (shops && shops.length > 0) setShopInfo(shops[0]);
    });
    fetchMenuItemsFromFirestore().then((dbItems) => {
      if (dbItems && dbItems.length > 0) setLocalMenuItems(dbItems);
    });
    fetchOrdersFromFirestore().then((dbOrders) => {
      if (dbOrders && dbOrders.length > 0) setOrders(dbOrders);
    });
  }, []);


  // Staff State
  const [staffList, setStaffList] = useState([
    { id: 'ST-01', name: 'ป้าแดง ใจดี', role: 'เจ้าของร้าน (Admin)', phone: '081-234-5678', status: 'Active' },
    { id: 'ST-02', name: 'นายสมชาย มีชัย', role: 'พ่อครัวหลัก (Chef)', phone: '089-876-5432', status: 'Active' },
    { id: 'ST-03', name: 'นางสาววิภา เรียนดี', role: 'พนักงานแคชเชียร์ (Cashier)', phone: '086-111-2222', status: 'Active' },
  ]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('พนักงานแคชเชียร์ (Cashier)');
  const [newStaffPhone, setNewStaffPhone] = useState('');

  // CRM Coupons State
  const [coupons, setCoupons] = useState([
    { id: 'CP-1', code: 'WELCOME10', discount: 10, minSpend: 50, status: 'Active' },
    { id: 'CP-2', code: 'LUNCH5', discount: 5, minSpend: 40, status: 'Active' },
    { id: 'CP-3', code: 'STUDENT20', discount: 20, minSpend: 100, status: 'Active' }
  ]);
  const [showAddCouponModal, setShowAddCouponModal] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState(10);
  const [newCouponMinSpend, setNewCouponMinSpend] = useState(50);

  // System Logs State
  const [logs, setLogs] = useState([
    { id: 'L-101', time: '10:14 น.', action: 'อัปเดตราคาเมนู ข้าวผัดกะเพราหมูกรอบ เป็น 55 บาท', user: 'ป้าแดง ใจดี' },
    { id: 'L-102', time: '10:05 น.', action: 'ตรวจสอบสลิปชำระเงิน ออเดอร์ #ORD-1002 สำเร็จ', user: 'ระบบอัตโนมัติ' },
    { id: 'L-103', time: '09:45 น.', action: 'เปิดร้านค้าประจำวัน รับออเดอร์ปกติ', user: 'ป้าแดง ใจดี' },
    { id: 'L-104', time: '09:30 น.', action: 'เติมสต็อกวัตถุดิบไก่ทอด +50 จาน', user: 'นายสมชาย มีชัย' },
  ]);

  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    const newStaff = {
      id: `ST-${(staffList.length + 1).toString().padStart(2, '0')}`,
      name: newStaffName,
      role: newStaffRole,
      phone: newStaffPhone || '080-000-0000',
      status: 'Active'
    };
    setStaffList(prev => [...prev, newStaff]);
    setLogs(prev => [{
      id: `L-${Date.now().toString().slice(-4)}`,
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
      action: `เพิ่มพนักงานใหม่: ${newStaffName} (${newStaffRole})`,
      user: user?.name || 'Admin'
    }, ...prev]);
    setShowAddStaffModal(false);
    setNewStaffName('');
    setNewStaffPhone('');
    setToastMsg(`เพิ่มพนักงาน ${newStaffName} สำเร็จ`);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleAddCouponSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    const newCoupon = {
      id: `CP-${coupons.length + 1}`,
      code: newCouponCode.toUpperCase(),
      discount: Number(newCouponDiscount),
      minSpend: Number(newCouponMinSpend),
      status: 'Active'
    };
    setCoupons(prev => [...prev, newCoupon]);
    setLogs(prev => [{
      id: `L-${Date.now().toString().slice(-4)}`,
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.',
      action: `สร้างโค้ดส่วนลดใหม่: ${newCouponCode.toUpperCase()} (ลด ฿${newCouponDiscount})`,
      user: user?.name || 'Admin'
    }, ...prev]);
    setShowAddCouponModal(false);
    setNewCouponCode('');
    setToastMsg(`สร้างคูปอง ${newCoupon.code} สำเร็จ`);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleToggleStock = (id: string) => {
    if (propsOnToggleStock) {
      propsOnToggleStock(id);
    }
    setLocalMenuItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isAvailable: !item.isAvailable } : item
      )
    );
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    if (onUpdatePrice) {
      onUpdatePrice(id, newPrice);
    }
    setLocalMenuItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, price: newPrice } : item))
    );
    const itemMatch = menuItems.find((i) => i.id === id);
    if (itemMatch) {
      setToastMsg(`อัปเดตราคา ${itemMatch.name} เป็น ฿${newPrice} สำเร็จ`);
      setTimeout(() => setToastMsg(null), 2500);
    }
  };

  const handleBatchAdjustPrices = (delta: number) => {
    menuItems.forEach((item) => {
      if (selectedCategory === 'all' || item.category === selectedCategory) {
        const nextPrice = Math.max(1, item.price + delta);
        handleUpdatePrice(item.id, nextPrice);
      }
    });
    setToastMsg(`ปรับราคาแบบยกหมวด ${delta > 0 ? '+' : ''}${delta} บาท เรียบร้อยแล้ว`);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleAddNewItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const item: MenuItem = {
      id: `ITEM-${Date.now().toString().slice(-4)}`,
      name: newItemName,
      price: Number(newItemPrice),
      category: newItemCategory as any,
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      isAvailable: true,
      stock: 30,
      maxStock: 50,
      prepTimeMinutes: 10,
      description: newItemDesc || 'เมนูอร่อยปรุงสดใหม่ในโรงอาหาร',
      popular: true,
    };

    if (onAddNewItem) {
      onAddNewItem(item);
    }
    setLocalMenuItems((prev) => [item, ...prev]);
    setShowAddItemModal(false);
    setNewItemName('');
    setNewItemDesc('');
  };

  const handleExportCSV = () => {
    const headers = ['OrderID', 'Customer', 'Items', 'TotalAmount', 'Status', 'CreatedAt'];
    const rows = (orders.length > 0 ? orders : [
      { id: 'ORD-1001', customerName: 'น้องน้ำหวาน', items: [{ name: 'ข้าวกะเพราหมูกรอบ', quantity: 1, price: 55 }], totalAmount: 55, status: 'completed', createdAt: '2026-09-02 10:15' },
      { id: 'ORD-1002', customerName: 'อาจารย์สมชาย', items: [{ name: 'ก๋วยเตี๋ยวต้มยำ', quantity: 2, price: 90 }], totalAmount: 90, status: 'completed', createdAt: '2026-09-02 10:30' },
      { id: 'ORD-1003', customerName: 'นายพิสิษฐ์', items: [{ name: 'ชาเขียวนมสด', quantity: 1, price: 35 }], totalAmount: 35, status: 'ready', createdAt: '2026-09-02 10:45' }
    ]).map((o: any) => [
      o.id,
      `"${o.customerName || 'ลูกค้า'}"`,
      `"${o.items?.map((i: any) => `${i.name}x${i.quantity}`).join('; ') || ''}"`,
      o.totalAmount || o.price || 0,
      o.status,
      o.createdAt || new Date().toISOString()
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `queueup_sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMsg('ส่งออกรายงานยอดขาย (CSV) เรียบร้อยแล้ว');
    setTimeout(() => setToastMsg(null), 2500);
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-16">
      
      {/* Toast Notification Alert */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white border border-slate-700 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. System Admin Top Navigation Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-8 py-3 flex items-center justify-between shadow-md flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f6402e] flex items-center justify-center text-white font-black shadow-lg">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-black tracking-tight text-white">
                QueueUp <span className="text-[#f6402e]">Store & School Admin</span>
              </h1>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ออนไลน์
              </span>
              {user?.email === '58140@lomsak.ac.th' && (
                <span className="text-[10px] bg-rose-500/20 text-rose-300 font-extrabold px-2 py-0.5 rounded-full border border-rose-500/30">
                  👑 Super Admin (คุณพิสิษฐ์)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              ระบบบริหารจัดการ: {shopInfo?.shopName || 'ศูนย์อาหารและร้านค้าสถานศึกษา'} ({shopInfo?.building || shopInfo?.location || 'โรงอาหารกลาง'})
            </p>
          </div>
        </div>

        {/* Quick Actions & Navigation */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => setIsStoreOpen(!isStoreOpen)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              isStoreOpen
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500'
            }`}
          >
            {isStoreOpen ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{isStoreOpen ? 'ร้านเปิดอยู่' : 'ร้านปิดอยู่'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="ส่งออกรายงานยอดขายเป็นไฟล์ CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">ส่งออก CSV</span>
          </button>

          <button
            onClick={() => onNavigateToStore ? onNavigateToStore() : navigate('/home')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>หน้าหลัก</span>
          </button>

          <button
            onClick={() => navigate('/merchant/dashboard')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>หน้าจอ KDS ครัว</span>
          </button>

          <button
            onClick={() => onNavigateToLogin ? onNavigateToLogin() : navigate('/login')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6402e] hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </header>

      {/* 2. Admin Container & Tab Menu */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* Navigation Admin Tabs */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'ภาพรวมระบบ', icon: BarChart3 },
            { id: 'menu_admin', label: 'จัดการรายการอาหาร & สต็อก', icon: Utensils },
            { id: 'orders', label: 'ออเดอร์ & KDS หน้าครัว', icon: ChefHat },
            { id: 'payments', label: 'ตั้งค่าการชำระเงิน PromptPay', icon: QrCode },
            { id: 'staff', label: 'พนักงาน & สิทธิ์เข้าถึง', icon: Users },
            { id: 'crm', label: 'ระบบ CRM & แต้มสะสม', icon: Sparkles },
            { id: 'logs', label: 'บันทึกกิจกรรมระบบ', icon: FileText },
          ].map((tab) => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#f6402e] text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <IconComp className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW & SYSTEM CONTROL */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <span>ยอดขายประจำวัน</span>
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-slate-900">3,450 ฿</div>
                <p className="text-[11px] text-emerald-600 font-bold">+15% จากเมื่อวาน</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <span>ออเดอร์ทั้งหมดวันนี้</span>
                  <Utensils className="w-4 h-4 text-[#f6402e]" />
                </div>
                <div className="text-2xl font-black text-slate-900">68 รายการ</div>
                <p className="text-[11px] text-slate-500">เสร็จสิ้นแล้ว 62 รายการ</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <span>เวลารอคิวเฉลี่ย</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-slate-900">5.2 นาที</div>
                <p className="text-[11px] text-amber-600 font-bold">อยู่ในเกณฑ์ดีเยี่ยม</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <span>ฐานสมาชิกลูกค้า CRM</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black text-slate-900">142 คน</div>
                <p className="text-[11px] text-blue-600 font-bold">+8 คน สมัครใหม่วันนี้</p>
              </div>
            </div>

            {/* Quick System Toggles Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#f6402e]" />
                <span>การตั้งค่าการทำงานอัตโนมัติของร้านค้า</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">ระบบรับออเดอร์อัตโนมัติ</span>
                    <button
                      onClick={() => setAutoAcceptOrders(!autoAcceptOrders)}
                      className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                        autoAcceptOrders ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {autoAcceptOrders ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    อนุมัติออเดอร์และส่งเข้าห้องครัว KDS ทันทีเมื่อสลิปโอนเงินผ่านการตรวจสอบ
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">เสียงแจ้งเตือนออเดอร์ใหม่</span>
                    <button
                      onClick={() => setSoundNotifications(!soundNotifications)}
                      className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                        soundNotifications ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {soundNotifications ? 'เปิดเสียง' : 'ปิดเสียง'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    เล่นเสียงเตือนทางลำโพงเมื่อมีออเดอร์เข้ามาใหม่เพื่อให้แม่ค้าทราบทันที
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">ระยะเวลาประกอบอาหารมาตรฐาน</span>
                    <span className="text-xs font-extrabold text-[#f6402e]">{prepTimeDefault} นาที</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    value={prepTimeDefault}
                    onChange={(e) => setPrepTimeDefault(Number(e.target.value))}
                    className="w-full accent-[#f6402e]"
                  />
                  <p className="text-[11px] text-slate-500">
                    ใช้ในการคำนวณเวลารอคิวประมาณการล่วงหน้าให้ลูกค้า
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MENU & INVENTORY MANAGEMENT / PRICE MANAGEMENT */}
        {activeTab === 'menu_admin' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            
            {/* Price Updated Toast Banner */}
            {toastMsg && (
              <div className="bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0" />
                  <span>{toastMsg}</span>
                </div>
                <button
                  onClick={() => setToastMsg(null)}
                  className="text-white/80 hover:text-white font-black text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>จัดการรายการอาหาร & บริหารราคา (Price Management)</span>
                  <span className="text-[10px] bg-orange-100 text-[#f6402e] font-bold px-2 py-0.5 rounded-full border border-orange-200">
                    อัปเดตเรียลไทม์
                  </span>
                </h3>
                <p className="text-xs text-slate-500">ปรับเปลี่ยนราคาอาหารแบบรายตัว ปรับราคาด่วนยกหมวด เปิด/ปิดสต็อก และเพิ่มเมนูใหม่</p>
              </div>

              <button
                onClick={() => setShowAddItemModal(true)}
                className="px-4 py-2 bg-[#f6402e] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มรายการอาหารใหม่</span>
              </button>
            </div>

            {/* Quick Batch Price Adjustment Tools */}
            <div className="bg-orange-50/60 p-4 rounded-xl border border-orange-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-[#f6402e]" />
                  <span>เครื่องมือปรับราคาด่วนยกหมวด (Batch Price Adjustment)</span>
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  ปรับราคาสำหรับหมวด: <strong className="text-slate-900">{selectedCategory === 'all' ? 'ทุกหมวดหมู่' : selectedCategory}</strong>
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => handleBatchAdjustPrices(5)}
                  className="px-3 py-1.5 bg-white hover:bg-orange-100 text-[#f6402e] border border-orange-300 font-bold rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>+5 บาท ทุกเมนู</span>
                </button>
                <button
                  onClick={() => handleBatchAdjustPrices(-5)}
                  className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>-5 บาท โปรโมชัน</span>
                </button>
                <button
                  onClick={() => handleBatchAdjustPrices(10)}
                  className="px-3 py-1.5 bg-white hover:bg-orange-100 text-[#f6402e] border border-orange-300 font-bold rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>+10 บาท</span>
                </button>
                <button
                  onClick={() => {
                    fetchMenuItemsFromFirestore().then((dbItems) => setLocalMenuItems(dbItems));
                    setToastMsg('รีเซ็ตราคากลับสู่มาตรฐานโรงอาหารเรียบร้อย');
                    setTimeout(() => setToastMsg(null), 2500);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>รีเซ็ตราคามาตรฐาน</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่ออาหาร หรือ รหัสเมนู..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#f6402e]"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="all">หมวดหมู่ทั้งหมด</option>
                <option value="single_dish">อาหารจานเดียว</option>
                <option value="noodle">ก๋วยเตี๋ยว / บะหมี่</option>
                <option value="boba_tea">ชาไข่มุก / เครื่องดื่ม</option>
                <option value="snack">ของทานเล่น</option>
              </select>
            </div>

            {/* Menu Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="p-3">เมนู</th>
                    <th className="p-3">หมวดหมู่</th>
                    <th className="p-3">ราคาขาย (บาท)</th>
                    <th className="p-3">ปรับราคาด่วน</th>
                    <th className="p-3">สต็อกคงเหลือ</th>
                    <th className="p-3">สถานะพร้อมขาย</th>
                    <th className="p-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredMenuItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 flex items-center gap-3">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{item.description}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3 font-extrabold text-slate-900">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs font-bold">฿</span>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleUpdatePrice(item.id, Number(e.target.value))}
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-black text-xs text-[#f6402e] shadow-2xs focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdatePrice(item.id, Math.max(1, item.price - 5))}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded border border-slate-300 cursor-pointer"
                            title="ลดราคา 5 บาท"
                          >
                            -5
                          </button>
                          <button
                            onClick={() => handleUpdatePrice(item.id, Math.max(1, item.price - 1))}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded border border-slate-300 cursor-pointer"
                            title="ลดราคา 1 บาท"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => handleUpdatePrice(item.id, item.price + 1)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded border border-slate-300 cursor-pointer"
                            title="เพิ่มราคา 1 บาท"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleUpdatePrice(item.id, item.price + 5)}
                            className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-[#f6402e] font-bold text-[10px] rounded border border-orange-300 cursor-pointer"
                            title="เพิ่มราคา 5 บาท"
                          >
                            +5
                          </button>
                        </div>
                      </td>
                      <td className="p-3 font-bold text-slate-700">
                        {item.stock} / {item.maxStock} จาน
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleStock(item.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                            item.isAvailable
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {item.isAvailable ? '✓ มีพร้อมขาย' : '✕ ของหมดชั่วคราว'}
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() =>
                            setLocalMenuItems((prev) => prev.filter((i) => i.id !== item.id))
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ORDERS & KDS */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">รายการออเดอร์ & หน้าจอทำอาหาร KDS</h3>
                <p className="text-xs text-slate-500">จัดการสถานะทำอาหารและเตรียมแจกจ่ายตามลำดับคิว</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-orange-100 text-[#f6402e] font-extrabold">
                {orders.length} ออเดอร์ล่าสุด
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-[#f6402e] text-white font-black text-xs">
                        คิว {order.queueNumber}
                      </span>
                      <span className="font-extrabold text-xs text-slate-900">{order.id}</span>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-600">
                      {order.totalAmount} ฿ ({order.paymentStatus})
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-slate-800">ลูกค้า: {order.customerName} ({order.customerPhone})</div>
                    <div className="text-slate-500">เวลานัดรับ: {order.pickupTime} น.</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between font-medium">
                        <span>{it.quantity}x {it.menuItem.name}</span>
                        <span className="font-bold">{it.menuItem.price * it.quantity} ฿</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-bold text-slate-500">สถานะ: {order.queueStatus}</span>
                    <button
                      onClick={() =>
                        setOrders((prev) =>
                          prev.map((o) =>
                            o.id === order.id ? { ...o, queueStatus: 'completed' } : o
                          )
                        )
                      }
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      ทำเสร็จแล้ว
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">ตั้งค่าบัญชีรับเงิน PromptPay & ระบบตรวจสลิป</h3>
              <p className="text-xs text-slate-500">กำหนดเบอร์พร้อมเพย์ ชื่อบัญชี และระบบตรวจสอบสลิปอัตโนมัติ</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 border-r border-slate-200 pr-0 md:pr-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">หมายเลขพร้อมเพย์ (PromptPay ID)</label>
                  <input
                    type="text"
                    value={shopInfo?.promptpayNumber || '081-234-5678'}
                    onChange={(e) => setShopInfo((prev) => prev ? { ...prev, promptpayNumber: e.target.value } : { id: 's1', shopName: 'ร้านค้าสถานศึกษา', promptpayNumber: e.target.value } as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f6402e]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">ชื่อบัญชีผู้รับเงิน</label>
                  <input
                    type="text"
                    value={shopInfo?.ownerName || 'ป้าแดง ใจดี'}
                    onChange={(e) => setShopInfo((prev) => prev ? { ...prev, ownerName: e.target.value } : { id: 's1', shopName: 'ร้านค้าสถานศึกษา', ownerName: e.target.value } as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f6402e]"
                  />
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                  <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <div className="font-bold text-emerald-900">ระบบตรวจสลิป AI Slip Verification</div>
                    <div className="text-emerald-700 text-[11px]">
                      ตรวจสอบสลิปโอนเงิน ยอดเงินตรง ยอดไม่ซ้ำซ้อน ป้องกันสลิปปลอมอัตโนมัติ 100%
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Preview Box */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
                <div className="w-40 h-40 bg-white p-3 rounded-2xl border-2 border-orange-300 shadow-md flex items-center justify-center">
                  <QrCode className="w-32 h-32 text-[#f6402e]" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-slate-900">{shopInfo?.ownerName || 'ป้าแดง ใจดี'}</div>
                  <div className="text-xs text-slate-500 font-mono">PromptPay: {shopInfo?.promptpayNumber || '081-234-5678'}</div>
                </div>
                <span className="text-[10px] bg-orange-100 text-[#f6402e] font-bold px-3 py-1 rounded-full">
                  QR Code พร้อมใช้งานสำหรับแสดงในหน้ารับชำระเงิน
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: STAFF & PERMISSIONS */}
        {activeTab === 'staff' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">พนักงาน & สิทธิ์เข้าถึงระบบ</h3>
                <p className="text-xs text-slate-500">จัดการรายชื่อผู้ช่วย พ่อครัว และแคชเชียร์ในร้าน</p>
              </div>
              <button
                onClick={() => setShowAddStaffModal(true)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>เพิ่มพนักงาน</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="p-3">รหัส</th>
                    <th className="p-3">ชื่อ-นามสกุล</th>
                    <th className="p-3">บทบาทสิทธิ์</th>
                    <th className="p-3">เบอร์ติดต่อ</th>
                    <th className="p-3">สถานะ</th>
                    <th className="p-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {staffList.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-mono font-bold text-slate-500">{st.id}</td>
                      <td className="p-3 font-extrabold text-slate-900">{st.name}</td>
                      <td className="p-3 font-bold text-[#f6402e]">{st.role}</td>
                      <td className="p-3 text-slate-600">{st.phone}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          {st.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            if (window.confirm(`ต้องการลบพนักงาน ${st.name} ออกจากระบบหรือไม่?`)) {
                              setStaffList((prev) => prev.filter((s) => s.id !== st.id));
                              setToastMsg(`ลบพนักงาน ${st.name} เรียบร้อยแล้ว`);
                              setTimeout(() => setToastMsg(null), 2500);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ลบพนักงาน"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: CRM & LOYALTY */}
        {activeTab === 'crm' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">ระบบ CRM & โค้ดคูปองส่วนลด</h3>
                <p className="text-xs text-slate-500">กำหนดอัตราการแจกแต้มและสร้างแคมเปญโปรโมชั่นดึงดูดลูกค้า</p>
              </div>
              <button
                onClick={() => setShowAddCouponModal(true)}
                className="px-3.5 py-1.5 bg-[#f6402e] hover:bg-orange-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>สร้างคูปองส่วนลดใหม่</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-amber-50/50 space-y-2">
                <h4 className="font-extrabold text-xs text-amber-900">กฎการสะสมคะแนน (Earning Points)</h4>
                <p className="text-xs text-slate-600">ซื้อครบทุกๆ 10 บาท ได้รับคะแนนสะสม 1 แต้ม</p>
                <div className="text-[11px] text-amber-700 font-bold">✓ คำนวณแต้มสะสมให้อัตโนมัติทุกคำสั่งซื้อ</div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-blue-50/50 space-y-2">
                <h4 className="font-extrabold text-xs text-blue-900">แคมเปญแลกส่วนลด (Redemption)</h4>
                <p className="text-xs text-slate-600">50 แต้ม = คูปองส่วนลด 5 บาทสำหรับมื้อถัดไป</p>
                <div className="text-[11px] text-blue-700 font-bold">✓ ดึงดูดลูกค้าเดิมกลับมาซื้อซ้ำเป็นประจำ</div>
              </div>
            </div>

            {/* Coupons Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="p-3">รหัสโค้ด</th>
                    <th className="p-3">มูลค่าส่วนลด</th>
                    <th className="p-3">ยอดสั่งซื้อขั้นต่ำ</th>
                    <th className="p-3">สถานะ</th>
                    <th className="p-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {coupons.map((cp) => (
                    <tr key={cp.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-mono font-extrabold text-[#f6402e]">{cp.code}</td>
                      <td className="p-3 font-bold text-emerald-600">ลด ฿{cp.discount}</td>
                      <td className="p-3 text-slate-600">ขั้นต่ำ ฿{cp.minSpend}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          {cp.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setCoupons((prev) => prev.filter((c) => c.id !== cp.id));
                            setToastMsg(`ลบคูปอง ${cp.code} สำเร็จ`);
                            setTimeout(() => setToastMsg(null), 2500);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="ลบคูปอง"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: SYSTEM LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">บันทึกกิจกรรมและความปลอดภัยระบบ</h3>
              <p className="text-xs text-slate-500">ประวัติการปรับปรุงสต็อก แก้ไขราคา และการตรวจสอบสลิป</p>
            </div>

            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-400">{log.time}</span>
                    <span className="font-bold text-slate-800">{log.action}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px]">
                    โดย {log.user}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Add Staff Modal Overlay */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">เพิ่มพนักงานใหม่</h3>
              <button
                onClick={() => setShowAddStaffModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">ชื่อ-นามสกุลพนักงาน *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น นายเอกชัย รักบริการ"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">บทบาทหน้าที่ *</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  <option value="พนักงานแคชเชียร์ (Cashier)">พนักงานแคชเชียร์ (Cashier)</option>
                  <option value="พ่อครัวหลัก (Chef)">พ่อครัวหลัก (Chef)</option>
                  <option value="ผู้ช่วยครัว (Kitchen Assistant)">ผู้ช่วยครัว (Kitchen Assistant)</option>
                  <option value="ผู้จัดการร้าน (Manager)">ผู้จัดการร้าน (Manager)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">เบอร์โทรศัพท์ติดต่อ</label>
                <input
                  type="tel"
                  placeholder="081-000-0000"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl shadow-md transition-all"
                >
                  บันทึกพนักงาน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Coupon Modal Overlay */}
      {showAddCouponModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">สร้างโค้ดคูปองส่วนลดใหม่</h3>
              <button
                onClick={() => setShowAddCouponModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCouponSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">รหัสโค้ดคูปอง (ตัวพิมพ์ใหญ่) *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น PROMO50, LUNCH10"
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700">มูลค่าส่วนลด (บาท) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newCouponDiscount}
                    onChange={(e) => setNewCouponDiscount(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">ยอดสั่งซื้อขั้นต่ำ (บาท) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newCouponMinSpend}
                    onChange={(e) => setNewCouponMinSpend(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCouponModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#f6402e] hover:bg-orange-600 text-white text-xs font-extrabold rounded-xl shadow-md transition-all"
                >
                  สร้างคูปอง
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Item Modal Overlay */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">เพิ่มรายการอาหารใหม่</h3>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewItemSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">ชื่อเมนูอาหาร *</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ข้าวหมูกรอบราดซอส"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700">ราคา (บาท) *</label>
                  <input
                    type="number"
                    required
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">หมวดหมู่ *</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="single_dish">อาหารจานเดียว</option>
                    <option value="noodle">ก๋วยเตี๋ยว</option>
                    <option value="boba_tea">ชาไข่มุก</option>
                    <option value="snack">ของทานเล่น</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">รายละเอียดเมนู</label>
                <textarea
                  rows={2}
                  placeholder="คำอธิบายเพิ่มเติม เช่น ระดับความเผ็ด"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#f6402e] hover:bg-orange-600 text-white text-xs font-extrabold rounded-xl shadow-md transition-all"
                >
                  บันทึกเมนูใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StoreAdminPage;

