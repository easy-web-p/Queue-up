# 🍜 QueueUp — School Food CRM & Smart Pre-Order System

> **QueueUp** เป็นเว็บแอปพลิเคชันบริหารจัดการสั่งอาหารล่วงหน้า จองคิว และระบบสะสมแต้ม CRM สำหรับโรงอาหารโรงเรียน/มหาวิทยาลัย ช่วยลดเวลาในการเข้าคิว เพิ่มยอดขายให้ร้านค้า และยกระดับประสบการณ์สั่งอาหารของผู้ใช้

🌐 **Official Live URL:** [https://queueup-school.netlify.app](https://queueup-school.netlify.app)  
📦 **GitHub Repository:** [https://github.com/easy-web-p/Queue-up.git](https://github.com/easy-web-p/Queue-up.git)  
👥 **ผู้พัฒนา:** กลุ่ม 23 (91) — รายวิชา GE341511 มหาวิทยาลัยขอนแก่น

---

## 🌟 ฟีเจอร์หลักของระบบ (9 Core Features)

1. 🔍 **ระบบค้นหาอัจฉริยะ (AI NLP Search & Filter)**: ค้นหาอาหารด้วยภาษาพูดธรรมชาติ ("อยากกินเผ็ด", "งบ 50 บาท", "เมนูทำเร็ว") พร้อมตัวกรอง 18 หมวดหมู่อาหารและพิกัดอาคาร
2. 🏠 **ระบบหน้าแรก & ค้นพบอาหาร (Homepage & Food Discovery)**: Ticker ข่าวสาร, 1-Click รับคูปอง `WELCOME50`, แคโรเซล 10 อันดับเมนูขายดี, และระบบ AI แนะนำร้านค้า
3. 🍱 **ระบบสั่งจองอาหารล่วงหน้า (Pre-Order & Time-Slot Booking)**: เลือกระบุเวลานัดรับอาหารล่วงหน้า พร้อมรับส่วนลดพิเศษตามช่วงเวลา (-50%, -20%, -10%) และคำนวณราคาตามจำนวนคนอัตโนมัติ
4. 💳 **ระบบชำระเงินและตรวจสอบสลิป (PromptPay QR & Slip Verification)**: สร้าง QR Code พร้อมเพย์ตามยอดจริง พร้อมระบบจำลองสแกนตรวจสอบสลิปอัตโนมัติใน 1.2 วินาที และตัวนับเวลาถอยหลัง 15 นาที
5. 🎟️ **ระบบติดตามคิวเรียลไทม์ (Live Queue Tracker)**: ออกรหัสคิวเฉพาะร้านค้า (เช่น คิว A05) ติดตามสถานะ 3 ระดับ (`TO_PAY`, `TO_SHIP`, `COMPLETED`) พร้อมเสียงแจ้งเตือน
6. 🏪 **ระบบจัดการร้านค้า & หน้าจอครัว (Merchant Dashboard & KDS)**: หน้าจอครัว Kanban Board แบบสัมผัส 1-Tap Bump ปรับสถานะออเดอร์, จัดการสต็อกเปิด/ปิดเมนูหมด และดูสรุปยอดขายรายวัน
7. 👤 **ระบบโปรไฟล์ & สิทธิประโยชน์ (User Profile & CRM Loyalty)**: กระเป๋าแต้มสะสม CRM Points (128 แต้ม), กระเป๋าคูปองส่วนลด, และประวัติการสั่งซื้อพร้อมปุ่มกดสั่งซ้ำทันที (1-Click Re-order)
8. 🛡️ **ระบบความปลอดภัย & สิทธิ์ผู้ใช้ (RBAC & PDPA Compliance)**: แยก 3 สิทธิ์เข้มงวด (Customer / Merchant / Super Admin), ป้องกัน Protected Routes และแบนเนอร์ขอความยินยอมคุกกี้ตามกฎหมาย PDPA
9. 🎨 **ระบบ UX/UI & การเข้าถึง (Preferences & Accessibility)**: Fluid Zoom Scaling (`Ctrl +` / `Ctrl -`) ไร้พื้นที่ว่างใต้ Footer, สลับโหมด Dark/Light และสลับภาษาไทย/อังกฤษแบบ Real-time

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend Framework**: React 19 + Vite 8
- **State Management**: Redux Toolkit & React Context API
- **Routing**: React Router v7 (Single Page Application with Netlify `_redirects`)
- **Styling**: Vanilla CSS Modules, Modern Dark Slate Glassmorphism, Bootstrap Icons & Lucide Icons
- **Backend & Database**: Firebase (Auth, Cloud Firestore DB, LocalStorage Fallback)
- **AI Engine**: Gemini 3.7 Flash API & Natural Language Query Parser

---

## 🚀 ขั้นตอนการติดตั้งและรันโปรเจกต์ (Getting Started)

1. **โคลน Repository และติดตั้ง Dependencies:**
```bash
git clone https://github.com/easy-web-p/Queue-up.git
cd Queue-up
npm install
```

2. **รันเซิร์ฟเวอร์สำหรับพัฒนา (Development Server):**
```bash
npm run dev
```

3. **สร้างไฟล์ Production Build:**
```bash
npm run build
```

---

## 🗺️ แผนการพัฒนาในอนาคต (Roadmap)

- [ ] **IoT Kitchen Buzzer & Canteen TV Display**: หน้าจอทีวีแสดงคิวรวมกลางโรงอาหารและกระดิ่งโต๊ะอาหาร
- [ ] **Automated Bank Slip OCR**: ตรวจสอบยอดเงินเข้าบัญชีผ่าน PromptPay Open API อัตโนมัติ 100%
- [ ] **Multi-Vendor Cart**: สั่งอาหารจากหลายร้านค้าพร้อมกันและตัดบิลเดียว
- [ ] **Predictive AI Stock Preparation**: วิเคราะห์ข้อมูลการสั่งเพื่อคาดการณ์ปริมาณวัตถุดิบที่ต้องเตรียมล่วงหน้า
