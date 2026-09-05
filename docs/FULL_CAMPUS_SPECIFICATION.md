# 📋 เอกสารสเปคระบบ: QueueUp for Campus
### แพลตฟอร์มจองอาหาร + จัดการคิว + เศรษฐกิจนักเรียนในสถานศึกษา

---

## 1. ภาพรวมระบบ (System Overview)

**QueueUp** คือเว็บแอปพลิเคชันจองอาหารและจัดการคิวอัจฉริยะสำหรับโรงอาหาร/ศูนย์อาหาร โดยใช้โมเดล **Zero-Payment & Instant Queue** — สั่งปุ๊บรับหมายเลขคิวทันที (Q001-Q999) โดยไม่ต้องจ่ายเงินล่วงหน้าหรือแนบสลิป เพื่อลดปัญหาคอขวดตอนพักเที่ยง

**เป้าหมายการต่อยอด:** ปรับระบบให้เหมาะกับบริบทสถานศึกษาโดยเพิ่ม 3 องค์ประกอบหลัก
1. **นักเรียน/นักศึกษาขายของหารายได้** ผ่านระบบร้านค้าที่ต้องผ่านการอนุมัติ
2. **ร้านค้าสร้างฐานลูกค้าประจำ** ผ่านระบบแต้มสะสมและ Trust Score
3. **ผู้ปกครอง/ครูมองเห็นและควบคุมได้** ผ่านระบบ Wallet และ Dashboard เฉพาะทาง

---

## 2. กลุ่มผู้ใช้งานทั้งหมด (Roles)

| Role | สถานะ | หน้าที่หลัก |
|---|---|---|
| **Customer** | มีอยู่แล้ว | ค้นหา/สั่งอาหาร/ติดตามคิว |
| **Merchant** | มีอยู่แล้ว | จัดการเมนู/ครัว/สถิติ |
| **Admin** | มีอยู่แล้ว | ดูแลแพลตฟอร์มระดับบนสุด |
| **StudentVendor** | 🆕 ใหม่ | Sub-type ของ Merchant ที่ผูกกับรหัสนักเรียน + ต้องผ่านอนุมัติ |
| **Guardian (ผู้ปกครอง)** | 🆕 ใหม่ | ควบคุม Wallet + ดูประวัติการกินของบุตรหลาน |
| **StaffSupervisor (ครู/ฝ่ายปกครอง)** | 🆕 ใหม่ | อนุมัติร้านนักเรียน + มอนิเตอร์ความปลอดภัย |

---

## 3. ฟังก์ชันทั้งหมดแยกตาม Role

### 👤 3.1 Customer (ลูกค้าทั่วไป)
- ค้นหาเมนู/ร้านค้า/หมวดหมู่/โรงอาหาร
- ฟีดวิดีโอแนะนำเมนูสั้น + กระดานเมนูประจำวัน
- ปรับแต่งอาหาร: Modifier บังคับ (ความเผ็ด/เส้น) + ตัวเลือกเสริม (Topping)
- เลือกวัน-สล็อตเวลารับอาหาร + คำนวณราคาไดนามิก
- ยืนยันจองคิวแบบ Zero-Payment (ไม่ผ่าน Payment Gateway) หรือชำระผ่าน Campus Wallet
- บัตรคิวดิจิทัล + ติดตามสถานะสด 5 ขั้น: PENDING → CONFIRMED → PREPARING → READY → COMPLETED
- แชทกับร้านค้าแบบผูกกับ Order ID
- สะสมแต้ม (CRM Points x2) + คูปองส่วนลด AI

### 🍳 3.2 Merchant (ร้านค้า/แม่ค้า)
- หน้าจอครัวอัจฉริยะ (KDS) แสดงคิวเรียลไทม์ + ปุ่มเปลี่ยนสถานะ One-Click
- จัดการเมนู/สต็อก/ราคา/เปิด-ปิดสถานะสินค้าหมด
- จัดการกลุ่มตัวเลือกอาหาร (Modifier Group) + Min/Max Selection
- แดชบอร์ดสถิติยอดขาย + แคมเปญการตลาด AI

