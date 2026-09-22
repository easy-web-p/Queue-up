import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
for (const r of ['/', '/queueup', '/login', '/pdpa', '/home', '/product', '/admin', '/nope404']) {
  await p.goto('http://localhost:4173' + r, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1800);
  const t = ((await p.textContent('body').catch(() => '')) || '').trim();
  console.log(r.padEnd(12), String(t.length).padStart(6), '|', t.replace(/\s+/g, ' ').slice(0, 70));
}
await b.close();
