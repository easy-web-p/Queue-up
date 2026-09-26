import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { Canteen } from '../types';

export const INITIAL_CANTEENS: Canteen[] = [
  {
    id: 1,
    nameTh: 'ศูนย์อาหารและบริการ 1 (KKU Complex)',
    nameEn: 'KKU Complex Canteen',
    zone: 'โซนกลาง',
    lat: 16.474620,
    lng: 102.824180,
    openingHours: '06:00 - 19:30',
    storeCount: 45,
    smartTransit: 'สายสีแดง, ส้ม, น้ำเงิน',
    popularMenus: 'ก๋วยเตี๋ยวต้มยำ (40-50฿), ข้าวมันไก่ผสม (45-50฿), สเต็กเด็กแนว (59-89฿)',
    mapsUrl: 'https://maps.google.com/?q=16.474620,102.824180'
  },
  {
    id: 2,
    nameTh: 'ศูนย์อาหารสระพลาสติก (ศรท. / โรงชาย)',
    nameEn: 'Sra Plastic Lakeside',
    zone: 'ริมบึงสระพลาสติก',
    lat: 16.473500,
    lng: 102.828750,
    openingHours: '06:30 - 15:30',
    storeCount: 18,
    smartTransit: 'สายสีน้ำเงิน, แดง',
    popularMenus: 'ส้มตำปูปลาร้า/ลาบหมู (40-60฿), ข้าวเปียกเส้น (40-50฿), ข้าวขาหมู (45-55฿)',
    mapsUrl: 'https://maps.google.com/?q=16.473500,102.828750'
  },
  {
    id: 3,
    nameTh: 'ศูนย์อาหารและบริการ 2 (กังสดาล)',
    nameEn: 'Kangsadan Canteen',
    zone: 'โซนกังสดาล',
    lat: 16.458920,
    lng: 102.826480,
    openingHours: '06:00 - 18:30',
    storeCount: 22,
    smartTransit: 'สายสีแดง, เขียว, ม่วง',
    popularMenus: 'แกงคั่วกลิ้งใต้ (35-45฿), ข้าวไข่เจียวทรงเครื่อง (35-40฿), บะหมี่เป็ดย่าง (45-60฿)',
    mapsUrl: 'https://maps.google.com/?q=16.458920,102.826480'
  },
  {
    id: 4,
    nameTh: 'ศูนย์อาหาร รพ.ศรีนครินทร์ (ตึก สว.1)',
    nameEn: 'Srinagarind Hospital',
    zone: 'โซนศูนย์แพทย์',
    lat: 16.467310,
    lng: 102.831450,
    openingHours: '05:30 - 20:00',
    storeCount: 30,
    smartTransit: 'สายสีน้ำเงิน, เขียว, แดง',
    popularMenus: 'โจ๊กหมูเด้งใส่ไข่ (35-45฿), ข้าวอกไก่คลีน (50-65฿), ข้าวต้มปลา (50-60฿)',
    mapsUrl: 'https://maps.google.com/?q=16.467310,102.831450'
  },
  {
    id: 5,
    nameTh: 'โรงอาหารคณะวิศวกรรมศาสตร์',
    nameEn: 'Engineering Canteen',
    zone: 'โซนวิศวะ',
    lat: 16.472180,
    lng: 102.822760,
    openingHours: '07:00 - 14:30',
    storeCount: 14,
    smartTransit: 'สายสีส้ม, แดง',
    popularMenus: 'กะเพราหมูกรอบจัมโบ้ (45-55฿), ข้าวหมูกระเทียมพูนจาน (40-50฿)',
    mapsUrl: 'https://maps.google.com/?q=16.472180,102.822760'
  },
  {
    id: 6,
    nameTh: 'โรงอาหารคณะวิทยาศาสตร์ (SC)',
    nameEn: 'Science Canteen',
    zone: 'โซนวิทยาศาสตร์',
    lat: 16.476120,
    lng: 102.825810,
    openingHours: '06:30 - 15:00',
    storeCount: 15,
    smartTransit: 'สายสีแดง, น้ำเงิน',
    popularMenus: 'ข้าวราดแกง 2 อย่าง (35-45฿), ราดหน้าหมูนุ่ม (40-50฿), ชานมไข่มุก (25-35฿)',
    mapsUrl: 'https://maps.google.com/?q=16.476120,102.825810'
  },
  {
    id: 7,
    nameTh: 'โรงอาหารหอพักนักศึกษา (หอ 9 หลัง / หอ 8)',
    nameEn: 'Dormitory Canteen',
    zone: 'โซนหอพักใน',
    lat: 16.478800,
    lng: 102.821450,
    openingHours: '06:00 - 20:00',
    storeCount: 20,
    smartTransit: 'สายสีแดง, เขียว',
    popularMenus: 'ยำมาม่ารวมมิตร (40-50฿), ข้าวผัดต้มยำ (45-55฿), น้ำผลไม้ปั่น (25-40฿)',
    mapsUrl: 'https://maps.google.com/?q=16.478800,102.821450'
  },
  {
    id: 8,
    nameTh: 'ศูนย์อาหาร U-Center (โซนหลังมอ)',
    nameEn: 'U-Center Food Court',
    zone: 'โซนหลังมอ',
    lat: 16.480450,
    lng: 102.818150,
    openingHours: '10:00 - 22:00',
    storeCount: 30,
    smartTransit: 'สายสีแดง (ป้ายหลังมอ)',
    popularMenus: 'ข้าวยำไก่แซ่บ (45-55฿), ทงคัตสึ (50-65฿), หม่าล่าทั่ง (50-90฿)',
    mapsUrl: 'https://maps.google.com/?q=16.480450,102.818150'
  },
  {
    id: 9,
    nameTh: 'โรงอาหารคณะเกษตรศาสตร์ (โรงแป้ง)',
    nameEn: 'Agriculture Canteen',
    zone: 'โซนเกษตร',
    lat: 16.470780,
    lng: 102.826380,
    openingHours: '06:30 - 14:00',
    storeCount: 10,
    smartTransit: 'สายสีส้ม, แดง',
    popularMenus: 'ข้าวมันไก่ทอด (40-45฿), แกงส้มชะอมทอด (35-45฿), ก๋วยเตี๋ยวหมูตุ๋น (40-50฿)',
    mapsUrl: 'https://maps.google.com/?q=16.470780,102.826380'
  },
  {
    id: 10,
    nameTh: 'โรงอาหารคณะศึกษาศาสตร์',
    nameEn: 'Education Canteen',
    zone: 'โซนศึกษาศาสตร์',
    lat: 16.470510,
    lng: 102.821930,
    openingHours: '07:00 - 14:30',
    storeCount: 10,
    smartTransit: 'สายสีส้ม',
    popularMenus: 'ข้าวคลุกกะปิ (40-50฿), ข้าวขาหมู (40-50฿), ชาชักโบราณ (20-30฿)',
    mapsUrl: 'https://maps.google.com/?q=16.470510,102.821930'
  },
  {
    id: 11,
    nameTh: 'โรงอาหารคณะทันตแพทยศาสตร์',
    nameEn: 'Dentistry Canteen',
    zone: 'โซนศูนย์แพทย์',
    lat: 16.469520,
    lng: 102.830180,
    openingHours: '07:00 - 15:00',
    storeCount: 12,
    smartTransit: 'สายสีน้ำเงิน, เขียว',
    popularMenus: 'ข้าวหน้าเป็ด (50-60฿), เย็นตาโฟทรงเครื่อง (40-50฿), ผลไม้สด (20-30฿)',
    mapsUrl: 'https://maps.google.com/?q=16.469520,102.830180'
  },
  {
    id: 12,
    nameTh: 'โรงอาหารวิทยาลัยการปกครอง (COLA)',
    nameEn: 'COLA Canteen',
    zone: 'โซนตะวันตก',
    lat: 16.465810,
    lng: 102.822450,
    openingHours: '07:00 - 14:00',
    storeCount: 8,
    smartTransit: 'สายสีส้ม, ม่วง',
    popularMenus: 'ข้าวผัดพริกแกงหมูกรอบ (45-50฿), ก๋วยเตี๋ยวน้ำใส (40-45฿)',
    mapsUrl: 'https://maps.google.com/?q=16.465810,102.822450'
  }
];

