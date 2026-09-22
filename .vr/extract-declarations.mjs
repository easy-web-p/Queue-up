/**
 * For each Bootstrap-only class this project uses, the properties Bootstrap
 * actually declares for it.
 *
 * This is the contract a replacement has to meet. Comparing every computed
 * property instead would drown the result in inherited values that have nothing
 * to do with the class; comparing exactly what Bootstrap sets is the question
 * that matters — "does my rule do what theirs did?"
 */
import { readFileSync, writeFileSync } from 'node:fs';

const css = readFileSync('node_modules/bootstrap/dist/css/bootstrap.min.css', 'utf8');
const wanted = new Set(JSON.parse(readFileSync('.vr/bootstrap-only.json', 'utf8')).map((r) => r.class));

// Strip @media/@supports wrappers to their contents; responsive variants are
// handled separately because their properties only apply above a breakpoint.
const flat = css.replace(/@(media|supports)[^{]+\{/g, '').replace(/\}\s*\}/g, '}');

const byClass = new Map();
for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selectors = m[1].split(',').map((s) => s.trim());
  const body = m[2];
  const props = [...body.matchAll(/([-a-zA-Z]+)\s*:/g)].map((p) => p[1]).filter((p) => !p.startsWith('--'));
  if (props.length === 0) continue;
  for (const sel of selectors) {
    // Only simple `.class` selectors — a rule like `.btn:hover` or
    // `.modal.show .modal-dialog` is state or context, not the base style.
    const simple = /^\.(-?[_a-zA-Z][\w-]*)$/.exec(sel);
    if (!simple || !wanted.has(simple[1])) continue;
    if (!byClass.has(simple[1])) byClass.set(simple[1], new Set());
    for (const p of props) byClass.get(simple[1]).add(p);
  }
}

const out = {};
for (const cls of [...wanted].sort()) out[cls] = [...(byClass.get(cls) || [])].sort();

const withProps = Object.values(out).filter((v) => v.length > 0).length;
console.log(`${wanted.size} classes; ${withProps} have a plain .class rule in Bootstrap`);
console.log(`${wanted.size - withProps} are contextual only (state, or nested selectors):`);
console.log('  ' + Object.entries(out).filter(([, v]) => v.length === 0).map(([k]) => k).join(' '));
writeFileSync('.vr/bootstrap-declarations.json', JSON.stringify(out, null, 2));
