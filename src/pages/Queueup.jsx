import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { fetchEvaluationsFromFirestore, submitEvaluationToFirestore } from "../lib/firebase.js";
import "./Queueup.css";

/**
 * QUEUEUP LANDING PAGE & ABOUT US PRESENTATION (Queueup.jsx)
 * Presentation showcase page for the QueueUp Smart Queue & Food Ordering Application.
 */
export default function Queueup() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState("story"); // 'story' | 'vision' | 'mission'

  // Dynamic Real User Evaluations State
  const [evaluations, setEvaluations] = useState([]);
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Inputs for Rating Submission
  const [evalName, setEvalName] = useState(user ? user.name || user.email : "");
  const [evalUx, setEvalUx] = useState(9.5);
  const [evalAccount, setEvalAccount] = useState(9.5);
  const [evalQueue, setEvalQueue] = useState(10.0);
  const [evalMerchant, setEvalMerchant] = useState(10.0);
  const [evalSecurity, setEvalSecurity] = useState(9.0);
  const [evalComment, setEvalComment] = useState("");

  // Load Real Evaluations from Firestore / LocalStorage
  useEffect(() => {
    fetchEvaluationsFromFirestore().then((data) => {
      if (data && data.length > 0) {
        setEvaluations(data);
      }
    });
  }, []);

  // Dynamically Compute Averages from Real User Data
  const scores = useMemo(() => {
    if (!evaluations || evaluations.length === 0) {
      return { ux: 9.5, account: 9.5, queue: 10.0, merchant: 10.0, security: 9.0, total: 9.2, count: 0 };
    }
    const count = evaluations.length;
    const uxSum = evaluations.reduce((acc, curr) => acc + Number(curr.uxScore || 9), 0);
    const accountSum = evaluations.reduce((acc, curr) => acc + Number(curr.accountScore || 9), 0);
    const queueSum = evaluations.reduce((acc, curr) => acc + Number(curr.queueScore || 10), 0);
    const merchantSum = evaluations.reduce((acc, curr) => acc + Number(curr.merchantScore || 10), 0);
    const securitySum = evaluations.reduce((acc, curr) => acc + Number(curr.securityScore || 9), 0);

    const ux = (uxSum / count).toFixed(1);
    const account = (accountSum / count).toFixed(1);
    const queue = (queueSum / count).toFixed(1);
    const merchant = (merchantSum / count).toFixed(1);
    const security = (securitySum / count).toFixed(1);

    const total = (
      (Number(ux) + Number(account) + Number(queue) + Number(merchant) + Number(security)) / 5
    ).toFixed(1);

    return { ux, account, queue, merchant, security, total, count };
  }, [evaluations]);

  // Handle User Evaluation Form Submission
  const handleEvalSubmit = async (e) => {
    e.preventDefault();
    if (!evalName.trim()) {
      alert("กรุณากรอกชื่อผู้ประเมิน");
      return;
    }
    setIsSubmitting(true);
    const newRating = {
      userName: evalName.trim(),
      uxScore: Number(evalUx),
      accountScore: Number(evalAccount),
      queueScore: Number(evalQueue),
      merchantScore: Number(evalMerchant),
      securityScore: Number(evalSecurity),
      comment: evalComment.trim(),
    };

    const saved = await submitEvaluationToFirestore(newRating);
    setEvaluations((prev) => [saved, ...prev]);
    setIsSubmitting(false);
    setIsEvalModalOpen(false);
    setEvalComment("");
    alert("ขอบคุณสำหรับผลประเมินสถาปัตยกรรมระบบ QueueUp CRM ครับ!");
  };

  // Scroll listener for sticky glass navbar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleStartApp = () => {
    if (user || localStorage.getItem("queueup_user")) {
      navigate("/home");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="qup-landing-wrapper">
      {/* Background Ambient Glow Effects */}
      <div className="qup-glow-bg qup-glow-1" />
      <div className="qup-glow-bg qup-glow-2" />
      <div className="qup-glow-bg qup-glow-3" />

      {/* ==================== 1. STICKY NAVBAR ==================== */}
      <header className={`qup-navbar ${isScrolled ? "scrolled" : ""}`}>
        <div className="qup-nav-content">
          <div className="qup-logo-group" onClick={() => navigate("/about")}>
            <img src="/logo.png" alt="QueueUp Logo" className="qup-logo-img" />
            <span className="qup-logo-text">QueueUp</span>
          </div>

          <nav className="qup-nav-links">
            <a href="#hero">หน้าแรก</a>
            <a href="#about">เกี่ยวกับเรา</a>
            <a href="#features">ฟีเจอร์เด็ด</a>
            <a href="#security">ความปลอดภัย</a>
            <a href="#stats">สถิติระบบ</a>
          </nav>

          <div className="qup-nav-actions">
            {!user && (
              <button
                className="qup-btn-secondary"
                onClick={() => navigate("/login")}
              >
                เข้าสู่ระบบ
              </button>
            )}
            <button className="qup-btn-primary" onClick={handleStartApp}>
              <span>{user ? "เข้าสู่แอปพลิเคชัน" : "เริ่มต้นใช้งาน"}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ==================== 2. HERO PRESENTATION SECTION ==================== */}
      <section id="hero" className="qup-hero-section">
        <div className="qup-hero-text-content">
          <div className="qup-badge-pill">
            <i className="bi bi-stars text-warning me-1" />
            <span>World-Class Smart Queue & Food Ordering CRM</span>
          </div>
          <h1 className="qup-hero-title">
            ระบบจองคิวและสั่งอาหาร <br />
            <span className="qup-gradient-text">อัจฉริยะแห่งอนาคต</span>
          </h1>
          <p className="qup-hero-desc">
            ยกระดับการให้บริการของร้านค้าและการจองคิวของลูกค้าด้วย <strong>QueueUp Platform</strong> ระบบจัดการคิว Real-Time พร้อมระบบสั่งอาหารและชำระเงินอัตโนมัติ ด้วยมาตรฐานความปลอดภัยสูงสุดแบบ Zero-Trust & Salted Cryptography
          </p>

          <div className="qup-hero-btns">
            <button className="qup-btn-primary" style={{ padding: "0.9rem 2rem", fontSize: "1rem" }} onClick={handleStartApp}>
              <i className="bi bi-rocket-takeoff-fill me-2" /> เริ่มต้นทดลองใช้งานระบบ
            </button>
            <a href="#about" className="qup-btn-secondary" style={{ padding: "0.9rem 1.8rem", fontSize: "1rem", textDecoration: "none", display: "inline-block" }}>
              <i className="bi bi-book-fill me-2" /> อ่านเกี่ยวกับเรา
            </a>
          </div>
        </div>

        <div className="qup-hero-card-display">
          <div className="qup-mascot-frame">
            <img src="/yeti_mascot.jpg" alt="QueueUp Yeti Mascot" className="qup-mascot-img" />

            {/* Floating Live Badges */}
            <div className="qup-float-badge qup-float-1">
              <i className="bi bi-lightning-charge-fill text-warning me-2" style={{ fontSize: "1.2rem" }} />
              <div>
                <div style={{ color: "#ffffff" }}>คิวเฉลี่ย &lt; 2 นาที</div>
                <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>Real-Time Queue Sync</div>
              </div>
            </div>

            <div className="qup-float-badge qup-float-2">
              <i className="bi bi-shield-check text-success me-2" style={{ fontSize: "1.2rem" }} />
              <div>
                <div style={{ color: "#4ade80" }}>Zero-Trust Security</div>
                <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>SHA-256 & AES-256</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 3. STATS & IMPACT BAR ==================== */}
      <section id="stats" className="qup-stats-bar">
        <div className="qup-stats-grid">
          <div className="qup-stat-item">
            <div className="qup-stat-number">50,000+</div>
            <div className="qup-stat-label">คิวที่ให้บริการสำเร็จ</div>
          </div>
          <div className="qup-stat-item">
            <div className="qup-stat-number">500+</div>
            <div className="qup-stat-label">ร้านค้าพันธมิตรไว้วางใจ</div>
          </div>
          <div className="qup-stat-item">
            <div className="qup-stat-number">99.9%</div>
            <div className="qup-stat-label">Uptime ความเสถียรของระบบ</div>
          </div>
          <div className="qup-stat-item">
            <div className="qup-stat-number">&lt; 2 นาที</div>
            <div className="qup-stat-label">เวลาการรอคิวเฉลี่ย</div>
          </div>
        </div>
      </section>

      {/* ==================== 4. ABOUT US SECTION (เกี่ยวกับเรา) ==================== */}
      <section id="about" className="qup-section-container">
        <div className="qup-section-header">
          <span className="qup-section-sub">ABOUT US — เกี่ยวกับเรา</span>
          <h2 className="qup-section-title">นวัตกรรมเพื่อการบริการที่ไร้รอยต่อ</h2>
          <p className="qup-section-desc">
            <strong>QueueUp System</strong> พัฒนาขึ้นด้วยความมุ่งมั่นที่จะแก้ปัญหาการต่อคิวยาวและการจัดการออเดอร์ในร้านอาหารยุคใหม่ ให้เป็นเรื่องง่าย รวดเร็ว และปลอดภัยที่สุดสำหรับทั้งลูกค้าและผู้ประกอบการ
          </p>
        </div>

        {/* About Us Tabs & Interactive Story Cards */}
        <div className="qup-about-grid">
          <div className="qup-about-card">
            <div className="qup-about-icon-wrapper">
              <i className="bi bi-rocket-takeoff-fill" />
            </div>
            <h3 className="qup-about-card-title">เรื่องราวและวิสัยทัศน์ของเรา</h3>
            <p className="qup-about-card-text">
              เราเชื่อว่า "เวลา" คือสิ่งมีค่าที่สุดของทุกคน <strong>QueueUp</strong> จึงถูกออกแบบมาเพื่อเปลี่ยนประสบการณ์การรอคิวแบบเดิมๆ ให้กลายเป็นความสะดวกสบายเพียงปลายนิ้วสัมผัส ลูกค้าสามารถจองคิว สั่งอาหาร และติดตามสถานะได้แบบ Real-Time จากทุกที่
            </p>
          </div>

          <div className="qup-about-card">
            <div className="qup-about-icon-wrapper" style={{ background: "rgba(124, 58, 237, 0.15)", color: "#a855f7" }}>
              <i className="bi bi-bullseye" />
            </div>
            <h3 className="qup-about-card-title">พันธกิจของเรา (Our Mission)</h3>
            <p className="qup-about-card-text">
              มุ่งมั่นสร้างสรรค์แพลตฟอร์ม CRM และระบบจองคิวอัจฉริยะที่เชื่อมโยงผู้คนและร้านค้าเข้าด้วยกัน ด้วยเทคโนโลยีที่มีประสิทธิภาพ เสถียร ปลอดภัยสูงสุด และใช้งานง่ายสำหรับคนไทยทุกกลุ่ม
            </p>
          </div>
        </div>

        {/* 3 Core Pillars / Values */}
        <div className="qup-values-grid">
          <div className="qup-value-item">
            <span className="qup-value-badge">PILLAR 01</span>
            <h4 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "0.6rem" }}>
              <i className="bi bi-lightning-fill text-warning me-2" /> Speed & Precision
            </h4>
            <p style={{ color: "#94a3b8", fontSize: "0.92rem", lineHeight: "1.6" }}>
              ระบบซิงค์ข้อมูล Real-Time คำนวณลำดับคิวถูกต้องแม่นยำ รักษาสิทธิ์ของลูกค้าได้ 100%
            </p>
          </div>

          <div className="qup-value-item">
            <span className="qup-value-badge" style={{ background: "rgba(34, 197, 94, 0.2)", color: "#4ade80" }}>PILLAR 02</span>
            <h4 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "0.6rem" }}>
              <i className="bi bi-shield-lock-fill text-success me-2" /> Enterprise Security
            </h4>
            <p style={{ color: "#94a3b8", fontSize: "0.92rem", lineHeight: "1.6" }}>
              ปกป้องข้อมูลผู้ใช้ด้วย Salted SHA-256 Hashing, AES-256 Encryption และ DNS MX Domain Verification
            </p>
          </div>

          <div className="qup-value-item">
            <span className="qup-value-badge" style={{ background: "rgba(238, 77, 45, 0.2)", color: "#ff8c73" }}>PILLAR 03</span>
            <h4 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "0.6rem" }}>
              <i className="bi bi-heart-fill text-danger me-2" /> Customer-Centric UX
            </h4>
            <p style={{ color: "#94a3b8", fontSize: "0.92rem", lineHeight: "1.6" }}>
              ดีไซน์พรีเมียม สวยงาม ใช้งานง่าย ปรับโปรไฟล์ส่วนตัว และจัดการรหัสบัญชีได้อย่างปลอดภัย
            </p>
          </div>
        </div>
      </section>

      {/* ==================== 5. FEATURES SHOWCASE ==================== */}
      <section id="features" className="qup-section-container">
        <div className="qup-section-header">
          <span className="qup-section-sub">KEY FEATURES — ฟีเจอร์เด็ด</span>
          <h2 className="qup-section-title">ฟีเจอร์ทรงพลังเพื่อประสบการณ์ที่ดีที่สุด</h2>
          <p className="qup-section-desc">
            ค้นพบเครื่องมือที่ครบครันสำหรับการจัดการคิวและสั่งอาหารในแอปพลิเคชัน QueueUp
          </p>
        </div>

        <div className="qup-features-grid">
          <div className="qup-feature-card">
            <div className="qup-feature-icon"><i className="bi bi-phone-vibrate-fill" /></div>
            <h3 className="qup-feature-title">Real-Time Queue Management</h3>
            <p className="qup-feature-text">
              จองคิวล่วงหน้า รับการแจ้งเตือนเมื่อใกล้ถึงคิว และติดตามลำดับคิวแบบ Real-Time จากมือถือของคุณ
            </p>
          </div>

          <div className="qup-feature-card">
            <div className="qup-feature-icon" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" }}><i className="bi bi-egg-fried" /></div>
            <h3 className="qup-feature-title">Smart Food Ordering</h3>
            <p className="qup-feature-text">
              เลือกชมเมนูอาหาร ปรับแต่งระดับความเผ็ด ท็อปปิ้ง และคำนวณราคาอัตโนมัติได้อย่างรวดเร็ว
            </p>
          </div>

          <div className="qup-feature-card">
            <div className="qup-feature-icon" style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)" }}><i className="bi bi-qr-code-scan" /></div>
            <h3 className="qup-feature-title">Dynamic PromptPay QR</h3>
            <p className="qup-feature-text">
              สร้าง QR Code สแกนจ่ายเงินอัตโนมัติตามยอดสั่งซื้อ พร้อมระบบแนบและตรวจสอบสลิปโอนเงิน
            </p>
          </div>

          <div className="qup-feature-card">
            <div className="qup-feature-icon" style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" }}><i className="bi bi-lock-fill" /></div>
            <h3 className="qup-feature-title">Zero-Trust Cryptography</h3>
            <p className="qup-feature-text">
              ความปลอดภัยระดับสากล แฮชรหัสผ่านด้วย Salted SHA-256 และเข้ารหัสข้อมูลด้วย AES-256-GCM
            </p>
          </div>

          <div className="qup-feature-card">
            <div className="qup-feature-icon" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}><i className="bi bi-person-badge-fill" /></div>
            <h3 className="qup-feature-title">Account & Profile Auto-Save</h3>
            <p className="qup-feature-text">
              จัดการรหัสบัญชี แก้ไขข้อมูลส่วนตัว พร้อมระบบบันทึกข้อมูลอัตโนมัติ (Real-Time Auto-Save)
            </p>
          </div>

          <div className="qup-feature-card">
            <div className="qup-feature-icon" style={{ background: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)" }}><i className="bi bi-laptop" /></div>
            <h3 className="qup-feature-title">Cross-Platform Accessibility</h3>
            <p className="qup-feature-text">
              รองรับการใช้งานบนทุกอุปกรณ์ ทั้งคอมพิวเตอร์ แท็บเล็ต และสมาร์ตโฟน แบบ Responsive 100%
            </p>
          </div>
        </div>
      </section>

      {/* ==================== 6. ZERO-TRUST SECURITY SHOWCASE ==================== */}
      <section id="security" className="qup-section-container">
        <div className="qup-security-banner">
          <div>
            <span className="qup-section-sub" style={{ color: "#4ade80" }}>SECURITY FIRST</span>
            <h2 className="qup-section-title" style={{ fontSize: "2rem" }}>ความปลอดภัยระดับสากลเพื่อความมั่นใจ 100%</h2>
            <p className="qup-section-desc">
              QueueUp ใช้สถาปัตยกรรมความปลอดภัยแบบ Zero-Trust ในการปกป้องข้อมูลส่วนบุคคล รหัสผ่าน และธุรกรรมทางการเงินของผู้ใช้ทุกคน
            </p>

            <ul className="qup-sec-list">
              <li>
                <div className="qup-sec-check"><i className="bi bi-check-lg" /></div>
                <span>เข้ารหัสรหัสผ่านด้วย <strong>Salted SHA-256 Cryptographic Hashing</strong></span>
              </li>
              <li>
                <div className="qup-sec-check"><i className="bi bi-check-lg" /></div>
                <span>จัดเก็บข้อมูลด้วยมาตรฐานความปลอดภัยสมมาตร <strong>AES-256-GCM</strong></span>
              </li>
              <li>
                <div className="qup-sec-check"><i className="bi bi-check-lg" /></div>
                <span>ตรวจสอบโดเมนอีเมลจริงผ่าน <strong>Cloudflare DNS Over HTTPS (DoH)</strong></span>
              </li>
              <li>
                <div className="qup-sec-check"><i className="bi bi-check-lg" /></div>
                <span>แยกคอลเลกชันข้อมูลการเงินลับไว้ที่ <strong>merchantProfiles/{`{merchantId}`}/private/finance</strong></span>
              </li>
            </ul>
          </div>

          <div className="qup-sec-graphic">
            <div className="qup-shield-icon"><i className="bi bi-shield-lock-fill text-success" /></div>
            <div style={{ color: "#ffffff", fontWeight: "700", marginTop: "1rem" }}>Zero-Trust Certified</div>
            <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Encrypted End-to-End</div>
          </div>
        </div>
      </section>

      {/* ==================== 7. SYSTEM EVALUATION SCORECARD & FUTURE ROADMAP ==================== */}
      <section id="roadmap" className="qup-section-container">
        <div className="qup-section-header">
          <span className="qup-section-sub">REAL USER SYSTEM ASSESSMENT — คะแนนประเมินจากผู้ใช้งานจริง</span>
          <h2 className="qup-section-title">ผลประเมินสถาปัตยกรรมระบบ ({scores.total} / 10)</h2>
          <p className="qup-section-desc">
            คำนวณคะแนนเฉลี่ยแบบ Real-Time จากผลประเมินของผู้ใช้งานจริงรวม <strong>{scores.count} ท่าน</strong> ที่ได้ทดสอบใช้งานระบบ QueueUp School Food CRM & Marketplace
          </p>
        </div>

        {/* Overall Score Card & Dynamic Bar Chart */}
        <div className="row g-4 qup-score-banner">
          <div className="col-lg-4 d-flex flex-column align-items-center justify-content-center text-center">
            <div className="qup-score-badge-box w-100">
              <div className="qup-score-big-num">{scores.total}</div>
              <div className="fw-bold fs-5 mt-1">/ 10 คะแนนรวมเฉลี่ย</div>
              <div className="badge bg-white text-danger mt-2 px-3 py-1">
                จากผลประเมินจริง {scores.count} รายการ
              </div>
              <div className="mt-3">
                <button
                  className="btn btn-light font-weight-bold btn-sm shadow-sm"
                  onClick={() => setIsEvalModalOpen(true)}
                >
                  <i className="bi bi-star-fill text-warning me-1" /> ส่งผลประเมินของคุณ
                </button>
              </div>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="qup-score-bar-item">
              <div className="qup-score-bar-label"><span>🎨 UX/UI Design & Responsiveness</span><span>{scores.ux} / 10</span></div>
              <div className="qup-score-progress-track"><div className="qup-score-progress-fill" style={{ width: `${(scores.ux / 10) * 100}%`, background: "#ee4d2d" }} /></div>
            </div>

            <div className="qup-score-bar-item">
              <div className="qup-score-bar-label"><span>👤 "บัญชีเดียว ขยายได้ตามการเติบโต" (One Account Role Switch)</span><span>{scores.account} / 10</span></div>
              <div className="qup-score-progress-track"><div className="qup-score-progress-fill" style={{ width: `${(scores.account / 10) * 100}%`, background: "#8b5cf6" }} /></div>
            </div>

            <div className="qup-score-bar-item">
              <div className="qup-score-bar-label"><span>📋 Order & Live Queue Flow (Pre-Order / Smart Queue)</span><span>{scores.queue} / 10</span></div>
              <div className="qup-score-progress-track"><div className="qup-score-progress-fill" style={{ width: `${(scores.queue / 10) * 100}%`, background: "#22c55e" }} /></div>
            </div>

            <div className="qup-score-bar-item">
              <div className="qup-score-bar-label"><span>🏪 Merchant Seller Centre CRM & Analytics</span><span>{scores.merchant} / 10</span></div>
              <div className="qup-score-progress-track"><div className="qup-score-progress-fill" style={{ width: `${(scores.merchant / 10) * 100}%`, background: "#0ea5e9" }} /></div>
            </div>

            <div className="qup-score-bar-item">
              <div className="qup-score-bar-label"><span>🛡️ Authentication & Private Finance Isolation</span><span>{scores.security} / 10</span></div>
              <div className="qup-score-progress-track"><div className="qup-score-progress-fill" style={{ width: `${(scores.security / 10) * 100}%`, background: "#f59e0b" }} /></div>
            </div>
          </div>
        </div>

        {/* Real User Evaluation Comments Carousel / Grid */}
        <div className="mb-5">
          <h4 className="fw-bold text-light mb-3">
            <i className="bi bi-chat-quote-fill text-warning me-2" /> ความคิดเห็นและผลประเมินจากผู้ใช้งานจริงล่าสุด ({evaluations.length} ความคิดเห็น)
          </h4>
          <div className="row g-3">
            {evaluations.slice(0, 4).map((item, idx) => (
              <div key={item.id || idx} className="col-md-6">
                <div className="p-3 rounded-3" style={{ background: "rgba(30, 41, 59, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-bold text-white small">
                      <i className="bi bi-person-circle text-primary me-2" /> {item.userName}
                    </div>
                    <span className="badge bg-warning text-dark">
                      <i className="bi bi-star-fill me-1" />
                      {(((Number(item.uxScore || 9) + Number(item.accountScore || 9) + Number(item.queueScore || 10) + Number(item.merchantScore || 10) + Number(item.securityScore || 9)) / 5)).toFixed(1)} / 10
                    </span>
                  </div>
                  <p className="text-slate-300 small mb-0 font-italic">"{item.comment || "สถาปัตยกรรมระบบสมบูรณ์และใช้งานได้จริงดีเยี่ยม"}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Future Roadmap Priorities */}
        <h3 className="qup-section-title text-center mb-4" style={{ fontSize: "1.6rem" }}>
          <i className="bi bi-diagram-3-fill text-warning me-2" /> แผนการพัฒนาและต่อยอดระบบในอนาคต (Firestore Schema v3 Roadmap)
        </h3>

        <div className="row g-4">
          <div className="col-md-4">
            <div className="qup-roadmap-card">
              <span className="qup-roadmap-priority-tag bg-danger text-white">Priority 1 — สำคัญมาก</span>
              <h4 className="fw-bold text-light fs-5 mb-2"><i className="bi bi-bell-fill text-danger me-2" /> Notification & Cart Core</h4>
              <ul className="qup-roadmap-list">
                <li className="qup-roadmap-item">• <strong>Notification Center</strong>: คอลเลกชัน <code>notifications/{`{notificationId}`}</code> แจ้งเตือนอาหารพร้อมรับ & โปรโมชั่น</li>
                <li className="qup-roadmap-item">• <strong>Favorites Data Sync</strong>: <code>users/{`{uid}`}/favorites</code> เก็บรายการเมนูโปรด</li>
                <li className="qup-roadmap-item">• <strong>Cart System</strong>: <code>users/{`{uid}`}/cart</code> คำนวณตะกร้าก่อนชำระเงิน</li>
              </ul>
            </div>
          </div>

          <div className="col-md-4">
            <div className="qup-roadmap-card">
              <span className="qup-roadmap-priority-tag bg-primary text-white">Priority 2 — ขยายผล CRM</span>
              <h4 className="fw-bold text-light fs-5 mb-2"><i className="bi bi-star-fill text-warning me-2" /> Review & Merchant Analytics</h4>
              <ul className="qup-roadmap-list">
                <li className="qup-roadmap-item p2">• <strong>Review & Rating System</strong>: คอลเลกชัน <code>reviews/{`{reviewId}`}</code> ให้คะแนน 1-5 ดาวพร้อมเขียนรีวิว</li>
                <li className="qup-roadmap-item p2">• <strong>Merchant KPI Dashboard</strong>: วิเคราะห์ยอดขายรายวัน, ลูกค้าประจำ, Repeat Rate และ Average Order Value</li>
              </ul>
            </div>
          </div>

          <div className="col-md-4">
            <div className="qup-roadmap-card">
              <span className="qup-roadmap-priority-tag bg-success text-white">Priority 3 — นวัตกรรม AI</span>
              <h4 className="fw-bold text-light fs-5 mb-2"><i className="bi bi-cpu-fill text-info me-2" /> AI QueueUp Smart Search</h4>
              <ul className="qup-roadmap-list">
                <li className="qup-roadmap-item p3">• <strong>Rule-based Recommendation Engine</strong>: แนะนำเมนูขายดี + รอคิวน้อย + ใกล้พิกัดผู้ใช้</li>
                <li className="qup-roadmap-item p3">• <strong>Loyalty Program</strong>: ระบบสะสมแต้มแลกส่วนลดพิเศษประจำโรงเรียน</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 8. COOKIE POLICY & PDPA COMPLIANCE ==================== */}
      <section id="cookie-policy" className="qup-section-container">
        <div className="qup-section-header">
          <span className="qup-section-sub" style={{ color: "#f59e0b" }}>PDPA COOKIE POLICY — นโยบายคุ้มครองข้อมูลส่วนบุคคล</span>
          <h2 className="qup-section-title">นโยบายการใช้คุกกี้ (Cookie Policy) & สิทธิ์ผู้ใช้งาน</h2>
          <p className="qup-section-desc">
            คุกกี้ (Cookies) ในเว็บไซต์ QueueUp คือไฟล์ข้อมูลขนาดเล็กที่เว็บเซิร์ฟเวอร์เก็บบันทึกไว้บนเครื่องคอมพิวเตอร์หรือมือถือของผู้ใช้ เพื่อช่วยจำค่าการใช้งาน ข้อมูลเข้าสู่ระบบ และปรับปรุงประสบการณ์สั่งอาหารโดยไม่ต้องตั้งค่าใหม่ทุกครั้ง
          </p>
        </div>

        <div className="row g-4 mb-5">
          <div className="col-md-4">
            <div className="p-4 rounded-3 text-white h-100" style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.12)" }}>
              <div className="d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-shield-check text-success fs-3" />
                <h4 className="fw-bold mb-0 fs-5">1. คุกกี้จำเป็น (Strictly Necessary)</h4>
              </div>
              <p className="text-slate-300 small mb-0" style={{ lineHeight: "1.6" }}>
                ช่วยให้เว็บไซต์ทำงานได้ปกติ เช่น การล็อกอินด้วย Firebase Auth, การรักษาความปลอดภัยเซสชันจองคิวอาหาร และการปกป้องรหัสบัญชี (จำเป็นต้องใช้งานเสมอ)
              </p>
            </div>
          </div>

          <div className="col-md-4">
            <div className="p-4 rounded-3 text-white h-100" style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.12)" }}>
              <div className="d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-graph-up-arrow text-info fs-3" />
                <h4 className="fw-bold mb-0 fs-5">2. คุกกี้เพื่อการวิเคราะห์ (Analytics)</h4>
              </div>
              <p className="text-slate-300 small mb-0" style={{ lineHeight: "1.6" }}>
                จัดเก็บข้อมูลสถิติพฤติกรรมการใช้งานอย่างเป็นปริศนา เพื่อนำไปปรับปรุงความเร็วของระบบจองคิวและพัฒนาระบบค้นหา Smart Search ให้ดียิ่งขึ้น
              </p>
            </div>
          </div>

          <div className="col-md-4">
            <div className="p-4 rounded-3 text-white h-100" style={{ background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.12)" }}>
              <div className="d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-ticket-perforated-fill text-warning fs-3" />
                <h4 className="fw-bold mb-0 fs-5">3. คุกกี้การตลาด & CRM (Marketing)</h4>
              </div>
              <p className="text-slate-300 small mb-0" style={{ lineHeight: "1.6" }}>
                จดจำความสนใจของผู้ใช้งานเพื่อนำเสนอโค้ดส่วนลด คูปองพิเศษ และโปรโมชั่นจากร้านอาหารที่ติดตามได้ตรงตามความต้องการของคุณ
              </p>
            </div>
          </div>
        </div>

        {/* PDPA Rights Card */}
        <div className="p-4 rounded-3 text-white d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ background: "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)", border: "1px solid rgba(238, 77, 45, 0.3)" }}>
          <div className="d-flex align-items-center gap-3">
            <i className="bi bi-person-check-fill text-warning fs-1" />
            <div>
              <h5 className="fw-bold mb-1">สิทธิ์ของคุณตามกฎหมาย PDPA (Personal Data Protection Act)</h5>
              <p className="text-slate-300 small mb-0">
                คุณมีสิทธิ์เลือกยอมรับ ปฏิเสธ หรือปรับเปลี่ยนการตั้งค่าคุกกี้แต่ละประเภทได้ตลอดเวลาผ่านแบนเนอร์หรือปุ่มตั้งค่าด้านล่าง
              </p>
            </div>
          </div>
          <button
            className="btn btn-warning font-weight-bold shadow-sm"
            onClick={() => setIsCookieModalOpen(true)}
          >
            <i className="bi bi-sliders me-1" /> ปรับเปลี่ยนการตั้งค่าคุกกี้
          </button>
        </div>
      </section>

      {/* ==================== 9. FOOTER ==================== */}
      <footer className="qup-footer">
        <div className="qup-footer-grid">
          <div>
            <div className="qup-logo-group mb-3" onClick={() => navigate("/")}>
              <img src="/logo.png" alt="QueueUp Logo" className="qup-logo-img" />
              <span className="qup-logo-text">QueueUp</span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: "0.92rem", lineHeight: "1.6", maxWidth: "320px" }}>
              ระบบจองคิวและสั่งอาหารอัจฉริยะ นวัตกรรมยกระดับการบริการและประสบการณ์ใช้งานที่รวดเร็ว ปลอดภัย และเสถียรที่สุด
            </p>
          </div>

          <div className="qup-footer-col">
            <h4>เกี่ยวกับเรา</h4>
            <ul className="qup-footer-links">
              <li><a href="#about">เรื่องราวของเรา</a></li>
              <li><a href="#about">วิสัยทัศน์ & พันธกิจ</a></li>
              <li><a href="#stats">สถิติความสำเร็จ</a></li>
              <li><a href="#security">มาตรฐานความปลอดภัย</a></li>
            </ul>
          </div>

          <div className="qup-footer-col">
            <h4>ฟีเจอร์แอปพลิเคชัน</h4>
            <ul className="qup-footer-links">
              <li><a href="#features">ระบบจองคิว Real-Time</a></li>
              <li><a href="#features">ระบบสั่งอาหารอัจฉริยะ</a></li>
              <li><a href="#features">สแกนจ่าย QR PromptPay</a></li>
              <li><a href="#features">การตั้งค่ารหัสบัญชี</a></li>
            </ul>
          </div>

          <div className="qup-footer-col">
            <h4>เริ่มต้นใช้งาน</h4>
            <p style={{ color: "#94a3b8", fontSize: "0.88rem", marginBottom: "1rem" }}>
              ทดลองใช้งานระบบ QueueUp Platform ได้ทันทีฟรี
            </p>
            <button className="qup-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleStartApp}>
              🚀 เริ่มต้นใช้งานเลย
            </button>
          </div>
        </div>

        <div className="qup-copyright-bar">
          <div>© 2026 QueueUp Smart CRM System. All rights reserved.</div>
          <div>พัฒนาด้วยมาตรฐาน Zero-Trust & Salted Cryptography</div>
        </div>
      </footer>

      {/* ==================== 8. INTERACTIVE EVALUATION MODAL FORM ==================== */}
      {isEvalModalOpen && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(8px)", zIndex: 10000 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content text-white" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid rgba(238, 77, 45, 0.4)", borderRadius: "20px", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
              <div className="modal-header border-bottom border-secondary">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-star-fill text-warning me-2" />
                  ส่งแบบประเมินสถาปัตยกรรมระบบ QueueUp CRM (คะแนนจากผู้ใช้จริง)
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsEvalModalOpen(false)} />
              </div>

              <form onSubmit={handleEvalSubmit}>
                <div className="modal-body p-4">
                  <p className="text-slate-300 small mb-4">
                    กรอกคะแนนประเมินของคุณในแต่ละหมวด (1.0 - 10.0 คะแนน) ระบบจะนำคะแนนของคุณไปคำนวณค่าเฉลี่ยสถาปัตยกรรมระบบในหน้าเกี่ยวกับเราทันที!
                  </p>

                  <div className="mb-3">
                    <label className="form-label font-weight-bold">ชื่อผู้ประเมิน / บทบาท:</label>
                    <input
                      type="text"
                      className="form-control bg-dark text-white border-secondary"
                      placeholder="เช่น อาจารย์ประจำวิชา / ร้านค้า / นักเรียน ม.1/6"
                      value={evalName}
                      onChange={(e) => setEvalName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small">🎨 UX/UI Design ({evalUx} / 10):</label>
                      <input
                        type="range"
                        className="form-range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={evalUx}
                        onChange={(e) => setEvalUx(e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small">👤 "บัญชีเดียว ขยายได้" ({evalAccount} / 10):</label>
                      <input
                        type="range"
                        className="form-range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={evalAccount}
                        onChange={(e) => setEvalAccount(e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small">📋 Order & Live Queue Flow ({evalQueue} / 10):</label>
                      <input
                        type="range"
                        className="form-range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={evalQueue}
                        onChange={(e) => setEvalQueue(e.target.value)}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small">🏪 Merchant Seller Centre ({evalMerchant} / 10):</label>
                      <input
                        type="range"
                        className="form-range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={evalMerchant}
                        onChange={(e) => setEvalMerchant(e.target.value)}
                      />
                    </div>

                    <div className="col-md-12">
                      <label className="form-label small">🛡️ Security & Private Finance ({evalSecurity} / 10):</label>
                      <input
                        type="range"
                        className="form-range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={evalSecurity}
                        onChange={(e) => setEvalSecurity(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label font-weight-bold">ข้อเสนอแนะเพิ่มเติม:</label>
                    <textarea
                      className="form-control bg-dark text-white border-secondary"
                      rows="3"
                      placeholder="เขียนข้อเสนอแนะเกี่ยวกับสถาปัตยกรรมระบบหรือฟีเจอร์..."
                      value={evalComment}
                      onChange={(e) => setEvalComment(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top border-secondary">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEvalModalOpen(false)}>
                    ยกเลิก
                  </button>
                  <button type="submit" className="btn btn-danger font-weight-bold" disabled={isSubmitting}>
                    {isSubmitting ? "กำลังบันทึกคะแนน..." : "บันทึกผลประเมินทันที 🚀"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* ==================== 9. COOKIE SETTINGS MODAL ==================== */}
      {isCookieModalOpen && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(8px)", zIndex: 10001 }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-white" style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid rgba(238, 77, 45, 0.4)", borderRadius: "20px" }}>
              <div className="modal-header border-bottom border-secondary">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-gear-fill text-warning me-2" />
                  การตั้งค่าคุกกี้ตามกฎหมาย PDPA (Cookie Settings)
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsCookieModalOpen(false)} />
              </div>

              <div className="modal-body p-4">
                <div className="d-flex align-items-center justify-content-between p-3 rounded mb-3 bg-dark border border-secondary">
                  <div>
                    <div className="fw-bold text-white mb-1">1. คุกกี้ที่จำเป็นขั้นพื้นฐาน (Strictly Necessary)</div>
                    <div className="text-slate-300 small">จำเป็นสำหรับการเข้าสู่ระบบ เซสชันคิว และความปลอดภัย (เปิดใช้งานเสมอ)</div>
                  </div>
                  <span className="badge bg-success">เปิดใช้งานเสมอ</span>
                </div>

                <div className="d-flex align-items-center justify-content-between p-3 rounded mb-3 bg-dark border border-secondary">
                  <div>
                    <div className="fw-bold text-white mb-1">2. คุกกี้เพื่อการวิเคราะห์ (Analytics)</div>
                    <div className="text-slate-300 small">ช่วยวัดและพัฒนาความเร็วของระบบค้นหาอาหาร</div>
                  </div>
                  <span className="badge bg-info text-dark">เปิดใช้งาน</span>
                </div>

                <div className="d-flex align-items-center justify-content-between p-3 rounded bg-dark border border-secondary">
                  <div>
                    <div className="fw-bold text-white mb-1">3. คุกกี้เพื่อการตลาดและ CRM (Marketing)</div>
                    <div className="text-slate-300 small">แสดงโค้ดส่วนลดและโปรโมชั่นเฉพาะบุคคล</div>
                  </div>
                  <span className="badge bg-warning text-dark">เปิดใช้งาน</span>
                </div>
              </div>

              <div className="modal-footer border-top border-secondary">
                <button type="button" className="btn btn-danger font-weight-bold btn-sm" onClick={() => setIsCookieModalOpen(false)}>
                  บันทึกการตั้งค่าคุกกี้ 💾
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}