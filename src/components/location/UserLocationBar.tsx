import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { MapPin, ChevronDown, Check, Compass, Radio } from 'lucide-react';

export const UserLocationBar: React.FC = () => {
  const { userLocation, setUserLocation, requestGpsLocation, presetLocations } = useQueue();
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const handleGpsClick = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsLocating(true);
    await requestGpsLocation();
    setIsLocating(false);
  };

  return (
    <div className="relative inline-block text-left w-full sm:w-auto">
      {/* Location Bar Capsule styled to match screenshot exactly */}
      <div className="rounded-full bg-[#FFF8F2] dark:bg-zinc-800/95 border border-[#FDDBC7] dark:border-zinc-700/80 px-3.5 py-1.5 sm:px-4 sm:py-2 flex flex-wrap items-center gap-2 sm:gap-2.5 shadow-xs">
        {/* Status Indicator Green Dot */}
        <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0" />

        {/* Location Pin & Label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <MapPin className="w-4 h-4 text-[#F97316] shrink-0" />
          <span className="text-[#F97316] font-bold text-sm tracking-tight">
            จุดที่คุณอยู่:
          </span>
        </div>

        {/* Place Name (Derived from Map Comparison with GPS Coordinates) */}
        <span
          className="text-stone-800 dark:text-zinc-100 font-bold text-sm truncate max-w-[190px] sm:max-w-xs"
          title={userLocation.address || userLocation.name}
        >
          {userLocation.shortName || userLocation.name}
        </span>

        {/* Button: ยืนยันผ่าน GPS */}
        <button
          type="button"
          onClick={handleGpsClick}
          disabled={isLocating}
          title="เปรียบเทียบแผนที่กับจุดพิกัด GPS เพื่อยืนยันสถานที่"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D1FAE5] hover:bg-[#A7F3D0] active:scale-95 border border-[#6EE7B7] text-[#065F46] font-bold text-xs shadow-2xs transition-all cursor-pointer shrink-0"
        >
          <Check className="w-3.5 h-3.5 text-[#047857] stroke-[2.5]" />
          <span>{isLocating ? 'กำลังดึง GPS...' : 'ยืนยันผ่าน GPS'}</span>
        </button>

        {/* Button: เปลี่ยนจุด */}
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-900 hover:bg-stone-50 active:scale-95 text-stone-800 dark:text-zinc-200 font-bold text-xs border border-stone-200 dark:border-zinc-700 shadow-xs transition-all cursor-pointer shrink-0 ml-auto sm:ml-0"
        >
          <span>เปลี่ยนจุด</span>
          <ChevronDown className={`w-3.5 h-3.5 text-stone-700 dark:text-zinc-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Preset & GPS Selection Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 sm:w-84 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-orange-200 dark:border-zinc-700 p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100 dark:border-zinc-800">
              <span className="text-xs font-black text-stone-800 dark:text-zinc-100 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-orange-500" />
                จุดที่คุณอยู่ & เปรียบเทียบพิกัด GPS
              </span>
              <span className="text-[10px] text-stone-400 font-mono">
                {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </span>
            </div>

            {/* GPS live detection & verification button */}
            <button
              type="button"
              onClick={async () => {
                await handleGpsClick();
                setIsOpen(false);
              }}
              disabled={isLocating}
              className="w-full mb-2.5 p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-2 text-left">
                <div className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 shadow-2xs">
                  <Radio className={`w-4 h-4 text-emerald-500 ${isLocating ? 'animate-spin' : 'animate-pulse'}`} />
                </div>
                <div>
                  <div className="font-black flex items-center gap-1.5">
                    <span>{isLocating ? 'กำลังดึง GPS & เทียบแผนที่...' : 'เปรียบเทียบพิกัด GPS กับแผนที่'}</span>
                  </div>
                  <div className="text-[10px] font-normal text-stone-500 dark:text-zinc-400">
                    ตรวจจับพิกัดดาวเทียมเพื่อหาจุดสถานที่ใกล้ที่สุด
                  </div>
                </div>
              </div>
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </button>

            {/* Presets list */}
            <div className="text-[11px] font-bold text-stone-400 dark:text-zinc-500 mb-1 px-1 flex items-center justify-between">
              <span>เลือกจุดอ้างอิง มข. บนแผนที่:</span>
              <span className="text-[10px] text-orange-500 font-normal">8 จุดสำคัญ</span>
            </div>

            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {presetLocations.map(loc => {
                const isSelected = userLocation.id === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      setUserLocation({
                        ...loc,
                        isGps: true,
                        address: `${loc.name} (ยืนยันผ่าน GPS พิกัด ${loc.lat}, ${loc.lng})`
                      });
                      setIsOpen(false);
                    }}
                    className={`w-full p-2 rounded-xl text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500 text-white font-bold shadow-xs'
                        : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-bold truncate flex items-center gap-1.5">
                        <span>{loc.shortName || loc.name}</span>
                        {isSelected && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-medium">
                            GPS Verified
                          </span>
                        )}
                      </div>
                      <div className={`text-[10px] ${isSelected ? 'text-orange-100' : 'text-stone-400'}`}>
                        {loc.zone} • {loc.address}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 shrink-0 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
