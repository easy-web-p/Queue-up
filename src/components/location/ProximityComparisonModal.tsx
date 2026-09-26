import React from 'react';
import { useQueue } from '../../context/QueueContext';
import { Store } from '../../types';
import {
  compareUserToStore,
  PRESET_CAMPUS_LOCATIONS,
  UserLocationPoint
} from '../../services/locationService';
import {
  X,
  MapPin,
  Navigation,
  Compass,
  Footprints,
  Clock,
  Car,
  ExternalLink,
  Store as StoreIcon,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Radio
} from 'lucide-react';

export const ProximityComparisonModal: React.FC = () => {
  const {
    proximityModalStore,
    closeProximityComparison,
    userLocation,
    setUserLocation,
    requestGpsLocation,
    presetLocations,
    openStoreDetail,
    stores
  } = useQueue();

  if (!proximityModalStore) return null;

  const comparison = compareUserToStore(userLocation, proximityModalStore);

  // Check if there are milk tea or beverage stores nearby this store for comparative reference
  const nearbyBeverageStore = stores.find(
    s => s.id !== proximityModalStore.id && (s.category === 'beverages' || s.tags.some(t => t.includes('ชานม') || t.includes('นม')))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeProximityComparison}
    >
      <div
        className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-orange-200 dark:border-zinc-800 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white rounded-t-3xl overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <button
            onClick={closeProximityComparison}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-all cursor-pointer"
            aria-label="ปิดหน้าต่างเปรียบเทียบ"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1.5 rounded-lg bg-white/20 backdrop-blur-md">
              <Compass className="w-4 h-4 text-white" />
            </span>
            <span className="text-xs font-black tracking-wider uppercase text-amber-200">
              เปรียบเทียบพิกัด & ระยะทางอัจฉริยะ (Location Comparison)
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
            เปรียบเทียบจุดที่คุณอยู่ กับร้านค้า
          </h3>
          <p className="text-xs sm:text-sm text-orange-100 mt-1">
            คำนวณระยะทางจริง เวลาเดินเท้า และเส้นทางระหว่างพิกัดของคุณกับร้านเป้าหมาย
          </p>
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Visual Two-Point Comparison Card */}
          <div className="rounded-2xl p-4 sm:p-5 bg-stone-50 dark:bg-zinc-800/70 border border-stone-200 dark:border-zinc-700/80 space-y-4">
            {/* Point 1: User's Location */}
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-2xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
                    จุดที่ 1: ตำแหน่งที่คุณอยู่ (Your Location)
                  </span>
                  {userLocation.isGps && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Radio className="w-3 h-3 animate-pulse" /> พิกัด GPS สด
                    </span>
                  )}
                </div>
                <h4 className="text-base font-black text-stone-900 dark:text-white truncate">
                  {userLocation.name}
                </h4>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
                  ละติจูด {userLocation.lat.toFixed(4)}, ลองจิจูด {userLocation.lng.toFixed(4)}
                  {userLocation.zone ? ` • ${userLocation.zone}` : ''}
                </p>
              </div>
            </div>

            {/* Connecting Route Line with Distance Tag */}
            <div className="relative pl-4 flex items-center gap-3">
              <div className="w-0.5 h-12 bg-gradient-to-b from-orange-500 to-amber-500 ml-4 rounded-full" />
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-100 dark:bg-orange-950/70 border border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-200 text-xs font-black shadow-xs">
                <Footprints className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                <span>ระยะห่าง: {comparison.formattedDistance} ({comparison.distanceMeters.toLocaleString()} เมตร)</span>
                <span className="text-stone-400">•</span>
                <span>เดินเท้า ~{comparison.walkingMinutes} นาที</span>
              </div>
            </div>

            {/* Point 2: Store's Location */}
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <StoreIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  จุดที่ 2: จุดที่ร้านค้าตั้งอยู่ (Store Location)
                </span>
                <h4 className="text-base font-black text-stone-900 dark:text-white truncate">
                  {proximityModalStore.name}
                </h4>
                <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                  {proximityModalStore.address || 'มหาวิทยาลัยขอนแก่น'}
                </p>
                <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-0.5">
                  ละติจูด {comparison.storeLat.toFixed(4)}, ลองจิจูด {comparison.storeLng.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="p-3 rounded-2xl bg-orange-50/70 dark:bg-zinc-800 border border-orange-200 dark:border-zinc-700 text-center">
              <div className="text-[11px] text-stone-500 dark:text-zinc-400 font-medium">ระยะห่างจริง</div>
              <div className="text-lg font-black text-orange-600 dark:text-orange-400 mt-0.5">
                {comparison.formattedDistance}
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">คำนวณพิกัด GPS</div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 text-center">
              <div className="text-[11px] text-stone-500 dark:text-zinc-400 font-medium flex items-center justify-center gap-1">
                <Footprints className="w-3 h-3 text-amber-500" />
                เดินเท้า
              </div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                ~{comparison.walkingMinutes} นาที
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">ความเร็ว 4.8 กม./ชม.</div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-zinc-800 border border-emerald-200 dark:border-zinc-700 text-center">
              <div className="text-[11px] text-stone-500 dark:text-zinc-400 font-medium flex items-center justify-center gap-1">
                <Car className="w-3 h-3 text-emerald-500" />
                นั่งรถ/วิน
              </div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ~{comparison.drivingMinutes} นาที
              </div>
              <div className="text-[10px] text-stone-400 mt-0.5">โซนถนน มข.</div>
            </div>
          </div>

          {/* Proximity Assessment Badge */}
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200">
              <strong className="font-bold">{comparison.proximityLabel}:</strong>{' '}
              {comparison.distanceMeters <= 200
                ? 'ร้านค้านี้อยู่ใกล้มาก สามารถเดินไปรับสินค้าหรือนั่งทานได้สะดวกรวดเร็ว'
                : 'สามารถเดินชิลๆ หรือใช้บริการรถชัทเทิลบัส KST มข. หรือวินมอเตอร์ไซค์ได้'}
            </div>
          </div>

          {/* Location Switcher Tool */}
          <div className="border-t border-stone-200 dark:border-zinc-800 pt-4">
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-orange-500" />
                ทดลองเปลี่ยน "จุดที่คุณอยู่" เพื่อเปรียบเทียบระยะใหม่:
              </label>
              <button
                type="button"
                onClick={requestGpsLocation}
                className="text-[11px] font-black text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
              >
                <Radio className="w-3 h-3" /> ใช้ GPS สด
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {presetLocations.slice(0, 8).map(loc => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setUserLocation(loc)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all text-left truncate cursor-pointer ${
                    userLocation.id === loc.id
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300'
                  }`}
                  title={loc.name}
                >
                  📍 {loc.shortName}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            <a
              href={comparison.googleMapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <ExternalLink className="w-4 h-4 text-orange-600" />
              <span>เปิด Google Maps นำทาง</span>
            </a>

            <button
              onClick={() => {
                closeProximityComparison();
                openStoreDetail(proximityModalStore.id);
              }}
              className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-orange-500/25 active:scale-95"
            >
              <span>สั่งอาหารที่ร้านนี้</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
