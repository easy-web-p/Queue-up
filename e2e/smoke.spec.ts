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
    /googleapis\.com|firebaseio\.com|firebaseinstallations|gstatic\.com|fonts\.googleapis|googletagmanager\.com|google-analytics\.com|analytics\.google\.com|jsdelivr|unsplash|firestore|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_PROXY/i.test(text);

  // Compared by host, not by substring. The analytics beacon carries the page it
  // is reporting on inside its query string (dl=http%3A%2F%2F127.0.0.1%2F...),
  // so a substring check read Google's host as one of the app's own assets and
  // failed the test for a third-party request this environment cannot reach.
  const isAppAsset = (url: string) => {
    try {
      return new URL(url).hostname === '127.0.0.1';
    } catch {
      return false;
    }
  };

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
    if (!isAppAsset(url)) return;
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

    // Firebase Analytics is imported dynamically, so its gtag.js load lands
    // after first paint. Without waiting for it, whether this test saw the
    // violation came down to timing — it passed locally and failed in CI on the
    // same policy. Bounded, because analytics is optional: if it never loads
    // there is simply nothing more to check.
    await page.waitForRequest(/googletagmanager\.com/, { timeout: 4_000 }).catch(() => {});
    await page.waitForTimeout(250);

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

  test('keeps a merchant-only page away from a customer account', async ({ page }) => {
    // The app restores a cached session synchronously on first render, so
    // seeding one lets this exercise the signed-in guards without Firebase.
    await page.addInitScript(() => {
      localStorage.setItem('queueup_session_v1', JSON.stringify({
        id: 'e2e-customer', fullName: 'ลูกค้าทดสอบ', email: 'customer@e2e.test',
        role: 'customer', registeredAt: new Date().toISOString()
      }));
    });

    await page.goto('/kds', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 });

    // Turned away, but told why — not bounced to the landing page as if the
    // session had expired.
    await expect(page.getByText('หน้านี้สำหรับร้านค้าเท่านั้น')).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/kds');
  });

  test('lets a merchant account into the kitchen display', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('queueup_session_v1', JSON.stringify({
        id: 'e2e-merchant', fullName: 'เจ้าของร้านทดสอบ', email: 'merchant@e2e.test',
        role: 'merchant', storeId: 'store-1', registeredAt: new Date().toISOString()
      }));
    });

    await page.goto('/kds', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 });
    await expect(page.getByText('หน้านี้สำหรับร้านค้าเท่านั้น')).toHaveCount(0);
  });

  test('keeps the admin dashboard away from a merchant account', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('queueup_session_v1', JSON.stringify({
        id: 'e2e-merchant', fullName: 'เจ้าของร้านทดสอบ', email: 'merchant@e2e.test',
        role: 'merchant', storeId: 'store-1', registeredAt: new Date().toISOString()
      }));
    });

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 20_000 });
    await expect(page.getByText('หน้านี้สำหรับผู้ดูแลระบบเท่านั้น')).toBeVisible({ timeout: 15_000 });
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
