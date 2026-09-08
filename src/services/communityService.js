import {
  db,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "../firebase/config.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

/**
 * ============================================================================
 * 🎥 1. REELS & SHORT CLIPS (ระบบจัดเก็บและจัดการคลิปสั้นโปรโมตและรีวิวอาหาร)
 * ============================================================================
 */

export async function fetchReelsFromFirestore() {
  try {
    let snap;
    try {
      const q = query(
        collection(db, "reels"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      snap = await getDocs(q);
    } catch {
      // Fallback if index or timestamp is not indexed
      const q = query(collection(db, "reels"), limit(20));
      snap = await getDocs(q);
    }
    const reels = [];
    snap.forEach((d) => reels.push({ id: d.id, ...d.data() }));
    return reels;
  } catch (err) {
    console.warn("fetchReelsFromFirestore warn:", err);
    return [];
  }
}

export async function createReelInFirestore(reelData) {
  try {
    const docRef = await addDoc(collection(db, "reels"), {
      shopName: reelData.shopName || "ร้านค้าโรงเรียน",
      shopAvatar: reelData.shopAvatar || "/yeti_mascot.jpg",
      videoPoster: reelData.videoPoster || "/crispy_fried_chicken.jpg",
      videoUrl: reelData.videoUrl || "",
      title: reelData.title || "เมนูแนะนำพิเศษ",
      likes: 0,
      likedBy: [],
      comments: 0,
      menuLinked: reelData.menuLinked || "",
      menuPrice: Number(reelData.menuPrice) || 0,
      productId: reelData.productId || "",
      authorType: reelData.authorType || "MERCHANT", // MERCHANT | STUDENT
      authorUid: reelData.authorUid || "",
      storeId: reelData.storeId || "",
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, ...reelData };
  } catch (err) {
    console.error("createReelInFirestore error:", err);
    throw err;
  }
}

export async function toggleLikeReelInFirestore(reelId, userId, isLiked) {
  if (!reelId || !userId) return;
  try {
    const reelRef = doc(db, "reels", reelId);
    await updateDoc(reelRef, {
      likes: isLiked ? increment(-1) : increment(1),
      likedBy: isLiked ? arrayRemove(userId) : arrayUnion(userId),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("toggleLikeReelInFirestore error:", err);
  }
}

/**
 * ============================================================================
 * 📢 2. ANNOUNCEMENTS & POSTS (ระบบจัดเก็บการโพสต์กระดานอาหารและข่าวสารประจำวัน)
 * ============================================================================
 */

export async function fetchAnnouncementsFromFirestore(dayOfWeek = null) {
  try {
    let snap;
    if (dayOfWeek) {
      try {
        const q = query(
          collection(db, "announcements"),
          where("dayOfWeek", "==", dayOfWeek),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        snap = await getDocs(q);
      } catch {
        // Fallback without composite index if index is not yet built
        const q = query(
          collection(db, "announcements"),
          where("dayOfWeek", "==", dayOfWeek),
          limit(20)
        );
        snap = await getDocs(q);
      }
    } else {
      try {
        const q = query(
          collection(db, "announcements"),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        snap = await getDocs(q);
      } catch {
        const q = query(collection(db, "announcements"), limit(20));
        snap = await getDocs(q);
      }
    }
    const announcements = [];
    snap.forEach((d) => announcements.push({ id: d.id, ...d.data() }));
    return announcements;
  } catch (err) {
    console.warn("fetchAnnouncementsFromFirestore warn:", err);
    return [];
  }
}

export async function createAnnouncementInFirestore(postData) {
  try {
    const docRef = await addDoc(collection(db, "announcements"), {
      shopName: postData.shopName || "ร้านค้าโรงเรียน",
      storeId: postData.storeId || "",
      authorUid: postData.authorUid || "",
      tag: postData.tag || "ประกาศประจำวัน",
      title: postData.title,
      content: postData.content || "",
      dayOfWeek: postData.dayOfWeek || "Mon",
      price: Number(postData.price) || null,
      status: postData.status || "พร้อมจอง",
      icon: postData.icon || "bi-megaphone-fill",
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, ...postData };
  } catch (err) {
    console.error("createAnnouncementInFirestore error:", err);
    throw err;
  }
}

/**
 * ============================================================================
 * ⭐ 3. REVIEWS & RATINGS (ระบบจัดเก็บการรีวิวและคะแนนความพึงพอใจ)
 * ============================================================================
 */

export async function fetchProductReviewsFromFirestore(productId) {
  if (!productId) return [];
  try {
    let snap;
    try {
      const q = query(
        collection(db, "reviews"),
        where("productId", "==", productId),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      snap = await getDocs(q);
    } catch {
      // Fallback if composite index is not yet built
      const q = query(
        collection(db, "reviews"),
        where("productId", "==", productId),
        limit(50)
      );
      snap = await getDocs(q);
    }
    const reviews = [];
    snap.forEach((d) => reviews.push({ id: d.id, ...d.data() }));
    return reviews;
  } catch (err) {
    console.warn("fetchProductReviewsFromFirestore error:", err);
    return [];
  }
}

export async function createProductReviewInFirestore(reviewData) {
  try {
    const docRef = await addDoc(collection(db, "reviews"), {
      productId: reviewData.productId,
      productName: reviewData.productName || "เมนูอาหาร",
      storeId: reviewData.storeId || "",
      userId: reviewData.userId,
      userName: reviewData.userName || "ผู้ใช้งาน QueueUp",
      rating: Number(reviewData.rating) || 5,
      comment: reviewData.comment || "",
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, ...reviewData };
  } catch (err) {
    console.error("createProductReviewInFirestore error:", err);
    throw err;
  }
}

/**
 * ============================================================================
 * 📊 4. STORE STATS & SALES ANALYTICS (ระบบบันทึกและรวบรวมสถิติร้านค้า)
 * ============================================================================
 */

export async function fetchStoreStatsFromFirestore(storeId) {
  if (!storeId) return null;
  try {
    const docSnap = await getDoc(doc(db, "store_stats", storeId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (err) {
    console.warn("fetchStoreStatsFromFirestore warn:", err);
    return null;
  }
}

export async function recordStoreOrderStatInFirestore(storeId, orderAmountSatang, itemCount = 1) {
  if (!storeId) return;
  try {
    const statRef = doc(db, "store_stats", storeId);
    await setDoc(
      statRef,
      {
        totalRevenueSatang: increment(orderAmountSatang || 0),
        totalOrdersCount: increment(1),
        totalItemsSold: increment(itemCount || 1),
        lastOrderAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("recordStoreOrderStatInFirestore error:", err);
  }
}

/**
 * ============================================================================
 * 🧠 5. USER BEHAVIORS & USAGE DATA (ระบบจัดเก็บข้อมูลพฤติกรรมการใช้งาน AI)
 * ============================================================================
 */

export async function syncUserBehaviorToFirestore(userId, behaviorProfile) {
  if (!userId || !behaviorProfile) return;
  try {
    await setDoc(
      doc(db, "user_behaviors", userId),
      {
        ...behaviorProfile,
        userId,
        lastSyncedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("syncUserBehaviorToFirestore error:", err);
  }
}

export async function fetchUserBehaviorFromFirestore(userId) {
  if (!userId) return null;
  try {
    const docSnap = await getDoc(doc(db, "user_behaviors", userId));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (err) {
    console.warn("fetchUserBehaviorFromFirestore error:", err);
    return null;
  }
}
