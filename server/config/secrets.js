/**
 * Centralised secret resolution with fail-fast semantics.
 *
 * Rule: a secret NEVER silently falls back to a hardcoded value in production.
 * Shipping a default here means the value is public (it lives in git), so any
 * signature derived from it is forgeable by anyone who can read the repository.
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Required secrets that were absent at boot.
 *
 * Throwing on the first missing one takes the whole function down, including
 * the health probe that would have named it — which is how a misconfigured
 * deployment turns into an opaque 500. Recording it instead lets the API
 * readiness guard refuse requests with the name in the response while the
 * probe keeps answering.
 */
const missing = new Set();

/** Names of required secrets this process is missing. */
export function missingRequiredSecrets() {
  return Array.from(missing);
}

/**
 * Reads a required secret from the environment.
 * In production a missing value throws at boot so the process never starts in a
 * state where it silently signs with a known-public key. Outside production a
 * clearly-labelled development value is used instead.
 *
 * @param {string} name Environment variable name
 * @param {string} devFallback Value used only when NODE_ENV !== 'production'
 * @returns {string}
 */
export function requireSecret(name, devFallback) {
  const value = process.env[name];
  if (value && value.trim()) {
    missing.delete(name);
    return value.trim();
  }

  if (isProduction) {
    missing.add(name);
    console.error(
      `[Config] Missing required environment variable ${name}. ` +
      'API requests are refused until it is set.'
    );
    // Returning null rather than the development value guarantees nothing can
    // sign or verify with a placeholder: any caller that slipped past the
    // readiness guard fails loudly instead.
    return null;
  }

  console.warn(
    `[Config] ${name} is not set — using an insecure development value. ` +
    `This would abort startup with NODE_ENV=production.`
  );
  return devFallback;
}

/**
 * Reads an optional secret. Returns null when unset so callers can degrade
 * explicitly instead of constructing a client with a bogus credential.
 *
 * @param {string} name Environment variable name
 * @returns {string|null}
 */
export function optionalSecret(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export { isProduction };
