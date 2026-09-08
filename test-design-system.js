/**
 * ============================================================================
 * DESIGN SYSTEM CONFORMANCE TEST SUITE
 * ============================================================================
 *
 * The app was running three visual languages at once. The measured state before
 * this work:
 *
 *   - 279 uses of a red-orange accent family — #ee4d2d and 27 neighbours — that
 *     docs/design_system.md does not contain, alongside 266 uses of the accent it
 *     does. Two products stitched together;
 *   - 1,110 hard-coded colour declarations across 25 hand-written stylesheets,
 *     every one of them invisible to the theme switch, against 168 dark-scoped
 *     rules in 1,403 blocks — so most surfaces simply stayed light in dark mode.
 *
 * Colours are now decided in one place (the --qu-* tokens in index.css) and the
 * accent is one accent. These tests hold that line: the palette is easy to
 * re-fragment one convenient hex at a time.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

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

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const read = (f) => readFileSync(f, 'utf8');
const rel = (f) => relative(ROOT, f);

function collect(dir, pattern) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collect(full, pattern));
    else if (pattern.test(entry)) found.push(full);
  }
  return found;
}

const SRC = join(ROOT, 'src');
const cssFiles = collect(SRC, /\.css$/);
const componentFiles = collect(SRC, /\.(jsx|tsx)$/);
const indexCss = read(join(SRC, 'index.css'));

/** Relative luminance, per WCAG. */
function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

console.log('\n🎨 DESIGN SYSTEM CONFORMANCE TEST SUITE\n');

// ===========================================================================
console.log('1. One accent, from the design system');
// ===========================================================================

/**
 * Warm, saturated colours that are neither of the design system's accent stops
 * nor its amber or red. Each one of these is a second brand colour.
 */
