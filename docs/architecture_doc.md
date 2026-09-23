# QueueUp for Campus Architecture Document

## 1. Multi-Agent Ecosystem
The system operates under a 6-agent cooperative governance model:
1. **campus_strategist**: Oversees roadmap alignment, business rules, and school policy compliance.
2. **campus_planner**: Deconstructs phases into granular atomic tasks and dependency graphs.
3. **campus_designer**: Enforces the "Warm Dark Canteen" design system (#16100C background, #FF7A1A accent, Kanit/IBM Plex Sans Thai typography).
4. **campus_builder**: Implements React 19 / TypeScript UI pages, Firebase Cloud Functions, and atomic Firestore transactions.
5. **campus_reviewer**: Reviews code quality, type safety (`npx tsc --noEmit`), and role boundary guards.
6. **campus_auditor**: Verifies test suites, security rules, OWASP compliance, and immutable audit logs.

## 2. 5-Phase Ordering Engine & Atomic Transaction Merge
```
[Phase 0: Wallet & Policy Read & Pre-Check (In Transaction)]
  ├── Read `/wallets/{studentId}` within the transaction
  ├── Wallet Lock Verification (`isLocked !== true`)
  ├── Wallet Balance Check (Satang >= Order Total)
  ├── Fail-Closed Limits Check (Must not be null; throws WALLET_LIMITS_NOT_CONFIGURED)
  ├── Daily Spending Limit Check (`spentToday + total <= dailyLimitSatang`)
  ├── Weekly Spending Limit Check (`spentThisWeek + total <= weeklyLimitSatang`)
  └── Guardian-Blocked Food Categories Filter
         ↓ (Pass)
[Phase 1: Multi-Doc Reads in Transaction]
  ├── Store Status & Operating Hours (Asia/Bangkok)
  ├── Product Stock & Modifier Group Constraints
  ├── Date-Scoped Slot Capacity (`store_slots`)
  └── Store Sequence Counter (`queue_counters`)
         ↓
[Phase 2: Validation & Authoritative Calculations]
  ├── Allergen Shield Scan (DECLARED & INFERRED)
  ├── Slot Quota Integrity (Fail-Closed)
  └── Deterministic Queue Number Issuance (Q001, Q002...)
         ↓
[Phase 3: Core Mutations & Order Creation]
  ├── Decrement Stock Atomic Mutation
  ├── Increment Slot Orders
  ├── Update Counter Sequence
  └── Insert `/orders` Doc (PENDING / waiting)
         ↓
[Phase 4: Wallet Deduction & Immutable Ledger (Atomic in Same Transaction)]
  ├── Deduct Satang Balance on `/wallets/{studentId}`
  ├── Increment `spentTodaySatang` and `spentThisWeekSatang`
  └── Append Immutable Transaction into `/wallet_transactions`
```

> **Phase 0 & Phase 4 Transactional Merge**:
> Phase 0 (pre-checks) and Phase 4 (balance deductions & ledger entry) are merged into the **exact same Firestore transaction** (`db.runTransaction`) as Phases 1–3. This guarantees total atomicity: if inventory runs out, slot capacity exceeds, or wallet balance is insufficient, no partial mutations occur. This completely prevents double-spending and TOCTOU (Time-Of-Check to Time-Of-Use) race conditions across concurrent browser tabs or devices.

## 3. Fail-Closed Campus Wallet Policy
- **Unset Limits (Fail-Closed)**: If `dailyLimitSatang` or `weeklyLimitSatang` is unconfigured (`null` or `undefined`), `createOrderAuthoritative` strictly aborts with `WALLET_LIMITS_NOT_CONFIGURED`. Orders are blocked until a linked guardian sets daily/weekly thresholds in `GuardianDashboard`.
- **Spending Freeze (`0 THB`)**: Setting a limit of `0` satang is treated as a deliberate, valid freeze rather than unset. Any order attempt with limit 0 immediately triggers `DAILY_LIMIT_EXCEEDED` or `WEEKLY_LIMIT_EXCEEDED`.
- **Lazy Counter Rollovers**: Spending counters reset lazily on server Bangkok calendar date and ISO week (`YYYY-Www`) boundaries without reliance on external cron schedulers.

## 4. Payment Top-Up Architecture
Money enters the system in one place — a wallet top-up — by one of two paths.
Both write a `PENDING` row to `/wallet_topup_requests` and credit only when
something **outside the browser** confirms the money exists. Neither path lets
a client move a balance.

- **Stripe (card / PromptPay)** — `createTopupPaymentIntent` → Payment Element → `stripeTopupWebhook`:
  - The callable creates the request row first, then a PaymentIntent in satang (Stripe's minor unit for THB, so no conversion), carrying `queueup_*` metadata that names the student and the request.
  - `stripeTopupWebhook` verifies the signature over `req.rawBody`, credits `amount_received` rather than the requested `amount`, and records `idempotency_keys/stripe_<event.id>` in the same transaction as the credit, so a redelivered event credits nothing.
  - `canConfirmManually` refuses to let staff hand-confirm a Stripe request: that would credit a wallet for a payment that may have failed.
  - Unconfigured (`VITE_STRIPE_PUBLISHABLE_KEY` unset) the app hides this option rather than failing at the till.
- **Cash at the school counter** — `topupCampusWallet` → `reviewWalletTopupRequest`:
  - A guardian records a request; nothing is credited by it. A student or parent then presents cash at the financial counter.
  - An authorized cashier / staff supervisor (verified server-side via `request.auth.token.role === 'staff_supervisor' | 'admin'` or a verified document in `/staff_supervisors`) confirms it — that confirmation IS the capture, because they are the ones handed the notes.
  - Staff topping up directly credit immediately; `assertWalletAuthority(allowSelf: false)` keeps a student off both paths for their own wallet, since the wallet carries spending controls a guardian set.
- Either way an immutable credit lands in `/wallet_transactions` with `type: 'TOPUP'` and the confirming `actorUid` (`stripe_webhook` for the Stripe path).
- **Institutional note**: a *gateway of the school's own* (aggregator licensing, bank fee reconciliation, institutional KYC) remains a separate question from this integration, which settles to a Stripe account the school already holds.

## 5. Security & Server-Authoritative Audit Logs
- **Backend-Only Immutability**:
  - `/audit_logs` has `allow write: if false;` in `firestore.rules` to ensure client SDKs cannot forge or tamper with audit trails.
  - All audit log writes (such as `REGISTER_MERCHANT` and `UPDATE_STORE_PROFILE`) are processed by the callable Cloud Function `recordMerchantAuditLog`.
  - `recordMerchantAuditLog` verifies caller authentication, enforces action whitelist, confirms store ownership against `/shops/{storeId}.ownerUid` (or admin privileges), and sanitizes metadata length and types.

## 6. Campus Firestore Collections
- `/students/{studentId}`: Student profile, allergies (`allergyInfo`), emergency contacts, grade/room.
- `/wallets/{studentId}`: Satang balance, daily/weekly limits, blocked categories, lock state.
- `/wallet_transactions/{txId}`: Immutable ledger (`allow write: if false;`).
- `/parent_child_links/{linkId}`: Verified guardian-student relationship mappings.
- `/vendor_approvals/{approvalId}`: Student entrepreneur applications reviewed by school staff.
- `/staff_supervisors/{staffId}`: Teacher & canteen administrator permissions directory.
- `/wallet_topup_requests/{requestId}`: A claim that money is coming, `PENDING` until Stripe's webhook or a staff confirmation settles it. `allow write: if false;` — a client that could create a `CONFIRMED` row would be back to self-service credit.
- `/idempotency_keys/{keyId}`: Records that an event has already been processed. Stripe rows are prefixed `stripe_` and written in the same transaction as the credit, so a redelivered webhook cannot double it.
- `/audit_logs/{auditId}`: Immutable security and emergency medical lookup log.
