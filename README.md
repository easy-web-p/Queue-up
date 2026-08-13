# 🍜 QueueUp — School Food CRM & Pre-Order System

QueueUp เป็นแพลตฟอร์มบริหารจัดการสั่งอาหารล่วงหน้า จองคิว และระบบสะสม แต้ม CRM สำหรับโรงอาหารโรงเรียน/มหาวิทยาลัย (School Food CRM) ช่วยลดเวลาในการเข้าคิว เพิ่มยอดขายให้ร้านค้า และยกระดับประสบการณ์สั่งอาหารของผู้ใช้

---

## 🌟 ฟีเจอร์หลัก (Core Features)

- 🛒 **ระบบสั่งอาหารล่วงหน้าและจองคิว (Food Pre-Order & Queueing)**: สั่งอาหารล่วงหน้าตามเวลาที่ต้องการ รับคิวทันทีโดยไม่ต้องยืนรอกระทะร้อน
- 📱 **ระบบสลับบทบาทผู้ใช้ (Role Switching)**: สลับระหว่าง **ผู้ซื้อ (Customer)** และ **ศูนย์ผู้ขาย (Merchant Dashboard)** ได้ทันทีในบัญชีเดียว
- 🤖 **Smart Search & Filter**: ค้นหาเมนูอาหารและร้านค้าด้วย AI Smart Search พร้อมระบบแนะนำเมนูขายดีประจำโรงอาหาร
- 🔔 **ป๊อบอัพการแจ้งเตือน Real-time**: แจ้งเตือนสถานะคิวเมื่ออาหารพร้อมรับ และโปรโมชั่นพิเศษจากร้านค้าที่ติดตาม
- 💬 **ระบบแชทติดต่อร้านค้า (Store Direct Chat)**: พูดคุย สอบถามสถานะคิว หรือระบุความต้องการพิเศษกับร้านค้าได้โดยตรง
- 💳 **ระบบชำระเงินและสลิปสแกน (Payment & Slip Gateway)**: รองรับการชำระเงินผ่าน QR PromptPay พร้อมระบบอัปโหลดสลิปยืนยัน
- 🎯 **ระบบประเมินแพลตฟอร์ม Real-time (Dynamic System Scorecard)**: ให้คะแนนและส่งข้อเสนอแนะเพื่อพัฒนาแพลตฟอร์ม พร้อมคำนวณคะแนนเฉลี่ยจริงลง Firestore
- 🍪 **ระบบคุ้มครองข้อมูล PDPA & Cookie Management**: แบนเนอร์ขอความยินยอมคุกกี้ตามกฎหมาย PDPA พร้อมระบบตั้งค่าคุกกี้และ Cookie Session Tracker ครอบคลุมทุกหน้า

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend Framework**: React (Vite)
- **State Management**: Redux Toolkit & React Context API
- **Styling**: Vanilla CSS, Glassmorphism UI & Bootstrap Icons
- **Backend & Database**: Firebase (Auth, Firestore DB, LocalStorage Fallback)
- **Build & Bundle Optimization**: Vite 8 + Manual Vendor Chunking

---

## 🚀 ขั้นตอนการติดตั้งและรันโปรเจกต์ (Getting Started)

1. **ติดตั้ง Dependencies**:
```bash
npm install
```

2. **รันเซิร์ฟเวอร์สำหรับพัฒนา (Development Server)**:
```bash
npm run dev
```

3. **สร้างการผลิตและทดสอบ Build (Production Build)**:
```bash
npm run build
```

---

## 📝 นโยบายคุกกี้และการคุ้มครองข้อมูลส่วนบุคคล (PDPA Compliance)

แพลตฟอร์ม QueueUp มีการจัดเก็บคุกกี้เพื่อความปลอดภัยในการรักษาเซสชันจองคิว สถิติการใช้งานเพื่อพัฒนาความเร็ว และคุกกี้การตลาดเพื่อเสนอสิทธิประโยชน์ตามกฎหมาย PDPA (Personal Data Protection Act)
