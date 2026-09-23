/**
 * ============================================================================
 * ICON SUBSET TEST SUITE
 * ============================================================================
 *
 * src/styles/bootstrap-icons-subset.css and the font beside it carry 193 of
 * bootstrap-icons' 2,078 glyphs — the ones this project renders. That saves
 * 300 KB and introduces one new way to break the app:
 *
 *   someone writes <i className="bi bi-rocket" />, nobody regenerates the
 *   subset, and the icon renders as a blank box. Everything compiles, every
 *   other test passes, and it only shows up when a person looks at the screen.
 *
 * That is what this file exists to catch. It runs on every `npm test`.
 *
 * The glyphs themselves are verified separately, by drawing all 193 in both
 * fonts and comparing pixels — that needs Chromium, so it is its own command:
 *
 *   npm run test:icons:browser
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}\n       ${err.message}`);
  }
}

const assert = (c, m) => { if (!c) throw new Error(m); };

const SUBSET_CSS = 'src/styles/bootstrap-icons-subset.css';
const SUBSET_FONT = 'src/assets/fonts/bootstrap-icons-subset.woff2';
const UPSTREAM_CSS = 'node_modules/bootstrap-icons/font/bootstrap-icons.css';

const subset = readFileSync(SUBSET_CSS, 'utf8');
const upstream = readFileSync(UPSTREAM_CSS, 'utf8');
const main = readFileSync('src/main.jsx', 'utf8');

/** Every icon name the subset defines, and the codepoint it maps to. */
function iconMap(css) {
  const map = new Map();
  for (const m of css.matchAll(/\.bi-([a-z0-9-]+)::before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"/g)) {
    map.set('bi-' + m[1], m[2].toLowerCase());
  }
  return map;
}

const subsetIcons = iconMap(subset);
const upstreamIcons = iconMap(upstream);

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) out.push(...walk(f));
    else if (/\.(jsx|tsx|js|ts|css|html)$/.test(e) && !e.endsWith('.d.ts')) out.push(f);
  }
  return out;
}

/**
 * Icon names assembled at runtime, which no scan of the source can find.
 * Mirrors RUNTIME_BUILT in .vr/enumerate-icons.mjs — if the two drift, the
 * test below that compares them says so.
 */
const RUNTIME_BUILT = ['bi-chevron-up', 'bi-chevron-down'];

const usedInSource = new Set();
for (const file of [...walk('src'), 'index.html']) {
  for (const m of readFileSync(file, 'utf8').matchAll(/\bbi-[a-z0-9-]+/g)) {
    if (upstreamIcons.has(m[0])) usedInSource.add(m[0]);
  }
}

console.log('\n🎨 The subset covers every icon the app renders');

runTest('🚨 Every icon named in the source is in the subset', () => {
  // The failure mode: a new icon in a page, nobody regenerates, blank box.
  const missing = [...usedInSource].filter((n) => !subsetIcons.has(n));
  assert(
    missing.length === 0,
    `${missing.length} icon(s) used but absent — run: node .vr/enumerate-icons.mjs && node .vr/subset-icons.mjs\n       ${missing.join(' ')}`
  );
});

runTest('🚨 Icons built at runtime are in the subset too', () => {
  // `bi-chevron-${open ? 'up' : 'down'}` never appears as a whole class name,
  // so the scan above cannot see it. These are the ones that get forgotten.
  const missing = RUNTIME_BUILT.filter((n) => !subsetIcons.has(n));
  assert(missing.length === 0, `runtime-built icon(s) missing from the subset: ${missing.join(' ')}`);
});

runTest('🚨 The generator knows about the same runtime-built names', () => {
  // Two lists of the same thing drift. This one is small enough to check.
  const generator = readFileSync('.vr/enumerate-icons.mjs', 'utf8');
  const declared = [...generator.matchAll(/'(bi-[a-z0-9-]+)'/g)].map((m) => m[1]);
  for (const name of RUNTIME_BUILT) {
    assert(
      declared.includes(name),
      `${name} is expected here but not listed in RUNTIME_BUILT in the generator — the next regeneration would drop it`
    );
  }
});

runTest('🚨 No concatenated icon name has appeared that nobody listed', () => {
  // Catches the case this suite cannot otherwise see: a new
  // `bi-something-${...}` added to a page, whose halves are invisible to every
  // scan. The list of known ones is small and deliberate; a new one has to be
  // added to it.
  const KNOWN_PREFIXES = ['bi-chevron-'];
  const found = new Set();
  for (const file of walk('src')) {
    for (const m of readFileSync(file, 'utf8').matchAll(/\b(bi-[a-z0-9-]*?)\$\{/g)) found.add(m[1]);
  }
  const unknown = [...found].filter((p) => !KNOWN_PREFIXES.includes(p));
  assert(
    unknown.length === 0,
    `icon name(s) built at runtime that nothing accounts for: ${unknown.join(' ')}\n` +
      `       Add the full names to RUNTIME_BUILT in .vr/enumerate-icons.mjs and to this file, then regenerate.`
  );
});

runTest('Every codepoint matches the one upstream uses', () => {
  // A transcription error here points the class at the wrong glyph, which is
  // worse than a blank box: the wrong icon renders and looks intentional.
  for (const [name, cp] of subsetIcons) {
    assert(upstreamIcons.has(name), `${name} is not a real bootstrap-icon`);
    assert(
      upstreamIcons.get(name) === cp,
      `${name} points at \\${cp} but upstream says \\${upstreamIcons.get(name)}`
    );
  }
});

console.log('\n📦 It is wired in, and smaller');

runTest('🚨 The full icon stylesheet is no longer imported', () => {
  assert(
    !/bootstrap-icons\/font\/bootstrap-icons\.css/.test(main),
    'main.jsx still imports the full icon stylesheet, so nothing was saved'
  );
  assert(/bootstrap-icons-subset/.test(main), 'the subset is not imported at all');
});

runTest('The subset declares the font it ships with', () => {
  assert(/@font-face/.test(subset), 'no @font-face — the glyphs would never load');
  assert(
    /bootstrap-icons-subset\.woff2/.test(subset),
    'the @font-face does not point at the subset font'
  );
  assert(
    !/\.woff["')]/.test(subset.replace(/\.woff2/g, '')),
    'the legacy .woff fallback is back; every browser that can run this app picks woff2'
  );
});

runTest('The saving is real', () => {
  const fontKb = statSync(SUBSET_FONT).size / 1024;
  const upstreamKb = statSync('node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2').size / 1024;
  assert(fontKb < upstreamKb / 2, `the subset font is ${fontKb.toFixed(1)} KB against ${upstreamKb.toFixed(1)} KB — not worth the indirection`);
  assert(subset.length < upstream.length / 2, 'the subset stylesheet is not meaningfully smaller');
});

runTest('The file says it is generated and how to regenerate it', () => {
  assert(/GENERATED/.test(subset), 'nothing warns a reader not to hand-edit it');
  assert(/subset-icons/.test(subset), 'the file does not name its generator');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
