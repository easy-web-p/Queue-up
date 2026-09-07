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

## 4. Payment Top-Up Architecture & Institutional Blocker
- **Payment Gateway Blocker (PromptPay / Opn vs. Cash Counter)**:
  - Online payment gateways (PromptPay Dynamic QR via Opn or bank APIs) require institutional KYC, payment aggregator licensing, and bank fee reconciliation agreements.
  - In production campus canteen deployments, automated external payment gateway top-up remains blocked pending school financial board approval and merchant account clearance.
- **Primary Operational Top-Up Flow (School Cashier Counter)**:
  - Student or parent presents cash at the school financial counter.
  - An authorized school cashier / staff supervisor (verified server-side via `request.auth.token.role === 'staff_supervisor' | 'admin'` or verified document in `/staff_supervisors`) executes `topupCampusWallet`.
  - Immutable credit record is written to `/wallet_transactions` with `type: 'TOPUP'` and cashier `actorUid`.

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
- `/audit_logs/{auditId}`: Immutable security and emergency medical lookup log.
