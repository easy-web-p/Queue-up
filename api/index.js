/**
 * Vercel serverless entry point for the whole API.
 *
 * vercel.json rewrites every /api/* request here. The built SPA is served by
 * Vercel's CDN from dist/, so this function handles API routes only and never
 * touches static files.
 *
 * The app is built once per warm instance rather than per request: Vercel keeps
 * a function instance alive between invocations, so rebuilding it every time
 * would re-run every router's module setup for nothing.
 */

import { createApp } from '../server/app.js';

const app = createApp({ serveStatic: false });

export default app;
