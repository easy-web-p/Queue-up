# ความพร้อมรับเงินจริงของ QueueUp (Money Readiness)

> ตรวจสอบและแก้ไขบนคอมมิต `afa910d` (branch `main`)
> วันที่: 26 กันยายน 2026
> ทุกข้อในเอกสารนี้มีเทสต์รองรับ หรือระบุไว้ชัดเจนว่า **ยังไม่มี**

เอกสารนี้ตอบคำถามเดียว: ระบบนี้รับเงินจริงได้หรือยัง และถ้ายัง — เหลืออะไร

---

## ส่วนที่ 1 — กฎเรื่องเงินที่ระบบบังคับใช้จริงแล้ว (มีเทสต์)

| กฎ | บังคับใช้ที่ | เทสต์ |
|---|---|---|
| ทุกกลุ่มรายการบัญชี เดบิต = เครดิต | `ledgerService.js` | `ledgerIntegrity.test.js` |
| `total === platformFee + gatewayFee + merchantNet` ทุกยอด | `orderPricing.js` | `ledgerIntegrity.test.js` |
| ราคาคิดจากเมนูในฐานข้อมูล ไม่เชื่อราคาจาก client | `orderRoutes.js` | `authorization.test.js` |
| ใบชำระเงินหนึ่งใบ ปิดได้เฉพาะออเดอร์ของตัวเอง | `paymentVerification.js` | `payoutLifecycle.test.js` |
| จ่ายน้อยกว่ายอดออเดอร์ → ไม่ปิดออเดอร์ และถูกบันทึกไว้ | `paymentSettlement.js` | `paymentSettlement.test.js` |
| QR PromptPay ที่ยังไม่จ่าย → ออเดอร์ยังไม่ PAID | `webhookRoutes.js` | `paymentSettlement.test.js` |
| เงินเข้าหลังยกเลิกออเดอร์ → ไม่ปลุกออเดอร์คืน และถูกบันทึกไว้ | `paymentSettlement.js` | `paymentSettlement.test.js` |
| ยกเลิกออเดอร์ที่จ่ายแล้ว → คืนเงินทุกครั้ง | `orderRefundService.js` | `orderCancellation.test.js` |
| ร้านเริ่มทำอาหารแล้ว ลูกค้ายกเลิกเองไม่ได้ | `orderRoutes.js` | `orderCancellation.test.js` |
| ยกเลิกซ้ำ ไม่คืนเงินซ้ำ ไม่คืนที่นั่งซ้ำ | `orderRoutes.js` | `orderCancellation.test.js` |
| ร้านไม่ตอบรับ → หมดอายุและคืนเงินอัตโนมัติ | `settlementSweeps.js` | `settlementSweeps.test.js` |
| เงินพักครบกำหนด → โอนเข้ายอดถอนได้เอง ไม่ต้องกดปุ่ม | `settlementSweeps.js` | `settlementSweeps.test.js` |
| ถอนเงินต้องมีบัญชีธนาคารจริง ไม่มีค่าตั้งต้น | `walletRoutes.js` | `payoutLifecycle.test.js` |
| ยืนยันการโอนซ้ำ ไม่จ่ายซ้ำ | `walletRoutes.js` | `payoutLifecycle.test.js` |
| การโอนล้มเหลว → เงินกลับเข้ายอดถอนได้ ไม่ค้าง | `walletRoutes.js` | `payoutLifecycle.test.js` |
| ลูกค้าอ่าน/เขียนบัญชีแยกประเภท คำขอคืนเงิน ยอดร้านค้า ไม่ได้ | `firestore.rules` | `firestoreRules.test.js` |

รวม **347 เทสต์ฝั่งเซิร์ฟเวอร์ + 38 เทสต์ Firestore Rules + 9 เทสต์ E2E** ผ่านทั้งหมด

---

## ส่วนที่ 2 — สิ่งที่คุณต้องตั้งค่าเอง ก่อนรับเงินจริง

โค้ดพร้อมแล้ว แต่สี่อย่างนี้อยู่นอกโค้ด ไม่มีใครตั้งให้ได้นอกจากเจ้าของบัญชี

### 2.1 Environment Variables บน Vercel (Production scope)

