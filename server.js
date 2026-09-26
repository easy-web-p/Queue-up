import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { orderRouter } from './server/routes/orderRoutes.js';
import { paymentRouter } from './server/routes/paymentRoutes.js';
import { webhookRouter } from './server/routes/webhookRoutes.js';
import { merchantRouter } from './server/routes/merchantRoutes.js';
import { walletRouter } from './server/routes/walletRoutes.js';
import { notificationRouter } from './server/routes/notificationRoutes.js';
import { capacityRouter } from './server/routes/capacityRoutes.js';
import { chatRouter } from './server/routes/chatRoutes.js';
import { startPickupReminderWorker } from './server/services/pickupReminderWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');

// Ensure dist exists before serving
if (!fs.existsSync(indexPath)) {
  console.log('[Server] Dist not found, building applet...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('[Server] Build completed successfully.');
  } catch (err) {
    console.error('[Server] Build failed:', err);
  }
}

// 1. Mount Webhook routes with RAW body parser BEFORE express.json()
// This is strictly required by Stripe to verify webhook cryptographic signatures.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRouter);

// 2. Parse JSON body for all standard API requests
app.use(express.json());

// Health check endpoint for Cloud Run
app.get(['/healthz', '/_health', '/api/health'], (req, res) => {
  res.status(200).send('OK');
});

// 3. Mount Command & Financial API routes
app.use('/api/orders', orderRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/merchant', merchantRouter);
app.use('/api/merchant', walletRouter);
app.use('/api/capacity', capacityRouter);
app.use('/api/chat', chatRouter);
app.use('/api', notificationRouter);

// Explicit route for Firebase Messaging Service Worker (prevents SPA rewrite hijacking)
app.get('/firebase-messaging-sw.js', (req, res) => {
  const swDistPath = path.join(distDir, 'firebase-messaging-sw.js');
  const swPublicPath = path.join(__dirname, 'public', 'firebase-messaging-sw.js');
  const targetPath = fs.existsSync(swDistPath) ? swDistPath : swPublicPath;

  if (fs.existsSync(targetPath)) {
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(targetPath);
  } else {
    res.status(404).send('Service worker file not found');
  }
});

// Serve static assets from dist
app.use(express.static(distDir, {
  maxAge: '1h',
  index: false
}));

// SPA routing fallback
app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Application build in progress or failed. Please refresh shortly.');
  }
});

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

const targetPort = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : DEFAULT_PORT;

startServer(targetPort);

process.on('unhandledRejection', (reason, promise) => {
  console.warn('[QueueUp Server] Unhandled Promise Rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('[QueueUp Server] Uncaught Exception:', err?.message || err);
});
