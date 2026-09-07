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
 *     leaves a bare Firebase error page in an orphaned tab. This one has a way out:
 *     AuthContext catches it and retries in the same tab with signInWithRedirect.
 *
 *   authDomain = an origin Google has not been told about
 *     Google validates redirect_uri against the OAuth client's registered list
 *     BEFORE Firebase is involved at all, and refuses with
 *     "Error 400: redirect_uri_mismatch". There is no fallback: the user never
 *     reaches the app, and nothing in the app's code runs to rescue them.
 *
 * The second failure is strictly worse, so the rule here is built to make it
 * unreachable by accident:
 *
 *   1. Firebase serves and pre-registers <project>.firebaseapp.com and
 *      <project>.web.app. Those are the only origins guaranteed to satisfy Google
 *      without anyone touching a console, so they are the only ones taken freely —
 *      either from the app's own host (same-origin, which also fixes Safari) or
 *      from an explicit setting.
 *
 *   2. Any OTHER configured authDomain is refused unless the deployment states
 *      that it registered the handler with Google. Setting
 *      VITE_FIREBASE_AUTH_DOMAIN alone used to win outright; that is exactly how a
 *      deployment ends up serving redirect_uri_mismatch to every user, because the
 *      variable looks like the whole job and it is only one of three steps.
 *
 * Pointing a custom domain at the handler needs ALL THREE, and no two are enough:
 *   1. /__/auth/* proxied to <project>.firebaseapp.com (see vercel.json), and
 *   2. https://<host>/__/auth/handler added to Google Cloud Console → Credentials →
 *      OAuth 2.0 Client IDs → Authorised redirect URIs, and
 *   3. VITE_FIREBASE_AUTH_HANDLER_REGISTERED=true, which is how step 2 — the one
 *      thing no code can verify from here — is asserted to this module.
 *
 * Kept as its own module, free of the Firebase SDK, so the rule can be tested
 * directly rather than asserted against the text of config.js.
 */

export const DEFAULT_AUTH_DOMAIN = "queueup-65e82.firebaseapp.com";

/**
 * Origins Firebase serves itself. The handler is already deployed there and its
 * redirect URI is already on the OAuth client, so neither failure mode applies.
 *
 * Matched on the dot-prefixed suffix: a bare endsWith("firebaseapp.com") would also
 * accept "evil-firebaseapp.com".
 */
const FIREBASE_SERVED_SUFFIXES = [".firebaseapp.com", ".web.app"];

function isFirebaseServed(host) {
  return FIREBASE_SERVED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * The full decision, including why — so the caller can say something useful when a
 * setting is being ignored, instead of silently doing something other than what the
 * deployment asked for.
 *
 * @param {string|undefined} host - window.location.hostname, or undefined off-browser
 * @param {string|undefined} configured - VITE_FIREBASE_AUTH_DOMAIN, if set
 * @param {{handlerRegistered?: unknown}} [options]
 *   handlerRegistered - VITE_FIREBASE_AUTH_HANDLER_REGISTERED: the deployment's
 *   assertion that <configured>/__/auth/handler is on the OAuth client's list of
 *   authorised redirect URIs.
 * @returns {{authDomain: string, source: string, warning: string|null}}
 */
export function explainAuthDomainChoice(host, configured, options = {}) {
  const wanted = typeof configured === "string" ? configured.trim() : "";
  // Accepts the string "true" because Vite env values arrive as strings.
  const registered = options.handlerRegistered === true || options.handlerRegistered === "true";

  if (wanted) {
    if (isFirebaseServed(wanted)) {
      return { authDomain: wanted, source: "configured-firebase-domain", warning: null };
    }
    if (registered) {
      return { authDomain: wanted, source: "configured-registered-custom-domain", warning: null };
    }
    return {
      authDomain: DEFAULT_AUTH_DOMAIN,
      source: "default-override-refused",
      warning:
        `VITE_FIREBASE_AUTH_DOMAIN="${wanted}" was ignored and sign-in is using ` +
        `${DEFAULT_AUTH_DOMAIN} instead. Google rejects a redirect_uri it has not been ` +
        `told about ("Error 400: redirect_uri_mismatch") before Firebase can do anything ` +
        `about it, so a custom auth domain is only used once the deployment confirms the ` +
        `handler is registered. To use "${wanted}": add ` +
        `https://${wanted}/__/auth/handler to Google Cloud Console → Credentials → ` +
        `OAuth 2.0 Client IDs → Authorised redirect URIs, then set ` +
        `VITE_FIREBASE_AUTH_HANDLER_REGISTERED=true.`,
    };
  }

  if (typeof host !== "string" || !host) {
    return { authDomain: DEFAULT_AUTH_DOMAIN, source: "default-no-host", warning: null };
  }

  // Same-origin AND pre-registered with Google — the only hosts that get both.
  if (isFirebaseServed(host)) {
    return { authDomain: host, source: "same-origin-firebase-domain", warning: null };
  }

  return { authDomain: DEFAULT_AUTH_DOMAIN, source: "default-custom-host", warning: null };
}

/**
 * @param {string|undefined} host - window.location.hostname, or undefined off-browser
 * @param {string|undefined} configured - VITE_FIREBASE_AUTH_DOMAIN, if set
 * @param {{handlerRegistered?: unknown}} [options]
 * @returns {string} the authDomain to hand to initializeApp
 */
export function resolveAuthDomainForHost(host, configured, options = {}) {
  return explainAuthDomainChoice(host, configured, options).authDomain;
}
