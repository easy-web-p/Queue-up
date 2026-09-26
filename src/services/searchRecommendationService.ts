/**
 * searchRecommendationService.ts
 * Implements:
 * 1. Search Query Data Collection & Aggregation (เก็บข้อมูลการค้นหา)
 * 2. Function 1: Most Popular Searches (ริดรายการที่ค้นหาที่นิยมที่สุด)
 * 3. Function 2: User's Past Search History (ข้อมูลการค้นหาที่ผ่านมาของผู้ใช้งาน)
 * 4. Function 3: Smart Hybrid Keywords Calculation (คำนวณคีย์เวิร์ดจากประวัติ + ความนิยม)
 * 
 * Mode Switching Formula:
 * - Function 1 (Popular) is called if: First-time user OR Inactive >= 5 days
 * - Function 2 + 3 (Recent History followed by Smart Hybrid) is called if: Last active search < 1 day (or < 5 days)
 */

import { FirebaseDataService } from './firebaseDataService';

export interface SearchRecord {
  query: string;
  timestamp: number; // Unix ms
  userId?: string;
  count?: number;
}

export interface SearchTagItem {
  id: string;
  query: string;
  label: string;
  count: number;
  source: 'popular' | 'history' | 'hybrid';
  icon?: string;
  lastSearchedAt?: number;
}

export interface RecommendationResult {
  mode: 'popular' | 'history_and_hybrid';
  modeExplanation: string;
  isFirstTimeUser: boolean;
  daysSinceLastSearch: number | null;
  hoursSinceLastSearch: number | null;
  popularList: SearchTagItem[]; // Function 1
  historyList: SearchTagItem[]; // Function 2
  hybridList: SearchTagItem[];  // Function 3
}

const STORAGE_KEY_HISTORY = 'queueup_search_history_v2';
const STORAGE_KEY_POPULAR = 'queueup_search_popular_v2';
const STORAGE_KEY_LAST_ACTIVITY = 'queueup_search_last_activity_v2';

// Baseline seed of popular campus searches with realistic search counts
const INITIAL_POPULAR_SEEDS: Array<{ query: string; label: string; count: number }> = [
  { query: 'แนะนำร้านใกล้ฉัน', label: 'แนะนำร้านใกล้ฉัน 📍', count: 184 },
  { query: 'ร้านค้านมใกล้ฉัน', label: 'ร้านค้านมใกล้ฉัน 🥛', count: 156 },
  { query: 'ศูนย์อาหารใกล้ร้านชานม', label: 'ศูนย์อาหารใกล้ร้านชานม 🧋', count: 142 },
  { query: 'แนะนำร้านแถวมอขอ', label: 'แนะนำร้านแถวมอขอ 🎓', count: 138 },
  { query: 'แนะนำโรงอาหารในมอขอ', label: 'แนะนำโรงอาหารในมอขอ 🏫', count: 125 },
  { query: 'กะเพราหมูกรอบ', label: 'กะเพราหมูกรอบ 🍳', count: 110 },
  { query: 'KKU Complex', label: 'KKU Complex 🏢', count: 98 },
  { query: 'ก๋วยเตี๋ยวเรือ', label: 'ก๋วยเตี๋ยวเรือ 🍜', count: 85 },
  { query: 'สระพลาสติก', label: 'สระพลาสติก 🌊', count: 76 },
  { query: 'ชานมไข่มุก', label: 'ชานมไข่มุก 🧋', count: 72 },
  { query: 'กังสดาล', label: 'กังสดาล 🍲', count: 68 },
  { query: 'ข้าวมันไก่', label: 'ข้าวมันไก่ 🍗', count: 64 },
];

