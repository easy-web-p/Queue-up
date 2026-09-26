import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 8123);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Some environments ship a Chromium build that does not match the revision this
 * Playwright version would download. Using the one that is already there beats
 * failing every test with "browser not found" — and beats downloading a second
 * copy of Chromium on a machine that has one.
 */
const preinstalledChromium = [
  process.env.PLAYWRIGHT_CHROMIUM_PATH,
  process.env.PLAYWRIGHT_BROWSERS_PATH ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` : null
].find((candidate) => candidate && existsSync(candidate));

/**
 * End-to-end smoke suite.
 *
 * Runs the real Express server against the real production build, so it catches
 * what the unit suites cannot: a lazy chunk that fails to resolve, a Content
 * Security Policy that blocks the app's own scripts, a route guard that white-
 * screens instead of redirecting.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: { executablePath: preinstalledChromium || undefined }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node server.js',
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: 'development',
      ALLOW_MOCK_AUTH: 'true',
      // Enforce the CSP during E2E so a directive that would break the app in
      // production fails the suite here instead of in front of users.
      CSP_ENFORCE: 'true'
    }
  }
});
