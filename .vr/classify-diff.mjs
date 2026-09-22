/**
 * Classifies what changed between two page snapshots.
 *
 *   node .vr/classify-diff.mjs <before.json> <after.json>
 *
 * "Nothing changed" is the right check for a refactor. For a deliberate change
 * the useful question is narrower: did ONLY what I intended change? Here that
 * means every differing property is a colour, and every new value is one the
 * design system names — not a shade that happens to look right.
 */
import { readFileSync } from 'node:fs';

const PROPS = [
  'display','position','flex-direction','align-items','justify-content','gap',
  'width','height','margin-top','margin-bottom','margin-left','margin-right',
  'padding-top','padding-bottom','padding-left','padding-right',
  'color','background-color','opacity','border-top-width','border-top-color','border-style',
  'border-top-left-radius','font-size','font-weight','font-family','line-height',
  'text-align','text-decoration-line','text-transform','box-shadow','overflow-x','overflow-y',
];
const COLOUR_PROPS = new Set(['color', 'background-color', 'border-top-color', 'box-shadow']);

// docs/design_system.md, plus the neutrals every interface needs.
const PALETTE = new Map([
  ['255,122,26', '--qu-accent'],
  ['230,104,13', '--qu-accent-hover'],
  ['245,158,11', '--qu-amber'],
  ['16,185,129', '--qu-green'],
  ['239,68,68', '--qu-red'],
]);

const rgbTriplets = (value) =>
  [...value.matchAll(/rgba?\(\s*(\d+)[, ]+(\d+)[, ]+(\d+)/g)].map((m) => `${m[1]},${m[2]},${m[3]}`);

/**
 * Names a colour, accepting the tints and shades derived from the palette.
 *
 * A subtle background is not a different colour — `bg-success-subtle` is
 * --qu-green mixed 80% with white, which is how Bootstrap builds every subtle
 * variant, and rgb(207,241,230) is exactly that. Judging only the five base
 * values reports those as off-palette, which is the check being wrong rather
 * than the colour.
 *
 * The tolerance is ±1 per channel, for rounding.
 */
const RATIOS = [0.1, 0.15, 0.2, 0.4, 0.6, 0.8];
function nameColour(triplet) {
  if (PALETTE.has(triplet)) return PALETTE.get(triplet);

  const target = triplet.split(',').map(Number);
  for (const [base, name] of PALETTE) {
    const c = base.split(',').map(Number);
    for (const p of RATIOS) {
      const tinted = c.map((v) => Math.round(v + (255 - v) * p));
      const shaded = c.map((v) => Math.round(v * (1 - p)));
      const near = (x) => x.every((v, i) => Math.abs(v - target[i]) <= 1);
      if (near(tinted)) return `${name} tinted ${p * 100}%`;
      if (near(shaded)) return `${name} shaded ${p * 100}%`;
    }
  }
  return null;
}

const [aPath, bPath] = process.argv.slice(2);
const A = JSON.parse(readFileSync(aPath, 'utf8'));
const B = JSON.parse(readFileSync(bPath, 'utf8'));

const nonColour = [];
const newColours = new Map();
let changedElements = 0;
let total = 0;

for (const key of Object.keys(A)) {
  for (const [path, av] of Object.entries(A[key])) {
    total++;
    const bv = B[key]?.[path];
    if (bv === undefined || av === bv) continue;
    changedElements++;
    const ap = av.split('|');
    const bp = bv.split('|');
    for (let i = 0; i < PROPS.length; i++) {
      if (ap[i] === bp[i]) continue;
      if (!COLOUR_PROPS.has(PROPS[i])) {
        nonColour.push(`${key} ${path}  ${PROPS[i]}: ${ap[i]} → ${bp[i]}`);
        continue;
      }
      for (const t of rgbTriplets(bp[i])) {
        if (!rgbTriplets(ap[i]).includes(t)) newColours.set(t, (newColours.get(t) || 0) + 1);
      }
    }
  }
}

console.log(`\n${changedElements} of ${total} elements changed\n`);

console.log('New colours introduced:');
let offPalette = 0;
for (const [triplet, count] of [...newColours].sort((x, y) => y[1] - x[1])) {
  const named = nameColour(triplet);
  if (!named) offPalette++;
  console.log(`  ${named ? '✅' : '❌'} rgb(${triplet})  ×${count}  ${named || 'NOT IN THE DESIGN SYSTEM'}`);
}

console.log(`\nNon-colour properties changed: ${nonColour.length}`);
for (const line of nonColour.slice(0, 10)) console.log('  ❌ ' + line);

console.log(`\n${'='.repeat(60)}`);
const ok = nonColour.length === 0 && offPalette === 0;
console.log(ok
  ? 'Only colours changed, and only to design-system colours.'
  : `FAILED — ${nonColour.length} non-colour change(s), ${offPalette} off-palette colour(s)`);
console.log('='.repeat(60));
process.exit(ok ? 0 : 1);
