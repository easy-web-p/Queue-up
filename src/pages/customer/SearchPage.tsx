import React, { useState, useMemo, useEffect } from 'react';
import { useQueue } from '../../context/QueueContext';
import { CATEGORIES } from '../../data/mockData';
import { Store } from '../../types';
import { FoodCard } from '../../components/food/FoodCard';
import { StoreCard } from '../../components/food/StoreCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { UserLocationBar } from '../../components/location/UserLocationBar';
import {
  calculateDistanceKm,
  formatDistance,
  estimateWalkingMinutes,
  estimateDrivingMinutes,
  compareUserToStore
} from '../../services/locationService';
import {
  Flame,
  ArrowUpDown,
  UtensilsCrossed,
  Store as StoreIcon,
  Sparkles,
  MapPin,
  Filter,
  Compass,
  Footprints,
  Navigation,
  Coffee,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

export interface ParsedSearch {
  raw: string;
  isSpicy: boolean;
  isPriceUnder50: boolean;
  isCampusIntent: boolean;
  isCanteenIntent: boolean;
  isRecommendIntent: boolean;
  isStoreIntent: boolean;
  isFoodIntent: boolean;
  isNearMeIntent: boolean;
  isMilkStoreIntent: boolean;
  isFoodCourtNearMilkTeaIntent: boolean;
  displayPriority: 'stores' | 'food' | 'all';
  detectedIntentText?: string;
  keywords: string[];
}

// Campus zone shortcuts for store filtering
const CAMPUS_ZONES = [
  { id: 'all', name: 'ทุกโซน' },
  { id: 'complex', name: 'KKU Complex', keyword: 'complex' },
  { id: 'pond', name: 'สระพลาสติก (โรงชาย)', keyword: 'สระพลาสติก' },
  { id: 'kangsadan', name: 'กังสดาล', keyword: 'กังสดาล' },
  { id: 'med', name: 'ศูนย์แพทย์ / ศรีนครินทร์', keyword: 'ศรีนครินทร์' },
  { id: 'eng', name: 'คณะวิศวะ', keyword: 'วิศวะ' },
  { id: 'ucenter', name: 'หลังมอ U-Center', keyword: 'u-center' },
];

function parseNaturalSearch(query: string): ParsedSearch {
  const raw = query.toLowerCase().trim();
  if (!raw) {
    return {
      raw: '',
      isSpicy: false,
      isPriceUnder50: false,
      isCampusIntent: false,
      isCanteenIntent: false,
      isRecommendIntent: false,
      isStoreIntent: false,
      isFoodIntent: false,
      isNearMeIntent: false,
      isMilkStoreIntent: false,
      isFoodCourtNearMilkTeaIntent: false,
      displayPriority: 'all',
      keywords: []
    };
  }

  const isSpicy = raw.includes('เผ็ด');
  const isPriceUnder50 = raw.includes('50') || raw.includes('ไม่เกิน') || raw.includes('ประหยัด') || raw.includes('ถูก');

  // 1. Location-Aware & Comparison Intents
  // "ศูนย์อาหารใกล้ร้านชานม", "ศูนย์อาหารใกล้ร้านชานมใกล้ฉัน", "โรงอาหารใกล้ร้านชานม"
  const isFoodCourtNearMilkTeaIntent =
    (raw.includes('ศูนย์อาหาร') || raw.includes('โรงอาหาร') || raw.includes('canteen')) &&
    (raw.includes('ชานม') || raw.includes('ร้านนม') || raw.includes('นม') || raw.includes('boba') || raw.includes('tea'));

  // "ร้านค้านมใกล้ฉัน", "ร้านนมใกล้ฉัน", "ชานมใกล้ฉัน", "ร้านนม"
  const isMilkStoreIntent =
    raw.includes('ร้านค้านม') ||
    raw.includes('ร้านนม') ||
    raw.includes('ชานม') ||
    raw.includes('ชาไข่มุก') ||
    (raw.includes('นม') && (raw.includes('ร้าน') || raw.includes('ใกล้')));

  // "แนะนำร้านใกล้", "ร้านใกล้ฉัน", "ร้านใกล้", "ใกล้ฉัน", "ใกล้ผม"
  const nearKeywords = [
    'ใกล้ฉัน', 'ใกล้ผม', 'ใกล้หนู', 'ใกล้เรา', 'ใกล้ตัว', 'ใกล้ๆ', 'ใกล้สุด', 'ร้านใกล้',
    'แนะนำร้านใกล้', 'ใกล้ร้าน', 'ละแวกนี้', 'แถวนี้', 'ระยะใกล้'
  ];
  const isNearMeIntent = nearKeywords.some(kw => raw.includes(kw)) || raw === 'ใกล้';

  // 2. Store & Canteen Intent Keywords (e.g. "แนะนำร้านขายของให้หน่อย", "แนะนำร้าน", "โรงอาหาร")
  const storeKeywords = [
    'แนะนำร้าน', 'แนะนำร้านขายของ', 'ร้านขายของ', 'ร้านขายของให้หน่อย', 'ร้านค้า', 'ร้านอาหาร', 'แนะนำร้านอาหาร',
    'แนะนำโรงอาหาร', 'โรงอาหาร', 'ศูนย์อาหาร', 'canteen', 'food court', 'ร้านกาแฟ',
    'ร้านน้ำ', 'ร้านไหนดี', 'ร้านไหนอร่อย', 'ร้านเด็ด', 'ร้านดัง', 'ร้านแถว', 'ร้านใน', 'ร้าน'
  ];
  const isStoreIntent = storeKeywords.some(kw => raw.includes(kw)) || isNearMeIntent || isMilkStoreIntent || isFoodCourtNearMilkTeaIntent;

  // 3. Specific Campus & Location Keywords (e.g. "สระพลาสติก", "KKU Complex", "กังสดาล", "มอขอ")
  const campusKeywords = [
    'มอขอ', 'มข', 'kku', 'ขอนแก่น', 'แถวมอ', 'ในมอ', 'รอบมอ', 'หลังมอ', 'กังสดาล',
    'คอมเพล็กซ์', 'complex', 'สระพลาสติก', 'ศรท', 'โรงชาย', 'ศรีนครินทร์',
    'ศูนย์แพทย์', 'วิศวะ', 'วิดวะ', 'sc', 'u-center', 'cola', 'หอ 9', 'เกษตร'
  ];
  const isCampusIntent = campusKeywords.some(kw => raw.includes(kw));

  const isTargetedLocation = raw.includes('ไปที่') || raw.includes('เจาะจง') || raw.includes('พิกัด') || (raw.includes('ที่') && (isCampusIntent || campusKeywords.some(k => raw.includes(k))));

  const canteenKeywords = ['โรงอาหาร', 'ศูนย์อาหาร', 'canteen', 'food court'];
  const isCanteenIntent = canteenKeywords.some(kw => raw.includes(kw));

  const recommendKeywords = ['แนะนำ', 'ยอดนิยม', 'เด็ด', 'ดัง', 'อร่อย', 'ฮิต', 'ติดดาว'];
  const isRecommendIntent = recommendKeywords.some(kw => raw.includes(kw));

  // 4. Specific Food / Dish Keywords (e.g. "กะเพรา", "ก๋วยเตี๋ยว", "ต้มยำ", "ชาเขียว")
  const foodKeywords = [
    'กะเพรา', 'ก๋วยเตี๋ยว', 'ต้มยำ', 'ข้าวผัด', 'ไก่ทอด', 'หมูกรอบ', 'หมูแดง', 'ชา', 'กาแฟ',
    'ชาเขียว', 'ชาไทย', 'โกโก้', 'ส้มตำ', 'ลาบ', 'น้ำตก', 'ผัดไทย', 'ราดหน้า',
    'บะหมี่', 'ข้าวมันไก่', 'ข้าวขาหมู', 'แกง', 'สเต็ก', 'เบอร์เกอร์', 'ยำ', 'ลูกชิ้น',
    'ไอศกรีม', 'บิงซู', 'ของหวาน', 'ขนมปัง', 'โรตี', 'เครป', 'แซนด์วิช', 'ซูชิ', 'ซุป',
    'เกี๊ยว', 'ข้าวแกง', 'สลัด', 'อยากกิน', 'เมนู', 'อาหารจานเดียว', 'เครื่องดื่ม', 'น้ำปั่น'
  ];
  const isFoodIntent = foodKeywords.some(kw => raw.includes(kw));

  // 5. Determine display priority
  let displayPriority: 'stores' | 'food' | 'all' = 'all';

  if (isFoodCourtNearMilkTeaIntent || isMilkStoreIntent || isNearMeIntent || isStoreIntent || isCanteenIntent || isTargetedLocation) {
    displayPriority = 'stores';
  } else if (isFoodIntent) {
    displayPriority = 'food';
  } else if (isCampusIntent) {
    displayPriority = 'stores';
  }

  // Generate clear user-facing intent message
  let detectedIntentText: string | undefined = undefined;
  if (isFoodCourtNearMilkTeaIntent) {
    detectedIntentText = '🧋📍 เปรียบเทียบศูนย์อาหาร/โรงอาหารที่ตั้งอยู่ใกล้ร้านชานมมากที่สุด (คำนวณระยะพิกัดจริง)';
  } else if (isMilkStoreIntent && isNearMeIntent) {
    detectedIntentText = '🥛📍 แนะนำร้านค้านมสด & ชานมที่อยู่ใกล้คุณมากที่สุด (เรียงตามระยะห่างจริง)';
  } else if (isMilkStoreIntent) {
    detectedIntentText = '🥛 แนะนำร้านค้านมสด ชานมไข่มุก และเครื่องดื่มยอดนิยม';
  } else if (isNearMeIntent) {
    detectedIntentText = '📍 แนะนำร้านค้าและศูนย์อาหารที่อยู่ใกล้จุดที่คุณอยู่มากที่สุด (เรียงจากใกล้ไปไกล)';
  } else if (isStoreIntent && (raw.includes('ขายของ') || raw.includes('ร้าน'))) {
    detectedIntentText = '🏪 แนะนำร้านค้าและร้านขายของยอดนิยม (แสดงผลร้านค้าก่อน)';
  } else if (isTargetedLocation) {
    detectedIntentText = '📍 ค้นหาเจาะจงไปยังพิกัดและร้านค้าเป้าหมาย (แสดงร้านค้าก่อน)';
  } else if (isCampusIntent && isCanteenIntent) {
    detectedIntentText = '🎓 แนะนำศูนย์อาหารและโรงอาหารรอบรั้ว มข. (แสดงโรงอาหารก่อน)';
  } else if (isCampusIntent && isStoreIntent) {
    detectedIntentText = '🎓 แนะนำร้านเด็ดและร้านยอดนิยมรอบรั้ว มข. (แสดงร้านค้าก่อน)';
  } else if (isCampusIntent && !isFoodIntent) {
    detectedIntentText = '📍 ค้นหาร้านค้าและศูนย์อาหารในพื้นที่ มข. (แสดงร้านค้าก่อน)';
  } else if (isFoodIntent) {
    detectedIntentText = '🍴 เมนูอาหารที่ตรงกับคำค้นหา (แสดงรายการอาหารก่อน)';
  } else if (isStoreIntent) {
    detectedIntentText = '🏪 ร้านค้าและศูนย์อาหารที่แนะนำ (แสดงร้านค้าก่อน)';
  } else if (isRecommendIntent) {
    detectedIntentText = '⭐ แนะนำร้านและเมนูยอดนิยม';
  }

  // Remove stop words to extract specific search keywords
  let clean = raw;
  const stopWords = [
    'ศูนย์อาหารใกล้ร้านชานมใกล้ฉัน', 'ศูนย์อาหารใกล้ร้านชานม', 'โรงอาหารใกล้ร้านชานม',
    'ร้านค้านมใกล้ฉัน', 'ร้านนมใกล้ฉัน', 'แนะนำร้านใกล้ฉัน', 'แนะนำร้านใกล้',
    'ร้านใกล้ฉัน', 'ใกล้ฉัน', 'ใกล้ผม', 'ใกล้เรา', 'ใกล้ๆ', 'ใกล้สุด',
    'แนะนำร้านขายของให้หน่อย', 'แนะนำร้านขายของ', 'ร้านขายของให้หน่อย', 'ร้านขายของ',
    'แนะนำร้านอาหารแถวมอขอ', 'แนะนำโรงอาหารในมอขอ', 'แนะนำร้านแถวมอขอ', 'แนะนำโรงอาหารแถวมอขอ',
    'ร้านแถวมอขอ', 'โรงอาหารในมอขอ', 'แนะนำร้าน', 'แนะนำโรงอาหาร', 'แนะนำเมนู', 'แนะนำ',
    'ให้หน่อย', 'ร้านอาหาร', 'ศูนย์อาหาร', 'โรงอาหาร', 'แถวมอขอ', 'ในมอขอ', 'แถวมอ', 'ในมอ', 'มอขอ',
    'มข.', 'มข', 'รอบรั้ว', 'ขอนแก่น', 'kku', 'canteen', 'ของกิน', 'กินไรดี', 'กินอะไรดี',
    'ยอดนิยม', 'เด็ด', 'ดัง', 'อร่อย', 'ฮิต', 'มีอะไรบ้าง'
  ];

  stopWords.forEach(sw => {
    clean = clean.split(sw).join(' ');
  });

  const keywords = clean
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 1 && !['ร้าน', 'แถว', 'ใน', 'ที่', 'ของ', 'กับ', 'และ', 'ใกล้'].includes(w));

  return {
    raw,
    isSpicy,
    isPriceUnder50,
    isCampusIntent,
    isCanteenIntent,
    isRecommendIntent,
    isStoreIntent,
    isFoodIntent,
    isNearMeIntent,
    isMilkStoreIntent,
    isFoodCourtNearMilkTeaIntent,
    displayPriority,
    detectedIntentText,
    keywords
  };
}

