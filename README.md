# QueueUp (คิวอัพ) 🍽️

> **ระบบจองโต๊ะ สั่งอาหาร และจัดการคิวร้านอาหารอัจฉริยะ พร้อม AI ผู้ช่วยบริการและแชทแบบ Real-time**

QueueUp เป็นแพลตฟอร์ม Web Application ทันสมัยที่พัฒนาขึ้นเพื่อเชื่อมต่อระหว่าง **ร้านอาหาร (Merchant/Admin)** และ **ลูกค้า (Customer)** เข้าด้วยกัน ช่วยลดปัญหาการรอคิวหน้าร้าน เพิ่มความสะดวกรวดเร็วในการสั่งอาหารล่วงหน้า และยกระดับประสบการณ์ด้วย AI Butler ผู้ช่วยอัจฉริยะ

---

## 🌟 จุดเด่นและฟังก์ชันหลัก (Key Features)

- 🤖 **AI Butler Smart Assistant**: แชทสอบถาม แนะนำเมนู คำนวณยอดเงิน และทำรายการจองโต๊ะ/สั่งอาหารล่วงหน้าพร้อมปุ่มชำระเงินอัตโนมัติ
  - **Layer 1** Intent Router แบบ deterministic ตอบคำถามที่พบบ่อยทันที ไม่มีค่าใช้จ่ายและไม่หลอน
  - **Layer 2** Scope-Bound Tool Calling (เปิดใช้เมื่อตั้ง `GEMINI_API_KEY`) โมเดลเรียกได้เฉพาะ tool อ่านข้อมูลของร้านนั้น และไม่มีพารามิเตอร์ใดที่ระบุร้านอื่นได้
  - **Layer 3** ส่งต่อให้ทางร้านเมื่อไม่แน่ใจ พร้อม hard-block เรื่องสารก่อภูมิแพ้และการรับปากแทนร้าน
