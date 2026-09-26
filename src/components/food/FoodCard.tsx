import React from 'react';
import { FoodItem } from '../../types';
import { Star, Clock, Plus, Flame, Play, Store as StoreIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { useQueue } from '../../context/QueueContext';

interface FoodCardProps {
  food: FoodItem;
  onSelect?: (food: FoodItem) => void;
  onQuickAdd?: (food: FoodItem) => void;
}

export const FoodCard: React.FC<FoodCardProps> = ({ food, onSelect, onQuickAdd }) => {
  const { openFoodDetail, openStoreDetail } = useQueue();

  const handleCardClick = () => {
    // Open dedicated food detail page
    openFoodDetail(food.id);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative rounded-2xl bg-white hover:bg-orange-50/30 border border-orange-200/80 hover:border-orange-400/80 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col cursor-pointer active:scale-[0.99] dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700"
    >
      {/* Food Image Container */}
      <div className="relative w-full h-44 sm:h-48 overflow-hidden bg-stone-100 dark:bg-black">
        <img
          src={food.image}
          alt={food.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-amber-300 text-xs font-bold border border-white/10">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {food.rating}
            </span>
            {food.spicyLevel !== undefined && food.spicyLevel > 0 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-950/80 backdrop-blur-md text-red-300 text-xs font-bold border border-red-500/40">
                <Flame className="w-3 h-3 text-red-400 fill-red-400" />
                {food.spicyLevel === 3 ? 'เผ็ดไฟลุก' : food.spicyLevel === 2 ? 'เผ็ดกลาง' : 'เผ็ดน้อย'}
              </span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-stone-200 text-xs border border-white/10">
            <Clock className="w-3 h-3 text-orange-400" />
            {food.preparationMinutes} นาที
          </span>
        </div>

        {/* Play Button Overlay (ปุ่มเพลย์สำหรับกดเข้าหน้ารายละเอียด & วิดีโออาหาร) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button
            type="button"
            title="กดดูวิดีโอและรายละเอียดเมนูนี้"
            onClick={(e) => {
              e.stopPropagation();
              openFoodDetail(food.id);
            }}
            className="pointer-events-auto w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-600/50 flex items-center justify-center transition-all duration-300 transform group-hover:scale-110 hover:scale-120 active:scale-95 border-2 border-white/90 hover:brightness-110"
          >
            <Play className="w-5 h-5 fill-white text-white translate-x-0.5" />
          </button>
        </div>

        {/* Video & Info Hint Pill on Bottom of Image */}
        <div className="absolute bottom-2.5 right-2.5 pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-semibold text-white/90 border border-white/15">
            <Play className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            ดูข้อมูล & คลิป
          </span>
        </div>

        {/* Out of stock badge */}
        {!food.isAvailable && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
            <span className="px-3 py-1 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-sm">
              เมนูนี้หมดชั่วคราว
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Store Name Badge (Clickable to Store Profile) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openStoreDetail(food.storeId);
            }}
            className="group/store inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:underline transition-colors text-left"
            title="กดเพื่อดูโปรไฟล์ร้านนี้"
          >
            <StoreIcon className="w-3 h-3 text-orange-500" />
            <span className="line-clamp-1">{food.storeName}</span>
          </button>

          <h4 className="text-sm sm:text-base font-bold text-stone-900 mt-1 line-clamp-1 group-hover:text-orange-600 transition-colors dark:text-zinc-100 dark:group-hover:text-orange-400">
            {food.name}
          </h4>
          <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed font-normal dark:text-zinc-400">
            {food.description}
          </p>
        </div>

        {/* Pricing & CTA */}
        <div className="pt-3 mt-3 border-t border-orange-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg sm:text-xl font-extrabold text-stone-900 dark:text-white">
                ฿{food.price}
              </span>
              {food.originalPrice && (
                <span className="text-xs text-stone-400 line-through dark:text-zinc-500">
                  ฿{food.originalPrice}
                </span>
              )}
            </div>
            <span className="text-[10px] text-stone-400 dark:text-zinc-500">
              สั่งแล้ว {food.orderCount}+ ครั้ง
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="primary"
              disabled={!food.isAvailable}
              onClick={(e) => {
                e.stopPropagation();
                if (food.optionGroups && food.optionGroups.length > 0 && onSelect) {
                  onSelect(food);
                } else if (onQuickAdd) {
                  onQuickAdd(food);
                } else if (onSelect) {
                  onSelect(food);
                } else {
                  openFoodDetail(food.id);
                }
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              สั่ง
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
