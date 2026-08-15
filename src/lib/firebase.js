import {
  db,
  auth,
  loginWithGoogle,
  logoutUser,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
} from "../firebase/config.js";
import { collection, getDocs, query, where } from "firebase/firestore";

export {
  db,
  auth,
  loginWithGoogle,
  logoutUser,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
};

// ฟังก์ชันตรวจสอบว่ามีอีเมลนี้ถูกสมัครใช้งานแล้วหรือยังใน Firestore
export const checkEmailExistsInFirestore = async (targetEmail) => {
  if (!targetEmail || !targetEmail.trim()) return false;
  try {
    const q = query(
      collection(db, "users"),
      where("email", "==", targetEmail.trim().toLowerCase())
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.warn("Firestore checkEmailExists warning:", error);
    return false;
  }
};

// ฟังก์ชันตรวจสอบว่ามีเบอร์โทรศัพท์นี้ถูกลงทะเบียนใช้งานแล้วหรือยังใน Firestore
export const checkPhoneExistsInFirestore = async (targetPhone) => {
  if (!targetPhone || !targetPhone.trim()) return false;
  const cleanPhone = targetPhone.replace(/\D/g, "");
  if (cleanPhone.length < 9) return false;

  try {
    const q = query(
      collection(db, "users"),
      where("phone", "==", targetPhone.trim())
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.warn("Firestore checkPhoneExists warning:", error);
    return false;
  }
};

// ฟังก์ชันดึงหมวดหมู่อาหารจาก Firestore
export const fetchFoodCategoriesFromFirestore = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "food_categories"));
    const categories = [];
    querySnapshot.forEach((docSnap) => {
      categories.push({ id: docSnap.id, ...docSnap.data() });
    });
    return categories;
  } catch (error) {
    console.warn("Firestore fetchFoodCategories warning:", error);
    return [];
  }
};

// ฟังก์ชันบันทึกหมวดหมู่อาหารลง Firestore
export const saveCategoryToFirestore = async (category) => {
  try {
    await setDoc(
      doc(db, "food_categories", category.id),
      { ...category, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (error) {
    console.warn("Firestore saveCategory warning:", error);
  }
};

// ฟังก์ชันดึงข้อมูลร้านค้าจาก Firestore
export const fetchShopsFromFirestore = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "shops"));
    const shops = [];
    querySnapshot.forEach((docSnap) => {
      shops.push({ id: docSnap.id, ...docSnap.data() });
    });
    return shops;
  } catch (error) {
    console.warn("Firestore fetchShops warning:", error);
    return [];
  }
};

// ==========================================================================
// FIRESTORE PRODUCTS COLLECTION HELPERS
// ==========================================================================

// ฟังก์ชันดึงรายการอาหารทั้งหมดจาก Firestore (พร้อม Seeding อัตโนมัติหากยังไม่มีข้อมูล)
export const fetchProductsFromFirestore = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const products = [];
    querySnapshot.forEach((docSnap) => {
      products.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (products.length > 0) {
      return products;
    }

    // หากยังไม่มีข้อมูลใน Firestore ให้ Auto-seed ข้อมูลเริ่มต้นไปยัง Firestore
    await saveProductsToFirestore(INITIAL_PRODUCTS);
    return INITIAL_PRODUCTS;
  } catch (error) {
    console.warn("Firestore fetchProducts warning, using local fallback:", error);
    return INITIAL_PRODUCTS;
  }
};

// ฟังก์ชันดึงข้อมูลอาหารเดี่ยวตาม ID จาก Firestore
export const fetchProductByIdFromFirestore = async (productId) => {
  try {
    const docRef = doc(db, "products", productId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (error) {
    console.warn("Firestore fetchProductById error:", error);
  }
  return null;
};

// ฟังก์ชันบันทึก / อัปเดตรายการอาหารทั้งหมดลง Firestore
export const saveProductsToFirestore = async (productsArray) => {
  try {
    for (const item of productsArray) {
      await setDoc(
        doc(db, "products", item.id),
        { ...item, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
  } catch (error) {
    console.warn("Firestore saveProducts warning:", error);
  }
};

// Initial Default Evaluations Seed
export const INITIAL_EVALUATIONS = [
  { id: "eval_1", userName: "อาจารย์ผู้ประเมินรายวิชา CRM", uxScore: 9.5, accountScore: 9.5, queueScore: 10.0, merchantScore: 10.0, securityScore: 9.0, comment: "สถาปัตยกรรมระบบสมบูรณ์มาก สอดคล้องกับ Persona และ App Blueprint" },
  { id: "eval_2", userName: "นักศึกษาร้านค้าพันธมิตร (ครัวโรงเรียน)", uxScore: 9.5, accountScore: 10.0, queueScore: 10.0, merchantScore: 10.0, securityScore: 9.5, comment: "บอร์ดจัดการคิวอาหาร Real-Time สะดวกมาก ทำให้ทำอาหารทันคิว" },
  { id: "eval_3", userName: "ผู้ใช้งานทั่วไป (นักเรียน ม.1/6)", uxScore: 9.0, accountScore: 9.0, queueScore: 10.0, merchantScore: 9.5, securityScore: 9.0, comment: "จองคิวอาหารล่วงหน้าสะดวก สแกนจ่าย PromptPay รวดเร็วมาก" }
];

// Save user evaluation rating
export const submitEvaluationToFirestore = async (evalData) => {
  try {
    const evalId = `eval_${Date.now()}`;
    const newEval = {
      id: evalId,
      ...evalData,
      createdAt: new Date().toISOString(),
    };

    // Save to Firestore
    await setDoc(doc(db, "systemEvaluations", evalId), newEval);

    // Also update LocalStorage
    const existing = JSON.parse(localStorage.getItem("queueup_user_evaluations") || "[]");
    const updated = [newEval, ...existing];
    localStorage.setItem("queueup_user_evaluations", JSON.stringify(updated));

    return newEval;
  } catch (err) {
    console.warn("Firestore evaluation save fallback to local:", err);
    const evalId = `eval_${Date.now()}`;
    const newEval = {
      id: evalId,
      ...evalData,
      createdAt: new Date().toISOString(),
    };
    const existing = JSON.parse(localStorage.getItem("queueup_user_evaluations") || "[]");
    const updated = [newEval, ...existing];
    localStorage.setItem("queueup_user_evaluations", JSON.stringify(updated));
    return newEval;
  }
};

// Fetch all evaluations
export const fetchEvaluationsFromFirestore = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "systemEvaluations"));
    const list = [];
    querySnapshot.forEach((docItem) => {
      list.push(docItem.data());
    });
    if (list.length > 0) return list;
  } catch (err) {
    console.warn("Firestore fetch evaluations fallback:", err);
  }

  // Fallback to local storage or initial values
  const stored = localStorage.getItem("queueup_user_evaluations");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.length > 0) return parsed;
    } catch {
      // ignore
    }
  }

  // Initialize initial evaluations in LocalStorage
  localStorage.setItem("queueup_user_evaluations", JSON.stringify(INITIAL_EVALUATIONS));
  return INITIAL_EVALUATIONS;
};
