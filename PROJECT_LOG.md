# 🍜 QueueUp — รายงานสถาปัตยกรรมระบบ ประวัติการพัฒนา และแผนงานแม่บท (Master Architecture & Dev Spec)

> **เวอร์ชันระบบ:** v2.5 (Production Release Candidate)  
> **โดเมนหลักอย่างเป็นทางการ:** [https://queueup-school.netlify.app](https://queueup-school.netlify.app)  
> **Repository:** [https://github.com/easy-web-p/Queue-up.git](https://github.com/easy-web-p/Queue-up.git)  
> **กลุ่มผู้พัฒนา:** กลุ่ม 23 (91) — รายวิชา GE341511 มหาวิทยาลัยขอนแก่น

---

## 🏗️ 1. โครงสร้างสถาปัตยกรรมเว็บแอปพลิเคชันโดยละเอียด (System Architecture)

ระบบ QueueUp พัฒนาขึ้นด้วยสถาปัตยกรรม **Client-Server Single Page Application (SPA)** เชื่อมต่อกับ **Cloud Backend-as-a-Service (Firebase)** และโมเดลประมวลผลภาษาธรรมชาติ **Gemini AI**

```
my-QueueUp-app/
├── public/
│   ├── _redirects                  # กฎ SPA Rewrite Routing บน Netlify (/* /index.html 200)
│   ├── logo.png / favicon.svg      # โลโก้และไอคอนทางการของระบบ
│   └── manifest.json               # คอนฟิก Progressive Web App (PWA)
├── src/
│   ├── assets/                     # รูปภาพ แบนเนอร์ และกราฟิกประกอบ
│   ├── components/                 # คอมโพเนนต์ UI ส่วนกลางที่ใช้ร่วมกัน
│   │   ├── Navbar.jsx              # แถบนำทางหลัก, สลับภาษา, ตัวเลือกสิทธิ์, ตะกร้า และคะแนน CRM
│   │   ├── Footer.jsx              # ส่วนท้ายเว็บแบบ Sticky Footer พร้อมลิงก์ PDPA และช่องทางติดต่อ
│   │   ├── ShopeeSearchBar.jsx     # แถบค้นหาอัจฉริยะ AI NLP, กรอง 18 หมวดหมู่ และประวัติค้นหา
│   │   ├── DailyMenuBoard.jsx      # ป้ายเมนูแนะนำประจำวันและแคโรเซล 10 อันดับขายดี
│   │   ├── FoodCard.jsx            # การ์ดแสดงรายการอาหาร ราคา ส่วนลด และปุ่มสั่งจองด่วน
│   │   ├── ClientCartModal.jsx     # หน้าต่างตะกร้าสินค้า สรุปรายการ และคำนวณราคาสุทธิ
│   │   ├── PaymentModal.jsx        # ป๊อปอัป PromptPay Dynamic QR Code และระบบอัปโหลดสลิป
│   │   ├── ClientQueueTicket.jsx   # บัตรคิวดิจิทัลแบบเรียลไทม์ พร้อม Dynamic QR Code ตรวจสอบ
│   │   ├── ClientLoyaltyDrawer.jsx # ลิ้นชักกระเป๋าแต้มสะสม CRM Points (128 แต้ม) และคูปอง
│   │   ├── MerchantKDS.tsx         # หน้าจอครัวสัมผัส (Kitchen Display System) แบบ Kanban
│   │   ├── MerchantMenuManager.tsx # ระบบจัดการเมนู ปรับราคา เปิด-ปิดสต็อกอาหาร
│   │   ├── MerchantCRMAnalytics.tsx# แดชบอร์ดวิเคราะห์ยอดขายและอัตราลูกค้าประจำ
│   │   ├── SellerAssistantModal.jsx# ผู้ช่วย AI แนะนำเมนูขายดีและการตั้งราคา
│   │   ├── CookieConsentBanner.jsx # แบนเนอร์ขอความยินยอมตามกฎหมาย PDPA
│   │   ├── ChatModal.jsx           # หน้าต่างแชทสนทนากับร้านค้าและผู้ช่วย AI แบบสด
│   │   └── ProtectedRoute.jsx      # Route Guard ป้องกันการเข้าถึงหน้าที่ต้องมีสิทธิ์
│   ├── context/
│   │   ├── AuthContext.jsx         # Context จัดการสถานะ Authentication และบทบาทผู้ใช้ (RBAC)
│   │   └── PreferencesContext.jsx  # Context จัดการธีม (Light/Dark) และภาษา (TH/EN)
│   ├── pages/                      # หน้าจอหลักของระบบ (Routing Views)
│   │   ├── Home.jsx                # หน้าแรก: Ticker ข่าวสาร, Banner, เมนูขายดี, Catalog รวม
│   │   ├── SearchResults.jsx       # หน้ารวมผลการค้นหา กรองพิกัดโรงอาหาร และจัดเรียง
│   │   ├── ProductDetail.jsx       # หน้ารายละเอียดอาหาร, Time-Slot Booking, คำนวณราคา
│   │   ├── FoodBooking.tsx         # หน้าระบบจองคิวอาหารล่วงหน้าแบบเจาะจงเวลา
│   │   ├── MerchantDashboard.jsx   # แดชบอร์ดศูนย์ควบคุมร้านค้าและหน้าจอครัว KDS
│   │   ├── MerchantOnboarding.jsx  # หน้าลงทะเบียนเปิดร้านค้าใหม่และตั้งค่าเบื้องต้น
│   │   ├── StoreAdminPage.tsx      # แผงควบคุมส่วนกลาง (Super Admin) ดูภาพรวมทั้งโรงอาหาร
│   │   ├── UserProfile.jsx         # หน้าโปรไฟล์ผู้ใช้ ข้อมูลส่วนตัว รหัสนักศึกษา กระเป๋าคูปอง
│   │   ├── UserPurchase.jsx        # หน้าประวัติการสั่งซื้อ และติดตามสถานะคิวทั้งหมด
│   │   ├── PdpaPolicy.jsx          # หน้านโยบายคุ้มครองข้อมูลส่วนบุคคลและข้อกำหนดการใช้งาน
│   │   ├── Login.jsx               # หน้าเข้าสู่ระบบและสมัครสมาชิก
│   │   └── NotFound.jsx            # หน้า 404 สวยงามพร้อมปุ่มนำทางกลับหน้าหลัก
│   ├── services/                   # เลเยอร์จัดการตรรกะและบริการภายนอก
│   │   ├── aiBehaviorEngine.js     # AI NLP Query Parser และ Recommendation Logic
│   │   ├── aiSecurityShield.js     # ระบบตรวจจับคำสั่งไม่พึงประสงค์และการป้องกันข้อมูล
│   │   ├── aiChatService.js        # บริการแชทอัตโนมัติระหว่างร้านค้ากับลูกค้า
│   │   ├── storeIsolationEngine.js # ระบบแยกความปลอดภัยระหว่างร้านค้า (Store Isolation)
│   │   └── firebase.js             # คอนฟิกและตัวเชื่อมต่อ Firebase SDK (Auth/Firestore)
│   ├── store/                      # จัดการ State ระดับ Global ด้วย Redux Toolkit
│   │   ├── authSlice.js            # Redux Slice ควบคุมสถานะผู้ใช้และสิทธิ์
│   │   └── store.js                # รวม Redux Store กลาง
│   ├── index.css                   # Global Fluid Scaling, Design System & Theme Styles
│   └── main.jsx                    # จุดเริ่มต้นของแอปพลิเคชัน (React Root Mount)
├── firestore.rules                 # กฎความปลอดภัย Cloud Firestore RBAC
├── firebase.json                   # การตั้งค่าคอนฟิก Firebase Service
└── package.json                    # รายการ Dependencies และ Scripts ของโปรเจกต์
```

---

## ⚙️ 2. รายละเอียดการทำงานของฟังก์ชันทั้งหมด (Core Functional Specifications)

### 1) 🔍 ระบบค้นหาอัจฉริยะ (AI Smart Search & Filter Engine)
- **Natural Language Parsing :** ประมวลผลคำค้นหาภาษาธรรมชาติ เช่น คำว่า "เผ็ด", "งบ 50", "ด่วน", "ยอดนิยม" แปลงเป็นเงื่อนไขตัวกรองแบบ Multi-criteria อัตโนมัติ
- **Category Filter Carousel :** แถบเลื่อนหมวดหมู่อาหาร 18 ชนิดพร้อมภาพประกอบ
- **Campus Location Filter :** กรองร้านค้าตามพิกัดอาคาร (โรงอาหาร 1, โรงอาหารกลาง, อาคารกิจกรรม)

### 2) 🏠 ระบบหน้าแรก & นำเสนออาหาร (Homepage & Food Discovery)
- **News Ticker :** ข่าวสารแจ้งเตือนสิทธิประโยชน์และโปรโมชันโรงอาหารแบบเลื่อนอัตโนมัติ
- **Top 10 Bestsellers :** คำนวณอันดับอาหารขายดีตามยอดการสั่งซื้อจริง (`salesCount`)
- **1-Click Welcome Coupon :** แจกคูปองส่วนลด `WELCOME50` บันทึกลงกระเป๋าคูปองในคลิกเดียว

### 3) 🍱 ระบบสั่งจองอาหารล่วงหน้า (Pre-Order & Time-Slot Booking)
- **Dynamic Time-Slot :** ระบบเลือกเวลานัดรับอาหารตามช่วงเวลา (เช่น 11:30, 12:00, 12:30 น.) พร้อมคำนวณส่วนลดตามช่วงเวลาเร่งด่วน (-50%, -20%, -10%)
- **Guest Calculator :** เลือกจำนวนผู้รับประทาน (1-4+ คน) ระบบคำนวณปริมาณและยอดรวมทันที

### 4) 💳 ระบบชำระเงิน & ตรวจสอบสลิป (Payment & Slip Verification)
- **Dynamic PromptPay QR :** สร้าง QR Code ชำระเงินตามยอดเงินจริงของออเดอร์
- **OCR Simulation & Verification :** ระบบตรวจสอบสลิปการโอนเงินอัตโนมัติภายใน 1.2 วินาที
- **15-Minute Lock Timer :** ตัวจับเวลานับถอยหลัง ป้องกันการล็อกคิวค้างในระบบ

### 5) 🎟️ ระบบติดตามคิวแบบเรียลไทม์ (Live Queue Tracker)
- **Unique Queue ID :** ออกหมายเลขคิวแยกตามร้านค้า เช่น A05, A06 พร้อม Digital QR Code
- **3-Stage Lifecycle :** `TO_PAY` (รอชำระเงิน) $\rightarrow$ `TO_SHIP` (ร้านกำลังปรุง) $\rightarrow$ `COMPLETED` (ปรุงเสร็จ พร้อมรับอาหาร)
- **Audio Notification :** เสียงกระดิ่งแจ้งเตือนเมื่อคิวพร้อมรับอาหาร

### 6) 🏪 ระบบจัดการร้านค้า & หน้าจอครัว (Merchant Dashboard & KDS)
- **KDS Kanban Board :** หน้าจอครัวสำหรับแม่ค้า กดเลื่อนสถานะออเดอร์ด้วยการแตะ 1 ครั้ง (1-Tap Bump) พร้อมแถบจับเวลาความเร่งด่วน
- **Menu & Stock Manager :** ปรับราคาอาหาร และกดสลับเปิด/ปิดสถานะ "เมนูหมด" ได้ทันที
- **Daily Sales Summary :** สรุปยอดขายรวมและจำนวนออเดอร์ประจำวัน

### 7) 👤 ระบบโปรไฟล์ผู้ใช้ & สิทธิประโยชน์ (User Profile & CRM Loyalty)
- **CRM Loyalty Wallet :** ระบบสะสมแต้ม QueueUp Points (128 แต้ม) สำหรับแลกส่วนลด
- **Coupon Wallet :** จัดเก็บคูปองส่วนลดพร้อมแท็บคูปองที่ใช้ได้และใช้แล้ว
- **1-Click Re-order :** ประวัติการสั่งซื้อพร้อมปุ่มกดสั่งซ้ำเมนูเดิมได้ทันที

### 8) 🛡️ ระบบความปลอดภัย & สิทธิ์ผู้ใช้งาน (Security & RBAC)
- **3-Tier RBAC :** แบ่งสิทธิ์เข้มงวดระหว่าง Customer, Merchant และ Super Admin
- **Protected Routes :** ป้องกันการเข้าถึงหน้าจัดการร้านค้าและแอดมินโดยไม่ได้รับอนุญาต
- **PDPA Compliance :** แบนเนอร์ขอความยินยอมคุกกี้ และหน้านโยบายความเป็นส่วนตัว

### 9) 🎨 ระบบ UX/UI & การเข้าถึง (Preferences & Accessibility)
- **Fluid Zoom Scaling :** รองรับการย่อ/ขยายหน้าจอ (`Ctrl +` / `Ctrl -`) และหน้าจอทุกขนาดโดยไม่มีพื้นที่ว่างใต้ Footer
- **Theme & Multi-Language :** สลับโหมด Dark/Light และสลับภาษาไทย/อังกฤษได้แบบ Real-time

---

## 🔐 3. รายละเอียดการทำงานของระบบสิทธิ์การเข้าถึง (Access Control Security Architecture)

### 🎯 วัตถุประสงค์
ระบบ Access Control ของ QueueUp ทำหน้าที่ควบคุมว่าผู้ใช้แต่ละประเภทสามารถเข้าหน้าใด อ่านข้อมูลอะไร และดำเนินการอะไรได้บ้าง โดยแบ่งการรักษาความปลอดภัยออกเป็นหลายชั้น:

```
ผู้ใช้ ➔ Firebase Authentication ➔ ProtectedRoute Guard ➔ Role / Permission ➔ Store Isolation (Data Ownership) ➔ Firestore Security Rules
```

> **หมายเหตุ:** `ProtectedRoute.jsx` เป็นด่านป้องกันฝั่ง Frontend เท่านั้น ความปลอดภัยของข้อมูลจริงถูกบังคับซ้ำที่ **Firestore Security Rules (`firestore.rules`)** และ **Backend/Cloud Functions** เสมอ

---

### 1. 🔒 Authentication Guard (กรณียังไม่ได้เข้าสู่ระบบ)
* ทุกหน้าที่เกี่ยวข้องกับข้อมูลส่วนตัว การสั่งอาหาร การชำระเงิน หรือการจัดการระบบ (`/home`, `/user/profile`, `/user/purchase`, `/product/:id`, `/booking`, `/merchant/dashboard`, `/admin`) จะถูกตรวจสอบสถานะผ่าน `AuthContext.jsx` และ Firebase Auth
* **Flow การทำงาน :**
  ```
  ผู้ใช้เปิด URL ➔ AuthContext ตรวจสอบ Firebase Auth ➔ กำลังโหลด? (⏳ Loading) ➔ Authenticated?
    ├── ❌ NO  ➔ Redirect ไปยัง /login พร้อมจำ Path เดิมไว้
    └── ✅ YES ➔ ตรวจสอบ Role ตามลำดับ
  ```
* **สำคัญ :** ระบบจะไม่ Redirect ก่อน Firebase ตรวจสอบ Auth เสร็จสิ้น เพื่อป้องกันปัญหาหน้าเด้งกลับ `/login` ทั้งที่ผู้ใช้ล็อกอินอยู่แล้ว

---

### 2. 👤 Customer / Student Access (สิทธิ์นักเรียนและผู้ซื้อ)
* **หน้าที่อนุญาต :** `/home`, `/search`, `/product/:id`, `/user/purchase`, `/user/account/profile`, `/booking`, `/queueup`
* **สามารถทำได้ :** ค้นหาเมนูอาหาร, เลือกรอบเวลารับอาหาร (Time-slot), เพิ่มลงตะกร้า, ชำระเงินผ่าน PromptPay QR, ดูตั๋วคิวสด, ดูประวัติการสั่งซื้อ และสะสมแต้ม CRM Points
* **ไม่สามารถทำได้ :**
  - ❌ เข้าหน้า `/merchant/dashboard`
  - ❌ เข้าหน้า `/admin`
  - ❌ แก้ไขข้อมูลร้านค้า / สต็อกอาหาร
  - ❌ ดูออเดอร์ของร้านอื่น หรือดูข้อมูลส่วนตัวของ Customer คนอื่น

---

### 3. 🏪 Merchant Access (สิทธิ์เจ้าของร้านค้าในโรงอาหาร)
* **หน้าที่อนุญาต :** `/merchant/dashboard` (`MerchantDashboard.jsx`)
* **คอมโพเนนต์ภายใน :**
  - `MerchantKDS.tsx` : หน้าจอควบคุมครัว Kanban 1-Tap Bump
  - `MerchantMenuManager.tsx` : จัดการเมนู ปรับราคา และเปิด/ปิดสต็อกอาหาร
  - `MerchantCRMAnalytics.tsx` : วิเคราะห์ยอดขายและอัตราลูกค้าประจำ
  - `SellerAssistantModal.jsx` : ผู้ช่วย AI แนะนำเมนูขายดีและการตั้งราคา

---

### 4. 🏬 Merchant Store Isolation (การแยกข้อมูลระหว่างร้านค้า)
* Merchant ไม่ได้มีสิทธิ์เข้าถึงข้อมูลร้านค้าทั้งหมด แต่จะถูกผูกเข้ากับ:
  ```
  user.uid ➔ merchant profile ➔ storeId ➔ เฉพาะข้อมูลของ storeId นี้เท่านั้น
  ```
* **Firestore Security Rules :** ป้องกันไม่ให้ Merchant ร้าน A เข้าถึงหรือแก้ไขสินค้า ออเดอร์ และยอดขายของร้าน B แม้จะพยายามส่ง Request เองจากภายนอก

---

### 5. 👑 Super Admin Access (สิทธิ์ผู้ดูแลระบบส่วนกลาง)
* **หน้าที่อนุญาต :** `/admin` (`StoreAdminPage.tsx`)
* **เงื่อนไข :** `allowedRoles = ["admin"]` (เฉพาะบัญชี `58140@lomsak.ac.th` หรือบัญชีที่มีสิทธิ์ Admin เท่านั้น)
* **ความสามารถ :**
  - 🏪 **Store Management :** อนุมัติร้านค้าใหม่, ระงับร้านค้า, ตรวจสอบข้อมูลและค่าธรรมเนียม
  - 👤 **User Management :** ตรวจสอบรายชื่อผู้ใช้, จัดการสถานะบัญชี, ระงับบัญชีตามนโยบาย
  - 🚨 **Order Intervention :** ตรวจสอบออเดอร์ระดับ Platform, ยกเลิกออเดอร์ผิดปกติ, ดำเนินการ Refund
  - 📊 **Platform Analytics :** ดูภาพรวม GMV, จำนวนออเดอร์รวม, ยอดขายสะสมทั้งโรงอาหาร

---

### 6. 🚫 การป้องกันการเข้าถึง `/admin` (Direct URL Protection)
* หากผู้ใช้ทั่วไป (`Customer` หรือ `Merchant`) พยายามพิมพ์ `/admin` ใน URL Bar:
  ```
  /admin ➔ ProtectedRoute ➔ Authenticated? ➔ YES ➔ Role == 'admin'?
    ├── ✅ YES ➔ เข้าสู่ StoreAdminPage (Admin Portal)
    └── ❌ NO  ➔ แสดงหน้า Access Denied แจ้งเตือนสิทธิ์ไม่เพียงพอ พร้อมปุ่มกลับหน้าหลัก
  ```

---

### 7. 🔄 Role Switching (การสลับโหมดการใช้งาน)
* **หลักการ :** การสลับบทบาท (Role Switcher) เป็นเพียง **"การเปลี่ยนพื้นที่การใช้งานของสิทธิ์ที่มีอยู่แล้ว"** ไม่ใช่การยกระดับสิทธิ์ใหม่จากฝั่ง Client
* หาก Customer ที่ยังไม่มีสิทธิ์ Merchant ต้องการเปิดร้านค้า ต้องผ่านขั้นตอน Onboarding (`/portal/th-onboarding`) เพื่อส่งข้อมูลให้ Super Admin ตรวจสอบและอนุมัติก่อน

---

### 8. 🛡️ Frontend + Backend Multi-layer Security
* **Layer 1 (Frontend Guard) :** `ProtectedRoute.jsx` ตรวจสอบสถานะ Login และ Role ก่อนเรนเดอร์หน้าจอ
* **Layer 2 (Backend Security Rules) :** `firestore.rules` ตรวจสอบ UID, Role, Store Ownership และ Data Integrity ที่ระดับฐานข้อมูลทุกครั้งที่มีการอ่านหรือเขียน

---

### 9. 💳 Payment Security (ความปลอดภัยระบบชำระเงิน)
* ระบบไม่เชื่อยอดเงินที่ส่งมาจาก Client โดยตรง
* ลำดับขั้นตอนการชำระเงิน:
  ```
  สร้าง Payment ➔ คำนวณยอดเงินจริงจากฐานข้อมูล ➔ แสดง QR PromptPay ➔ ตรวจสอบสลิป ➔ อัปเดตสถานะ PENDING ➔ PAID ➔ CONFIRMED ➔ สร้างบัตรคิว (Queue Ticket)
  ```

---

### 10. 🎫 Queue Security (ความปลอดภัยของตั๋วคิว)
* คิวทุกใบผูกกับ `userId`, `orderId`, `storeId`, และ `queueNumber`
* Customer A สามารถดูได้เฉพาะคิวของตนเอง ไม่สามารถสอดแนมคิวของ Customer B ได้
* Merchant ดูได้เฉพาะคิวที่สั่งในร้านของตนเอง

---

### 11. 🤖 AI Security Guard
* โมเดล AI (`aiBehaviorEngine.js`, `aiChatService.js`, `aiSecurityShield.js`) ทำหน้าที่เป็น **"ผู้ช่วยวิเคราะห์และแนะนำ"** เท่านั้น
* **ห้าม AI เป็นตัวกำหนดสิทธิ์ผู้ใช้โดยเด็ดขาด** สิทธิ์ทั้งหมดต้องมาจาก Firebase Auth Token และ Firestore Database Claims เท่านั้น

---

### 12. 📜 Audit Logs (บันทึกประวัติการดำเนินงานสำคัญ)
* บันทึก Log ทุกครั้งที่มีการเปลี่ยนแปลงสำคัญ: ใคร ทำอะไร กับข้อมูลใด เมื่อไหร่ และผลลัพธ์คืออะไร (เช่น การเปลี่ยน Role, การระงับบัญชี, การอนุมัติร้านค้า, การ Refund) ผ่าน `storeIsolationEngine.js`

---

### 13. 🧩 สรุปตารางสิทธิ์การเข้าถึง (Role-Permission Matrix)

| บทบาทผู้ใช้ (Role) | พื้นที่การใช้งานหลัก | สิทธิ์การเข้าถึงและการทำงาน |
| :--- | :--- | :--- |
| **Guest** (ยังไม่ล็อกอิน) | `/login`, `/queueup`, `/pdpa` | ดูได้เฉพาะหน้า Landing Page และหน้านโยบายสาธารณะ |
| **Customer** (นักเรียน/ผู้ซื้อ) | `/home`, `/search`, `/product`, `/purchase`, `/profile`, `/booking` | ค้นหาอาหาร สั่งจองล่วงหน้า สแกนจ่ายเงิน และดูตั๋วคิวของตนเอง |
| **Merchant** (ร้านค้าโรงอาหาร) | `/merchant/dashboard` | จัดการครัว KDS ปรับเมนู สต็อก และดูยอดขายเฉพาะร้านของตนเอง |
| **Super Admin** (ผู้ดูแลส่วนกลาง) | `/admin` | จัดการภาพรวมร้านค้า ผู้ใช้ ออเดอร์ทั้งโรงอาหาร และ Audit Logs |

---

## 🛠️ 4. แผนการพัฒนาและแก้ไขปัญหาที่ดำเนินการสำเร็จ (Problem-Solving & Bug Fixes)

| ปัญหาที่พบ | สาเหตุ | วิธีการแก้ไข | สถานะ |
| :--- | :--- | :--- | :---: |
| **1. หน้าจอเพี้ยนเมื่อกดซูม (`Ctrl +`/`Ctrl -`) และมีช่องว่างใต้ Footer** | ขาดการตั้งค่า Fluid Scaling และไม่มี Sticky Footer ใน Root Container | ใช้ `max-width: clamp(1200px, 92vw, 1680px)` และจัดโครงสร้าง Flexbox ให้กับ `#root` | ✅ แก้ได้ 100% |
| **2. รูปภาพใน `ProductDetail` ขยายผิดสัดส่วน** | CSS Class ไม่ตรงกับโครงสร้าง JSX Grid 2 คอลัมน์ | ปรับจับคู่คลาส CSS `queue-pd-main-grid` และ `queue-pd-wrapper` ใหม่ | ✅ แก้ได้ 100% |
| **3. Netlify ขึ้นข้อผิดพลาด 404 Not Found เมื่อรีเฟรชหน้าเว็บ** | เซิร์ฟเวอร์ไม่รู้จัก Client-Side Routing ของ Single Page App | สร้างไฟล์ `public/_redirects` และกำหนดกฎ `/* /index.html 200` | ✅ แก้ได้ 100% |
| **4. ข้อมูลค้างเมื่ออินเทอร์เน็ตหลุด** | ไม่มีการสำรองข้อมูลฝั่ง Client | วางระบบ LocalStorage Fallback ซิงค์ข้อมูลอัตโนมัติเมื่อกลับมาออนไลน์ | ✅ แก้ได้ 100% |
| **5. การเข้าถึงหน้า Admin / Merchant โดยไม่ตรวจสิทธิ์** | ขาดการตรวจสอบ Role-Based Access Control ใน Route Guard | เพิ่มการตรวจสอบ `allowedRoles` ใน `ProtectedRoute.jsx` พร้อมหน้า Access Denied | ✅ แก้ได้ 100% |

---

## 🚀 5. แผนงานและฟังก์ชันที่ต้องพัฒนาต่อในอนาคต (Future Roadmap & Backlog)

1. **IoT Kitchen Buzzer & Central Canteen TV Display :**  
   - พัฒนาระบบแสดงผลหมายเลขคิวบนหน้าจอทีวีรวมกลางโรงอาหาร พร้อมเชื่อมต่ออุปกรณ์กระดิ่งไร้สายแจ้งเตือนที่โต๊ะอาหาร
2. **Automated Bank Slip OCR Verification :**  
   - เชื่อมต่อ API สลิปธนาคารจริงผ่าน PromptPay Open API / Webhook เพื่อตรวจสอบยอดเงินเข้าบัญชีร้านค้าแบบอัตโนมัติ 100%
3. **Multi-Vendor Cross-Store Cart :**  
   - พัฒนาระบบรวมตะกร้าสินค้าจากหลายร้านค้าในโรงอาหาร สั่งซื้อและชำระเงินรวมในครั้งเดียว พร้อมแยกใบเสร็จและคิวไปยังแต่ละร้านค้าโดยอัตโนมัติ
4. **Predictive AI Stock & Ingredient Forecast :**  
   - ใช้ Gemini AI วิเคราะห์สถิติประวัติการสั่งซื้อย้อนหลัง เพื่อคาดการณ์ปริมาณวัตถุดิบที่ร้านค้าต้องเตรียมในแต่ละวัน ลดปัญหาวัตถุดิบเหลือทิ้ง
5. **Group Pre-ordering (ระบบสั่งอาหารเป็นกลุ่ม) :**  
   - ฟีเจอร์สร้างห้องสั่งอาหารรวมสำหรับกลุ่มเพื่อนหรือครูในห้องเรียน สั่งพร้อมกันแต่แยกชำระเงินรายบุคคล
