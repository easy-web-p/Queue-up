/**
 * Centralised secret resolution with fail-fast semantics.
 *
 * Rule: a secret NEVER silently falls back to a hardcoded value in production.
 * Shipping a default here means the value is public (it lives in git), so any
 * signature derived from it is forgeable by anyone who can read the repository.
 */

const isProduction = process.env.NODE_ENV === 'production';

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
  if (value && value.trim()) return value.trim();

  if (isProduction) {
    throw new Error(
      `[Config] Missing required environment variable ${name}. ` +
      `Set it before starting the server in production.`
    );
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
