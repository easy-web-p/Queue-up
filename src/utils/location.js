/**
 * Location and Distance Utilities for QueueUp School Food (JavaScript)
 */

export const SchoolLandmarks = {
  BUILDING_1: { name: 'อาคาร 1 (เรียนรวม)', lat: 13.7563, lng: 100.5018 },
  BUILDING_2: { name: 'อาคาร 2 (โรงอาหารกลาง)', lat: 13.7568, lng: 100.5023 },
  BUILDING_3: { name: 'อาคาร 3 (ศูนย์คอมพิวเตอร์)', lat: 13.7574, lng: 100.5029 },
  ATHLETIC_FIELD: { name: 'สนามเปิด/อาคารกีฬา', lat: 13.7580, lng: 100.5035 },
  DORMITORY: { name: 'หอพักนักศึกษา', lat: 13.7555, lng: 100.5010 }
};

/**
 * Calculate distance between two coordinates in meters using Haversine formula
 */
export function calculateDistanceMeters(coord1, coord2) {
  if (!coord1 || !coord2) return 80;
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;

  const dLat = (coord2.lat - coord1.lat) * rad;
  const dLng = (coord2.lng - coord1.lng) * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * rad) *
      Math.cos(coord2.lat * rad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Format distance into human readable Thai string
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    const walkMinutes = Math.max(1, Math.round(meters / 60));
    return `${meters} เมตร (เดิน ~${walkMinutes} นาที)`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} กม.`;
}

/**
 * Get user's current GPS position
 */
export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          resolve(SchoolLandmarks.BUILDING_1);
        },
        { timeout: 5000 }
      );
    } else {
      resolve(SchoolLandmarks.BUILDING_1);
    }
  });
}
