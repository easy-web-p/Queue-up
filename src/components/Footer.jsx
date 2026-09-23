import { Link } from "react-router-dom";
import "./Footer.css";

/**
 * QUEUEUP MODERN REUSABLE FOOTER COMPONENT (Footer.jsx)
 * High-converting, accessible, responsive footer with AI Security Shield indicator.
 * All PDPA and Terms links navigate to standalone /pdpa page.
 */
export default function Footer() {
  // Scroll window smooth to top on footer link click
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <footer className="qup-footer bg-slate-950 text-slate-400 font-sans border-t border-slate-800">
      <div className="qup-footer-container max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="qup-footer-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-800/80">
          {/* Column 1: Brand & AI Security Shield Status */}
          <div className="qup-footer-brand space-y-4">
            <div className="qup-footer-logo-row flex items-center gap-2.5">
              <img decoding="async" src="/logo.png" alt="QueueUp Logo" className="qup-footer-logo-img w-9 h-9 object-contain" />
              <span className="qup-footer-brand-name font-black text-lg text-white font-['Kanit']">QueueUp Canteen</span>
            </div>
            <p className="qup-footer-brand-tagline text-xs text-slate-400 leading-relaxed">
              ระบบจองคิวอาหารและสั่งซื้อล่วงหน้าอัจฉริยะ ช่วยให้นักเรียนและบุคลากรประหยัดเวลา ไม่ต้องยืนต่อคิวยาวที่โรงอาหาร
            </p>
            {/* This badge read "QueueUp AI Security Sentinel v2.5 / สถานะระบบ:
                HEALTHY" on every page, from a status counted out of the
                visitor's own localStorage. A status an attacker can set by
                clearing site data is not a status. */}
            <div className="qup-footer-shield-badge inline-flex items-center gap-2.5 p-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-emerald-400 shadow-sm">
              <i className="bi bi-shield-check-fill text-lg text-emerald-400" />
              <div>
                <div className="leading-tight font-bold text-slate-200">ข้อมูลของคุณอยู่ภายใต้ PDPA</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  สิทธิ์การเข้าถึงบังคับฝั่งเซิร์ฟเวอร์ · ลบบัญชีได้เองทุกเมื่อ
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="qup-footer-heading font-black text-sm text-white mb-4">ลิงก์ด่วน (Navigation)</h4>
            <ul className="qup-footer-links space-y-2.5 list-none p-0 m-0 text-xs">
              <li className="qup-footer-link-item">
                <Link to="/home" onClick={scrollToTop} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-house-door text-orange-500" />
                  <span>หน้าหลักโรงอาหาร</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/search?keyword=ทั้งหมด" onClick={scrollToTop} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-search text-orange-500" />
                  <span>เมนูอาหารทั้งหมด</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/user/account/profile?tab=bookings" onClick={scrollToTop} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-journal-check text-orange-500" />
                  <span>ตรวจสอบคิวที่จองไว้</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/merchant/dashboard" onClick={scrollToTop} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-shop text-orange-500" />
                  <span>ระบบหลังบ้านร้านค้า</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/guardian" onClick={scrollToTop} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-shield-heart text-rose-500" />
                  <span>แดชบอร์ดผู้ปกครอง (Guardian)</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/student-vendor/apply" onClick={scrollToTop} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-mortarboard text-amber-400" />
                  <span>ขอเปิดร้านค้านักเรียน</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/campus/monitor" onClick={scrollToTop} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-tv text-sky-400" />
                  <span>จอแสดงคิวโรงอาหารสด</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/queueup" onClick={scrollToTop} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-award text-amber-400" />
                  <span>เกี่ยวกับโครงการ QueueUp</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Care & Legal */}
          <div>
            <h4 className="qup-footer-heading font-black text-sm text-white mb-4">ศูนย์ช่วยเหลือ (Support)</h4>
            <ul className="qup-footer-links space-y-2.5 list-none p-0 m-0 text-xs">
              <li className="qup-footer-link-item">
                <Link to="/pdpa?tab=privacy" onClick={scrollToTop} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-shield-lock text-emerald-400" />
                  <span>นโยบายคุ้มครองข้อมูล PDPA</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <button
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors bg-transparent border-0 p-0 cursor-pointer text-xs"
                  onClick={() => {
                    try {
                      localStorage.removeItem("queueup_cookie_consent");
                      window.location.reload();
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <i className="bi bi-sliders text-amber-400" />
                  <span>ตั้งค่าคุกกี้ (Cookie Settings)</span>
                </button>
              </li>
              <li className="qup-footer-link-item">
                <a href="tel:0921975525" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-telephone text-sky-400" />
                  <span>สายด่วน 092-197-5525</span>
                </a>
              </li>
              <li className="qup-footer-link-item">
                <a href="mailto:hi00000087@gmail.com" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-envelope text-orange-400" />
                  <span>hi00000087@gmail.com</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: How to reach us, and how to keep the app to hand.
              This column used to carry four social buttons (#facebook, #line,
              #instagram, #youtube) and an App Store and Google Play badge.
              None of the five destinations exist: the hrefs were bare fragment
              ids that scroll nowhere, and there is no native app to download —
              QueueUp is a web app. A school handing this page to parents was
              offering support channels nobody was reading.

              What replaces them is what is actually true: the two contact
              routes the school really answers on, and the install prompt the
              browser really offers, because public/manifest.json makes this
              an installable PWA. */}
          <div>
            <h4 className="qup-footer-heading font-black text-sm text-white mb-4">ติดต่อเรา & ติดตั้งแอป</h4>
            <p className="small text-slate-400 text-xs mb-3">
              ช่องทางที่ติดต่อได้จริงในเวลาทำการของโรงเรียน
            </p>

            <ul className="list-none pl-0 mb-5 space-y-2">
              <li>
                <a
                  href="tel:0921975525"
                  className="qup-footer-contact-btn flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white transition-all shadow-xs min-h-[44px]"
                >
                  <i className="bi bi-telephone text-lg text-sky-400" />
                  <div>
                    <div className="text-[10px] text-slate-400 leading-none">โทรหาเจ้าหน้าที่</div>
                    <div className="font-bold text-xs">092-197-5525</div>
                  </div>
                </a>
              </li>
              <li>
                <a
                  href="mailto:hi00000087@gmail.com"
                  className="qup-footer-contact-btn flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white transition-all shadow-xs min-h-[44px]"
                >
                  <i className="bi bi-envelope text-lg text-amber-400" />
                  <div>
                    <div className="text-[10px] text-slate-400 leading-none">อีเมลทีมงาน</div>
                    <div className="font-bold text-xs">hi00000087@gmail.com</div>
                  </div>
                </a>
              </li>
            </ul>

            <div className="qup-footer-install rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-3">
              <div className="flex items-center gap-2 mb-1">
                <i className="bi bi-phone text-emerald-400" />
                <span className="font-bold text-xs text-white">ติดตั้งเป็นแอปบนมือถือ</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-0">
                ไม่ต้องติดตั้งจากสโตร์ใด — เปิดเว็บนี้บนมือถือ แล้วเลือก
                &quot;เพิ่มไปยังหน้าจอโฮม&quot; (Add to Home Screen) จะใช้งานได้เหมือนแอปจริง
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="qup-footer-bottom pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="qup-footer-copy text-center sm:text-left">
            © 2026 <strong className="text-slate-300">QueueUp Canteen CRM & Smart Queue</strong>. สงวนลิขสิทธิ์ตามกฎหมายไทย
          </div>
          <div className="qup-footer-bottom-links flex items-center gap-3 flex-wrap justify-center">
            <Link to="/pdpa?tab=terms" onClick={scrollToTop} className="text-slate-400 hover:text-white transition-colors">ข้อกำหนดเงื่อนไข</Link>
            <Link to="/pdpa?tab=privacy" onClick={scrollToTop} className="text-slate-400 hover:text-white transition-colors">ความเป็นส่วนตัว (PDPA)</Link>
            <span>•</span>
            <button
              onClick={scrollToTop}
              className="text-slate-400 bg-transparent border-0 p-0 hover:text-orange-400 cursor-pointer text-xs transition-colors"
            >
              เลื่อนกลับสู่ด้านบนสุด ⬆️
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
