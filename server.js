/**
 * Standalone server entry point.
 *
 * Used by local development, Cloud Run, and any platform that runs a
 * long-lived process. Serverless deployments import the app factory directly
 * (see api/index.js) and never reach this file.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createApp } from './server/app.js';
import { startPickupReminderWorker } from './server/services/pickupReminderWorker.js';
import { isProduction } from './server/config/secrets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, 'dist', 'index.html');

// Ensure dist exists before serving. A production image is expected to have
// been built already; rebuilding at boot there would mask a broken deployment
// and needs dev dependencies that a runtime image may not carry.
if (!fs.existsSync(indexPath)) {
  if (isProduction) {
    console.error('[Server] dist/index.html is missing. Run `npm run build` before deploying.');
  } else {
    console.log('[Server] Dist not found, building applet...');
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log('[Server] Build completed successfully.');
    } catch (err) {
      console.error('[Server] Build failed:', err);
    }
  }
}

const app = createApp({ serveStatic: true });

// The vite dev server owns port 3000 and proxies /api here, so the API must
// not default to the same port.
const DEFAULT_PORT = 8080;

function startServer(preferredPort) {
  const server = app.listen(preferredPort, '0.0.0.0', () => {
    console.log(`[QueueUp Server] Running on http://0.0.0.0:${preferredPort}`);
    // Start background Pickup Reminder worker
    startPickupReminderWorker(60000);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = preferredPort + 1;
      console.warn(`[QueueUp Server] Port ${preferredPort} in use, trying fallback port ${fallbackPort}...`);
      const fallbackServer = app.listen(fallbackPort, '0.0.0.0', () => {
        console.log(`[QueueUp Server] Running on http://0.0.0.0:${fallbackPort}`);
      });
      fallbackServer.on('error', (fallbackErr) => {
        console.error(`[QueueUp Server] Fallback port ${fallbackPort} error:`, fallbackErr);
      });
    } else {
      console.error('[QueueUp Server] Server error:', err);
    }
  });
}

const targetPort = process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;

startServer(targetPort);

process.on('unhandledRejection', (reason) => {
  console.warn('[QueueUp Server] Unhandled Promise Rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('[QueueUp Server] Uncaught Exception:', err?.message || err);
});
