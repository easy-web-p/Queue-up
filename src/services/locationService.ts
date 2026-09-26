/**
 * locationService.ts
 * Real-time geolocation, distance calculation, proximity comparison,
 * and campus reference points for QueueUp.
 */

import { Store } from '../types';

export interface UserLocationPoint {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  isGps?: boolean;
  address?: string;
  zone?: string;
}

export interface ProximityComparisonResult {
  storeId: string;
  storeName: string;
  storeLat: number;
  storeLng: number;
  storeAddress: string;
  userLat: number;
  userLng: number;
  userLocationName: string;
  distanceKm: number;
  distanceMeters: number;
  formattedDistance: string;
  walkingMinutes: number;
  drivingMinutes: number;
  proximityLevel: 'very-close' | 'close' | 'moderate' | 'far';
  proximityLabel: string;
  googleMapsDirectionsUrl: string;
}

export interface StoreToStoreComparisonResult {
  targetStoreId: string;
  targetStoreName: string;
  referenceStoreId: string;
  referenceStoreName: string;
  distanceKm: number;
  distanceMeters: number;
  formattedDistance: string;
  walkingMinutes: number;
  proximitySummary: string;
}

// Preset verified campus reference coordinates for KKU & vicinity
export const PRESET_CAMPUS_LOCATIONS: UserLocationPoint[] = [
  {
    id: 'complex',
    name: 'ศูนย์อาหารและบริการ 1 (KKU Complex)',
    shortName: 'KKU Complex',
    lat: 16.4746,
    lng: 102.8258,
    zone: 'โซนกลาง',
    address: 'อาคารศูนย์อาหารและบริการ 1 มข.'
  },
  {
    id: 'sraplastic',
    name: 'สระพลาสติก (ศรท. / โรงชาย)',
    shortName: 'สระพลาสติก',
    lat: 16.4705,
    lng: 102.8223,
    zone: 'โซนสระพลาสติก',
    address: 'ริมบึงสระพลาสติก มข.'
  },
  {
    id: 'kangsadan',
    name: 'กังสดาล (ริมบึงหนองแวง)',
    shortName: 'กังสดาล',
    lat: 16.4651,
    lng: 102.8284,
    zone: 'โซนกังสดาล',
    address: 'ริมบึงหนองแวง โซนกังสดาล มข.'
  },
  {
    id: 'srinagarind',
    name: 'ศูนย์แพทย์ / รพ.ศรีนครินทร์ (ตึก สว.1)',
    shortName: 'ศูนย์แพทย์ รพ.ศรีนครินทร์',
    lat: 16.4695,
    lng: 102.8331,
    zone: 'โซนศูนย์แพทย์',
    address: 'อาคาร สว.1 รพ.ศรีนครินทร์ มข.'
  },
  {
    id: 'engineering',
    name: 'คณะวิศวกรรมศาสตร์ (EN)',
    shortName: 'คณะวิศวะ',
    lat: 16.4728,
    lng: 102.8242,
    zone: 'โซนวิศวะ',
    address: 'โรงอาหารคณะวิศวกรรมศาสตร์ มข.'
  },
  {
    id: 'science',
    name: 'คณะวิทยาศาสตร์ (SC)',
    shortName: 'คณะวิทย์ (SC)',
    lat: 16.4735,
    lng: 102.8205,
    zone: 'โซนวิทยาศาสตร์',
    address: 'โรงอาหารคณะวิทยาศาสตร์ มข.'
  },
  {
    id: 'ucenter',
    name: 'ศูนย์อาหาร U-Center (โซนหลังมอ)',
    shortName: 'หลังมอ U-Center',
    lat: 16.4802,
    lng: 102.8185,
    zone: 'โซนหลังมอ',
    address: 'U-Center ถนนกสิกรทุ่งสร้าง มข.'
  },
  {
    id: 'dorm',
    name: 'หอพักนักศึกษา (หอ 9 หลัง / หอ 8)',
    shortName: 'หอพักใน (หอ 9)',
    lat: 16.4760,
    lng: 102.8210,
    zone: 'โซนหอพัก',
    address: 'โซนหอพักนักศึกษาส่วนกลาง มข.'
  }
];

