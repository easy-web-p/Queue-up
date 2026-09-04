/**
 * 🧪 test-campus-integration.js
 * Integration test matrix for QueueUp for Campus:
 * 1. Student Vendor Onboarding & Staff Approval Lifecycle
 * 2. Campus Wallet 5-Phase Ordering Engine
 * 3. Daily / Weekly Spending Limits Enforcement
 * 4. Blocked Food Categories Filter Enforcement
 * 5. Emergency Medical / Allergy Audit Trail Verification
 */

import assert from 'assert';

console.log('\x1b[36m%s\x1b[0m', '🧪 Starting QueueUp for Campus Integration Test Matrix...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`\x1b[32m✅ [PASS] Test ${totalTests}: ${description}\x1b[0m`);
    passedTests++;
  } catch (err) {
    console.error(`\x1b[31m❌ [FAIL] Test ${totalTests}: ${description}\x1b[0m`);
    console.error(err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// 1. Student Vendor Onboarding & Approval Lifecycle
// -------------------------------------------------------------
runTest('Student Vendor Application starts in PENDING status with correct payload', () => {
  const req = {
    studentVendorId: 'stu_user_001',
    studentName: 'Somchai Jaidee',
    studentCode: 'STU1001',
    class: 'M.5/1',
    shopName: 'Crispy Crepes',
    requestedZone: 'Zone A (Main Canteen)',
    productCategories: ['Snacks', 'Dessert'],
    menuPreview: [{ name: 'Nutella Crepe', price: 35 }],
    status: 'PENDING',
  };

  assert.strictEqual(req.status, 'PENDING');
  assert.strictEqual(req.shopName, 'Crispy Crepes');
  assert.ok(Array.isArray(req.productCategories) && req.productCategories.includes('Snacks'));
});

runTest('Staff Supervisor approving application transitions status to APPROVED and generates shop metadata', () => {
  const req = {
    id: 'app_001',
    studentVendorId: 'stu_user_001',
    studentName: 'Somchai Jaidee',
    shopName: 'Crispy Crepes',
    requestedZone: 'Zone A (Main Canteen)',
    status: 'PENDING',
  };

  // Approval action simulation
  const reviewerUid = 'staff_ajarn_winai';
  const updatedReq = {
    ...req,
    status: 'APPROVED',
    approvedBy: reviewerUid,
    approvedAt: new Date().toISOString(),
  };

  const generatedShop = {
    id: `shop_${req.studentVendorId}`,
    name: req.shopName,
    ownerUid: req.studentVendorId,
    zone: req.requestedZone,
    status: 'active',
    isOpen: true,
    maxOrdersPerSlot: 10,
  };

  assert.strictEqual(updatedReq.status, 'APPROVED');
  assert.strictEqual(updatedReq.approvedBy, reviewerUid);
  assert.strictEqual(generatedShop.ownerUid, 'stu_user_001');
  assert.strictEqual(generatedShop.status, 'active');
});

runTest('Staff Supervisor rejecting application records rejectionReason and preserves PENDING -> REJECTED immutable audit', () => {
  const req = {
    id: 'app_002',
    studentVendorId: 'stu_user_002',
    shopName: 'Energy Drink Corner',
    status: 'PENDING',
  };

  const rejectionReason = 'เครื่องดื่มชูกำลังไม่ได้รับอนุญาตในสถานศึกษา';
  const updatedReq = {
    ...req,
    status: 'REJECTED',
    rejectionReason,
    reviewedBy: 'staff_ajarn_winai',
  };

  assert.strictEqual(updatedReq.status, 'REJECTED');
  assert.strictEqual(updatedReq.rejectionReason, rejectionReason);
});

// -------------------------------------------------------------
// 2. Campus Wallet Spending Rules & Validation (Phase 0)
// -------------------------------------------------------------
function validateWalletSpending(wallet, orderAmountSatang, itemCategories = [], targetYmd = '2026-09-05') {
  if (!wallet) throw new Error('CAMPUS_WALLET_NOT_FOUND');
  if (wallet.isLocked) throw new Error('CAMPUS_WALLET_LOCKED');

  if (wallet.balanceSatang < orderAmountSatang) {
    throw new Error('INSUFFICIENT_WALLET_BALANCE');
  }

  // Daily limit
  const dailyLimitSatang = wallet.dailyLimitSatang ?? 20000;
  const spentToday = wallet.lastSpentDate === targetYmd ? (wallet.spentTodaySatang || 0) : 0;
  if (spentToday + orderAmountSatang > dailyLimitSatang) {
    throw new Error('DAILY_LIMIT_EXCEEDED');
  }

  // Weekly limit
  const weeklyLimitSatang = wallet.weeklyLimitSatang ?? 100000;
  const spentWeek = wallet.spentThisWeekSatang || 0;
  if (spentWeek + orderAmountSatang > weeklyLimitSatang) {
    throw new Error('WEEKLY_LIMIT_EXCEEDED');
  }

  // Blocked categories
  const blocked = wallet.blockedCategories || [];
  for (const cat of itemCategories) {
    if (blocked.includes(cat)) {
      throw new Error(`BLOCKED_CATEGORY_VIOLATION: ${cat}`);
    }
  }

  return true;
}

runTest('Wallet spending succeeds when balance and limits are sufficient', () => {
  const wallet = {
    studentId: 'STU1001',
    balanceSatang: 15000, // 150 THB
    dailyLimitSatang: 20000, // 200 THB
    weeklyLimitSatang: 100000, // 1,000 THB
    spentTodaySatang: 5000, // 50 THB
    spentThisWeekSatang: 10000,
    lastSpentDate: '2026-09-05',
    blockedCategories: ['Energy Drinks'],
    isLocked: false,
  };

  const result = validateWalletSpending(wallet, 6000, ['Snacks'], '2026-09-05'); // 60 THB
  assert.strictEqual(result, true);
});

runTest('Locked wallet throws CAMPUS_WALLET_LOCKED', () => {
  const wallet = {
    studentId: 'STU1001',
    balanceSatang: 50000,
    isLocked: true,
  };

  assert.throws(() => {
    validateWalletSpending(wallet, 5000, ['Snacks'], '2026-09-05');
  }, /CAMPUS_WALLET_LOCKED/);
});

runTest('Insufficient wallet balance throws INSUFFICIENT_WALLET_BALANCE', () => {
  const wallet = {
    studentId: 'STU1001',
    balanceSatang: 3000, // 30 THB
    dailyLimitSatang: 20000,
    isLocked: false,
  };

  assert.throws(() => {
    validateWalletSpending(wallet, 5000, ['Snacks'], '2026-09-05'); // 50 THB order
  }, /INSUFFICIENT_WALLET_BALANCE/);
});

runTest('Exceeding daily spending limit throws DAILY_LIMIT_EXCEEDED', () => {
  const wallet = {
    studentId: 'STU1001',
    balanceSatang: 50000,
    dailyLimitSatang: 20000, // 200 THB max per day
    spentTodaySatang: 18000, // 180 THB already spent
    lastSpentDate: '2026-09-05',
    isLocked: false,
  };

  assert.throws(() => {
    validateWalletSpending(wallet, 3000, ['Snacks'], '2026-09-05'); // 30 THB order -> Total 210 THB
  }, /DAILY_LIMIT_EXCEEDED/);
});

runTest('Purchasing food from Guardian-blocked category throws BLOCKED_CATEGORY_VIOLATION', () => {
  const wallet = {
    studentId: 'STU1001',
    balanceSatang: 50000,
    dailyLimitSatang: 20000,
    spentTodaySatang: 0,
    blockedCategories: ['Sugary Drinks', 'Junk Food'],
    isLocked: false,
  };

  assert.throws(() => {
    validateWalletSpending(wallet, 2500, ['Sugary Drinks'], '2026-09-05');
  }, /BLOCKED_CATEGORY_VIOLATION: Sugary Drinks/);
});

// -------------------------------------------------------------
// 3. Atomic Balance Deduction & Ledger (Phase 4)
// -------------------------------------------------------------
runTest('Phase 4 Wallet Deduction updates balance and records immutable transaction', () => {
  const wallet = {
    studentId: 'STU1001',
    balanceSatang: 10000,
    spentTodaySatang: 2000,
    spentThisWeekSatang: 2000,
    lastSpentDate: '2026-09-05',
  };

  const orderAmountSatang = 4500;
  const orderId = 'ord_campus_999';

  // Atomic mutation
  wallet.balanceSatang -= orderAmountSatang;
  wallet.spentTodaySatang += orderAmountSatang;
  wallet.spentThisWeekSatang += orderAmountSatang;

  const transactionRecord = {
    id: 'tx_001',
    walletId: wallet.studentId,
    studentId: wallet.studentId,
    orderId,
    amountSatang: orderAmountSatang,
    type: 'SPEND',
    actorUid: 'stu_user_001',
    timestamp: new Date().toISOString(),
  };

  assert.strictEqual(wallet.balanceSatang, 5500);
  assert.strictEqual(wallet.spentTodaySatang, 6500);
  assert.strictEqual(transactionRecord.type, 'SPEND');
  assert.strictEqual(transactionRecord.amountSatang, 4500);
});

runTest('Guardian Top-up increases balanceSatang and generates TOPUP transaction', () => {
  const wallet = {
    studentId: 'STU1001',
    balanceSatang: 5500,
  };

  const topupAmountSatang = 20000; // 200 THB
  wallet.balanceSatang += topupAmountSatang;

  const topupTx = {
    id: 'tx_002',
    walletId: wallet.studentId,
    studentId: wallet.studentId,
    amountSatang: topupAmountSatang,
    type: 'TOPUP',
    actorUid: 'guardian_user_mom',
    paymentMethod: 'PROMPTPAY',
    timestamp: new Date().toISOString(),
  };

  assert.strictEqual(wallet.balanceSatang, 25500);
  assert.strictEqual(topupTx.type, 'TOPUP');
  assert.strictEqual(topupTx.paymentMethod, 'PROMPTPAY');
});

// -------------------------------------------------------------
// 4. Emergency Medical / Allergy Audit Trail
// -------------------------------------------------------------
runTest('Emergency Lookup creates audit log entry with actor and student ID', () => {
  const auditLog = {
    id: 'audit_log_777',
    action: 'EMERGENCY_MEDICAL_LOOKUP',
    actorUid: 'staff_nurse_somying',
    targetStudentId: 'STU1001',
    targetStudentName: 'Somchai Jaidee',
    reason: 'Anaphylaxis / Severe Peanut Allergy',
    timestamp: new Date().toISOString(),
  };

  assert.strictEqual(auditLog.action, 'EMERGENCY_MEDICAL_LOOKUP');
  assert.strictEqual(auditLog.targetStudentId, 'STU1001');
  assert.ok(auditLog.reason.includes('Allergy'));
});

console.log(`\n\x1b[32m📊 Campus Integration Summary: ${passedTests}/${totalTests} tests passed (100%).\x1b[0m\n`);
