# QueueUp for Campus Architecture Document

## 1. Multi-Agent Ecosystem
The system operates under a 6-agent cooperative governance model:
1. **campus_strategist**: Oversees roadmap alignment, business rules, and school policy compliance.
2. **campus_planner**: Deconstructs phases into granular atomic tasks and dependency graphs.
3. **campus_designer**: Enforces the "Warm Dark Canteen" design system (#16100C background, #FF7A1A accent, Kanit/IBM Plex Sans Thai typography).
4. **campus_builder**: Implements React 19 / TypeScript UI pages, Firebase Cloud Functions, and atomic Firestore transactions.
5. **campus_reviewer**: Reviews code quality, type safety (`npx tsc --noEmit`), and role boundary guards.
6. **campus_auditor**: Verifies test suites, security rules, OWASP compliance, and immutable audit logs.

## 2. 5-Phase Ordering Engine
```
[Phase 0: Wallet & Policy Pre-Check]
  ├── Wallet Balance Check (Satang)
  ├── Daily Spending Limit Check (Satang/Day)
  ├── Weekly Spending Limit Check (Satang/Week)
  └── Guardian-Blocked Food Categories Filter
         ↓ (Pass)
[Phase 1: Multi-Doc Reads in Transaction]
  ├── Store Status & Operating Hours (Asia/Bangkok)
  ├── Product Stock & Modifier Group Constraints
  ├── Date-Scoped Slot Capacity (`store_slots`)
  └── Store Sequence Counter (`queue_counters`)
         ↓
[Phase 2: Validation & Satang Calculations]
  ├── Slot Quota Integrity (Fail-Closed)
  └── Deterministic Queue Number Issuance (Q001, Q002...)
         ↓
[Phase 3: Core Mutations & Order Creation]
  ├── Decrement Stock Atomic Mutation
  ├── Increment Slot Orders
  ├── Update Counter Sequence
  └── Insert `/orders` Doc (PENDING / waiting)
         ↓
[Phase 4: Wallet Deduction & Immutable Ledger]
  ├── Deduct Satang Balance on `/wallets/{studentId}`
  ├── Increment `spentTodaySatang` and `spentThisWeekSatang`
  └── Append Immutable Transaction into `/wallet_transactions`
```

## 3. Campus Firestore Collections
- `/students/{studentId}`: Student profile, allergies (`allergyInfo`), emergency contacts, grade/room.
- `/wallets/{studentId}`: Satang balance, daily/weekly limits, blocked categories, lock state.
- `/wallet_transactions/{txId}`: Immutable ledger (`allow write: if false;`).
- `/parent_child_links/{linkId}`: Verified guardian-student relationship mappings.
- `/vendor_approvals/{approvalId}`: Student entrepreneur applications reviewed by school staff.
- `/staff_supervisors/{staffId}`: Teacher & canteen administrator permissions directory.
- `/audit_logs/{auditId}`: Immutable security and emergency medical lookup log.