class SearchRecommendationService {
  /**
   * Record a new search event and persist to storage
   */
  public recordSearch(rawQuery: string, userId?: string): void {
    const query = rawQuery.trim();
    if (!query || query.length < 2) return;

    const now = Date.now();

    // 1. Update User Personal History (Function 2)
    const history = this.getRawHistory();
    const existingIndex = history.findIndex(h => h.query.toLowerCase() === query.toLowerCase());

    if (existingIndex >= 0) {
      history[existingIndex].timestamp = now;
      history[existingIndex].count = (history[existingIndex].count || 1) + 1;
      // Move to top
      const item = history.splice(existingIndex, 1)[0];
      history.unshift(item);
    } else {
      history.unshift({
        query,
        timestamp: now,
        userId: userId || 'guest',
        count: 1
      });
    }

    // Keep top 30 history items
    const trimmedHistory = history.slice(0, 30);
    this.saveRawHistory(trimmedHistory);

    // 2. Update Global Popular Counts (Function 1)
    const popularMap = this.getPopularMap();
    const currentCount = popularMap[query.toLowerCase()]?.count || 0;
    popularMap[query.toLowerCase()] = {
      query,
      label: this.formatLabel(query),
      count: currentCount + 1,
      lastSearchedAt: now
    };
    this.savePopularMap(popularMap);

    // 3. Update Last Activity Timestamp
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(now));
    } catch {
      // ignore
    }

    // 4. Sync to Cloud Firestore in background
    FirebaseDataService.recordSearchLog(query, userId).catch(() => {});

    // Dispatch event so UI can immediately react
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('queueup:search-updated', { detail: { query, now } }));
    }
  }

  /**
   * Function 1: Get most popular searches ranked by search frequency
   */
  public getPopularSearches(limit: number = 10): SearchTagItem[] {
    const popularMap = this.getPopularMap();
    const list = Object.values(popularMap);

    // Sort by search count descending
    list.sort((a, b) => b.count - a.count);

    return list.slice(0, limit).map((item, idx) => ({
      id: `pop-${idx}-${item.query}`,
      query: item.query,
      label: item.label || this.formatLabel(item.query),
      count: item.count,
      source: 'popular',
      lastSearchedAt: item.lastSearchedAt
    }));
  }

  /**
   * Function 2: Get user's recent search history (latest first)
   */
  public getUserSearchHistory(limit: number = 8): SearchTagItem[] {
    const history = this.getRawHistory();
    // Sort latest first
    history.sort((a, b) => b.timestamp - a.timestamp);

    return history.slice(0, limit).map((item, idx) => ({
      id: `hist-${idx}-${item.query}`,
      query: item.query,
      label: `🕒 ${item.query}`,
      count: item.count || 1,
      source: 'history',
      lastSearchedAt: item.timestamp
    }));
  }

  /**
   * Function 3: Calculate smart hybrid keywords based on user history + popular queries
   * Co-occurrence and semantic association algorithm:
   * - Extracts key tokens from past searches
   * - Finds popular queries matching those tokens
   * - Ranks candidates by (co-occurrence frequency * popular weight)
   */
  public calculateSmartHybridKeywords(limit: number = 8): SearchTagItem[] {
    const history = this.getRawHistory();
    if (history.length === 0) {
      return this.getPopularSearches(limit).map(p => ({ ...p, source: 'hybrid', label: `✨ ${p.query}` }));
    }

    const popularList = this.getPopularSearches(30);
    const historyQueries = new Set(history.map(h => h.query.toLowerCase()));

    // Tokenize history queries into intent keywords
    const historyTokens: Map<string, number> = new Map();
    history.forEach(item => {
      const tokens = this.extractTokens(item.query);
      const recencyWeight = Math.max(1, 5 - Math.floor((Date.now() - item.timestamp) / (86400000))); // Higher if recent
      tokens.forEach(t => {
        historyTokens.set(t, (historyTokens.get(t) || 0) + (item.count || 1) * recencyWeight);
      });
    });

    // Score popular items against user's history tokens
    const scoredCandidates: Array<{ query: string; label: string; score: number; count: number }> = [];

    popularList.forEach(pop => {
      const popLower = pop.query.toLowerCase();
      // Skip if user already searched the exact same query in recent history
      if (historyQueries.has(popLower)) return;

      const popTokens = this.extractTokens(pop.query);
      let matchScore = 0;

      popTokens.forEach(t => {
        if (historyTokens.has(t)) {
          matchScore += (historyTokens.get(t) || 0) * 2.5;
        }
      });

      // Contextual bonus for high-frequency categories
      if (popLower.includes('ชานม') && (historyTokens.has('นม') || historyTokens.has('ชา') || historyTokens.has('ศูนย์อาหาร'))) {
        matchScore += 8;
      }
      if (popLower.includes('ใกล้') && (historyTokens.has('ร้าน') || historyTokens.has('โรงอาหาร') || historyTokens.has('มอขอ'))) {
        matchScore += 6;
      }

      const totalScore = matchScore + (pop.count * 0.15);
      if (matchScore > 0 || totalScore > 5) {
        scoredCandidates.push({
          query: pop.query,
          label: `✨ ${pop.query}`,
          score: totalScore,
          count: pop.count
        });
      }
    });

    // Sort by hybrid score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // If candidate list is short, supplement with top popular items not in history
    if (scoredCandidates.length < limit) {
      popularList.forEach(pop => {
        const popLower = pop.query.toLowerCase();
        if (!historyQueries.has(popLower) && !scoredCandidates.some(c => c.query.toLowerCase() === popLower)) {
          scoredCandidates.push({
            query: pop.query,
            label: `✨ แนะนำ: ${pop.query}`,
            score: pop.count,
            count: pop.count
          });
        }
      });
    }

    return scoredCandidates.slice(0, limit).map((item, idx) => ({
      id: `hybrid-${idx}-${item.query}`,
      query: item.query,
      label: item.label,
      count: item.count,
      source: 'hybrid'
    }));
  }

  /**
   * Determine Recommendation Mode based on user inactivity formula:
   * - First-time user OR Inactive >= 5 days: Use Function 1 (Popular Searches)
   * - Search active within 1 day (or < 5 days): Use Function 2 + 3 (Recent History then Hybrid)
   */
  public getRecommendationResult(forcedDaysOffset?: number): RecommendationResult {
    const history = this.getRawHistory();
    const isFirstTimeUser = history.length === 0;

    let lastSearchTimestamp: number | null = null;
    try {
      const savedLast = localStorage.getItem(STORAGE_KEY_LAST_ACTIVITY);
      if (savedLast) {
        lastSearchTimestamp = Number(savedLast);
      } else if (history.length > 0) {
        lastSearchTimestamp = history[0].timestamp;
      }
    } catch {
      // ignore
    }

    // Support simulated offset for testing the 5-day / 1-day threshold
    if (forcedDaysOffset !== undefined && lastSearchTimestamp) {
      lastSearchTimestamp = lastSearchTimestamp - (forcedDaysOffset * 86400000);
    }

    const now = Date.now();
    let daysSinceLastSearch: number | null = null;
    let hoursSinceLastSearch: number | null = null;

    if (lastSearchTimestamp) {
      const diffMs = Math.max(0, now - lastSearchTimestamp);
      hoursSinceLastSearch = Number((diffMs / (1000 * 60 * 60)).toFixed(1));
      daysSinceLastSearch = Number((diffMs / (1000 * 60 * 60 * 24)).toFixed(2));
    }

    // Formula Evaluation:
    // 1. Is first-time user? -> Function 1
    // 2. Is inactive >= 5 days? -> Function 1
    // 3. Active within < 1 day (or < 5 days)? -> Function 2 + 3
    let mode: 'popular' | 'history_and_hybrid' = 'popular';
    let modeExplanation = '';

    if (isFirstTimeUser) {
      mode = 'popular';
      modeExplanation = 'ผู้ใช้งานใหม่ครั้งแรก: แสดงรายการค้นหายอดนิยม (ฟังก์ชันที่ 1)';
    } else if (daysSinceLastSearch !== null && daysSinceLastSearch >= 5) {
      mode = 'popular';
      modeExplanation = `ไม่ได้เข้ามาใช้งานนาน ${Math.floor(daysSinceLastSearch)} วัน (>= 5 วัน): รีเซ็ตแสดงรายการค้นหายอดนิยม (ฟังก์ชันที่ 1)`;
    } else {
      mode = 'history_and_hybrid';
      const hours = hoursSinceLastSearch !== null ? hoursSinceLastSearch : 0;
      modeExplanation = `เข้าใช้งานค้นหาล่าสุด ${hours < 1 ? 'เมื่อสักครู่' : `${hours} ชม. ที่ผ่านมา`} (< 1 วัน): แสดงประวัติล่าสุด (ฟังก์ชันที่ 2) ตามด้วยคำแนะนำอัจฉริยะ (ฟังก์ชันที่ 3)`;
    }

    return {
      mode,
      modeExplanation,
      isFirstTimeUser,
      daysSinceLastSearch,
      hoursSinceLastSearch,
      popularList: this.getPopularSearches(10),
      historyList: this.getUserSearchHistory(6),
      hybridList: this.calculateSmartHybridKeywords(6)
    };
  }

  /**
   * Clear all personal search history
   */
  public clearSearchHistory(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
      localStorage.removeItem(STORAGE_KEY_LAST_ACTIVITY);
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('queueup:search-updated', { detail: { action: 'cleared' } }));
    }
  }

  /**
   * Remove single search query from history
   */
  public removeHistoryItem(queryToRemove: string): void {
    const history = this.getRawHistory().filter(
      h => h.query.toLowerCase() !== queryToRemove.toLowerCase()
    );
    this.saveRawHistory(history);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('queueup:search-updated', { detail: { action: 'removed', query: queryToRemove } }));
    }
  }

  /**
   * Helper to simulate inactivity of N days for testing the formula
   */
  public setSimulatedInactivityDays(days: number): void {
    const fakeTimestamp = Date.now() - (days * 86400000);
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVITY, String(fakeTimestamp));
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('queueup:search-updated', { detail: { action: 'simulated', days } }));
    }
  }

  // --- Private Helpers ---

  private getRawHistory(): SearchRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return [];
  }

  private saveRawHistory(history: SearchRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }

  private getPopularMap(): Record<string, { query: string; label: string; count: number; lastSearchedAt?: number }> {
    try {
      const data = localStorage.getItem(STORAGE_KEY_POPULAR);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // ignore
    }

    // Default Seed
    const map: Record<string, { query: string; label: string; count: number }> = {};
    INITIAL_POPULAR_SEEDS.forEach(seed => {
      map[seed.query.toLowerCase()] = seed;
    });
    return map;
  }

  private savePopularMap(map: Record<string, any>): void {
    try {
      localStorage.setItem(STORAGE_KEY_POPULAR, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  private formatLabel(query: string): string {
    const lower = query.toLowerCase();
    if (lower.includes('ใกล้ฉัน') || lower.includes('ใกล้')) return `${query} 📍`;
    if (lower.includes('นม') || lower.includes('ชา')) return `${query} 🧋`;
    if (lower.includes('complex')) return `${query} 🏢`;
    if (lower.includes('โรงอาหาร')) return `${query} 🏫`;
    if (lower.includes('กะเพรา') || lower.includes('ข้าว')) return `${query} 🍳`;
    if (lower.includes('เตี๋ยว') || lower.includes('เส้น')) return `${query} 🍜`;
    return query;
  }

  private extractTokens(query: string): string[] {
    const cleaned = query.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s]/g, ' ').toLowerCase();
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2);

    // Extract Thai sub-tokens
    const commonThaiKeywords = [
      'ชานม', 'นม', 'ชา', 'กะเพรา', 'หมูกรอบ', 'ไก่', 'ข้าวมันไก่',
      'ก๋วยเตี๋ยว', 'ศูนย์อาหาร', 'โรงอาหาร', 'มอขอ', 'มข', 'complex',
      'สระพลาสติก', 'กังสดาล', 'หลังมอ', 'เผ็ด', 'ราคา', 'ใกล้'
    ];

    commonThaiKeywords.forEach(k => {
      if (cleaned.includes(k) && !words.includes(k)) {
        words.push(k);
      }
    });

    return words;
  }
}

export const searchRecommendationService = new SearchRecommendationService();