function offPaletteAccents(text) {
  const allowed = new Set(['#ff7a1a', '#e6680d', '#f59e0b', '#ef4444', '#10b981']);
  const found = new Map();
  for (const raw of text.match(/#[0-9a-fA-F]{6}/g) || []) {
    const hex = raw.toLowerCase();
    if (allowed.has(hex)) continue;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    if (r > 200 && g > 40 && g < 150 && b < 90) found.set(hex, (found.get(hex) || 0) + 1);
  }
  return found;
}

runTest('🚨 No second accent colour has crept back into the stylesheets', () => {
  const offenders = [];
  for (const f of cssFiles) {
    const found = offPaletteAccents(read(f));
    if (found.size) offenders.push(`${rel(f)}: ${[...found.keys()].join(', ')}`);
  }
  assert(offenders.length === 0, `off-palette accents:\n       ${offenders.join('\n       ')}`);
});

runTest('🚨 Nor into the components', () => {
  const offenders = [];
  for (const f of componentFiles) {
    const found = offPaletteAccents(read(f));
    if (found.size) offenders.push(`${rel(f)}: ${[...found.keys()].join(', ')}`);
  }
  assert(offenders.length === 0, `off-palette accents:\n       ${offenders.join('\n       ')}`);
});

runTest('The detector recognises the family it was built for', () => {
  // #ee4d2d was the most common of them, 140 uses.
  assert(offPaletteAccents('color: #ee4d2d;').size === 1, 'the old accent must be detected');
  assert(offPaletteAccents('color: #FF7A1A;').size === 0, 'the real accent must pass');
  assert(offPaletteAccents('color: #EF4444;').size === 0, 'the design system red must pass');
});

// ===========================================================================
console.log('\n2. Colour is decided in one place');
// ===========================================================================

const REQUIRED_TOKENS = [
  '--qu-accent', '--qu-accent-hover', '--qu-bg', '--qu-surface', '--qu-surface-alt',
  '--qu-border', '--qu-text', '--qu-text-secondary', '--qu-text-muted',
];

runTest('🚨 Every token is defined for light and overridden for dark', () => {
  const light = indexCss.slice(indexCss.indexOf(':root {'), indexCss.indexOf('html[data-theme="dark"] {'));
  const dark = indexCss.slice(indexCss.indexOf('html[data-theme="dark"] {'));
  for (const token of REQUIRED_TOKENS) {
    assert(light.includes(`${token}:`), `${token} has no light value`);
  }
  // Only the ones that must change between themes.
  for (const token of ['--qu-bg', '--qu-surface', '--qu-surface-alt', '--qu-border', '--qu-text', '--qu-text-secondary', '--qu-text-muted']) {
    assert(dark.slice(0, 900).includes(`${token}:`), `${token} is never redefined for dark mode`);
  }
});

runTest('The accent matches docs/design_system.md exactly', () => {
  assert(/--qu-accent:\s*#FF7A1A/i.test(indexCss), 'Primary Accent must be #FF7A1A');
  assert(/--qu-accent-hover:\s*#E6680D/i.test(indexCss), 'Primary Hover must be #E6680D');
});

runTest('🚨 The stylesheets actually use the tokens', () => {
  const uses = cssFiles.reduce((n, f) => n + (read(f).match(/var\(--qu-/g) || []).length, 0);
  assert(uses > 400, `only ${uses} token references — the palette is still hard-coded`);
});

runTest('Hard-coded colour declarations are well below where they started', () => {
  // 1,110 before. This is a ratchet, not a finish line: it must not climb back.
  let hard = 0;
  for (const f of cssFiles) {
    hard += (read(f).match(/^[ \t]*[a-z-]+\s*:\s*[^;]*#[0-9a-fA-F]{3,8}[^;]*;/gm) || []).length;
  }
  assert(hard < 750, `${hard} hard-coded colour declarations (was 1110, ratchet is 750)`);
});

// ===========================================================================
console.log('\n3. Dark mode is readable');
// ===========================================================================

const DARK_SURFACE = '#241C16';

runTest('🚨 No tokenised surface keeps text that vanishes in dark mode', () => {
  // Giving a rule a themed background without theming its text is how a card
  // turns dark and its label stays black. This is the check that caught three
  // real cases (#000000 sort buttons, #555555 secondary buttons).
  const offenders = [];
  for (const f of cssFiles) {
    const src = read(f);
    for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = m;
      if (selector.includes('data-theme')) continue;
      if (!/background(?:-color)?\s*:\s*var\(--qu-surface/.test(body)) continue;
      const color = body.match(/(?<!-)color\s*:\s*(#[0-9a-fA-F]{3,6})/);
      if (!color) continue;
      const ratio = contrast(color[1], DARK_SURFACE);
      if (ratio < 3) {
        offenders.push(`${rel(f)}:${src.slice(0, m.index).split('\n').length} ${color[1]} (${ratio.toFixed(2)}:1)`);
      }
    }
  }
  assert(offenders.length === 0, `unreadable on the dark surface:\n       ${offenders.join('\n       ')}`);
});

runTest('The dark surface and text tokens themselves clear WCAG AA', () => {
  const dark = indexCss.slice(indexCss.indexOf('html[data-theme="dark"] {'));
  const surface = dark.match(/--qu-surface:\s*(#[0-9a-fA-F]{6})/)[1];
  const text = dark.match(/--qu-text:\s*(#[0-9a-fA-F]{6})/)[1];
  const muted = dark.match(/--qu-text-muted:\s*(#[0-9a-fA-F]{6})/)[1];
  assert(contrast(text, surface) >= 4.5, `primary text on surface is ${contrast(text, surface).toFixed(2)}:1`);
  assert(contrast(muted, surface) >= 4.5, `muted text on surface is ${contrast(muted, surface).toFixed(2)}:1`);
});

runTest('And so do the light ones', () => {
  const light = indexCss.slice(indexCss.indexOf(':root {'), indexCss.indexOf('html[data-theme="dark"] {'));
  const surface = light.match(/--qu-surface:\s*(#[0-9a-fA-F]{6})/)[1];
  const text = light.match(/--qu-text:\s*(#[0-9a-fA-F]{6})/)[1];
  const muted = light.match(/--qu-text-muted:\s*(#[0-9a-fA-F]{6})/)[1];
  assert(contrast(text, surface) >= 4.5, `primary text on surface is ${contrast(text, surface).toFixed(2)}:1`);
  assert(contrast(muted, surface) >= 4.5, `muted text on surface is ${contrast(muted, surface).toFixed(2)}:1`);
});

runTest('🚨 The accent is legible on both surfaces as a large control', () => {
  // It backs buttons and badges, so it is measured against the text placed on it.
  const accent = '#FF7A1A';
  assert(contrast('#FFFFFF', accent) >= 2.5 || contrast('#16100C', accent) >= 4.5,
    'the accent needs a readable foreground in at least one direction');
  assert(contrast(accent, DARK_SURFACE) >= 3, 'the accent must stand out on the dark surface');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
