import React from 'react';
import { Store } from '../../types';
import { useQueue } from '../../context/QueueContext';
import { compareUserToStore } from '../../services/locationService';
import { Star, MapPin, Users, Clock, Heart, MessageCircle, Info, Compass, Footprints } from 'lucide-react';

interface StoreCardProps {
  store: Store;
  onSelect: (store: Store) => void;
  comparativeBadge?: string;
}

export const StoreCard: React.FC<StoreCardProps> = ({ store, onSelect, comparativeBadge }) => {
  const {
    isStoreFollowed,
    toggleFollowStore,
    openStoreChat,
    openStoreContactAndTerms,
    userLocation,
    openProximityComparison
  } = useQueue();
  const followed = isStoreFollowed(store.id);

  const proximity = compareUserToStore(userLocation, store);

  return (
    <div
      onClick={() => onSelect(store)}
      className="group relative rounded-2xl bg-white hover:bg-orange-50/40 border border-orange-200/80 hover:border-orange-300 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer flex flex-col active:scale-[0.99] dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-700"
    >
      {/* Cover image */}
      <div className="relative w-full h-36 sm:h-40 overflow-hidden bg-stone-100 dark:bg-black">
        <img
          src={store.coverImage || store.image}
          alt={store.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Live Queue Indicator Chip & Actions */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
          {/* Quick Chat */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              openStoreChat(store);
            }}
            className="p-1.5 rounded-full backdrop-blur-md bg-black/60 hover:bg-orange-600 text-white border border-white/20 transition-all cursor-pointer shadow-xs"
            title="แชทคุยกับร้านค้า"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>

          {/* Quick Terms & Contacts */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              openStoreContactAndTerms(store, 'terms');
            }}
            className="p-1.5 rounded-full backdrop-blur-md bg-black/60 hover:bg-orange-600 text-white border border-white/20 transition-all cursor-pointer shadow-xs"
            title="ดูเงื่อนไขการรับสินค้าและติดต่อร้าน"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* Follow button */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              toggleFollowStore(store.id);
            }}
            className={`p-1.5 rounded-full backdrop-blur-md transition-all cursor-pointer ${
              followed
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-black/60 hover:bg-black/80 text-white/90 border border-white/20'
            }`}
            title={followed ? 'เลิกติดตามร้านนี้' : 'ติดตามร้านนี้เพื่อรับแจ้งเตือนเมนูใหม่ & คูปอง'}
          >
            <Heart className={`w-3.5 h-3.5 ${followed ? 'fill-white' : ''}`} />
          </button>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-amber-400/40 text-amber-300 text-xs font-bold">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            {store.currentQueueCount} คิว
          </span>
        </div>

        {/* Store Logo badge */}
        <div className="absolute bottom-2.5 left-3 flex items-center gap-2.5">
          <img
            src={store.logo}
            alt={store.name}
            className="w-10 h-10 rounded-xl object-cover border-2 border-white/80 shadow-md dark:border-zinc-700"
          />
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 backdrop-blur-md border border-emerald-400/50 text-emerald-300 text-[11px] font-bold">
            {store.isOpen ? 'เปิดบริการ' : 'ปิดชั่วคราว'}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Comparative Proximity Badge if provided */}
          {comparativeBadge && (
            <div className="mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 text-[11px] font-bold border border-orange-200 dark:border-orange-800">
              <Compass className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>{comparativeBadge}</span>
            </div>
          )}

          <h4 className="text-base font-bold text-stone-900 group-hover:text-orange-600 transition-colors line-clamp-1 dark:text-zinc-100 dark:group-hover:text-orange-400">
            {store.name}
          </h4>
          <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed dark:text-zinc-400">
            {store.description}
          </p>
        </div>

        <div className="mt-3 pt-3 border-t border-orange-100 dark:border-zinc-800/80 space-y-2">
          {/* Rating, dynamic calculated distance from user, and wait time */}
          <div className="flex items-center justify-between text-xs text-stone-600 dark:text-zinc-300">
            <div className="flex items-center gap-1 font-bold text-amber-500 dark:text-amber-400">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{store.rating}</span>
              <span className="text-stone-400 dark:text-zinc-500 font-normal">({store.reviewCount})</span>
            </div>

            <div className="flex items-center gap-2.5 text-stone-500 dark:text-zinc-400">
              <span
                className="flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-400"
                title={`ห่างจาก ${userLocation.shortName || userLocation.name} ประมาณ ${proximity.formattedDistance}`}
              >
                <MapPin className="w-3 h-3 text-orange-500" />
                {proximity.formattedDistance}
              </span>
              <span className="flex items-center gap-1">
                <Footprints className="w-3 h-3 text-stone-400" />
                ~{proximity.walkingMinutes} น.
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                รอ ~{store.averageWaitMinutes} น.
              </span>
            </div>
          </div>

          {/* Quick Proximity Compare trigger button */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              openProximityComparison(store);
            }}
            className="w-full py-1.5 px-2 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-orange-700 dark:text-orange-300 text-[11px] font-bold border border-orange-200/70 dark:border-zinc-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Compass className="w-3.5 h-3.5 text-orange-500" />
            <span>เปรียบเทียบจุดที่คุณอยู่ กับร้านนี้</span>
          </button>
        </div>
      </div>
    </div>
  );
};
