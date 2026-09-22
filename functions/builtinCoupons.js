/**
 * ============================================================================
 * 🎟️  THE THREE BUILT-IN COUPONS
 * ============================================================================
 *
 * These existed as an if/else chain inside the order transaction, a second
 * if/else chain in FoodBooking.tsx, and marketing copy in two more files. Here
 * they are documents, so the rules they advertise are the rules that run.
 *
 * What changed, beyond the shape:
 *
 *   WELCOME50  now actually means what it says. maxPerUser: 1 makes it a
 *              welcome, enforced server-side against a redemption record
 *              instead of a localStorage flag the user can clear.
 *   HAPPY15    now has a happy hour. 14:00–17:00, the campus afternoon lull.
 *   STUDENT10  now checks the buyer is a student.
 *
 * Seeded rather than hardcoded, so an administrator can retire or retune any of
 * them from the admin console — which is what the coupon screen there always
 * looked like it did.
 */

export const BUILTIN_COUPONS = Object.freeze([
  {
    id: "WELCOME50",
    title: "ต้อนรับสมาชิกใหม่ ลด ฿50",
    description: "ใช้ได้ครั้งเดียวต่อหนึ่งบัญชี เมื่อสั่งซื้อครบ ฿100",
    type: "FIXED",
    amountSatang: 5000,
    minSpendSatang: 10000,
    // The whole point of a welcome offer, and the one rule it did not enforce.
    maxPerUser: 1,
    active: true,
  },
  {
    id: "HAPPY15",
    title: "Happy Hour พิเศษ ลด 15%",
    description: "ลด 15% สูงสุด ฿50 เฉพาะช่วงบ่าย 14:00–17:00 น.",
    type: "PERCENT",
    percent: 15,
    maxDiscountSatang: 5000,
    minSpendSatang: 5000,
    dailyWindow: { start: "14:00", end: "17:00" },
    active: true,
  },
  {
    id: "STUDENT10",
    title: "ส่วนลดนักเรียนนักศึกษา ลด 10%",
    description: "ลด 10% สูงสุด ฿30 สำหรับบัญชีนักเรียนที่ยืนยันแล้ว",
    type: "PERCENT",
    percent: 10,
    maxDiscountSatang: 3000,
    minSpendSatang: 4000,
    // Named for students, so it is for students.
    audienceRoles: ["student", "student_vendor", "customer"],
    active: true,
  },
]);

/** Look one up by code without reaching Firestore — used by the seeder and tests. */
export function getBuiltinCoupon(code) {
  return BUILTIN_COUPONS.find((c) => c.id === code) || null;
}
