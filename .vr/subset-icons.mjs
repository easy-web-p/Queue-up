/**
 * Subsets the bootstrap-icons font and stylesheet to the icons this project uses.
 *
 * The font ships 2,078 glyphs in a 134 KB woff2, plus a 180 KB woff fallback and
 * a 79 KB stylesheet declaring every one of them. This project renders 193.
 *
 * Both outputs are committed rather than built, so nobody needs fonttools
 * installed to build the app. Regenerating does need it:
 *
 *   pip install fonttools brotli
 *   node .vr/enumerate-icons.mjs && node .vr/subset-icons.mjs
 *
 * The woff fallback is dropped. It exists for browsers that predate woff2,
 * which has been universal since 2016 — none of them can run this app, and
 * every browser that can picks the woff2 first and never fetches it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const { icons, codepoints } = JSON.parse(readFileSync('.vr/icons-used.json', 'utf8'));

const SRC_FONT = 'node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2';
const OUT_FONT = 'src/assets/fonts/bootstrap-icons-subset.woff2';
const OUT_CSS = 'src/styles/bootstrap-icons-subset.css';

// ---- the font -------------------------------------------------------------
const unicodes = codepoints.map((c) => 'U+' + c.toString(16).toUpperCase()).join(',');
execFileSync('python3', [
  '-m', 'fontTools.subset', SRC_FONT,
  `--unicodes=${unicodes}`,
  '--flavor=woff2',
  '--layout-features=*',
  `--output-file=${OUT_FONT}`,
], { stdio: 'inherit' });

// ---- the stylesheet -------------------------------------------------------
const source = readFileSync('node_modules/bootstrap-icons/font/bootstrap-icons.css', 'utf8');

// The `.bi` base rule: font-family, line-height, the -webkit smoothing. Taken
// from the source rather than retyped, so it cannot drift.
const baseMatch = source.match(/\.bi::before,\s*\[class\^="bi-"\]::before,\s*\[class\*=" bi-"\]::before\s*\{[^}]*\}/);
if (!baseMatch) throw new Error('could not find the .bi base rule — has bootstrap-icons changed shape?');

const rules = icons
  .map((name) => {
    const m = source.match(new RegExp(`\\.${name}::before\\s*\\{[^}]*\\}`));
    if (!m) throw new Error(`no rule for ${name}`);
    return m[0];
  })
  .join('\n');

const css = `/*
 * ============================================================================
 * BOOTSTRAP ICONS, SUBSET — GENERATED, DO NOT EDIT
 * ============================================================================
 *
 * Source:     node_modules/bootstrap-icons
 * Generator:  node .vr/enumerate-icons.mjs && node .vr/subset-icons.mjs
 * Verified:   npm run test:icons
 *
 * ${icons.length} of 2,078 icons — the ones this project actually renders.
 *
 * The full package ships a 134 KB woff2, a 180 KB woff fallback and a 79 KB
 * stylesheet declaring every glyph. The fallback is dropped: it exists for
 * browsers older than woff2, which has been universal since 2016, and every
 * browser that can run this app picks the woff2 and never fetches it.
 *
 * Adding an icon to the app means regenerating this file. The enumerator finds
 * literal class names anywhere in src/; a name assembled at runtime, like
 * bi-chevron-\${open ? 'up' : 'down'}, has to be listed in RUNTIME_BUILT in
 * .vr/enumerate-icons.mjs, or its glyph will not be in the font and the icon
 * will render as a blank box. test-icon-subset.js checks for exactly that.
 */

@font-face {
  font-display: block;
  font-family: "bootstrap-icons";
  src: url("../assets/fonts/bootstrap-icons-subset.woff2") format("woff2");
}

${baseMatch[0]}

${rules}
`;

writeFileSync(OUT_CSS, css);

const kb = (p) => (readFileSync(p).length / 1024).toFixed(1);
console.log(`\nfont  ${kb(SRC_FONT)} KB → ${kb(OUT_FONT)} KB`);
console.log(`css   ${kb('node_modules/bootstrap-icons/font/bootstrap-icons.css')} KB → ${kb(OUT_CSS)} KB`);
