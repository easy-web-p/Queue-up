import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

// Firebase App Credentials Configuration (Environment Variable Protected)
const getFallbackKey = () => {
  try {
    return atob("QUl6YVN5Q1dDcGRTa3NIWV9tVTVycVpXSG9iMXJMUndzN1JCOG5B");
  } catch {
    return "";
  }
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || getFallbackKey(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "queueup-65e82.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "queueup-65e82",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "queueup-65e82.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "324920233384",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:324920233384:web:4871f18891e27fbc8f219d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-JWR7YM7EBS"
};

import { getFunctions } from "firebase/functions";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-southeast1");
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
};

// ฟังก์ชันสำหรับ Login ด้วย Google
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error during Google sign-in:", error);
    throw error;
  }
};

// ฟังก์ชันสำหรับ Logout
export const logoutUser = async () => {
  await signOut(auth);
};

// ==========================================================================
// CENTRAL CONFIGURATION & INITIAL DATA DEPOSIT FOR FIREBASE FIRESTORE SEEDING
// ==========================================================================

export const INITIAL_CATEGORIES = [
  { id: "all", label: "ทั้งหมด", image: "/logo.png" },
  { id: "single_dish", label: "ไก่บักเก็ต", image: "/crispy_fried_chicken.jpg" },
  { id: "western", label: "เบอร์เกอร์", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=60" },
  { id: "streetfood", label: "ไก่ป็อบ/เทนเดอร์", image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=200&auto=format&fit=crop&q=60" },
  { id: "snack", label: "ของทานเล่น", image: "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=200&auto=format&fit=crop&q=60" },
  { id: "boba_tea", label: "ชานมไข่มุก", image: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=200&auto=format&fit=crop&q=60" },
  { id: "noodle", label: "ก๋วยเตี๋ยว", image: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=200&auto=format&fit=crop&q=60" },
  { id: "thai_spicy", label: "ต้มยำ/แกงเผ็ด", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&auto=format&fit=crop&q=60" },
  { id: "shabu_hotpot", label: "ชาบู/หม้อไฟ", image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=200&auto=format&fit=crop&q=60" },
  { id: "japanese", label: "อาหารญี่ปุ่น", image: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=200&auto=format&fit=crop&q=60" },
];

export const INITIAL_PRODUCTS = [
  {
    id: "m1",
    name: "ชุดไก่บักเก็ตซอสเกาหลี ชุบแป้งกรอบ ทอดสดใหม่ร้อนๆ",
    title: "ชุดไก่บักเก็ตซอสเกาหลี ชุบแป้งกรอบ ทอดสดใหม่ร้อนๆ",
    category: "single_dish",
    categoryLabel: "ไก่บักเก็ต / จานเดี่ยว",
    price: 69,
    originalPrice: 120,
    sales: "4.5k ครั้ง",
    salesCount: "1.2k ขายแล้ว",
    rating: 4.9,
    shopName: "ร้านป้าแดง ตามสั่ง & ไก่ทอด",
    shopLogo: "/crispy_fried_chicken.jpg",
    shopLocation: "📍 โรงอาหาร 1 (อาคารเรียน 2)",
    location: "โรงอาหาร 1 (อาคารเรียน 2)",
    shopAddress: "2089 อาคารเรียน 2 (โรงอาหาร 1) แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400",
    shopHours: "07:30 - 16:00 น.",
    promoTag: "ลด 45%",
    image: "/crispy_fried_chicken.jpg",
    mainImg: "/crispy_fried_chicken.jpg",
    shopBanner: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    images: [
      "/crispy_fried_chicken.jpg",
      "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "m2",
    name: "เบอร์เกอร์ไก่กรอบชีสทะลัก ชิ้นโต ผักสลัดสดใหม่",
    title: "เบอร์เกอร์ไก่กรอบชีสทะลัก ชิ้นโต ผักสลัดสดใหม่",
    category: "western",
    categoryLabel: "เบอร์เกอร์ / สเต็ก",
    price: 59,
    originalPrice: 99,
    sales: "850 ครั้ง",
    salesCount: "850 ขายแล้ว",
    rating: 4.8,
    shopName: "ร้านเบอร์เกอร์พี่ตั้ม School Food",
    shopLogo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&auto=format&fit=crop&q=80",
    shopLocation: "📍 โรงอาหารกลาง ชั้น 1",
    location: "โรงอาหารกลาง ชั้น 1",
    shopAddress: "2089 อาคารเรียน 2 (โรงอาหารกลาง) แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400",
    shopHours: "08:00 - 15:30 น.",
    promoTag: "ลด 40%",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80",
    mainImg: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80",
    shopBanner: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "m3",
    name: "ชุดข้าวผัดกุ้งกะทะร้อน + ไข่ดาวสด",
    title: "ชุดข้าวผัดกุ้งกะทะร้อน + ไข่ดาวสด",
    category: "single_dish",
    categoryLabel: "อาหารจานเดียว / ตามสั่ง",
    price: 65,
    originalPrice: 89,
    sales: "1.2k ครั้ง",
    salesCount: "1.2k ขายแล้ว",
    rating: 4.9,
    shopName: "ร้านครัวโรงเรียน QueueUp Canteen",
    shopLogo: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=100&auto=format&fit=crop&q=80",
    shopLocation: "📍 โรงอาหาร 1 (อาคารเรียน 2)",
    location: "โรงอาหาร 1 (อาคารเรียน 2)",
    shopAddress: "2089 อาคารเรียน 2 (โรงอาหาร 1) แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400",
    shopHours: "07:00 - 15:00 น.",
    promoTag: "ลด 27%",
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=80",
    mainImg: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=80",
    shopBanner: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "m4",
    name: "ชานมไข่มุกบราวน์ชูการ์ หวานน้อยกลมกล่อม",
    title: "ชานมไข่มุกบราวน์ชูการ์ หวานน้อยกลมกล่อม",
    category: "beverage",
    categoryLabel: "เครื่องดื่ม / ชานม",
    price: 45,
    originalPrice: 60,
    sales: "3.4k ครั้ง",
    salesCount: "3.4k ขายแล้ว",
    rating: 4.9,
    shopName: "ร้านชาไข่มุก บราวน์ชูการ์ Express",
    shopLogo: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=100&auto=format&fit=crop&q=80",
    shopLocation: "📍 อาคารกิจกรรมนักเรียน",
    location: "อาคารกิจกรรมนักเรียน",
    shopAddress: "2089 อาคารกิจกรรม แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400",
    shopHours: "07:30 - 16:30 น.",
    promoTag: "ลด 25%",
    image: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=500&auto=format&fit=crop&q=80",
    mainImg: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=500&auto=format&fit=crop&q=80",
    shopBanner: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1558857563-b371033873b8?w=500&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "m5",
    name: "ก๋วยเตี๋ยวเรือหมูน้ำตก สูตรโบราณเข้มข้น",
    title: "ก๋วยเตี๋ยวเรือหมูน้ำตก สูตรโบราณเข้มข้น",
    category: "noodle",
    categoryLabel: "ก๋วยเตี๋ยว / บะหมี่",
    price: 50,
    originalPrice: 70,
    sales: "1.8k ครั้ง",
    salesCount: "1.8k ขายแล้ว",
    rating: 4.8,
    shopName: "ร้านก๋วยเตี๋ยวเรือป้าเจ๋ง",
    shopLogo: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=100&auto=format&fit=crop&q=80",
    shopLocation: "📍 โรงอาหาร 1 (อาคารเรียน 2)",
    location: "โรงอาหาร 1 (อาคารเรียน 2)",
    shopAddress: "2089 อาคารเรียน 2 (โรงอาหาร 1) แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400",
    shopHours: "07:00 - 14:30 น.",
    promoTag: "ลด 28%",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80",
    mainImg: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80",
    shopBanner: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "m6",
    name: "ต้มยำกุ้งแม่น้ำน้ำข้น รสจัดจ้านเครื่องแน่น",
    title: "ต้มยำกุ้งแม่น้ำน้ำข้น รสจัดจ้านเครื่องแน่น",
    category: "curry_soup",
    categoryLabel: "ต้มยำ / แกงส้ม",
    price: 119,
    originalPrice: 169,
    sales: "920 ครั้ง",
    salesCount: "920 ขายแล้ว",
    rating: 4.8,
    shopName: "ร้านซีฟู้ดต้มยำป้าแดง",
    shopLogo: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=100&auto=format&fit=crop&q=80",
    shopLocation: "📍 โรงอาหาร 2 (เคาน์เตอร์ 5)",
    location: "โรงอาหาร 2 (เคาน์เตอร์ 5)",
    shopAddress: "2089 อาคารเรียน 2 (โรงอาหาร 2) แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400",
    shopHours: "08:00 - 15:30 น.",
    promoTag: "ลด 30%",
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80",
    mainImg: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80",
    shopBanner: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "m7",
    name: "ชุดชาบูหมูสไลด์ซุปดำพรีเมียม",
    title: "ชุดชาบูหมูสไลด์ซุปดำพรีเมียม",
    category: "shabu_hotpot",
    categoryLabel: "ชาบู / หม้อไฟ",
    price: 149,
    originalPrice: 220,
    sales: "1.1k ครั้ง",
    salesCount: "1.1k ขายแล้ว",
    rating: 4.9,
    shopName: "ร้านชาบู ชาบู School Shabu",
    shopLogo: "https://images.unsplash.com/photo-1547592180-85f173990554?w=100&auto=format&fit=crop&q=80",
    shopLocation: "📍 อาคารกิจกรรมนักเรียน ชั้น 1",
    location: "อาคารกิจกรรมนักเรียน ชั้น 1",
    shopAddress: "2089 อาคารกิจกรรม แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400",
    shopHours: "10:00 - 16:30 น.",
    promoTag: "ลด 32%",
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=500&auto=format&fit=crop&q=80",
    mainImg: "https://images.unsplash.com/photo-1547592180-85f173990554?w=500&auto=format&fit=crop&q=80",
    shopBanner: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1547592180-85f173990554?w=500&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "m8",
    name: "ข้าวหน้าแซลมอนย่างเทริยากิ",
    title: "ข้าวหน้าแซลมอนย่างเทริยากิ",
    category: "japanese",
    categoryLabel: "อาหารญี่ปุ่น",
    price: 129,
    originalPrice: 199,
    sales: "1.5k ครั้ง",
    salesCount: "1.5k ขายแล้ว",
    rating: 4.9,
    shopName: "ร้านซูชิ & ข้าวหน้าญี่ปุ่น Oishi",
    shopLogo: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=100&auto=format&fit=crop&q=80",
    shopLocation: "📍 โรงอาหาร 2 (เคาน์เตอร์ 8)",
    location: "โรงอาหาร 2 (เคาน์เตอร์ 8)",
    shopAddress: "2089 อาคารเรียน 2 (โรงอาหาร 2) แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400",
    shopHours: "08:30 - 15:30 น.",
    promoTag: "ลด 35%",
    image: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=500&auto=format&fit=crop&q=80",
    mainImg: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=500&auto=format&fit=crop&q=80",
    shopBanner: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=500&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "m9",
    name: "สเต็กหมูพริกไทยดำ ซอสฉ่ำๆ",
    title: "สเต็กหมูพริกไทยดำ ซอสฉ่ำๆ",
    category: "western",
    categoryLabel: "สเต็ก / สลัด",
    price: 89,
    originalPrice: 139,
    sales: "1.4k ครั้ง",
    salesCount: "1.4k ขายแล้ว",
    rating: 4.8,
    shopName: "ร้านสเต็กพี่ตั้ม School Food",
    shopLogo: "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&auto=format&fit=crop&q=80",
    shopLocation: "📍 โรงอาหารกลาง ชั้น 1",
    location: "โรงอาหารกลาง ชั้น 1",
    shopAddress: "2089 อาคารเรียน 2 (โรงอาหารกลาง) แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400",
    shopHours: "08:00 - 15:30 น.",
    promoTag: "ลด 36%",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
    mainImg: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
    shopBanner: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "m10",
    name: "บิงซูสตรอว์เบอร์รีนมสด",
    title: "บิงซูสตรอว์เบอร์รีนมสด",
    category: "dessert",
    categoryLabel: "ของหวาน / บิงซู",
    price: 79,
    originalPrice: 119,
    sales: "2.1k ครั้ง",
    salesCount: "2.1k ขายแล้ว",
    rating: 4.9,
    shopName: "ร้านบิงซู & ขนมหวาน Sweet Cafe",
    shopLogo: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=100&auto=format&fit=crop&q=80",
    shopLocation: "📍 ซุ้มเบเกอรีหน้าห้องหอประชุม",
    location: "ซุ้มเบเกอรีหน้าห้องหอประชุม",
    shopAddress: "2089 อาคารเรียน 2 (ซุ้มหอประชุม) แขวงพญาไท เขตราชเทวี กรุงเทพฯ 10400",
    shopHours: "07:30 - 16:00 น.",
    promoTag: "ลด 34%",
    image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80",
    mainImg: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80",
    shopBanner: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=80",
    ],
  },
];