| ตัวแปร | จำเป็น | ถ้าไม่ตั้งจะเกิดอะไร |
|---|---|---|
| `NODE_ENV=production` | ✅ | ระบบจะไม่บังคับกฎความปลอดภัยระดับ production |
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | API อ่าน/เขียน Firestore ไม่ได้เลย (ใส่เป็น JSON ทั้งก้อน หรือ base64) |
| `HMAC_SECRET` | ✅ | PIN รับอาหารปลอมได้ — ระบบจะปฏิเสธทุก request จนกว่าจะตั้ง |
| `STRIPE_SECRET_KEY` | ✅ | สร้างการชำระเงินไม่ได้ (503 STRIPE_NOT_CONFIGURED) |
| `STRIPE_WEBHOOK_SECRET` | ✅ | **สำคัญที่สุด** — ถ้าไม่ตั้ง ระบบจะปฏิเสธ webhook ทุกใบ (503) เพราะถ้ารับโดยไม่ตรวจลายเซ็น ใครก็ยิงมาบอกว่า "จ่ายแล้ว" ได้ |
| `CRON_SECRET` | ✅ | งานคืนเงิน/ปล่อยเงินอัตโนมัติจะไม่ทำงาน (503) |
| `SUPER_ADMIN_EMAILS` | ✅ | ไม่มีใครยืนยันการโอนเงินให้ร้านได้ |
| `CSP_ENFORCE=true` | แนะนำ | CSP จะเป็นแค่โหมดรายงาน ไม่บล็อกจริง |
| `ALLOW_MOCK_AUTH` | ❌ **ต้องไม่ตั้ง** | ถ้าตั้งเป็น true บน production = ใครก็ปลอมตัวเป็นใครก็ได้ผ่าน header |
| `ALLOWED_ORIGINS` | ถ้าแยก frontend | จำกัดโดเมนที่เรียก API ได้ |
| `GEMINI_API_KEY` | ไม่จำเป็น | แชท AI จะใช้เฉพาะชั้นกฎ (Layer 1) ไม่มี Layer 2 |

### 2.2 Stripe Webhook — ต้องสมัคร event ให้ครบ

ไปที่ Stripe Dashboard → Developers → Webhooks → Add endpoint

- **URL:** `https://queue-up-nu.vercel.app/api/webhooks/stripe`
- **Events ที่ต้องเลือก** (ขาดตัวใดตัวหนึ่ง = เงินหลุดจากวงจร):

| Event | ทำอะไร | ถ้าไม่สมัคร |
|---|---|---|
| `checkout.session.completed` | ปิดออเดอร์เมื่อจ่ายด้วยบัตร | ลูกค้าจ่ายแล้วแต่ออเดอร์ไม่ถึงร้าน |
| `checkout.session.async_payment_succeeded` | ปิดออเดอร์เมื่อ PromptPay ยืนยัน | **PromptPay จ่ายแล้วออเดอร์ไม่ขึ้น** |
| `checkout.session.async_payment_failed` | ทำเครื่องหมายว่าจ่ายไม่สำเร็จ | ออเดอร์ค้างสถานะรอจ่ายเงียบๆ |
| `checkout.session.expired` | ปิดใบชำระที่หมดอายุ | เหมือนข้างบน |
| `payment_intent.succeeded` | ปิดออเดอร์ของช่องทาง PaymentIntent | เงินเข้าแต่ออเดอร์ไม่ถูกปิด |
| `payment_intent.payment_failed` | บันทึกว่าจ่ายไม่ผ่าน | ลูกค้าไม่รู้ว่าต้องลองใหม่ |
| `charge.refunded` | ปิดคำขอคืนเงิน + กลับรายการบัญชี | คืนเงินจริงแล้วแต่ระบบยังบอกว่า "รอคืน" |

จากนั้นคัดลอก **Signing secret** (`whsec_...`) ไปใส่ `STRIPE_WEBHOOK_SECRET`

### 2.3 Firestore

```bash
firebase deploy --only firestore:rules
```

กฎปิดทุก collection ที่เกี่ยวกับเงินไม่ให้ client อ่าน (`ledger_entries`, `merchant_balances`,
`refund_requests`, `payout_requests`, `payment_exceptions`) — ถ้าไม่ deploy กฎใหม่ กฎเดิมยังอยู่

### 2.4 Vercel Cron

`vercel.json` ประกาศงานไว้ 2 งานแล้ว แต่ **Hobby plan รันได้วันละครั้งเท่านั้น**

| งาน | เวลา | หมายเหตุ |
|---|---|---|
| `/api/cron/pickup-reminders` | 00:00 UTC | เตือนลูกค้ามารับอาหาร |
| `/api/cron/settlement` | 01:00 UTC | คืนเงินออเดอร์ที่ร้านไม่ตอบ + ปล่อยเงินพักให้ร้าน |

ถ้าต้องการให้เร็วกว่าวันละครั้ง มีสองทาง: อัปเกรดเป็น Pro
หรือให้ตัวจับเวลาภายนอก (เช่น cron-job.org, Google Cloud Scheduler) ยิง URL เดียวกันทุก 5 นาที
พร้อม header `Authorization: Bearer <CRON_SECRET>`

**สิ่งที่ลูกค้าทำได้ทันทีโดยไม่ต้องรอ cron:** กดยกเลิกออเดอร์เอง แล้วได้เงินคืนทันที
(กระเป๋าเงิน) หรือเข้าคิวคืนเงิน (บัตร/PromptPay) — cron เป็นตัวสำรอง ไม่ใช่ทางเดียว

---

## ส่วนที่ 3 — ข้อจำกัดที่เหลืออยู่ (พูดตรงๆ)

### 3.1 การจ่ายเงินให้ร้านค้าเป็นการโอนด้วยมือ