### 🛡️ 3.3 Admin (ผู้ดูแลระบบ)
- จัดการร้านค้า/พนักงานระดับแพลตฟอร์ม + กำหนด maxOrdersPerSlot
- จัดการนโยบาย PDPA และ Cookie Consent
- ตรวจจับข้อผิดพลาดระบบ (Error Boundary)

### 🎓 3.4 StudentVendor (นักเรียน/นักศึกษาผู้ขาย) — 🆕
- สมัครเปิดร้าน: ยืนยันรหัสนักเรียน + อัปโหลดเอกสารยินยอมผู้ปกครอง + รอ StaffSupervisor อนุมัติ
- Quick Setup Template: ตั้งร้านเสร็จใน 5 นาทีด้วยเทมเพลตสำเร็จรูป
- รับพรีออเดอร์ล่วงหน้าก่อนถึงคาบพัก (10-20 นาที)
- แดชบอร์ดรายได้แบบง่าย: ยอดวันนี้/สัปดาห์นี้, กำไร-ต้นทุน
- ระบบแบ่งรายได้อัตโนมัติ (กรณีขายเป็นทีม)
- Trust Score สะสมจากยอดขาย+รีวิว เพื่อดึงลูกค้าประจำ
- แจ้งเตือนสต็อกใกล้หมด

### 👨‍👩‍👧 3.5 Guardian (ผู้ปกครอง) — 🆕 หัวใจสำคัญ
- ผูกบัญชีผู้ปกครอง ↔ บุตรหลาน (ยืนยัน 2 ทาง: ผู้ปกครอง + โรงเรียน)
- เติมเงินเข้า Wallet บุตรหลานผ่าน Payment Gateway จริง
- ตั้งวงเงินใช้จ่ายรายวัน/รายสัปดาห์
- ตั้งค่าบล็อกหมวดอาหาร (เช่น น้ำอัดลม, ของทอด)
- บันทึกข้อมูลแพ้อาหาร/สุขภาพที่เกี่ยวกับอาหาร
- ดูประวัติการซื้อแบบเรียลไทม์ (อะไร/ที่ไหน/เวลาไหน/ราคา)
- รับ Push Notification ทันทีที่มีการใช้เงิน
- ดูรายงานโภชนาการสรุป
- ติดต่อ/ร้องเรียนกรณีมีปัญหา

### 👩‍🏫 3.6 StaffSupervisor (ครู/ฝ่ายปกครอง) — 🆕
- อนุมัติ/ปฏิเสธคำขอเปิดร้านของนักเรียน พร้อมกำหนดโซน/เวลาขาย
- มอนิเตอร์คิวภาพรวมทุกร้านพร้อมกัน ป้องกันความแออัด
- ค้นประวัติสั่งซื้อกรณีฉุกเฉิน (พร้อม audit log ทุกครั้งที่เข้าถึง)
- จัดการข้อร้องเรียนระหว่างผู้ซื้อ-ผู้ขาย
- ส่งประกาศ/แจ้งกฎระเบียบร้านค้า

---

## 4. โครงสร้างหน้าโดยละเอียด (Page-by-Page Specification)

> หลักการ: **1 หน้า 1 หน้าที่** — ห้ามฟังก์ชันข้าม Role ปนกัน และข้อมูลการเงินต้องแยกจากข้อมูลการสั่งซื้อเสมอ

### 🔵 ฝั่ง Customer

| หน้า | ✅ ควรมี | ❌ ไม่ควรมี |
|---|---|---|
| **Home.jsx** | ฟีดวิดีโอ, กระดานเมนูประจำวัน, ค้นหาร้าน/หมวดหมู่, สถานะร้าน (เปิด/ปิด/คิวเยอะ), แถบ Campus Hub | ปุ่มยืนยันซื้อ/payment flow, รายละเอียด modifier, ข้อมูล wallet ผู้ปกครอง |
| **ProductDetail.jsx** | Modifier บังคับ/เสริม, เลือกสล็อตเวลา, คำนวณราคาไดนามิก, แจ้งเตือนแพ้อาหาร (ถ้ามีข้อมูล) | ยืนยันคำสั่งซื้อจริง, Trust Score/รายได้ร้าน, ระบบแชทเต็มรูปแบบ |
| **FoodBooking.tsx** | ตรวจโปรไฟล์, สรุปยอด, ตัวเลือก Zero-Payment / Campus Wallet, เรียก `createOrderAuthoritative` | แก้ไขเมนู ณ จุดนี้, เขียน `/orders` ตรงจาก client, ระบบรีวิว/แชท |
| **ClientQueueTicket.jsx / UserProfile.jsx** | บัตรคิว+เสียงแจ้งเตือน, สถานะ 5 ขั้น, ประวัติคำสั่งซื้อ, แต้มสะสม | แก้ไขรายการหลังยืนยัน, wallet ของคนอื่น, อนุมัติร้าน/สถิติร้าน |
| **Chat.tsx / ChatModal.jsx** | แชทผูกกับ orderId เท่านั้น, ประวัติแชทของออเดอร์นั้น | แชทอิสระไม่ผูกออเดอร์, ส่งไฟล์/ลิงก์นอกเรื่องอาหาร |