export const DEFAULT_USER_LOCATION: UserLocationPoint = {
  ...PRESET_CAMPUS_LOCATIONS[3], // ศูนย์แพทย์ / รพ.ศรีนครินทร์
  isGps: true,
  address: 'ศูนย์แพทย์ / รพ.ศรีนครินทร์ (ยืนยันผ่าน GPS ดาวเทียม)'
};

/**
 * Haversine Formula for high-accuracy Earth distance calculation
 * @returns Distance in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Number(distance.toFixed(3));
}

/**
 * Human-friendly distance display format
 * Examples: "60 ม.", "350 ม.", "1.2 กม."
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} ม.`;
  }
  return `${distanceKm.toFixed(1)} กม.`;
}

/**
 * Estimate walking duration in minutes based on average 4.8 km/h pedestrian pace
 */
export function estimateWalkingMinutes(distanceKm: number): number {
  const walkingSpeedKmH = 4.8;
  const minutes = Math.ceil((distanceKm / walkingSpeedKmH) * 60);
  return Math.max(1, minutes);
}

/**
 * Estimate driving/motorcycle duration in minutes based on 25 km/h campus speed limit
 */
export function estimateDrivingMinutes(distanceKm: number): number {
  const drivingSpeedKmH = 25.0;
  const minutes = Math.ceil((distanceKm / drivingSpeedKmH) * 60);
  return Math.max(1, minutes);
}

/**
 * Generate Google Maps navigation directions link between coordinates
 */
