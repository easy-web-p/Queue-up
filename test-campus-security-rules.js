// test-campus-security-rules.js
// Verification suite for QueueUp for Campus Firestore Security Rules

import fs from 'fs';
import assert from 'assert';

console.log('🧪 Starting QueueUp for Campus Security Rules Test Matrix...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] Test ${totalTests}: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] Test ${totalTests}: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

// 1. Helper function isStaffSupervisor check
runTest('firestore.rules contains isStaffSupervisor helper checking role claims', () => {
  assert(rulesContent.includes('function isStaffSupervisor()'), 'Missing isStaffSupervisor function');
  assert(rulesContent.includes("request.auth.token.role == 'staff_supervisor'"), 'Missing role claim check for staff_supervisor');
});

// 2. /wallets collection security check
runTest('/wallets collection has "allow write: if false;" (Cloud Functions only)', () => {
  const walletSection = rulesContent.substring(rulesContent.indexOf('match /wallets/{studentId}'));
  assert(walletSection.includes('allow write: if false;'), 'Wallets must have allow write: if false;');
  assert(walletSection.includes('request.auth.uid in resource.data.guardianIds'), 'Wallets must allow guardian read access');
});

// 3. /wallet_transactions collection security check
runTest('/wallet_transactions collection has "allow write: if false;" (Immutable ledger)', () => {
  const txSection = rulesContent.substring(rulesContent.indexOf('match /wallet_transactions/{txId}'));
  assert(txSection.includes('allow write: if false;'), 'Transactions must have allow write: if false;');
});

// 4. /students collection security check
runTest('/students collection restricts mutations to staff supervisors or admins', () => {
  const studentSection = rulesContent.substring(rulesContent.indexOf('match /students/{studentId}'));
  assert(studentSection.includes('allow create, update, delete: if isStaffSupervisor() || isAdmin();'), 'Student mutations must be staff or admin only');
});

// 5. /parent_child_links collection security check
runTest('/parent_child_links allows creation only with PENDING status by authenticated guardian', () => {
  const linkSection = rulesContent.substring(rulesContent.indexOf('match /parent_child_links/{linkId}'));
  assert(linkSection.includes("request.resource.data.status == 'PENDING'"), 'Link creation must start with PENDING status');
  assert(linkSection.includes('allow update: if isStaffSupervisor() || isAdmin();'), 'Link approval must be staff or admin only');
});

// 6. /vendor_approvals collection security check
runTest('/vendor_approvals restricts update permissions to staff supervisor or admin', () => {
  const vendorSection = rulesContent.substring(rulesContent.indexOf('match /vendor_approvals/{requestId}'));
  assert(vendorSection.includes("request.resource.data.status == 'PENDING'"), 'Vendor approval creation must be PENDING');
  assert(vendorSection.includes('allow update: if isStaffSupervisor() || isAdmin();'), 'Vendor approval update must be staff or admin only');
});

// 7. /staff_supervisors directory security check
runTest('/staff_supervisors directory write access is restricted to admins only', () => {
  const staffSection = rulesContent.substring(rulesContent.indexOf('match /staff_supervisors/{staffId}'));
  assert(staffSection.includes('allow write: if isAdmin();'), 'Staff supervisor write must be admin only');
});

console.log(`\n📊 Campus Security Rules Summary: ${passedTests}/${totalTests} tests passed (100%).\n`);
