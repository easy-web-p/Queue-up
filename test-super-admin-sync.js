/**
 * ============================================================================
 * SUPER-ADMIN SINGLE-SOURCE TEST SUITE
 * ============================================================================
 *
 * The three super-admin emails used to be typed out twice — once in
 * src/utils/authRoles.js and once in firestore.rules — with nothing binding
 * them. Two hand-maintained copies of a permission list drift silently, and the
 * failure is asymmetric: if the client copy grows an address the rules copy
 * lacks, the app hands someone an admin console that every read then refuses;
 * if the rules copy grows one the client lacks, the rules grant admin to
 * someone the app never shows as admin.
 *
 * config/super-admins.js is now the source. The client imports it. The rules
 * and the Cloud Functions carry generated copies, because neither can import
 * anything. This suite is what makes "generated" true rather than aspirational.
 */

import { readFileSync } from "node:fs";
import {
  readCanonicalEmails,
  buildExpected,
  renderRulesFragment,
  renderFunctionsModule,
} from "./scripts-sync-admins.js";
import { SUPER_ADMIN_EMAILS as FUNCTIONS_COPY } from "./functions/superAdmins.js";
import { isBootstrapSuperAdmin } from "./functions/superAdmins.js";

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}\n       ${err.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n       expected: ${expected}\n       actual:   ${actual}`);
  }
}

console.log("\n🔑 Super-admin list is generated, not copied");

const canonical = readCanonicalEmails();

runTest("The canonical list is well-formed", () => {
  assert(canonical.length > 0, "an empty root of trust locks everyone out of admin");
  for (const e of canonical) {
    assertEqual(e, e.toLowerCase().trim(), `${e} must be stored lowercase and trimmed`);
  }
});

runTest("🚨 firestore.rules matches the source (run: npm run sync:admins)", () => {
  const expected = buildExpected(canonical).rules;
  const actual = readFileSync(expected.path, "utf8");
  assert(
    actual === expected.next,
    "firestore.rules has drifted from config/super-admins.js — the rules would grant a\n" +
      "       different set of people admin than the app shows an admin console to."
  );
});

runTest("🚨 functions/superAdmins.js matches the source (run: npm run sync:admins)", () => {
  const expected = buildExpected(canonical).functions;
  const actual = readFileSync(expected.path, "utf8");
  assert(actual === expected.next, "functions/superAdmins.js has drifted from config/super-admins.js");
});

runTest("🚨 Every canonical email actually appears in the rules", () => {
  // Not just "the file matches what the generator would write" — the generator
  // could be wrong. Check the emails are really in the shipped rules text.
  const rules = readFileSync(new URL("./firestore.rules", import.meta.url), "utf8");
  const isAdminFn = rules.slice(rules.indexOf("function isAdmin()"));
  const body = isAdminFn.slice(0, isAdminFn.indexOf("\n    }"));
  for (const email of canonical) {
    assert(body.includes(`'${email}'`), `${email} is not honoured by the rules' isAdmin()`);
  }
});

runTest("🚨 The rules grant admin to nobody outside the canonical list", () => {
  const rules = readFileSync(new URL("./firestore.rules", import.meta.url), "utf8");
  const isAdminFn = rules.slice(rules.indexOf("function isAdmin()"));
  const body = isAdminFn.slice(0, isAdminFn.indexOf("\n    }"));
  const quoted = (body.match(/'[^']*@[^']*'/g) || []).map((q) => q.slice(1, -1));
  for (const email of quoted) {
    assert(canonical.includes(email), `${email} grants admin in the rules but is not in the source`);
  }
  assertEqual(quoted.length, canonical.length, "the rules list a different number of emails than the source");
});

runTest("The functions copy carries the same list", () => {
  assertEqual(FUNCTIONS_COPY.join(","), canonical.join(","), "functions copy differs from the source");
});

runTest("isBootstrapSuperAdmin accepts the list and rejects near misses", () => {
  for (const e of canonical) {
    assert(isBootstrapSuperAdmin(e), `${e} must be recognised`);
    assert(isBootstrapSuperAdmin(`  ${e.toUpperCase()}  `), `${e} must survive case and padding`);
  }
  for (const bad of [
    "",
    null,
    undefined,
    123,
    "attacker@example.com",
    `${canonical[0]}.evil.com`,
    `evil${canonical[0]}`,
  ]) {
    assert(!isBootstrapSuperAdmin(bad), `${String(bad)} must NOT be treated as a super admin`);
  }
});

runTest("🚨 No hand-written copy of the list survives anywhere", () => {
  // The whole point. If any source file still types an email out, this design
  // has a third copy and we are back where we started.
  const files = [
    "src/utils/authRoles.js",
    "functions/index.js",
    "functions/walletAuthority.js",
  ];
  for (const rel of files) {
    const src = readFileSync(new URL(`./${rel}`, import.meta.url), "utf8");
    for (const email of canonical) {
      assert(!src.includes(email), `${rel} still hardcodes ${email} — import it instead`);
    }
  }
});

runTest("A changed source really would change both generated copies", () => {
  // Guards against a generator that ignores its input and echoes the file back.
  const pretend = ["someone-else@example.ac.th"];
  const rulesFragment = renderRulesFragment(pretend);
  const functionsModule = renderFunctionsModule(pretend);
  assert(rulesFragment.includes("someone-else@example.ac.th"), "rules generator ignores its input");
  assert(functionsModule.includes("someone-else@example.ac.th"), "functions generator ignores its input");
  for (const email of canonical) {
    assert(!rulesFragment.includes(email), "rules generator leaked the real list into a different input");
    assert(!functionsModule.includes(email), "functions generator leaked the real list into a different input");
  }
});

console.log(`\n${"=".repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) process.exit(1);
