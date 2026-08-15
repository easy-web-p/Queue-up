/**
 * AI USER BEHAVIOR & CONVENIENCE ENGINE (aiBehaviorEngine.js)
 * Tracks user order preferences, favorite items, customizations, peak hours & predicts queue times.
 */

const USER_BEHAVIOR_STORAGE_KEY = "queueup_user_behavior_profile_v1";

/**
 * 1. Record User Order Event to Build AI Behavior Intelligence Profile
 * @param {object} orderData - { itemId, itemTitle, variant, price, storeName, timestamp }
 */
export function recordUserOrderBehavior(orderData) {
  if (!orderData || !orderData.itemTitle) return;

  try {
    const rawProfile = localStorage.getItem(USER_BEHAVIOR_STORAGE_KEY);
    const profile = rawProfile
      ? JSON.parse(rawProfile)
      : {
          totalOrders: 0,
          favoriteDishes: {},
          customizationPreferences: {},
          orderTimes: [],
          preferredStores: {},
          lastOrderedItem: null,
        };

    // Increment Total Orders
    profile.totalOrders += 1;

    // Track Favorite Dish Frequency
    const title = orderData.itemTitle;
    profile.favoriteDishes[title] = (profile.favoriteDishes[title] || 0) + 1;

    // Track Customization Preferences (e.g., "เผ็ดน้อย", "ไม่ใส่ผัก")
    if (orderData.variant) {
      const variantKey = orderData.variant.trim();
      profile.customizationPreferences[variantKey] =
        (profile.customizationPreferences[variantKey] || 0) + 1;
    }

    // Track Preferred Canteen Store
    if (orderData.storeName) {
      profile.preferredStores[orderData.storeName] =
        (profile.preferredStores[orderData.storeName] || 0) + 1;
    }

    // Track Order Hour
    const currentHour = new Date().getHours();
    profile.orderTimes.push(currentHour);

    // Save Last Ordered Item for 1-Click Quick Re-order
    profile.lastOrderedItem = {
      itemId: orderData.itemId || "prod-default",
      itemTitle: orderData.itemTitle,
      variant: orderData.variant || "",
      price: orderData.price || 50,
      storeName: orderData.storeName || "ร้านครัวโรงเรียน QueueUp Canteen",
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem(USER_BEHAVIOR_STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.warn("User behavior tracking error:", err);
  }
}

/**
 * 2. Get User Behavior Insights & Quick Re-order Recommendations
 * @returns {object} Insights, top favorites, frequent customization, and last order
 */
export function getUserBehaviorInsights() {
  try {
    const rawProfile = localStorage.getItem(USER_BEHAVIOR_STORAGE_KEY);
    if (!rawProfile) {
      return {
        hasData: false,
        totalOrders: 0,
        topFavoriteDish: null,
        frequentVariant: null,
        lastOrderedItem: null,
        aiSuggestion: "สั่งซื้ออาหารมื้อแรกเพื่อเริ่มให้ AI เรียนรู้เมนูโปรดของคุณ!",
      };
    }

    const profile = JSON.parse(rawProfile);

    // Find Top Favorite Dish
    let topFavoriteDish = null;
    let maxCount = 0;
    Object.entries(profile.favoriteDishes || {}).forEach(([dish, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topFavoriteDish = dish;
      }
    });

    // Find Most Frequent Variant
    let frequentVariant = null;
    let maxVarCount = 0;
    Object.entries(profile.customizationPreferences || {}).forEach(([varName, count]) => {
      if (count > maxVarCount) {
        maxVarCount = count;
        frequentVariant = varName;
      }
    });

    return {
      hasData: profile.totalOrders > 0,
      totalOrders: profile.totalOrders,
      topFavoriteDish,
      frequentVariant,
      lastOrderedItem: profile.lastOrderedItem,
      aiSuggestion: topFavoriteDish
        ? `เมนูโปรดของคุณคือ "${topFavoriteDish}" (${frequentVariant ? `ชอบระบุ "${frequentVariant}"` : "ไม่ระบุซอสพิเศษ"}) สั่งซ้ำได้ใน 1 คลิก!`
        : "สั่งซื้อเมนูอร่อยกับเราอย่างต่อเนื่อง เพื่อให้ AI จดจำรสชาติที่คุณชอบที่สุด",
    };
  } catch (err) {
    return {
      hasData: false,
      totalOrders: 0,
      topFavoriteDish: null,
      frequentVariant: null,
      lastOrderedItem: null,
      aiSuggestion: "ยินดีต้อนรับสู่ระบบ QueueUp Canteen!",
    };
  }
}

/**
 * 3. Smart AI Queue Time Predictor
 * Predicts accurate waiting time based on current active kitchen queue count and dish complexity.
 * @param {number} currentQueuePosition - Number of orders ahead in queue
 * @param {boolean} isComplexDish - Whether the order requires special cook time
 * @returns {object} { minMinutes: number, maxMinutes: number, statusText: string, icon: string }
 */
export function predictQueueWaitTime(currentQueuePosition = 1, isComplexDish = false) {
  const basePrepTime = isComplexDish ? 4 : 2; // base minutes per order
  const queueAhead = Math.max(1, currentQueuePosition);

  // Peak Hours Bonus (Lunch peak 11:30 - 12:45)
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();
  const isPeakHour = currentHour === 11 || (currentHour === 12 && currentMinute <= 45);

  const multiplier = isPeakHour ? 1.3 : 1.0;

  const estimatedMin = Math.round(queueAhead * basePrepTime * multiplier);
  const estimatedMax = estimatedMin + 3;

  let statusText = "คิวเคลื่อนตัวรวดเร็ว ⚡";
  let icon = "⚡";

  if (estimatedMin > 10) {
    statusText = "ช่วงพักเที่ยงลูกค้าแน่น คิวปรุงสดตามลำดับ 🍳";
    icon = "🍳";
  } else if (estimatedMin > 5) {
    statusText = "คิวกำลังดี อาหารร้อนๆ พร้อมส่งมอบเร็วๆ นี้ ⏱️";
    icon = "⏱️";
  }

  return {
    minMinutes: Math.max(2, estimatedMin),
    maxMinutes: Math.max(4, estimatedMax),
    statusText,
    icon,
    formattedRange: `${Math.max(2, estimatedMin)}-${Math.max(4, estimatedMax)} นาที`,
  };
}
