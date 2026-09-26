import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import { FoodCard } from '../../components/food/FoodCard';
import { StoreCard } from '../../components/food/StoreCard';
import { CreatorVideoReview, ReviewItem, Store } from '../../types';
import {
  Star,
  MapPin,
  Clock,
  Users,
  ArrowLeft,
  Sparkles,
  Share2,
  Heart,
  Navigation,
  Compass,
  CheckCircle2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  ThumbsUp,
  ShieldCheck,
  Search,
  ChevronRight,
  ExternalLink,
  Flame,
  Utensils,
  MessageSquare,
  Phone,
  FileText,
  Key,
  ShieldAlert,
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const StoreDetailPage: React.FC = () => {
  const {
    activeStore: contextStore,
    stores,
    foodItems,
    setActiveFoodModal,
    openStoreDetail,
    setCurrentView,
    addToast,
    isStoreFollowed,
    toggleFollowStore,
    openStoreContactAndTerms,
    openStoreChat,
    openChatPage
  } = useQueue();

  const { storeId } = useParams<{ storeId?: string }>();
  const activeStore = (storeId ? stores.find(s => s.id === storeId) : null) || contextStore || stores[0] || null;

  useEffect(() => {
    if (storeId && (!contextStore || contextStore.id !== storeId)) {
      if (stores.some(s => s.id === storeId)) {
        openStoreDetail(storeId);
      }
    }
  }, [storeId, stores, contextStore, openStoreDetail]);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'menu' | 'location' | 'reviews' | 'videos' | 'contact-terms'>('menu');
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [selectedVideoModal, setSelectedVideoModal] = useState<CreatorVideoReview | null>(null);
  const [isVideoModalPlaying, setIsVideoModalPlaying] = useState<boolean>(true);
  const [isVideoModalMuted, setIsVideoModalMuted] = useState<boolean>(false);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);

  // Review submission state
  const [newReviewComment, setNewReviewComment] = useState<string>('');
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [reviewsList, setReviewsList] = useState<ReviewItem[]>(activeStore?.reviews || []);

  useEffect(() => {
    setReviewsList(activeStore?.reviews || []);
    setMenuSearch('');
  }, [activeStore?.id]);

  if (!activeStore) {
    return (
      <div className="p-12 text-center text-stone-500 dark:text-zinc-400">
        <p className="mb-4">ไม่พบข้อมูลร้านค้าที่ระบุ</p>
        <Button onClick={() => setCurrentView('home')}>กลับสู่หน้าหลัก</Button>
      </div>
    );
  }

  const storeFoods = foodItems.filter(f => f.storeId === activeStore.id);
  const filteredFoods = storeFoods.filter(f =>
    f.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
    f.description.toLowerCase().includes(menuSearch.toLowerCase()) ||
    (f.tags && f.tags.some(t => t.toLowerCase().includes(menuSearch.toLowerCase())))
  );

  const followed = isStoreFollowed(activeStore.id);

  // Find similar stores based on similarStoreIds or category
  const similarStores = stores.filter(s => {
    if (s.id === activeStore.id) return false;
    if (activeStore.similarStoreIds && activeStore.similarStoreIds.includes(s.id)) return true;
    return s.category === activeStore.category;
  }).slice(0, 3);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: activeStore.name,
        text: activeStore.description,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      addToast('คัดลอกลิงก์ร้านแล้ว', 'แชร์ให้เพื่อนเพื่อสั่งพร้อมกันได้เลย', 'info');
    }
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewComment.trim()) return;

    const newRev: ReviewItem = {
      id: `store-rev-${Date.now()}`,
      authorName: 'คุณ (ผู้ใช้)',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      rating: newReviewRating,
      date: 'เมื่อสักครู่',
      comment: newReviewComment,
      likes: 0,
      isVerifiedBuyer: true
    };

    setReviewsList([newRev, ...reviewsList]);
    setNewReviewComment('');
    addToast('ขอบคุณสำหรับรีวิว', 'ความคิดเห็นของคุณถูกเผยแพร่แล้ว', 'success');
  };

  const openGoogleMaps = () => {
    const lat = activeStore.coordinates?.lat || 13.7563;
    const lng = activeStore.coordinates?.lng || 100.5018;
    const url = activeStore.coordinates?.googleMapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeStore.name + ' ' + activeStore.address)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-6 pb-24 text-stone-900 dark:text-zinc-100 max-w-6xl mx-auto w-full">
      {/* Top Navigation Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => setCurrentView('home')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-xs font-bold text-stone-700 dark:text-zinc-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> ย้อนกลับหน้าแรก
        </button>

        {/* Store ID Tag */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-stone-500 dark:text-zinc-400 font-mono text-xs">
            ID: #{activeStore.id}
          </span>
          <button
            onClick={handleShare}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-400 transition-colors cursor-pointer"
            title="แชร์ร้านนี้"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Store Header Hero Card */}
      <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-zinc-950 border border-orange-200/90 dark:border-zinc-800 shadow-xl">
        {/* Cover Photo */}
        <div className="relative h-48 sm:h-72 w-full bg-stone-100 dark:bg-black overflow-hidden">
          <img
            src={activeStore.coverImage || activeStore.image}
            alt={activeStore.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          {/* Action buttons on cover */}
          <div className="absolute top-4 right-4 flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => openStoreChat(activeStore)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur-md bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all cursor-pointer font-bold text-xs shadow-xs"
              title="เปิดห้องแชทสนทนากับร้านนี้โดยตรง"
            >
              <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
              <span>แชทติดต่อร้าน</span>
            </button>

            <button
              onClick={() => openStoreContactAndTerms(activeStore, 'terms')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl backdrop-blur-md bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all cursor-pointer font-bold text-xs shadow-xs"
              title="ดูเงื่อนไขการแลกเปลี่ยนในมุมมองของร้านค้านี้"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>เงื่อนไขร้านค้า</span>
            </button>

            <button
              onClick={() => toggleFollowStore(activeStore.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl backdrop-blur-md transition-all cursor-pointer font-bold text-xs ${
                followed
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'bg-black/60 hover:bg-black/80 text-white border border-white/20'
              }`}
              title={followed ? 'เลิกติดตามร้านนี้' : 'ติดตามร้านนี้เพื่อรับแจ้งเตือนเมนูใหม่ & คูปอง'}
            >
              <Heart className={`w-4 h-4 ${followed ? 'fill-white text-white' : ''}`} />
              <span>{followed ? 'ติดตามแล้ว' : 'ติดตามร้าน'}</span>
            </button>
          </div>
        </div>

        {/* Store Profile Info & Queue Banner */}
        <div className="p-6 sm:p-8 -mt-14 relative z-10 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-5">
            <img
              src={activeStore.logo}
              alt={activeStore.name}
              className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl object-cover border-4 border-white dark:border-zinc-900 shadow-2xl shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${
                  activeStore.isOpen
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                    : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400 border-red-300 dark:border-red-500/30'
                }`}>
                  {activeStore.isOpen ? 'เปิดรับออเดอร์' : 'ปิดชั่วคราว'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 text-xs font-bold">
                  {activeStore.category}
                </span>
                <span className="text-xs text-stone-500 dark:text-zinc-400 font-bold">
                  ระดับราคา: {activeStore.priceRange}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white mt-1.5">
                {activeStore.name}
              </h1>
              <p className="text-xs text-stone-400 dark:text-zinc-500 font-medium">
                {activeStore.nameEn}
              </p>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-300 mt-1 max-w-xl leading-relaxed">
                {activeStore.description}
              </p>

              {/* Rating & Location snippet */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-xs text-stone-600 dark:text-zinc-300">
                <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {activeStore.rating} ({activeStore.reviewCount} รีวิว)
                </span>
                <span className="flex items-center gap-1 text-stone-600 dark:text-zinc-400">
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                  {activeStore.distanceKm} กม. • {activeStore.address}
                </span>
              </div>
            </div>
          </div>

          {/* Live Queue Indicator Card */}
          <div className="w-full lg:w-auto p-4 sm:p-5 rounded-2xl bg-orange-50/90 border border-orange-200/90 dark:bg-zinc-900 dark:border-zinc-800 flex items-center justify-between sm:justify-start gap-6 shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">
                  คิวกำลังรอ
                </div>
                <div className="text-xl font-black text-orange-600 dark:text-orange-400 leading-tight">
                  {activeStore.currentQueueCount} คิว
                </div>
              </div>
            </div>

            <div className="border-l border-orange-200 dark:border-zinc-800 pl-5">
              <div className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 uppercase tracking-wider">
                เวลารอประมาณ
              </div>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400 leading-tight">
                ~{activeStore.averageWaitMinutes} นาที
              </div>
            </div>
          </div>
        </div>

        {/* Profile Tabs Navigation */}
        <div className="flex items-center gap-2 px-6 border-t border-stone-100 dark:border-zinc-800/80 overflow-x-auto">
          {[
            { id: 'menu', label: `รายการเมนู (${storeFoods.length})`, icon: Utensils },
            { id: 'contact-terms', label: 'ติดต่อ & เงื่อนไขแลกเปลี่ยน', icon: FileText },
            { id: 'location', label: 'ตำแหน่งร้าน & แผนที่', icon: MapPin },
            { id: 'reviews', label: `รีวิวลูกค้า (${reviewsList.length})`, icon: Star },
            { id: 'videos', label: `คลิปรีวิวครีเอเตอร์ (${activeStore.creatorReviews?.length || 0})`, icon: Play }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                    : 'border-transparent text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Food Menus */}
      {activeTab === 'menu' && (
        <div className="flex flex-col gap-6">
          {/* Menu Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                placeholder="ค้นหาเมนูในร้านนี้..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="text-xs text-stone-500 dark:text-zinc-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>กดปุ่มเพลย์เพื่อดูวิดีโอ & ข้อมูลสั่งจองของแต่ละเมนู</span>
            </div>
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredFoods.map(food => (
              <FoodCard
                key={food.id}
                food={food}
                onSelect={setActiveFoodModal}
                onQuickAdd={setActiveFoodModal}
              />
            ))}
          </div>

          {filteredFoods.length === 0 && (
            <div className="text-center py-12 text-stone-400 dark:text-zinc-500 text-sm">
              ไม่พบเมนูที่ค้นหาในร้านนี้
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Store Location & Where It Is (ตำแหน่งร้าน ร้านอยู่ไหน) */}
      {activeTab === 'location' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Location Details (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold text-sm">
                  <MapPin className="w-5 h-5" />
                  <span>ตำแหน่งที่ตั้ง & การเดินทาง</span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    ที่อยู่ร้าน
                  </h4>
                  <p className="text-sm font-semibold text-stone-900 dark:text-white mt-1 leading-relaxed">
                    {activeStore.addressDetail || activeStore.address}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 dark:border-zinc-800/80">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    จุดสังเกตเด่น (Landmark)
                  </h4>
                  <p className="text-xs font-medium text-stone-700 dark:text-zinc-300 mt-1 leading-relaxed">
                    {activeStore.landmark || 'ตั้งอยู่ใจกลางย่านชุมชน เข้าถึงได้สะดวก'}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 dark:border-zinc-800/80">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    สถานีรถไฟฟ้า / การเดินทางสาธารณะ
                  </h4>
                  <p className="text-xs font-medium text-stone-700 dark:text-zinc-300 mt-1 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-orange-500" />
                    {activeStore.nearestStation || 'ใกล้สถานีรถไฟฟ้าสายหลัก'}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 dark:border-zinc-800/80">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    เวลาเปิด - ปิดทำการ
                  </h4>
                  <p className="text-xs font-medium text-stone-700 dark:text-zinc-300 mt-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    {activeStore.openingHours || 'เปิดบริการทุกวัน 09:00 - 20:30 น.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 dark:border-zinc-800/80">
                  <Button
                    size="md"
                    variant="primary"
                    onClick={openGoogleMaps}
                    className="w-full justify-center text-xs font-bold py-3"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    เปิดนำทางบน Google Maps
                  </Button>
                </div>
              </div>
            </div>

            {/* Interactive Map Visualizer (7 cols) */}
            <div className="lg:col-span-7">
              <div className="relative rounded-3xl overflow-hidden bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 shadow-sm h-96 lg:h-full min-h-[380px] flex flex-col justify-between p-6">
                {/* Simulated Stylized Map Graphic */}
                <div className="absolute inset-0 opacity-40 dark:opacity-20 pointer-events-none bg-[radial-gradient(#f97316_1px,transparent_1px)] [background-size:16px_16px]" />

                {/* Map Top Bar */}
                <div className="relative z-10 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-black/90 backdrop-blur-md text-xs font-bold text-stone-800 dark:text-zinc-200 shadow-sm border border-stone-200 dark:border-zinc-800">
                    <Compass className="w-4 h-4 text-orange-500 animate-spin" style={{ animationDuration: '8s' }} />
                    พิกัด GPS: {activeStore.coordinates?.lat || 13.75}, {activeStore.coordinates?.lng || 100.50}
                  </span>

                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500 text-white text-xs font-bold shadow-md">
                    ห่างจากคุณ {activeStore.distanceKm} กม.
                  </span>
                </div>

                {/* Map Center Pin */}
                <div className="relative z-10 flex flex-col items-center justify-center my-auto">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-orange-500/20 animate-ping absolute" />
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-xl shadow-orange-600/40 flex items-center justify-center border-2 border-white dark:border-zinc-900">
                      <MapPin className="w-6 h-6 fill-white" />
                    </div>
                  </div>

                  <div className="mt-3 px-4 py-2 rounded-2xl bg-white/95 dark:bg-black/95 backdrop-blur-md border border-orange-200 dark:border-zinc-800 shadow-lg text-center max-w-xs">
                    <h5 className="text-xs font-bold text-stone-900 dark:text-white line-clamp-1">
                      {activeStore.name}
                    </h5>
                    <p className="text-[10px] text-stone-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                      {activeStore.landmark || activeStore.address}
                    </p>
                  </div>
                </div>

                {/* Map Bottom Hint */}
                <div className="relative z-10 flex items-center justify-between bg-white/80 dark:bg-black/80 backdrop-blur-md p-3 rounded-2xl border border-stone-200 dark:border-zinc-800 text-xs text-stone-600 dark:text-zinc-400">
                  <span>รองรับการเดินทางด้วยรถยนต์, รถจักรยานยนต์ และ BTS/MRT</span>
                  <button
                    onClick={openGoogleMaps}
                    className="font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ดูพิกัดเต็ม <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Customer Reviews (ผู้ใช้รีวิวว่ายังไงบ้าง) */}
      {activeTab === 'reviews' && (
        <div className="flex flex-col gap-6">
          {/* Review Stats Header */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex flex-col items-center justify-center font-black shadow-lg shadow-orange-500/20 shrink-0">
                <span className="text-3xl leading-none">{activeStore.rating}</span>
                <span className="text-[10px] opacity-90">เต็ม 5.0</span>
              </div>
              <div>
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white mt-1">
                  คะแนนความประทับใจจากลูกค้าจริง
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  รวบรวมจากผู้ใช้ที่กดรับบัตรคิวและสั่งอาหารผ่าน QueueUp จำนวน {activeStore.reviewCount} ครั้ง
                </p>
              </div>
            </div>

            <span className="px-3.5 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 text-xs font-bold">
              ความพึงพอใจ 98.4%
            </span>
          </div>

          {/* Review submission form */}
          <form onSubmit={handleAddReview} className="p-5 rounded-3xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 dark:text-zinc-200">
                ให้คะแนนและเขียนรีวิวร้าน {activeStore.name}:
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewReviewRating(star)}
                    className="p-1 text-amber-400 hover:scale-120 transition-transform cursor-pointer"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        star <= newReviewRating ? 'fill-amber-400 text-amber-400' : 'text-stone-300 dark:text-zinc-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newReviewComment}
                onChange={e => setNewReviewComment(e.target.value)}
                placeholder="เขียนความประทับใจเกี่ยวกับรสชาติ ความเร็ว และการบริการ..."
                className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <Button size="md" variant="primary" type="submit">
                ส่งความคิดเห็น
              </Button>
            </div>
          </form>

          {/* Customer Reviews List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewsList.map(rev => (
              <div
                key={rev.id}
                className="p-5 rounded-3xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col gap-3 justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={rev.avatar}
                        alt={rev.authorName}
                        className="w-10 h-10 rounded-full object-cover border border-stone-200 dark:border-zinc-700"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-xs font-bold text-stone-900 dark:text-white">
                            {rev.authorName}
                          </h5>
                          {rev.isVerifiedBuyer && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                              <ShieldCheck className="w-3 h-3" />
                              ลูกค้าจริง
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-400 dark:text-zinc-500">
                          {rev.date}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < Math.floor(rev.rating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-stone-300 dark:text-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-stone-700 dark:text-zinc-300 mt-2.5 leading-relaxed">
                    {rev.comment}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-400 dark:text-zinc-500 pt-2 border-t border-stone-100 dark:border-zinc-800/80">
                  <span>{rev.foodName ? `เมนู: ${rev.foodName}` : 'รีวิวภาพรวมร้าน'}</span>
                  <button className="flex items-center gap-1 hover:text-orange-500 transition-colors cursor-pointer">
                    <ThumbsUp className="w-3 h-3" />
                    <span>ถูกใจ ({rev.likes})</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Creator Video Reviews (มีคนสร้างคลิปรีวิวยังไงบ้าง) */}
      {activeTab === 'videos' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Play className="w-5 h-5 fill-red-500 text-red-500" />
                คลิปวิดีโอรีวิวจากเหล่าครีเอเตอร์ & บล็อกเกอร์
              </h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                ดูวิดีโอพาชิม บรรยากาศหน้าร้าน และเมนูซิกเนเจอร์จากนักรีวิวชื่อดัง
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800">
              {activeStore.creatorReviews?.length || 0} คลิปวิดีโอ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(activeStore.creatorReviews || []).map((video) => (
              <div
                key={video.id}
                onClick={() => {
                  setSelectedVideoModal(video);
                  setIsVideoModalPlaying(true);
                }}
                className="group relative rounded-3xl overflow-hidden bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col"
              >
                {/* Thumbnail with Play Overlay */}
                <div className="relative h-52 w-full overflow-hidden bg-black">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Play Button Icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-red-600/90 group-hover:bg-red-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform border-2 border-white/80">
                      <Play className="w-6 h-6 fill-white translate-x-0.5" />
                    </div>
                  </div>

                  {/* Duration & Views Badge */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-bold">
                    <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md">
                      {video.views} รับชม
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md">
                      {video.duration}
                    </span>
                  </div>
                </div>

                {/* Video Info */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                      {video.tag}
                    </span>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-white mt-1 line-clamp-2 group-hover:text-orange-600 transition-colors">
                      {video.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2.5 pt-3 mt-3 border-t border-stone-100 dark:border-zinc-800/80">
                    <img
                      src={video.creatorAvatar}
                      alt={video.creatorName}
                      className="w-8 h-8 rounded-full object-cover border border-stone-200 dark:border-zinc-700"
                    />
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-stone-900 dark:text-white line-clamp-1">
                        {video.creatorName}
                      </h5>
                      <span className="text-[10px] text-stone-400 dark:text-zinc-500">
                        {video.creatorHandle}
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-stone-500 flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3 text-red-500" />
                      {video.likes}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Store Contact Channels & Exchange Terms (ช่องทางการติดต่อ & เงื่อนไขการแลกเปลี่ยน ในมุมมองร้านค้า) */}
      {activeTab === 'contact-terms' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50/60 border border-orange-200/90 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-zinc-900 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500 text-white shadow-xs">
                  มุมมองร้านค้า
                </span>
                <span className="text-xs font-semibold text-stone-500 dark:text-zinc-400">
                  ร้าน {activeStore.name} ({activeStore.nameEn})
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-stone-900 dark:text-white mt-1">
                ช่องทางติดต่อผู้ซื้อ-ผู้ขาย & ข้อกำหนดเงื่อนไขการแลกเปลี่ยน
              </h3>
              <p className="text-xs text-stone-600 dark:text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                เงื่อนไขและข้อตกลงที่กำหนดโดยร้านค้านี้โดยตรง เพื่อให้การแลกเปลี่ยนสินค้า การรับอาหาร และการประสานงานเป็นไปอย่างราบรื่น ถูกต้อง และปลอดภัย
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="primary"
                size="sm"
                onClick={() => openStoreChat(activeStore)}
                className="flex items-center gap-1.5 shadow-md shadow-orange-500/20"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>แชทตรงกับร้านค้านี้</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (5 cols): Official Store Contact Channels */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-3">
                  <h4 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <Phone className="w-4 h-4 text-orange-500" />
                    <span>ช่องทางติดต่อทางการของร้าน</span>
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    พร้อมให้บริการ
                  </span>
                </div>

                {/* 1. Direct Live Chat Card */}
                <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900/40 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <span className="text-xs font-bold text-stone-900 dark:text-zinc-100">
                        ระบบสนทนาภายในแอป (In-App Chat)
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 dark:text-zinc-400 mt-1">
                       ติดต่อสอบถามคิว แจ้งการแพ้อาหาร หรือประสานงานการรับอาหารกับร้านนี้แบบเรียลไทม์
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openStoreChat(activeStore)}
                    className="w-full flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>เริ่มแชทกับผู้ดูแลร้าน</span>
                  </Button>
                </div>

                {/* 2. Direct Phone Call */}
                <div className="p-3.5 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
                      เบอร์โทรศัพท์ติดต่อหน้าร้าน
                    </span>
                    <div className="text-sm font-black text-stone-900 dark:text-white font-mono mt-0.5">
                      {activeStore.contactChannels?.phone || activeStore.ownerPhone || '082-345-6789'}
                    </div>
                    <span className="text-[10px] text-stone-400 dark:text-zinc-500">
                      ผู้ดูแล: {activeStore.contactChannels?.staffOnDutyName || activeStore.ownerName || 'พนักงานหน้าร้าน'}
                    </span>
                  </div>
                  <a
                    href={`tel:${(activeStore.contactChannels?.phone || activeStore.ownerPhone || '0823456789').replace(/-/g, '')}`}
                    className="p-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition-transform active:scale-95 cursor-pointer"
                    title="โทรออกหาร้านค้า"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>

                {/* 3. LINE Official */}
                {activeStore.contactChannels?.lineId && (
                  <div className="p-3.5 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
                        LINE Official Account
                      </span>
                      <div className="text-sm font-black text-stone-900 dark:text-white font-mono mt-0.5">
                        {activeStore.contactChannels.lineId}
                      </div>
                      <span className="text-[10px] text-stone-400 dark:text-zinc-500">
                        ติดตามประกาศและเมนูพิเศษประจำวัน
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(activeStore.contactChannels?.lineId || '');
                        addToast('คัดลอก LINE ID สำเร็จ', activeStore.contactChannels?.lineId, 'success');
                      }}
                      className="px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors cursor-pointer"
                    >
                      คัดลอก ID
                    </button>
                  </div>
                )}

                {/* 4. Physical Pickup Location */}
                <div className="p-3.5 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-950/40">
                  <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400">
                    เคาน์เตอร์จุดแลกรับอาหาร
                  </span>
                  <div className="text-sm font-bold text-stone-900 dark:text-white mt-0.5">
                    {activeStore.contactChannels?.pickupCounterLocation || `บูธ ${activeStore.id.toUpperCase()}`}
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">
                    {activeStore.address}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column (7 cols): Store Exchange Terms from Store's Perspective */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200/90 dark:border-zinc-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-3">
                  <h4 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-500" />
                    <span>เงื่อนไขการแลกเปลี่ยนสินค้า (มุมมองร้านค้า)</span>
                  </h4>
                  <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 font-mono">
                    ฉบับ {activeStore.exchangeTerms?.termsVersion || 'v2.1'}
                  </span>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  {/* Condition 1: Handover & PIN */}
                  <div className="p-4 rounded-2xl border border-stone-100 dark:border-zinc-800/80 bg-stone-50/50 dark:bg-zinc-950/40">
                    <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white mb-1">
                      <Key className="w-4 h-4 text-orange-600" />
                      <span>1. เงื่อนไขการรับมอบอาหารและรหัสยืนยัน (Exchange PIN)</span>
                    </div>
                    <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-6 text-xs">
                      {activeStore.exchangeTerms?.pickupPolicy ||
                        'ลูกค้าต้องแสดงรหัส PIN 4 หลักหรือหน้าจอบัตรคิวดิจิทัลที่เคาน์เตอร์หน้าร้านเพื่อแลกรับอาหาร ป้องกันการรับอาหารผิดคิว'}
                    </p>
                  </div>

                  {/* Condition 2: Pickup Window */}
                  <div className="p-4 rounded-2xl border border-stone-100 dark:border-zinc-800/80 bg-stone-50/50 dark:bg-zinc-950/40">
                    <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white mb-1">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span>2. ระยะเวลาการมารับอาหาร ({activeStore.exchangeTerms?.pickupWindowMinutes || 15} นาที)</span>
                    </div>
                    <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-6 text-xs">
                      เพื่อรักษาคุณภาพความร้อนและความสดใหม่ ขอให้ลูกค้ามารับอาหารภายใน{' '}
                      <strong>{activeStore.exchangeTerms?.pickupWindowMinutes || 15} นาที</strong> หลังอาหารพร้อมรับ
                    </p>
                  </div>

                  {/* Condition 3: Cancellation & Refund */}
                  <div className="p-4 rounded-2xl border border-stone-100 dark:border-zinc-800/80 bg-stone-50/50 dark:bg-zinc-950/40">
                    <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white mb-1">
                      <ShieldAlert className="w-4 h-4 text-orange-600" />
                      <span>3. นโยบายการยกเลิกและคืนเงิน</span>
                    </div>
                    <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-6 text-xs">
                      {activeStore.exchangeTerms?.cancellationPolicy ||
                        'ยกเลิกหรือแก้ไขได้เฉพาะก่อนร้านเริ่มปรุง (PREPARING) เนื่องจากเป็นอาหารปรุงสดตามสั่งทุกจาน'}
                    </p>
                  </div>

                  {/* Condition 4: Payment Terms */}
                  <div className="p-4 rounded-2xl border border-stone-100 dark:border-zinc-800/80 bg-stone-50/50 dark:bg-zinc-950/40">
                    <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white mb-1">
                      <CreditCard className="w-4 h-4 text-orange-600" />
                      <span>4. นโยบายการชำระเงิน</span>
                    </div>
                    <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-6 text-xs">
                      {activeStore.exchangeTerms?.paymentTerms ||
                        'รองรับ PromptPay QR สแกนจ่ายทันที, กระเป๋าเงิน Campus Wallet และจ่ายสดหน้าร้าน'}
                    </p>
                  </div>

                  {/* Condition 5: Allergen Warning */}
                  <div className="p-4 rounded-2xl border border-stone-100 dark:border-zinc-800/80 bg-stone-50/50 dark:bg-zinc-950/40">
                    <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white mb-1">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>5. การแจ้งเตือนประวัติแพ้อาหาร</span>
                    </div>
                    <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-6 text-xs">
                      {activeStore.exchangeTerms?.allergenWarningNotice ||
                        'หากมีประวัติแพ้อาหารต้องระบุในหมายเหตุพิเศษ หรือส่งข้อความแชทแจ้งทางร้านก่อนยืนยัน'}
                    </p>
                  </div>

                  {/* Condition 6: Dispute Resolution */}
                  <div className="p-4 rounded-2xl border border-stone-100 dark:border-zinc-800/80 bg-stone-50/50 dark:bg-zinc-950/40">
                    <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>6. การระงับข้อพิพาทและความช่วยเหลือ</span>
                    </div>
                    <p className="text-stone-600 dark:text-zinc-300 leading-relaxed pl-6 text-xs">
                      {activeStore.exchangeTerms?.disputeContactInfo ||
                        'หากพบข้อผิดพลาดหรือต้องการความช่วยเหลือ ติดต่อเคาน์เตอร์ร้านโดยตรง หรือส่งข้อความในระบบแชท'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-stone-400 dark:text-zinc-500">
                  <span>ร้านค้า: {activeStore.name}</span>
                  <span>อัปเดตล่าสุด: {activeStore.exchangeTerms?.lastUpdated || '2026-09-20'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommended Similar or Nearby Stores (แนะนำร้านที่ใกล้เคียงหรือมีความคล้ายคลึงกัน) */}
      <div className="mt-8 pt-8 border-t border-stone-200 dark:border-zinc-800 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              ร้านแนะนำที่ใกล้เคียงหรือมีความคล้ายคลึงกัน
            </h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
              ร้านอาหารยอดนิยมในหมวดหมู่นี้ หรือตั้งอยู่ในพิกัดใกล้เคียงที่คุณอาจสนใจ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {similarStores.map(similarStore => (
            <StoreCard
              key={similarStore.id}
              store={similarStore}
              onSelect={(s) => {
                // Navigate to this similar store's profile page by its ID!
                window.scrollTo({ top: 0, behavior: 'instant' });
                openStoreDetail(s.id);
              }}
            />
          ))}
        </div>
      </div>

      {/* Creator Video Modal Player */}
      {selectedVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col text-white">
            {/* Video Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <img
                  src={selectedVideoModal.creatorAvatar}
                  alt={selectedVideoModal.creatorName}
                  className="w-9 h-9 rounded-full object-cover border border-zinc-700"
                />
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {selectedVideoModal.creatorName}
                  </h4>
                  <span className="text-[11px] text-zinc-400">
                    {selectedVideoModal.creatorHandle}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedVideoModal(null)}
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player */}
            <div className="relative w-full aspect-video bg-black flex items-center justify-center">
              <video
                ref={modalVideoRef}
                src={selectedVideoModal.videoUrl || 'https://assets.mixkit.co/videos/preview/mixkit-chef-preparing-a-dish-with-herbs-42994-large.mp4'}
                poster={selectedVideoModal.thumbnail}
                playsInline
                autoPlay
                loop
                muted={isVideoModalMuted}
                onPlay={() => setIsVideoModalPlaying(true)}
                onPause={() => setIsVideoModalPlaying(false)}
                className="w-full h-full object-cover"
              />

              {/* Player control overlay */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    if (!modalVideoRef.current) return;
                    if (isVideoModalPlaying) {
                      modalVideoRef.current.pause();
                      setIsVideoModalPlaying(false);
                    } else {
                      modalVideoRef.current.play();
                      setIsVideoModalPlaying(true);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md"
                >
                  {isVideoModalPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isVideoModalPlaying ? 'หยุดชั่วคราว' : 'เล่นต่อ'}</span>
                </button>

                <button
                  onClick={() => {
                    if (!modalVideoRef.current) return;
                    modalVideoRef.current.muted = !modalVideoRef.current.muted;
                    setIsVideoModalMuted(modalVideoRef.current.muted);
                  }}
                  className="p-2 rounded-xl bg-black/70 hover:bg-black/90 text-white backdrop-blur-md"
                >
                  {isVideoModalMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Video Caption & CTA */}
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-bold text-white line-clamp-1">
                  {selectedVideoModal.title}
                </h5>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {selectedVideoModal.views} รับชม • {selectedVideoModal.likes} ถูกใจ
                </p>
              </div>

              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setSelectedVideoModal(null);
                  setActiveTab('menu');
                }}
              >
                ดูเมนูในคลิปนี้
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
