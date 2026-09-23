/**
 * Every bootstrap-icon this project can render.
 *
 * The font ships 2,078 glyphs and a stylesheet declaring all of them. The app
 * uses a fraction, but "which fraction" has to be answered carefully, because a
 * missed icon is a blank square on a real screen and no test would catch it.
 *
 * Three sources, and the third is the one that bites:
 *
 *   1. literal class names in any string — `"bi-cart-fill"`, `className="bi bi-x"`
 *   2. names stored in source data — CATEGORY_MODIFIER_CONFIGS, the tier badges,
 *      the announcement board. All literals, so (1) already finds them.
 *   3. names BUILT at runtime — `bi-chevron-${open ? 'up' : 'down'}`. Neither
 *      half ever appears as a whole class name, so a literal scan cannot see
 *      them. There are exactly two, and they are listed explicitly below.
 *
 * An earlier reading of this code concluded icon names come from Firestore and
 * could not be enumerated at all. They do not: food_categories.icon is written
 * only by createStoreCategory, which has no callers and defaults to a
 * lucide-react name rather than a bi-* class, and ProductDetail's grp.icon
 * comes from CATEGORY_MODIFIER_CONFIGS, a constant in the file.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Class names assembled at runtime, which no scan of literals can find.
 * Add to this list when a template literal builds an icon name.
 */
const RUNTIME_BUILT = [
  // `bi-chevron-${isUserDropdownOpen ? 'up' : 'down'}`
  // — MerchantOnboarding.jsx, MerchantDashboard.jsx
  'bi-chevron-up',
  'bi-chevron-down',
];

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) out.push(...walk(f));
    else if (/\.(jsx|tsx|js|ts|css|html)$/.test(e) && !e.endsWith('.d.ts')) out.push(f);
  }
  return out;
}

// The stylesheet is the authority on which names exist and what codepoint each maps to.
const iconCss = readFileSync('node_modules/bootstrap-icons/font/bootstrap-icons.css', 'utf8');
const codepoints = new Map();
for (const m of iconCss.matchAll(/\.bi-([a-z0-9-]+)::before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"/g)) {
  codepoints.set('bi-' + m[1], parseInt(m[2], 16));
}

const used = new Set(RUNTIME_BUILT.filter((n) => codepoints.has(n)));
const unknownRuntime = RUNTIME_BUILT.filter((n) => !codepoints.has(n));

for (const file of [...walk('src'), 'index.html']) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bbi-[a-z0-9-]+/g)) {
    if (codepoints.has(m[0])) used.add(m[0]);
  }
}

const sorted = [...used].sort();
writeFileSync(
  '.vr/icons-used.json',
  JSON.stringify({ icons: sorted, codepoints: sorted.map((n) => codepoints.get(n)) }, null, 2)
);

console.log(`${codepoints.size} icons in the font`);
console.log(`${sorted.length} used by this project (${Math.round((100 * sorted.length) / codepoints.size)}%)`);
if (unknownRuntime.length) {
  console.log(`\n⚠️  runtime-built names that are not real icons: ${unknownRuntime.join(', ')}`);
  process.exit(1);
}