export const SearchPage: React.FC = () => {
  const {
    stores,
    foodItems,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    spicyFilter,
    setSpicyFilter,
    maxPriceFilter,
    sortBy,
    setSortBy,
    setActiveFoodModal,
    setActiveStoreId,
    setCurrentView,
    userLocation,
    openProximityComparison,
    recordSearchQuery
  } = useQueue();

  const parsedQuery = useMemo(() => parseNaturalSearch(searchQuery), [searchQuery]);

  // Debounced search recording for freeform typed queries
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 3) {
      const timer = setTimeout(() => {
        recordSearchQuery(trimmed);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, recordSearchQuery]);

  // Active Tab: Stores / Food / All
  const [activeTab, setActiveTab] = useState<'all' | 'food' | 'stores'>('all');
  const [selectedZone, setSelectedZone] = useState<string>('all');

  // Automatically update active tab when search query priority changes
  useEffect(() => {
    if (parsedQuery.displayPriority === 'stores') {
      setActiveTab('stores');
    } else if (parsedQuery.displayPriority === 'food') {
      setActiveTab('food');
    } else {
      setActiveTab('all');
    }
  }, [parsedQuery.displayPriority, searchQuery]);

  // Milk tea & beverage stores collection
  const milkTeaStores = useMemo(() => {
    return stores.filter(s =>
      s.id === 'store-milk-1' ||
      s.id === 'store-milk-2' ||
      s.category === 'beverages' ||
      s.tags.some(t => t.includes('ชานม') || t.includes('นม') || t.includes('บราวน์ชูการ์')) ||
      s.name.includes('ชานม') ||
      s.name.includes('Tiger') ||
      s.name.includes('นมสด')
    );
  }, [stores]);

  // Comparative analysis: Canteens / Food Courts ranked by proximity to the nearest Milk Tea store
  const comparativeFoodCourts = useMemo(() => {
    if (!parsedQuery.isFoodCourtNearMilkTeaIntent) return [];

    const canteens = stores.filter(
      s => s.id.startsWith('store-kku-') ||
           s.name.includes('โรงอาหาร') ||
           s.name.includes('ศูนย์อาหาร') ||
           s.tags.some(t => t.includes('โรงอาหาร') || t.includes('ศูนย์อาหาร'))
    );

    return canteens.map(canteen => {
      const cLat = canteen.coordinates?.lat ?? 16.4746;
      const cLng = canteen.coordinates?.lng ?? 102.8258;

      let closestMilk = milkTeaStores[0] || stores[0];
      let minKm = 9999;

      milkTeaStores.forEach(milk => {
        const mLat = milk.coordinates?.lat ?? 16.4746;
        const mLng = milk.coordinates?.lng ?? 102.8258;
        const km = calculateDistanceKm(cLat, cLng, mLat, mLng);
        if (km < minKm) {
          minKm = km;
          closestMilk = milk;
        }
      });

      const walkingMin = estimateWalkingMinutes(minKm);
      const distanceFormatted = formatDistance(minKm);
      const userDistKm = calculateDistanceKm(userLocation.lat, userLocation.lng, cLat, cLng);

      return {
        canteen,
        closestMilk,
        distanceKm: minKm,
        distanceFormatted,
        walkingMinutes: walkingMin,
        userDistanceFormatted: formatDistance(userDistKm),
        badge: `ใกล้ ${closestMilk?.name || 'ร้านชานม'} ${distanceFormatted} (เดิน ~${walkingMin} น.)`
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [parsedQuery.isFoodCourtNearMilkTeaIntent, stores, milkTeaStores, userLocation]);

  const comparativeBadgeMap = useMemo(() => {
    const map: Record<string, string> = {};
    comparativeFoodCourts.forEach(item => {
      map[item.canteen.id] = item.badge;
    });
    return map;
  }, [comparativeFoodCourts]);

  // Filter Food Items
  const filteredFoodList = useMemo(() => {
    return foodItems.filter(item => {
      // 1. Natural search parser
      if (parsedQuery.raw) {
        if (parsedQuery.isSpicy && !item.spicyLevel) return false;
        if (parsedQuery.isPriceUnder50 && item.price > 50) return false;

        // If user is searching specifically for milk or milk tea
        if (parsedQuery.isMilkStoreIntent) {
          const isMilkDish =
            item.category === 'beverages' ||
            item.name.includes('นม') ||
            item.name.includes('ชา') ||
            item.name.includes('ชานม') ||
            item.tags.some(t => t.includes('นม') || t.includes('ชา'));
          if (!isMilkDish) return false;
        }

        const isKkuFood =
          item.storeId.startsWith('store-kku-') ||
          item.tags.some(t => t.toLowerCase().includes('มข') || t.toLowerCase().includes('kku'));

        if (parsedQuery.isCampusIntent && parsedQuery.keywords.length === 0) {
          if (!isKkuFood) return false;
        } else if (parsedQuery.keywords.length > 0) {
          if (parsedQuery.isCampusIntent && !isKkuFood) return false;

          const match = parsedQuery.keywords.some(kw => {
            return (
              item.name.toLowerCase().includes(kw) ||
              item.nameEn.toLowerCase().includes(kw) ||
              item.description.toLowerCase().includes(kw) ||
              item.storeName.toLowerCase().includes(kw) ||
              item.tags.some(t => t.toLowerCase().includes(kw))
            );
          });

          if (!match) return false;
        } else if (!parsedQuery.isNearMeIntent && !parsedQuery.isMilkStoreIntent && !parsedQuery.isFoodCourtNearMilkTeaIntent) {
          const q = parsedQuery.raw;
          const matchName = item.name.toLowerCase().includes(q) || item.nameEn.toLowerCase().includes(q);
          const matchDesc = item.description.toLowerCase().includes(q);
          const matchStore = item.storeName.toLowerCase().includes(q);
          const matchTags = item.tags.some(t => t.toLowerCase().includes(q));
          if (!matchName && !matchDesc && !matchStore && !matchTags) return false;
        }
      }

      // 2. Category match
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'canteen') {
          if (!item.storeId.startsWith('store-kku-')) return false;
        } else if (item.category !== selectedCategory) {
          return false;
        }
      }

      // 3. Spicy only filter
      if (spicyFilter && !item.spicyLevel) {
        return false;
      }

      // 4. Max price filter
      if (item.price > maxPriceFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price-asc') return a.price - b.price;
      return b.orderCount - a.orderCount;
    });
  }, [foodItems, parsedQuery, selectedCategory, spicyFilter, maxPriceFilter, sortBy]);

  // Filter Stores
  const filteredStores = useMemo(() => {
    // Special Intent: "ศูนย์อาหารใกล้ร้านชานม" / "ศูนย์อาหารใกล้ร้านชานมใกล้ฉัน"
    if (parsedQuery.isFoodCourtNearMilkTeaIntent && comparativeFoodCourts.length > 0) {
      const canteensSorted = comparativeFoodCourts.map(c => c.canteen);
      // Combine canteens and the milk tea stores for full context
      const otherMilkStores = milkTeaStores.filter(m => !canteensSorted.some(c => c.id === m.id));
      return [...canteensSorted, ...otherMilkStores];
    }

    const filtered = stores.filter(s => {
      if (parsedQuery.raw) {
        // Special Intent: "ร้านค้านมใกล้ฉัน" / "ร้านนมใกล้ฉัน"
        if (parsedQuery.isMilkStoreIntent) {
          const isMilkStore =
            s.id === 'store-milk-1' ||
            s.id === 'store-milk-2' ||
            s.category === 'beverages' ||
            s.tags.some(t => t.includes('ชานม') || t.includes('นม') || t.includes('บราวน์ชูการ์')) ||
            s.name.includes('ชานม') ||
            s.name.includes('Tiger') ||
            s.name.includes('นมสด');
          if (!isMilkStore) return false;
        }

        const isKkuStore =
          s.id.startsWith('store-kku-') ||
          s.address.toLowerCase().includes('ขอนแก่น') ||
          s.address.toLowerCase().includes('มข') ||
          s.tags.some(t => t.toLowerCase().includes('มข') || t.toLowerCase().includes('kku') || t.toLowerCase().includes('โรงอาหาร'));

        const isCanteenStore =
          s.name.includes('โรงอาหาร') ||
          s.name.includes('ศูนย์อาหาร') ||
          s.tags.some(t => t.includes('โรงอาหาร') || t.includes('ศูนย์อาหาร') || t.includes('ร้านค้า'));

        // If user specifically asked for campus canteens ("แนะนำโรงอาหารในมอขอ")
        if (parsedQuery.isCampusIntent && parsedQuery.isCanteenIntent && parsedQuery.keywords.length === 0) {
          if (!isKkuStore || !isCanteenStore) return false;
          return true;
        }

        // If user asked for campus recommendations or stores ("แนะนำร้านแถวมอขอ", "แนะนำร้านขายของ")
        if ((parsedQuery.isCampusIntent || parsedQuery.isStoreIntent) && parsedQuery.keywords.length === 0) {
          if (parsedQuery.isCampusIntent && !isKkuStore) return false;
          return true;
        }

        // If user asked for general canteens ("โรงอาหาร")
        if (parsedQuery.isCanteenIntent && parsedQuery.keywords.length === 0) {
          if (!isCanteenStore) return false;
          return true;
        }

        // If user asked for recommendations in general ("แนะนำ", "ร้านแนะนำ")
        if (parsedQuery.isRecommendIntent && parsedQuery.keywords.length === 0) {
          if (s.rating < 4.7 && s.reviewCount < 200) return false;
          return true;
        }

        // If intent is "แนะนำร้านใกล้" / "ร้านใกล้ฉัน" with no specific leftover keywords
        if (parsedQuery.isNearMeIntent && parsedQuery.keywords.length === 0) {
          return true;
        }

        // Specific keywords search
        if (parsedQuery.keywords.length > 0) {
          if (parsedQuery.isCampusIntent && !isKkuStore) return false;
          if (parsedQuery.isCanteenIntent && !isCanteenStore) return false;

          const match = parsedQuery.keywords.some(kw => {
            return (
              s.name.toLowerCase().includes(kw) ||
              s.nameEn.toLowerCase().includes(kw) ||
              s.description.toLowerCase().includes(kw) ||
              s.address.toLowerCase().includes(kw) ||
              (s.addressDetail || '').toLowerCase().includes(kw) ||
              s.tags.some(t => t.toLowerCase().includes(kw)) ||
              (s.nearestStation || '').toLowerCase().includes(kw)
            );
          });

          if (!match) return false;
        } else if (!parsedQuery.isNearMeIntent && !parsedQuery.isMilkStoreIntent) {
          // Fallback exact query match
          const q = parsedQuery.raw;
          const matchName = s.name.toLowerCase().includes(q) || s.nameEn.toLowerCase().includes(q);
          const matchDesc = s.description.toLowerCase().includes(q);
          const matchAddress = s.address.toLowerCase().includes(q) || (s.addressDetail || '').toLowerCase().includes(q);
          const matchTags = s.tags.some(t => t.toLowerCase().includes(q));
          const matchStation = (s.nearestStation || '').toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchAddress && !matchTags && !matchStation) return false;
        }
      }

      // Zone filter for stores
      if (selectedZone !== 'all') {
        const zoneObj = CAMPUS_ZONES.find(z => z.id === selectedZone);
        if (zoneObj && zoneObj.keyword) {
          const kw = zoneObj.keyword.toLowerCase();
          const match =
            s.name.toLowerCase().includes(kw) ||
            s.address.toLowerCase().includes(kw) ||
            (s.addressDetail || '').toLowerCase().includes(kw) ||
            s.tags.some(t => t.toLowerCase().includes(kw));
          if (!match) return false;
        }
      }

      if (selectedCategory !== 'all') {
        if (selectedCategory === 'canteen') {
          if (!s.id.startsWith('store-kku-') && !s.tags.some(t => t.includes('โรงอาหาร') || t.includes('มข'))) return false;
        } else {
          const matchTag = s.tags.some(t => t.includes(selectedCategory));
          if (!matchTag && s.category !== selectedCategory) return false;
        }
      }
      return true;
    });

    // Proximity Sorting: If user searched "ใกล้ฉัน" / "แนะนำร้านใกล้" or chose "distance" in sort dropdown
    if (parsedQuery.isNearMeIntent || sortBy === 'distance') {
      return [...filtered].sort((a, b) => {
        const distA = calculateDistanceKm(
          userLocation.lat,
          userLocation.lng,
          a.coordinates?.lat ?? 16.4746,
          a.coordinates?.lng ?? 102.8258
        );
        const distB = calculateDistanceKm(
          userLocation.lat,
          userLocation.lng,
          b.coordinates?.lat ?? 16.4746,
          b.coordinates?.lng ?? 102.8258
        );
        return distA - distB;
      });
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price-asc') return a.priceRange.length - b.priceRange.length;
      return b.reviewCount - a.reviewCount;
    });
  }, [
    stores,
    parsedQuery,
    selectedZone,
    selectedCategory,
    sortBy,
    userLocation,
    comparativeFoodCourts,
    milkTeaStores
  ]);

  const totalResults = filteredFoodList.length + filteredStores.length;

  // Render Stores Grid Component
  const renderStoresSection = (showTitle: boolean = true) => {
    if (filteredStores.length === 0) return null;
    return (
      <div className="space-y-3.5">
        {showTitle && (
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <StoreIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>ร้านค้า & ศูนย์อาหาร ({filteredStores.length})</span>
              {parsedQuery.displayPriority === 'stores' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                  {parsedQuery.isNearMeIntent ? '📍 เรียงตามระยะห่างจริง' : 'แนะนำเป็นอันดับแรก'}
                </span>
              )}
            </h3>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStores.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              comparativeBadge={comparativeBadgeMap[store.id]}
              onSelect={s => {
                setActiveStoreId(s.id);
                setCurrentView('store-detail');
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  // Render Food Items Grid Component
  const renderFoodSection = (showTitle: boolean = true) => {
    if (filteredFoodList.length === 0) return null;
    return (
      <div className="space-y-3.5">
        {showTitle && (
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-amber-500" />
              <span>เมนูอาหาร ({filteredFoodList.length})</span>
              {parsedQuery.displayPriority === 'food' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  แนะนำเป็นอันดับแรก
                </span>
              )}
            </h3>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredFoodList.map(food => (
            <FoodCard
              key={food.id}
              food={food}
              onSelect={setActiveFoodModal}
              onQuickAdd={setActiveFoodModal}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 pb-16 text-stone-900 dark:text-zinc-100">
      {/* 1. Header & Location Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">
            ค้นหาเมนูอาหาร & ร้านค้า
          </h1>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
            ค้นหาเมนู โรงอาหาร หรือร้านใกล้ฉันพร้อมคำนวณระยะทางจริง
          </p>
        </div>
        <UserLocationBar />
      </div>

      {/* Search Input Bar */}
      <div className="flex flex-col gap-2.5">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          showSuggestions={true}
        />

        {parsedQuery.detectedIntentText && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 dark:from-zinc-900 dark:to-zinc-800 dark:border-zinc-700 text-xs font-semibold text-orange-950 dark:text-orange-300 shadow-xs animate-in fade-in duration-150">
            <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
            <span>{parsedQuery.detectedIntentText}</span>
          </div>
        )}
      </div>

      {/* Special Comparison Panel: Food Courts near Milk Tea Shops */}
      {parsedQuery.isFoodCourtNearMilkTeaIntent && comparativeFoodCourts.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 border-2 border-orange-300 dark:border-orange-800 space-y-3.5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-xl bg-orange-600 text-white shadow-xs">
                <Compass className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black text-stone-900 dark:text-white">
                  เปรียบเทียบพิกัด: ศูนย์อาหารที่ตั้งอยู่ใกล้ร้านชานม/ร้านนมมากที่สุด
                </h3>
                <p className="text-xs text-stone-600 dark:text-zinc-400">
                  ระบบคำนวณระยะห่างทางกายภาพจริงระหว่างจุดที่ตั้งศูนย์อาหาร กับร้านชานมที่อยู่ใกล้ที่สุด
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto text-[11px] font-black px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/80 dark:text-orange-200">
              📍 เรียงตามความใกล้ร้านชานม
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {comparativeFoodCourts.slice(0, 3).map((item, idx) => (
              <div
                key={item.canteen.id}
                className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-orange-200 dark:border-zinc-700 space-y-2.5 shadow-2xs hover:border-orange-400 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[11px] font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate max-w-[160px]">
                      {item.canteen.name}
                    </h4>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    ใกล้สุด {item.distanceFormatted}
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-orange-50/70 dark:bg-zinc-800/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-stone-700 dark:text-zinc-300">
                    <span className="flex items-center gap-1 font-medium">
                      <Coffee className="w-3.5 h-3.5 text-orange-500" />
                      ร้านชานมที่ใกล้:
                    </span>
                    <strong className="text-orange-700 dark:text-orange-400 font-bold truncate max-w-[110px]">
                      {item.closestMilk?.name}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-stone-500 dark:text-zinc-400 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Footprints className="w-3 h-3 text-emerald-600" />
                      เดินถึงใน:
                    </span>
                    <strong className="text-stone-800 dark:text-zinc-200 font-bold">
                      ประมาณ {item.walkingMinutes} นาที ({item.distanceFormatted})
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveStoreId(item.canteen.id);
                      setCurrentView('store-detail');
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 text-xs font-bold text-center transition-colors cursor-pointer"
                  >
                    ดูศูนย์อาหารนี้
                  </button>
                  <button
                    type="button"
                    onClick={() => openProximityComparison(item.canteen)}
                    className="py-1.5 px-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    title="เปรียบเทียบกับพิกัดของคุณ"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>เปรียบเทียบ</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Unified Primary Tabs (Ordered based on search intent priority) */}
      <div className="flex items-center gap-2 border-b border-orange-100 dark:border-zinc-800 pb-2.5 overflow-x-auto scrollbar-none">
        {parsedQuery.displayPriority === 'stores' ? (
          // Store Priority Order: Stores -> Food -> All
          <>
            <button
              onClick={() => setActiveTab('stores')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'stores'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-orange-50 dark:hover:bg-zinc-800'
              }`}
            >
              <StoreIcon className="w-4 h-4" />
              <span>ร้านค้า & ศูนย์อาหาร</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'stores' ? 'bg-white/20' : 'bg-stone-200 dark:bg-zinc-700'}`}>
                {filteredStores.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('food')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'food'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-orange-50 dark:hover:bg-zinc-800'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>เมนูอาหาร</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'food' ? 'bg-white/20' : 'bg-stone-200 dark:bg-zinc-700'}`}>
                {filteredFoodList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-orange-50 dark:hover:bg-zinc-800'
              }`}
            >
              <span>ผลลัพธ์ทั้งหมด</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20' : 'bg-stone-200 dark:bg-zinc-700'}`}>
                {totalResults}
              </span>
            </button>
          </>
        ) : (
          // Food Priority or Default Order: Food -> Stores -> All
          <>
            <button
              onClick={() => setActiveTab('food')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'food'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-orange-50 dark:hover:bg-zinc-800'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>เมนูอาหาร</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'food' ? 'bg-white/20' : 'bg-stone-200 dark:bg-zinc-700'}`}>
                {filteredFoodList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('stores')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'stores'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-orange-50 dark:hover:bg-zinc-800'
              }`}
            >
              <StoreIcon className="w-4 h-4" />
              <span>ร้านค้า & ศูนย์อาหาร</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'stores' ? 'bg-white/20' : 'bg-stone-200 dark:bg-zinc-700'}`}>
                {filteredStores.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-orange-50 dark:hover:bg-zinc-800'
              }`}
            >
              <span>ผลลัพธ์ทั้งหมด</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20' : 'bg-stone-200 dark:bg-zinc-700'}`}>
                {totalResults}
              </span>
            </button>
          </>
        )}
      </div>

      {/* 3. Secondary Toolbar: Contextual Filters (Non-overlapping, clear purpose) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-stone-50/80 dark:bg-zinc-900/60 border border-stone-200/80 dark:border-zinc-800 shadow-2xs">
        {/* Left side: Context-sensitive pills */}
        {activeTab === 'stores' ? (
          // Store Zone selector
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 flex items-center gap-1 shrink-0 mr-1">
              <MapPin className="w-3.5 h-3.5 text-orange-500" /> โซน:
            </span>
            {CAMPUS_ZONES.map(zone => (
              <button
                key={zone.id}
                onClick={() => setSelectedZone(zone.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                  selectedZone === zone.id
                    ? 'bg-orange-500 text-white border-orange-500 shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-orange-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                }`}
              >
                {zone.name}
              </button>
            ))}
          </div>
        ) : (
          // Food Categories selector (No duplicate "ทั้งหมด", labeled as "หมวดอาหาร:")
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3.5 h-3.5 text-amber-500" /> หมวดอาหาร:
            </span>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-orange-500 text-white border-orange-500 shadow-2xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-orange-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                }`}
              >
                {cat.id === 'all' ? 'ทุกหมวดหมู่' : cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Right side: Quick Toggles and Sort */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {activeTab !== 'stores' && (
            <button
              onClick={() => setSpicyFilter(!spicyFilter)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                spicyFilter
                  ? 'bg-red-500/15 text-red-600 border-red-400 dark:bg-red-500/20 dark:text-red-300'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
              }`}
              title="กรองเฉพาะอาหารที่มีรสเผ็ด"
            >
              <Flame className="w-3.5 h-3.5 text-red-500" />
              <span>เฉพาะเมนูเผ็ด</span>
            </button>
          )}

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-stone-700 dark:text-zinc-300 shadow-2xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-orange-500" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-stone-900 dark:text-zinc-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="popular" className="bg-white dark:bg-zinc-900">ความนิยมสูงสุด</option>
              <option value="distance" className="bg-white dark:bg-zinc-900">📍 ใกล้ฉันที่สุด (คำนวณพิกัด)</option>
              <option value="rating" className="bg-white dark:bg-zinc-900">คะแนนรีวิวสูงสุด</option>
              <option value="price-asc" className="bg-white dark:bg-zinc-900">ราคา: ต่ำไปสูง</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Results Counter & Reset Action */}
      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400 px-1">
        <span>
          พบ{' '}
          <strong className="text-orange-600 dark:text-orange-400 font-bold">
            {activeTab === 'all'
              ? totalResults
              : activeTab === 'stores'
              ? filteredStores.length
              : filteredFoodList.length}
          </strong>{' '}
          รายการ
          {searchQuery && <span> สำหรับ "{searchQuery}"</span>}
        </span>

        {(searchQuery || selectedCategory !== 'all' || selectedZone !== 'all' || spicyFilter) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedZone('all');
              setSpicyFilter(false);
            }}
            className="text-orange-600 hover:text-orange-700 dark:text-orange-400 font-bold cursor-pointer hover:underline"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        )}
      </div>

      {/* 5. Results Content Area with Smart Hierarchical Ordering */}
      {totalResults === 0 ? (
        <div className="py-12">
          <EmptyState
            title="ไม่พบผลลัพธ์ที่คุณค้นหา"
            description="ลองค้นหาด้วยคำอื่น เช่น แนะนำร้านแถวมอขอ, กะเพราหมูกรอบ, KKU Complex, ก๋วยเตี๋ยวเรือ หรือสระพลาสติก"
            actionText="ล้างการค้นหาทั้งหมด"
            onAction={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedZone('all');
              setSpicyFilter(false);
            }}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {activeTab === 'stores' && renderStoresSection(false)}

          {activeTab === 'food' && renderFoodSection(false)}

          {activeTab === 'all' && (
            // In 'all' view, display according to priority:
            parsedQuery.displayPriority === 'stores' ? (
              // Stores first, then Food
              <>
                {renderStoresSection(true)}
                {renderFoodSection(true)}
              </>
            ) : (
              // Food first, then Stores
              <>
                {renderFoodSection(true)}
                {renderStoresSection(true)}
              </>
            )
          )}
        </div>
      )}
    </div>
  );
};
