/**
 * Compares whole rendered pages between two builds, element by element.
 *
 *   node .vr/compare-pages.mjs snapshot <out.json>
 *   node .vr/compare-pages.mjs diff <a.json> <b.json>
 *
 * The gallery proves each class computes the same in isolation. This proves the
 * pages do — which also covers what the gallery cannot: Reboot's effect on
 * elements no utility class is applied to, and anything the cascade does only
 * when real markup is nested the way the app nests it.
 *
 * Elements are keyed by their position in the tree, so the two runs line up
 * without depending on ids or text.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROUTES = ['/', '/pdpa', '/login', '/queueup'];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];
const PROPS = [
  'display','position','flex-direction','align-items','justify-content','gap',
  'width','height','margin-top','margin-bottom','margin-left','margin-right',
  'padding-top','padding-bottom','padding-left','padding-right',
  'color','background-color','opacity','border-top-width','border-top-color','border-style',
  'border-top-left-radius','font-size','font-weight','font-family','line-height',
  'text-align','text-decoration-line','text-transform','box-shadow','overflow-x','overflow-y',
];

async function snapshot(out) {
  const browser = await chromium.launch({ executablePath: CHROME });
  const result = {};
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    for (const route of ROUTES) {
      await page.goto('http://localhost:4173' + route, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2200);

      // Freeze animation and transition. Without this the comparison reports
      // differences like `opacity: 0.949167 → 0.949159` — the same animation
      // sampled a few microseconds apart in two different runs, which says
      // nothing about the stylesheet.
      await page.addStyleTag({
        content: `*, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }`,
      });
      await page.waitForTimeout(150);

      result[`${vp.name}${route}`] = await page.evaluate((props) => {
        const rows = {};
        const walk = (el, path) => {
          const cs = getComputedStyle(el);
          rows[path] = props.map((p) => cs.getPropertyValue(p)).join('|');
          [...el.children].forEach((c, i) => walk(c, `${path}/${c.tagName.toLowerCase()}[${i}]`));
        };
        walk(document.body, 'body');
        return rows;
      }, PROPS);
    }
    await page.close();
  }
  await browser.close();
  writeFileSync(out, JSON.stringify(result));
  const total = Object.values(result).reduce((n, r) => n + Object.keys(r).length, 0);
  console.log(`captured ${total} elements across ${Object.keys(result).length} page/viewport combinations`);
}

function diff(aPath, bPath) {
  const A = JSON.parse(readFileSync(aPath, 'utf8'));
  const B = JSON.parse(readFileSync(bPath, 'utf8'));
  let changed = 0, total = 0, missing = 0;
  const examples = [];
  for (const key of Object.keys(A)) {
    for (const [path, av] of Object.entries(A[key])) {
      total++;
      const bv = B[key]?.[path];
      if (bv === undefined) { missing++; continue; }
      if (av !== bv) {
        changed++;
        if (examples.length < 12) {
          const ap = av.split('|'), bp = bv.split('|');
          const which = PROPS.filter((_, i) => ap[i] !== bp[i]);
          examples.push(`${key} ${path}\n      ${which.map((p) => `${p}: ${ap[PROPS.indexOf(p)]} → ${bp[PROPS.indexOf(p)]}`).join('\n      ')}`);
        }
      }
    }
  }
  for (const e of examples) console.log('\n✗ ' + e);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${total - changed - missing} / ${total} elements identical` + (missing ? `  (${missing} absent in B)` : ''));
  console.log('='.repeat(60));
  return changed + missing;
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'snapshot') await snapshot(rest[0]);
else if (cmd === 'diff') process.exit(diff(rest[0], rest[1]) > 0 ? 1 : 0);
else { console.error('usage: snapshot <out.json> | diff <a.json> <b.json>'); process.exit(2); }
