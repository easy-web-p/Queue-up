import { useState } from "react";

/**
 * VIBE CODING REPORT SECTION (VibeCodingReportSection.jsx)
 * Comprehensive Academic Group Assignment Showcase for Course GE341511 (Weeks 9-10)
 * Group 23 (91) — Vibe Coding: From App Blueprint to Web Application with Canva AI
 */
export default function VibeCodingReportSection() {
  const [activeTab, setActiveTab] = useState("all");
  const [expandedSheet, setExpandedSheet] = useState(null);

  const toggleSheet = (id) => {
    setExpandedSheet((prev) => (prev === id ? null : id));
  };

  const handlePrint = () => {
    window.print();
  };

  const teamMembers = [
    { no: 1, name: "นายพิสิษฐ์ แก้วกุลพิสิษฐ", id: "693380082-8", role: "UX/UI Lead & Frontend Experience", desc: "ออกแบบ Wireframe, ดีไซน์ Layout ทุกหน้าจอตามหลัก Responsive & Fluid Zoom Scaling (Ctrl + / Ctrl -), คุมโทนสี Dark Slate Glassmorphism & Shopee Theme, ออกแบบบัตรคิวดิจิทัล และดูแลประสบการณ์การใช้งาน (UX) ทั้งฝั่งลูกค้าและร้านค้าให้ใช้งานง่ายที่สุด", color: "#FF7A1A", icon: "bi-palette-fill" },
    { no: 2, name: "นายภานุ คำแก้ว", id: "693380586-0", role: "Backend & Firebase Database Lead", desc: "วางโครงสร้าง Cloud Firestore Collections (users, products, orders, shops, categories) เชื่อมต่อ LocalStorage Fallback และตั้งค่าระบบความปลอดภัยแยก 3 สิทธิ์ (Customer, Merchant, Admin)", color: "#38bdf8", icon: "bi-database-fill-gear" },
    { no: 3, name: "นายภูริทัต มหานิล", id: "693380588-6", role: "AI & Core Feature Developer", desc: "พัฒนาระบบค้นหาอัจฉริยะด้วยภาษาธรรมชาติ (NLP Smart Search เช่น 'อยากกินเผ็ดๆ', 'ไม่เกิน 50 บาท'), ระบบคำนวณส่วนลดตามช่วงเวลา (Time-Slot Booking) และระบบตะกร้าสินค้า", color: "#a855f7", icon: "bi-cpu-fill" },
    { no: 4, name: "นายพลกฤต นิลอยู่", id: "693380584-4", role: "KDS & Payment Integration Lead", desc: "พัฒนาหน้าจอครัว Kanban สำหรับร้านค้า (Kitchen Display System), ระบบเสียงแจ้งเตือนออเดอร์เข้า, การสร้าง Dynamic PromptPay QR Code และระบบจำลองตรวจสอบสลิป", color: "#22c55e", icon: "bi-credit-card-2-front-fill" },
    { no: 5, name: "นายภาสกร หนองรั้ง", id: "693380587-8", role: "CRM & Loyalty Program Lead", desc: "จัดการกระเป๋าแต้มสะสม CRM Points (128 แต้ม) และระบบคูปองส่วนลด WELCOME50", color: "#f59e0b", icon: "bi-gift-fill" },
    { no: 6, name: "นายคณิศร เลิศร่วมพัฒนา", id: "693380570-5", role: "QA Tester & Bug Hunter", desc: "ตรวจสอบข้อผิดพลาดของระบบ, จัดการ Netlify SPA Routing (_redirects) และความเสถียรของโค้ด", color: "#ec4899", icon: "bi-bug-fill" },
    { no: 7, name: "นายกฤษณะ อุปถัมภ์", id: "693380289-6", role: "Field Research & User Interviewer", desc: "วางแผนและดำเนินการเก็บข้อมูลทดสอบกับกลุ่มตัวอย่าง 10 คนในโรงอาหาร มข.", color: "#14b8a6", icon: "bi-clipboard2-data-fill" },
    { no: 8, name: "นายพุฒิเมธ เตโช", id: "693380083-6", role: "Documentation & Presentation Coordinator", desc: "เรียบเรียงรายงานทางวิชาการ สรุปผล Canva Blueprint และจัดทำสไลด์นำเสนอ", color: "#6366f1", icon: "bi-file-earmark-slides-fill" }
  ];

  return (
    <section id="vibe-coding-report" className="qup-section-container qup-coursework-section">
      {/* Academic Header Banner */}
      <div className="qup-academic-banner">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div className="qup-badge-pill bg-[#FF7A1A]/20 border border-[#FF7A1A]/40 text-[#FF7A1A]">
            <i className="bi bi-mortarboard-fill me-1" />
            <span>GE341511 การคิดเชิงคำนวณและเชิงสถิติสำหรับ ABCD</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs font-semibold">
              <i className="bi bi-check-circle-fill me-1" /> รายงานฉบับสมบูรณ์ (12 หน้า)
            </span>
            <button
              onClick={handlePrint}
              className="btn btn-sm btn-outline-light d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
              title="พิมพ์หรือบันทึกเป็น PDF"
            >
              <i className="bi bi-printer-fill text-warning" /> พิมพ์ / PDF
            </button>
          </div>
        </div>

        <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-2 leading-tight">
          ใบงานกลุ่ม สัปดาห์ที่ 9 <span className="text-[#FF7A1A]">(กิจกรรมรวมสัปดาห์ 9-10 เดิม)</span>
        </h2>
        <p className="text-slate-300 text-lg font-medium mb-4">
          หัวข้อ: <strong className="text-white">Vibe Coding: จาก App Blueprint สู่เว็บแอปพลิเคชันจริงด้วย Canva AI</strong>
        </p>

        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-white/10 d-flex flex-wrap align-items-center justify-content-between gap-3 text-sm">
          <div>
            <span className="text-slate-400">กลุ่มผู้จัดทำ:</span>{" "}
            <strong className="text-[#FF7A1A] font-bold text-base">กลุ่ม 23 (91)</strong>
          </div>
          <div>
            <span className="text-slate-400">แอปพลิเคชัน:</span>{" "}
            <strong className="text-white">QueueUp — School Food CRM & Smart Pre-Order System</strong>
          </div>
          <div>
            <span className="text-slate-400">เวอร์ชันระบบ:</span>{" "}
            <span className="badge bg-blue-500/20 text-blue-400 border border-blue-500/30">v2.5 (Production Release Candidate)</span>
          </div>
        </div>
      </div>

      {/* Interactive Tabs Bar */}
      <div className="qup-report-tabs-nav">
        {[
          { id: "all", label: "📄 ทั้งหมด (12 หน้า)", icon: "bi-collection-fill" },
          { id: "part1", label: "ส่วนที่ 1: 7 ขั้นตอน Canva Vibe Coding", icon: "bi-1-circle-fill" },
          { id: "part2", label: "ส่วนที่ 2: Bug Log", icon: "bi-2-circle-fill" },
          { id: "part3", label: "ส่วนที่ 3: Feedback & ปรับปรุง", icon: "bi-3-circle-fill" },
          { id: "part4", label: "ส่วนที่ 4: ผลงานต้นแบบ", icon: "bi-4-circle-fill" },
          { id: "part5", label: "ส่วนที่ 5: แผนเก็บข้อมูล มข.", icon: "bi-5-circle-fill" },
          { id: "part6", label: "ส่วนที่ 6: ถอดบทเรียน & สมาชิก", icon: "bi-6-circle-fill" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`qup-report-tab-btn ${activeTab === tab.id ? "active" : ""}`}
          >
            <i className={`bi ${tab.icon} me-1.5`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: ความคืบหน้าการสร้างแอปพลิเคชัน (7 ขั้นตอน Canva Vibe Coding) */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "part1") && (
        <div className="qup-report-block" id="report-part1">
          <div className="qup-report-block-header">
            <div className="d-flex align-items-center gap-2">
              <span className="qup-part-badge">ส่วนที่ 1</span>
              <h3 className="qup-report-block-title">ความคืบหน้าการสร้างแอปพลิเคชัน (ตาม 7 ขั้นตอนคู่มือ Canva Vibe Coding)</h3>
            </div>
            <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              สถานะ: ☑ เสร็จสมบูรณ์ทุกขั้นตอน (Sheet 01 - 07)
            </span>
          </div>

          <div className="qup-sheets-timeline">
            {/* SHEET 01 */}
            <div className="qup-sheet-card">
              <div className="qup-sheet-header" onClick={() => toggleSheet("s1")}>
                <div className="d-flex align-items-center gap-3">
                  <span className="qup-sheet-num">SHEET 01</span>
                  <div>
                    <h4 className="qup-sheet-title">นำเข้า Blueprint + Landing Page</h4>
                    <span className="text-emerald-400 text-xs font-semibold">☑ เสร็จแล้ว</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-slate-700 text-slate-300 text-xs">3 สิทธิ์หลัก</span>
                  <i className={`bi bi-chevron-${expandedSheet === "s1" ? "up" : "down"} text-slate-400`} />
                </div>
              </div>
              <div className={`qup-sheet-body ${expandedSheet === "s1" || activeTab === "part1" || activeTab === "all" ? "show" : ""}`}>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-2 text-sm">
                  <div><strong>ชื่อแอปพลิเคชัน:</strong> <span className="text-[#FF7A1A] font-bold">QueueUp</span></div>
                  <div>
                    <strong>มีหลายสิทธิ์ผู้ใช้หรือไม่:</strong> <span className="text-emerald-400 font-semibold">มี (3 สิทธิ์หลัก)</span> ได้แก่
                  </div>
                  <ol className="list-decimal ps-5 space-y-1.5 text-slate-300 mt-2">
                    <li>
                      <strong className="text-white">Customer (นักเรียน/ครู/ผู้ปกครอง):</strong> ค้นหาเมนู สั่งจองอาหารล่วงหน้า ระบุเวลานัดรับ และสแกนชำระเงิน
                    </li>
                    <li>
                      <strong className="text-white">Merchant (ร้านค้าในโรงอาหาร):</strong> จัดการเมนู รับออเดอร์ และกดเปลี่ยนสถานะคิวทำอาหาร (KDS Kanban)
                    </li>
                    <li>
                      <strong className="text-white">Super Admin (ผู้ดูแลเว็บ):</strong> ดูแลภาพรวมร้านค้า ยอดขาย ความปลอดภัย และสถิติทั้งโรงอาหาร
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* SHEET 02 */}
            <div className="qup-sheet-card">
              <div className="qup-sheet-header" onClick={() => toggleSheet("s2")}>
                <div className="d-flex align-items-center gap-3">
                  <span className="qup-sheet-num">SHEET 02</span>
                  <div>
                    <h4 className="qup-sheet-title">ระบบเก็บข้อมูล (Firebase Database)</h4>
                    <span className="text-emerald-400 text-xs font-semibold">☑ เสร็จแล้ว</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-slate-700 text-slate-300 text-xs">5 Collections หลัก</span>
                  <i className={`bi bi-chevron-${expandedSheet === "s2" ? "up" : "down"} text-slate-400`} />
                </div>
              </div>
              <div className={`qup-sheet-body ${expandedSheet === "s2" || activeTab === "part1" || activeTab === "all" ? "show" : ""}`}>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-2 text-sm">
                  <div>
                    <strong>ชื่อ Firebase Database / Collections หลัก:</strong>{" "}
                    <code className="text-[#FF7A1A] bg-[#FF7A1A]/10 px-2 py-0.5 rounded">QueueUp-School-Canteen-DB</code>{" "}
                    <span className="text-slate-400">(Cloud Firestore: users, products, categories, shops, orders)</span>
                  </div>
                  <div className="font-semibold text-white mt-2">ข้อมูลหลักที่จัดเก็บ:</div>
                  <div className="qup-collections-grid mt-2">
                    <div className="qup-col-item">
                      <div className="qup-col-name text-sky-400"><i className="bi bi-people-fill me-1" /> 1. คอลเลกชัน users (ข้อมูลผู้ใช้งาน & สิทธิ์)</div>
                      <div className="text-slate-300 text-xs leading-relaxed">
                        รหัสผู้ใช้ (uid), ชื่อ-นามสกุล, อีเมลโรงเรียน, เบอร์โทรศัพท์, บทบาทสิทธิ์ (Customer / Merchant / Admin), แต้มสะสม CRM Points, และประวัติคูปองส่วนลด
                      </div>
                    </div>
                    <div className="qup-col-item">
                      <div className="qup-col-name text-amber-400"><i className="bi bi-egg-fried me-1" /> 2. คอลเลกชัน products (ข้อมูลเมนูอาหาร)</div>
                      <div className="text-slate-300 text-xs leading-relaxed">
                        รหัสอาหาร (id), ชื่อเมนู, หมวดหมู่ (category), ราคาปกติ (originalPrice), ราคาส่วนลดตามช่วงเวลา (price), รูปภาพเมนู, ชื่อร้านค้า, และเรตติ้ง
                      </div>
                    </div>
                    <div className="qup-col-item">
                      <div className="qup-col-name text-emerald-400"><i className="bi bi-grid-fill me-1" /> 3. คอลเลกชัน categories (หมวดหมู่อาหาร 18 ชนิด)</div>
                      <div className="text-slate-300 text-xs leading-relaxed">
                        รหัสหมวดหมู่, ชื่อภาษาไทย/อังกฤษ, รูปภาพไอคอนประจำหมวด
                      </div>
                    </div>
                    <div className="qup-col-item">
                      <div className="qup-col-name text-purple-400"><i className="bi bi-shop me-1" /> 4. คอลเลกชัน shops (ข้อมูลร้านค้าโรงอาหาร)</div>
                      <div className="text-slate-300 text-xs leading-relaxed">
                        รหัสร้าน (storeId), ชื่อร้านค้า, พิกัดโรงอาหาร (เช่น โรงอาหาร 1 อาคารเรียน 2), เวลาเปิด-ปิด, และเวลารอคิวเฉลี่ย
                      </div>
                    </div>
                    <div className="qup-col-item col-span-full">
                      <div className="qup-col-name text-rose-400"><i className="bi bi-receipt me-1" /> 5. คอลเลกชัน orders (รายการสั่งจอง & บัตรคิว)</div>
                      <div className="text-slate-300 text-xs leading-relaxed">
                        เลขที่คำสั่งซื้อ, หมายเลขคิว (queueNo), สล็อตเวลานัดรับอาหาร, ยอดเงินรวม, สถานะการปรุง (TO_PAY, TO_SHIP, COMPLETED), และสลิปการชำระเงิน PromptPay QR
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SHEET 03 */}
            <div className="qup-sheet-card">
              <div className="qup-sheet-header" onClick={() => toggleSheet("s3")}>
                <div className="d-flex align-items-center gap-3">
                  <span className="qup-sheet-num">SHEET 03</span>
                  <div>
                    <h4 className="qup-sheet-title">ตรวจสอบข้อมูลจริง</h4>
                    <span className="text-emerald-400 text-xs font-semibold">☑ เสร็จแล้ว</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">☑ ผ่าน ข้อมูลบันทึกถูกต้อง</span>
                  <i className={`bi bi-chevron-${expandedSheet === "s3" ? "up" : "down"} text-slate-400`} />
                </div>
              </div>
              <div className={`qup-sheet-body ${expandedSheet === "s3" || activeTab === "part1" || activeTab === "all" ? "show" : ""}`}>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 d-flex align-items-center gap-3 text-sm">
                  <i className="bi bi-check-circle-fill text-emerald-400 fs-4" />
                  <div>
                    <strong className="text-white">☑ ผ่าน ข้อมูลบันทึกถูกต้อง</strong>
                    <span className="text-slate-400 ms-2">(☐ พบปัญหา - ระบุใน Bug Log ส่วนที่ 2)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SHEET 04 */}
            <div className="qup-sheet-card">
              <div className="qup-sheet-header" onClick={() => toggleSheet("s4")}>
                <div className="d-flex align-items-center gap-3">
                  <span className="qup-sheet-num">SHEET 04</span>
                  <div>
                    <h4 className="qup-sheet-title">ฟีเจอร์หลักที่ทำเสร็จ</h4>
                    <span className="text-emerald-400 text-xs font-semibold">☑ เสร็จแล้ว (9 ระบบฟีเจอร์ย่อย)</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-slate-700 text-slate-300 text-xs">9 Feature Modules</span>
                  <i className={`bi bi-chevron-${expandedSheet === "s4" ? "up" : "down"} text-slate-400`} />
                </div>
              </div>
              <div className={`qup-sheet-body ${expandedSheet === "s4" || activeTab === "part1" || activeTab === "all" ? "show" : ""}`}>
                <div className="space-y-3 text-sm">
                  {/* F1 */}
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                    <h5 className="font-bold text-[#FF7A1A] mb-1.5 flex items-center gap-2">
                      <i className="bi bi-search" /> 1. ระบบค้นหาอัจฉริยะ (AI Smart Search & Filter Engine)
                    </h5>
                    <ul className="list-disc ps-5 space-y-1 text-slate-300 text-xs">
                      <li><strong>Natural Language Query Parser:</strong> คัดกรองด้วยภาษาธรรมชาติ เช่น "อยากกินเผ็ดๆ", "ไม่เกิน 50 บาท"</li>
                      <li><strong>18 Food Categories Carousel:</strong> แคโรเซลหมวดหมู่อาหาร 18 หมวดหมู่อาหาร</li>
                      <li><strong>Multi-Filter & Sorting:</strong> กรองคะแนนรีวิว ราคา ระยะเวลาเสิร์ฟ</li>
                      <li><strong>Search History & Trending Keywords:</strong> บันทึกประวัติและคีย์เวิร์ดยอดนิยม</li>
                    </ul>
                  </div>

                  {/* F2 */}
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                    <h5 className="font-bold text-sky-400 mb-1.5 flex items-center gap-2">
                      <i className="bi bi-compass-fill" /> 2. ระบบหน้าแรก & นำเสนออาหาร (Homepage & Food Discovery)
                    </h5>
                    <ul className="list-disc ps-5 space-y-1 text-slate-300 text-xs">
                      <li><strong>Single Unified News & Update Ticker:</strong> แถบแจ้งเตือนข่าวสารและสิทธิพิเศษสมาชิกใหม่แบบเลื่อนอัตโนมัติ</li>
                      <li><strong>1-Click Welcome Coupon Claim:</strong> ปุ่มกดรับคูปอง WELCOME50 ลด 50 บาท บันทึกลงกระเป๋าและคัดลอกลงคลิปบอร์ดในคลิกเดียว</li>
                      <li><strong>Hero Banner with Pre-Booking CTA:</strong> แบนเนอร์หลักพร้อมปุ่มลัดเข้าสู่ระบบสั่งจองอาหารและแสดงแต้มสะสม CRM Points</li>
                      <li><strong>Top 10 Bestsellers Carousel:</strong> แคโรเซลเลื่อนอัตโนมัติ 10 อันดับเมนูขายดีประจำโรงอาหาร คำนวณจากยอดขายจริง (salesCount)</li>
                      <li><strong>AI Smart Recommendation:</strong> วิเคราะห์และแนะนำร้านที่อร่อยที่สุดและอยู่ใกล้พิกัดอาคารเรียนที่สุด</li>
                      <li><strong>Food Catalog Grid:</strong> ตารางแสดงรายการอาหารทั้งหมดพร้อมปุ่มสลับตัวกรอง (ทั้งหมด, คะแนนสูงสุด, ราคาประหยัด, เสิร์ฟไว)</li>
                    </ul>
                  </div>

                  {/* F3 */}
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                    <h5 className="font-bold text-amber-400 mb-1.5 flex items-center gap-2">
                      <i className="bi bi-clock-history" /> 3. ระบบสั่งจองอาหารล่วงหน้า (Pre-Order & Time-Slot Booking)
                    </h5>
                    <ul className="list-disc ps-5 space-y-1 text-slate-300 text-xs">
                      <li><strong>Time-Slot Dynamic Discount:</strong> เลือกระบุเวลาเข้ารับอาหาร (11:30, 12:00, 12:30, 13:00 น. ฯลฯ) พร้อมส่วนลดพิเศษตามช่วงเวลา (-50%, -20%, -10%)</li>
                      <li><strong>Guest Multiplier & Price Calculator:</strong> เลือกจำนวนคน (1 คน, 2 คน, 3 คน, 4 คนขึ้นไป) ระบบคำนวณราคารวมให้อัตโนมัติแบบเรียลไทม์</li>
                      <li><strong>Interactive Image Gallery:</strong> ดูรูปภาพเมนูอาหารและรูปบรรยากาศร้านค้า พร้อมภาพ Thumbnail ย่อย</li>
                      <li><strong>Shop Meta & Business Hours:</strong> แสดงข้อมูลเวลาเปิด-ปิดร้านค้า, พิกัดเคาน์เตอร์, และเรตติ้งความอร่อย</li>
                    </ul>
                  </div>

                  {/* F4 */}
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                    <h5 className="font-bold text-emerald-400 mb-1.5 flex items-center gap-2">
                      <i className="bi bi-qr-code-scan" /> 4. ระบบชำระเงิน & ตรวจสอบสลิป (Payment & Slip Verification)
                    </h5>
                    <ul className="list-disc ps-5 space-y-1 text-slate-300 text-xs">
                      <li><strong>PromptPay Dynamic QR Code:</strong> สร้าง QR Code สำหรับสแกนจ่ายเงินผ่านแอปธนาคารทุกแห่ง</li>
                      <li><strong>Automatic Slip Upload & OCR Simulation:</strong> อัปโหลดภาพสลิปโอนเงิน พร้อมระบบจำลองตรวจสอบสลิปอัตโนมัติภายใน 1.2 วินาที</li>
                      <li><strong>Countdown Payment Timer:</strong> ตัวนับเวลาถอยหลัง 15:00 นาที ป้องกันการจองค้างในระบบ</li>
                    </ul>
                  </div>

                  {/* F5 */}
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                    <h5 className="font-bold text-purple-400 mb-1.5 flex items-center gap-2">
                      <i className="bi bi-ticket-perforated-fill" /> 5. ระบบติดตามคิวแบบเรียลไทม์ (Live Queue Tracker)
                    </h5>
                    <ul className="list-disc ps-5 space-y-1 text-slate-300 text-xs">
                      <li><strong>Smart Queue Number Generator:</strong> ออกหมายเลขคิวแยกตามร้านค้า (เช่น คิว A05, A06)</li>
                      <li>
                        <strong>Real-time Status Tracking:</strong> แสดงสถานะคิวแบบสด:
                        <span className="text-amber-400 ms-1 font-mono">TO_PAY</span> (รอชำระเงินเพื่อยืนยันคิว) →
                        <span className="text-sky-400 ms-1 font-mono">TO_SHIP</span> (กำลังปรุงคิวอาหาร ระบุเวลาโดยประมาณ เช่น 8-10 นาที) →
                        <span className="text-emerald-400 ms-1 font-mono">COMPLETED</span> (อาหารเสิร์ฟพร้อมรับที่เคาน์เตอร์)
                      </li>
                      <li><strong>Pickup Counter Guidance:</strong> แสดงพิกัดเคาน์เตอร์และโรงอาหารที่ต้องไปรับอาหารอย่างชัดเจน</li>
                    </ul>
                  </div>

                  {/* F6 */}
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                    <h5 className="font-bold text-rose-400 mb-1.5 flex items-center gap-2">
                      <i className="bi bi-kanban-fill" /> 6. ระบบจัดการร้านค้า & หน้าจอครัว (Merchant Dashboard & KDS)
                    </h5>
                    <ul className="list-disc ps-5 space-y-1 text-slate-300 text-xs">
                      <li><strong>Kitchen Display System (KDS Kanban Board):</strong> หน้าจอครัวสำหรับแม่ค้า กดเลื่อนสถานะออเดอร์ (รอทำ → กำลังปรุง → เสร็จแล้ว)</li>
                      <li><strong>Real-time Order Notification & Sound:</strong> เสียงแจ้งเตือนเมื่อมีออเดอร์ใหม่เข้ามา</li>
                      <li><strong>Menu Manager:</strong> ระบบเปิด-ปิดสถานะเมนูอาหาร (พร้อมขาย / เมนูหมด) และแก้ไขราคา</li>
                      <li><strong>Daily Sales Report:</strong> สรุปยอดขายประจำวันและจำนวนคิวที่เสิร์ฟสำเร็จ</li>
                    </ul>
                  </div>

                  {/* F7 */}
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                    <h5 className="font-bold text-indigo-400 mb-1.5 flex items-center gap-2">
                      <i className="bi bi-person-badge-fill" /> 7. ระบบโปรไฟล์ผู้ใช้ & สิทธิประโยชน์ (User Profile & CRM Loyalty)
                    </h5>
                    <ul className="list-disc ps-5 space-y-1 text-slate-300 text-xs">
                      <li><strong>Personal Profile Manager:</strong> จัดการชื่อ-นามสกุล, รหัสนักเรียน (58140), อีเมล (58140@lomsak.ac.th), เบอร์โทร, สังกัดห้องเรียน</li>
                      <li><strong>CRM Loyalty Points Wallet:</strong> ระบบสะสมแต้ม QueueUp CRM Points (128 แต้ม) สำหรับใช้แลกรับส่วนลดมื้อถัดไป</li>
                      <li><strong>Coupon Wallet:</strong> กระเป๋าเก็บคูปองส่วนลด พร้อมแท็บคูปองที่ใช้ได้และคูปองที่ใช้แล้ว</li>
                      <li><strong>Order History:</strong> ดูประวัติการสั่งซื้อย้อนหลัง และปุ่ม 1-Click Quick Re-order สำหรับสั่งซ้ำเมนูเดิมทันที</li>
                    </ul>
                  </div>

                  {/* F8 */}
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                    <h5 className="font-bold text-teal-400 mb-1.5 flex items-center gap-2">
                      <i className="bi bi-shield-lock-fill" /> 8. ระบบความปลอดภัย & สิทธิ์ผู้ใช้งาน (Security & RBAC)
                    </h5>
                    <ul className="list-disc ps-5 space-y-1 text-slate-300 text-xs">
                      <li><strong>Role-Based Access Control (RBAC):</strong> แยกสิทธิ์ชัดเจนระหว่าง Customer, Merchant, และ Super Admin</li>
                      <li><strong>Protected Routes Guard:</strong> ป้องกันการเข้าถึงหน้าที่ต้องล็อกอิน (/home, /product/:id, /merchant/dashboard, /admin)</li>
                      <li><strong>PDPA Cookie Consent Banner & Session Tracker:</strong> แถบขอความยินยอมตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) พร้อมหน้าข้อกำหนดนโยบายความเป็นส่วนตัว (/pdpa, /privacy, /terms)</li>
                      <li><strong>Firestore Security & Local Storage Fallback:</strong> ฐานข้อมูล Cloud Firestore พร้อมระบบสำรองข้อมูลออฟไลน์ ป้องกันข้อมูลสูญหาย</li>
                    </ul>
                  </div>

                  {/* F9 */}
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5">
                    <h5 className="font-bold text-yellow-400 mb-1.5 flex items-center gap-2">
                      <i className="bi bi-sliders" /> 9. ระบบ UX/UI & การเข้าถึง (Preferences & Accessibility)
                    </h5>
                    <ul className="list-disc ps-5 space-y-1 text-slate-300 text-xs">
                      <li><strong>Fluid Responsive & Zoom Scaling:</strong> รองรับการกด Ctrl + และ Ctrl - (ย่อ/ขยายจอ) ขยายเต็มสัดส่วนหน้าจอ และมี Sticky Footer ทุกหน้า</li>
                      <li><strong>Multi-Language Support:</strong> สลับภาษาไทย TH / ภาษาอังกฤษ GB ได้แบบ Real-time</li>
                      <li><strong>Theme Mode Switcher:</strong> สลับโหมดสี สว่าง (Light) / มืด (Dark) / ตามระบบ (Auto)</li>
                      <li><strong>Live Chat Assistant:</strong> ปุ่มลอยและหน้าต่างแชทสอบถามร้านค้าและผู้ช่วย AI แบบ Real-time</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* SHEET 05 */}
            <div className="qup-sheet-card">
              <div className="qup-sheet-header" onClick={() => toggleSheet("s5")}>
                <div className="d-flex align-items-center gap-3">
                  <span className="qup-sheet-num">SHEET 05</span>
                  <div>
                    <h4 className="qup-sheet-title">ดีไซน์ + เลือก Google Font</h4>
                    <span className="text-emerald-400 text-xs font-semibold">☑ เสร็จแล้ว</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-[#FF7A1A]/20 text-[#FF7A1A] border border-[#FF7A1A]/30 text-xs">ชุดที่ 1 (Modern Sans-Serif)</span>
                  <i className={`bi bi-chevron-${expandedSheet === "s5" ? "up" : "down"} text-slate-400`} />
                </div>
              </div>
              <div className={`qup-sheet-body ${expandedSheet === "s5" || activeTab === "part1" || activeTab === "all" ? "show" : ""}`}>
                <div className="p-3.5 rounded-lg bg-slate-900/60 border border-white/5 space-y-3 text-sm">
                  <div>
                    <strong className="text-white">เลือกฟอนต์ชุดที่:</strong>{" "}
                    <span className="text-[#FF7A1A] font-bold">ชุดที่ 1 (Modern Sans-Serif: DM Sans / Plus Jakarta Sans / Prompt)</span>
                  </div>
                  <div className="text-slate-300 font-semibold">เหตุผลที่เลือก:</div>
                  <ol className="list-decimal ps-5 space-y-2 text-xs text-slate-300">
                    <li>
                      <strong className="text-white">ความคมชัดและอ่านง่าย (High Readability):</strong> ฟอนต์ในระบบโค้ดจริงของแอปใช้ "DM Sans" และ "Plus Jakarta Sans" ซึ่งเป็นฟอนต์สไตล์ Geometric Sans-Serif ไร้หัว มีความโปร่งและช่องไฟสม่ำเสมอ ทำให้อ่านชื่อเมนูอาหาร ตัวเลขราคา และหมายเลขบัตรคิว (เช่น คิว A05, A06) ได้ชัดเจนทันทีบนหน้าจอมือถือ
                    </li>
                    <li>
                      <strong className="text-white">ความทันสมัยสไตล์ E-Commerce:</strong> เข้ากับโครงสร้างดีไซน์ Shopee Orange Theme และ Dark Slate UI ของเว็บได้อย่างลงตัว ให้ความรู้สึกเป็นแพลตฟอร์มเทคโนโลยีที่ทันสมัย สะอาดตา และเป็นมิตรกับนักเรียนและคุณครู
                    </li>
                    <li>
                      <strong className="text-white">การประมวลผลรวดเร็ว (Fast Web Font Rendering):</strong> เป็น Web Safe Font ที่โหลดได้เร็วมาก ไม่ทำให้หน้าเว็บกระตุกหรือเกิดปัญหาตัวหนังสือกระโดด (Layout Shift) ขณะกดย่อ/ขยายหน้าจอ (Ctrl + / Ctrl -)
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* SHEET 06 */}
            <div className="qup-sheet-card">
              <div className="qup-sheet-header" onClick={() => toggleSheet("s6")}>
                <div className="d-flex align-items-center gap-3">
                  <span className="qup-sheet-num">SHEET 06</span>
                  <div>
                    <h4 className="qup-sheet-title">ทดสอบ → Feedback → เวอร์ชันใหม่</h4>
                    <span className="text-emerald-400 text-xs font-semibold">☑ เสร็จแล้ว</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-slate-700 text-slate-300 text-xs">4 รอบ (v2.5 Release Candidate)</span>
                  <i className={`bi bi-chevron-${expandedSheet === "s6" ? "up" : "down"} text-slate-400`} />
                </div>
              </div>
              <div className={`qup-sheet-body ${expandedSheet === "s6" || activeTab === "part1" || activeTab === "all" ? "show" : ""}`}>
                <div className="p-3.5 rounded-lg bg-slate-900/60 border border-white/5 space-y-2 text-sm">
                  <div><strong>จำนวนรอบที่ทำ:</strong> <span className="text-emerald-400 font-bold">4 รอบ (Iteration Cycles)</span></div>
                  <div className="qup-cycle-stepper mt-2">
                    <div className="qup-cycle-step">
                      <span className="qup-cycle-dot">1</span>
                      <div>
                        <div className="font-semibold text-white">รอบที่ 1</div>
                        <div className="text-slate-400 text-xs">โครงสร้างหน้าหลักและระบบค้นหา</div>
                      </div>
                    </div>
                    <div className="qup-cycle-step">
                      <span className="qup-cycle-dot">2</span>
                      <div>
                        <div className="font-semibold text-white">รอบที่ 2</div>
                        <div className="text-slate-400 text-xs">ระบบสั่งจองล่วงหน้าและคำนวณส่วนลดตามช่วงเวลา</div>
                      </div>
                    </div>
                    <div className="qup-cycle-step">
                      <span className="qup-cycle-dot">3</span>
                      <div>
                        <div className="font-semibold text-white">รอบที่ 3</div>
                        <div className="text-slate-400 text-xs">ระบบบัตรคิวสดและเชื่อมต่อตะกร้าชำระเงิน PromptPay QR</div>
                      </div>
                    </div>
                    <div className="qup-cycle-step">
                      <span className="qup-cycle-dot bg-emerald-500 text-slate-950">4</span>
                      <div>
                        <div className="font-semibold text-white">รอบที่ 4</div>
                        <div className="text-slate-400 text-xs">ปรับปรุงระบบ Fluid Zoom Responsive และผสาน QueueUp AI ภาษาธรรมชาติ</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/10 text-xs text-slate-300">
                    <strong>เวอร์ชันล่าสุด (v.):</strong> <span className="text-[#FF7A1A] font-bold">v2.5 (Production Release Candidate)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SHEET 07 */}
            <div className="qup-sheet-card">
              <div className="qup-sheet-header" onClick={() => toggleSheet("s7")}>
                <div className="d-flex align-items-center gap-3">
                  <span className="qup-sheet-num">SHEET 07</span>
                  <div>
                    <h4 className="qup-sheet-title">Publish + Export ข้อมูล</h4>
                    <span className="text-emerald-400 text-xs font-semibold">☑ เสร็จแล้ว</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">☑ Export เป็น CSV/Excel แล้ว</span>
                  <i className={`bi bi-chevron-${expandedSheet === "s7" ? "up" : "down"} text-slate-400`} />
                </div>
              </div>
              <div className={`qup-sheet-body ${expandedSheet === "s7" || activeTab === "part1" || activeTab === "all" ? "show" : ""}`}>
                <div className="p-3.5 rounded-lg bg-slate-900/60 border border-white/5 space-y-2 text-sm">
                  <div>
                    <strong>ลิงก์เว็บแอปพลิเคชัน:</strong>{" "}
                    <a
                      href="https://queueup-school.netlify.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF7A1A] font-bold underline hover:text-orange-400"
                    >
                      https://queueup-school.netlify.app
                    </a>{" "}
                    <span className="text-slate-400">(และเวอร์ชันปัจจุบันบน Vercel)</span>
                  </div>
                  <div className="d-flex align-items-center gap-4 text-xs text-slate-300 pt-1">
                    <div><span className="text-emerald-400 font-bold">☑ Export เป็น CSV/Excel แล้ว</span></div>
                    <div><span className="text-slate-500">☐ ยังไม่ได้ export</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: BUG LOG */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "part2") && (
        <div className="qup-report-block" id="report-part2">
          <div className="qup-report-block-header">
            <div className="d-flex align-items-center gap-2">
              <span className="qup-part-badge bg-rose-500/20 text-rose-400 border-rose-500/40">ส่วนที่ 2</span>
              <h3 className="qup-report-block-title">Bug Log (บันทึกปัญหาและการแก้ไข)</h3>
            </div>
            <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              สถานะ: ☑ แก้ไขได้สำเร็จ 100% ทั้ง 2 ปัญหา
            </span>
          </div>

          <div className="space-y-4">
            {/* Bug 1 */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-rose-500/30">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h4 className="font-bold text-rose-400 text-base flex items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill" /> ปัญหาที่ 1: การแสดงผล Responsive และหน้าจอเพี้ยนเมื่อซูมเข้า/ออก
                </h4>
                <span className="badge bg-emerald-500 text-slate-950 font-bold px-2.5 py-1 text-xs rounded-full">
                  ☑ แก้ได้
                </span>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <p>
                  <strong className="text-white">ปัญหาที่พบ:</strong> ปัญหาการแสดงผล Responsive และหน้าจอเพี้ยนเมื่อทำการซูมเข้า/ออก (Ctrl + / Ctrl -) เกิดพื้นที่สีขาวว่างด้านล่าง Footer และรูปภาพในหน้ารายละเอียดเมนู (ProductDetail) ขยายผิดสัดส่วน
                </p>
                <p>
                  <strong className="text-amber-300">สาเหตุที่คาดว่าเกิดขึ้น:</strong> โครงสร้าง CSS Grid และรูปภาพไม่ได้ถูกจำกัดสัดส่วน Aspect Ratio อย่างเหมาะสม ประกอบกับคอนเทนเนอร์หลักขาดการตั้งค่า Fluid Scaling และ Sticky Footer ที่ระดับรากฐานของ HTML/Body
                </p>
                <div className="p-3 rounded-lg bg-slate-950/70 border border-white/10 text-xs">
                  <strong className="text-emerald-400 block mb-1">วิธีแก้ไข (ใช้ Prompt แก้บั๊กใน SHEET 03 หรือวิธีอื่น):</strong>
                  <ol className="list-decimal ps-4 space-y-1 text-slate-300">
                    <li>ปรับแก้โครงสร้าง CSS ในหน้า ProductDetail ให้ตรงกับ JSX Grid (queue-pd-main-grid, queue-pd-wrapper) จัดสัดส่วน 2 คอลัมน์ (รูปภาพ / ข้อมูลการจอง)</li>
                    <li>กำหนด Global Fluid Scaling ด้วย <code>max-width: clamp(1200px, 92vw, 1680px)</code> และจัดโครงสร้าง Flexbox ให้กับ <code>#root</code> พร้อม Sticky Footer ทำให้แสดงผลได้สมบูรณ์ในทุกขนาดหน้าจอและทุกระดับ Zoom</li>
                  </ol>
                </div>
                <div className="d-flex align-items-center gap-3 text-xs pt-1">
                  <span className="text-emerald-400 font-bold">☑ แก้ได้</span>
                  <span className="text-slate-500">☐ แก้ได้บางส่วน</span>
                  <span className="text-slate-500">☐ ยังแก้ไม่ได้</span>
                </div>
              </div>
            </div>

            {/* Bug 2 */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-rose-500/30">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h4 className="font-bold text-rose-400 text-base flex items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill" /> ปัญหาที่ 2: ข้อผิดพลาด 404 Not Found เมื่อรีเฟรชหน้าเว็บ Sub-route
                </h4>
                <span className="badge bg-emerald-500 text-slate-950 font-bold px-2.5 py-1 text-xs rounded-full">
                  ☑ แก้ได้
                </span>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <p>
                  <strong className="text-white">ปัญหาที่พบ:</strong> เกิดข้อผิดพลาด 404 Not Found เมื่อผู้ใช้งานทำการ Refresh (รีโหลดหน้าเว็บ) บน Hosting Netlify ในหน้าที่เป็น Sub-route เช่น <code>/home</code>, <code>/search</code>, <code>/product/:id</code> หรือ <code>/merchant/dashboard</code>
                </p>
                <p>
                  <strong className="text-amber-300">สาเหตุที่คาดว่าเกิดขึ้น:</strong> แพลตฟอร์มพัฒนาด้วย React Router (Single Page Application - SPA) ซึ่งทำงานแบบ Client-side Routing เมื่อผู้ใช้รีเฟรชหน้าเว็บ Hosting พยายามค้นหาไฟล์ HTML ตามโฟลเดอร์จริงบนเซิร์ฟเวอร์ซึ่งไม่มีอยู่
                </p>
                <div className="p-3 rounded-lg bg-slate-950/70 border border-white/10 text-xs">
                  <strong className="text-emerald-400 block mb-1">วิธีแก้ไข (ใช้ Prompt แก้บั๊กใน SHEET 03 หรือวิธีอื่น):</strong>
                  <ol className="list-decimal ps-4 space-y-1 text-slate-300">
                    <li>สร้างไฟล์คอนฟิก <code>public/_redirects</code></li>
                    <li>กำหนดกฎ Rewrites: <code>/* /index.html 200</code></li>
                    <li>เพื่อสั่งให้ Netlify ส่งคำขอทุกเส้นทาง (URL Path) กลับมาประมวลผลที่ <code>index.html</code> ของ React เสมอ</li>
                  </ol>
                </div>
                <div className="d-flex align-items-center gap-3 text-xs pt-1">
                  <span className="text-emerald-400 font-bold">☑ แก้ได้</span>
                  <span className="text-slate-500">☐ แก้ได้บางส่วน</span>
                  <span className="text-slate-500">☐ ยังแก้ไม่ได้</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: FEEDBACK จากเพื่อนกลุ่มอื่น */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "part3") && (
        <div className="qup-report-block" id="report-part3">
          <div className="qup-report-block-header">
            <div className="d-flex align-items-center gap-2">
              <span className="qup-part-badge bg-sky-500/20 text-sky-400 border-sky-500/40">ส่วนที่ 3</span>
              <h3 className="qup-report-block-title">Feedback จากเพื่อนกลุ่มอื่น</h3>
            </div>
          </div>

          <div className="space-y-4">
            {/* Received feedback */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10">
              <h4 className="font-bold text-white mb-2 text-sm flex items-center gap-2">
                <i className="bi bi-chat-left-text-fill text-sky-400" /> 1. หลังจากทดลองใช้งานแอปพลิเคชันของกลุ่มตนเองกับเพื่อนกลุ่มอื่น ๆ ได้รับคำแนะนำดังนี้:
              </h4>
              <ol className="list-decimal ps-5 space-y-2 text-xs text-slate-300">
                <li>
                  <strong className="text-white">ระบบเสียงเตือนเมื่ออาหารเสร็จ:</strong> เพื่อน ๆ แนะนำว่าเมื่อแม่ค้าเปลี่ยนสถานะเป็น "เสร็จแล้ว (COMPLETED)" อยากให้มีเสียงกระดิ่ง (Audio Notification) เตือนนักเรียนโดยตรง เพื่อจะได้ไม่ต้องคอยจ้องหน้าจอมือถือตลอดเวลา
                </li>
                <li>
                  <strong className="text-white">ระบบช่วยเหลือและข้อความด่วนในแชท:</strong> แนะนำให้มีปุ่มข้อความด่วน (Quick Prompts) ในหน้าต่างแชท เช่น "สอบถามสถานะคิว", "ขอไม่ใส่ผัก" เพื่อความรวดเร็วในการพิมพ์
                </li>
                <li>
                  <strong className="text-white">การชำระเงินผ่านช่องทางอื่น (Credit Card / E-Wallet):</strong> มีข้อเสนอแนะให้เพิ่มช่องทางตัดบัตรเครดิตหรือ TrueMoney Wallet
                </li>
                <li>
                  <strong className="text-white">แผนผังโรงอาหารแบบ 3D:</strong> แนะนำให้ทำแผนผังจำลอง 3 มิติเพื่อนำทางไปยังร้านค้าในโรงอาหาร
                </li>
              </ol>
            </div>

            {/* Implemented vs Rejected */}
            <div className="row g-3">
              <div className="col-md-6">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 h-100">
                  <h4 className="font-bold text-emerald-400 mb-2.5 text-sm flex items-center gap-2">
                    <i className="bi bi-check-circle-fill" /> 2. คำแนะนำที่นำไปปรับปรุง
                  </h4>
                  <ul className="list-disc ps-4 space-y-2 text-xs text-slate-300">
                    <li>
                      <strong className="text-white">ปรับปรุงระบบเสียงเตือน Real-time Audio Chime:</strong> เพิ่ม Web Audio API เล่นเสียงกระดิ่งแจ้งเตือนทันทีที่สถานะคิวของลูกค้าเปลี่ยนเป็นพร้อมรับประทาน (COMPLETED) และในหน้าจอครัว KDS เมื่อมีออเดอร์ใหม่เข้ามา
                    </li>
                    <li>
                      <strong className="text-white">เพิ่มระบบ Live Chat Assistant & Quick Prompts:</strong> เพิ่มชุดข้อความด่วนในระบบแชทให้ผู้ใช้สามารถคลิกส่งข้อความสอบถามสถานะและรายละเอียดอาหารกับร้านค้าได้ทันทีใน 1 วินาที
                    </li>
                  </ul>
                </div>
              </div>

              <div className="col-md-6">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 h-100">
                  <h4 className="font-bold text-amber-400 mb-2.5 text-sm flex items-center gap-2">
                    <i className="bi bi-info-circle-fill" /> 3. คำแนะนำที่ไม่ได้นำไปปรับปรุง เพราะเหตุใด
                  </h4>
                  <ul className="list-disc ps-4 space-y-2 text-xs text-slate-300">
                    <li>
                      <strong className="text-white">ระบบชำระเงินผ่านบัตรเครดิต/TrueMoney Wallet:</strong> เนื่องจากกลุ่มเป้าหมายคือนักเรียนและนักศึกษา ซึ่งส่วนใหญ่ใช้งานบัญชีธนาคารและพร้อมเพย์ (PromptPay QR) เป็นหลัก และการเชื่อมต่อ Gateway บัตรเครดิตมีค่าธรรมเนียมธุรกรรมสูง ทำให้เพิ่มต้นทุนแก่ร้านค้าในโรงอาหาร
                    </li>
                    <li>
                      <strong className="text-white">แผนผังโรงอาหารแบบ 3D:</strong> เนื่องจากแผนผัง 3 มิติจะเพิ่มขนาดไฟล์เว็บไซต์และกินทรัพยากรเครื่องสมาร์ตโฟนของนักศึกษา ทำให้โหลดหน้าเว็บช้าลง จึงเลือกใช้การแสดง "ชื่อโรงอาหาร อาคารเรียน และหมายเลขเคาน์เตอร์" แบบ Badge และข้อความที่ชัดเจนแทน
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: ผลงานต้นแบบ */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "part4") && (
        <div className="qup-report-block" id="report-part4">
          <div className="qup-report-block-header">
            <div className="d-flex align-items-center gap-2">
              <span className="qup-part-badge bg-purple-500/20 text-purple-400 border-purple-500/40">ส่วนที่ 4</span>
              <h3 className="qup-report-block-title">ผลงานต้นแบบ (Prototype Showcase)</h3>
            </div>
            <a
              href="https://queueup-school.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary rounded-full px-3 text-xs"
            >
              เปิดระบบทดสอบ <i className="bi bi-box-arrow-up-right ms-1" />
            </a>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-3 text-sm">
            <div className="row g-3">
              <div className="col-md-6">
                <div><strong>ชื่อแอปพลิเคชัน:</strong> <span className="text-[#FF7A1A] font-bold">QueueUp — School Food CRM & Smart Pre-Order System</span></div>
              </div>
              <div className="col-md-6">
                <div><strong>URL เว็บไซต์จริง:</strong> <code className="text-sky-400 font-mono">https://queueup-school.netlify.app</code></div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10">
              <div className="font-semibold text-white mb-2 flex items-center gap-2">
                <i className="bi bi-stars text-warning" /> ฟังก์ชันที่ใช้งานได้จริง (8 ฟังก์ชันหลัก):
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {[
                  "1. ระบบค้นหาอัจฉริยะด้วยภาษาพูดธรรมชาติ (AI NLP Search) และจัดหมวดหมู่อาหาร 18 ชนิด",
                  "2. ระบบสั่งจองอาหารล่วงหน้าระบุเวลา (Time-Slot Booking) พร้อมคำนวณส่วนลดอัตโนมัติ",
                  "3. ระบบชำระเงินด้วย Dynamic PromptPay QR Code และจำลองตรวจสอบสลิปอัตโนมัติ",
                  "4. ระบบออกบัตรคิวดิจิทัล (Live Queue Ticket) และติดตามสถานะแบบเรียลไทม์",
                  "5. หน้าจอครัวสำหรับร้านค้า (Kitchen Display System - KDS Kanban Board)",
                  "6. ระบบกระเป๋าแต้มสะสม CRM Points (128 แต้ม) และคูปองส่วนลด",
                  "7. ระบบความปลอดภัย RBAC สลับสิทธิ์ผู้ใช้งาน (Customer / Merchant / Super Admin)",
                  "8. ระบบ Responsive รองรับการซูมและทุกขนาดหน้าจอ พร้อมระบบขอความยินยอม PDPA",
                ].map((fn, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-800/80 border border-white/5 text-slate-200 d-flex align-items-center gap-2">
                    <i className="bi bi-check2-circle text-emerald-400" />
                    <span>{fn}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: แผนการเก็บข้อมูลจริงกับกลุ่มเป้าหมาย */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "part5") && (
        <div className="qup-report-block" id="report-part5">
          <div className="qup-report-block-header">
            <div className="d-flex align-items-center gap-2">
              <span className="qup-part-badge bg-amber-500/20 text-amber-400 border-amber-500/40">ส่วนที่ 5</span>
              <h3 className="qup-report-block-title">แผนการเก็บข้อมูลจริงกับกลุ่มเป้าหมาย</h3>
            </div>
            <span className="badge bg-slate-700 text-slate-300 text-xs">มหาวิทยาลัยขอนแก่น (มข.)</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-3.5 text-sm">
            <p className="text-slate-400 text-xs italic">
              กลุ่มของท่านมีแผนการเก็บข้อมูลอย่างไร ให้ตอบคำถามต่อไปนี้ (ใช้เป็นแผนดำเนินการหลังเลิกคาบเรียน ก่อนนำไปใช้ประกอบการนำเสนอ/ประกวด)
            </p>

            <div className="p-3 rounded-lg bg-slate-800/70 border border-white/5">
              <strong className="text-white block mb-1">วัตถุประสงค์การเก็บข้อมูล (สอดคล้องกับประเด็นคำถามในแบบสอบถาม):</strong>
              <p className="text-slate-300 text-xs leading-relaxed mb-0">
                เพื่อใช้ข้อมูลในการสื่อสารระหว่างร้านค้ากับลูกค้า, ยืนยันความถูกต้องของระบบการชำระเงินและออกตั๋วคิว, และประเมินพฤติกรรมการค้นหา/สั่งอาหารเพื่อนำไปปรับปรุงผลลัพธ์แนะนำเมนูให้ตรงใจผู้ใช้มากที่สุด
              </p>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <div className="p-3 rounded-lg bg-slate-800/70 border border-white/5 h-100">
                  <div className="text-slate-400 text-xs">ประชากร (กลุ่มเป้าหมายของแอปพลิเคชันของท่าน) คือใคร:</div>
                  <div className="text-white font-bold text-sm mt-0.5">นักศึกษา สาขาปัญญาประดิษฐ์</div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3 rounded-lg bg-slate-800/70 border border-white/5 h-100">
                  <div className="text-slate-400 text-xs">กลุ่มตัวอย่าง คือใคร จำนวนเท่าไหร่:</div>
                  <div className="text-[#FF7A1A] font-bold text-sm mt-0.5">เพื่อนในสาขา 10 คน</div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3 rounded-lg bg-slate-800/70 border border-white/5 h-100">
                  <div className="text-slate-400 text-xs">มีวิธีการคัดเลือก (สุ่ม) กลุ่มตัวอย่างอย่างไร:</div>
                  <div className="text-white font-semibold text-sm mt-0.5">คนที่ต้องการหาร้านอาหารในมหาลัย</div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3 rounded-lg bg-slate-800/70 border border-white/5 h-100">
                  <div className="text-slate-400 text-xs">สถานที่ในการเก็บข้อมูล คือที่ไหนบ้าง:</div>
                  <div className="text-white font-semibold text-sm mt-0.5">ภายในมหาวิทยาลัยขอนแก่น</div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/70 border border-white/5">
              <div className="text-slate-400 text-xs mb-1">วันที่และช่วงเวลาที่จะไปเก็บข้อมูล:</div>
              <div className="text-emerald-400 font-bold text-sm">ช่วงวันที่ 1-6 กันยายน หลังเลิกเรียน</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/70 border border-white/5">
              <div className="text-slate-400 text-xs mb-1">เครื่องมือที่ใช้เก็บข้อมูล (แบบสอบถาม/แบบสัมภาษณ์/แบบสำรวจ/แบบสังเกต) ฝังลงในแอปพลิเคชันเรียบร้อยแล้วหรือไม่:</div>
              <div className="d-flex align-items-center gap-3 text-xs">
                <span className="text-emerald-400 font-bold">☑ เรียบร้อยแล้ว (ผ่านระบบ Scorecard บนหน้าเว็บ)</span>
                <span className="text-slate-500">☐ ยังไม่เรียบร้อย</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/70 border border-white/5">
              <strong className="text-white block mb-1.5">ขั้นตอนการเก็บข้อมูล (เริ่มตั้งแต่เข้าหากลุ่มตัวอย่างจนถึงเก็บข้อมูลเสร็จ):</strong>
              <ol className="list-decimal ps-4 space-y-1 text-xs text-slate-300">
                <li>สอบถามคัดกรองเพื่อนที่กำลังมองหาร้านอาหารในมหาวิทยาลัย</li>
                <li>ให้กลุ่มตัวอย่างทดลองใช้งานเว็บแอปพลิเคชัน QueueUp (ค้นหาเมนู, สั่งจองล่วงหน้า, สแกน QR บัตรคิว)</li>
                <li>สัมภาษณ์และให้กลุ่มตัวอย่างทำแบบประเมินความคิดเห็นหลังทดลองใช้งานผ่านระบบ Scorecard บนหน้าเว็บ</li>
              </ol>
            </div>

            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
              <strong className="text-rose-400 block mb-1.5 flex items-center gap-1.5">
                <i className="bi bi-shield-exclamation" /> แผนการป้องกันความเสี่ยง (ถ้ามี) เช่น เข้าถึงกลุ่มตัวอย่างไม่ได้ตามแผน หรือแอปพลิเคชัน/อินเทอร์เน็ตขัดข้อง:
              </strong>
              <ol className="list-decimal ps-4 space-y-1 text-xs text-slate-300">
                <li>จัดเตรียมกลุ่มตัวอย่างสำรองในคณะ และสามารถปรับลดขนาดกลุ่มตัวอย่างได้ตามความเหมาะสม หากเข้าถึงเป้าหมายไม่ครบตามเวลา</li>
                <li>วางระบบ LocalStorage Fallback สำรองข้อมูลแบบออฟไลน์ ป้องกันปัญหาสัญญาณอินเทอร์เน็ตขัดข้องและป้องกันการบันทึกข้อมูลซ้ำซ้อน</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: สรุปและถอดบทเรียน */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "part6") && (
        <div className="qup-report-block" id="report-part6">
          <div className="qup-report-block-header">
            <div className="d-flex align-items-center gap-2">
              <span className="qup-part-badge bg-indigo-500/20 text-indigo-400 border-indigo-500/40">ส่วนที่ 6</span>
              <h3 className="qup-report-block-title">สรุปและถอดบทเรียน (Lessons Learned & Team Reflection)</h3>
            </div>
            <span className="badge bg-slate-700 text-slate-300 text-xs">8 สมาชิกผู้รับผิดชอบ</span>
          </div>

          <div className="space-y-4">
            {/* Team Members Grid */}
            <div>
              <h4 className="font-bold text-white mb-3 text-sm flex items-center gap-2">
                <i className="bi bi-people-fill text-[#FF7A1A]" /> สมาชิกแต่ละคนรับผิดชอบส่วนใดของงาน (กลุ่ม 23 (91) - 8 คน):
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {teamMembers.map((m) => (
                  <div key={m.no} className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 d-flex flex-column justify-content-between">
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: `${m.color}25`, color: m.color }}>
                          <i className={`bi ${m.icon}`} />
                        </div>
                        <div>
                          <div className="font-bold text-white text-xs leading-tight">{m.name}</div>
                          <div className="text-slate-400 text-[11px] font-mono">รหัส: {m.id}</div>
                        </div>
                      </div>
                      <div className="text-xs font-semibold mb-1" style={{ color: m.color }}>
                        {m.role}
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed mb-0">
                        {m.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reflection Q&A */}
            <div className="space-y-3 pt-2">
              {/* Q1 */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-sky-500/30">
                <h5 className="font-bold text-sky-400 mb-2 text-sm flex items-center gap-2">
                  <i className="bi bi-lightning-charge-fill" /> AI ช่วยให้กลุ่มทำงานได้เร็วขึ้นอย่างไร
                </h5>
                <div className="text-slate-300 text-xs leading-relaxed ps-3 border-s-2 border-sky-500">
                  <p className="mb-0">
                    <strong>คำตอบ:</strong> "AI ช่วยทำงานซ้ำ ๆ และช่วยสรุปข้อมูลในปริมาณเยอะ ๆ ได้เร็วขึ้น โดยช่วยร่างโครงสร้างโค้ดหน้าเว็บ (HTML/CSS/React Components), ช่วยสร้างตรรกะการคัดกรองคำสั่งซื้อด้วยภาษาธรรมชาติ (NLP Query Parser) และช่วยตรวจสอบจุดผิดพลาดของโค้ด (Bug Detection) ได้อย่างรวดเร็ว ทำให้กลุ่มสามารถเปลี่ยนจากภาพร่าง App Blueprint ไปเป็นเว็บแอปพลิเคชันต้นแบบที่ใช้งานได้จริงภายในระยะเวลาอันสั้น"
                  </p>
                </div>
              </div>

              {/* Q2 */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-amber-500/30">
                <h5 className="font-bold text-amber-400 mb-2 text-sm flex items-center gap-2">
                  <i className="bi bi-heart-pulse-fill" /> สิ่งที่ AI ยังทำแทนมนุษย์ไม่ได้คืออะไร
                </h5>
                <div className="text-slate-300 text-xs leading-relaxed ps-3 border-s-2 border-amber-500">
                  <p className="mb-0">
                    <strong>คำตอบ:</strong> "ยังไม่สามารถทำงานที่มีความซับซ้อนทางจิตใจและจริยธรรมแทนมนุษย์ได้ รวมถึง AI ยังขาดความเข้าใจเชิงลึกในความรู้สึกและอารมณ์ของผู้ใช้งานจริง (Human Empathy) เช่น บรรยากาศความเร่งรีบและความเครียดของนักเรียนและแม่ค้าในช่วงพักกลางวัน, การตัดสินใจเชิงจริยธรรมในการคุ้มครองข้อมูลส่วนบุคคล (PDPA) ตลอดจนการลงพื้นที่พูดคุยและสร้างปฏิสัมพันธ์กับกลุ่มตัวอย่างจริงในโรงอาหาร"
                  </p>
                </div>
              </div>

              {/* Q3 */}
              <div className="p-4 rounded-xl bg-slate-900/70 border border-emerald-500/30">
                <h5 className="font-bold text-emerald-400 mb-2 text-sm flex items-center gap-2">
                  <i className="bi bi-award-fill" /> บทเรียนสำคัญที่สุดจากกิจกรรมวันนี้
                </h5>
                <div className="text-slate-300 text-xs leading-relaxed ps-3 border-s-2 border-emerald-500">
                  <p className="mb-0 font-medium italic">
                    <strong>คำตอบ:</strong> "ได้เรียนรู้กระบวนการ Vibe Coding อย่างเป็นขั้นตอน ตั้งแต่การแปลง App Blueprint สู่เว็บแอปพลิเคชันจริงด้วย AI และการเลือกใช้แพลตฟอร์มสร้าง Web Application ที่เหมาะสม โดยตระหนักว่า AI เป็นเครื่องมือที่ช่วยเร่งการเขียนโค้ดและทำงานซ้ำ ๆ ได้รวดเร็ว แต่หัวใจสำคัญยังอยู่ที่การคิดเชิงคำนวณ การวางโครงสร้างฐานข้อมูล และการออกแบบ UX/UI ของมนุษย์ที่เข้าใจปัญหาของผู้ใช้งานจริง"
                  </p>
                </div>
              </div>

              {/* Teacher submission note */}
              <div className="p-3 rounded-lg bg-slate-800/80 border border-white/10 text-center text-xs text-slate-400">
                <i className="bi bi-send-check-fill text-[#FF7A1A] me-1.5" />
                <span>ส่งใบงานนี้ตามช่องทางที่อาจารย์ผู้สอนประจำ Section กำหนด (หน้า 12 / 12)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
