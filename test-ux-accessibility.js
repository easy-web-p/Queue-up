/**
 * ============================================================================
 * UX / ACCESSIBILITY REGRESSION SUITE
 * ============================================================================
 *
 * Three properties that are easy to fix once and easy to lose again, because
 * nothing in the build complains when they regress:
 *
 *  1. No browser alert()/confirm(). Those bypass the design system entirely,
 *     block the JS thread, and on iOS render as chrome the app cannot style or
 *     rely on. Every one of the ~60 the app used to raise is now a toast.
 *  2. Every icon-only control carries an accessible name. A button whose only
 *     child is an icon announces as "button" to a screen reader — the user is
 *     told something is actionable but not what it does.
 *  3. The accessibility baseline in index.css stays in place: a visible
 *     :focus-visible ring, a skip-to-content link, and a reduced-motion block.
 *
 * These are source-shape properties, so they are checked by parsing the source.
 * The alternative — a DOM test per screen — would assert far less for far more.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
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

const ROOT = new URL('.', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

function collectSources(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collectSources(full));
    else if (/\.(jsx|tsx|js|ts)$/.test(entry)) found.push(full);
  }
  return found;
}

const SOURCES = collectSources(SRC);
const read = (file) => readFileSync(file, 'utf8');
const rel = (file) => relative(ROOT, file);

// The provider is the one file allowed to name the browser dialogs: its
// out-of-provider fallback is what keeps an isolated component talking.
const TOAST_PROVIDER = join(SRC, 'components', 'ToastProvider.jsx');

console.log('\n🎨 UX / ACCESSIBILITY REGRESSION SUITE\n');

// ===========================================================================
console.log('1. Browser dialogs are gone');
// ===========================================================================

runTest('🚨 No source file raises alert() or confirm()', () => {
  const offenders = [];
  for (const file of SOURCES) {
    if (file === TOAST_PROVIDER) continue;
    for (const [i, line] of read(file).split('\n').entries()) {
      // toast.confirm({...}) is the replacement, not the thing being banned.
      const stripped = line.replace(/toast\.confirm\(/g, '');
      if (/(^|[^.\w])(window\.)?(alert|confirm)\s*\(/.test(stripped)) {
        offenders.push(`${rel(file)}:${i + 1}`);
      }
    }
  }
  assert(offenders.length === 0, `browser dialogs remain at:\n       ${offenders.join('\n       ')}`);
});

runTest('The toast provider still falls back to the browser outside a provider', () => {
  const src = read(TOAST_PROVIDER);
  assert(src.includes('window.alert'), 'the fallback must still exist');
  assert(src.includes('window.confirm'), 'confirm must still have a fallback');
});

runTest('The provider is mounted above the router, so every page can reach it', () => {
  const app = read(join(SRC, 'App.jsx'));
  assert(app.includes('<ToastProvider>'), 'App must render the provider');
  assert(
    app.indexOf('<ToastProvider>') < app.indexOf('<BrowserRouter>'),
    'the provider must wrap the router, not sit inside a route'
  );
});

runTest('Every file calling useToast() imports it', () => {
  const offenders = [];
  for (const file of SOURCES) {
    if (file === TOAST_PROVIDER) continue;
    const src = read(file);
    if (src.includes('useToast()') && !/import\s*\{[^}]*useToast[^}]*\}/.test(src)) {
      offenders.push(rel(file));
    }
  }
  assert(offenders.length === 0, `missing import in: ${offenders.join(', ')}`);
});

runTest('Errors are not auto-dismissed', () => {
  // A failure message usually carries something the user has to act on; one that
  // disappears mid-read is worse than none.
  assert(
    /tone !== 'error'/.test(read(TOAST_PROVIDER)),
    'the auto-dismiss timer must exclude the error tone'
  );
});

// ===========================================================================
console.log('\n2. Icon-only controls have an accessible name');
// ===========================================================================

/**
 * Finds elements whose entire visible content is icons — no text node, and no
 * string literal inside a JSX expression.
 */
