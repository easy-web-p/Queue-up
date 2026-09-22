/**
 * Compares the gallery rendered with two stylesheets, property by property.
 *
 *   node .vr/compare.mjs <stylesheetA.css> <stylesheetB.css> [--colour-only]
 *
 * Reports every class whose computed style differs. Because both runs share the
 * same markup and the same base document, a difference can only have come from
 * the stylesheet — which is exactly the question a replacement has to answer.
 *
 * --colour-only accepts differences that are purely colour AND land on a
 * design-system value. The compatibility layer re-colours Bootstrap's semantic
 * palette to the one in docs/design_system.md, so ~30 classes are SUPPOSED to
 * differ; without this the tool would report failure for the correct state,
 * which is how a check stops being believed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// The properties a person would notice. Deliberately not "all of them":
// computed style exposes hundreds, most of which no utility class touches.
const PROPS = [
  'display','position','top','right','bottom','left','z-index','float','clear',
  'flex-direction','flex-wrap','align-items','align-self','justify-content','gap','row-gap','column-gap','flex','order',
  'width','height','max-width','min-width','max-height','min-height','box-sizing',
  'margin-top','margin-right','margin-bottom','margin-left',
  'padding-top','padding-right','padding-bottom','padding-left',
  'color','background-color','background-image','opacity',
  'border-top-width','border-right-width','border-bottom-width','border-left-width',
  'border-top-color','border-right-color','border-bottom-color','border-left-color','border-style',
  'border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius',
  'font-size','font-weight','font-family','font-style','line-height','letter-spacing',
  'text-align','text-decoration-line','text-transform','white-space','text-overflow','overflow-x','overflow-y',
  'box-shadow','transform','object-fit','cursor','pointer-events','visibility',
];

async function capture(stylesheetPath) {
  const template = readFileSync('.vr/gallery.html', 'utf8');
  const css = readFileSync(stylesheetPath, 'utf8');
  const html = template.replace('<!--STYLESHEET-->', `<style>${css}</style>`);
  writeFileSync('.vr/.render.html', html);

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pathToFileURL('.vr/.render.html').href, { waitUntil: 'load' });
  const result = await page.evaluate((props) => {
    const out = {};
    for (const probe of document.querySelectorAll('.probe')) {
      // The element carrying the class is the deepest one that has it.
      const cls = probe.dataset.cls;
      const el = [...probe.querySelectorAll('*')].reverse().find((n) => n.classList.contains(cls)) || probe.firstElementChild;
      if (!el) continue;
      const cs = getComputedStyle(el);
      out[cls] = Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
    }
    return out;
  }, PROPS);
  await browser.close();
  return result;
}

const args = process.argv.slice(2);
const colourOnly = args.includes('--colour-only');
const [a, b] = args.filter((x) => !x.startsWith('--'));
if (!a || !b) { console.error('usage: node .vr/compare.mjs <a.css> <b.css> [--colour-only]'); process.exit(2); }

const COLOUR_PROPS = new Set([
  'color','background-color','background-image','border-top-color','border-right-color',
  'border-bottom-color','border-left-color','box-shadow','opacity',
]);

// docs/design_system.md, plus the tints and shades an interface derives from it.
const PALETTE = [[255,122,26],[230,104,13],[245,158,11],[16,185,129],[239,68,68]];
const RATIOS = [0.1,0.15,0.2,0.4,0.6,0.8];
function isPaletteColour(triplet) {
  const t = triplet.split(',').map(Number);
  const near = (x) => x.every((v,i) => Math.abs(v - t[i]) <= 1);
  for (const c of PALETTE) {
    if (near(c)) return true;
    for (const p of RATIOS) {
      if (near(c.map((v) => Math.round(v + (255-v)*p)))) return true;
      if (near(c.map((v) => Math.round(v * (1-p))))) return true;
    }
  }
  return false;
}
const triplets = (v) => [...v.matchAll(/rgba?\(\s*(\d+)[, ]+(\d+)[, ]+(\d+)/g)].map((m) => `${m[1]},${m[2]},${m[3]}`);

const A = await capture(a);
const B = await capture(b);

let differing = 0;
let recoloured = 0;
const report = [];
for (const cls of Object.keys(A)) {
  const diffs = [];
  for (const p of PROPS) {
    if (A[cls][p] === B[cls]?.[p]) continue;
    if (colourOnly && COLOUR_PROPS.has(p)) {
      const introduced = triplets(B[cls]?.[p] ?? '').filter((t) => !triplets(A[cls][p]).includes(t));
      if (introduced.length > 0 && introduced.every(isPaletteColour)) continue;
      if (introduced.length === 0) continue;
    }
    diffs.push(`${p}: ${A[cls][p]}  →  ${B[cls]?.[p]}`);
  }
  if (diffs.length) { differing++; report.push({ cls, diffs }); }
  else if (colourOnly && PROPS.some((p) => A[cls][p] !== B[cls]?.[p])) recoloured++;
}

report.sort((x, y) => y.diffs.length - x.diffs.length);
for (const { cls, diffs } of report) {
  console.log(`\n✗ ${cls}  (${diffs.length})`);
  for (const d of diffs.slice(0, 8)) console.log('    ' + d);
  if (diffs.length > 8) console.log(`    …and ${diffs.length - 8} more`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`${Object.keys(A).length - differing} / ${Object.keys(A).length} classes match` +
  (colourOnly && recoloured ? ` (${recoloured} re-coloured to the design system)` : ''));
console.log('='.repeat(60));
writeFileSync('.vr/last-diff.json', JSON.stringify(report, null, 2));
process.exit(differing > 0 ? 1 : 0);
