import React from 'react';
import { useQueue } from '../../context/QueueContext';
import { CATEGORIES } from '../../data/mockData';
import { FoodCard } from '../../components/food/FoodCard';
import { StoreCard } from '../../components/food/StoreCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { UserLocationBar } from '../../components/location/UserLocationBar';
import {
  Sparkles,
  Ticket,
  ChevronRight,
  TrendingUp,
  Flame,
  CheckCircle2,
  Store as StoreIcon,
  School as SchoolIcon
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const {
    stores,
    foodItems,
    setActiveFoodModal,
    setActiveStoreId,
    setCurrentView,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    userActiveQueue,
    setActiveQueueId,
    currentUser
  } = useQueue();

  const activeQueue = userActiveQueue;

  // Multi-tenant School Isolation: filter stores and food items if user belongs to a school
  const visibleStores = React.useMemo(() => {
    if (!currentUser?.schoolId) return stores;
    const schoolMatches = stores.filter(s => s.schoolId === currentUser.schoolId);
    return schoolMatches.length > 0 ? schoolMatches : stores;
  }, [stores, currentUser?.schoolId]);

  const visibleStoreIds = React.useMemo(() => new Set(visibleStores.map(s => s.id)), [visibleStores]);

  const filteredFoods = foodItems.filter(item => {
    if (currentUser?.schoolId && !visibleStoreIds.has(item.storeId)) return false;
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* 1. Hero Promo & Fast Search Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-red-500 dark:from-zinc-950 dark:via-black dark:to-zinc-950 border border-orange-300/40 dark:border-zinc-800 p-6 sm:p-10 shadow-xl text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-white/10 dark:bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-amber-300/20 dark:bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl flex flex-col gap-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold w-fit dark:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-400">
            <Sparkles className="w-3.5 h-3.5" />
            ระบบจองคิว & สั่งอาหารล่วงหน้าแบบเรียลไทม์
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            คิวไม่สะดุด อร่อยได้ทันใจ <br className="hidden sm:inline" />
            <span className="text-amber-200 dark:text-orange-400">
              รับบัตรคิว & สั่งถึงมือแม่ครัว
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-white/90 dark:text-zinc-400 max-w-lg leading-relaxed">
            หมดปัญหาการยืนรอคิวนานกลางแดด เช็คสถานะคิวสดแบบเรียลไทม์ผ่านมือถือ พร้อมระบบแจ้งเตือนทันทีเมื่ออาหารพร้อมเสิร์ฟ
          </p>

          <div className="mt-2 w-full max-w-xl">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={() => setCurrentView('search')}
              onTagSelect={() => setCurrentView('search')}
            />
          </div>
        </div>
      </div>

      {/* 2. Active Queue Ticket Quick-View Card (If Active Queue Exists) */}
      {activeQueue && (
        <div className="relative rounded-2xl bg-orange-50/80 border border-amber-300/80 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 dark:bg-zinc-950 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex flex-col items-center justify-center text-amber-900 font-mono font-black shrink-0 dark:bg-zinc-900 dark:border-zinc-700 dark:text-amber-400">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 tracking-wider">QUEUE</span>
              <span className="text-xl tracking-tight leading-none">{activeQueue.queueNumber}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white">
                  {activeQueue.storeName}
                </h4>
                <StatusBadge status={activeQueue.status} size="sm" />
              </div>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 flex flex-wrap items-center gap-2">
                <span>{activeQueue.items.length} รายการ</span>
                <span>•</span>
                <span>เวลารับประมาณ {activeQueue.estimatedCompletionTime} น.</span>
                {activeQueue.exchangePin && (
                  <>
                    <span>•</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded text-[11px]">
                      PIN: #{activeQueue.exchangePin}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setActiveQueueId(activeQueue.id);
              setCurrentView('queue-tracking');
            }}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            ดูบัตรคิว & สถานะสด
          </Button>
        </div>
      )}

      {/* 3. Category Filter Chips */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            หมวดหมู่อาหาร
          </h3>
          <span className="text-xs text-stone-400 dark:text-zinc-500">เลือกประเภทที่ต้องการ</span>
        </div>
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map(category => {
            const isSelected = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-md shadow-orange-500/20'
                    : 'bg-white hover:bg-orange-50 text-stone-700 border-orange-200/80 dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800'
                }`}
              >
                <span>{category.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {category.itemCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Popular & Recommended Food Items Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 rounded-full bg-gradient-to-b from-orange-500 to-red-500" />
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              เมนูยอดนิยม & จานเด็ดแนะนำ
            </h2>
          </div>
          <button
            onClick={() => setCurrentView('search')}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 flex items-center gap-1 cursor-pointer"
          >
            ดูทั้งหมด <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredFoods.slice(0, 4).map(food => (
            <FoodCard
              key={food.id}
              food={food}
              onSelect={setActiveFoodModal}
              onQuickAdd={setActiveFoodModal}
            />
          ))}
        </div>
      </div>

      {/* 5. Featured Stores */}
      <div className="flex flex-col gap-4 pt-4 border-t border-orange-100 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 rounded-full bg-gradient-to-b from-amber-500 to-orange-500" />
            <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <span>{currentUser?.schoolName ? `ร้านอาหารใน ${currentUser.schoolName}` : 'ร้านอาหารยอดฮิตประจำย่าน'}</span>
            </h2>
            {currentUser?.schoolId && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30">
                <SchoolIcon className="w-3 h-3" />
                {currentUser.schoolId}
              </span>
            )}
          </div>
          <UserLocationBar />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {visibleStores.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              onSelect={s => {
                setActiveStoreId(s.id);
                setCurrentView('store-detail');
              }}
            />
          ))}
        </div>
      </div>

      {/* 6. Benefits / How QueueUp Works */}
      <div className="p-6 rounded-3xl bg-white border border-orange-200/80 dark:bg-zinc-950 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-6 text-center sm:text-left shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-600 shrink-0 dark:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-400">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-white">1. กดรับบัตรคิวออนไลน์</h4>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">
              เลือกเมนูและรับหมายเลขคิวผ่านเว็บ ไม่ต้องไปยืนรอหรือเบียดเสียดหน้าร้าน
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 shrink-0 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-white">2. ติดตามคิวสด</h4>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">
              เห็นทุกขั้นตอน ตั้งแต่แม่ครัวเริ่มรับออเดอร์ ปรุง จนถึงพร้อมเสิร์ฟ
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-300 flex items-center justify-center text-red-600 shrink-0 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-white">3. รับอาหารร้อนๆ ทันที</h4>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">
              รับแจ้งเตือนผ่านเสียงและข้อความ พร้อมไปรับอาหารที่จุดรับได้ทันที
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
