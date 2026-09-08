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
  functions,
} from "../firebase/config.js";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

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

/**
 * The canteen's real menu.
 *
 * This used to return the hardcoded INITIAL_PRODUCTS catalogue whenever the
 * collection was empty OR the read failed. Both cases put dishes on the screen
 * that do not exist: a student could open one, configure it, add it to the cart
 * and reach the booking page, where the order was refused with
 * "PRODUCT_NOT_FOUND: ไม่พบสินค้ารหัส ... ในระบบ". A read denied by security rules
 * looked exactly like a stocked canteen.
 *
 * An empty menu is now an empty menu, and a failed read throws so the caller can
 * say so. INITIAL_PRODUCTS remains the seed for saveProductsToFirestore, which is
 * how real products get into the collection.
 *
 * @returns {Promise<Array>} every product in the collection; [] when there are none
 * @throws when the collection cannot be read
 */
export const fetchProductsFromFirestore = async () => {
  const querySnapshot = await getDocs(collection(db, "products"));
  const products = [];
  querySnapshot.forEach((docSnap) => {
    products.push({ id: docSnap.id, ...docSnap.data() });
  });
  return products;
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

/**
 * Writes products to Firestore.
 *
 * It used to catch every failure and log a warning, so a caller that seeded a
 * menu blocked by security rules was told nothing and assumed it had worked. It
 * now throws, and reports how far it got — a partial write is a real outcome the
 * caller has to be able to describe.
 *
 * @param {Array<object>} productsArray - products carrying an id
 * @returns {Promise<{written: number}>}
 * @throws with `written` attached, when a write is refused
 */
export const saveProductsToFirestore = async (productsArray) => {
  let written = 0;
  try {
    for (const item of productsArray) {
      await setDoc(
        doc(db, "products", item.id),
        { ...item, updatedAt: serverTimestamp() },
        { merge: true }
      );
      written += 1;
    }
  } catch (error) {
    error.written = written;
    throw error;
  }
  return { written };
};

// Save user evaluation rating.
//
// Goes through a Cloud Function: the wall is public and the form takes no sign-in,
// so `systemEvaluations` is closed to client writes. The previous version wrote
// Firestore directly with a shape the rules rejected, caught the rejection, saved
// to localStorage and returned as if it had worked — so every evaluation ever
// submitted existed only in the browser that submitted it, while the page said
// thank you.
//
// It now throws on failure. A caller that cannot store an evaluation must say so
// rather than pretend.
export const submitEvaluationToFirestore = async (evalData) => {
  const callable = httpsCallable(functions, "submitSystemEvaluation");
  const result = await callable({
    userName: evalData.userName,
    uxScore: evalData.uxScore,
    accountScore: evalData.accountScore,
    queueScore: evalData.queueScore,
    merchantScore: evalData.merchantScore,
    securityScore: evalData.securityScore,
    comment: evalData.comment,
  });
  return { id: result?.data?.evaluationId, ...(result?.data?.evaluation || {}) };
};

// Fetch all evaluations.
//
// An empty collection is an honest empty wall, not a cue to substitute the seed
// samples: the page reports the count as "ผลประเมินจริง", and three hardcoded
// entries presented under that heading are the reason this was worth fixing.
export const fetchEvaluationsFromFirestore = async () => {
  const querySnapshot = await getDocs(collection(db, "systemEvaluations"));
  const list = [];
  querySnapshot.forEach((docItem) => {
    list.push({ id: docItem.id, ...docItem.data() });
  });
  return list;
};

// Aliases & Admin Helpers
export const fetchMenuItemsFromFirestore = fetchProductsFromFirestore;

export const fetchOrdersFromFirestore = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "orders"));
    const list = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    return list;
  } catch (error) {
    console.warn("Firestore fetchOrders warning:", error);
    return [];
  }
};

export const fetchUsersFromFirestore = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const list = [];
    querySnapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    return list;
  } catch (error) {
    console.warn("Firestore fetchUsers warning:", error);
    return [];
  }
};

// ==========================================================================
// STORE, FAVORITES, RELATED PRODUCTS & ORDER SERVICES
// ==========================================================================

export const fetchStoreByIdFromFirestore = async (storeId) => {
  if (!storeId) return null;
  try {
    const docRef = doc(db, "shops", storeId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (error) {
    console.warn("Firestore fetchStoreById warning:", error);
  }
  return null;
};

export const checkUserFavoriteInFirestore = async (userId, productId) => {
  if (!userId || !productId) return false;
  try {
    const favRef = doc(db, "users", userId, "favorites", productId);
    const favSnap = await getDoc(favRef);
    return favSnap.exists();
  } catch {
    return false;
  }
};

export const toggleUserFavoriteInFirestore = async (userId, productId) => {
  if (!userId || !productId) return false;
  try {
    const favRef = doc(db, "users", userId, "favorites", productId);
    const favSnap = await getDoc(favRef);
    if (favSnap.exists()) {
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(favRef);
      return false;
    } else {
      await setDoc(favRef, {
        productId,
        createdAt: serverTimestamp(),
      });
      return true;
    }
  } catch (error) {
    console.warn("Firestore toggleUserFavorite warning:", error);
    return false;
  }
};

export const fetchRelatedProductsFromFirestore = async (storeId, currentProductId) => {
  if (!storeId) return [];
  try {
    const q = query(collection(db, "products"), where("storeId", "==", storeId));
    const querySnapshot = await getDocs(q);
    const list = [];
    querySnapshot.forEach((docSnap) => {
      if (docSnap.id !== currentProductId) {
        list.push({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return list;
  } catch (error) {
    console.warn("Firestore fetchRelatedProducts warning:", error);
    return [];
  }
};

// ฟังก์ชันตรวจสอบและดึงโควตาคิวจริง (Slot Capacity) ตามร้านค้าและวันที่
export const fetchLiveSlotCapacities = async (storeId, isoDateStr, baseSlots = [], defaultCapacity = 20) => {
  if (!storeId || !isoDateStr || !Array.isArray(baseSlots)) return baseSlots;
  const targetYmdClean = isoDateStr.replace(/-/g, "");

  try {
    const updated = await Promise.all(
      baseSlots.map(async (slot) => {
        const cleanTime = (slot.time || "").replace(":", "");
        const slotDocId = `slot_${storeId}_${targetYmdClean}_${cleanTime}`;
        const slotRef = doc(db, "store_slots", slotDocId);
        const snap = await getDoc(slotRef);
        const capacity = slot.capacity || defaultCapacity;
        let currentOrders = 0;
        if (snap.exists()) {
          currentOrders = Number(snap.data()?.currentOrders) || 0;
        }
        const remaining = Math.max(0, capacity - currentOrders);
        let status = "AVAILABLE";
        if (remaining === 0) {
          status = "FULL";
        } else if (remaining <= 5) {
          status = "LIMITED";
        }
        return {
          ...slot,
          capacity,
          currentOrders,
          remaining,
          status,
        };
      })
    );
    return updated;
  } catch (error) {
    console.warn("fetchLiveSlotCapacities warning:", error);
    return baseSlots;
  }
};



