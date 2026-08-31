# 💖 QueueUp — บันทึกประวัติการพัฒนาและพิมพ์เขียวระบบ (Project Dev Log & Spec)

> **บันทึกสถานะการพัฒนา, สถาปัตยกรรม 3 ฝั่ง (Customer, Merchant KDS, Super Admin), ข้อกำหนด และ Roadmap**

---

## 🎨 1. การออกแบบ UX/UI & Design System (Design Specs)
* **Theme & Styling:** Modern Dark Slate Glassmorphism + Tailwind CSS v3/v4
* **Color Palette:**
  * Primary Accent: `#3B82F6` (Electric Blue) & `#10B981` (Emerald Green for Success/Ready states)
  * KDS Urgency Traffic Lights: 🟢 Green (0-5m), 🟡 Amber (5-12m), 🔴 Pulsing Crimson (12m+ Overdue)
  * Dark Surface: `#0F172A` (Slate 900) with subtle glass borders (`border-slate-800/80`)
* **Core Components:**
  * `DailyMenuBoard.jsx`: ป้ายแสดงเมนูขายดีประจำวันและหมวดหมู่แบบ Carousel
  * `ShopeeSearchBar.jsx`: แถบค้นหาอัจฉริยะพร้อม Filter & Category Pills
  * `ClientQueueTicket.jsx`: ตั๋วคิวดิจิทัลสไตล์ Apple Wallet พร้อม QR Code
  * `MerchantKDS.tsx`: หน้าจอควบคุมครัวแบบ Kanban Touch-friendly (56px+ Hit Targets)
  * `StoreAdminPage.tsx`: แผงควบคุม God Mode สำหรับ Super Admin
* **Micro-interactions & UX:**
  * 1-Tap Bump พร้อม 5-Second Undo Toast ในหน้าจอครัว
  * Audio Chime แจ้งเตือนเมื่อคิวพร้อมรับอาหาร
  * Capacity Hold Timer (5 นาที) ล็อกช่วงเวลาขณะชำระเงิน

---

## ⚙️ 2. สถาปัตยกรรมฟังก์ชันและการทำงาน (Functional Architecture)
* **3-Tier Multi-Role Model:**
  1. **Customer:** สั่งอาหารล่วงหน้า, เลือกช่วงเวลารับ, รับตั๋วคิว, สะสมแต้ม Loyalty Points
  2. **Merchant:** จัดการเมนู, สต็อกเปิด-ปิดเมนูหมด, หน้าจอครัว KDS, ดูสรุปยอดขาย
  3. **Super Admin (คุณพิสิษฐ์):** ควบคุมทุกร้านค้า, จัดการผู้ใช้, แทรกแซงออเดอร์/คืนเงิน, แดชบอร์ด GMV รวม
* **Backend Infrastructure:**
  * Firebase Auth (Email & Google OAuth)
  * Cloud Firestore with Granular RBAC Security Rules (`firestore.rules`)
  * Cloud Functions for Payment Webhooks (`functions/index.js`)
  * Gemini AI Engine (`aiBehaviorEngine.js` & `SellerAssistantModal.jsx`)

---

