/**
 * Generates the replacement stylesheet from Bootstrap's own rules.
 *
 * Transcribed, not reimplemented. Every rule kept here is the rule Bootstrap
 * already ships for that selector, copied verbatim — so the result is what
 * Bootstrap computed, not an approximation someone wrote from memory. The
 * comparator then proves it, property by property, against the real thing.
 *
 * Parsed with PostCSS rather than a regex. The first attempt at this used a
 * hand-rolled brace matcher and silently truncated the :root block that carries
 * every --bs-* variable the rules below read, which made the output look
 * plausible and compute to nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';

const source = readFileSync('node_modules/bootstrap/dist/css/bootstrap.min.css', 'utf8');
const wanted = new Set(JSON.parse(readFileSync('.vr/bootstrap-only.json', 'utf8')).map((r) => r.class));

const root = postcss.parse(source);

/** Does this selector reference a class we need? */
const touches = (selector) =>
  [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].some((m) => wanted.has(m[1]));

/** Rules that define the --bs-* variables everything else reads. */
const isVariableRoot = (selector) => /(^|,)\s*(:root|\[data-bs-theme=[a-z]+\])/.test(selector);

/**
 * Reboot — Bootstrap's base layer, which styles elements rather than classes.
 *
 * Easy to overlook and not optional: `body { color: var(--bs-body-color) }` is
 * where every uncoloured piece of text in this app gets #212529. Drop it and
 * the whole interface shifts to pure black, everywhere at once, which is
 * exactly the kind of change a compatibility layer exists to prevent.
 *
 * Identified as "selector mentions no class", which is what Reboot is.
 */
const isBaseLayer = (selector) => !selector.includes('.');

const out = postcss.root();
let kept = 0;
let variableRoots = 0;
let base = 0;

root.each((node) => {
  if (node.type === 'rule') {
    if (isVariableRoot(node.selector)) { out.append(node.clone()); variableRoots++; return; }

    // A selector list can mix the two: `.h1,.h2,...,h1,h2,...` styles both the
    // utility classes and the heading elements. Keeping it only when a wanted
    // class appears threw away the element half, so an <h5> inside .modal-title
    // lost its font size. Split the list and keep whichever parts apply.
    const parts = node.selector.split(',').map((x) => x.trim()).filter(Boolean);
    const keepParts = parts.filter((x) => isBaseLayer(x) || touches(x));
    if (keepParts.length === 0) return;

    const clone = node.clone();
    clone.selector = keepParts.join(',');
    out.append(clone);
    if (keepParts.some((x) => touches(x))) kept++; else base++;
    return;
  }

  if (node.type === 'atrule') {
    // Keyframes: only the one the striped progress bar animates.
    if (node.name === 'keyframes') {
      if (/progress-bar-stripes/.test(node.params)) { out.append(node.clone()); kept++; }
      return;
    }
    if (node.name !== 'media' && node.name !== 'supports') return;

    const inner = node.clone();
    inner.removeAll();
    node.each((child) => {
      if (child.type !== 'rule') return;
      if (isVariableRoot(child.selector)) { inner.append(child.clone()); return; }
      const childParts = child.selector.split(',').map((x) => x.trim()).filter(Boolean);
      const childKeep = childParts.filter((x) => isBaseLayer(x) || touches(x));
      if (childKeep.length === 0) return;
      const childClone = child.clone();
      childClone.selector = childKeep.join(',');
      inner.append(childClone);
    });
    if (inner.nodes.length > 0) { out.append(inner); kept += inner.nodes.length; }
  }
});

const header = `/*
 * ============================================================================
 * BOOTSTRAP COMPATIBILITY LAYER — GENERATED, DO NOT EDIT
 * ============================================================================
 *
 * Source:     node_modules/bootstrap/dist/css/bootstrap.min.css
 * Generator:  node .vr/generate-shim.mjs
 * Verified:   npm run test:bootstrap-shim
 *
 * The project loaded all of Bootstrap — 303 KB in the vendor-ui chunk — and
 * uses ${wanted.size} classes from it.
 *
 * Most class names that look like a dependency are not one. Tailwind defines
 * p-4, gap-2, text-center, border, bg-white, shadow-sm, mx-auto and about a
 * hundred others under the same names, and main.jsx imports index.css after
 * Bootstrap, so Tailwind already won every one of those at equal specificity.
 * Dropping Bootstrap changes nothing for them.
 *
 * These ${wanted.size} are the classes Bootstrap alone provided. Each rule below is
 * Bootstrap's own rule for that selector, copied rather than rewritten. The
 * :root blocks come along because every rule here reads --bs-* variables
 * declared there, and so does Reboot — Bootstrap's element-level base layer.
 * Reboot is where the body element gets its colour, so without it every
 * uncoloured piece of text in the app would shift from #212529 to pure black.
 *
 * To change what is included, change which classes the project uses, then
 * regenerate. Editing this file by hand puts it out of step with its source
 * and the verification will not tell you, because it compares this file's
 * behaviour to Bootstrap's — not to what you meant.
 */
`;

writeFileSync('src/styles/bootstrap-compat.css', header + out.toString() + '\n');
console.log(`kept ${kept} class rules, ${base} base-layer rules, ${variableRoots} variable root(s)`);
