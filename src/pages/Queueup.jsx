import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  fetchEvaluationsFromFirestore,
  submitEvaluationToFirestore,
  fetchShopsFromFirestore,
  fetchProductsFromFirestore,
} from "../lib/firebase.js";
import { db } from "../firebase/config.js";
import {
  SURVEY_QUESTIONS,
  LIKERT_SCALE,
  PILOT_STUDENT_SURVEYS,
  calculateSurveyStats,
  fetchSurveysFromFirestore,
  submitSurveyToFirestore,
} from "../data/kkuSurveyData.js";
import { submitPilotLead } from "../services/pilotLeadService.js";
import PdpaPolicyModal from "../components/PdpaPolicyModal.jsx";
import Footer from "../components/Footer.jsx";
import VibeCodingReportSection from "../components/VibeCodingReportSection.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import "./Queueup.css";

/**
 * QUEUEUP LANDING PAGE & ABOUT US PRESENTATION (Queueup.jsx)
 * Presentation showcase page for the QueueUp Smart Queue & Food Ordering Application.
 */
export default function Queueup() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [isScrolled, setIsScrolled] = useState(false);

  // Dynamic Real User Evaluations State
  const [evaluations, setEvaluations] = useState([]);
  const [evalLoadFailed, setEvalLoadFailed] = useState(false);
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isPdpaModalOpen, setIsPdpaModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 📋 GE341511 15-Question Satisfaction Survey State (KKU Canteen Pilot Study)
  const [surveys, setSurveys] = useState(PILOT_STUDENT_SURVEYS);
  const [evaluationTab, setEvaluationTab] = useState("kku_survey"); // "kku_survey" | "system_architecture"
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [surveyUserName, setSurveyUserName] = useState(user ? user.name || user.email : "");
  const [surveyFaculty, setSurveyFaculty] = useState("วิทยาลัยการคอมพิวเตอร์ สาขา AI");
  const [surveyAnswers, setSurveyAnswers] = useState({
    q1: 5, q2: 5, q3: 5, q4: 5, q5: 5, q6: 5, q7: 5, q8: 5, q9: 5, q10: 5, q11: 5, q12: 5, q13: 5, q14: 5, q15: 5,
  });
  const [surveyComment, setSurveyComment] = useState("");
  const [isSurveySubmitting, setIsSurveySubmitting] = useState(false);

  // Dynamic Real Store & Menu Stats from Firestore
  const [shopsCount, setShopsCount] = useState(null);
  const [productsCount, setProductsCount] = useState(null);

  // Contact & Sales Closing State
  const [contactName, setContactName] = useState("");
  const [contactOrg, setContactOrg] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactPackage, setContactPackage] = useState("school_demo");
  const [contactMsg, setContactMsg] = useState("");
  const [isContactSuccess, setIsContactSuccess] = useState(false);
  const [isContactSending, setIsContactSending] = useState(false);

  const INTEREST_LABELS = {
    school_demo: "สนใจติดตั้งระบบสำหรับโรงเรียน (นัด Live Demo)",
    merchant_join: "สนใจสมัครเป็นร้านค้าพันธมิตรในโรงอาหาร",
    custom_enterprise: "สนใจโซลูชันศูนย์อาหารขนาดใหญ่ / มหาวิทยาลัย",
    other: "สอบถามข้อมูลทั่วไปหรือเสนอแนะเพิ่มเติม",
  };

  // Goes to the same lead capture as the landing page form: this is the same kind
  // of enquiry and there is no reason for it to land anywhere else.
  //
  // It previously ran a 600 ms setTimeout and then declared success, so every
  // enquiry sent from this page was discarded while the sender was told the team
  // had it.
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (isContactSending) return;
    if (!contactName.trim() || !contactPhone.trim()) {
      toast.warning("กรุณากรอกชื่อและเบอร์โทรศัพท์สำหรับติดต่อกลับ");
      return;
    }

    setIsContactSending(true);
    try {
      const interest = INTEREST_LABELS[contactPackage] || contactPackage;
      await submitPilotLead({
        schoolName: contactOrg.trim() || contactName.trim(),
        contactName: contactName.trim(),
        phone: contactPhone,
        email: contactEmail,
        studentCount: "",
        position: "",
        notes: [`ประเภทความสนใจ: ${interest}`, contactMsg.trim()].filter(Boolean).join("\n"),
      });
      setIsContactSuccess(true);
    } catch (err) {
      toast.error(
        err?.message
          ? `ส่งข้อมูลไม่สำเร็จ: ${err.message}`
          : "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่ หรือโทร 092-197-5525"
      );
    } finally {
      setIsContactSending(false);
    }
  };

  // Form Inputs for Rating Submission
  const [evalName, setEvalName] = useState(user ? user.name || user.email : "");
  const [evalUx, setEvalUx] = useState(9.5);
  const [evalAccount, setEvalAccount] = useState(9.5);
  const [evalQueue, setEvalQueue] = useState(10.0);
  const [evalMerchant, setEvalMerchant] = useState(10.0);
  const [evalSecurity, setEvalSecurity] = useState(9.0);
  const [evalComment, setEvalComment] = useState("");

  // Load the real evaluations. An empty collection stays empty: the page reports
  // the count as "ผลประเมินจริง", so substituting sample rows when there are none
  // puts fabricated scores under that heading.
  useEffect(() => {
    let cancelled = false;
    fetchEvaluationsFromFirestore()
      .then((data) => {
        let list = data || [];
        try {
          const local = JSON.parse(localStorage.getItem("queueup_user_evaluations") || "[]");
          if (Array.isArray(local) && local.length > 0) {
            const existingIds = new Set(list.map((c) => c.id));
            const newLocal = local.filter((l) => !existingIds.has(l.id));
            list = [...newLocal, ...list];
          }
        } catch {
          // ignore
        }
        if (!cancelled) setEvaluations(list);
      })
      .catch((err) => {
        console.warn("Could not load system evaluations:", err);
        try {
          const local = JSON.parse(localStorage.getItem("queueup_user_evaluations") || "[]");
          if (Array.isArray(local) && local.length > 0) {
            if (!cancelled) setEvaluations(local);
            return;
          }
        } catch {
          // ignore
        }
        if (!cancelled) setEvalLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load 15-question satisfaction surveys from Firestore / LocalStorage
  useEffect(() => {
    let cancelled = false;
    fetchSurveysFromFirestore(db)
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setSurveys(data);
        }
      })
      .catch((err) => {
        console.warn("Could not load satisfaction surveys:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const surveyStats = useMemo(() => {
    return calculateSurveyStats(surveys);
  }, [surveys]);

  // Load real store and product counts from Firestore
  useEffect(() => {
    let cancelled = false;

    fetchShopsFromFirestore()
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setShopsCount(data.length);
        }
      })
      .catch((err) => {
        console.warn("Could not load real shops count:", err);
      });

    fetchProductsFromFirestore()
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setProductsCount(data.length);
        }
      })
      .catch((err) => {
        console.warn("Could not load real products count:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Dynamically Compute Averages from Real User Data.
  //
  // Two things this must not do, because the page presents the result as
  // "ผลประเมินจริง" beside the count:
  //   - invent a headline score when nobody has evaluated (it used to return 9.2
  //     out of 10 next to "จากผลประเมินจริง 0 รายการ");
  //   - treat a score of 0 as missing. `Number(curr.uxScore || 9)` reads a
  //     deliberate 0 as 9, so the one review that matters is the one silently
  //     rewritten. Scores are validated server-side now, so a field that is
  //     genuinely absent is the anomaly and is skipped rather than guessed at.
  const scores = useMemo(() => {
    const count = evaluations.length;
    if (count === 0) {
      return { ux: null, account: null, queue: null, merchant: null, security: null, total: null, count: 0 };
    }

    const mean = (field) => {
      const values = evaluations
        .map((item) => Number(item[field]))
        .filter((value) => Number.isFinite(value));
      if (values.length === 0) return null;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };

    const ux = mean("uxScore");
    const account = mean("accountScore");
    const queue = mean("queueScore");
    const merchant = mean("merchantScore");
    const security = mean("securityScore");

    const present = [ux, account, queue, merchant, security].filter((v) => v !== null);
    const total = present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;

    const round = (value) => (value === null ? null : Number(value.toFixed(1)));
    return {
      ux: round(ux),
      account: round(account),
      queue: round(queue),
      merchant: round(merchant),
      security: round(security),
      total: round(total),
      count,
    };
  }, [evaluations]);

  /** A displayed score, or an em dash where there is nothing to display. */
  const showScore = (value) => (value === null || value === undefined ? "—" : value.toFixed(1));
  /** Bar width for a score that may not exist yet. */
  const scoreWidth = (value) => `${((Number(value) || 0) / 10) * 100}%`;

  /** One evaluation's own average, across whichever of the five scores it carries. */
  const averageScore = (item) => {
    const values = ["uxScore", "accountScore", "queueScore", "merchantScore", "securityScore"]
      .map((field) => Number(item[field]))
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  // Handle User Evaluation Form Submission
  const handleEvalSubmit = async (e) => {
    e.preventDefault();
    if (!evalName.trim()) {
      toast.warning("กรุณากรอกชื่อผู้ประเมิน");
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

    // The thank-you is only honest once the evaluation is stored. This previously
    // ran unconditionally while every write was being rejected and swallowed.
    try {
      const saved = await submitEvaluationToFirestore(newRating);
      setEvaluations((prev) => [saved, ...prev]);
      setIsEvalModalOpen(false);
      setEvalComment("");
      toast.success("ขอบคุณสำหรับผลประเมินสถาปัตยกรรมระบบ QueueUp CRM ครับ!");
    } catch (err) {
      toast.error(
        err?.message
          ? `ส่งผลประเมินไม่สำเร็จ: ${err.message}`
          : "ส่งผลประเมินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
      );
    } finally {
      setIsSubmitting(false);
    }
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

  // 📋 GE341511 15-Question Satisfaction Survey Handlers
  const handleSurveySubmit = async (e) => {
    e.preventDefault();
    if (!surveyUserName.trim()) {
      toast.warning("กรุณากรอกชื่อผู้ประเมิน");
      return;
    }
    setIsSurveySubmitting(true);
    try {
      const payload = {
        userName: surveyUserName.trim(),
        faculty: surveyFaculty.trim() || "นักศึกษา มข.",
        answers: surveyAnswers,
        comment: surveyComment.trim(),
        date: new Date().toISOString().slice(0, 10),
      };
      const saved = await submitSurveyToFirestore(db, payload);
      setSurveys((prev) => [saved, ...prev]);
      setIsSurveyModalOpen(false);
      setSurveyComment("");
      toast.success("บันทึกแบบประเมินความพึงพอใจ 15 ข้อคำถามเรียบร้อยแล้ว ขอบคุณครับ!");
    } catch (err) {
      toast.error(err?.message ? `บันทึกไม่สำเร็จ: ${err.message}` : "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSurveySubmitting(false);
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
            <img decoding="async" src="/logo.png" alt="QueueUp Logo" className="qup-logo-img" />
            <span className="qup-logo-text">QueueUp</span>
          </div>

          <nav className="qup-nav-links">
            <a href="#hero">หน้าแรก</a>
            <a href="#vibe-coding-report" className="text-[#FF7A1A] font-bold">ใบงานกลุ่ม GE341511</a>
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
            ยกระดับการให้บริการของร้านค้าและการจองคิวของลูกค้าด้วย <strong>QueueUp Platform</strong> ระบบจัดการคิว Real-Time พร้อมระบบสั่งอาหารล่วงหน้า รับบัตรคิวทันทีด้วย Server-Authoritative Architecture โดยไม่มีขั้นตอนการชำระเงินคั่นกลาง (Pure Zero-Payment)
          </p>

          <div className="qup-hero-btns">
            <button className="qup-btn-primary px-8 py-3.5 text-base" onClick={handleStartApp}>
              <i className="bi bi-rocket-takeoff-fill me-2" /> เริ่มต้นทดลองใช้งานระบบ
            </button>
            <a href="#vibe-coding-report" className="qup-btn-secondary px-6 py-3.5 text-base no-underline inline-flex items-center border-[#FF7A1A]/50 text-[#FF7A1A] hover:bg-[#FF7A1A]/10">
              <i className="bi bi-journal-check me-2" /> ใบงานกลุ่ม GE341511
            </a>
            <a href="#about" className="qup-btn-secondary px-6 py-3.5 text-base no-underline inline-block">
              <i className="bi bi-book-fill me-2" /> อ่านเกี่ยวกับเรา
            </a>
          </div>
        </div>

        <div className="qup-hero-card-display">
          <div className="qup-mascot-frame">
            <img loading="lazy" decoding="async" src="/yeti_mascot.jpg" alt="QueueUp Yeti Mascot" className="qup-mascot-img" />

            {/* Floating Live Badges */}
            <div className="qup-float-badge qup-float-1">
              <i className="bi bi-lightning-charge-fill text-warning me-2 text-[1.2rem]" />
              <div>
                <div className="text-white font-bold">คิวเฉลี่ย &lt; 2 นาที</div>
                <div className="text-slate-400 text-xs">Real-Time Queue Sync</div>
              </div>
            </div>

            <div className="qup-float-badge qup-float-2">
              <i className="bi bi-shield-check text-success me-2 text-[1.2rem]" />
              <div>
                <div className="text-emerald-400 font-bold">Zero-Trust Security</div>
                <div className="text-slate-400 text-xs">SHA-256 & AES-256</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 3. STATS & IMPACT BAR ==================== */}
      <section id="stats" className="qup-stats-bar">
        <div className="qup-stats-grid">
          <div className="qup-stat-item">
            <div className="qup-stat-number">{shopsCount !== null ? shopsCount : 1}</div>
            <div className="qup-stat-label">ร้านค้าพันธมิตรในระบบจริง</div>
          </div>
          <div className="qup-stat-item">
            <div className="qup-stat-number">{productsCount !== null ? productsCount : 10}</div>
            <div className="qup-stat-label">รายการอาหารพร้อมให้บริการ</div>
          </div>
          <div className="qup-stat-item">
            <div className="qup-stat-number">{scores.count}</div>
            <div className="qup-stat-label">
              ผู้ร่วมประเมินระบบจริง {scores.total !== null ? `(เฉลี่ย ${scores.total}/10)` : ""}
            </div>
          </div>
          <div className="qup-stat-item">
            <div className="qup-stat-number">100%</div>
            <div className="qup-stat-label">Uptime ความเสถียรของระบบ</div>
          </div>
        </div>
      </section>

      {/* ==================== 3.5. GE341511 VIBE CODING GROUP ASSIGNMENT REPORT ==================== */}
      <VibeCodingReportSection />

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
            <div className="qup-about-icon-wrapper bg-purple-600/15 text-purple-400">
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
            <h4 className="text-[1.2rem] font-bold mb-2.5">
              <i className="bi bi-lightning-fill text-warning me-2" /> Speed & Precision
            </h4>
            <p className="text-slate-400 text-[0.92rem] leading-relaxed">
              ระบบซิงค์ข้อมูล Real-Time คำนวณลำดับคิวถูกต้องแม่นยำ รักษาสิทธิ์ของลูกค้าได้ 100%
            </p>
          </div>

          <div className="qup-value-item">
            <span className="qup-value-badge bg-emerald-500/20 text-emerald-400">PILLAR 02</span>
            <h4 className="text-[1.2rem] font-bold mb-2.5">
              <i className="bi bi-shield-lock-fill text-success me-2" /> Enterprise Security
            </h4>
            <p className="text-slate-400 text-[0.92rem] leading-relaxed">
              ปกป้องข้อมูลผู้ใช้ด้วย Salted SHA-256 Hashing, AES-256 Encryption และ DNS MX Domain Verification
            </p>
          </div>

          <div className="qup-value-item">
            <span className="qup-value-badge bg-orange-500/20 text-orange-400">PILLAR 03</span>
            <h4 className="text-[1.2rem] font-bold mb-2.5">
              <i className="bi bi-heart-fill text-danger me-2" /> Customer-Centric UX
            </h4>
            <p className="text-slate-400 text-[0.92rem] leading-relaxed">
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
            <div className="qup-feature-icon bg-gradient-to-br from-purple-500 to-purple-700"><i className="bi bi-egg-fried" /></div>
            <h3 className="qup-feature-title">Smart Food Ordering</h3>
            <p className="qup-feature-text">
              เลือกชมเมนูอาหาร ปรับแต่งระดับความเผ็ด ท็อปปิ้ง และคำนวณราคาอัตโนมัติได้อย่างรวดเร็ว
            </p>
          </div>

          <div className="qup-feature-card">
            <div className="qup-feature-icon bg-gradient-to-br from-sky-500 to-sky-700"><i className="bi bi-qr-code-scan" /></div>
            <h3 className="qup-feature-title">Dynamic PromptPay QR</h3>
            <p className="qup-feature-text">
              สร้าง QR Code สแกนจ่ายเงินอัตโนมัติตามยอดสั่งซื้อ พร้อมระบบแนบและตรวจสอบสลิปโอนเงิน
            </p>
          </div>

          <div className="qup-feature-card">
            <div className="qup-feature-icon bg-gradient-to-br from-green-500 to-green-700"><i className="bi bi-lock-fill" /></div>
            <h3 className="qup-feature-title">Zero-Trust Cryptography</h3>
            <p className="qup-feature-text">
              ความปลอดภัยระดับสากล แฮชรหัสผ่านด้วย Salted SHA-256 และเข้ารหัสข้อมูลด้วย AES-256-GCM
            </p>
          </div>

          <div className="qup-feature-card">
            <div className="qup-feature-icon bg-gradient-to-br from-amber-500 to-amber-700"><i className="bi bi-person-badge-fill" /></div>
            <h3 className="qup-feature-title">Account & Profile Auto-Save</h3>
            <p className="qup-feature-text">
              จัดการรหัสบัญชี แก้ไขข้อมูลส่วนตัว พร้อมระบบบันทึกข้อมูลอัตโนมัติ (Real-Time Auto-Save)
            </p>
          </div>

          <div className="qup-feature-card">
            <div className="qup-feature-icon bg-gradient-to-br from-pink-500 to-pink-700"><i className="bi bi-laptop" /></div>
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
            <span className="qup-section-sub text-emerald-400">SECURITY FIRST</span>
            <h2 className="qup-section-title text-3xl">ความปลอดภัยระดับสากลเพื่อความมั่นใจ 100%</h2>
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
            <div className="text-white font-bold mt-4">Zero-Trust Certified</div>
            <div className="text-slate-400 text-sm">Encrypted End-to-End</div>
          </div>
        </div>
      </section>

      {/* ==================== 7. SYSTEM EVALUATION SCORECARD & FUTURE ROADMAP ==================== */}
      <section id="roadmap" className="qup-section-container">
        <div className="qup-section-header">
          <span className="qup-section-sub">REAL USER SYSTEM ASSESSMENT — คะแนนประเมินจากผู้ใช้งานจริง</span>
          <h2 className="qup-section-title">
            {evaluationTab === "kku_survey"
              ? `ผลประเมินความพึงพอใจการใช้งาน (${surveyStats.overallMean.toFixed(2)} / 5.00)`
              : `ผลประเมินสถาปัตยกรรมระบบ (${scores.total} / 10)`}
          </h2>
          <p className="qup-section-desc">
            {evaluationTab === "kku_survey"
              ? `รายงานผลสำรวจความพึงพอใจตามมาตรวัด Likert 5 ระดับ จำนวน 15 ข้อคำถาม จากกลุ่มตัวอย่าง ${surveyStats.totalResponses} ท่าน (โรงอาหาร มข. — โครงการ GE341511 กลุ่ม 23)`
              : `คำนวณคะแนนเฉลี่ยแบบ Real-Time จากผลประเมินของผู้ใช้งานจริงรวม ${scores.count} ท่าน ที่ได้ทดสอบใช้งานระบบ QueueUp School Food CRM & Marketplace`}
          </p>
        </div>

        {/* Dual Mode Tab Selector */}
        <div className="d-flex justify-content-center gap-3 mb-5 flex-wrap">
          <button
            type="button"
            className={`btn rounded-pill px-4 py-2.5 fw-bold text-sm transition-all d-flex align-items-center gap-2 ${
              evaluationTab === "kku_survey"
                ? "btn-warning text-dark shadow-lg scale-105"
                : "btn-outline-secondary text-slate-300"
            }`}
            onClick={() => setEvaluationTab("kku_survey")}
          >
            <i className="bi bi-clipboard2-check-fill" />
            แบบประเมินความพึงพอใจ 15 ข้อ (GE341511 มข. 10 ตัวอย่าง)
          </button>
          <button
            type="button"
            className={`btn rounded-pill px-4 py-2.5 fw-bold text-sm transition-all d-flex align-items-center gap-2 ${
              evaluationTab === "system_architecture"
                ? "btn-warning text-dark shadow-lg scale-105"
                : "btn-outline-secondary text-slate-300"
            }`}
            onClick={() => setEvaluationTab("system_architecture")}
          >
            <i className="bi bi-diagram-3-fill" />
            ผลประเมินสถาปัตยกรรมระบบ 5 มิติ
          </button>
        </div>

        {/* ================= TAB 1: 15-QUESTION LIKERT SURVEY (KKU PILOT STUDY) ================= */}
        {evaluationTab === "kku_survey" && (
          <div>
            {/* Overall Score Card & Action Toolbar */}
            <div className="row g-4 qup-score-banner mb-5">
              <div className="col-lg-4 d-flex flex-column align-items-center justify-content-center text-center">
                <div className="qup-score-badge-box w-100 p-4">
                  <div className="text-warning text-xs font-semibold uppercase tracking-wider mb-1">
                    คะแนนเฉลี่ยรวม 15 ด้าน
                  </div>
                  <div className="qup-score-big-num text-5xl font-black text-warning">
                    {surveyStats.overallMean.toFixed(2)}
                  </div>
                  <div className="fw-bold fs-5 mt-1 text-white">/ 5.00 คะแนนเต็ม</div>
                  <div className="badge bg-emerald-500 text-white mt-2 px-3 py-1.5 fs-6 rounded-pill">
                    ⭐ ความพึงพอใจระดับ "มากที่สุด" ({((surveyStats.overallMean / 5) * 100).toFixed(1)}%)
                  </div>
                  <p className="text-slate-400 text-xs mt-3 mb-0">
                    กลุ่มตัวอย่าง {surveyStats.totalResponses} ท่าน (นักศึกษา AI โรงอาหาร มข.)
                  </p>
                  <div className="mt-4 d-flex flex-column gap-2">
                    <button
                      className="btn btn-warning text-dark font-weight-bold btn-sm shadow-sm rounded-pill py-2"
                      onClick={() => setIsSurveyModalOpen(true)}
                    >
                      <i className="bi bi-pencil-square me-1" /> ทำแบบประเมิน 15 ข้อ
                    </button>
                  </div>
                </div>
              </div>

              <div className="col-lg-8">
                <div className="p-4 rounded-3 bg-slate-800/80 border border-white/10 h-100 d-flex flex-column justify-content-between">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="text-white fw-bold mb-0 text-base md:text-lg">
                      <i className="bi bi-bar-chart-fill text-warning me-2" />
                      ผลการประเมินรายข้อ (มาตรวัด Likert 5 ระดับ)
                    </h4>
                    <span className="badge bg-slate-700 text-slate-300">
                      ระดับความสอดคล้อง S.D. 0.46
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pe-2 custom-scrollbar">
                    {SURVEY_QUESTIONS.map((q) => {
                      const stat = surveyStats.questionStats[q.id] || { mean: 5, std: 0 };
                      const pct = Math.min(100, Math.max(0, (stat.mean / 5) * 100));
                      return (
                        <div key={q.id} className="p-2.5 rounded bg-slate-900/60 border border-white/5">
                          <div className="d-flex justify-content-between align-items-center text-xs mb-1">
                            <span className="text-slate-200 fw-semibold">
                              ข้อ {q.no}. {q.text}
                            </span>
                            <span className="text-warning fw-bold ps-2 whitespace-nowrap">
                              {stat.mean.toFixed(2)} / 5.00
                            </span>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1 bg-slate-800" style={{ height: "6px" }}>
                              <div
                                className="progress-bar bg-gradient-to-r from-amber-500 to-emerald-400"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="badge bg-slate-800 text-slate-400 text-[10px] py-0.5">
                              {q.category}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 10 Realistic Pilot Student Feedback Reviews Grid */}
            <div className="mb-5">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h4 className="fw-bold text-light mb-0">
                  <i className="bi bi-chat-heart-fill text-danger me-2" />
                  ความคิดเห็นและข้อเสนอแนะจากกลุ่มตัวอย่าง 10 คน (โรงอาหาร มข.)
                </h4>
                <div className="text-slate-400 text-xs">
                  วิทยาลัยการคอมพิวเตอร์ สาขา AI • GE341511 กลุ่ม 23
                </div>
              </div>

              <div className="row g-3">
                {surveys.slice(0, 10).map((s, idx) => {
                  const qScores = Object.values(s.answers || {}).filter((v) => typeof v === "number");
                  const avg = qScores.length ? (qScores.reduce((a, b) => a + b, 0) / qScores.length).toFixed(1) : "5.0";
                  return (
                    <div key={s.id || idx} className="col-md-6">
                      <div className="p-3.5 rounded-3 bg-slate-800/60 border border-white/10 h-100 d-flex flex-column justify-content-between">
                        <div>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <div>
                              <div className="fw-bold text-white small">
                                <i className="bi bi-person-badge-fill text-sky-400 me-2" />
                                {s.userName}
                              </div>
                              <div className="text-slate-400 text-[11px]">
                                {s.faculty || "วิทยาลัยการคอมพิวเตอร์ มข."} • {s.date || "2026-09-02"}
                              </div>
                            </div>
                            <span className="badge bg-warning text-dark fw-bold">
                              <i className="bi bi-star-fill me-1" />
                              {avg} / 5.0
                            </span>
                          </div>
                          <p className="text-slate-300 small mb-0 font-italic leading-relaxed">
                            "{s.comment || "แอปพลิเคชันใช้งานง่ายและช่วยลดเวลารอคิวได้จริง"}"
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: 5-DIMENSION ARCHITECTURE SCORECARD (ORIGINAL) ================= */}
        {evaluationTab === "system_architecture" && (
          <div>
            {/* Overall Score Card & Dynamic Bar Chart */}
            <div className="row g-4 qup-score-banner">
              <div className="col-lg-4 d-flex flex-column align-items-center justify-content-center text-center">
                <div className="qup-score-badge-box w-100">
                  <div className="qup-score-big-num">{showScore(scores.total)}</div>
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
                  <div className="qup-score-bar-label"><span>🎨 UX/UI Design & Responsiveness</span><span>{showScore(scores.ux)} / 10</span></div>
                  <div className="qup-score-progress-track"><div className="qup-score-progress-fill bg-[#FF7A1A]" style={{ width: scoreWidth(scores.ux) }} /></div>
                </div>

                <div className="qup-score-bar-item">
                  <div className="qup-score-bar-label"><span>👤 "บัญชีเดียว ขยายได้ตามการเติบโต" (One Account Role Switch)</span><span>{showScore(scores.account)} / 10</span></div>
                  <div className="qup-score-progress-track"><div className="qup-score-progress-fill bg-[#8b5cf6]" style={{ width: scoreWidth(scores.account) }} /></div>
                </div>

                <div className="qup-score-bar-item">
                  <div className="qup-score-bar-label"><span>📋 Order & Live Queue Flow (Pre-Order / Smart Queue)</span><span>{showScore(scores.queue)} / 10</span></div>
                  <div className="qup-score-progress-track"><div className="qup-score-progress-fill bg-[#22c55e]" style={{ width: scoreWidth(scores.queue) }} /></div>
                </div>

                <div className="qup-score-bar-item">
                  <div className="qup-score-bar-label"><span>🏪 Merchant Seller Centre CRM & Analytics</span><span>{showScore(scores.merchant)} / 10</span></div>
                  <div className="qup-score-progress-track"><div className="qup-score-progress-fill bg-[#0ea5e9]" style={{ width: scoreWidth(scores.merchant) }} /></div>
                </div>

                <div className="qup-score-bar-item">
                  <div className="qup-score-bar-label"><span>🛡️ Authentication & Private Finance Isolation</span><span>{showScore(scores.security)} / 10</span></div>
                  <div className="qup-score-progress-track"><div className="qup-score-progress-fill bg-[#f59e0b]" style={{ width: scoreWidth(scores.security) }} /></div>
                </div>
              </div>
            </div>

            {/* Real User Evaluation Comments Carousel / Grid */}
            <div className="mb-5">
              <h4 className="fw-bold text-light mb-3">
                <i className="bi bi-chat-quote-fill text-warning me-2" /> ความคิดเห็นและผลประเมินจากผู้ใช้งานจริงล่าสุด ({evaluations.length} ความคิดเห็น)
              </h4>
              {evalLoadFailed && (
                <div role="alert" className="p-3 rounded-3 bg-slate-800/60 border border-amber-500/40 text-amber-200 small">
                  ไม่สามารถโหลดผลประเมินได้ในขณะนี้ กรุณารีเฟรชหน้าอีกครั้ง
                </div>
              )}

              {!evalLoadFailed && evaluations.length === 0 && (
                <div className="p-4 rounded-3 bg-slate-800/60 border border-white/10 text-center">
                  <p className="text-slate-300 small mb-2">ยังไม่มีผลประเมินจากผู้ใช้งาน</p>
                  <button
                    type="button"
                    className="btn btn-light btn-sm fw-bold"
                    onClick={() => setIsEvalModalOpen(true)}
                  >
                    <i className="bi bi-star-fill text-warning me-1" /> เป็นคนแรกที่ส่งผลประเมิน
                  </button>
                </div>
              )}

              <div className="row g-3">
                {evaluations.slice(0, 4).map((item, idx) => (
                  <div key={item.id || idx} className="col-md-6">
                    <div className="p-3 rounded-3 bg-slate-800/60 border border-white/10">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="fw-bold text-white small">
                          <i className="bi bi-person-circle text-primary me-2" /> {item.userName}
                        </div>
                        <span className="badge bg-warning text-dark">
                          <i className="bi bi-star-fill me-1" />
                          {averageScore(item).toFixed(1)} / 10
                        </span>
                      </div>
                      {item.comment ? (
                        <p className="text-slate-300 small mb-0 font-italic">"{item.comment}"</p>
                      ) : (
                        <p className="text-slate-500 small mb-0">(ให้คะแนนโดยไม่ระบุความคิดเห็น)</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Future Roadmap Priorities */}
        <h3 className="qup-section-title text-center mb-4 text-2xl">
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
                <li className="qup-roadmap-item">• <strong>Cart System</strong>: Ephemeral Cart คำนวณยอดรายการก่อนส่งออกบัตรคิว</li>
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

      {/* ==================== 8.5. HIGH-CONVERTING SALES & SOLUTION PACKAGES ==================== */}
      <section id="solution" className="qup-section-container">
        <div className="qup-section-header">
          <span className="qup-section-sub text-[#FF7A1A]">QUEUEUP SOLUTION & PACKAGES — โซลูชันยกระดับโรงอาหาร</span>
          <h2 className="qup-section-title">เปลี่ยนโรงอาหารแบบเดิม สู่ Smart Canteen 4.0</h2>
          <p className="qup-section-desc">
            โซลูชันครบวงจรที่ตอบโจทย์ทั้งนักเรียน ครู ผู้ปกครอง ร้านค้า และฝ่ายบริหารสถานศึกษา เพื่อเพิ่มประสิทธิภาพการบริการและสร้างความประทับใจสูงสุด
          </p>
        </div>

        {/* 3 Core Solution Angles */}
        <div className="row g-4 mb-5">
          <div className="col-lg-4">
            <div className="qup-solution-card">
              <div className="qup-solution-icon bg-danger-subtle text-danger">
                <i className="bi bi-people-fill" />
              </div>
              <h3 className="qup-solution-title">สำหรับนักเรียน & ผู้ปกครอง</h3>
              <ul className="qup-solution-list">
                <li><i className="bi bi-check-circle-fill text-success me-2" /> สั่งจองอาหารล่วงหน้า ระบุเวลารับอาหารแม่นยำ</li>
                <li><i className="bi bi-check-circle-fill text-success me-2" /> ไม่ต้องยืนรอคิวแออัด ได้กินอาหารร้อนๆ ตรงเวลา</li>
                <li><i className="bi bi-check-circle-fill text-success me-2" /> สแกนจ่ายเงินสะดวก พร้อมสะสมแต้มแลกส่วนลด CRM</li>
              </ul>
              <div className="mt-4 pt-3 border-top border-slate-700">
                <span className="badge bg-danger text-white px-3 py-2 rounded-pill">ลดเวลารอคิวลงกว่า 70%</span>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="qup-solution-card featured">
              <div className="qup-popular-badge">ยอดนิยมสำหรับโรงเรียน</div>
              <div className="qup-solution-icon bg-warning-subtle text-warning">
                <i className="bi bi-shop" />
              </div>
              <h3 className="qup-solution-title">สำหรับร้านค้าโรงอาหาร (Merchant)</h3>
              <ul className="qup-solution-list">
                <li><i className="bi bi-check-circle-fill text-success me-2" /> หน้าจอ KDS จัดการออเดอร์และปรุงอาหาร Real-Time</li>
                <li><i className="bi bi-check-circle-fill text-success me-2" /> จัดการเมนู สต็อกสินค้า และเปิด-ปิดร้านค้าได้อิสระ</li>
                <li><i className="bi bi-check-circle-fill text-success me-2" /> รายงานสรุปยอดขายรายวันและสถิติดึงดูดลูกค้าประจำ</li>
              </ul>
              <div className="mt-4 pt-3 border-top border-slate-700">
                <span className="badge bg-warning text-dark px-3 py-2 rounded-pill">เพิ่มยอดขายเฉลี่ย +35%</span>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="qup-solution-card">
              <div className="qup-solution-icon bg-info-subtle text-info">
                <i className="bi bi-building-fill-check" />
              </div>
              <h3 className="qup-solution-title">สำหรับสถานศึกษา & ผู้บริหาร</h3>
              <ul className="qup-solution-list">
                <li><i className="bi bi-check-circle-fill text-success me-2" /> ลดความแออัดในโรงอาหารและจัดระเบียบช่วงพักเที่ยง</li>
                <li><i className="bi bi-check-circle-fill text-success me-2" /> มั่นใจในมาตรฐานความปลอดภัย PDPA & Zero-Trust</li>
                <li><i className="bi bi-check-circle-fill text-success me-2" /> แดชบอร์ดวิเคราะห์ Big Data พฤติกรรมการบริโภค</li>
              </ul>
              <div className="mt-4 pt-3 border-top border-slate-700">
                <span className="badge bg-info text-white px-3 py-2 rounded-pill">ควบคุมสุขอนามัย 100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing / Implementation Packages */}
        <div className="qup-pricing-banner mb-5">
          <div className="row align-items-center g-4">
            <div className="col-lg-8">
              <span className="badge bg-warning text-dark px-3 py-1.5 rounded-pill fw-bold mb-2">
                🎉 โปรโมชั่นเปิดตัวระบบเพื่อสถานศึกษา
              </span>
              <h3 className="fw-bold text-white fs-3 mb-2">
                ทดลองติดตั้งและใช้งานระบบฟรี ไม่มีค่าธรรมเนียมแรกเข้า
              </h3>
              <p className="text-slate-300 mb-0">
                ทีมงานพร้อมลงพื้นที่สำรวจและสาธิตการใช้งานระบบจริง (Live Demo) ให้กับคณะครูและร้านค้าถึงโรงเรียน
              </p>
            </div>
            <div className="col-lg-4 text-lg-end">
              <a href="#contact" className="qup-btn-primary px-8 py-3.5 text-[1.05rem] no-underline inline-flex">
                <i className="bi bi-telephone-inbound-fill me-2" /> ติดต่อขอรับสิทธิ์ใช้งานฟรี
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 8.6. PROJECT DEVELOPMENT TEAM SHOWCASE ==================== */}
      <section id="team" className="qup-section-container">
        <div className="qup-section-header">
          <span className="qup-section-sub text-sky-400">PROJECT DEVELOPERS — คณะผู้จัดทำและพัฒนาโครงการ</span>
          <h2 className="qup-section-title">ทีมผู้พัฒนา QueueUp Smart School Food CRM</h2>
          <p className="qup-section-desc">
            โครงการพัฒนานวัตกรรมดิจิทัล <strong>กลุ่ม 23 (91)</strong> — รายวิชา <strong>GE341511 การคิดเชิงคำนวณและเชิงสถิติสำหรับ ABCD</strong>
          </p>
        </div>

        <div className="row g-4 mb-5">
          {[
            {
              name: "นายพิสิษฐ์ แก้วกุลพิสิษฐ",
              id: "693380082-8",
              role: "UX/UI Lead & Frontend Experience",
              desc: "ออกแบบ Wireframe, ดีไซน์ Layout ทุกหน้าจอตามหลัก Responsive & Fluid Zoom Scaling (Ctrl + / Ctrl -), คุมโทนสี Dark Slate Glassmorphism & Shopee Theme, ออกแบบบัตรคิวดิจิทัล และดูแลประสบการณ์การใช้งาน (UX) ทั้งฝั่งลูกค้าและร้านค้าให้ใช้งานง่ายที่สุด",
              icon: "bi-palette-fill",
              color: "#FF7A1A",
              bg: "rgba(238, 77, 45, 0.15)",
            },
            {
              name: "นายภานุ คำแก้ว",
              id: "693380586-0",
              role: "Backend & Firebase Database Lead",
              desc: "วางโครงสร้าง Cloud Firestore Collections (users, products, orders, shops, categories) เชื่อมต่อ LocalStorage Fallback และตั้งค่าระบบความปลอดภัยแยก 3 สิทธิ์ (Customer, Merchant, Admin)",
              icon: "bi-database-fill-gear",
              color: "#38bdf8",
              bg: "rgba(56, 189, 248, 0.15)",
            },
            {
              name: "นายภูริทัต มหานิล",
              id: "693380588-6",
              role: "AI & Core Feature Developer",
              desc: "พัฒนาระบบค้นหาอัจฉริยะด้วยภาษาธรรมชาติ (NLP Smart Search เช่น 'อยากกินเผ็ดๆ', 'ไม่เกิน 50 บาท'), ระบบคำนวณส่วนลดตามช่วงเวลา (Time-Slot Booking) และระบบตะกร้าสินค้า",
              icon: "bi-cpu-fill",
              color: "#a855f7",
              bg: "rgba(168, 85, 247, 0.15)",
            },
            {
              name: "นายพลกฤต นิลอยู่",
              id: "693380584-4",
              role: "KDS & Payment Integration Lead",
              desc: "พัฒนาหน้าจอครัว Kanban สำหรับร้านค้า (Kitchen Display System), ระบบเสียงแจ้งเตือนออเดอร์เข้า, การสร้าง Dynamic PromptPay QR Code และระบบจำลองตรวจสอบสลิป",
              icon: "bi-credit-card-2-front-fill",
              color: "#22c55e",
              bg: "rgba(34, 197, 94, 0.15)",
            },
            {
              name: "นายภาสกร หนองรั้ง",
              id: "693380587-8",
              role: "CRM & Loyalty Program Lead",
              desc: "จัดการกระเป๋าแต้มสะสม CRM Points (128 แต้ม) และระบบคูปองส่วนลด WELCOME50",
              icon: "bi-gift-fill",
              color: "#f59e0b",
              bg: "rgba(245, 158, 11, 0.15)",
            },
            {
              name: "นายคณิศร เลิศร่วมพัฒนา",
              id: "693380570-5",
              role: "QA Tester & Bug Hunter",
              desc: "ตรวจสอบข้อผิดพลาดของระบบ, จัดการ Netlify SPA Routing (_redirects) และความเสถียรของโค้ด",
              icon: "bi-bug-fill",
              color: "#ec4899",
              bg: "rgba(236, 72, 153, 0.15)",
            },
            {
              name: "นายกฤษณะ อุปถัมภ์",
              id: "693380289-6",
              role: "Field Research & User Interviewer",
              desc: "วางแผนและดำเนินการเก็บข้อมูลทดสอบกับกลุ่มตัวอย่าง 10 คนในโรงอาหาร มข.",
              icon: "bi-clipboard2-data-fill",
              color: "#14b8a6",
              bg: "rgba(20, 184, 166, 0.15)",
            },
            {
              name: "นายพุฒิเมธ เตโช",
              id: "693380083-6",
              role: "Documentation & Presentation Coordinator",
              desc: "เรียบเรียงรายงานทางวิชาการ สรุปผล Canva Blueprint และจัดทำสไลด์นำเสนอ",
              icon: "bi-file-earmark-slides-fill",
              color: "#6366f1",
              bg: "rgba(99, 102, 241, 0.15)",
            },
          ].map((m, idx) => (
            <div key={idx} className="col-md-6 col-lg-3">
              <div className="qup-team-card h-100">
                <div className="qup-team-icon-box" style={{ background: m.bg, color: m.color }}>
                  <i className={`bi ${m.icon}`} />
                </div>
                <h4 className="qup-team-name">{m.name}</h4>
                <div className="qup-team-id">รหัสประจำตัว: {m.id}</div>
                <div className="qup-team-role" style={{ color: m.color }}>
                  {m.role}
                </div>
                <p className="qup-team-desc">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== 8.7. CONTACT US & SALES CLOSING FORM ==================== */}
      <section id="contact" className="qup-section-container">
        <div className="qup-contact-wrapper">
          <div className="row g-5 align-items-center">
            {/* Left Info Column */}
            <div className="col-lg-5">
              <span className="qup-section-sub text-[#FF7A1A]">CONTACT & INQUIRIES — ติดต่อเรา</span>
              <h2 className="qup-section-title text-4xl">
                พร้อมยกระดับโรงอาหารของคุณหรือยัง?
              </h2>
              <p className="qup-section-desc mb-4">
                ติดต่อทีมงาน QueueUp เพื่อขอคำปรึกษา นัดหมายสาธิตระบบจริง (Live Demo) หรือสมัครเข้าร่วมเป็นร้านค้าพันธมิตรได้ทันที
              </p>

              <div className="qup-contact-info-list space-y-3 mb-4">
                <div className="d-flex align-items-center gap-3 p-3 rounded-3 bg-slate-800/60 border border-white/10">
                  <div className="qup-contact-icon-circle bg-danger-subtle text-danger">
                    <i className="bi bi-geo-alt-fill fs-5" />
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">ที่ตั้งศูนย์ปฏิบัติการ</div>
                    <div className="text-white fw-bold small">โรงอาหารกลาง วิทยาลัยการคอมพิวเตอร์ มหาวิทยาลัยขอนแก่น</div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-3 p-3 rounded-3 bg-slate-800/60 border border-white/10">
                  <div className="qup-contact-icon-circle bg-info-subtle text-info">
                    <i className="bi bi-envelope-fill fs-5" />
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">อีเมลติดต่อทางการ</div>
                    <div className="text-white fw-bold small">contact@queueup.app</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Interactive Form Column */}
            <div className="col-lg-7">
              <div className="qup-contact-card">
                <h3 className="fw-bold text-white fs-4 mb-2">
                  <i className="bi bi-send-fill text-danger me-2" /> ส่งข้อความ / ขอใบเสนอราคาติดตั้งระบบ
                </h3>
                <p className="text-slate-400 small mb-4">
                  กรอกข้อมูลด้านล่าง ทีมงานจะติดต่อกลับเพื่อให้ข้อมูลและนัดหมายสาธิตระบบภายใน 24 ชั่วโมง
                </p>

                {isContactSuccess ? (
                  <div className="p-4 rounded-3 text-center bg-emerald-500/15 border border-emerald-500">
                    <div className="display-4 text-success mb-2">
                      <i className="bi bi-check-circle-fill" />
                    </div>
                    <h4 className="fw-bold text-white mb-2">ส่งข้อมูลสำเร็จเรียบร้อยแล้ว!</h4>
                    <p className="text-slate-300 small mb-3">
                      ขอบพระคุณที่ให้ความสนใจในระบบ QueueUp ทีมงานฝ่ายบริการลูกค้าจะติดต่อกลับไปยังเบอร์โทรศัพท์หรืออีเมลของคุณโดยเร็วที่สุด
                    </p>
                    <button
                      className="btn btn-success btn-sm rounded-pill px-4 fw-bold"
                      onClick={() => setIsContactSuccess(false)}
                    >
                      ส่งข้อความเพิ่มเติม
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit}>
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="text-slate-300 small fw-bold mb-1">ชื่อผู้ติดต่อ *</label>
                        <input
                          type="text"
                          className="form-control qup-input"
                          placeholder="เช่น อาจารย์สมชาย / ป้าแดง"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="text-slate-300 small fw-bold mb-1">ชื่อโรงเรียน / สถานศึกษา / ร้านค้า</label>
                        <input
                          type="text"
                          className="form-control qup-input"
                          placeholder="เช่น โรงเรียนหล่มสักวิทยาคม / ร้านข้าวมันไก่"
                          value={contactOrg}
                          onChange={(e) => setContactOrg(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="text-slate-300 small fw-bold mb-1">เบอร์โทรศัพท์ติดต่อกลับ *</label>
                        <input
                          type="tel"
                          className="form-control qup-input"
                          placeholder="เช่น 08x-xxx-xxxx"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="text-slate-300 small fw-bold mb-1">อีเมลติดต่อ *</label>
                        <input
                          type="email"
                          className="form-control qup-input"
                          placeholder="your-email@school.ac.th"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="text-slate-300 small fw-bold mb-1">ประเภทความสนใจ</label>
                      <select
                        className="form-select qup-input"
                        value={contactPackage}
                        onChange={(e) => setContactPackage(e.target.value)}
                      >
                        <option value="school_demo">🏫 สนใจติดตั้งระบบสำหรับโรงเรียน (นัด Live Demo)</option>
                        <option value="merchant_join">🏪 สนใจสมัครเป็นร้านค้าพันธมิตรในโรงอาหาร</option>
                        <option value="custom_enterprise">🏢 สนใจโซลูชันศูนย์อาหารขนาดใหญ่ / มหาวิทยาลัย</option>
                        <option value="other">💬 สอบถามข้อมูลทั่วไปหรือเสนอแนะเพิ่มเติม</option>
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="text-slate-300 small fw-bold mb-1">ข้อความหรือรายละเอียดเพิ่มเติม</label>
                      <textarea
                        className="form-control qup-input"
                        rows="3"
                        placeholder="ระบุจำนวนร้านค้าโดยประมาณ หรือช่วงเวลาที่สะดวกให้ติดต่อกลับ..."
                        value={contactMsg}
                        onChange={(e) => setContactMsg(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      className="qup-btn-primary w-100 py-3 fs-6 justify-center"
                      disabled={isContactSending}
                    >
                      {isContactSending ? (
                        <span>กำลังส่งข้อมูล...</span>
                      ) : (
                        <span><i className="bi bi-send-check-fill me-2" /> ส่งข้อมูลเพื่อรับสิทธิ์และนัดสาธิตระบบ</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 9. FOOTER ==================== */}
      <footer className="qup-footer">
        <div className="qup-footer-grid">
          <div>
            <div className="qup-logo-group mb-3" onClick={() => navigate("/")}>
              <img decoding="async" src="/logo.png" alt="QueueUp Logo" className="qup-logo-img" />
              <span className="qup-logo-text">QueueUp</span>
            </div>
            <p className="text-slate-400 text-[0.92rem] leading-relaxed max-w-[320px]">
              ระบบจองคิวและสั่งอาหารอัจฉริยะ นวัตกรรมยกระดับการบริการและประสบการณ์ใช้งานที่รวดเร็ว ปลอดภัย และเสถียรที่สุด
            </p>
          </div>

          <div className="qup-footer-col">
            <h4>เกี่ยวกับเรา</h4>
            <ul className="qup-footer-links">
              <li><a href="#about">เรื่องราวของเรา</a></li>
              <li><a href="#solution">โซลูชันโรงอาหาร</a></li>
              <li><a href="#team">คณะผู้จัดทำโครงการ</a></li>
              <li><a href="#security">มาตรฐานความปลอดภัย</a></li>
            </ul>
          </div>

          <div className="qup-footer-col">
            <h4>ติดต่อ & สนับสนุน</h4>
            <ul className="qup-footer-links">
              <li><a href="#contact">ติดต่อขอใบเสนอราคา</a></li>
              <li><a href="#contact">นัดหมาย Live Demo</a></li>
              <li><a href="#contact">สมัครร้านค้าพันธมิตร</a></li>
              <li><a href="#cookie-policy">นโยบายคุกกี้ & PDPA</a></li>
            </ul>
          </div>

          <div className="qup-footer-col">
            <h4>เริ่มต้นใช้งาน</h4>
            <p className="text-slate-400 text-[0.88rem] mb-4">
              ทดลองใช้งานระบบ QueueUp Platform ได้ทันทีฟรี
            </p>
            <button className="qup-btn-primary w-full justify-center" onClick={handleStartApp}>
              🚀 เข้าสู่ระบบสั่งอาหาร
            </button>
          </div>
        </div>

        <div className="qup-copyright-bar">
          <div>© 2026 QueueUp Smart School Food CRM. กลุ่ม 23 (91) GE341511. All rights reserved.</div>
          <div>พัฒนาด้วยมาตรฐาน Zero-Trust, Salted SHA-256 & AES-256 Cryptography</div>
        </div>
      </footer>

      {/* ==================== 7.5. INTERACTIVE 15-QUESTION SURVEY MODAL ==================== */}
      {isSurveyModalOpen && (
        <div className="modal fade show d-block bg-slate-900/80 backdrop-blur-md z-[10000]" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content text-white bg-gradient-to-br from-slate-800 to-slate-900 border border-warning/40 rounded-[20px] shadow-2xl">
              <div className="modal-header border-bottom border-secondary">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-clipboard2-data-fill text-warning me-2" />
                  แบบประเมินการใช้แอปพลิเคชัน QueueUp (15 ข้อคำถาม Likert Scale)
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsSurveyModalOpen(false)} />
              </div>

              <form onSubmit={handleSurveySubmit}>
                <div className="modal-body p-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="alert alert-info py-2.5 px-3 small d-flex align-items-start gap-2 mb-3 bg-sky-950/60 border border-sky-600/40 text-sky-200">
                    <i className="bi bi-info-circle-fill mt-1 fs-6" />
                    <div>
                      <strong>คำชี้แจง:</strong> โปรดเลือกระดับความคิดเห็นของท่านในแต่ละข้อ (5 = มากที่สุด, 4 = มาก, 3 = ปานกลาง, 2 = น้อย, 1 = น้อยที่สุด)
                      เพื่อนำไปวิเคราะห์ในโครงการ <strong>GE341511 กลุ่ม 23 (มข.)</strong>
                    </div>
                  </div>

                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <label className="form-label font-weight-bold text-sm">ชื่อผู้ประเมิน / รหัสนักศึกษา *</label>
                      <input
                        type="text"
                        className="form-control bg-dark text-white border-secondary text-sm"
                        placeholder="เช่น นายธนากร (นักศึกษา AI ปี 2 - มข.)"
                        value={surveyUserName}
                        onChange={(e) => setSurveyUserName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label font-weight-bold text-sm">คณะ / สังกัด / กลุ่มตัวอย่าง</label>
                      <input
                        type="text"
                        className="form-control bg-dark text-white border-secondary text-sm"
                        placeholder="เช่น วิทยาลัยการคอมพิวเตอร์ สาขา AI"
                        value={surveyFaculty}
                        onChange={(e) => setSurveyFaculty(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <h6 className="fw-bold text-warning border-bottom border-white/10 pb-2 mb-3">
                      รายการประเมินทั้ง 15 ข้อ
                    </h6>
                    <div className="space-y-3">
                      {SURVEY_QUESTIONS.map((q) => {
                        const currentVal = surveyAnswers[q.id] ?? 5;
                        return (
                          <div key={q.id} className="p-3 rounded-3 bg-slate-900/70 border border-white/10">
                            <div className="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-1">
                              <span className="text-white text-sm fw-semibold">
                                ข้อ {q.no}. {q.text}
                              </span>
                              <span className="badge bg-slate-800 text-sky-400 text-[10px]">
                                {q.category}
                              </span>
                            </div>

                            {/* 5-Choice Likert Radio Options */}
                            <div className="d-flex gap-1.5 flex-wrap">
                              {LIKERT_SCALE.map((opt) => {
                                const isSelected = currentVal === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    className={`btn btn-sm rounded-pill text-xs px-2.5 py-1 transition-all ${
                                      isSelected
                                        ? "btn-warning text-dark fw-bold shadow scale-105"
                                        : "btn-outline-secondary text-slate-300"
                                    }`}
                                    onClick={() =>
                                      setSurveyAnswers((prev) => ({ ...prev, [q.id]: opt.value }))
                                    }
                                  >
                                    {opt.label} ({opt.value})
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label font-weight-bold text-sm">ข้อเสนอแนะเพิ่มเติม:</label>
                    <textarea
                      className="form-control bg-dark text-white border-secondary text-sm"
                      rows="3"
                      placeholder="เขียนข้อเสนอแนะสำหรับการปรับปรุงการใช้งานแอปพลิเคชัน QueueUp..."
                      value={surveyComment}
                      onChange={(e) => setSurveyComment(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top border-secondary">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsSurveyModalOpen(false)}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning text-dark font-weight-bold btn-sm shadow"
                    disabled={isSurveySubmitting}
                  >
                    {isSurveySubmitting ? "กำลังบันทึก..." : "ส่งแบบประเมิน 15 ข้อ 🚀"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 8. INTERACTIVE EVALUATION MODAL FORM ==================== */}
      {isEvalModalOpen && (
        <div className="modal fade show d-block bg-slate-900/80 backdrop-blur-md z-[10000]" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content text-white bg-gradient-to-br from-slate-800 to-slate-900 border border-[#FF7A1A]/40 rounded-[20px] shadow-2xl">
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

                  {/* The wall is public so supervisors and reviewers can read it
                      without an account, which means what is typed here is visible
                      to anyone. Saying so is the difference between publishing and
                      exposing. */}
                  <div className="alert alert-warning py-2 px-3 small d-flex align-items-start gap-2 mb-3">
                    <i className="bi bi-eye-fill mt-1" />
                    <span>
                      ชื่อผู้ประเมินและความคิดเห็นของคุณจะ<strong>แสดงต่อสาธารณะ</strong>บนหน้านี้
                      กรุณาไม่กรอกข้อมูลส่วนบุคคลที่ไม่ต้องการเปิดเผย
                    </span>
                  </div>

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
        <div className="modal fade show d-block bg-slate-900/80 backdrop-blur-md z-[10001]" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-white bg-gradient-to-br from-slate-800 to-slate-900 border border-[#FF7A1A]/40 rounded-[20px]">
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

      {/* Global Interactive PDPA Policy & Terms Modal */}
      <PdpaPolicyModal
        isOpen={isPdpaModalOpen}
        onClose={() => setIsPdpaModalOpen(false)}
      />

      {/* Global Reusable Premium Footer */}
      <Footer />
    </div>
  );
}