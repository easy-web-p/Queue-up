/// <reference types="vite/client" />

/**
 * The environment variables this app reads, typed.
 *
 * Vite inlines every VITE_* variable into the client bundle, so this list is
 * also the list of things that ship to every visitor's browser. Nothing secret
 * belongs here — server-side secrets are Cloud Functions secrets
 * (`firebase functions:secrets:set`), and .env.example says so at length.
 *
 * Each is optional because a deployment may legitimately leave it unset, and
 * code that assumes otherwise breaks at runtime rather than here.
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_AUTH_HANDLER_REGISTERED?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  /** Stripe's PUBLISHABLE key (pk_…), which is public by design. Never sk_…. */
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
