import { useState } from "react";
import { Link } from "react-router-dom";
import PdpaPolicyModal from "./PdpaPolicyModal.jsx";
import { getSecurityHealthReport } from "../services/aiSecurityShield.js";
import "./Footer.css";

/**
 * QUEUEUP MODERN REUSABLE FOOTER COMPONENT (Footer.jsx)
 * High-converting, accessible, responsive footer with AI Security Shield indicator.
 */
export default function Footer() {
  const [isPdpaOpen, setIsPdpaOpen] = useState(false);
  const [securityReport] = useState(() => getSecurityHealthReport());

  return (
    <footer className="qup-footer">
      <div className="qup-footer-container">
        <div className="qup-footer-grid">
          {/* Column 1: Brand & AI Security Shield Status */}
          <div className="qup-footer-brand">
            <div className="qup-footer-logo-row">
              <img src="/logo.png" alt="QueueUp Logo" className="qup-footer-logo-img" />
              <span className="qup-footer-brand-name">QueueUp Canteen</span>
            </div>
            <p className="qup-footer-brand-tagline">
              ระบบจองคิวอาหารและสั่งซื้อล่วงหน้าอัจฉริยะ ช่วยให้นักเรียนและบุคลากรประหยัดเวลา ไม่ต้องยืนต่อคิวยาวที่โรงอาหาร
            </p>
            <div className="qup-footer-shield-badge">
              <i className="bi bi-shield-check-fill" />
              <div>
                <div style={{ lineHeight: "1.2" }}>{securityReport.shieldVersion}</div>
                <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
                  สถานะระบบ: {securityReport.status}
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="qup-footer-heading">ลิงก์ด่วน (Navigation)</h4>
            <ul className="qup-footer-links">
              <li className="qup-footer-link-item">
                <Link to="/home">
                  <i className="bi bi-house-door" />
                  <span>หน้าหลักโรงอาหาร</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/search?keyword=ทั้งหมด">
                  <i className="bi bi-search" />
                  <span>เมนูอาหารทั้งหมด</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/user/account/profile?tab=bookings">
                  <i className="bi bi-journal-check" />
                  <span>ตรวจสอบคิวที่จองไว้</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/merchant/dashboard">
                  <i className="bi bi-shop" />
                  <span>ระบบหลังบ้านร้านค้า</span>
                </Link>
              </li>
              <li className="qup-footer-link-item">
                <Link to="/queueup">
                  <i className="bi bi-award" />
                  <span>เกี่ยวกับโครงการ QueueUp</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Care & Legal */}
          <div>
            <h4 className="qup-footer-heading">ศูนย์ช่วยเหลือ (Support)</h4>
            <ul className="qup-footer-links">
              <li className="qup-footer-link-item">
                <button onClick={() => setIsPdpaOpen(true)}>
                  <i className="bi bi-shield-lock" />
                  <span>นโยบายคุ้มครองข้อมูล PDPA</span>
                </button>
              </li>
              <li className="qup-footer-link-item">
                <button onClick={() => {
                  try {
                    localStorage.removeItem("queueup_cookie_consent");
                    window.location.reload();
                  } catch {}
                }}>
                  <i className="bi bi-sliders" />
                  <span>ตั้งค่าคุกกี้ (Cookie Settings)</span>
                </button>
              </li>
              <li className="qup-footer-link-item">
                <a href="tel:0812345678">
                  <i className="bi bi-telephone" />
                  <span>สายด่วนโรงอาหาร 081-234-5678</span>
                </a>
              </li>
              <li className="qup-footer-link-item">
                <a href="mailto:support@queueup.ac.th">
                  <i className="bi bi-envelope" />
                  <span>support@queueup.ac.th</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: App Download & Social */}
          <div>
            <h4 className="qup-footer-heading">ติดตามเรา & ดาวน์โหลด</h4>
            <p className="small text-slate-400 mb-2">ติดตามข่าวสารโปรโมชั่นอาหารโรงเรียน</p>
            <div className="qup-footer-social-row">
              <a href="#facebook" className="qup-footer-social-btn" title="Facebook Page">
                <i className="bi bi-facebook" />
              </a>
              <a href="#line" className="qup-footer-social-btn" title="Line Official Account">
                <i className="bi bi-line" />
              </a>
              <a href="#instagram" className="qup-footer-social-btn" title="Instagram">
                <i className="bi bi-instagram" />
              </a>
              <a href="#youtube" className="qup-footer-social-btn" title="YouTube">
                <i className="bi bi-youtube" />
              </a>
            </div>

            <div className="qup-footer-app-badges">
              <a href="#ios" className="qup-footer-app-btn">
                <i className="bi bi-apple fs-4" />
                <div>
                  <div style={{ fontSize: "10px", lineHeight: "1" }}>Download on</div>
                  <div className="fw-bold">App Store</div>
                </div>
              </a>
              <a href="#android" className="qup-footer-app-btn">
                <i className="bi bi-google-play fs-4" />
                <div>
                  <div style={{ fontSize: "10px", lineHeight: "1" }}>Get it on</div>
                  <div className="fw-bold">Google Play</div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="qup-footer-bottom">
          <div className="qup-footer-copy">
            © 2026 <strong>QueueUp Canteen CRM & Smart Queue</strong>. สงวนลิขสิทธิ์ตามกฎหมายไทย
          </div>
          <div className="qup-footer-bottom-links">
            <Link to="/pdpa?tab=terms">ข้อกำหนดเงื่อนไข</Link>
            <Link to="/pdpa?tab=privacy">ความเป็นส่วนตัว (PDPA)</Link>
            <span>•</span>
            <span>ความพร้อมใช้งานระบบ 99.98% ⚡</span>
          </div>
        </div>
      </div>

      {/* Global PDPA Modal Integration */}
      <PdpaPolicyModal isOpen={isPdpaOpen} onClose={() => setIsPdpaOpen(false)} />
    </footer>
  );
}
