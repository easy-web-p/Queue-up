# Roadmap: QueueUp for Campus

## Phase 1: Data Model & Security Rules Core (Backend Architecture)
- [x] Define Firestore collections schema (`students`, `parent_child_links`, `wallets`, `wallet_transactions`, `vendor_approvals`, `staff_supervisors`) in `src/types/campus.ts`
- [x] Draft and verify Firestore security rules for campus collections (fail-closed, role-based with custom claims)
- [x] Unit & Integration Security Rules Test Matrix (87/87 tests passing)

## Phase 2: Student Vendor Onboarding & Staff Approval Workflow
- [ ] Student Vendor registration workflow (`StudentVendorOnboarding.tsx`)
- [ ] Staff Supervisor approval panel (`VendorApprovalPanel.tsx`)
- [ ] Cloud Function: `approveStudentVendor` / `rejectStudentVendor`

## Phase 3: Campus Wallet Engine & 5-Phase Ordering Workflow
- [ ] Phase 0: `validateWalletSpending` (dailyLimit, weeklyLimit, blockedCategories, allergyInfo)
- [ ] Phase 1-3: `createOrderAuthoritative` (ACID transaction for stock, slot capacity, queue)
- [ ] Phase 4: Atomic wallet deduction, transaction logging (`wallet_transactions`), Guardian push notification
- [ ] Concurrency & Race-free wallet transaction tests

## Phase 4: Guardian Dashboard & Campus Oversight
- [ ] Guardian dashboard (`GuardianDashboard.tsx`) with spending limits, blocked categories, transaction history
- [ ] Emergency medical & allergy lookup (`EmergencyLookup.tsx`) with atomic audit logging
- [ ] Campus Queue Monitor overview (`CampusQueueMonitor.tsx`)
- [ ] E2E Testing, Final Multi-Agent Review & Audit
