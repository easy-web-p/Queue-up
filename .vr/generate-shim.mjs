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

/**
 * Drops --bs-* variables nothing in the layer reads.
 *
 * Bootstrap's :root declares its whole colour scale — blue, indigo, purple,
 * pink, teal, orange and the rest — whether a rule uses them or not. Carrying
 * those into a file scoped to what this project needs is dead weight, and one
 * of them (--bs-orange, #fd7e14) is a second orange competing with the brand
 * accent that the design-system check exists to catch.
 *
 * Resolved repeatedly, because a variable can be read by another variable:
 * --bs-btn-border-width reads --bs-border-width, which nothing else does.
 */
function pruneUnusedVariables(sheet) {
  for (let pass = 0; pass < 12; pass++) {
    const text = sheet.toString();
    const read = new Set([...text.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
    let removed = 0;
    sheet.walkDecls((decl) => {
      if (!decl.prop.startsWith('--')) return;
      if (read.has(decl.prop)) return;
      decl.remove();
      removed++;
    });
    if (removed === 0) break;
  }
  // A :root left with no declarations is noise.
  sheet.walkRules((rule) => {
    if (rule.nodes.length === 0) rule.remove();
  });
}

/**
 * Re-colours Bootstrap's semantic palette to this project's design system.
 *
 * docs/design_system.md names one accent and three status colours. Bootstrap
 * ships its own — a blue primary, a crimson danger, an amber warning, a forest
 * success — and the classes the app uses (text-danger, bg-warning, btn-danger
 * and their neighbours) paint with those. The result is a second red-orange
 * family competing with #FF7A1A on the same screens, which is precisely what
 * test-design-system.js exists to catch and could not see while Bootstrap sat
 * in node_modules.
 *
 * Substituted at the hex level rather than by overriding variables, because
 * Bootstrap's minified stylesheet inlines the literal: .btn-danger sets
 * --bs-btn-bg:#dc3545 directly and never reads --bs-danger. Overriding the
 * variable would have changed nothing and looked like it worked.
 *
 * `info` and `secondary` are deliberately left alone. The design system defines
 * no informational or secondary colour, and inventing one here would be a
 * design decision made in a code generator. Neither is a red-orange, so neither
 * competes with the accent.
 */
const PALETTE = {
  // Bootstrap base → design-system base
  '#0d6efd': '#ff7a1a', // primary  → --qu-accent
  '#dc3545': '#ef4444', // danger   → --qu-red
  '#ffc107': '#f59e0b', // warning  → --qu-amber
  '#198754': '#10b981', // success  → --qu-green
};

/** Bootstrap's own tint/shade, which is how it derives every subtle variant. */
const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const tint = (hex, p) => toHex(channels(hex).map((c) => c + (255 - c) * p));
const shade = (hex, p) => toHex(channels(hex).map((c) => c * (1 - p)));

/**
 * The full derived set for one colour, in the same proportions Bootstrap uses.
 *   light: bg-subtle = tint 80%, border-subtle = tint 60%, text-emphasis = shade 60%
 *   dark:  bg-subtle = shade 80%, border-subtle = shade 60%, text-emphasis = tint 40%
 * Also the hover and active shades a button steps through (15% and 20%).
 */
function derivedPairs(from, to) {
  return [
    [tint(from, 0.8), tint(to, 0.8)],
    [tint(from, 0.6), tint(to, 0.6)],
    [tint(from, 0.4), tint(to, 0.4)],
    [shade(from, 0.8), shade(to, 0.8)],
    [shade(from, 0.6), shade(to, 0.6)],
    [shade(from, 0.2), shade(to, 0.2)],
    [shade(from, 0.15), shade(to, 0.15)],
    [shade(from, 0.1), shade(to, 0.1)],
  ];
}

function recolour(sheet) {
  const map = new Map();
  for (const [from, to] of Object.entries(PALETTE)) {
    map.set(from, to);
    for (const [f, t] of derivedPairs(from, to)) if (!map.has(f)) map.set(f, t);
  }

  // The same colour reaches the page in three different spellings, and missing
  // any one of them leaves part of the palette un-migrated:
  //
  //   #dc3545        a plain hex, as in .btn-danger's --bs-btn-bg
  //   220,53,69      an --bs-*-rgb triplet, which is what .text-danger and
  //                  .bg-danger actually read, through rgba(var(...), opacity)
  //   %23dc3545      URL-encoded inside a data: URI, for the validation icon
  //
  // The triplet is the one that matters most and is easiest to overlook: the
  // text-* and bg-* utilities never touch the hex at all.
  const rgbMap = new Map();
  const asTriplet = (hex) => channels(hex).join(',');
  for (const [from, to] of map) rgbMap.set(asTriplet(from), asTriplet(to));

  let replaced = 0;
  sheet.walkDecls((decl) => {
    let value = decl.value;

    // An explicit prefix is required. Matching a bare six-character run needs a
    // word boundary in front of it, and there is none inside "%23dc3545" —
    // between the "3" and the "d" both sides are word characters, so every
    // colour embedded in a data: URI was silently skipped.
    value = value.replace(/(%23|#)([0-9a-fA-F]{6})\b/g, (whole, prefix, hex) => {
      const to = map.get(('#' + hex).toLowerCase());
      if (!to) return whole;
      replaced++;
      return prefix === '%23' ? '%23' + to.slice(1) : to;
    });

    value = value.replace(/\b(\d{1,3}) *, *(\d{1,3}) *, *(\d{1,3})\b/g, (whole, r, g, b) => {
      const to = rgbMap.get(`${Number(r)},${Number(g)},${Number(b)}`);
      if (!to) return whole;
      replaced++;
      return to;
    });

    decl.value = value;
  });
  return { replaced, mapped: map.size };
}

pruneUnusedVariables(out);
const recoloured = recolour(out);
console.log(`re-coloured ${recoloured.replaced} value(s) across ${recoloured.mapped} mapped hex codes`);


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