### 🟢 ฝั่ง StudentVendor / Merchant

| หน้า | ✅ ควรมี | ❌ ไม่ควรมี |
|---|---|---|
| **StudentVendorOnboarding.tsx** 🆕 | ยืนยันรหัสนักเรียน, ข้อมูลร้าน, เลือกโซนขาย, รายการเมนูตัวอย่าง, สถานะคำขอ | เปิดร้านทันทีไม่รออนุมัติ, ฟังก์ชันจัดการเมนูก่อนอนุมัติ |
| **MerchantKDS.tsx** | คิวเรียลไทม์, ปุ่มเปลี่ยนสถานะ One-Click, เสียงแจ้งเตือน | แก้ไขราคา/สต็อก ณ หน้านี้, ข้อมูลส่วนตัวลูกค้าเกินจำเป็น |
| **MerchantMenuManager.tsx / MerchantModifierManager.tsx** | เพิ่ม/ลบ/แก้เมนู, Quick Setup Template, Modifier Group + Min/Max | สถิติยอดขายเชิงลึก, อนุมัติร้านตัวเอง |
| **StudentVendorEarnings.tsx** 🆕 | รายได้ง่ายๆ วันนี้/สัปดาห์นี้, แบ่งรายได้ทีม, Trust Score, กราฟพื้นฐาน | ข้อมูล wallet ลูกค้า, ฟีเจอร์ AI Marketing เต็มรูปแบบ |

### 🟣 ฝั่ง Guardian — 🆕 ทั้งหมด

| หน้า | ✅ ควรมี | ❌ ไม่ควรมี |
|---|---|---|
| **GuardianDashboard.tsx** | รายชื่อบุตรหลานที่ผูกบัญชี, ยอดเงินคงเหลือแต่ละคน, สลับดูบุตรหลาน, ตั้งวงเงิน, เติมเงิน, ประวัติใช้จ่าย | สั่งอาหารแทนบุตรหลาน, ข้อมูลนักเรียนที่ไม่ได้ผูกบัญชี |
| **WalletTopUp.tsx** | เติมเงินผ่าน Payment Gateway จริง, ประวัติเติมเงิน | สั่งอาหาร/ดูเมนู, แสดงยอดใช้จ่ายละเอียด |
| **SpendingLimitSetting.tsx** | วงเงินรายวัน/สัปดาห์, บล็อกหมวดอาหาร, Toggle เปิด-ปิด | แก้ยอดเงินคงเหลือตรง, ตั้งค่ากระทบร้านค้า |
| **ChildOrderHistory.tsx** | ประวัติซื้อเรียลไทม์, Export รายงานโภชนาการ | ยกเลิก/แก้ไขออเดอร์แทนบุตรหลาน, ข้อมูลแชทส่วนตัว |
| **AllergyAlertSetting.tsx** | บันทึกแพ้อาหาร/โรคที่เกี่ยวกับการกิน | ข้อมูลสุขภาพทั่วไปที่ไม่เกี่ยวกับอาหาร |

### 🟠 ฝั่ง StaffSupervisor — 🆕 ทั้งหมด

