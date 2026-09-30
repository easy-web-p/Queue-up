/**
 * Where this deployment sends a customer back to.
 *
 * The Stripe Checkout session's success_url and cancel_url used to be built from
 * `req.headers.origin || req.headers.referer || req.body.returnUrl`. All three
 * belong to whoever called the endpoint, so a session could be created that
 * sends the paying customer to any host on earth the moment the payment goes
 * through — leaving a genuine stripe.com page, carrying the checkout session id
 * and the order id with them. Nothing here is taken from the caller's page.
 *
 * Set APP_URL (or ALLOWED_ORIGINS) on a deployment to pin it. With neither, the
 * host this request was routed to is used, which is the platform's own value
 * rather than anything the calling page chose.
 */

/** Trims a trailing slash and rejects anything that is not an http(s) origin. */
function normaliseOrigin(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/\s]+$/.test(trimmed) ? trimmed : null;
}

/** Origins this deployment has been told it serves, in order of preference. */
export function configuredOrigins() {
  return [process.env.APP_URL, ...String(process.env.ALLOWED_ORIGINS || '').split(',')]
    .map(normaliseOrigin)
    .filter(Boolean);
}

/**
 * @param {import('express').Request} req
 * @returns {string} An origin with no trailing slash.
 */
export function resolveAppBaseUrl(req) {
  const configured = configuredOrigins();

  if (configured.length > 0) {
    // Honour the calling origin only when it is one this deployment serves, so a
    // multi-domain setup still returns people to the domain they started on.
    const requestOrigin = normaliseOrigin(req?.headers?.origin);
    return requestOrigin && configured.includes(requestOrigin) ? requestOrigin : configured[0];
  }

  const host = String(req?.headers?.host || '').trim();
  if (/^[^/\s]+$/.test(host)) {
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
    return `${isLocal ? 'http' : 'https'}://${host}`;
  }

  return 'http://localhost:3000';
}
