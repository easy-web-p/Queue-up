import { useState } from "react";
import { Link } from "react-router-dom";
import { getSecurityHealthReport } from "../services/aiSecurityShield.js";
import "./Footer.css";

/**
 * QUEUEUP MODERN REUSABLE FOOTER COMPONENT (Footer.jsx)
 * High-converting, accessible, responsive footer with AI Security Shield indicator.
 * All PDPA and Terms links navigate to standalone /pdpa page.
 */
export default function Footer() {
  const [securityReport] = useState(() => getSecurityHealthReport());

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
              <img src="/logo.png" alt="QueueUp Logo" className="qup-footer-logo-img w-9 h-9 object-contain" />
              <span className="qup-footer-brand-name font-black text-lg text-white font-['Kanit']">QueueUp Canteen</span>
            </div>
            <p className="qup-footer-brand-tagline text-xs text-slate-400 leading-relaxed">
              ระบบจองคิวอาหารและสั่งซื้อล่วงหน้าอัจฉริยะ ช่วยให้นักเรียนและบุคลากรประหยัดเวลา ไม่ต้องยืนต่อคิวยาวที่โรงอาหาร
            </p>
            <div className="qup-footer-shield-badge inline-flex items-center gap-2.5 p-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-emerald-400 shadow-sm">
              <i className="bi bi-shield-check-fill text-lg text-emerald-400" />
              <div>
                <div className="leading-tight font-bold text-slate-200">{securityReport.shieldVersion}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  สถานะระบบ: {securityReport.status}
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
                <a href="tel:0812345678" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-telephone text-sky-400" />
                  <span>สายด่วนโรงอาหาร 081-234-5678</span>
                </a>
              </li>
              <li className="qup-footer-link-item">
                <a href="mailto:support@queueup.ac.th" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <i className="bi bi-envelope text-orange-400" />
                  <span>support@queueup.ac.th</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: App Download & Social */}
          <div>
            <h4 className="qup-footer-heading font-black text-sm text-white mb-4">ติดตามเรา & ดาวน์โหลด</h4>
            <p className="small text-slate-400 text-xs mb-3">ติดตามข่าวสารโปรโมชั่นอาหารโรงเรียน</p>
            <div className="qup-footer-social-row flex items-center gap-2 mb-5">
              <a href="#facebook" className="qup-footer-social-btn w-8 h-8 rounded-xl bg-slate-900 hover:bg-[#1877f2] border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-xs" title="Facebook Page">
                <i className="bi bi-facebook text-sm" />
              </a>
              <a href="#line" className="qup-footer-social-btn w-8 h-8 rounded-xl bg-slate-900 hover:bg-[#00c300] border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-xs" title="Line Official Account">
                <i className="bi bi-line text-sm" />
              </a>
              <a href="#instagram" className="qup-footer-social-btn w-8 h-8 rounded-xl bg-slate-900 hover:bg-gradient-to-tr hover:from-amber-500 hover:via-rose-500 hover:to-purple-600 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-xs" title="Instagram">
                <i className="bi bi-instagram text-sm" />
              </a>
              <a href="#youtube" className="qup-footer-social-btn w-8 h-8 rounded-xl bg-slate-900 hover:bg-[#ff0000] border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-xs" title="Youtube">
                <i className="bi bi-youtube text-sm" />
              </a>
            </div>

            <div className="qup-footer-app-badges flex flex-col gap-2">
              <a href="#ios" className="qup-footer-app-btn flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white transition-all shadow-xs">
                <i className="bi bi-apple text-xl" />
                <div>
                  <div className="text-[10px] text-slate-400 leading-none">Download on</div>
                  <div className="font-bold text-xs">App Store</div>
                </div>
              </a>
              <a href="#android" className="qup-footer-app-btn flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white transition-all shadow-xs">
                <i className="bi bi-google-play text-lg text-emerald-400" />
                <div>
                  <div className="text-[10px] text-slate-400 leading-none">Get it on</div>
                  <div className="font-bold text-xs">Google Play</div>
                </div>
              </a>
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
