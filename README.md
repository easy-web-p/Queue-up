# QueueUp (คิวอัพ) 🍽️

> **ระบบจองโต๊ะ สั่งอาหาร และจัดการคิวร้านอาหารอัจฉริยะ พร้อม AI ผู้ช่วยบริการและแชทแบบ Real-time**

QueueUp เป็นแพลตฟอร์ม Web Application ทันสมัยที่พัฒนาขึ้นเพื่อเชื่อมต่อระหว่าง **ร้านอาหาร (Merchant/Admin)** และ **ลูกค้า (Customer)** เข้าด้วยกัน ช่วยลดปัญหาการรอคิวหน้าร้าน เพิ่มความสะดวกรวดเร็วในการสั่งอาหารล่วงหน้า และยกระดับประสบการณ์ด้วย AI Butler ผู้ช่วยอัจฉริยะ

---

## 🌟 จุดเด่นและฟังก์ชันหลัก (Key Features)

- 🤖 **AI Butler Smart Assistant**: แชทสอบถาม แนะนำเมนู คำนวณยอดเงิน และทำรายการจองโต๊ะ/สั่งอาหารล่วงหน้าพร้อมปุ่มชำระเงินอัตโนมัติ
- 💬 **Real-time Merchant-Customer Chat**: ระบบแชทสนทนาระหว่างลูกค้าและร้านค้าแบบเรียลไทม์ พร้อมระบบแจ้งเตือนออเดอร์และการจัดการสถานะ
- 📋 **Live Queue & Booking System**: จองคิวและจองโต๊ะล่วงหน้า ระบุวัน เวลา จำนวนคน และรายการอาหาร พร้อมอัปเดตสถานะแบบสดๆ
- 💳 **Seamless Checkout & Payment**: ระบบชำระเงิน สรุปยอดค่าบริการ และแนบสลิป/หลักฐานการชำระเงิน
- 🔐 **Secure Firebase Architecture**: ขับเคลื่อนด้วย Firebase Firestore, Authentication และ Storage พร้อม Security Rules ที่ผ่านการตรวจสอบความปลอดภัยอย่างเข้มงวด
- 📱 **Responsive & Smooth UI**: รองรับการใช้งานทั้งบนมือถือ แท็บเล็ต และคอมพิวเตอร์ พร้อม Transition และ Scroll Animation ที่นุ่มนวล

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Icons & Animation**: [Lucide React](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/)
- **Backend & Database**: [Firebase](https://firebase.google.com/) (Firestore, Auth, Storage, Analytics) + Express / SQLite (Local/Hybrid fallback)
- **AI Integration**: [Google Gemini API](https://ai.google.dev/) (`@google/genai`)
- **Testing**: [Vitest](https://vitest.dev/), Testing Library

---

## 🚀 เริ่มต้นใช้งานในเครื่อง (Getting Started)

### ความต้องการพื้นฐาน (Prerequisites)
- [Node.js](https://nodejs.org/) (เวอร์ชัน 18 ขึ้นไป)
- `npm` หรือ `bun`

### ขั้นตอนการติดตั้ง (Installation)

1. **โคลนคลังโค้ด (Clone Repository)**
   ```bash
   git clone https://github.com/easy-web-p/Queue-up.git
   cd Queue-up
   ```

2. **ติดตั้ง Dependencies**
   ```bash
   npm install
   ```

3. **ตั้งค่า Environment Variables**
   สร้างไฟล์ `.env` โดยคัดลอกตัวอย่างจาก `.env.example`:
   ```bash
   cp .env.example .env
   ```
   กำหนดค่า API Key เช่น `GEMINI_API_KEY` และการตั้งค่า Firebase ที่เกี่ยวข้อง

4. **รันเซิร์ฟเวอร์สำหรับพัฒนา (Run Development Server)**
   ```bash
   npm run dev
   ```
   เปิดเบราว์เซอร์ไปที่ [http://localhost:5173](http://localhost:5173)

5. **รันการทดสอบ (Run Tests)**
   ```bash
   npm run test
   ```

6. **สร้างไฟล์สำหรับ Production (Build)**
   ```bash
   npm run build
   ```

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```text
├── public/                 # Static assets
├── server/                 # Express backend / WebSocket fallback
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ai/             # AI Butler & Chat Components
│   │   ├── booking/        # Reservation & Table UI
│   │   ├── chat/           # Real-time Chat UI
│   │   ├── merchant/       # Restaurant Admin Dashboard
│   │   ├── queue/          # Live Queue Tracker
│   │   └── ...
│   ├── config/             # Firebase & App configuration
│   ├── context/            # React Context providers (Auth, Queue, etc.)
│   ├── services/           # API services & Firebase adapters
│   ├── types/              # TypeScript definitions & data models
│   ├── App.tsx             # Main Application root
│   └── main.tsx            # Entry point
├── firestore.rules         # Security Rules for Firebase Firestore
├── firestore.indexes.json  # Database Indexes
└── package.json
```

---

## 📄 ใบอนุญาต (License)
MIT License
