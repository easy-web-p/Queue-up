/**
 * ============================================================================
 * BOOTSTRAP COMPATIBILITY LAYER TEST SUITE
 * ============================================================================
 *
 * src/styles/bootstrap-compat.css replaces Bootstrap's 303 KB stylesheet with
 * the rules this project actually uses. It is generated from Bootstrap's own
 * CSS, so the risk is not that a rule was written wrongly — it is that the
 * generator's idea of "what the project uses" drifts from what the project
 * really uses, and a class quietly loses its styling.
 *
 * The behavioural check lives in .vr/compare.mjs, which renders every class
 * under both stylesheets in a real browser and compares 70 computed properties
 * on each. That needs Chromium, so it is a separate command:
 *
 *   node .vr/compare.mjs node_modules/bootstrap/dist/css/bootstrap.min.css \
 *                        src/styles/bootstrap-compat.css
 *
 * This file is what runs on every `npm test`: it checks the things that can be
 * checked without a browser, and which are what actually goes wrong — a class
 * used in the app but missing from the layer, a hand-edit that puts the file
 * out of step with its source, or the import moving in the cascade.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';

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

const SHIM_PATH = 'src/styles/bootstrap-compat.css';
const BOOTSTRAP_PATH = 'node_modules/bootstrap/dist/css/bootstrap.min.css';

const shim = readFileSync(SHIM_PATH, 'utf8');
const bootstrap = readFileSync(BOOTSTRAP_PATH, 'utf8');
const main = readFileSync('src/main.jsx', 'utf8');

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) out.push(...walk(f));
    else if (/\.(jsx|tsx|js|ts)$/.test(e) && !e.endsWith('.d.ts')) out.push(f);
  }
  return out;
}

function classNamesIn(css) {
  const set = new Set();
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) set.add(m[1]);
  return set;
}

const bootstrapClasses = classNamesIn(bootstrap);
const shimClasses = classNamesIn(shim);

// Every Bootstrap class name appearing in any string literal in src/.
const usedClasses = new Set();
for (const file of walk('src')) {
  for (const m of readFileSync(file, 'utf8').matchAll(/[`"']([^`"'\n]*)[`"']/g)) {
    for (const cls of m[1].split(/\s+/)) if (bootstrapClasses.has(cls)) usedClasses.add(cls);
  }
}

console.log('\n🎨 The compatibility layer covers what the app uses');

runTest('🚨 Every Bootstrap class the app uses is in the layer', () => {
  // The failure this guards against: someone adds `class="btn-info"` to a page,
  // nobody regenerates, and the button renders unstyled in production while
  // every test still passes.
  const missing = [...usedClasses].filter((c) => !shimClasses.has(c));
  assert(
    missing.length === 0,
    `${missing.length} class(es) used in src but absent from the layer — run: node .vr/generate-shim.mjs\n       ${missing.join(' ')}`
  );
});

runTest('The layer carries the --bs-* variables its rules read', () => {
  // Every kept rule resolves colours, spacing and borders through custom
  // properties. Without the :root blocks they compute to nothing, and the file
  // looks complete while styling almost nothing.
  assert(/--bs-body-color\s*:/.test(shim), '--bs-body-color is not declared');
  assert(/--bs-border-width\s*:/.test(shim), '--bs-border-width is not declared');
  assert(/:root/.test(shim), 'no :root block at all');
});

runTest('🚨 The layer carries Reboot, which colours the whole app', () => {
  // `body { color: var(--bs-body-color) }` is where every uncoloured piece of
  // text gets #212529. Without it the entire interface shifts to pure black.
  const root = postcss.parse(shim);
  let bodyRule = null;
  root.walkRules((r) => {
    if (r.selector.split(',').some((s) => s.trim() === 'body')) bodyRule = r;
  });
  assert(bodyRule, 'no body rule — Reboot is missing');
  const props = bodyRule.nodes.filter((n) => n.type === 'decl').map((n) => n.prop);
  assert(props.includes('color'), 'the body rule does not set a colour');
});

console.log('\n🔗 It is wired in where Bootstrap was');

runTest('🚨 Bootstrap itself is no longer imported', () => {
  assert(
    !/import\s+['"]bootstrap\/dist\/css/.test(main),
    "main.jsx still imports Bootstrap's full stylesheet, so nothing was saved"
  );
});

runTest('🚨 The layer is imported AFTER index.css', () => {
  // Order is the whole game. dist/index.html links index.css before
  // vendor-ui.css, so Bootstrap loaded LAST and won every collision at equal
  // specificity — and around a hundred class names (p-4, gap-2, text-center,
  // border) exist in both stylesheets. Import the layer any earlier and those
  // silently become Tailwind's values instead: Bootstrap's p-4 is 1.5rem,
  // Tailwind's is 1rem, on every page at once.
  const indexAt = main.indexOf("import './index.css'");
  const shimAt = main.indexOf('bootstrap-compat.css');
  assert(indexAt >= 0, 'main.jsx no longer imports index.css');
  assert(shimAt >= 0, 'main.jsx does not import the compatibility layer');
  assert(
    shimAt > indexAt,
    'the layer is imported before index.css — Tailwind would win the ~100 shared class names'
  );
});

runTest('The icon font is still imported', () => {
  // A separate package. The layer replaces bootstrap, not bootstrap-icons, and
  // the app uses 198 icons.
  assert(/bootstrap-icons/.test(main), 'the icon stylesheet is gone; every bi-* icon would vanish');
});

console.log('\n📄 It is generated, and says so');

runTest('The file is marked generated and names its source', () => {
  assert(/GENERATED/.test(shim), 'nothing warns a reader not to hand-edit it');
  assert(shim.includes(BOOTSTRAP_PATH), 'the file does not name what it was generated from');
  assert(/generate-shim/.test(shim), 'the file does not name its generator');
});

runTest('🚨 Every rule in the layer exists in Bootstrap', () => {
  // The layer is a transcription. A selector that appears here and not in
  // Bootstrap means someone wrote CSS by hand, and the whole basis for trusting
  // it — "these are Bootstrap's own rules" — no longer holds.
  const bootstrapSelectors = new Set();
  postcss.parse(bootstrap).walkRules((r) => {
    for (const s of r.selector.split(',')) bootstrapSelectors.add(s.trim());
  });

  const invented = [];
  postcss.parse(shim).walkRules((r) => {
    for (const s of r.selector.split(',')) {
      const sel = s.trim();
      if (sel && !bootstrapSelectors.has(sel)) invented.push(sel);
    }
  });
  assert(
    invented.length === 0,
    `${invented.length} selector(s) are not Bootstrap's:\n       ${[...new Set(invented)].slice(0, 8).join('\n       ')}`
  );
});

runTest('The layer is substantially smaller than what it replaces', () => {
  const ratio = shim.length / bootstrap.length;
  assert(ratio < 0.5, `the layer is ${Math.round(ratio * 100)}% of Bootstrap — that is not a saving worth the indirection`);
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
