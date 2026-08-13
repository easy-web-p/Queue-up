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
  return <main className="about-page">
    <nav className="about-nav"><button className="about-brand" onClick={() => navigate("/queueup")}><img src="/logo.png" alt="QueueUp" /> QueueUp</button><button className="about-back" onClick={() => navigate("/home")}>เข้าสู่ระบบ <i className="bi bi-arrow-right" /></button></nav>
    <section className="about-hero">
      <span className="about-kicker">PRODUCT OVERVIEW · QUEUEUP SCHOOL FOOD CRM</span>
      <h1>มากกว่าเว็บจองคิวโรงอาหาร</h1>
      <p>QueueUp ผสาน Marketplace, Smart Queue และ CRM เพื่อช่วยให้ผู้ใช้ตัดสินใจเร็วขึ้น และให้ร้านอาหารในสถานศึกษาสร้างฐานลูกค้าประจำได้ในระบบเดียว</p>
      <div className="about-score"><span>ความพร้อมของระบบ</span><strong>9.2<small>/10</small></strong><em>Production-ready foundation</em></div>
    </section>
    <section className="about-section"><div className="about-heading"><span>WHY IT WORKS</span><h2>ออกแบบจากปัญหาจริง และขยายต่อได้</h2></div><div className="strength-grid">
      <article><i className="bi bi-person-vcard-fill" /><h3>บัญชีเดียว ทุกบทบาท</h3><p>ผู้ใช้เติบโตจาก Customer เป็น Merchant ได้โดยไม่ต้องสมัครหลายบัญชี ลดความซับซ้อน และรองรับบทบาทในอนาคต</p><b>9.5/10</b></article>
      <article><i className="bi bi-shield-lock-fill" /><h3>Authentication & Security</h3><p>Firebase Auth, Email Verification, Password Strength, PDPA Consent และแยกข้อมูลการเงินของร้านค้าอย่างเป็นสัดส่วน</p><b>9.0/10</b></article>
      <article><i className="bi bi-lightning-charge-fill" /><h3>Order & Smart Queue</h3><p>Pre-order, สถานะคิวแบบ real-time, dashboard และ CRM Analytics ตอบโจทย์แกนหลักของระบบโดยตรง</p><b>10/10</b></article>
    </div></section>
    <section className="about-section about-roadmap"><div className="about-heading"><span>NEXT MILESTONES</span><h2>Roadmap สู่ Production</h2></div><div className="priority-list">{priorities.map(([level, title, detail, icon]) => <article key={level}><div className="priority-icon"><i className={`bi ${icon}`} /></div><div><span>{level}</span><h3>{title}</h3><p>{detail}</p></div></article>)}</div></section>
    <section className="about-section"><div className="about-heading"><span>READINESS</span><h2>ประเมินความพร้อม</h2></div><div className="score-grid">{scores.map(([name, score]) => <div key={name}><span>{name}</span><div className="score-track"><i style={{ width: `${Number(score) * 10}%` }} /></div><b>{score}/10</b></div>)}</div></section>
    <section className="about-schema"><span>RECOMMENDED NEXT STEP</span><h2>ออกแบบ Firestore Schema v3 ก่อนเพิ่มฟีเจอร์</h2><p>กำหนดโครงสร้าง users, merchants, products, orders, payments, notifications, reviews, loyalty และ CRM ให้ชัดเจน เพื่อป้องกันการ refactor ฐานข้อมูลครั้งใหญ่ในอนาคต</p><div>{["users", "merchants", "products", "orders", "payments", "notifications", "reviews", "loyalty", "crm"].map((item) => <code key={item}>{item}</code>)}</div></section>
  </main>;
}
