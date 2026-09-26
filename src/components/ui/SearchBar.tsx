import React, { useState, useEffect } from 'react';
import { Search, X, Sparkles, Clock, Flame, Trash2 } from 'lucide-react';
import { searchRecommendationService, RecommendationResult } from '../../services/searchRecommendationService';
import { useQueue } from '../../context/QueueContext';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  showSuggestions?: boolean;
  className?: string;
  onTagSelect?: (tag: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'ค้นหาเมนู ร้านอาหาร เช่น "แนะนำร้านแถวมอขอ", "ร้านค้านมใกล้ฉัน", "กะเพรา"',
  showSuggestions = true,
  className = '',
  onTagSelect
}) => {
  const { currentUser } = useQueue();
  const [isFocused, setIsFocused] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendationResult>(() => 
    searchRecommendationService.getRecommendationResult()
  );

  // Background computation of recommendations based on user activity formula
  const refreshRecommendations = () => {
    const res = searchRecommendationService.getRecommendationResult();
    setRecommendation(res);
  };

  useEffect(() => {
    refreshRecommendations();

    const handleUpdate = () => {
      refreshRecommendations();
    };

    window.addEventListener('queueup:search-updated', handleUpdate);
    return () => {
      window.removeEventListener('queueup:search-updated', handleUpdate);
    };
  }, []);

  const handleExecuteSearch = (queryToSearch: string) => {
    const trimmed = queryToSearch.trim();
    if (!trimmed) return;

    // Collect & store search data for recommendation engine in background
    searchRecommendationService.recordSearch(trimmed, currentUser?.id);

    onChange(trimmed);
    if (onTagSelect) onTagSelect(trimmed);
    if (onSubmit) onSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecuteSearch(value);
    }
  };

  const handleSelectTag = (query: string) => {
    handleExecuteSearch(query);
  };

  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    searchRecommendationService.clearSearchHistory();
  };

  const handleRemoveHistoryItem = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    searchRecommendationService.removeHistoryItem(query);
  };

  return (
    <div className={`w-full flex flex-col gap-2.5 ${className}`}>
      {/* Search Input Box */}
      <div
        className={`relative flex items-center w-full rounded-2xl transition-all duration-200 ${
          isFocused
            ? 'ring-2 ring-orange-500/50 border-orange-500 bg-white dark:bg-zinc-900 shadow-lg shadow-orange-500/10'
            : 'bg-white dark:bg-zinc-900 hover:border-stone-300 dark:hover:border-zinc-600 shadow-xs'
        } border border-stone-200 dark:border-zinc-700`}
      >
        <button
          type="button"
          onClick={() => handleExecuteSearch(value)}
          className="pl-4 pr-1 text-orange-500 dark:text-orange-400 hover:text-orange-600 cursor-pointer"
          title="กดเพื่อค้นหา"
        >
          <Search className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full py-3.5 px-3 bg-transparent text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder-zinc-400 text-sm font-medium focus:outline-none"
        />

        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-2 mr-2 text-stone-400 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer"
            aria-label="ล้างคำค้นหา"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Quick Search Action Button */}
        {value.trim() && (
          <button
            type="button"
            onClick={() => handleExecuteSearch(value)}
            className="mr-2 px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
          >
            ค้นหา
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* RECOMMENDATION BUTTONS (คำนวณเบื้องหลังอัตโนมัติ)       */}
      {/* ======================================================== */}
      {showSuggestions && !value.trim() && (
        <div className="space-y-3 p-3.5 rounded-2xl bg-stone-50/80 dark:bg-zinc-900/60 border border-stone-200/90 dark:border-zinc-800 text-xs animate-in fade-in duration-200">
          {/* BRANCH 1: ค้นหายอดนิยม (ผู้ใช้ใหม่ หรือ ไม่ได้เข้าค้นหา >= 5 วัน) */}
          {recommendation.mode === 'popular' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-zinc-200">
                <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                  <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
                  คำค้นหายอดนิยม
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {recommendation.popularList.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleSelectTag(tag.query)}
                    className="group px-3 py-1.5 rounded-full bg-white hover:bg-orange-50 active:scale-95 text-stone-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 border border-stone-200 dark:border-zinc-700 hover:border-orange-300 transition-all font-medium flex items-center gap-1.5 shadow-2xs cursor-pointer text-xs"
                  >
                    <span className="font-semibold">{tag.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-zinc-700 text-stone-500 dark:text-zinc-400 group-hover:bg-orange-100 group-hover:text-orange-700 dark:group-hover:bg-orange-950/60 dark:group-hover:text-orange-300 font-mono">
                      {tag.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* BRANCH 2: ประวัติล่าสุด & คำแนะนำส่วนบุคคล (เข้าใช้งาน < 1 วัน) */}
          {recommendation.mode === 'history_and_hybrid' && (
            <div className="space-y-3.5">
              {/* ส่วนที่ 1: ประวัติการค้นหาล่าสุด */}
              {recommendation.historyList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-zinc-200">
                    <span className="flex items-center gap-1.5 text-stone-700 dark:text-zinc-300">
                      <Clock className="w-3.5 h-3.5 text-orange-500" />
                      ประวัติการค้นหาล่าสุด
                    </span>
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="text-[11px] font-medium text-stone-400 hover:text-red-500 flex items-center gap-1 transition-colors cursor-pointer"
                      title="ล้างประวัติการค้นหาทั้งหมด"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>ล้างประวัติ</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {recommendation.historyList.map(item => (
                      <div
                        key={item.id}
                        className="inline-flex items-center rounded-full bg-white dark:bg-zinc-800 border border-orange-200 dark:border-zinc-700 shadow-2xs overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectTag(item.query)}
                          className="px-3 py-1.5 text-stone-800 dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-zinc-700 font-medium text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Clock className="w-3 h-3 text-stone-400 dark:text-zinc-500" />
                          <span>{item.query}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveHistoryItem(e, item.query)}
                          className="pr-2 pl-1 py-1.5 text-stone-300 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                          title="ลบคำนี้ออกจากประวัติ"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ส่วนที่ 2: คำแนะนำสำหรับคุณ (คำนวณจากประวัติร่วมกับความนิยมเบื้องหลัง) */}
              {recommendation.hybridList.length > 0 && (
                <div className={`space-y-2 ${recommendation.historyList.length > 0 ? 'pt-2.5 border-t border-stone-200/70 dark:border-zinc-800' : ''}`}>
                  <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-zinc-200">
                    <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      แนะนำสำหรับคุณ
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {recommendation.hybridList.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleSelectTag(tag.query)}
                        className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-orange-50 dark:from-purple-950/30 dark:to-orange-950/30 hover:from-purple-100 hover:to-orange-100 text-purple-950 dark:text-purple-200 border border-purple-200 dark:border-purple-800 font-semibold text-xs shadow-2xs hover:border-purple-400 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                        <span>{tag.query}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
