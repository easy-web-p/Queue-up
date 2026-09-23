/**
 * Proves every icon still draws the same glyph after subsetting.
 *
 * Computed styles cannot answer this. `content: "\f1e3"` is set by the
 * stylesheet whether or not the font contains that glyph — a missing one just
 * renders as .notdef, an empty box, and every property still reads correctly.
 * The only honest test is to look at the pixels.
 *
 * Each glyph is drawn to a canvas at 64px in both fonts and the pixel data
 * hashed. Identical hash means the subset preserved that glyph exactly.
 *
 * A control is included: an icon deliberately left out of the subset must come
 * back with a DIFFERENT hash, or the comparison is measuring nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const { icons, codepoints } = JSON.parse(readFileSync('.vr/icons-used.json', 'utf8'));

// An icon the app does not use, so the subset should NOT contain it.
const CONTROL = { name: 'bi-tropical-storm', codepoint: null };
const iconCss = readFileSync('node_modules/bootstrap-icons/font/bootstrap-icons.css', 'utf8');
const cm = iconCss.match(new RegExp(`\\.${CONTROL.name}::before\\s*\\{\\s*content:\\s*"\\\\([0-9a-fA-F]+)"`));
if (cm) CONTROL.codepoint = parseInt(cm[1], 16);

async function hashes(fontPath) {
  const html = `<!doctype html><meta charset="utf-8">
<style>
  @font-face { font-family: "probe"; src: url("${pathToFileURL(fontPath).href}") format("woff2"); }
</style>
<body><canvas id="c" width="64" height="64"></canvas></body>`;
  writeFileSync('.vr/.icons.html', html);

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  await page.goto(pathToFileURL('.vr/.icons.html').href, { waitUntil: 'load' });

  // document.fonts.ready is not enough. A @font-face is only fetched when
  // something needs it, and setting ctx.font on a canvas does not count — the
  // first version of this test drew 193 identical blanks and reported them as
  // 193 identical glyphs. Load it explicitly and refuse to continue if it is
  // not there.
  const loaded = await page.evaluate(async () => {
    await document.fonts.load('48px probe');
    await document.fonts.ready;
    return document.fonts.check('48px probe');
  });
  if (!loaded) {
    await browser.close();
    throw new Error(`the font at ${fontPath} never loaded — the comparison would measure nothing`);
  }

  const result = await page.evaluate((points) => {
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const out = {};
    for (const [name, cp] of points) {
      ctx.clearRect(0, 0, 64, 64);
      ctx.font = '48px probe';
      ctx.textBaseline = 'top';
      ctx.fillText(String.fromCodePoint(cp), 8, 8);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      // FNV-1a over the alpha channel: shape only, independent of colour.
      let h = 0x811c9dc5;
      for (let i = 3; i < data.length; i += 4) {
        h ^= data[i];
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      out[name] = h.toString(16);
    }
    return out;
  }, [
    ...icons.map((n, i) => [n, codepoints[i]]),
    ...(CONTROL.codepoint ? [[CONTROL.name, CONTROL.codepoint]] : []),
    ['__blank__', 0x20], // a space: the hash of drawing nothing
  ]);

  await browser.close();
  return result;
}

const full = await hashes('node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2');
const subset = await hashes('src/assets/fonts/bootstrap-icons-subset.woff2');

// The hash of an empty canvas. Any glyph matching it drew nothing at all.
const BLANK = full.__blank__;

const broken = icons.filter((n) => full[n] !== subset[n]);
const blank = icons.filter((n) => subset[n] === BLANK);

console.log(`\n${icons.length - broken.length} / ${icons.length} glyphs identical after subsetting`);
if (blank.length) {
  console.log(`\n✗ ${blank.length} glyph(s) drew nothing at all:`);
  for (const n of blank.slice(0, 20)) console.log(`    ${n}`);
}
if (broken.length) {
  console.log('\n✗ glyphs that changed or went missing:');
  for (const n of broken.slice(0, 20)) console.log(`    ${n}`);
  if (broken.length > 20) console.log(`    …and ${broken.length - 20} more`);
}

let controlOk = true;
if (CONTROL.codepoint) {
  controlOk = full[CONTROL.name] !== subset[CONTROL.name];
  console.log(
    `\ncontrol — ${CONTROL.name} (not used by the app): ` +
      (controlOk
        ? 'absent from the subset, as expected — the comparison can tell'
        : 'IDENTICAL in both, so this test proves nothing')
  );
}

console.log(`\n${'='.repeat(60)}`);
const ok = broken.length === 0 && controlOk && blank.length === 0;
console.log(ok ? 'Every icon the app uses survives the subset.' : 'FAILED');
console.log('='.repeat(60));
process.exit(ok ? 0 : 1);
