# รายงานตรวจสอบสถาปัตยกรรมระบบ QueueUp (Verified Architecture Audit)

> เอกสารนี้คือผลการ **ตรวจสอบจากโค้ดจริง** ในคอมมิต `7b45bd0` (branch `main`)
> ทุกตัวเลขและทุกข้อความในเอกสารนี้ผ่านการรันคำสั่งจริงหรืออ่านไฟล์จริงแล้ว
> วันที่ตรวจสอบ: 26 กันยายน 2026
>
> **สถานะการแก้ไข:** Sprint 1 และ Sprint 2 ดำเนินการเสร็จแล้ว — ดู
> [ส่วนที่ 6 — สถานะการแก้ไข](#ส่วนที่-6--สถานะการแก้ไข-remediation-status)
> ข้อค้นพบทั้งหมดในส่วนที่ 3 ยังคงไว้ตามเดิมเพื่อเป็นบันทึกว่าพบอะไรและแก้อย่างไร

---

## ส่วนที่ 0 — สรุปผู้บริหาร (Executive Summary)

| หัวข้อ | สถานะ |
|---|---|
| โครงสร้างโค้ดตรงกับรายงานเดิม | ⚠️ ตรงประมาณ 80% มีจุดคลาดเคลื่อน 18 จุด |
| Production Build | ✅ ผ่าน (1.77 วินาที) |
| TypeScript Type Check | ✅ ผ่าน 0 error (ต้องติดตั้ง dependencies ก่อน) |
| Unit Tests | ⚠️ 77/77 ผ่าน **เฉพาะเมื่อ `TZ=Asia/Bangkok`** / 75/77 บนเซิร์ฟเวอร์ UTC → ✅ **111/111 ผ่านทุกโซนเวลา** |
| `npm install` บน clean clone | ❌ **ล้มเหลว** (peer dependency conflict) → ✅ **แก้แล้ว** |
| ความปลอดภัยชั้น API | ❌ **มีช่องโหว่ระดับวิกฤต 6 จุด** รวมถึงถอนเงินได้โดยไม่ต้องล็อกอิน → ✅ **แก้แล้ว** |
| ความปลอดภัยชั้น Firestore Rules | ⚠️ Multi-tenant isolation รั่ว 4 จุด → ✅ **แก้แล้ว** |
| ความพร้อม Deploy จริง | ❌ ยังไม่พร้อม ต้องแก้ P0 ทั้งหมดก่อน → ✅ **P0/P1 แก้ครบแล้ว** |

**ข้อสรุป:** แกนสถาปัตยกรรม (Authoritative Pricing, Capacity Engine, ACID Transaction, State Machine, Double-entry Ledger) **ออกแบบมาดีและทำงานถูกต้องจริง** แต่ **ชั้นบังคับใช้สิทธิ์ (Authorization Layer) ยังไม่ได้ถูกต่อเข้ากับ API** ทำให้ตรรกะที่ดีเหล่านั้นถูกข้ามได้ทั้งหมดด้วย `curl` คำสั่งเดียว

---

## ส่วนที่ 1 — ผลตรวจสอบความถูกต้องของรายงานเดิม

### 1.1 ข้อที่รายงานเดิมระบุ "ถูกต้อง" ✅

| ข้อความในรายงาน | ผลตรวจสอบ |
|---|---|
| React 19 + TypeScript + Vite + Tailwind v4 | ✅ ถูกต้อง (react 19.0.1, vite 8.3.1, tailwindcss 4.3.3) |
| Firebase v11 → **จริงคือ v12.19.0** | ⚠️ เลขเวอร์ชันคลาดเคลื่อน |
| Authoritative Order Creation คำนวณราคาฝั่งเซิร์ฟเวอร์ | ✅ ถูกต้องจริง `orderRoutes.js` โหลดราคาจาก Firestore คำนวณเป็นสตางค์ (integer) ไม่เชื่อราคาจาก client |
| Idempotency ป้องกันสั่งซ้ำ | ✅ ถูกต้อง มี 3 ชั้น (`idempotency_records`, `reservationId`, order existence) |
| Firestore ACID Transaction ป้องกัน Race Condition | ✅ ถูกต้อง `slotTransactionService.js` ใช้ `runTransaction` จริง ทดสอบผ่าน 25/25 |
| Capacity Engine แบบ Workload Points + Lazy Expiration | ✅ ถูกต้อง เป็น pure function ไม่มี I/O ทดสอบผ่าน 38/38 |
| AI Chat Engine แบบ Deterministic Layer 1 + Guards | ✅ ถูกต้อง ทดสอบผ่าน 14/14 |
| Double-entry Ledger | ✅ ถูกต้อง `ledgerService.js` + collection `ledger_entries` |
| State Machine ของ Order | ✅ ถูกต้อง `VALID_TRANSITIONS` 11 สถานะใน `orderRoutes.js:15` |
| ScrollToTop บังคับ Top-to-Bottom | ✅ ถูกต้อง มีไฟล์และถูกเรียกใช้จริง |
| Tenant Boundary check ตอนสั่งอาหาร | ✅ มีจริง `orderRoutes.js:100` (แต่ใช้ header ที่ client ปลอมได้ — ดูข้อ P0-7) |

### 1.2 ข้อที่รายงานเดิม **คลาดเคลื่อนจากโค้ดจริง** ❌

| # | รายงานเดิมบอกว่า | ความจริงในโค้ด | หลักฐาน |
|---|---|---|---|
| 1 | Express Server **Port 5000** | Port **3000** (fallback 8080 → 8081) | `server.js:110` |
| 2 | Vite proxy `/api` → **5000** | proxy `/api` → **8080** | `vite.config.ts:22` |
| 3 | `server.js` ติดตั้ง **CORS** middleware | **ไม่มี CORS เลย** และไม่มีแพ็กเกจ `cors` ใน dependencies | `server.js` ทั้งไฟล์ |
| 4 | `server.js` มี **Error Handler** | มีแค่ `process.on('uncaughtException')` ไม่มี Express error middleware | `server.js:117-123` |
| 5 | API `/api/payments`, `/api/merchants`, `/api/wallets`, `/api/notifications` | จริงคือ `/api/payment`, `/api/merchant`, `/api/merchant` (wallet ซ้อนใน merchant), `/api` | `server.js:45-51` |
| 6 | Auth & **RBAC Middleware** บังคับใช้ | `requireRole()` ถูกเขียนไว้แต่ **ไม่เคยถูกเรียกใช้ในไฟล์ไหนเลย** (0 usage) | `authenticate.js:115` |
| 7 | Collection ชื่อ **`store_capacities`** (ในผังสถาปัตยกรรม) | ชื่อจริงคือ **`pickup_slots`** | `slotTransactionService.js` |
| 8 | Firebase Client Config อ่านจาก **`.env`** | อ่านจาก **`firebase-applet-config.json` ที่ commit ลง repo** ตัวแปร `VITE_FIREBASE_*` ไม่ถูกใช้เลย | `src/config/firebase.ts:11` |
| 9 | **17 เส้นทาง** ใน Routing | **30 `<Route>` / 26 path ไม่ซ้ำ** | `src/App.tsx` |
| 10 | Tests **77/77 (100%)** | 77/77 **เฉพาะ `TZ=Asia/Bangkok`**; บน UTC = **75/77** และ `npm test` exit code 1 | รันจริง |
| 11 | `chatRoutes.test.js` เป็นส่วนหนึ่งของชุดทดสอบ | **ไม่อยู่ใน `npm test`** และตัวนับพิมพ์ผิดเป็น "6/5 Passed" | `package.json:13` |
| 12 | ร้านค้า **18 ร้าน + เมนูกว่า 100 รายการ** | ร้าน **18 ร้าน ✅** แต่เมนูมีจริง **46 รายการ** | `mockData.ts:25,530` |
| 13 | `PdpaPolicyModal` อยู่ใน `src/components/common/` | อยู่ที่ `src/components/` (ไม่อยู่ใน common) | โครงสร้างไฟล์ |
| 14 | `ProtectedRoute.tsx` ตรวจสอบสิทธิ์ตาม Role | **Dead code — ไม่ถูก import ที่ไหนเลย** (App.tsx ใช้ ternary แทน) | grep 0 references |
| 15 | `PageRouteLoader.tsx` แสดงแอนิเมชันโหลด | **Dead code — 0 references** | grep |
| 16 | รายงานไม่ได้กล่าวถึง | มีไฟล์เพิ่มที่ไม่อยู่ในรายงาน: `RegisterModal.tsx` (1,076 บรรทัด), `MerchantWalletTab.tsx`, `AccountSettingsModal.tsx`, `CreateStoreModal.tsx`, `HelpSupportModal.tsx`, `IconButton.tsx`, `pilotLeadService.js` | โครงสร้างไฟล์ |
| 17 | รายงานไม่ได้กล่าวถึง | มีหน้าเก่าซ้ำซ้อน: `src/pages/Login.jsx`, `ProductDetail.jsx`, `SearchResults.jsx`, `UserProfile.jsx`, `LandingPage.tsx` (ซ้ำกับ `customer/LandingPage.tsx`) | โครงสร้างไฟล์ |
| 18 | README: Testing = **Vitest**, DB = **SQLite**, dev port **5173** | ไม่มี Vitest / ไม่มี SQLite ใน dependencies; dev port คือ **3000** | `package.json`, `vite.config.ts` |

---

## ส่วนที่ 2 — ผลรันจริง (Verification Matrix)

| คำสั่ง | ผลลัพธ์จริง | หมายเหตุ |
|---|---|---|
| `npm install` | ❌ **ล้มเหลว** `ERESOLVE` | `esbuild@^0.25.0` (devDep) ชนกับ peer `esbuild@^0.27.0 \|\| ^0.28.0` ของ `vite@8.3.1` |
| `npm install --legacy-peer-deps` | ✅ สำเร็จ | วิธีแก้ชั่วคราว |
| `npx tsc --noEmit` | ✅ **0 error** | ตรงกับรายงานเดิม |
| `npm run build` | ✅ ผ่าน **1.77s** | 1,784 modules |
| ขนาด bundle | ⚠️ **2,576 KB** (gzip 660 KB) ไฟล์เดียว | ไม่มี code splitting — vite เตือนเอง |
| `npm test` (TZ=UTC, ค่าเริ่มต้นของ Cloud Run/Docker) | ❌ **75/77** exit 1 | หยุดที่ suite แรก |
| `npm test` (TZ=Asia/Bangkok) | ✅ **38/38 + 25/25 + 14/14 = 77/77** | ตรงกับรายงานเดิมเฉพาะกรณีนี้ |
| `node server/tests/chatRoutes.test.js` | ⚠️ ผ่าน แต่พิมพ์ "6/5 Passed" | ตัวนับ assert ผิด |

### สถิติโค้ดฐานจริง
- TypeScript/TSX ใน `src/`: **98 ไฟล์**
- JavaScript/JSX ใน `src/`: **13 ไฟล์** (ส่วนใหญ่เป็นของเก่า)
- Backend `server/`: **24 ไฟล์**
- รวมบรรทัดโค้ด `src/` + `server/`: **45,502 บรรทัด**
- Components 49 ไฟล์ / Pages 22 ไฟล์ / Services 20 ไฟล์
- ไฟล์ใหญ่สุด: `QueueContext.tsx` **3,291 บรรทัด** (ควรแตกไฟล์)

---

## ส่วนที่ 3 — ช่องโหว่และข้อบกพร่องที่ต้องแก้ (เรียงตามความรุนแรง)

### 🔴 P0 — วิกฤต (ต้องแก้ก่อน Deploy จริงเด็ดขาด)

#### P0-1 · ถอนเงินร้านค้าได้โดยไม่ต้องล็อกอิน
`server/routes/walletRoutes.js:128`
```js
walletRouter.post('/payouts', optionalAuthenticate, async (req, res) => {
  const { storeId, amountSatang, bankAccountSnapshot } = req.body;
  // ...ไม่มีการตรวจสอบว่า req.user เป็นเจ้าของ storeId นี้หรือไม่
  requestedBy: req.user?.uid || 'merchant-owner',
```
**ผลกระทบ:** ใครก็ได้ยิง `POST /api/merchant/payouts` พร้อม `storeId` ของร้านใดก็ได้ และ `bankAccountSnapshot` เป็นบัญชีตัวเอง → ดูดเงินออกจากร้านทุกร้านในระบบ
**วิธีแก้:** `requireRole(['merchant'])` + ตรวจสอบ `stores/{storeId}.ownerId === req.user.uid` ภายใน transaction

#### P0-2 · Mock Authentication Bypass เปิดใช้งานอยู่บน Production
`server/middleware/authenticate.js:11, 49, 74`
```js
if (process.env.NODE_ENV !== 'production' && req.headers['x-mock-user-id']) {
  req.user = { uid: ..., role: req.headers['x-mock-user-role'] || 'customer',
               admin: req.headers['x-mock-user-role'] === 'admin' };
  return next();   // ← ข้ามการตรวจ Firebase Token ทั้งหมด
}
```
**ปัญหา:** ในโปรเจกต์ **ไม่มี Dockerfile / vercel.json / .yaml ที่ตั้ง `NODE_ENV=production` เลย** และ `npm start` ก็ไม่ได้ตั้งให้ → บน Cloud Run / Vercel / Render ค่านี้จะเป็น `undefined` แปลว่าเงื่อนไขเป็นจริง
**ผลกระทบ:** ส่ง header `x-mock-user-id: 1` + `x-mock-user-role: admin` = ได้สิทธิ์ผู้ดูแลระบบสูงสุดทันที
**วิธีแก้:** เปลี่ยนเป็น opt-in ชัดเจน เช่น `process.env.ALLOW_MOCK_AUTH === 'true'` และตั้ง `NODE_ENV=production` ในสคริปต์ `start`

#### P0-3 · RBAC ถูกเขียนไว้แต่ไม่เคยถูกใช้
`server/middleware/authenticate.js:115` — ฟังก์ชัน `requireRole()` มี **0 การเรียกใช้** ในทั้งโปรเจกต์
**ผลกระทบ:** ผังสถาปัตยกรรมระบุว่ามี "Auth & RBAC Middleware" กั้นอยู่ แต่จริง ๆ ไม่มีชั้นนี้เลย

#### P0-4 · วงจรชีวิตออเดอร์ควบคุมได้โดยไม่ต้องยืนยันตัวตน
`server/routes/merchantRoutes.js` — ทั้ง 4 endpoint (`accept`, `reject`, `ready`, `complete`) ใช้ `optionalAuthenticate` และ**ไม่ตรวจสอบว่าผู้เรียกเป็นเจ้าของร้านของออเดอร์นั้น**
**ผลกระทบ:** ใครก็ได้กดรับ/ปฏิเสธ/ปิดออเดอร์ของร้านอื่นได้ทั้งหมด รวมถึง trigger การ settle เงินเข้ากระเป๋าร้าน

#### P0-5 · ปลอมตัวเป็นร้านค้าในห้องแชทได้
`server/routes/chatRoutes.js:147`
```js
const { senderRole = 'customer', senderId, message } = req.body;  // ← มาจาก client
```
**ผลกระทบ:** `firestore.rules` ล็อก `senderRole in ['customer','merchant']` ไว้ดีแล้ว **แต่ Admin SDK ข้าม rules ทั้งหมด** → ยิง API ด้วย `senderRole: 'merchant'` ก็ส่งข้อความในนามร้านค้าได้ ขัดกับข้ออ้าง "Anti-Takeover Chat Rules" ในรายงานเดิม
**วิธีแก้:** กำหนด `senderRole` จาก `req.user.role` ที่ผ่านการ verify แล้วเท่านั้น ห้ามอ่านจาก body

#### P0-6 · กุญแจลับ HMAC ถูก hardcode
`server/routes/orderRoutes.js:12` และ `server/routes/merchantRoutes.js:16`
```js
const HMAC_SECRET = process.env.HMAC_SECRET || 'queueup-pin-secret-key-2026';
```
**ผลกระทบ:** ค่านี้อยู่ใน repo สาธารณะ → คำนวณ PIN รับอาหาร 4 หลักของออเดอร์ใดก็ได้ล่วงหน้า แล้วไปรับอาหารแทนเจ้าของออเดอร์
**วิธีแก้:** ตัด fallback ออก ให้ throw ตอน boot ถ้าไม่มี env

#### P0-7 · ตัวตนผู้ใช้และสังกัดสถาบันปลอมได้ผ่าน header
`server/routes/orderRoutes.js:47, 100`
```js
const customerId = req.user?.uid || req.headers['x-customer-id'] || 'guest-user';
const customerSchoolId = req.user?.schoolId || req.headers['x-customer-school-id'];
```
**ผลกระทบ:** Tenant Isolation ข้ามได้ด้วยการไม่ส่ง header หรือส่ง schoolId ให้ตรงร้านเป้าหมาย

---

### 🟠 P1 — สูง (Data Isolation / ความถูกต้องของข้อมูล)

#### P1-1 · `firestore.rules`: ร้านค้าคนไหนก็แก้เมนูร้านอื่นได้
```
match /menu_items/{menuItemId} {
  allow write: if isSuperAdmin() || (isAuthenticated() && request.auth.token.role == 'merchant');
}
```
ไม่ผูกกับ `storeId` เลย → merchant คนใดก็ได้แก้/ลบ/เปลี่ยนราคาเมนูของทุกร้านในระบบ
**แก้:** เพิ่มเงื่อนไข `get(/databases/$(database)/documents/stores/$(request.resource.data.storeId)).data.ownerId == request.auth.uid`

#### P1-2 · `firestore.rules`: merchant อ่านออเดอร์ได้ทุกร้าน ทุกสถาบัน
```
allow read: if ... || request.auth.token.role == 'merchant' || ...
```
เงื่อนไขนี้ไม่ผูก `storeId` → ทำลาย Multi-tenant Isolation ที่รายงานเดิมอ้างไว้

#### P1-3 · `firestore.rules`: merchant อ่าน/แก้ห้องแชทได้ทุกห้อง
กฎ `chats` ทั้ง read / create / update มี `|| request.auth.token.role in ['merchant','admin']` เป็นทางลัด → ขัดกับข้ออ้าง "เขียนได้เฉพาะห้องที่มี UID ใน participantIds"

#### P1-4 · `school_members` เปิดให้ผู้ใช้ที่ล็อกอินแล้วอ่านได้ทั้งหมด (PDPA)
```
match /school_members/{memberId} { allow read: if isAuthenticated(); }
```
เอกสารนี้เก็บ `fullName`, `email`, `identifier` (รหัสนักศึกษา) → **ผู้ใช้คนใดก็ได้ดึงรายชื่อนักศึกษาทั้งสถาบันได้** เป็นความเสี่ยง PDPA โดยตรง ขัดกับหน้า PdpaPolicyModal ที่ระบบมีอยู่
**แก้:** จำกัดให้อ่านได้เฉพาะเอกสารที่ `email == request.auth.token.email` หรือผู้ที่เป็น school admin ของ `schoolId` นั้น

#### P1-5 · บั๊ก Timezone ในแกน Capacity Engine
`server/services/capacityService.js:370-395` — `resolveCurrentSlot()` ใช้ `getFullYear()/getHours()/getMinutes()` ซึ่งอิง **timezone ของเซิร์ฟเวอร์**
```
ทดสอบเวลา 12:08 (+07:00)  →  TZ=Asia/Bangkok ได้ slot "12:00-12:15" ✅
                             TZ=UTC          ได้ slot "05:00-05:15" ❌
```
**ผลกระทบ:** Cloud Run / Vercel / Docker ใช้ UTC เป็นค่าเริ่มต้น → `slotId` ที่เซิร์ฟเวอร์สร้าง (`2026-09-26_05-00`) ไม่ตรงกับรอบเวลาที่ผู้ใช้เห็น (12:00) ทำให้โควตาครัวถูกจองผิดช่อง และข้ามวันผิดพลาดช่วงหลัง 17:00 น. ไทย
**แก้:** ตรึงเป็น `Asia/Bangkok` ด้วย `Intl.DateTimeFormat` หรือคำนวณ offset ชัดเจน แล้วเพิ่ม test ที่รันภายใต้ `TZ=UTC`

#### P1-6 · เซิร์ฟเวอร์ silently fallback ไปใช้ไฟล์ JSON แทน Firestore
`server/firebaseAdmin.js:25-26, 69`
```js
const useLiveAdmin = hasServiceAccountFile || isCloudRun;   // isCloudRun ดูจาก K_SERVICE / GAE_ENV
...
if (!adminDb) { console.log('[FirebaseAdmin] Local development mode active: ...'); }
```
**ผลกระทบ:** ถ้า deploy บน **Vercel / Render / Railway / Fly / VM ธรรมดา** (ซึ่งไม่ตั้ง `K_SERVICE`) และลืมตั้ง `GOOGLE_APPLICATION_CREDENTIALS` → ระบบ **บูตผ่านปกติ** แต่เขียนออเดอร์/การชำระเงิน/ยอดกระเป๋าเงินลง `.local_db.json` บนดิสก์ชั่วคราว **ข้อมูลหายทุกครั้งที่ restart** และแจ้งแค่ `console.log` ไม่ใช่ error
**แก้:** ถ้า `NODE_ENV === 'production'` แล้วไม่มี credential → `process.exit(1)` พร้อมข้อความชัดเจน

#### P1-7 · Service Worker ชี้ไปคนละโปรเจกต์ Firebase → Push ใช้ไม่ได้
| ไฟล์ | projectId |
|---|---|
| `firebase-applet-config.json` (ตัวแอป) | `queueup-65e82` |
| `public/firebase-messaging-sw.js` (ตัว Push) | **`numeric-citron-7mn89`** |

`messagingSenderId` ก็คนละค่า (`324920233384` vs `342098953506`)
**ผลกระทบ:** FCM token ที่ SW ลงทะเบียนเป็นของอีกโปรเจกต์ → Admin SDK ของ `queueup-65e82` ส่ง push ไม่ถึงเครื่องผู้ใช้ **ระบบแจ้งเตือนทั้งหมดใช้งานไม่ได้จริง**
**แก้:** sync ค่าให้ตรงกัน หรือ generate SW ตอน build จากไฟล์ config เดียว

---

### 🟡 P2 — ปานกลาง (Ops / Performance / คุณภาพโค้ด)

| # | ปัญหา | ตำแหน่ง | ผลกระทบ |
|---|---|---|---|
| P2-1 | `npm install` ล้มเหลวบน clean clone | `package.json` devDep `esbuild@^0.25.0` | คนอื่น clone แล้วรันไม่ได้ — **ลบ `esbuild` ออกได้เลย เพราะ vite มีในตัว** |
| P2-2 | `GET /api/merchant/orders` ดึง **ทั้ง collection** แล้วกรองใน JS | `merchantRoutes.js:29` `adminDb.collection('orders').get()` | ค่าอ่าน Firestore พุ่ง + ช้าลงเรื่อย ๆ ตามจำนวนออเดอร์ ควรใช้ `.where('storeId','==',storeId)` (มี index รองรับแล้วใน `firestore.indexes.json`) |
| P2-3 | Bundle 2.58 MB ก้อนเดียว | `vite.config.ts` | แอปใช้บนมือถือในโรงอาหาร เน็ตช้า → ควรทำ `React.lazy()` แยก KDS / Admin / Queueup landing ออก |
| P2-4 | Port ชนกันตอน dev | `vite.config.ts:20` port 3000 แต่ proxy ไป 8080, `server.js:110` default 3000 | รัน `npm run dev` + `npm start` พร้อมกันจะชนกัน และ proxy จะชี้ผิด |
| P2-5 | Stripe secret fallback เป็น `'dummy_stripe_secret_key'` | `paymentRoutes.js:12`, `merchantRoutes.js:14`, `webhookRoutes.js:11` | ระบบชำระเงินพังเงียบ ๆ แทนที่จะ fail fast |
| P2-6 | `@google/genai` เป็น dependency แต่ **ไม่เคยถูก import** | `package.json` | AI Layer 2 (LLM Tool Calling) ที่เขียนไว้ใน header ของ `aiChatEngine.js` **ยังไม่ถูกสร้าง** — ปัจจุบันเป็น Layer 1 deterministic ล้วน |
| P2-7 | `securityShield.ts` (กัน XSS/Prompt Injection) อยู่ **ฝั่ง frontend เท่านั้น** | `src/services/engines/securityShield.ts` | ยิง API ตรงด้วย curl ข้ามได้หมด ต้องย้าย/ทำซ้ำฝั่ง server ใน `chatRoutes.js` |
| P2-8 | ไม่มี CORS middleware | `server.js` | ถ้าแยก host frontend/backend จะเรียก API ไม่ได้ |
| P2-9 | ไม่มี Rate Limiting ทุก endpoint | ทั้งโปรเจกต์ | เสี่ยง brute-force PIN / spam order / ค่า Firestore บานปลาย |
| P2-10 | Dead code | `ProtectedRoute.tsx`, `PageRouteLoader.tsx`, `Skeleton.tsx`, `requireRole()` | 0 references — ควรใช้จริงหรือลบทิ้ง |
| P2-11 | ไฟล์หน้าเก่าซ้ำซ้อน | `src/pages/{Login,ProductDetail,SearchResults,UserProfile}.jsx`, `src/pages/LandingPage.tsx` | สับสนกับเวอร์ชัน `.tsx` ใน `customer/` |
| P2-12 | `QueueContext.tsx` 3,291 บรรทัด | `src/context/` | ควรแยกเป็น CartContext / ChatContext / StoreDataContext |
| P2-13 | `chatRoutes.test.js` ไม่อยู่ใน `npm test` + ตัวนับพิมพ์ "6/5" | `package.json:13` | ชุดทดสอบไม่ครอบคลุมจริงตามที่รายงาน |
| P2-14 | README ไม่ตรงความจริง | `README.md` | ระบุ Vitest / SQLite / port 5173 / `npm install` ซึ่งทั้งหมดไม่ถูกต้อง |
| P2-15 | `pickup_slots`, `merchant_balances`, `payout_requests`, `ledger_entries` ฯลฯ ไม่มีใน `firestore.rules` | `firestore.rules` | ตกไปที่ catch-all deny (ปลอดภัยโดยบังเอิญ ✅) แต่ควรประกาศ `allow read, write: if false;` ให้ชัดเจนเป็นเอกสาร |

---

## ส่วนที่ 4 — โครงสร้างระบบฉบับตรวจสอบแล้ว (Verified Structure)

### 4.1 ผังสถาปัตยกรรมที่ถูกต้อง

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND — React 19.0.1 + TS + Vite 8.3.1 + Tailwind 4.3.3 │
│  dev: :3000  ·  build: dist/ (2.58 MB single chunk)         │
│                                                              │
│  App.tsx (30 <Route> / 26 paths)                            │
│    └─ AuthContext · QueueContext(3,291 บรรทัด) ·            │
│       CampusContext · PreferencesContext · ToastContext      │
│         └─ engines/ (frontend mirror — ไม่ใช่ชั้นบังคับใช้)  │
│            aiChatEngine · allergenGuard ·                    │
│            securityShield · slotHelper                       │
└───────────────┬─────────────────────────┬───────────────────┘
                │ apiClient (/api → :8080)│ Firebase SDK v12 (อ่านตรง)
                ▼                         ▼
┌──────────────────────────────┐   ┌──────────────────────────┐
│ BACKEND — Express 4 (:3000)  │   │  Cloud Firestore          │
│ server.js                    │   │  + firestore.rules        │
│                              │   │  (13 match + catch-all)   │
│ /api/webhooks  ← raw body    │   └──────────────────────────┘
│ /api/orders    ← orderRoutes │              ▲
│ /api/payment   ← paymentR.   │              │ Firebase Admin SDK
│ /api/merchant  ← merchantR.  │──────────────┘ (ข้าม rules ทั้งหมด)
│ /api/merchant  ← walletR.    │
│ /api/capacity  ← capacityR.  │   ⚠️ fallback → .local_db.json
│ /api/chat      ← chatRoutes  │      ถ้าไม่มี credential
│ /api           ← notifR.     │
│                              │
│ services/                    │
│  capacityService (pure)      │
│  slotTransactionService(ACID)│
│  aiChatEngine (Layer 1)      │
│  ledgerService (double-entry)│
│  notificationEngine          │
│  pushSender (FCM v1)         │
│  pickupReminderWorker (60s)  │
└──────────────────────────────┘
```

### 4.2 API Endpoints ทั้งหมด (33 เส้นทาง — ตรวจจากโค้ดจริง)

| Mount | Method + Path | Auth ที่ใช้จริง | ความเสี่ยง |
|---|---|---|---|
| `/api/orders` | `POST /` | optional | 🔴 ตัวตนปลอมได้ (P0-7) |
| | `PATCH /:id/status` | optional | 🔴 |
| | `GET /:id` | optional | 🟠 |
| `/api/payment` | `POST /create-checkout-session` | optional | 🟠 |
| | `POST /create-payment-intent` | optional | 🟠 |
| | `POST /verify-session` | optional | 🟠 |
| `/api/merchant` | `GET /orders` | optional | 🔴 + full scan (P2-2) |
| | `POST /orders/:id/accept` | optional | 🔴 P0-4 |
| | `POST /orders/:id/reject` | optional | 🔴 P0-4 |
| | `POST /orders/:id/ready` | optional | 🔴 P0-4 |
| | `POST /orders/:id/complete` | optional | 🔴 P0-4 |
| | `GET /wallet/:storeId` | optional | 🔴 ดูยอดเงินร้านอื่นได้ |
| | `GET /wallet/:storeId/ledger` | optional | 🔴 |
| | `POST /wallet/release-held-funds` | optional | 🔴 |
| | `POST /payouts` | optional | 🔴 **P0-1 ถอนเงินได้** |
| | `POST /connect/account` | optional | 🔴 |
| | `POST /connect/onboarding-link` | optional | 🔴 |
| `/api/capacity` | `GET /:storeId/:date` | — | ✅ อ่านอย่างเดียว |
| | `POST /reserve` | optional | 🟠 spam จองกินโควตาครัวได้ |
| | `POST /release` | optional | 🟠 ปล่อยโควตาคนอื่นได้ |
| `/api/chat` | `GET /threads/:storeId` | optional | 🟠 |
| | `GET /messages/:chatId` | optional | 🟠 |
| | `POST /messages` | optional | 🔴 **P0-5 ปลอมเป็นร้าน** |
| | `POST /mark-read` | optional | 🟡 |
| | `GET /customer-threads/:customerId` | optional | 🟠 |
| `/api` | `POST /devices` | **authenticate** ✅ | ✅ |
| | `POST /devices/:id/deactivate` | **authenticate** ✅ | ✅ |
| | `GET /notifications` | **authenticate** ✅ | ✅ |
| | `PATCH /notifications/:id/read` | **authenticate** ✅ | ✅ |
| | `POST /notifications/test` | **authenticate** ✅ | ⚠️ ควรจำกัด admin |
| | `POST /chat/messages` | **authenticate** ✅ | ✅ |
| | `POST /chat/assistant-reply` | **authenticate** ✅ | ✅ |
| `/api/webhooks` | `POST /stripe` | signature verify | ✅ ตรวจลายเซ็นถูกต้อง |

> **สรุป: 26 จาก 33 endpoint ใช้ `optionalAuthenticate` โดยไม่มีการตรวจสอบความเป็นเจ้าของตามมา**
> มีเพียงกลุ่ม `notificationRoutes.js` (7 เส้นทาง) เท่านั้นที่ใช้ `authenticate` จริง

### 4.3 Firestore Collections ที่ใช้จริง (21 collections)

| Collection | ประกาศใน rules | ใช้โดย | หมายเหตุ |
|---|---|---|---|
| `users` (+ `stats/`) | ✅ | client + server | |
| `public_profiles` | ✅ | client | write ล็อกไว้ |
| `stores` (+ `members/`, `daily_stats/`) | ✅ | client + server | |
| `menu_items` | ✅ | server | 🟠 P1-1 rules หลวม |
| `food_items` | ❌ ตก catch-all | **server เท่านั้น** | ชื่อไม่สอดคล้องกับ `menu_items` — ควร consolidate |
| `orders` (+ `events/`) | ✅ | server | 🟠 P1-2 rules หลวม |
| `chats` (+ `messages/`) | ✅ | client + server | 🟠 P1-3 |
| `canteens` | ✅ | client | |
| `schools`, `school_applications` | ✅ | client | |
| `school_members` | ✅ | client | 🟠 P1-4 PDPA |
| `user_devices` | ✅ | server | |
| `notifications` | ✅ | server | |
| `pickup_slots` | ❌ deny | server | **คือ `store_capacities` ในผังเดิม** |
| `idempotency_records` | ❌ deny | server | |
| `reservations` | ❌ deny | server | |
| `ledger_entries` | ❌ deny | server | double-entry |
| `merchant_balances` | ❌ deny | server | 🔴 เข้าถึงผ่าน API ได้ |
| `merchant_accounts` | ❌ deny | server | Stripe Connect |
| `payout_requests` | ❌ deny | server | 🔴 P0-1 |
| `payments`, `payment_webhook_events` | ❌ deny | server | idempotency ของ webhook |
| `refund_requests` | ❌ deny | server | |

### 4.4 Composite Indexes (5 ตัวใน `firestore.indexes.json`)
`orders(customerId+createdAt)` · `orders(storeId+status+createdAt)` · `orders(customerId+status+createdAt)` · `menu_items(storeId+isAvailable+orderCount)` · `chats(participantIds CONTAINS + lastTimestamp)`

> ⚠️ index `orders(storeId+status+createdAt)` มีอยู่แล้ว แต่ `GET /api/merchant/orders` **ไม่ได้ใช้** (ดู P2-2)

---

## ส่วนที่ 5 — สิ่งที่ควรพัฒนาต่อ (Roadmap จัดลำดับความสำคัญ)

### 🥇 Sprint 1 — ปิดช่องโหว่ก่อน Deploy (ประเมิน 2-3 วัน)
1. สร้าง `requireStoreOwnership(storeIdSource)` middleware แล้วครอบทุก endpoint ใน `merchantRoutes.js` + `walletRoutes.js`
2. เปลี่ยน `optionalAuthenticate` → `authenticate` + `requireRole()` ในทุก endpoint ที่เปลี่ยนสถานะหรือเกี่ยวกับเงิน
3. ปิด mock-auth: เปลี่ยนเงื่อนไขเป็น `ALLOW_MOCK_AUTH === 'true'` และเพิ่ม `NODE_ENV=production` ใน script `start`
4. บังคับ `senderRole` จาก `req.user.role` ใน `chatRoutes.js`
5. ตัด fallback ของ `HMAC_SECRET` และ `STRIPE_SECRET_KEY` → throw ตอน boot
6. อุด `firestore.rules` 4 จุด: `menu_items`, `orders`, `chats`, `school_members`
7. ทำให้ `firebaseAdmin.js` fail fast บน production แทน fallback เงียบ

### 🥈 Sprint 2 — แก้บั๊กที่กระทบผู้ใช้จริง (2 วัน)
8. แก้ timezone ใน `resolveCurrentSlot()` ให้ตรึง `Asia/Bangkok` + เพิ่มเทสต์ที่รันบน `TZ=UTC`
9. sync `firebase-messaging-sw.js` ให้ใช้โปรเจกต์เดียวกับแอป (ไม่งั้น push ไม่ทำงานเลย)
10. ลบ `esbuild` ออกจาก devDependencies ให้ `npm install` ผ่าน
11. แก้ port: server เป็น 8080, vite proxy ชี้ 8080 ให้สอดคล้องกัน
12. `GET /api/merchant/orders` ใช้ `.where('storeId','==',...)` + `.orderBy()` + pagination

### 🥉 Sprint 3 — คุณภาพและความยั่งยืน (3-5 วัน)
13. เพิ่ม `cors` + `helmet` + `express-rate-limit` (เน้น `/api/orders`, `/api/chat/messages`, PIN verify)
14. เพิ่ม Express error handler กลาง (ตอนนี้ throw แล้วได้ 500 เปล่า ๆ)
15. ย้าย `securityShield` ไปบังคับใช้ฝั่ง server ด้วย
16. Code splitting: `React.lazy()` แยก `KitchenDisplaySystem`, `AdminDashboard`, `Queueup.jsx` → ลด bundle จาก 2.58 MB
17. แตก `QueueContext.tsx` (3,291 บรรทัด) เป็น 3-4 context
18. ลบไฟล์เก่าซ้ำซ้อนใน `src/pages/*.jsx` และ dead code (`ProtectedRoute`, `PageRouteLoader`, `Skeleton`)
19. ย้ายชุดทดสอบไป Vitest จริง + ใส่ `chatRoutes.test.js` เข้า `npm test` + แก้ตัวนับ
20. เพิ่ม GitHub Actions CI: `npm ci && npm run lint && TZ=UTC npm test && npm run build`

### 🏅 Sprint 4 — ฟีเจอร์ที่ยังไม่มีจริงตามที่เอกสารอ้าง
21. **AI Layer 2** — ต่อ `@google/genai` เข้ากับ Tool Calling ตามที่ header ของ `aiChatEngine.js` ออกแบบไว้ (ตอนนี้ยังเป็น Layer 1 ล้วน)
22. **Campus Wallet ฝั่งลูกค้า** — `types/index.ts` มี `PaymentMode = 'CAMPUS_WALLET'` แต่ยังไม่มี collection/endpoint สำหรับกระเป๋าเงินลูกค้า (มีแต่ `merchant_balances` ของร้าน)
23. **Roster CSV Upload** — `RegisterSchoolPage.tsx` มี UI แต่ยังไม่มี API รองรับการนำเข้า `school_members` แบบ bulk
24. รวม `food_items` กับ `menu_items` ให้เหลือ collection เดียว
25. เพิ่ม E2E test (Playwright) ครอบ flow: สั่งอาหาร → จ่ายเงิน → KDS รับออเดอร์ → รับอาหารด้วย PIN

---

## ภาคผนวก — วิธีทำซ้ำผลตรวจสอบ

```bash
git clone https://github.com/easy-web-p/Queue-up.git && cd Queue-up

npm install                    # ❌ ERESOLVE — ยืนยัน P2-1
npm install --legacy-peer-deps # ✅ workaround

npx tsc --noEmit               # ✅ 0 errors
npm run build                  # ✅ 1.77s, 2,576 KB

TZ=UTC          npm test       # ❌ 75/77, exit 1  — ยืนยัน P1-5
TZ=Asia/Bangkok npm test       # ✅ 77/77

grep -rn "requireRole" server/ | grep -v middleware   # (ว่าง) — ยืนยัน P0-3
grep -rn "@google/genai" src/ server/                 # (ว่าง) — ยืนยัน P2-6
grep -n "projectId" firebase-applet-config.json public/firebase-messaging-sw.js  # ยืนยัน P1-7
```

---

## ส่วนที่ 6 — สถานะการแก้ไข (Remediation Status)

แก้ไขและตรวจสอบแล้วเมื่อ 26 กันยายน 2026 ทุกข้อด้านล่างมีเทสต์ที่รันจริงรองรับ

### ผลการตรวจสอบหลังแก้ไข

| คำสั่ง | ก่อนแก้ | หลังแก้ |
|---|---|---|
| `npm install` (clean clone) | ❌ ERESOLVE | ✅ สำเร็จ (398 packages, 31s) |
| `npm run lint` | ✅ 0 error | ✅ 0 error |
| `npm run build` | ✅ 1.77s | ✅ 1.88s |
| `TZ=UTC npm test` | ❌ 75/77 (exit 1) | ✅ **111/111 (exit 0)** |
| `TZ=Asia/Bangkok npm test` | ✅ 77/77 | ✅ **111/111** |
| `npm run test:rules` | ไม่มี | ✅ **23/23** (Firestore Emulator) |

ชุดทดสอบเพิ่มจาก 77 เป็น **134 รายการ** (111 + 23 rules)

### P0 — วิกฤต (แก้ครบ 7/7)

| # | ปัญหา | การแก้ไข | เทสต์ที่ยืนยัน |
|---|---|---|---|
| P0-1 | ถอนเงินร้านได้โดยไม่ล็อกอิน | `requireStoreOwnership()` บนทุก endpoint ของ `walletRoutes.js`; `storeId` มาจาก `req.storeId` ที่ผ่านการอนุมัติแล้ว ไม่ใช่ `req.body` | anonymous → 401, รายอื่น → 403, เจ้าของ → 201 |
| P0-2 | Mock auth bypass บน production | เปลี่ยนเป็น opt-in `ALLOW_MOCK_AUTH=true` และปิดตายเมื่อ `NODE_ENV=production`; `npm start` ตั้ง `NODE_ENV=production` ให้เอง | ตรวจ gate ทั้ง 3 กรณี |
| P0-3 | `requireRole()` ไม่เคยถูกใช้ | เพิ่ม `isStoreOperator()` / `requireStoreOwnership()` และบังคับใช้จริงทุก route; ลบ middleware ที่ไม่ได้ใช้ทิ้ง | ทั้ง 24 เคสใน `authorization.test.js` |
| P0-4 | วงจรชีวิตออเดอร์ไม่ตรวจสิทธิ์ | `authenticate` + `requireStoreOwnership(storeIdFromOrderParam)` บน accept/reject/ready/complete | 401 / 403 / 200 ครบ |
| P0-5 | ปลอมเป็นร้านค้าในแชท | `senderRole` มาจาก `isStoreOperator(req.user, storeId)` ไม่อ่านจาก body อีกต่อไป | ลูกค้าส่ง `senderRole: 'merchant'` → บันทึกเป็น `customer` |
| P0-6 | `HMAC_SECRET` hardcode | `server/config/secrets.js` — production throw ตอน boot ถ้าไม่ตั้ง | ตรวจ boot ทั้ง production/dev |
| P0-7 | ตัวตนปลอมผ่าน header | ตัด `x-customer-id` / `x-customer-school-id` ออกจากทุก route; ตัวตนมาจาก `req.user` เท่านั้น | ไม่มี header trust หลงเหลือในโค้ด production |

### ช่องโหว่เพิ่มเติมที่พบระหว่างแก้ (ไม่อยู่ในรายงานรอบแรก)

| ปัญหา | ความรุนแรง | การแก้ไข |
|---|---|---|
| **ราคาที่ชาร์จมาจาก client** — `POST /api/payment/create-checkout-session` และ `create-payment-intent` รับ `amount` จาก request body ตรง ๆ → จ่าย ฿1 แทน ฿500 ได้ | 🔴 วิกฤต | `loadPayableOrder()` โหลดออเดอร์จาก Firestore และใช้ `order.totalSatang` เสมอ พร้อมตรวจว่าผู้เรียกเป็นเจ้าของออเดอร์และออเดอร์ยังไม่ถูกชำระ |
| **Webhook รับ payload ที่ไม่ได้เซ็น** — ถ้าไม่ตั้ง `STRIPE_WEBHOOK_SECRET` จะ parse JSON ดิบ → ใครก็ mark ออเดอร์เป็น PAID ได้ฟรี | 🔴 วิกฤต | production throw ตอน boot ถ้าไม่มี secret; dev เตือนชัดเจน |
| **รหัส PIN รับอาหารรั่วผ่าน `GET /api/orders/:id`** | 🟠 สูง | ตัด `exchangePin` / `exchangePinHash` ออกสำหรับทุกคนที่ไม่ใช่เจ้าของออเดอร์ |
| **ปล่อยโควตาสล็อตของคนอื่นได้** — `POST /api/capacity/release` | 🟠 สูง | ตรวจ `reservations/{id}.uid` ต้องตรงกับผู้เรียก หรือเป็นผู้ดูแลร้าน |
| **`isSuperAdmin()` error แทนคืน false** — การอ่าน custom claim ที่ไม่มีอยู่ทำให้กฎทั้งข้อ error และ `||` ข้อถัดไปไม่ถูกประเมิน → **school admin ที่ไม่มี claim `admin` ถูกปฏิเสธ** | 🟠 สูง | เปลี่ยนไปใช้ `request.auth.token.get(key, default)` ทุกจุด | 

### P1 — สูง (แก้ครบ 7/7)

- **P1-1/2/3/4 (firestore.rules)** — เพิ่ม `isStoreOperator(storeId)` ผูกสิทธิ์กับ `ownerId` ของร้านจริง; `menu_items` แยก create/update/delete; `orders` และ `chats` ตัดเงื่อนไข "merchant คนไหนก็ได้" ออก; `school_members` อ่านได้เฉพาะเจ้าของเรคคอร์ดและ school admin ของสถาบันนั้น → ยืนยันด้วย 23 เทสต์บน Firestore Emulator
- **P1-5 (timezone)** — `resolveCurrentSlot()` ตรึงเป็น `Asia/Bangkok` ผ่าน `Intl.DateTimeFormat` (ตั้งค่าได้ด้วย `QUEUEUP_TIMEZONE`) และ `src/services/engines/slotHelper.ts` ฝั่ง client ใช้หลักเดียวกัน → ทดสอบผ่านบน UTC, Asia/Bangkok, America/New_York, Pacific/Auckland
- **P1-6 (silent fallback)** — `firebaseAdmin.js` throw ตอน boot บน production แทนการเขียนลง `.local_db.json`
- **P1-7 (push ใช้ไม่ได้)** — `public/firebase-messaging-sw.js` ชี้ไปโปรเจกต์ `queueup-65e82` ตรงกับตัวแอปแล้ว

### P2 — ปานกลาง (แก้ 9/15)

| # | สถานะ |
|---|---|
| P2-1 `npm install` ล้มเหลว | ✅ ลบ `esbuild` ออกจาก devDependencies (vite มีในตัว) |
| P2-2 full-collection scan | ✅ `merchant/orders`, `wallet/:id/ledger`, `release-held-funds` ใช้ `.where()` แล้ว |
| P2-4 port ชนกัน | ✅ server default → 8080 ตรงกับ proxy; เพิ่ม `npm run dev:server` |
| P2-5 Stripe fallback | ✅ ไม่มี dummy key แล้ว; endpoint ตอบ 503 อย่างชัดเจนถ้าไม่ได้ตั้งค่า |
| P2-7 security shield ฝั่ง client เท่านั้น | ✅ เพิ่ม `server/services/inputShield.js` บังคับใช้ฝั่งเซิร์ฟเวอร์ (XSS, prompt injection, NoSQL, ความยาว 2000 ตัวอักษร) |
| P2-10 dead code | ✅ ลบ `requireVerifiedUser` ที่ไม่ได้ใช้ (ยังเหลือ `ProtectedRoute`, `PageRouteLoader`, `Skeleton` ฝั่ง frontend) |
| P2-13 เทสต์ไม่ครบ | ✅ `chatRoutes.test.js` เข้า `npm test` แล้ว และแก้ตัวนับ "6/5" เป็น 6/6 |
| P2-14 README ไม่ตรงความจริง | ✅ แก้ Vitest/SQLite/port 5173 และเพิ่มตารางตัวแปรสภาพแวดล้อม |
| P2-15 collection ไม่มีใน rules | ✅ เพิ่มเทสต์ยืนยันว่า `merchant_balances`, `payout_requests`, `ledger_entries` ถูก catch-all deny จริง |
| เพิ่มเติม | ✅ เพิ่ม `firebase.json` ซึ่งเดิมไม่มี ทำให้ deploy `firestore.rules` / indexes ด้วย Firebase CLI ไม่ได้เลย |

### ยังเหลือ (Sprint 3-4)

- P2-3 Code splitting — bundle ยัง 2.58 MB ก้อนเดียว
- P2-8 CORS middleware
- P2-9 Rate limiting
- P2-11 ลบไฟล์หน้าเก่าซ้ำซ้อนใน `src/pages/*.jsx`
- P2-12 แตก `QueueContext.tsx` (3,291 บรรทัด)
- P2-6 AI Layer 2 (`@google/genai` ยังไม่ถูกใช้)
- Campus Wallet ฝั่งลูกค้า / Roster CSV Upload API / รวม `food_items` กับ `menu_items`

### ไฟล์ที่เพิ่มใหม่

| ไฟล์ | หน้าที่ |
|---|---|
| `server/config/secrets.js` | อ่าน secret แบบ fail-fast — production ไม่ยอมสตาร์ทถ้าขาดค่าที่จำเป็น |
| `server/services/inputShield.js` | ตรวจ XSS / Prompt Injection / NoSQL / ความยาว ฝั่งเซิร์ฟเวอร์ |
| `server/tests/authorization.test.js` | 24 เทสต์ขอบเขตสิทธิ์ของ API |
| `server/tests/firestoreRules.test.js` | 23 เทสต์ Security Rules บน Firestore Emulator |
| `firebase.json` | คอนฟิกสำหรับ deploy rules/indexes และรัน emulator |
