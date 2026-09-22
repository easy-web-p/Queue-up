/**
 * The classes this project genuinely depends on Bootstrap for.
 *
 * Naïvely intersecting "class names used in src/" with "class names Bootstrap
 * defines" gives 243 — and is almost entirely wrong. Tailwind and Bootstrap
 * share a great deal of naming: p-4, px-3, gap-2, text-center, border,
 * bg-white, shadow-sm, mx-auto, flex-wrap, overflow-hidden and dozens more
 * exist in both. main.jsx imports Bootstrap first and index.css (Tailwind)
 * second, so at equal specificity Tailwind already wins every one of those.
 * They are not a Bootstrap dependency at all.
 *
 * What actually matters is the set Bootstrap defines and Tailwind does not.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';

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

/**
 * For each class, the set of properties a stylesheet declares for it.
 *
 * Property granularity, not just "is the name defined". Both stylesheets
 * define .modal-content — but the project sets only max-height and overflow,
 * while `pointer-events: auto` comes from Bootstrap alone. Treating a shared
 * name as "no dependency" would have dropped that, and every modal in the app
 * would have started passing clicks straight through to the page behind it.
 *
 * The same is true of .table: Bootstrap makes it a component (width,
 * margin-bottom, border-color), Tailwind makes it `display: table`.
 */
function declarationsByClass(css) {
  const map = new Map();
  for (const rule of postcss.parse(css).nodes) {
    const rules = rule.type === 'atrule' ? rule.nodes || [] : [rule];
    for (const r of rules) {
      if (!r || r.type !== 'rule') continue;
      const props = (r.nodes || []).filter((d) => d.type === 'decl').map((d) => d.prop);
      if (props.length === 0) continue;
      for (const sel of r.selector.split(',')) {
        const m = /^\s*\.(-?[_a-zA-Z][\w-]*)\s*$/.exec(sel);
        if (!m) continue;
        if (!map.has(m[1])) map.set(m[1], new Set());
        for (const prop of props) map.get(m[1]).add(prop);
      }
    }
  }
  return map;
}

const bsDefined = classNamesIn(readFileSync('node_modules/bootstrap/dist/css/bootstrap.min.css', 'utf8'));

// Tailwind's own output, as this project actually builds it.
const distCss = readdirSync('dist/assets').filter((f) => f.endsWith('.css') && !f.startsWith('vendor-ui'));
const tailwindDefined = new Set();
for (const f of distCss) for (const c of classNamesIn(readFileSync(join('dist/assets', f), 'utf8'))) tailwindDefined.add(c);

const used = new Map();
for (const file of walk('src')) {
  const src = readFileSync(file, 'utf8');
  // Every string literal in the file, not just the first one after a
  // `className=`. A ternary — className={open ? "modal-content a" : "b"} —
  // hides its classes from that narrower pattern, which is how modal-content
  // (used seven times) went missing from the first count. A stray match here
  // costs one extra CSS rule; a miss costs a broken screen.
  for (const m of src.matchAll(/[`"']([^`"'\n]*)[`"']/g)) {
    for (const cls of m[1].split(/\s+/)) {
      if (!cls || !bsDefined.has(cls)) continue;
      if (!used.has(cls)) used.set(cls, new Set());
      used.get(cls).add(file);
    }
  }
}

const bsDecls = declarationsByClass(readFileSync('node_modules/bootstrap/dist/css/bootstrap.min.css', 'utf8'));
const otherDecls = new Map();
for (const f of distCss) {
  for (const [cls, props] of declarationsByClass(readFileSync(join('dist/assets', f), 'utf8'))) {
    if (!otherDecls.has(cls)) otherDecls.set(cls, new Set());
    for (const p of props) otherDecls.get(cls).add(p);
  }
}

// Every Bootstrap class the project uses is a dependency.
//
// The tempting shortcut is to exclude the ones Tailwind also defines — p-4,
// gap-2, text-center and about a hundred more share a name. That would be right
// only if Tailwind won those collisions. It does not: dist/index.html links
// index.css (Tailwind and the project) before vendor-ui.css (Bootstrap), so
// Bootstrap loads last and takes every tie at equal specificity. Bootstrap's
// p-4 is 1.5rem and Tailwind's is 1rem, and the app is currently getting 1.5rem.
//
// So the shared names are not "no dependency" — they are the dependency most
// likely to shift a layout if it is dropped.
const onlyBootstrap = [...used.entries()];

console.log(`Bootstrap classes used in src: ${used.size}`);
console.log(`(all are dependencies — Bootstrap's stylesheet loads last and wins every collision)\n`);

const rows = onlyBootstrap.sort((a, b) => b[1].size - a[1].size);
for (const [cls, files] of rows) console.log(String(files.size).padStart(4), cls);
writeFileSync('.vr/bootstrap-only.json', JSON.stringify(rows.map(([c, f]) => ({ class: c, files: [...f] })), null, 2));
