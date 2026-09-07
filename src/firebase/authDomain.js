/**
 * ============================================================================
 * 🔑 WHICH ORIGIN SERVES THE FIREBASE AUTH HANDLER
 * ============================================================================
 *
 * Google sign-in fails in two different ways depending on this choice, and the two
 * pull against each other:
 *
 *   authDomain ≠ the app's origin
 *     Safari, and iOS/iPadOS Safari especially, partitions storage per origin. The
 *     popup lands on <authDomain>/__/auth/handler and cannot read the state the app
 *     wrote before opening it, so sign-in dies with auth/missing-initial-state and
 *     leaves a bare Firebase error page in an orphaned tab.
 *
 *   authDomain = a custom origin
 *     Google checks the redirect_uri against the OAuth client's registered list. A
 *     custom host is not on it, so Google refuses with
 *     "Error 400: redirect_uri_mismatch" before Firebase is ever involved.
 *
 * Serving the app from *.firebaseapp.com or *.web.app satisfies both at once: the
 * handler is same-origin AND already registered. That is what this returns for those
 * hosts, and why everything else falls back to the project's Firebase domain — the
 * cross-origin Safari problem is the lesser of the two, since it has a redirect
 * fallback while redirect_uri_mismatch has none.
 *
 * Pointing a custom domain at the handler needs BOTH, and neither alone is enough:
 *   1. /__/auth/* proxied to <project>.firebaseapp.com (see vercel.json), and
 *   2. https://<host>/__/auth/handler added to Google Cloud Console → Credentials →
 *      OAuth 2.0 Client IDs → Authorised redirect URIs.
 * Then set VITE_FIREBASE_AUTH_DOMAIN to that host; it overrides everything here.
 *
 * Kept as its own module, free of the Firebase SDK, so the rule can be tested
 * directly rather than asserted against the text of config.js.
 */

export const DEFAULT_AUTH_DOMAIN = "queueup-65e82.firebaseapp.com";

/**
 * @param {string|undefined} host - window.location.hostname, or undefined off-browser
 * @param {string|undefined} configured - VITE_FIREBASE_AUTH_DOMAIN, if set
 * @returns {string} the authDomain to hand to initializeApp
 */
export function resolveAuthDomainForHost(host, configured) {
  // An explicit setting is a deliberate deployment decision; it wins outright.
  if (typeof configured === "string" && configured.trim()) return configured.trim();

  if (typeof host !== "string" || !host) return DEFAULT_AUTH_DOMAIN;

  // Same-origin AND pre-registered with Google — the only hosts that get both.
  if (host.endsWith(".firebaseapp.com") || host.endsWith(".web.app")) return host;

  return DEFAULT_AUTH_DOMAIN;
}
