/**
 * ============================================================================
 * 🔑 SUPER ADMINS — THE BOOTSTRAP ROOT OF TRUST
 * ============================================================================
 *
 * The identities that hold admin before any admin exists to grant it. This is
 * THE source; edit it here and nowhere else.
 *
 *   src/utils/authRoles.js   imports this file directly
 *   firestore.rules          carries a generated copy (the rules language has no imports)
 *   functions/superAdmins.js carries a generated copy (Cloud Functions deploy from functions/ alone)
 *
 * After editing:  npm run sync:admins
 * To verify:      npm run test:admins   (fails if the copies have drifted)
 *
 * A .js module rather than .json so both Vite and plain Node can import it
 * without an import attribute — the JSON version built fine but broke every
 * Node-run test that reached authRoles.js.
 */

export const SUPER_ADMIN_EMAILS = [
  "58140@lomsak.ac.th",
  "hi00000087@gmail.com",
  "easy.web.p@gmail.com",
];

export default SUPER_ADMIN_EMAILS;