| หน้า | ✅ ควรมี | ❌ ไม่ควรมี |
|---|---|---|
| **VendorApprovalPanel.tsx** | คำขอเปิดร้าน, อนุมัติ/ปฏิเสธพร้อมเหตุผล, กำหนดโซน/เวลา | แก้เมนู/ราคาร้านโดยตรง, ข้อมูล wallet นักเรียน |
| **CampusQueueMonitor.tsx** | ภาพรวมคิวทุกร้าน (Split Screen: PREPARING vs READY), แจ้งเตือนคิวสด | เปลี่ยนสถานะออเดอร์แทนร้านค้า |
| **EmergencyLookup.tsx** | ค้นประวัติสั่งซื้อกรณีฉุกเฉิน + audit log ทุกครั้ง, เฉพาะข้อมูลอาหาร/แพ้ | เข้าถึงอิสระไม่มีเหตุผล, ข้อมูลการเงิน/ยอดเติมเงิน |

### 🔴 ฝั่ง Admin

| หน้า | ✅ ควรมี | ❌ ไม่ควรมี |
|---|---|---|
| **StoreAdminPage.tsx** | อนุมัติร้านระดับแพลตฟอร์ม, ตั้ง maxOrdersPerSlot, ภาพรวม transaction | อนุมัติร้านนักเรียนรายบุคคล (สิทธิ์ StaffSupervisor), เข้าถึงแชทส่วนตัว |
| **PdpaPolicy.jsx / CookieConsentBanner.jsx** | นโยบายยินยอมข้อมูล, จัดการคุกกี้ | ฟังก์ชันอื่นที่ไม่เกี่ยวกับ consent |

---

## 5. โครงสร้างฐานข้อมูล (Firestore Data Model)

### เดิม (มีอยู่แล้ว)
```
/shops/{storeId}          → ข้อมูลร้าน, เวลาเปิด-ปิด, maxOrdersPerSlot
/products/{productId}     → เมนู, ราคา, stock, modifierGroupIds
/modifier_groups/{groupId}→ กลุ่มตัวเลือก, selectionType, min/maxSelections
/store_slots/{slotId}     → โควตาคิวต่อสล็อตเวลา
/queue_counters/{counterId}→ ตัวนับคิวรายวัน
/orders/{orderId}         → คำสั่งซื้อ, status, paymentStatus: ZERO_PAYMENT | PAID
```

### ใหม่ (ต้องเพิ่ม) 🆕
```
/students/{studentId}            → name, class, guardianIds[], allergyInfo, healthNotes
/parent_child_links/{linkId}     → guardianId, studentId, verifiedByGuardian, verifiedBySchool, status
/wallets/{studentId}             → balance, dailyLimit, weeklyLimit, blockedCategories[]
/wallet_transactions/{txId}      → walletId, orderId, amount, type('topup'|'spend'), timestamp
/vendor_approvals/{requestId}    → studentVendorId, shopName, requestedZone, status, approvedBy, approvedAt
/staff_supervisors/{staffId}     → name, role, assignedZones[]
/audit_logs/{auditId}            → action, actorUid, targetStudentId, reason, timestamp
```

---

## 6. Workflow เต็มระบบ (End-to-End)

### 6.1 การเปิดร้านของนักเรียน
```
นักเรียนกรอก StudentVendorOnboarding.tsx
    → ส่งคำขอ + รายการเมนูตัวอย่าง
    → เขียนลง /vendor_approvals (status: PENDING)
    → StaffSupervisor เห็นใน VendorApprovalPanel.tsx
        ├─ อนุมัติ → ออก Custom Claim student_vendor + สร้าง /shops/shop_{studentVendorId}
        └─ ปฏิเสธ → แจ้งเหตุผลกลับนักเรียน
```

