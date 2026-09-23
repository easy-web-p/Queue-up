/**
 * ============================================================================
 * 🧭 WHAT PAGE AM I ON?
 * ============================================================================
 *
 * Every one of this app's fifty-odd routes shared the single <title> in
 * index.html. Three separate things go wrong when that is true, and they all
 * go wrong quietly:
 *
 *  - **The browser's own record of where you have been is useless.** Every
 *    history entry, every open tab and every bookmark reads "QueueUp - School
 *    Canteen Smart Pre-Order & Queue Platform". A parent with the wallet and
 *    the order history open in two tabs cannot tell them apart, and Back
 *    through five screens is five identical lines.
 *
 *  - **A screen reader is told nothing.** A single-page app changes the
 *    document without a page load, so there is no event a reader announces on
 *    its own. Unless the app says something, navigating reports silence, and
 *    the reader is left on whatever it was reading before.
 *
 *  - **Focus is stranded.** It stays on the link that was clicked, which the
 *    new route has usually unmounted, so the next Tab starts again from the
 *    top of the document.
 *
 * The titles below are the Thai a person would use for the screen, not the
 * route path, because they are read aloud and shown in a tab strip.
 */

/**
 * Exact paths first, then prefixes. Ordered longest-prefix-first so
 * `/guardian/spending-limits` is not answered by `/guardian`.
 */
const EXACT = {
  '/': 'หน้าแรก',
  '/landing': 'หน้าแรก',
  '/queueup': 'เกี่ยวกับโครงการ QueueUp',
  // Aliases of the landing page, so they carry the landing page's name. They
  // used to read "ติดต่อเรา", "ทีมงาน" and "แพ็กเกจและค่าบริการ" — three
  // screens this app does not have.
  '/about': 'หน้าแรก',
  '/contact': 'หน้าแรก',
  '/pdpa': 'นโยบายคุ้มครองข้อมูลส่วนบุคคล',
  '/privacy': 'นโยบายความเป็นส่วนตัว',
  '/terms': 'ข้อกำหนดและเงื่อนไข',
  '/login': 'เข้าสู่ระบบ',
  '/home': 'โรงอาหาร',
  '/search': 'ผลการค้นหา',
  '/product': 'รายละเอียดเมนู',
  '/booking': 'จองคิวและสั่งอาหาร',
  '/food-booking': 'จองคิวและสั่งอาหาร',
  '/wallet': 'กระเป๋าเงินนักเรียนของฉัน',
  '/user/wallet': 'กระเป๋าเงินนักเรียนของฉัน',
  '/orders': 'คำสั่งซื้อของฉัน',
  '/purchase': 'คำสั่งซื้อของฉัน',
  '/user/orders': 'คำสั่งซื้อของฉัน',
  '/user/purchase': 'คำสั่งซื้อของฉัน',
  '/profile': 'บัญชีของฉัน',
  '/user/profile': 'บัญชีของฉัน',
  '/user/account/profile': 'บัญชีของฉัน',
  '/emergency': 'ค้นหาข้อมูลฉุกเฉิน',
  '/admin': 'ระบบหลังบ้านร้านค้า',
  '/guardian': 'แดชบอร์ดผู้ปกครอง',
};

/**
 * Prefix matches, for the sections whose screens share a root.
 *
 * Order does not decide the winner — the match below requires a `/` boundary,
 * so `/campus/guardian-links` is not a `/campus/guardian` page and
 * `/guardian/spending-limits` is not the guardian dashboard. That boundary is
 * the whole guard; sorting this list would only hide it.
 */
const PREFIXES = [
  ['/guardian/spending-limits', 'ตั้งค่าวงเงินการใช้จ่าย'],
  ['/guardian/allergy-alert', 'ตั้งค่าการแจ้งเตือนภูมิแพ้'],
  ['/guardian/order-history', 'ประวัติการสั่งอาหารของบุตรหลาน'],
  ['/guardian/dashboard', 'แดชบอร์ดผู้ปกครอง'],
  ['/guardian/allergies', 'ตั้งค่าการแจ้งเตือนภูมิแพ้'],
  ['/guardian/history', 'ประวัติการสั่งอาหารของบุตรหลาน'],
  ['/guardian/limits', 'ตั้งค่าวงเงินการใช้จ่าย'],
  ['/campus/topup-approvals', 'ยืนยันการเติมเงิน'],
  ['/campus/guardian-links', 'ยืนยันบัญชีผู้ปกครอง'],
  ['/campus/queue-monitor', 'จอแสดงคิวโรงอาหารสด'],
  ['/campus/onboarding', 'สมัครเปิดร้านค้านักเรียน'],
  ['/campus/approvals', 'อนุมัติร้านค้านักเรียน'],
  ['/campus/emergency', 'ค้นหาข้อมูลฉุกเฉิน'],
  ['/campus/earnings', 'รายได้ร้านค้านักเรียน'],
  ['/campus/guardian', 'แดชบอร์ดผู้ปกครอง'],
  ['/campus/monitor', 'จอแสดงคิวโรงอาหารสด'],
  ['/admin/vendor-approvals', 'อนุมัติร้านค้านักเรียน'],
  ['/admin/topup-approvals', 'ยืนยันการเติมเงิน'],
  ['/admin/guardian-links', 'ยืนยันบัญชีผู้ปกครอง'],
  ['/student-vendor/earnings', 'รายได้ร้านค้านักเรียน'],
  ['/student-vendor/apply', 'สมัครเปิดร้านค้านักเรียน'],
  ['/portal/th-onboarding', 'ลงทะเบียนร้านค้า'],
  ['/portal/onboarding', 'ลงทะเบียนร้านค้า'],
  ['/merchant/dashboard', 'ระบบหลังบ้านร้านค้า'],
  ['/merchant/kds', 'จอครัว (KDS)'],
  ['/product/', 'รายละเอียดเมนู'],
];

/** The suffix on every title, so a tab is identifiable at a glance. */
export const APP_NAME = 'QueueUp';

/** The name of the screen at this path, or null when nothing matches. */
export function routeName(pathname) {
  if (typeof pathname !== 'string' || pathname === '') return null;
  // Trailing slashes and case are the router's business, not the title's.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '').toLowerCase() : '/';
  if (EXACT[path]) return EXACT[path];
  for (const [prefix, name] of PREFIXES) {
    if (path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)) return name;
  }
  return null;
}

/**
 * The full document title for a path.
 *
 * An unknown path is the 404 screen, and saying so in the tab is more use than
 * repeating the app's name — someone with a mistyped bookmark can see what
 * happened without opening it.
 */
export function routeTitle(pathname) {
  const name = routeName(pathname);
  if (!name) return `ไม่พบหน้านี้ · ${APP_NAME}`;
  if (name === 'หน้าแรก') return `${APP_NAME} · ระบบสั่งอาหารและจัดคิวโรงอาหาร`;
  return `${name} · ${APP_NAME}`;
}
