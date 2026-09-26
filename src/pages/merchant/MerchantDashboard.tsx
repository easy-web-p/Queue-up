import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { MerchantService } from '../../services/merchantService';
import { QueueStatus } from '../../types';
import {
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  ChefHat,
  Package,
  Layers,
  History,
  FileText,
  RotateCcw,
  ShoppingBag,
  Store as StoreIcon,
  ExternalLink,
  UserCheck,
  CreditCard,
  Sparkles
} from 'lucide-react';

import { MerchantWalletTab } from '../../components/merchant/MerchantWalletTab';

export const MerchantDashboard: React.FC = () => {
  const {
    userStore,
    stores,
    queues,
    foodItems,
    currentUser,
    toggleFoodAvailability,
    updateOrderStatus,
    setCurrentView,
    openStoreDetail,
    openStoreAdmin,
    addToast
  } = useQueue();

  const [activeTab, setActiveTab] = useState<'overview' | 'menu' | 'orders' | 'wallet' | 'audits'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<QueueStatus | 'ALL'>('ALL');

  // User's designated store (Strictly 1 user per 1 store model)
  const currentStore = userStore || 
    (currentUser?.email?.toLowerCase() === 'hi00000087@gmail.com' ? stores.find(s => s.id === 'store-1') : null) || 
    stores.find(s => s.ownerEmail && s.ownerEmail.toLowerCase() === currentUser?.email?.toLowerCase()) || 
    stores.find(s => s.ownerId === currentUser?.id) || 
    stores[0];

  const storeId = currentStore?.id || 'store-1';

  // 1. Fetch Aggregated Metrics from Merchant Data Access Layer
  const metrics = MerchantService.getMerchantOverview(storeId, queues, foodItems);

  // 2. Fetch Filtered Store Orders from DAL
  const storeOrders = MerchantService.getStoreOrders(storeId, queues, orderStatusFilter);

  // 3. Fetch Store Menus from DAL
  const storeFoods = MerchantService.getStoreFoods(storeId, foodItems, selectedCategory);

  // 4. Fetch Audit Records from DAL
  const auditRecords = MerchantService.getAuditLogs(storeId);

  // Categories for menu tab
  const uniqueCategories = Array.from(new Set(foodItems.filter(f => f.storeId === storeId).map(f => f.category)));

  // Batch action: enable all items
  const handleBatchEnableAll = () => {
    const targetIds = storeFoods.map(f => f.id);
    const { audit } = MerchantService.batchUpdateStock(storeId, targetIds, true, foodItems);
    targetIds.forEach(id => {
      const food = foodItems.find(f => f.id === id);
      if (food && !food.isAvailable) {
        toggleFoodAvailability(id);
      }
    });
    addToast('เปิดขายทุกเมนูสำเร็จ', audit.details, 'success');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 pb-20 max-w-7xl mx-auto">
      {/* Sidebar Navigation for Merchant */}
      <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
        {/* Store Profile Card with Verified Owner Info */}
        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col gap-3.5 transition-colors">
          <div className="flex items-center gap-3">
            <img
              src={currentStore?.logo}
              alt={currentStore?.name}
              className="w-12 h-12 rounded-2xl object-cover border border-stone-200 dark:border-zinc-700 shrink-0 shadow-xs"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100 truncate">
                {currentStore?.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  ร้านค้าของคุณ (เข้างานแล้ว)
                </span>
              </div>
            </div>
          </div>

          {/* Connected Owner Status */}
          <div className="p-2.5 rounded-2xl bg-orange-50/80 dark:bg-zinc-950/60 border border-orange-100 dark:border-zinc-800 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-stone-700 dark:text-zinc-300">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <strong>ผู้ดูแลร้าน:</strong>
              </span>
              <span className="font-semibold text-stone-900 dark:text-zinc-100 truncate max-w-[120px]">
                {currentUser?.fullName || currentStore?.ownerName || 'ธนากร สุขเกษม'}
              </span>
            </div>
            <div className="flex items-center justify-between text-stone-500 dark:text-zinc-400 font-mono text-[10px]">
              <span>ID: {currentUser?.id || currentStore?.ownerId || 'USR-89241'}</span>
              <span>สาขา: {currentStore?.id}</span>
            </div>
            {currentStore?.promptPayNumber && (
              <div className="flex items-center justify-between text-stone-600 dark:text-zinc-400 pt-1 border-t border-orange-200/40 dark:border-zinc-800/80">
                <span className="flex items-center gap-1 text-[10px]">
                  <CreditCard className="w-3 h-3 text-emerald-600" /> พร้อมเพย์:
                </span>
                <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">
                  {currentStore.promptPayNumber}
                </span>
              </div>
            )}
          </div>

          {/* Direct Store Links */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-100 dark:border-zinc-800/80 text-xs">
            <button
              onClick={() => openStoreAdmin(currentStore?.id)}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-200 transition-colors cursor-pointer border border-stone-200/80 dark:border-zinc-700 font-semibold"
              title="ไปหน้าตั้งค่าร้านค้า"
            >
              <StoreIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>ตั้งค่าร้าน</span>
            </button>
            <button
              onClick={() => openStoreDetail(currentStore?.id || 'store-1')}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-200 transition-colors cursor-pointer border border-stone-200/80 dark:border-zinc-700 font-semibold"
              title="ดูหน้าร้านมุมมองลูกค้า"
            >
              <ExternalLink className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>ดูหน้าร้าน</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="p-2 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col gap-1 transition-colors">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            ภาพรวม & สถิติ (Overview)
          </button>

          <button
            onClick={() => setCurrentView('kds')}
            className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-stone-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-zinc-800 hover:text-orange-600 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ChefHat className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
              <span>จอครัว KDS (Kanban)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 font-bold border border-orange-200 dark:border-orange-800">
              {metrics.pendingCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Package className="w-4 h-4" />
              <span>จัดการเมนู & สต็อก</span>
            </div>
            {metrics.outOfStockCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800">
                หมด {metrics.outOfStockCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-4 h-4" />
              <span>รายการออเดอร์ทั้งหมด</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
              {metrics.todayOrderCount} คิว
            </span>
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'wallet'
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4 h-4" />
              <span>กระเป๋าเงินร้าน (Wallet)</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              พร้อมเพย์
            </span>
          </button>

          <button
            onClick={() => setActiveTab('audits')}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'audits'
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-zinc-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>ประวัติการทำรายการ (Audit)</span>
          </button>
        </div>

        {/* Quick Service Status Indicator */}
        <div className="p-4 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm text-xs space-y-2.5 transition-colors">
          <div className="flex items-center justify-between text-stone-600 dark:text-zinc-400">
            <span>ความเร็วเฉลี่ย</span>
            <span className="font-bold text-orange-600 dark:text-orange-400">~{currentStore?.averageWaitMinutes || 10} นาที</span>
          </div>
          <div className="flex items-center justify-between text-stone-600 dark:text-zinc-400">
            <span>อัตราความสำเร็จ</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{metrics.completionRate}%</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col gap-6 min-w-0">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            {/* 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="ยอดขายวันนี้ (Revenue)"
                value={`฿${metrics.totalRevenue.toLocaleString()}`}
                change="+18.4%"
                isPositive={true}
                subtitle="ยอดรับชำระสุทธิ"
                icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
              />
              <StatCard
                title="ออเดอร์ทั้งหมดวันนี้"
                value={metrics.todayOrderCount}
                change={`เฉลี่ย ฿${metrics.averageTicketSize}/บิล`}
                isPositive={true}
                subtitle="ออกคิวเรียบร้อย"
                icon={<Layers className="w-5 h-5 text-orange-500" />}
              />
              <StatCard
                title="กำลังปรุง / รอดำเนินการ"
                value={metrics.pendingCount}
                change="ในระบบ KDS"
                isPositive={true}
                subtitle="คิวปัจจุบันในร้าน"
                icon={<Clock className="w-5 h-5 text-sky-500" />}
              />
              <StatCard
                title="ออเดอร์สำเร็จ"
                value={metrics.completedCount}
                change={`${metrics.completionRate}%`}
                isPositive={true}
                subtitle="อัตราการส่งมอบ"
                icon={<CheckCircle2 className="w-5 h-5 text-purple-500" />}
              />
            </div>

            {/* Live Queue Orders Table Preview */}
            <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
              <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    รายการคิวล่าสุด (Real-time Queue Monitor)
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                    เชื่อมต่อฐานข้อมูลร้านค้า <strong>{currentStore?.name}</strong> แบบเรียลไทม์
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('orders')}
                    className="text-xs"
                  >
                    ดูคิวทั้งหมด
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setCurrentView('kds')}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    เปิดจอครัว KDS
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700 dark:text-zinc-300">
                  <thead className="bg-stone-50/80 dark:bg-zinc-950/60 text-stone-600 dark:text-zinc-400 font-bold border-b border-stone-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-3 px-4">หมายเลขคิว</th>
                      <th className="py-3 px-4">ลูกค้า</th>
                      <th className="py-3 px-4">รายการอาหาร</th>
                      <th className="py-3 px-4">ยอดเงิน</th>
                      <th className="py-3 px-4">สถานะคิว</th>
                      <th className="py-3 px-4">เวลารับ</th>
                      <th className="py-3 px-4 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                    {storeOrders.slice(0, 5).map(q => (
                      <tr key={q.id} className="hover:bg-stone-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-black text-orange-600 dark:text-orange-400 text-sm">
                            {q.queueNumber}
                          </div>
                          {q.exchangePin && (
                            <div className="text-[10px] text-stone-500 dark:text-zinc-400 font-mono">
                              PIN: #{q.exchangePin}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-stone-900 dark:text-zinc-100">{q.customerName}</div>
                          <div className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">{q.customerPhone}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="line-clamp-1 font-medium text-stone-800 dark:text-zinc-200">
                            {q.items.map(i => `${i.quantity}x ${i.food.name}`).join(', ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                          ฿{q.total}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={q.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 text-stone-500 dark:text-zinc-400">
                          {q.pickupTime}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {q.status === 'PREPARING' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateOrderStatus(q.id, 'READY')}
                              className="text-[10px] py-1 px-2.5 h-7"
                            >
                              พร้อมรับ
                            </Button>
                          )}
                          {q.status === 'READY' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => updateOrderStatus(q.id, 'COMPLETED')}
                              className="text-[10px] py-1 px-2.5 h-7"
                            >
                              ส่งมอบแล้ว
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {storeOrders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-stone-400 dark:text-zinc-500 font-medium">
                          ยังไม่มีรายการคิวสำหรับร้านนี้ในขณะนี้
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: MENU & STOCK MANAGEMENT */}
        {activeTab === 'menu' && (
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
            <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  จัดการรายการอาหาร & สถานะสต็อก (Menu & Inventory)
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  คลิกเพื่อเปิด/ปิดการจำหน่ายทันที ระบบจะอัปเดตแบบเรียลไทม์ไปยังหน้าลูกค้าและระบบ KDS
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBatchEnableAll}
                  className="text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  เปิดจำหน่ายทั้งหมด
                </Button>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="px-5 py-3 bg-stone-50/60 dark:bg-zinc-950/40 border-b border-stone-200 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-orange-500 text-white'
                    : 'text-stone-600 hover:text-stone-900 bg-white border border-stone-200 dark:text-zinc-400 dark:hover:text-zinc-200 dark:bg-zinc-800 dark:border-zinc-700'
                }`}
              >
                ทั้งหมด ({foodItems.filter(f => f.storeId === storeId).length})
              </button>
              {uniqueCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-orange-500 text-white'
                      : 'text-stone-600 hover:text-stone-900 bg-white border border-stone-200 dark:text-zinc-400 dark:hover:text-zinc-200 dark:bg-zinc-800 dark:border-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu List */}
            <div className="divide-y divide-stone-100 dark:divide-zinc-800">
              {storeFoods.map(food => (
                <div
                  key={food.id}
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-stone-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={food.image}
                      alt={food.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-stone-200 dark:border-zinc-700 shrink-0"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100">{food.name}</h4>
                      <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">{food.nameEn}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          ฿{food.price}
                        </span>
                        <span className="text-[10px] text-stone-400 dark:text-zinc-500">
                          • ยอดสั่ง {food.orderCount} จาน
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        food.isAvailable
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                      }`}
                    >
                      {food.isAvailable ? 'พร้อมจำหน่าย' : 'หมดชั่วคราว'}
                    </span>

                    <Button
                      size="sm"
                      variant={food.isAvailable ? 'outline' : 'primary'}
                      onClick={() => toggleFoodAvailability(food.id)}
                      className="text-xs"
                    >
                      {food.isAvailable ? 'ปิดการขาย (ของหมด)' : 'เปิดขายตามปกติ'}
                    </Button>
                  </div>
                </div>
              ))}
              {storeFoods.length === 0 && (
                <div className="p-12 text-center text-stone-400 dark:text-zinc-500 text-sm font-medium">
                  ไม่พบเมนูในหมวดหมู่นี้
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ALL ORDERS VIEW */}
        {activeTab === 'orders' && (
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
            <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  รายการคำสั่งซื้อและคิวทั้งหมด (All Orders)
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  คัดกรองตามสถานะคิวและการจัดส่ง
                </p>
              </div>

              {/* Status Filter buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['ALL', 'PAYMENT_PENDING', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setOrderStatusFilter(status)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      orderStatusFilter === status
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-300'
                    }`}
                  >
                    {status === 'ALL' ? 'ทั้งหมด' : status}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700 dark:text-zinc-300">
                <thead className="bg-stone-50/80 dark:bg-zinc-950/60 text-stone-600 dark:text-zinc-400 font-bold border-b border-stone-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">คิว</th>
                    <th className="py-3 px-4">ลูกค้า & เบอร์ติดต่อ</th>
                    <th className="py-3 px-4">รายการ</th>
                    <th className="py-3 px-4">ยอดเงิน</th>
                    <th className="py-3 px-4">การชำระเงิน</th>
                    <th className="py-3 px-4">สถานะคิว</th>
                    <th className="py-3 px-4 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                  {storeOrders.map(q => (
                    <tr key={q.id} className="hover:bg-stone-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-black text-orange-600 dark:text-orange-400 text-sm">
                          {q.queueNumber}
                        </div>
                        {q.exchangePin && (
                          <div className="text-[10px] text-stone-500 dark:text-zinc-400 font-mono">
                            PIN: #{q.exchangePin}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-stone-900 dark:text-zinc-100">{q.customerName}</div>
                        <div className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono">{q.customerPhone}</div>
                      </td>
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="truncate font-medium text-stone-800 dark:text-zinc-200">
                          {q.items.map(i => `${i.quantity}x ${i.food.name}`).join(', ')}
                        </div>
                        {q.specialNote && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 truncate">
                            โน้ต: {q.specialNote}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                        ฿{q.total}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          q.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                        }`}>
                          {q.paymentStatus === 'PAID' ? 'ชำระแล้ว' : 'รอชำระ'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={q.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        {q.status === 'PREPARING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateOrderStatus(q.id, 'READY')}
                            className="text-[10px] py-1 px-2.5 h-7"
                          >
                            ปรุงเสร็จ
                          </Button>
                        )}
                        {q.status === 'READY' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => updateOrderStatus(q.id, 'COMPLETED')}
                            className="text-[10px] py-1 px-2.5 h-7"
                          >
                            ส่งมอบ
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {storeOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400 dark:text-zinc-500 font-medium">
                        ไม่พบรายการตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: MERCHANT WALLET & FINANCIAL LEDGER */}
        {activeTab === 'wallet' && (
          <MerchantWalletTab
            storeId={storeId}
            storeName={currentStore?.name || 'ร้านค้า QueueUp'}
            addToast={addToast}
          />
        )}

        {/* TAB 5: AUDIT LEDGER VIEW */}
        {activeTab === 'audits' && (
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
            <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-zinc-800">
              <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                ประวัติการทำรายการร้านค้า (Store Audit Ledger)
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                บันทึกการกระทำสำคัญ เช่น การเปิด-ปิดสต็อก การปรับเปลี่ยนสถานะคิว เพื่อความโปร่งใสและตรวจสอบย้อนหลังได้
              </p>
            </div>

            <div className="divide-y divide-stone-100 dark:divide-zinc-800">
              {auditRecords.map(log => (
                <div key={log.id} className="p-4 flex items-start justify-between gap-4 hover:bg-stone-50/70 dark:hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-orange-600 dark:text-orange-400">
                      {log.action === 'STOCK_TOGGLE' ? (
                        <Package className="w-4 h-4" />
                      ) : (
                        <History className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-900 dark:text-zinc-100">{log.details}</div>
                      <div className="text-[10px] text-stone-500 dark:text-zinc-400 mt-0.5">
                        ผู้ดำเนินการ: <span className="text-stone-800 dark:text-zinc-200 font-semibold">{log.actor}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-stone-400 dark:text-zinc-500 block">
                      {new Date(log.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 font-mono">
                      {log.action}
                    </span>
                  </div>
                </div>
              ))}
              {auditRecords.length === 0 && (
                <div className="p-12 text-center text-stone-400 dark:text-zinc-500 text-xs font-medium">
                  ยังไม่มีประวัติการบันทึกรายการสำหรับร้านค้านี้
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
