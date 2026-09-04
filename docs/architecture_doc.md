# Architecture Document: QueueUp for Campus

## 1. Existing Baseline Collections
- `/shops/{storeId}`
- `/products/{productId}`
- `/modifier_groups/{groupId}`
- `/store_slots/{slotId}`
- `/queue_counters/{counterId}`
- `/orders/{orderId}`

## 2. New Campus Collections Schema
- `/students/{studentId}`: { name, class, guardianIds[], allergyInfo, healthNotes }
- `/parent_child_links/{linkId}`: { guardianId, studentId, verifiedByGuardian, verifiedBySchool, status }
- `/wallets/{studentId}`: { balance, dailyLimit, weeklyLimit, blockedCategories[] }
- `/wallet_transactions/{txId}`: { walletId, orderId, amount, type('topup'|'spend'), timestamp }
- `/vendor_approvals/{requestId}`: { studentVendorId, shopName, requestedZone, status, approvedBy, approvedAt }
- `/staff_supervisors/{staffId}`: { name, role, assignedZones[] }

## 3. Core Principles
1. **1 Page 1 Duty**: Clear separation of responsibilities per view.
2. **Separate Financial Data**: Wallets writable exclusively via Cloud Functions.
3. **Role Enforcement**: Custom claims based role verification.
4. **Fail-Closed by Default**: Unconfigured limits reject operations immediately.
5. **Atomic Audit Logs**: Sensitive operations logged atomically.

## 4. 5-Phase Food Ordering Workflow
- Phase 0: `validateWalletSpending` (Spending limits, blocked categories, allergies)
- Phase 1-3: `createOrderAuthoritative` (ACID Transaction for stock, slot capacity, queue)
- Phase 4: Atomic wallet deduction, transaction recording, guardian push alert