### 6.2 การสั่งอาหาร (ต่อยอดจาก ACID Transaction เดิม)
```
ลูกค้าเลือกเมนูใน ProductDetail.jsx
    → กด "จองคิว" ใน FoodBooking.tsx
    
[ก่อนเข้า createOrderAuthoritative เดิม]
Phase 0: validateWalletSpending
    ├─ เช็ก dailyLimit/weeklyLimit เกินหรือไม่
    ├─ เช็ก blockedCategories ตรงกับเมนูหรือไม่
    └─ เช็ก allergyInfo ตรงกับส่วนผสมหรือไม่
    
[createOrderAuthoritative เดิม - ACID Transaction]
Phase 1: Read ร้านค้า, สต็อก, โควตาสล็อต, Counter คิว
Phase 2: Validate วัน/เวลา + คำนวณราคา
Phase 3: Write ตัดสต็อก + หักโควตา + ออกเลขคิว

Phase 4: หักเงินจาก /wallets/{studentId}
    → บันทึก /wallet_transactions (Immutable Ledger)
    → Push Notification ไปที่ Guardian ทันที

[Real-Time Firestore Event]
    ├─ MerchantKDS: เสียงเตือนออเดอร์ใหม่
    ├─ ClientQueueTicket: ตั๋วคิวพร้อมเสียงเตือน
    ├─ CampusQueueMonitor: อัปเดตขึ้นจอโรงอาหารทันที
    └─ GuardianDashboard: อัปเดตยอดเงิน+ประวัติทันที
```

---

## 7. Security Rules (Invariant)

| กฎ | เหตุผล |
|---|---|
| `allow create: if false;` บน `/orders` | ต้องผ่าน Cloud Function เท่านั้น ห้าม client เขียนตรง (เดิม) |
| `allow write: if false;` บน `/wallets/{studentId}` | ห้ามแก้ยอดเงินตรงจาก client ต้องผ่าน Cloud Function เท่านั้น 🆕 |
| `allow write: if false;` บน `/wallet_transactions` | สมุดบัญชีบันทึกรายรับ-รายจ่าย ห้ามแก้ไขหรือลบ 🆕 |
| `allow read: if request.auth.uid in resource.data.guardianIds` | ผู้ปกครองอ่านได้เฉพาะ wallet บุตรหลานตัวเอง 🆕 |
| `allow create: if false;` (approve field) บน `/vendor_approvals` | ต้องผ่าน StaffSupervisor Function เท่านั้น ป้องกันปลอมสถานะ 🆕 |
| Fail-Closed Slot Capacity | ไม่ระบุ maxOrdersPerSlot → บล็อกทันที (เดิม) |
| Fail-Closed Wallet Check | ไม่ระบุ dailyLimit → บล็อกการสั่งซื้อทันที 🆕 |
| Real Bangkok Calendar Validation | บล็อกวันที่ไม่มีจริง + เวลาที่ผ่านไปแล้ว (เดิม) |
| Audit Log บน EmergencyLookup | บันทึกทุกครั้งที่ StaffSupervisor เข้าถึงประวัติฉุกเฉิน 🆕 |

---

## 8. หลักการออกแบบหลัก (Core Design Principles)

| หลักการ | รายละเอียด |
|---|---|
| **1 หน้า 1 หน้าที่** | FoodBooking ไม่แก้เมนู, ChildOrderHistory ไม่ยกเลิกออเดอร์ |
| **แยกข้อมูลการเงินจากการสั่งซื้อ** | Wallet เขียนผ่าน Cloud Function เท่านั้น |
| **สิทธิ์ตาม Role ไม่ overlap** | ครูอนุมัติร้าน ≠ แก้เมนู, ผู้ปกครองดู ≠ สั่งแทน |
| **Audit Log สำหรับข้อมูลอ่อนไหว** | โดยเฉพาะ EmergencyLookup |
| **Fail-Closed by Default** | ไม่มีการตั้งค่า = บล็อกทันที ไม่ใช่ปล่อยผ่าน |

---

## 9. สรุปสถานะการพัฒนา (Implementation Status)

- [x] **Phase 1 (Data & Rules):** `src/types/campus.ts`, `firestore.rules` (7/7 security tests pass)
- [x] **Phase 2 (Student Vendor):** `StudentVendorOnboarding.tsx`, `VendorApprovalPanel.tsx`, Cloud Functions
- [x] **Phase 3 (Wallet Engine):** `functions/index.js` (`validateWalletSpending`, Phase 0-4 Ordering), `src/services/campusWalletService.ts`
- [x] **Phase 4 (Guardian & Monitor):** `GuardianDashboard.tsx`, `EmergencyLookup.tsx`, `CampusQueueMonitor.tsx`, `FoodBooking.tsx`
- [x] **Full Verification:** 98/98 unit & integration tests pass (100%), 0 TypeScript errors, Vite build successful, pushed to `origin/main` (Commit `c2c6cde`).