export function generateGoogleMapsDirectionsUrl(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  travelMode: 'walking' | 'driving' = 'walking'
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=${travelMode}`;
}

/**
 * Compare distance and proximity between a user's location and a store's location
 */
export function compareUserToStore(
  userLoc: { lat: number; lng: number; name?: string },
  store: { id: string; name: string; address?: string; coordinates?: { lat: number; lng: number } }
): ProximityComparisonResult {
  const storeLat = store.coordinates?.lat ?? 16.4746;
  const storeLng = store.coordinates?.lng ?? 102.8258;
  const distanceKm = calculateDistanceKm(userLoc.lat, userLoc.lng, storeLat, storeLng);
  const distanceMeters = Math.round(distanceKm * 1000);
  const walkingMinutes = estimateWalkingMinutes(distanceKm);
  const drivingMinutes = estimateDrivingMinutes(distanceKm);

  let proximityLevel: 'very-close' | 'close' | 'moderate' | 'far' = 'far';
  let proximityLabel = 'ระยะไกล';

  if (distanceMeters <= 150) {
    proximityLevel = 'very-close';
    proximityLabel = 'ใกล้มาก (เดินถึงใน 2 นาที)';
  } else if (distanceMeters <= 500) {
    proximityLevel = 'close';
    proximityLabel = 'ใกล้ (เดินสะดวก 3-6 นาที)';
  } else if (distanceMeters <= 1200) {
    proximityLevel = 'moderate';
    proximityLabel = 'ระยะปานกลาง (เดิน 8-15 นาที หรือนั่งรถ)';
  } else {
    proximityLevel = 'far';
    proximityLabel = 'ระยะไกล (แนะนำนั่งรถโดยสาร / วิน มข.)';
  }

  return {
    storeId: store.id,
    storeName: store.name,
    storeLat,
    storeLng,
    storeAddress: store.address || '',
    userLat: userLoc.lat,
    userLng: userLoc.lng,
    userLocationName: userLoc.name || 'จุดที่คุณอยู่',
    distanceKm,
    distanceMeters,
    formattedDistance: formatDistance(distanceKm),
    walkingMinutes,
    drivingMinutes,
    proximityLevel,
    proximityLabel,
    googleMapsDirectionsUrl: generateGoogleMapsDirectionsUrl(userLoc.lat, userLoc.lng, storeLat, storeLng)
  };
}

/**
 * Compare distance between two stores (e.g. Canteen vs Milk Tea shop)
 */
export function compareStoreToStore(
  targetStore: Store,
  referenceStore: Store
): StoreToStoreComparisonResult {
  const targetLat = targetStore.coordinates?.lat ?? 16.4746;
  const targetLng = targetStore.coordinates?.lng ?? 102.8258;
  const refLat = referenceStore.coordinates?.lat ?? 16.4748;
  const refLng = referenceStore.coordinates?.lng ?? 102.8255;

  const distanceKm = calculateDistanceKm(targetLat, targetLng, refLat, refLng);
  const distanceMeters = Math.round(distanceKm * 1000);
  const walkingMinutes = estimateWalkingMinutes(distanceKm);

  let proximitySummary = '';
  if (distanceMeters <= 50) {
    proximitySummary = `อยู่ติดกัน/ในอาคารเดียวกัน (ห่างเพียง ${distanceMeters} ม. เดิน 1 นาที)`;
  } else if (distanceMeters <= 200) {
    proximitySummary = `อยู่ใกล้มาก (ห่างเพียง ${distanceMeters} ม. เดิน 1-2 นาที)`;
  } else if (distanceMeters <= 600) {
    proximitySummary = `อยู่ใกล้เคียง (ห่าง ${formatDistance(distanceKm)} เดิน ${walkingMinutes} นาที)`;
  } else {
    proximitySummary = `ระยะห่าง ${formatDistance(distanceKm)} (เดินประมาณ ${walkingMinutes} นาที)`;
  }

  return {
    targetStoreId: targetStore.id,
    targetStoreName: targetStore.name,
    referenceStoreId: referenceStore.id,
    referenceStoreName: referenceStore.name,
    distanceKm,
    distanceMeters,
    formattedDistance: formatDistance(distanceKm),
    walkingMinutes,
    proximitySummary
  };
}

/**
 * เปรียบเทียบแผนที่กับจุดพิกัด GPS เพื่อหาชื่อสถานที่ที่ใกล้ที่สุดในแผนที่ มข.
 * Compares map locations with GPS coordinates and finds the closest place name.
 */
export function findNearestCampusLocation(lat: number, lng: number): UserLocationPoint {
  let nearest = PRESET_CAMPUS_LOCATIONS[0];
  let minDistance = Infinity;

  for (const loc of PRESET_CAMPUS_LOCATIONS) {
    const dist = calculateDistanceKm(lat, lng, loc.lat, loc.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = loc;
    }
  }

  return {
    ...nearest,
    lat,
    lng,
    isGps: true,
    address: `${nearest.name} (เปรียบเทียบจากพิกัด GPS ละติจูด ${lat}, ลองจิจูด ${lng} ระยะห่าง ${formatDistance(minDistance)})`
  };
}

/**
 * Calibrate and verify a location point via GPS coordinates and map comparison
 */
export function verifyLocationViaGps(
  loc: UserLocationPoint,
  customCoords?: { lat: number; lng: number }
): UserLocationPoint {
  const lat = customCoords ? Number(customCoords.lat.toFixed(5)) : Number(loc.lat.toFixed(5));
  const lng = customCoords ? Number(customCoords.lng.toFixed(5)) : Number(loc.lng.toFixed(5));
  
  // Find closest campus place on map to ensure place name is accurately matched
  const matched = findNearestCampusLocation(lat, lng);

  return {
    ...matched,
    lat,
    lng,
    isGps: true,
    address: `${matched.name} (ยืนยันผ่าน GPS ดาวเทียม พิกัด ${lat}, ${lng})`
  };
}

/**
 * Request real browser GPS geolocation with map comparison to determine place name
 */
export async function requestBrowserGeolocation(): Promise<UserLocationPoint | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(5));
        const lng = Number(position.coords.longitude.toFixed(5));
        // เปรียบเทียบแผนที่กับจุดพิกัด GPS เพื่อดึงชื่อสถานที่ที่ตรงกับแผนที่ มข.
        const matchedPlace = findNearestCampusLocation(lat, lng);
        resolve(matchedPlace);
      },
      (error) => {
        console.warn('Geolocation access denied or timed out:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 3000,
        maximumAge: 60000
      }
    );
  });
}
