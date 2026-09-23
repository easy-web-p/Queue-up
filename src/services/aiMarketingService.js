/**
 * ============================================================================
 * 🏪 STORE PROMOTIONS
 * ============================================================================
 *
 * Suggestions a stall can act on, and the calls that make one real.
 *
 * `deployAICoupon` used to write the coupon to
 * `localStorage['queueup_merchant_coupons_<storeId>']` and the dashboard then
 * told the merchant "ลูกค้าสามารถใช้ส่วนลดได้ทันที". No customer could ever use
 * it: the order transaction prices coupons from `coupons/{code}` in Firestore.
 * A stall ran a promotion that existed on one laptop, and retiring it flipped a
 * boolean nobody else could see either.
 *
 * The recommendations below are ordinary heuristics — off-peak, basket size,
 * repeat custom — not a model. They are suggestions the merchant edits and
 * confirms; deploying is what the server checks.
 */

import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, functions } from '../firebase/config.js';

/**
 * 1. AI Marketing Analytics & Strategic Promotion Recommendation Engine
 * Analyzes store performance parameters to output customized coupon packages.
 * @param {object} storeMetrics - { totalSalesToday: number, totalOrdersToday: number, topSellerDish: string, currentHour: number }
 * @returns {Array<object>} Array of recommended coupon packages with ROI predictions
 */
export function generateAIMarketingRecommendations() {
  const recommendations = [];

  // Strategy A: Off-Peak Hours Booster (Happy Hour Coupon)
  // If off-peak (e.g. 13:00 - 15:00) or high slow time
  recommendations.push({
    id: "AI-COUPON-HAPPY-HOUR",
    title: "⚡ คูปองกระตุ้นยอดขายช่วงบ่าย (Happy Hour 13:00-14:30 น.)",
    discountType: "PERCENT",
    discountValue: 15, // 15% Off
    minSpend: 50,
    // Suggested, not reserved: HAPPY15 and STUDENT10 are the platform's own
    // built-ins, and a stall deploying one would overwrite a campaign running
    // across every stall in the school. deployStoreCoupon refuses them.
    code: "SHOPAFTERNOON15",
    description: "ลด 15% เมื่อสั่งครบ ฿50 ในช่วงหลังพักเที่ยง เพื่อดึงดูดนักเรียนและบุคลากรที่มารับประทานรอบบ่าย",
    targetAudience: "นักเรียนหลังคาบบ่าย & ครูบุคลากร",
    projectedSalesIncrease: "+25% ยอดขายช่วงบ่าย",
    recommendedBadge: "แนะนำสูงสุด 🔥",
    aiRationale: "จากสถิติโรงอาหาร ช่วงเวลา 13:00-14:30 น. ลูกค้าจะลดลง 40% การระเบิดโปรส่วนลดชั่วคราวจะช่วยดันยอดขายวัตถุดิบที่เหลือได้คุ้มค่าที่สุด",
  });

  // Strategy B: Student High Value Combo / Student Deal
  recommendations.push({
    id: "AI-COUPON-STUDENT-COMBO",
    title: "🎓 คูปองชุดคอมโบสุดคุ้มประจำโรงเรียน (อิ่มประหยัด)",
    discountType: "FIXED",
    discountValue: 10, // ฿10 Off
    minSpend: 60,
    code: "SHOPCOMBO10",
    description: "ส่วนลด ฿10 ทันทีเมื่อสั่งเมนูหลักคู่กับน้ำดื่มหรือไข่ดาวพิเศษ",
    targetAudience: "นักเรียนสายกิน & กลุ่มเพื่อน",
    projectedSalesIncrease: "+30% บิลเฉลี่ยต่อคน (Basket Size)",
    recommendedBadge: "เพิ่มยอดต่อบิล 💡",
    aiRationale: "นักเรียนชอบสั่งเป็นกลุ่ม การเสนอส่วนลดท้ายบิลเมื่อเพิ่มท็อปปิ้งจะเพิ่มกำไรสุทธิต่อบิลขึ้น ฿15-20 บาท",
  });

  // Strategy C: Repeat Customer Loyalty Reward Coupon
  recommendations.push({
    id: "AI-COUPON-LOYALTY",
    title: "🌟 คูปองขอบคุณลูกค้าประจำ (Loyalty VIP Canteen)",
    discountType: "FIXED",
    discountValue: 12, // ฿12 Off
    minSpend: 70,
    code: "VIPQUEUE",
    description: "มอบคูปองส่วนลด ฿12 สำหรับลูกค้าที่สั่งสะสมครบ 3 คิวขึ้นไป",
    targetAudience: "ลูกค้าประจำสะสมแต้ม",
    projectedSalesIncrease: "+40% การกลับมาสั่งซ้ำ (Retention)",
    recommendedBadge: "มัดใจลูกค้าประจำ 💖",
    aiRationale: "การสร้างความจงรักภักดีต่อร้านค้าทำให้นักเรียนกลับมาอุดหนุนร้านเดิมอย่างน้อย 4 วัน/สัปดาห์",
  });

  return recommendations;
}

/**
 * The coupons this stall currently has live, from Firestore.
 *
 * `where storeId == …` is the same field `evaluateCoupon` checks, so what the
 * merchant sees here is exactly what a customer at their counter can use.
 */
export async function getActiveMerchantCoupons(storeId = '') {
  if (!storeId) return [];
  const snap = await getDocs(query(collection(db, 'coupons'), where('storeId', '==', storeId)));
  return snap.docs.map((d) => ({ ...d.data(), code: d.id }));
}

/**
 * Publish a coupon for this stall.
 *
 * Throws when the server refuses — a code someone else already holds, one of
 * the platform's reserved codes, or a caller who does not own the stall. The
 * refusal has to reach the merchant: reported as success, they would advertise
 * a discount their customers cannot use, which is precisely what the
 * localStorage version did every time.
 */
export async function deployAICoupon(coupon, storeId = '') {
  const callable = httpsCallable(functions, 'deployStoreCoupon');
  const res = await callable({ storeId, coupon });
  return res.data;
}

/** Turn one of this stall's coupons on or off, for everyone. */
export async function setMerchantCouponActive(code, storeId, active) {
  const callable = httpsCallable(functions, 'setStoreCouponActive');
  const res = await callable({ storeId, code, active });
  return res.data;
}

/*
 * Two more functions stood here and both are gone.
 *
 * `toggleCouponState` flipped `isActive` inside the same localStorage array, so
 * retiring a promotion left it live for every customer — replaced by
 * setMerchantCouponActive above, which the server applies for everyone.
 *
 * `applyCouponToOrder` was a fourth copy of the discount arithmetic, reading
 * the same local array and computing its own percentage and cap. Nothing called
 * it. The one engine is couponRules.evaluateCoupon, which the order transaction
 * and previewCoupon both use, and a second copy is how they drift.
 */