function findUnlabelledIconControls(src, tagPattern) {
  const found = [];
  const re = new RegExp(`<(${tagPattern})\\b([^>]*?)>([\\s\\S]*?)</\\1>`, 'g');
  let m;
  while ((m = re.exec(src)) !== null) {
    const [, , attrs, body] = m;
    if (attrs.includes('aria-label')) continue;
    let text = body.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    if (/\{[^{}]*['"`][^'"`]+['"`][^{}]*\}/.test(text)) continue; // literal text in an expression
    text = text.replace(/<[^>]*>/g, '').replace(/\{[^{}]*\}/g, '').trim();
    if (text) continue;
    found.push(src.slice(0, m.index).split('\n').length);
  }
  return found;
}

runTest('🚨 No icon-only <button> is left without an accessible name', () => {
  const offenders = [];
  for (const file of SOURCES) {
    if (!/\.(jsx|tsx)$/.test(file)) continue;
    for (const line of findUnlabelledIconControls(read(file), 'button')) {
      offenders.push(`${rel(file)}:${line}`);
    }
  }
  assert(offenders.length === 0, `unlabelled icon buttons:\n       ${offenders.join('\n       ')}`);
});

runTest('🚨 No icon-only link is left without an accessible name', () => {
  const offenders = [];
  for (const file of SOURCES) {
    if (!/\.(jsx|tsx)$/.test(file)) continue;
    for (const line of findUnlabelledIconControls(read(file), 'Link|a')) {
      offenders.push(`${rel(file)}:${line}`);
    }
  }
  assert(offenders.length === 0, `unlabelled icon links:\n       ${offenders.join('\n       ')}`);
});

runTest('title alone is not accepted as the accessible name', () => {
  // The detector must not treat title="..." as a label: title is not announced
  // reliably and never reaches a touch user at all.
  const sample = '<button title="ปิด"><X /></button>';
  assert(
    findUnlabelledIconControls(sample, 'button').length === 1,
    'a title-only icon button must still be reported'
  );
});

runTest('The detector recognises a real label', () => {
  const sample = '<button aria-label="ปิด"><X /></button>';
  assert(findUnlabelledIconControls(sample, 'button').length === 0, 'aria-label must satisfy it');
});

runTest('The detector does not flag a button with visible text', () => {
  const sample = '<button><Save /> บันทึก</button>';
  assert(findUnlabelledIconControls(sample, 'button').length === 0, 'text content must satisfy it');
});

runTest('The detector does not flag text supplied by an expression', () => {
  const sample = "<button><Save />{isSaving ? 'กำลังบันทึก' : 'บันทึก'}</button>";
  assert(findUnlabelledIconControls(sample, 'button').length === 0, 'a rendered label must satisfy it');
});

// ===========================================================================
console.log('\n3. The accessibility baseline in index.css');
// ===========================================================================

const CSS = read(join(SRC, 'index.css'));

runTest('🚨 Keyboard focus is visible app-wide', () => {
  assert(CSS.includes(':focus-visible'), 'a :focus-visible rule must exist');
  assert(/:focus-visible\s*\{[^}]*outline:/.test(CSS), 'it must paint an outline');
});

runTest('The focus ring uses the design-system accent', () => {
  assert(/:focus-visible\s*\{[^}]*#FF7A1A/i.test(CSS), 'must use the brand accent');
});

runTest('A mouse press leaves no ring behind', () => {
  assert(CSS.includes(':focus:not(:focus-visible)'), 'the mouse-focus reset must exist');
});

runTest('🚨 A skip-to-content link exists and is reachable', () => {
  assert(CSS.includes('.skip-to-content'), 'the class must be styled');
  assert(/\.skip-to-content:focus\s*\{/.test(CSS), 'it must become visible on focus');
  const app = read(join(SRC, 'App.jsx'));
  assert(app.includes('skip-to-content'), 'App must render the link');
  assert(app.includes('href="#main-content"'), 'it must point at the content target');
  assert(app.includes('id="main-content"'), 'the target must exist');
});

runTest('The skip link is positioned so scrolling cannot hide it', () => {
  const block = CSS.slice(CSS.indexOf('.skip-to-content'), CSS.indexOf('.skip-to-content:focus'));
  assert(/position:\s*fixed/.test(block), 'absolute positioning scrolls away with the page');
});

runTest('🚨 A stated preference for reduced motion is honoured', () => {
  assert(CSS.includes('prefers-reduced-motion: reduce'), 'the media query must exist');
  const block = CSS.slice(CSS.indexOf('prefers-reduced-motion: reduce'));
  assert(/animation-duration:\s*0\.001ms\s*!important/.test(block), 'animations must be neutralised');
  assert(/transition-duration:\s*0\.001ms\s*!important/.test(block), 'transitions must be neutralised');
});

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
