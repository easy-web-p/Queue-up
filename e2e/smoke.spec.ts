import { test, expect, type Page } from '@playwright/test';

/**
 * Collects console errors and failed requests, filtering out the noise this
 * environment produces regardless of the build: the container has no route to
 * Firebase, so SDK connection failures are expected and are not what this
 * suite is checking.
 */
function collectPageProblems(page: Page) {
  const consoleErrors: string[] = [];
  const cspViolations: string[] = [];
  const failedAppRequests: string[] = [];

  const isExternalService = (text: string) =>
    /googleapis\.com|firebaseio\.com|firebaseinstallations|gstatic\.com|fonts\.googleapis|jsdelivr|unsplash|firestore|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_PROXY/i.test(text);

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Content Security Policy|Refused to (load|execute|apply|connect)/i.test(text)) {
      cspViolations.push(text);
      return;
    }
    if (isExternalService(text)) return;
    consoleErrors.push(text);
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (isExternalService(url)) return;
    // Only the app's own assets matter here.
    if (!url.includes('127.0.0.1')) return;
    failedAppRequests.push(`${url} — ${request.failure()?.errorText}`);
  });

  return { consoleErrors, cspViolations, failedAppRequests };
}

test.describe('QueueUp production build', () => {
  test('serves the landing page without a white screen', async ({ page }) => {
    const problems = collectPageProblems(page);

    await page.goto('/landing', { waitUntil: 'domcontentloaded' });

    const root = page.locator('#root');
    await expect(root).not.toBeEmpty({ timeout: 20_000 });
    await expect(page).toHaveTitle(/QueueUp/i);

    expect(problems.cspViolations, 'enforced CSP blocked the app\'s own resources').toEqual([]);
    expect(problems.failedAppRequests, 'an app asset failed to load').toEqual([]);
  });

  test('loads a lazily split route on demand', async ({ page }) => {
    const chunkRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (/\/assets\/.*\.js$/.test(url)) chunkRequests.push(url);
    });

    await page.goto('/landing', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 });
    const initialChunks = chunkRequests.length;

    // /about is a lazy() route, so visiting it must pull a chunk that the
    // landing page did not already load.
    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 });

    expect(chunkRequests.length).toBeGreaterThan(initialChunks);
    expect(chunkRequests.some((url) => /Queueup/i.test(url))).toBe(true);
  });

  test('redirects a signed-out visitor away from a protected route', async ({ page }) => {
    await page.goto('/kds', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/landing$/, { timeout: 15_000 });
  });

  test('sends security headers on the document response', async ({ page }) => {
    const response = await page.goto('/landing', { waitUntil: 'domcontentloaded' });
    const headers = response!.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
  });

  test('answers an unknown API path with JSON, not the SPA shell', async ({ request }) => {
    const response = await request.get('/api/definitely-not-a-route');
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toMatchObject({ success: false, error: 'NOT_FOUND' });
  });

  test('refuses an unauthenticated payout request', async ({ request }) => {
    const response = await request.post('/api/merchant/payouts', {
      data: { storeId: 'store-1', amountSatang: 100000 }
    });
    expect(response.status()).toBe(401);
  });
});
