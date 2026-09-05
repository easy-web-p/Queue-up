import { useNavigate } from "react-router-dom";
import "./About.css";

const scores = [["UX/UI", "9.5"], ["Authentication", "9.0"], ["Database Design", "9.0"], ["Security", "8.5"], ["Merchant CRM", "10"], ["Scalability", "9.5"], ["Production Readiness", "8.5"]];
const priorities = [
  ["Priority 1", "Notification, Favorites & Cart", "แจ้งเตือนอาหารพร้อมรับ โปรโมชั่น และออเดอร์; บันทึกเมนูโปรด; ตะกร้าก่อนชำระเงิน", "bi-bell-fill"],
  ["Priority 2", "Reviews & Merchant KPI", "รีวิว 1–5 ดาว พร้อมยอดขายรายวัน ลูกค้าประจำ Repeat Rate และ Average Order Value", "bi-bar-chart-fill"],
  ["Priority 3", "Smart Recommendation", "เริ่มจาก rule-based: เมนูขายดี + คิวน้อย + ใกล้ผู้ใช้ ก่อนขยายเป็น AI/ML", "bi-stars"],
];

export default function About() {
  const navigate = useNavigate();
  return (
    <main className="about-page min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-8 max-w-5xl mx-auto space-y-12">
      <nav className="about-nav flex items-center justify-between py-4 border-b border-slate-800">
        <button
          className="about-brand flex items-center gap-2 font-black text-xl text-white bg-transparent border-0 cursor-pointer"
          onClick={() => navigate("/queueup")}
        >
          <img src="/logo.png" alt="QueueUp" className="w-8 h-8 object-contain" /> QueueUp
        </button>
        <button
          className="about-back inline-flex items-center gap-2 bg-[#ee4d2d] hover:bg-[#ff7337] text-white px-5 py-2 rounded-full font-bold text-xs shadow-md transition-all cursor-pointer border-0"
          onClick={() => navigate("/home")}
        >
          เข้าสู่ระบบ <i className="bi bi-arrow-right" />
        </button>
      </nav>

      <section className="about-hero text-center space-y-4 py-8">
        <span className="about-kicker text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 inline-block">
          PRODUCT OVERVIEW · QUEUEUP SCHOOL FOOD CRM
        </span>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">มากกว่าเว็บจองคิวโรงอาหาร</h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          QueueUp ผสาน Marketplace, Smart Queue และ CRM เพื่อช่วยให้ผู้ใช้ตัดสินใจเร็วขึ้น และให้ร้านอาหารในสถานศึกษาสร้างฐานลูกค้าประจำได้ในระบบเดียว
        </p>
        <div className="about-score inline-flex items-center gap-3 bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl shadow-xl">
          <span className="text-xs text-slate-400">ความพร้อมของระบบ</span>
          <strong className="text-2xl font-black text-emerald-400">9.2<small className="text-xs text-slate-500">/10</small></strong>
          <em className="text-xs text-slate-500 not-italic border-l border-slate-800 pl-3">Production-ready foundation</em>
        </div>
      </section>

      <section className="about-section space-y-6">
        <div className="about-heading text-center space-y-1">
          <span className="text-xs font-bold text-[#ee4d2d] uppercase tracking-wider">WHY IT WORKS</span>
          <h2 className="text-2xl font-black text-white">ออกแบบจากปัญหาจริง และขยายต่อได้</h2>
        </div>
        <div className="strength-grid grid grid-cols-1 md:grid-cols-3 gap-6">
          <article className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-3 relative hover:border-[#ee4d2d]/50 transition-all">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-[#ee4d2d] flex items-center justify-center text-xl">
              <i className="bi bi-person-vcard-fill" />
            </div>
            <h3 className="text-lg font-bold text-white">บัญชีเดียว ทุกบทบาท</h3>
            <p className="text-xs text-slate-400 leading-relaxed">ผู้ใช้เติบโตจาก Customer เป็น Merchant ได้โดยไม่ต้องสมัครหลายบัญชี ลดความซับซ้อน และรองรับบทบาทในอนาคต</p>
            <b className="text-xs text-amber-400 font-bold block pt-2">9.5/10</b>
          </article>
          <article className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-3 relative hover:border-[#ee4d2d]/50 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
              <i className="bi bi-shield-lock-fill" />
            </div>
            <h3 className="text-lg font-bold text-white">Authentication & Security</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Firebase Auth, Email Verification, Password Strength, PDPA Consent และแยกข้อมูลการเงินของร้านค้าอย่างเป็นสัดส่วน</p>
            <b className="text-xs text-emerald-400 font-bold block pt-2">9.0/10</b>
          </article>
          <article className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-3 relative hover:border-[#ee4d2d]/50 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-xl">
              <i className="bi bi-lightning-charge-fill" />
            </div>
            <h3 className="text-lg font-bold text-white">Order & Smart Queue</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Pre-order, สถานะคิวแบบ real-time, dashboard และ CRM Analytics ตอบโจทย์แกนหลักของระบบโดยตรง</p>
            <b className="text-xs text-sky-400 font-bold block pt-2">10/10</b>
          </article>
        </div>
      </section>

      <section className="about-section about-roadmap space-y-6">
        <div className="about-heading text-center space-y-1">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">NEXT MILESTONES</span>
          <h2 className="text-2xl font-black text-white">Roadmap สู่ Production</h2>
        </div>
        <div className="priority-list grid grid-cols-1 md:grid-cols-3 gap-6">
          {priorities.map(([level, title, detail, icon]) => (
            <article key={level} className="bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl space-y-3">
              <div className="priority-icon w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl">
                <i className={`bi ${icon}`} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wide">{level}</span>
                <h3 className="text-base font-bold text-white mt-1 mb-2">{title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section space-y-6">
        <div className="about-heading text-center space-y-1">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">READINESS</span>
          <h2 className="text-2xl font-black text-white">ประเมินความพร้อม</h2>
        </div>
        <div className="score-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
          {scores.map(([name, score]) => (
            <div key={name} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4">
              <span className="text-xs font-bold text-slate-300 min-w-[140px]">{name}</span>
              <div className="score-track flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <i className="block h-full bg-gradient-to-r from-orange-500 to-emerald-500 rounded-full" style={{ width: `${Number(score) * 10}%` }} />
              </div>
              <b className="text-xs font-black text-white min-w-[48px] text-right">{score}/10</b>
            </div>
          ))}
        </div>
      </section>

      <section className="about-schema bg-slate-900/80 border border-slate-800 p-8 rounded-3xl text-center space-y-4">
        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">RECOMMENDED NEXT STEP</span>
        <h2 className="text-2xl font-black text-white">ออกแบบ Firestore Schema v3 ก่อนเพิ่มฟีเจอร์</h2>
        <p className="text-xs text-slate-400 max-w-2xl mx-auto leading-relaxed">
          กำหนดโครงสร้าง users, merchants, products, orders, payments, notifications, reviews, loyalty และ CRM ให้ชัดเจน เพื่อป้องกันการ refactor ฐานข้อมูลครั้งใหญ่ในอนาคต
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
          {["users", "merchants", "products", "orders", "payments", "notifications", "reviews", "loyalty", "crm"].map((item) => (
            <code key={item} className="bg-slate-800 text-amber-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 font-mono">
              {item}
            </code>
          ))}
        </div>
      </section>
    </main>
  );
}