- 💬 **Real-time Merchant-Customer Chat**: ระบบแชทสนทนาระหว่างลูกค้าและร้านค้าแบบเรียลไทม์ พร้อมระบบแจ้งเตือนออเดอร์และการจัดการสถานะ
- 📋 **Live Queue & Booking System**: จองคิวและจองโต๊ะล่วงหน้า ระบุวัน เวลา จำนวนคน และรายการอาหาร พร้อมอัปเดตสถานะแบบสดๆ
- 💳 **Seamless Checkout & Payment**: ระบบชำระเงิน สรุปยอดค่าบริการ และแนบสลิป/หลักฐานการชำระเงิน
- 🔐 **Secure Firebase Architecture**: ขับเคลื่อนด้วย Firebase Firestore, Authentication และ Storage พร้อม Security Rules ที่ผ่านการตรวจสอบความปลอดภัยอย่างเข้มงวด
- 📱 **Responsive & Smooth UI**: รองรับการใช้งานทั้งบนมือถือ แท็บเล็ต และคอมพิวเตอร์ พร้อม Transition และ Scroll Animation ที่นุ่มนวล

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Icons & Animation**: [Lucide React](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/)
- **Backend & Database**: [Firebase](https://firebase.google.com/) (Firestore, Auth, Storage, Analytics) + Express
  - หากไม่มี Firebase Admin credentials ในโหมด development เซิร์ฟเวอร์จะใช้ไฟล์ `.local_db.json` แทน (โหมด production จะหยุดทำงานทันทีแทนการ fallback)
- **AI Chat**: Deterministic Intent Router ฝั่งเซิร์ฟเวอร์ (`server/services/aiChatEngine.js`) — ยังไม่ได้เชื่อมต่อ LLM
- **Testing**: ชุดทดสอบ Node.js แบบ built-in (`npm test`) + Firestore Rules Emulator (`npm run test:rules`)

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
   ตัวแปรที่จำเป็นสำหรับการรันเซิร์ฟเวอร์:

   | ตัวแปร | จำเป็น | คำอธิบาย |
   |---|---|---|
   | `HMAC_SECRET` | ✅ production | กุญแจเซ็นรหัส PIN รับอาหาร — production จะไม่สตาร์ทถ้าไม่ตั้ง |
   | `GOOGLE_APPLICATION_CREDENTIALS` | ✅ production | Service Account ของ Firebase Admin (ยกเว้นแพลตฟอร์มที่ให้ ADC เช่น Cloud Run) |
   | `STRIPE_SECRET_KEY` | ตามการใช้งาน | ปิดใช้งานการชำระเงินถ้าไม่ตั้ง (API จะตอบ 503) |
   | `STRIPE_WEBHOOK_SECRET` | ✅ production | production จะไม่สตาร์ทถ้าไม่ตั้ง เพราะ webhook จะรับ payload ที่ไม่ได้เซ็น |
   | `ALLOW_MOCK_AUTH` | ❌ | development เท่านั้น: รับ header `x-mock-*` แทน Firebase ID Token |
   | `CSP_ENFORCE` | ❌ | `true` = บังคับใช้ Content Security Policy (ค่าเริ่มต้นเป็น report-only) ชุดทดสอบ E2E รันแบบ enforce อยู่แล้ว |
   | `ALLOWED_ORIGINS` | ❌ | รายชื่อ origin ที่อนุญาต CORS คั่นด้วยจุลภาค (เว้นว่าง = same-origin เท่านั้นบน production) |
   | `SUPER_ADMIN_EMAILS` | ❌ | อีเมลผู้ดูแลระบบคั่นด้วยจุลภาค (ค่าเริ่มต้นตรงกับ break-glass ใน `firestore.rules`) |
   | `QUEUEUP_TIMEZONE` | ❌ | โซนเวลาของรอบรับอาหาร (ค่าเริ่มต้น `Asia/Bangkok`) |
   | `GEMINI_API_KEY` | ❌ | เปิดใช้ AI Layer 2 — ถ้าไม่ตั้ง ระบบจะใช้ Layer 1 อย่างเดียว |

   > ⚠️ `npm start` ตั้ง `NODE_ENV=production` ให้อัตโนมัติ ซึ่งจะปิด mock auth และปิดการ fallback ไปใช้ฐานข้อมูลไฟล์

4. **รันเซิร์ฟเวอร์สำหรับพัฒนา (Run Development Server)**
   ```bash
   npm run dev
   ```
   เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

   หากต้องการใช้งาน API ฝั่งเซิร์ฟเวอร์ด้วย ให้เปิดอีกเทอร์มินัลแล้วรัน:
   ```bash
   npm run dev:server
   ```
   เซิร์ฟเวอร์ Express จะรันที่พอร์ต 8080 ซึ่งตรงกับ proxy `/api` ของ Vite

5. **รันการทดสอบ (Run Tests)**
   ```bash
   npm run test
   ```

6. **สร้างไฟล์สำหรับ Production (Build)**
   ```bash
   npm run build
   ```

---

## 🧪 การทดสอบ (Testing)

```bash
npm test          # ชุดทดสอบหลัก: Capacity, Concurrency, AI Chat, Chat API, Authorization
npm run test:utc  # ชุดเดียวกันภายใต้ TZ=UTC (จำลองคอนเทนเนอร์จริง)
npm run test:rules # ทดสอบ firestore.rules ด้วย Firestore Emulator (ต้องมี Java)
npm run test:e2e  # ทดสอบ end-to-end ด้วย Playwright บน production build จริง
```

| ชุดทดสอบ | ครอบคลุม |
|---|---|
| `capacityService.test.js` | การคำนวณ Workload, Lazy Expiration, Oversell Prevention และรอบเวลา 15 นาทีที่ไม่ขึ้นกับโซนเวลาของเซิร์ฟเวอร์ |
| `capacityTransaction.test.js` | Firestore ACID Transaction และ Race Condition |
| `aiChatEngine.test.js` | Intent Router, Allergen Guard, Commitment Guard, Booking Card |
| `aiLayer2.test.js` | Layer 2: เครื่องมือถูกผูกกับร้านเดียว, มีแต่ tool อ่านอย่างเดียว, ล้มเหลวแล้วส่งต่อให้คนแทนที่จะพัง |
| `chatRoutes.test.js` | ห้องแชทและการซิงก์ข้อความแบบ end-to-end |
| `authorization.test.js` | ขอบเขตสิทธิ์ของ API: การถอนเงิน, วงจรชีวิตออเดอร์, การปลอมบทบาทในแชท, ยอดชำระเงิน, การแก้เมนูข้ามร้าน และการคิดราคาจากเมนูจริง |
| `schoolRoutes.test.js` | การอนุมัติสถานศึกษา, นำเข้า Roster แบบ batch, การ claim สิทธิ์ และการออก Custom Claims |
| `firestoreRules.test.js` | การแยกข้อมูลระหว่างสถาบันและร้านค้าในระดับ Security Rules |
| `e2e/smoke.spec.ts` | แอปบูตได้จริงบน production build, lazy chunk โหลดได้, CSP ไม่บล็อกแอป, route guard ทำงาน |

> `npm run test:rules` จะดาวน์โหลด Firestore Emulator ในครั้งแรก จึงแยกออกจาก `npm test`

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