ยังไม่ได้ต่อ Stripe Connect ระบบทำได้ถึง: จดว่าร้านมีเงินเท่าไหร่ กันเงินไว้เมื่อร้านขอถอน
และบันทึกเมื่อผู้ดูแลระบบยืนยันว่าโอนแล้ว — **แต่การโอนเงินออกจากบัญชีธนาคารจริง
ยังต้องมีคนทำเอง** ขั้นตอนคือ:

1. ร้านกดขอถอน → สถานะ `REQUESTED` เงินถูกกันไว้ (ร้านถอนซ้ำจากยอดเดิมไม่ได้)
2. ผู้ดูแลระบบโอนเงินจริงผ่านธนาคาร
3. ผู้ดูแลระบบเรียก `POST /api/merchant/payouts/:payoutId/complete` → สถานะ `PAID`
4. ถ้าโอนไม่สำเร็จ เรียก `POST /api/merchant/payouts/:payoutId/fail` → เงินกลับเข้ายอดถอนได้

ข้อ 3 และ 4 **ยังไม่มีหน้าจอ** ต้องเรียกผ่าน API (เช่น `curl`) ด้วยบัญชีที่อยู่ใน
`SUPER_ADMIN_EMAILS` — นี่คือช่องว่างที่ใหญ่ที่สุดที่เหลือ ถ้าจะเปิดรับเงินจริงในวงกว้าง

### 3.2 คิวเงินที่ต้องตรวจด้วยมือ (`payment_exceptions`)

เมื่อมีเงินเข้าที่ระบบรับไม่ได้ — จ่ายน้อยกว่ายอด, จ่ายหลังยกเลิก, คืนเงินหลังเงินออกจากยอดพักไปแล้ว —
ระบบจะไม่เดา และไม่กลืนเงินนั้นเงียบๆ มันเขียนแถวไว้ใน `payment_exceptions`
พร้อมยอดที่เข้ามาและยอดที่ควรได้ **แต่ยังไม่มีหน้าจอให้ดู** ต้องดูใน Firebase Console
(collection `payment_exceptions`, `status: OPEN`) — ควรตรวจอย่างน้อยวันละครั้งในช่วงแรก

### 3.3 คืนเงินหลังรับอาหารแล้วไม่ได้

ออเดอร์ที่ `COMPLETED` ไม่มีทางกลับ ถ้าลูกค้าได้อาหารแล้วมีปัญหา ต้องคืนเงินผ่าน Stripe Dashboard
ระบบจะรับรู้ผ่าน `charge.refunded` และทำเครื่องหมายให้ แต่ถ้าเงินก้อนนั้นออกจากยอดพักไปแล้ว
ระบบจะไม่หักยอดร้านย้อนหลังเอง — มันจะเขียน `REFUND_AFTER_SETTLEMENT`
ไว้ใน `payment_exceptions` ให้คนตัดสินใจ เพราะเงินอาจถูกถอนออกไปแล้ว

### 3.4 LINE Notify ใช้ไม่ได้อีกแล้ว

โค้ดยังยิงไปที่ `notify-api.line.me` ซึ่ง LINE ปิดบริการไปเมื่อ 31 มีนาคม 2025
การแจ้งเตือนหลักคือ FCM (push) และ in-app inbox ซึ่งทำงานปกติ ส่วน LINE
จะล้มเหลวเงียบๆ ไม่กระทบเส้นทางเงิน แต่ควรถอดออกหรือเปลี่ยนไปใช้ Messaging API

### 3.5 ค่าธรรมเนียมเป็นค่าคงที่ในโค้ด

`PLATFORM_FEE_RATE = 10%` และ `GATEWAY_FEE_RATE = 1.65% × 1.07 (VAT)` อยู่ใน
`orderPricing.js` ถ้าจะเปลี่ยนต่อร้าน/ต่อสถาบัน ต้องย้ายไปเก็บในฐานข้อมูล
และเก็บอัตราที่ใช้ตอนนั้นไว้ในออเดอร์ (snapshot) ด้วย ไม่งั้นบัญชีย้อนหลังจะอ่านไม่ตรง

---

## ส่วนที่ 4 — คำตอบสั้นๆ

**รับเงินจริงได้ไหม?** ได้ ถ้าตั้งค่าในส่วนที่ 2 ครบ — เส้นทางเงินขาเข้า (ลูกค้าจ่าย → ร้านได้ออเดอร์
→ คืนเงินเมื่อยกเลิก) มีเทสต์ครบและสมดุลทุกรายการ

**ขาอะไรที่สุด?** หน้าจอสำหรับผู้ดูแลระบบ 2 อย่าง: ยืนยัน/ยกเลิกการโอนเงินให้ร้าน (3.1)
และคิว `payment_exceptions` (3.2) ตอนนี้ทั้งสองอย่างทำได้แต่ต้องเรียก API เอง

**เสี่ยงที่สุดตอนเริ่ม?** ลืมสมัคร `checkout.session.async_payment_succeeded` ใน Stripe
เพราะ PromptPay คือช่องทางหลักของนักศึกษาไทย ลืมตัวนี้ = จ่ายเงินแล้วออเดอร์ไม่ขึ้น