## ✅ 3. สิ่งที่ทำเสร็จสมบูรณ์แล้ว (Completed Features)
- [x] โครงสร้างหน้าจอหลัก ลูกค้า (Homepage, Food Booking, Daily Menu Board, Search)
- [x] โครงสร้างหน้าจอร้านค้า (Merchant Dashboard, Menu Manager, KDS Kanban Board)
- [x] รวมคอมโพเนนต์ระดับเทพจากเวอร์ชันก่อนหน้าเข้ามาในโปรเจกต์ครบ 100%
- [x] วางระบบความปลอดภัย RBAC และ Firestore Security Rules
- [x] ระบบสลับบทบาทผู้ใช้ (Role Switcher) ระหว่าง Customer / Merchant / Super Admin
- [x] เอกสารสถาปัตยกรรม `MASTER_DEVELOPMENT_PLAN.md`, `SUPER_ADMIN_ARCHITECTURE.md`, `UI_UX_DESIGN_SYSTEM_GUIDE.md`
- [x] กู้คืนดีไซน์หน้าแรกกลับสู่รูปแบบเดิม (Original Look & Feel) เรียบร้อย 100%
- [x] แก้ไขระบบการปรับขนาด Fluid Responsive & Zoom Layout รองรับการกด `Ctrl +` และ `Ctrl -` (ย่อ/ขยายจอ) ขจัดปัญหาพื้นที่ว่างสีขาวใต้ Footer และขยายขนาดเนื้อหาเต็มสัดส่วนหน้าจอบนทุกระดับ Zoom/หน้าจอ Wide Screen
- [x] **Functional Update:** ผสาน QueueUp AI ภาษาธรรมชาติ (Natural Language Query: อาหารเผ็ด, ราคาไม่เกิน 50 บาท, ทำเร็วเสิร์ฟไว, ร้านยอดนิยม) เข้ากับ `ShopeeSearchBar` และ `SearchResults` เดิม โดยคงสไตล์และดีไซน์เดิม 100% พร้อมระบบจัดอันดับ Top 10 Bestsellers และ Route Navigation `/search`, `/product/:id`, `/user/purchase`, `/merchant/dashboard`, `/admin` ครบถ้วน
- [x] **Full Code Inspection & Fix:** ตรวจสอบโค้ดทุกบรรทัดทั่วทั้งโปรเจกต์ เคลียร์ Dead Variables, ปรับปรุง Type-Safety, ปรับแก้ PaymentModal Props ใน ProductDetail ให้ตรงกับยอดคำนวณจริง, และทดสอบ Build ผ่าน 100% (0 Errors)
- [x] **Fix ProductDetail Split Layout & Image Dimensions:** แก้ไขโครงสร้าง CSS ในหน้า `ProductDetail` ให้จับคู่คลาสกับ JSX ถูกต้อง (`queue-pd-main-grid`, `queue-pd-wrapper`, `queue-pd-thumb-grid`) ป้องกันรูปภาพหลักและแบนเนอร์ขยายตัวผิดสัดส่วนเต็มหน้าจอ และจัด 2 คอลัมน์ (ซ้ายรูปภาพ/ขวาฟอร์มจอง) สวยงามตาม Mockup
- [x] **Global Fluid Scaling & Sticky Footer:** ปรับใช้ระบบ Fluid Responsive (`max-width: clamp(1200px, 92vw, 1680px)`) และ Sticky Footer ข้ามทุกหน้า (`/home`, `/search`, `/product/:id`, `/user/account/profile`) รองรับการย่อ/ขยายหน้าจอ `Ctrl +` / `Ctrl -` สวยงาม ไร้พื้นที่ว่าง
- [x] **Official Production Domain:** กำหนดโดเมนหลักอย่างเป็นทางการสำหรับส่งงานและใช้งานจริงเป็น **`https://queueup-school.netlify.app`** (และ `https://queueup-school.netlify.app/home`) พร้อมไฟล์ `_redirects` สำหรับรองรับ Single Page Application (SPA) Routing บน Netlify 100%

---

## ⏳ 4. สิ่งที่ยังไม่ได้ทำ / แผนงานที่จะพัฒนาต่อ (Pending Tasks & Next Steps)
- [ ] **Phase 1 (UI/UX Polish):** ปรับจูนธีม Dark Glass และ Micro-animations ให้เนียนตา 100%
- [ ] **Phase 2 (Payment Integration):** เชื่อมต่อ PromptPay QR Code Generator และ Webhook ตรวจสอบยอดเงินอัตโนมัติ
- [ ] **Phase 3 (Real-time KDS Sync):** เชื่อม Firestore Snapshot Listener ให้คิวอัปเดตแบบ Real-time ทันทีที่แม่ค้ากดปุ่ม
- [ ] **Phase 4 (Super Admin Portal):** ตกแต่งหน้า `StoreAdminPage.tsx` สำหรับดูภาพรวมและจัดการทั้งโรงอาหาร

---

## 🚫 5. ข้อห้ามและสิ่งที่ต้องระวัง (Do's & Don'ts / Constraints)
* ⚠️ **Security Boundaries:**
  * ห้ามให้ลูกค้ายกเลิกออเดอร์หรือขอเงินคืนได้เองหลังจากที่ร้านค้ากดเปลี่ยนสถานะเป็น "กำลังปรุง (Cooking)" แล้ว
  * ห้ามข้ามสิทธิ์ Store Isolation (ร้านค้า A ห้ามเข้าถึงข้อมูลหรือยอดขายของร้านค้า B เด็ดขาด)
  * สิทธิ์แก้ไข/ลบข้ามร้าน มีเพียงบัญชี **Super Admin** ของคุณพิสิษฐ์เท่านั้น
* ⚠️ **Code Standards:**
  * แยกโค้ดเป็น Component ย่อย ห้ามเขียนไฟล์เดี่ยวขนาดยักษ์
  * เก็บค่า Secret และ API Keys ไว้ใน `.env` เสมอ ห้าม Hardcode ในไฟล์โค้ด

---

## 💡 6. ไอเดียและข้อมูลที่จะนำมาต่อยอดในอนาคต (Future Ideas & Backlog)
* **AI Menu Recommendation:** ใช้ Gemini AI วิเคราะห์ประวัติการสั่งของนักเรียนเพื่อแนะนำเมนูที่ตรงกับความชอบ
* **IoT Notification Buzzer / Display Screen:** ทำหน้าจอรวมแสดงหมายเลขคิวที่เสร็จแล้ว (แบบจอทีวีในโรงอาหาร)
* **Pre-order Grouping:** ระบบสั่งอาหารรวมเป็นกลุ่มเพื่อน จ่ายเงินแยกแต่รับพร้อมกัน