const CANTEENS_COLLECTION = 'canteens';

/**
 * Seed all 12 canteens to Firestore collection `canteens`.
 * Uses doc ID `canteen_${id}` so it is idempotent and won't duplicate.
 */
export async function seedCanteensToFirestore(): Promise<void> {
  try {
    for (const canteen of INITIAL_CANTEENS) {
      const docRef = doc(db, CANTEENS_COLLECTION, `canteen_${canteen.id}`);
      await setDoc(docRef, {
        canteenId: canteen.id,
        nameTh: canteen.nameTh,
        nameEn: canteen.nameEn,
        zone: canteen.zone,
        lat: canteen.lat,
        lng: canteen.lng,
        openingHours: canteen.openingHours,
        storeCount: canteen.storeCount,
        smartTransit: canteen.smartTransit,
        popularMenus: canteen.popularMenus,
        mapsUrl: canteen.mapsUrl,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error seeding canteens to Firestore:', error);
  }
}

/**
 * Fetch canteens from Firestore with fallback to INITIAL_CANTEENS
 */
export async function fetchCanteensFromFirestore(): Promise<Canteen[]> {
  try {
    const q = query(collection(db, CANTEENS_COLLECTION), orderBy('canteenId', 'asc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Auto-seed if empty
      await seedCanteensToFirestore();
      return INITIAL_CANTEENS;
    }

    const canteens: Canteen[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      canteens.push({
        id: data.canteenId ?? Number(docSnap.id.replace('canteen_', '')),
        nameTh: data.nameTh ?? '',
        nameEn: data.nameEn ?? '',
        zone: data.zone ?? '',
        lat: data.lat ?? 0,
        lng: data.lng ?? 0,
        openingHours: data.openingHours ?? '',
        storeCount: data.storeCount ?? 0,
        smartTransit: data.smartTransit ?? '',
        popularMenus: data.popularMenus ?? '',
        mapsUrl: data.mapsUrl ?? ''
      });
    });

    return canteens.sort((a, b) => a.id - b.id);
  } catch (error) {
    console.warn('Failed to fetch from Firestore, falling back to local dataset:', error);
    return INITIAL_CANTEENS;
  }
}

/**
 * Subscribe to realtime updates from Firestore
 */
export function subscribeCanteens(callback: (canteens: Canteen[]) => void): () => void {
  try {
    const q = query(collection(db, CANTEENS_COLLECTION), orderBy('canteenId', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          seedCanteensToFirestore().then(() => callback(INITIAL_CANTEENS));
          return;
        }
        const list: Canteen[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: data.canteenId ?? Number(docSnap.id.replace('canteen_', '')),
            nameTh: data.nameTh ?? '',
            nameEn: data.nameEn ?? '',
            zone: data.zone ?? '',
            lat: data.lat ?? 0,
            lng: data.lng ?? 0,
            openingHours: data.openingHours ?? '',
            storeCount: data.storeCount ?? 0,
            smartTransit: data.smartTransit ?? '',
            popularMenus: data.popularMenus ?? '',
            mapsUrl: data.mapsUrl ?? ''
          });
        });
        list.sort((a, b) => a.id - b.id);
        callback(list);
      },
      (error) => {
        console.warn('Realtime listener error:', error);
        callback(INITIAL_CANTEENS);
      }
    );
  } catch (error) {
    console.warn('Subscribe canteens failed:', error);
    callback(INITIAL_CANTEENS);
    return () => {};
  }
}

export const KKU_CANTEENS_DATA = INITIAL_CANTEENS;
