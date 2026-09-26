import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import {
  ArrowLeft,
  Star,
  Clock,
  Flame,
  Calendar,
  Store as StoreIcon,
  ShieldCheck,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Share2,
  Heart,
  Plus,
  Minus,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  ThumbsUp,
  Info,
  Sparkles,
  MapPin
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const FoodDetailPage: React.FC = () => {
  const {
    selectedFood: contextFood,
    stores,
    foodItems,
    openFoodDetail,
    openStoreDetail,
    setCurrentView,
    addToCart,
    isStoreFollowed,
    toggleFollowStore,
    addToast,
    openStoreChat,
    openStoreContactAndTerms,
    setIsCartOpen
  } = useQueue();

  const { foodId } = useParams<{ foodId?: string }>();
  const selectedFood = (foodId ? foodItems.find(f => f.id === foodId) : null) || contextFood || foodItems[0] || null;

  useEffect(() => {
    if (foodId && (!contextFood || contextFood.id !== foodId)) {
      if (foodItems.some(f => f.id === foodId)) {
        openFoodDetail(foodId);
      }
    }
  }, [foodId, foodItems, contextFood, openFoodDetail]);

  // Selected options state
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [specialNote, setSpecialNote] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('วันนี้');
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [activeMediaTab, setActiveMediaTab] = useState<'image' | 'video'>('image');
  const [newComment, setNewComment] = useState<string>('');
  const [userRating, setUserRating] = useState<number>(5);
  const [userReviewsList, setUserReviewsList] = useState(selectedFood?.reviews || []);

  // Synchronize options and reviews whenever selectedFood changes
  useEffect(() => {
    if (selectedFood?.optionGroups) {
      const defaults: Record<string, string> = {};
      selectedFood.optionGroups.forEach(group => {
        if (group.choices.length > 0) {
          defaults[group.id] = group.choices[0].name;
        }
      });
      setSelectedChoices(defaults);
    } else {
      setSelectedChoices({});
    }
    setUserReviewsList(selectedFood?.reviews || []);
    setQuantity(1);
    setSpecialNote('');
  }, [selectedFood?.id]);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  if (!selectedFood) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-stone-500 dark:text-zinc-400 mb-4">ไม่พบข้อมูลเมนูอาหารที่เลือก</p>
        <Button onClick={() => setCurrentView('home')}>กลับสู่หน้าหลัก</Button>
      </div>
    );
  }

  // Find store
  const store = stores.find(s => s.id === selectedFood.storeId);
  const followed = store ? isStoreFollowed(store.id) : false;

  // Other menus from this same store
  const otherMenus = foodItems.filter(
    item => item.storeId === selectedFood.storeId && item.id !== selectedFood.id
  );

  // Compute subtotal with choices
  const calculateTotal = () => {
    let base = selectedFood.price;
    if (selectedFood.optionGroups) {
      selectedFood.optionGroups.forEach(group => {
        const choiceName = selectedChoices[group.id];
        const choice = group.choices.find(c => c.name === choiceName);
        if (choice) {
          base += choice.priceDelta;
        }
      });
    }
    return base * quantity;
  };

  const handleAddToCart = () => {
    if (!selectedFood.isAvailable) return;

    const formattedOptions = selectedFood.optionGroups
      ? selectedFood.optionGroups.map(group => {
          const choiceName = selectedChoices[group.id];
          const choice = group.choices.find(c => c.name === choiceName);
          return {
            groupName: group.name,
            choiceName: choiceName || '',
            priceDelta: choice?.priceDelta || 0
          };
        })
      : [];

    addToCart({
      food: selectedFood,
      quantity,
      selectedOptions: formattedOptions,
      specialNote: selectedDay !== 'วันนี้' ? `[จองสำหรับ: ${selectedDay}] ${specialNote}` : specialNote
    });

    addToast('เพิ่มลงตะกร้าแล้ว', `${selectedFood.name} (${quantity} รายการ)`, 'success');
  };

  const handleToggleVideo = () => {
    if (!videoRef.current) return;
    if (isVideoPlaying) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    } else {
      videoRef.current.play();
      setIsVideoPlaying(true);
    }
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const newRev = {
      id: `review-${Date.now()}`,
      authorName: 'คุณ (ผู้ใช้)',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      rating: userRating,
      date: 'เมื่อสักครู่',
      comment: newComment,
      likes: 0,
      isVerifiedBuyer: true,
      foodName: selectedFood.name
    };

    setUserReviewsList([newRev, ...userReviewsList]);
    setNewComment('');
    addToast('ขอบคุณสำหรับรีวิว', 'ความคิดเห็นของคุณถูกเผยแพร่แล้ว', 'success');
  };

  // Available days array
  const availableDays = selectedFood.availableDays || [
    'จันทร์',
    'อังคาร',
    'พุธ',
    'พฤหัสบดี',
    'ศุกร์',
    'เสาร์',
    'อาทิตย์'
  ];

  // Spicy description
  const getSpicyDescription = (level?: number) => {
    switch (level) {
      case 0:
        return {
          title: 'ไม่เผ็ด (0/3)',
          desc: 'รสชาติกลมกล่อม ละมุน ไม่ใส่พริก เด็กและผู้ที่ไม่ทานเผ็ดทานได้สบาย',
          color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
        };
      case 1:
        return {
          title: 'เผ็ดน้อย (1/3)',
          desc: 'เผ็ดปลายลิ้นเบาๆ หอมพริกคั่วอ่อนๆ ให้รสชาติกระปรี้กระเปร่า',
          color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
        };
      case 2:
        return {
          title: 'เผ็ดกลาง (2/3) - สูตรมาตรฐาน',
          desc: 'รสจัดจ้านกำลังดี เผ็ดร้อนกลมกล่อมตามแบบฉบับต้นตำรับของร้าน แนะนำสำหรับคนชอบรสไทยแท้',
          color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800'
        };
      case 3:
        return {
          title: 'เผ็ดไฟลุก (3/3) - แซ่บสะท้านลิ้น',
          desc: 'พริกขี้หนูสวนและพริกแห้งจินดาคั่วเข้มข้น เผ็ดสะใจเหงื่อหยด สายแซ่บแท้ต้องลอง!',
          color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800'
        };
      default:
        return {
          title: 'รสชาติตามมาตรฐาน',
          desc: 'สามารถระบุรสชาติและความต้องการเพิ่มเติมในช่องหมายเหตุได้',
          color: 'text-stone-600 dark:text-zinc-400 bg-stone-50 dark:bg-zinc-900 border-stone-200 dark:border-zinc-800'
        };
    }
  };

  const spicyInfo = getSpicyDescription(selectedFood.spicyLevel);

  return (
    <div className="flex flex-col gap-6 pb-24 max-w-5xl mx-auto w-full">
      {/* Top Breadcrumb Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => setCurrentView('home')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับหน้ารวม</span>
        </button>

        <div className="flex items-center gap-2">
          {store && (
            <button
              onClick={() => openStoreDetail(store.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-100 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800/60 text-orange-700 dark:text-orange-300 text-xs font-bold hover:bg-orange-200 transition-colors"
            >
              <StoreIcon className="w-3.5 h-3.5" />
              <span>ดูโปรไฟล์ร้าน {store.name}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: selectedFood.name,
                  text: selectedFood.description,
                  url: window.location.href
                }).catch(() => {});
              } else {
                navigator.clipboard.writeText(window.location.href);
                addToast('คัดลอกลิงก์สำเร็จ', 'แชร์เมนูนี้ให้เพื่อนได้เลย', 'info');
              }
            }}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-400 transition-colors"
            title="แชร์เมนูนี้"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Left is Media & Food Identity, Right is Booking & Order Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (7 cols): Visuals, Details, Spicy Level, Reviews */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Media Showcase (Photo / Video Switcher) */}
          <div className="relative rounded-3xl overflow-hidden bg-black border border-stone-200 dark:border-zinc-800 shadow-md">
            {activeMediaTab === 'image' ? (
              <div className="relative w-full h-72 sm:h-96">
                <img
                  src={selectedFood.image}
                  alt={selectedFood.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                
                {/* Switch to video button overlay */}
                {selectedFood.videoPreview && (
                  <button
                    onClick={() => {
                      setActiveMediaTab('video');
                      setIsVideoPlaying(true);
                    }}
                    className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-orange-600/90 hover:bg-orange-600 text-white backdrop-blur-md shadow-lg border border-white/20 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>เล่นวิดีโอสาธิต ({selectedFood.videoPreview.duration})</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="relative w-full h-72 sm:h-96 bg-black flex items-center justify-center">
                {selectedFood.videoPreview ? (
                  <>
                    <video
                      ref={videoRef}
                      src={selectedFood.videoPreview.videoUrl}
                      poster={selectedFood.videoPreview.poster}
                      playsInline
                      loop
                      autoPlay
                      muted={isMuted}
                      onPlay={() => setIsVideoPlaying(true)}
                      onPause={() => setIsVideoPlaying(false)}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Video Controls Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                    
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 pointer-events-auto">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleToggleVideo}
                          className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-center transition-colors"
                        >
                          {isVideoPlaying ? (
                            <Pause className="w-4 h-4 fill-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-white translate-x-0.5" />
                          )}
                        </button>

                        <button
                          onClick={handleToggleMute}
                          className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white flex items-center justify-center transition-colors"
                        >
                          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                      </div>

                      <button
                        onClick={() => setActiveMediaTab('image')}
                        className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-bold transition-colors"
                      >
                        สลับดูรูปภาพ HD
                      </button>
                    </div>

                    <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/80 backdrop-blur-md text-white text-[11px] font-bold">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      กำลังเล่นคลิปเมนู
                    </div>
                  </>
                ) : (
                  <div className="text-white text-sm">ไม่มีวิดีโอสำหรับเมนูนี้</div>
                )}
              </div>
            )}

            {/* Media Selector Tabs */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 p-1 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10">
              <button
                onClick={() => setActiveMediaTab('image')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeMediaTab === 'image'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                รูปภาพ HD
              </button>
              {selectedFood.videoPreview && (
                <button
                  onClick={() => {
                    setActiveMediaTab('video');
                    setIsVideoPlaying(true);
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    activeMediaTab === 'video'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  วิดีโอคลิป
                </button>
              )}
            </div>
          </div>

          {/* Food Details & Description */}
          <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/80 text-orange-700 dark:text-orange-400 text-xs font-bold">
                หมวดหมู่: {selectedFood.category}
              </span>

              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-amber-500 font-bold text-sm">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {selectedFood.rating} ({selectedFood.orderCount}+ ออเดอร์)
                </span>
                <span className="inline-flex items-center gap-1 text-stone-500 dark:text-zinc-400 text-xs">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  ปรุงเสร็จใน ~{selectedFood.preparationMinutes} นาที
                </span>
              </div>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
                {selectedFood.name}
              </h1>
              <p className="text-xs sm:text-sm font-medium text-stone-400 dark:text-zinc-500 mt-0.5">
                {selectedFood.nameEn}
              </p>
            </div>

            <p className="text-sm text-stone-600 dark:text-zinc-300 leading-relaxed">
              {selectedFood.description}
            </p>

            {/* Tags */}
            {selectedFood.tags && selectedFood.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100 dark:border-zinc-800/80">
                {selectedFood.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-zinc-900 text-stone-600 dark:text-zinc-400 text-xs font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Spicy Level Card (เผ็ดไม่เผ็ด) */}
          <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-500" />
                ระดับความเผ็ดและรสชาติ
              </h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${spicyInfo.color}`}>
                {spicyInfo.title}
              </span>
            </div>

            {/* Spicy Meter Bar */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[0, 1, 2, 3].map((lvl) => {
                const isActive = (selectedFood.spicyLevel ?? 0) >= lvl;
                return (
                  <div
                    key={lvl}
                    className={`h-2.5 rounded-full transition-all ${
                      isActive
                        ? lvl === 3
                          ? 'bg-red-600 shadow-sm shadow-red-500/50'
                          : lvl === 2
                          ? 'bg-orange-500'
                          : lvl === 1
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                        : 'bg-stone-200 dark:bg-zinc-800'
                    }`}
                  />
                );
              })}
            </div>

            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1 leading-relaxed">
              {spicyInfo.desc}
            </p>
          </div>

          {/* Store Profile Card (ร้านไหน) */}
          {store && (
            <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-orange-200/90 dark:border-zinc-800 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <img
                  src={store.logo}
                  alt={store.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-200 dark:border-zinc-700 shadow-sm shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                      ร้านค้าเจ้าของเมนู
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                      {store.isOpen ? 'เปิดบริการอยู่' : 'ปิดชั่วคราว'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white mt-0.5 line-clamp-1">
                    {store.name}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5 line-clamp-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                    {store.address} • ห่าง {store.distanceKm} กม.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => openStoreDetail(store.id)}
                    className="flex-1 sm:flex-none"
                  >
                    <StoreIcon className="w-4 h-4 mr-1.5" />
                    ดูโปรไฟล์ร้านนี้
                  </Button>

                  <button
                    type="button"
                    onClick={() => openStoreChat(store)}
                    className="p-2 rounded-xl bg-orange-100 hover:bg-orange-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-zinc-700 transition-colors cursor-pointer"
                    title="แชทคุยกับร้านค้านี้"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => openStoreContactAndTerms(store, 'terms')}
                    className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 border border-stone-200 dark:border-zinc-700 transition-colors cursor-pointer"
                    title="ดูเงื่อนไขการรับอาหารและข้อมูลติดต่อ"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={() => toggleFollowStore(store.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    followed
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                      : 'bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${followed ? 'fill-red-500 text-red-500' : ''}`} />
                  <span>{followed ? 'ติดตามแล้ว' : 'ติดตามร้าน'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Customer Reviews Section (มีรีวิวอะไรบ้างที่เกี่ยวกับร้าน) */}
          <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-orange-500" />
                  รีวิวจากผู้สั่งจริง ({userReviewsList.length} รีวิว)
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  คะแนนความพึงพอใจเฉลี่ย {selectedFood.rating} จาก 5 ดาว
                </p>
              </div>

              <div className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400 font-extrabold text-base">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                {selectedFood.rating}
              </div>
            </div>

            {/* Submit quick review */}
            <form onSubmit={handleAddReview} className="flex flex-col gap-3 p-4 rounded-2xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 dark:text-zinc-200">
                  เขียนรีวิวสำหรับเมนูนี้:
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setUserRating(star)}
                      className="p-1 text-amber-400 hover:scale-120 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          star <= userRating ? 'fill-amber-400 text-amber-400' : 'text-stone-300 dark:text-zinc-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="รสชาติเป็นอย่างไรบ้าง อร่อยไหม บริการเร็วหรือไม่..."
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-black border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <Button size="sm" variant="primary" type="submit">
                  ส่งรีวิว
                </Button>
              </div>
            </form>

            {/* Review Cards List */}
            <div className="flex flex-col gap-4">
              {userReviewsList.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-2xl bg-stone-50/70 dark:bg-zinc-900/60 border border-stone-200/80 dark:border-zinc-800/80 flex flex-col gap-2.5"
                >
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
                              ทานจริง
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

                  <p className="text-xs text-stone-700 dark:text-zinc-300 leading-relaxed">
                    {rev.comment}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-stone-400 dark:text-zinc-500 pt-1">
                    <span>เมนู: {rev.foodName || selectedFood.name}</span>
                    <button className="flex items-center gap-1 hover:text-orange-500 transition-colors cursor-pointer">
                      <ThumbsUp className="w-3 h-3" />
                      <span>มีประโยชน์ ({rev.likes})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Other Menus from this Store (ร้านนี้เนี่ยมีเมนูอะไรอื่นบ้าง) */}
          {otherMenus.length > 0 && (
            <div className="rounded-3xl bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    เมนูอื่นๆ จากร้านนี้
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                    เลือกสั่งเมนูอร่อยเพิ่มเติมจาก {store?.name || selectedFood.storeName}
                  </p>
                </div>
                {store && (
                  <button
                    onClick={() => openStoreDetail(store.id)}
                    className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ดูทั้งหมด ({otherMenus.length + 1})
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {otherMenus.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      // Navigate to this other food's detail page
                      window.scrollTo({ top: 0, behavior: 'instant' });
                      openFoodDetail(item.id);
                    }}
                    className="group flex items-center gap-3 p-3 rounded-2xl bg-stone-50/80 hover:bg-orange-50/50 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 border border-stone-200/80 hover:border-orange-300 dark:border-zinc-800 transition-all cursor-pointer"
                  >
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-stone-200 dark:bg-black shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {item.spicyLevel !== undefined && item.spicyLevel > 0 && (
                        <div className="absolute top-1 right-1 p-0.5 rounded-full bg-red-600 text-white">
                          <Flame className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 dark:text-white line-clamp-1 group-hover:text-orange-600 transition-colors">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-stone-400 dark:text-zinc-500 line-clamp-1 mt-0.5">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-extrabold text-orange-600 dark:text-orange-400">
                          ฿{item.price}
                        </span>
                        <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {item.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Reservation Schedule & Ordering Box */}
        <div className="lg:col-span-5 sticky top-20 flex flex-col gap-6">
          <div className="rounded-3xl bg-white dark:bg-zinc-950 border-2 border-orange-200/90 dark:border-zinc-800 p-6 shadow-xl flex flex-col gap-6">
            {/* Price banner */}
            <div className="flex items-baseline justify-between border-b border-stone-100 dark:border-zinc-800/80 pb-4">
              <div>
                <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">
                  ราคาต่อจาน
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-extrabold text-stone-900 dark:text-white">
                    ฿{selectedFood.price}
                  </span>
                  {selectedFood.originalPrice && (
                    <span className="text-sm text-stone-400 line-through">
                      ฿{selectedFood.originalPrice}
                    </span>
                  )}
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                selectedFood.isAvailable
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
              }`}>
                {selectedFood.isAvailable ? 'พร้อมรับออเดอร์' : 'หมดชั่วคราว'}
              </span>
            </div>

            {/* Reservation / Available Days section (สามารถสั่งจองได้วันไหนบ้าง) */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  สามารถสั่งจองได้วันไหนบ้าง:
                </span>
                <span className="text-[11px] text-stone-400">
                  {selectedFood.availableHours || '08:30 - 20:00 น.'}
                </span>
              </div>

              {/* Day badges */}
              <div className="flex flex-wrap gap-1.5">
                {availableDays.map((day) => {
                  const isSelected = selectedDay === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30'
                          : 'bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="p-3 rounded-2xl bg-orange-50/80 dark:bg-zinc-900/60 border border-orange-200/80 dark:border-zinc-800 text-[11px] text-stone-600 dark:text-zinc-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                <span>
                  {selectedFood.bookingNotice || 'สามารถสั่งรับทันทีหน้าร้าน หรือสั่งจองคิวล่วงหน้าได้ 1-7 วันตามช่วงเวลาที่คุณสะดวก'}
                </span>
              </div>
            </div>

            {/* Customization Options (if any) */}
            {selectedFood.optionGroups && selectedFood.optionGroups.length > 0 && (
              <div className="flex flex-col gap-4 pt-2 border-t border-stone-100 dark:border-zinc-800/80">
                {selectedFood.optionGroups.map((group) => (
                  <div key={group.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-800 dark:text-zinc-200">
                        {group.name} {group.required && <span className="text-red-500">*</span>}
                      </label>
                      <span className="text-[10px] text-stone-400">เลือกได้ 1 อย่าง</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.choices.map((choice) => {
                        const isChosen = selectedChoices[group.id] === choice.name;
                        return (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() =>
                              setSelectedChoices((prev) => ({
                                ...prev,
                                [group.id]: choice.name
                              }))
                            }
                            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                              isChosen
                                ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-950/40 dark:border-orange-500 dark:text-orange-300 font-bold shadow-sm'
                                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 text-stone-700 dark:text-zinc-300'
                            }`}
                          >
                            <span>{choice.name}</span>
                            {choice.priceDelta > 0 && (
                              <span className="text-[10px] text-orange-600 font-bold">
                                +฿{choice.priceDelta}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Special Instructions */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-800 dark:text-zinc-200">
                หมายเหตุเพิ่มเติมถึงแม่ครัว (ไม่ใส่ผัก, เผ็ดพิเศษ ฯลฯ):
              </label>
              <textarea
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder="เช่น ไม่ใส่กระเทียมเจียว, ขอพริกน้ำส้มเพิ่ม..."
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-zinc-800/80">
              <span className="text-xs font-bold text-stone-800 dark:text-zinc-200">
                จำนวนจาน / ชุด:
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5 text-stone-700 dark:text-zinc-300" />
                </button>
                <span className="w-6 text-center font-bold text-base text-stone-900 dark:text-white">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-stone-700 dark:text-zinc-300" />
                </button>
              </div>
            </div>

            {/* Subtotal & Action Buttons */}
            <div className="flex flex-col gap-3 pt-3 border-t border-stone-100 dark:border-zinc-800/80">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-stone-500 dark:text-zinc-400">
                  ยอดรวม ({quantity} รายการ)
                </span>
                <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                  ฿{calculateTotal()}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <Button
                  size="lg"
                  variant="primary"
                  disabled={!selectedFood.isAvailable}
                  onClick={handleAddToCart}
                  className="w-full justify-center shadow-lg shadow-orange-500/25 py-3.5 text-sm font-bold"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  เพิ่มลงตะกร้า • ฿{calculateTotal()}
                </Button>

                <Button
                  size="md"
                  variant="outline"
                  disabled={!selectedFood.isAvailable}
                  onClick={() => {
                    handleAddToCart();
                    setIsCartOpen(true);
                  }}
                  className="w-full justify-center text-xs font-bold"
                >
                  จองคิว / ไปที่ชำระเงินทันที
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
