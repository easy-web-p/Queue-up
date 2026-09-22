/**
 * ============================================================================
 * 🔑 SUPER-ADMIN LIST SYNC
 * ============================================================================
 *
 * config/super-admins.js is the root of trust: the identities that hold admin
 * before any admin exists to grant it. It has to be readable in three places
 * that cannot share code —
 *
 *   • the browser  → src/utils/authRoles.js imports the JSON directly
 *   • the rules    → firestore.rules has no imports at all
 *   • the backend  → functions/ deploys on its own, so it cannot reach ../config
 *
 * The last two therefore carry generated copies, written between markers by this
 * script. Editing them by hand is the failure this exists to prevent: the list
 * lived in two hand-maintained copies before, and nothing would have caught the
 * day they stopped agreeing — the client would offer an admin screen that the
 * rules then refused, or worse, the reverse.
 *
 *   npm run sync:admins   regenerate the copies
 *   npm run test:admins   fail if they have drifted
 */

import { readFileSync, writeFileSync } from "node:fs";
import { SUPER_ADMIN_EMAILS as CANONICAL } from "./config/super-admins.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export const SOURCE_PATH = join(root, "config", "super-admins.js");

export function readCanonicalEmails() {
  const emails = CANONICAL;
  if (!Array.isArray(emails) || emails.length === 0) {
    throw new Error("config/super-admins.js: SUPER_ADMIN_EMAILS must be a non-empty array");
  }
  for (const e of emails) {
    if (typeof e !== "string" || !e.includes("@") || e !== e.toLowerCase().trim()) {
      throw new Error(`config/super-admins.js: "${e}" must be a lowercase, trimmed email`);
    }
  }
  if (new Set(emails).size !== emails.length) {
    throw new Error("config/super-admins.js: duplicate email");
  }
  return emails;
}

const BEGIN = "// <<< GENERATED super-admins — edit config/super-admins.js, then: npm run sync:admins";
const END = "// >>> END GENERATED super-admins";

const RULES_BEGIN = "        " + BEGIN;
const RULES_END = "        " + END;

/** The rules-language fragment: an `in` list of quoted emails. */
export function renderRulesFragment(emails) {
  const list = emails.map((e) => `'${e}'`).join(", ");
  return [
    RULES_BEGIN,
    `        (request.auth.token.get('email', '') in [${list}])`,
    RULES_END,
  ].join("\n");
}

/** The functions-side module body. */
export function renderFunctionsModule(emails) {
  return `/**
 * ⚠️  GENERATED FILE — do not edit.
 *
 * Source: config/super-admins.js   Regenerate: npm run sync:admins
 *
 * Cloud Functions deploy from functions/ alone, so this directory cannot import
 * the canonical module one level up. The list is copied in instead, and
 * test-super-admin-sync.js fails the build if this copy drifts from the source.
 */

export const SUPER_ADMIN_EMAILS = Object.freeze([
${emails.map((e) => `  ${JSON.stringify(e)},`).join("\n")}
]);

/**
 * Is this the bootstrap root of trust?
 *
 * Used only where a decision must be possible before any admin claim exists —
 * granting the very first staff role. Everywhere else, authority comes from a
 * verified custom claim.
 */
export function isBootstrapSuperAdmin(email) {
  if (typeof email !== "string") return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
`;
}

function replaceRegion(source, begin, end, replacement, label) {
  const from = source.indexOf(begin);
  const to = source.indexOf(end);
  if (from < 0 || to < 0 || to < from) {
    throw new Error(`${label}: generated region markers are missing or out of order`);
  }
  return source.slice(0, from) + replacement + source.slice(to + end.length);
}

export function buildExpected(emails) {
  const rulesPath = join(root, "firestore.rules");
  const functionsPath = join(root, "functions", "superAdmins.js");
  return {
    rules: {
      path: rulesPath,
      next: replaceRegion(
        readFileSync(rulesPath, "utf8"),
        RULES_BEGIN,
        RULES_END,
        renderRulesFragment(emails),
        "firestore.rules"
      ),
    },
    functions: { path: functionsPath, next: renderFunctionsModule(emails) },
  };
}

// Run as a script: write the copies.
if (process.argv[1] && process.argv[1].endsWith("scripts-sync-admins.js")) {
  const emails = readCanonicalEmails();
  const expected = buildExpected(emails);
  for (const { path, next } of Object.values(expected)) {
    writeFileSync(path, next, "utf8");
    console.log(`  ✍️  ${path.replace(root + "/", "")}`);
  }
  console.log(`\n✅ ${emails.length} super-admin email(s) synced from config/super-admins.js`);
}
