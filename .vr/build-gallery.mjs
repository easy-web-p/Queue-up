/**
 * A page rendering every Bootstrap-only class this project uses.
 *
 * The comparison loads this page twice — once with Bootstrap's stylesheet, once
 * with the replacement — and reads computed styles. Both runs share the same
 * markup and the same base document, so any difference in the result is caused
 * by the stylesheet and nothing else. That makes a fixed list of visually
 * meaningful properties both simpler and stricter than trying to guess which
 * properties each class was supposed to touch.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const classes = JSON.parse(readFileSync('.vr/bootstrap-only.json', 'utf8')).map((r) => r.class);

// Components need their real surroundings: `.modal-title` inside `.modal-header`
// inside `.modal-content`, or the cascade never reaches it.
const WRAPPERS = {
  'modal-dialog': (c) => `<div class="modal"><div class="${c}"><div class="modal-content">x</div></div></div>`,
  'modal-dialog-centered': (c) => `<div class="modal"><div class="modal-dialog ${c}"><div class="modal-content">x</div></div></div>`,
  'modal-lg': (c) => `<div class="modal"><div class="modal-dialog ${c}"><div class="modal-content">x</div></div></div>`,
  'modal-header': (c) => `<div class="modal"><div class="modal-dialog"><div class="modal-content"><div class="${c}">x</div></div></div></div>`,
  'modal-title': (c) => `<div class="modal"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="${c}">x</h5></div></div></div></div>`,
  'modal-body': (c) => `<div class="modal"><div class="modal-dialog"><div class="modal-content"><div class="${c}">x</div></div></div></div>`,
  'modal-footer': (c) => `<div class="modal"><div class="modal-dialog"><div class="modal-content"><div class="${c}">x</div></div></div></div>`,
  'progress-bar': (c) => `<div class="progress"><div class="${c}" style="width:50%">x</div></div>`,
  'progress-bar-striped': (c) => `<div class="progress"><div class="progress-bar ${c}" style="width:50%">x</div></div>`,
  'progress-bar-animated': (c) => `<div class="progress"><div class="progress-bar progress-bar-striped ${c}" style="width:50%">x</div></div>`,
  'dropdown-item': (c) => `<div class="dropdown-menu show"><a class="${c}" href="#">x</a></div>`,
  'dropdown-header': (c) => `<div class="dropdown-menu show"><h6 class="${c}">x</h6></div>`,
  'dropdown-menu-end': (c) => `<div class="dropdown-menu ${c} show">x</div>`,
  'table-hover': (c) => `<table class="table ${c}"><tbody><tr><td>x</td></tr></tbody></table>`,
  'table-light': (c) => `<table class="table"><tbody><tr class="${c}"><td>x</td></tr></tbody></table>`,
  'table-responsive': (c) => `<div class="${c}"><table class="table"><tbody><tr><td>x</td></tr></tbody></table></div>`,
  show: (c) => `<div class="dropdown-menu ${c}">x</div>`,
  fade: (c) => `<div class="modal ${c}">x</div>`,
  col: (c) => `<div class="row"><div class="${c}">x</div></div>`,
};
// Every col-*/row-cols-*/g-* needs a .row parent.
for (const c of classes) {
  if (/^col-/.test(c)) WRAPPERS[c] = (x) => `<div class="row"><div class="${x}">x</div></div>`;
  if (/^row-cols-/.test(c)) WRAPPERS[c] = (x) => `<div class="row ${x}"><div class="col">x</div></div>`;
  if (/^g-\d$/.test(c)) WRAPPERS[c] = (x) => `<div class="row ${x}"><div class="col">x</div></div>`;
}

// Elements whose default styling matters to the class under test.
const TAG = {
  btn: 'button', 'btn-close': 'button', 'form-control-sm': 'input', 'form-select': 'select',
  'form-range': 'input', 'form-label': 'label', 'form-text': 'div', 'nav-link': 'a',
  'dropdown-toggle': 'button', badge: 'span', small: 'small',
};
const VARIANT_BASE = {
  btn: ['btn-sm','btn-lg','btn-light','btn-dark','btn-link','btn-secondary','btn-danger','btn-warning','btn-success',
        'btn-outline-primary','btn-outline-secondary','btn-outline-success','btn-outline-danger','btn-outline-warning','btn-outline-light'],
  alert: ['alert-info','alert-success','alert-warning'],
  'btn-close': ['btn-close-white'],
};

function markup(cls) {
  if (WRAPPERS[cls]) return WRAPPERS[cls](cls);
  let base = '';
  for (const [b, variants] of Object.entries(VARIANT_BASE)) if (variants.includes(cls)) base = b + ' ';
  const tag = TAG[cls] || (base ? TAG[base.trim()] : null) || 'div';
  const attrs = tag === 'input' ? (cls === 'form-range' ? ' type="range"' : ' type="text"') : '';
  const inner = tag === 'select' ? '<option>x</option>' : 'x';
  return `<${tag} class="${base}${cls}"${attrs}>${inner}</${tag}>`;
}

// The base layer the real app always has: Tailwind's preflight and the
// project's own stylesheet. Present identically in both runs, so it cancels
// out — but it has to be there, or the comparison measures Bootstrap's Reboot
// (box-sizing, line-height, font-family) rather than the classes under test.
//
// It is injected BEFORE the stylesheet under test, because that is the order
// the built page uses. main.jsx imports Bootstrap first, but Vite puts it in
// the vendor-ui chunk, and dist/index.html links index.css before vendor-ui.css
// — so Bootstrap loads LAST and wins every collision at equal specificity.
// Reading the import order and assuming it was the load order got this backwards
// once already; the built HTML is the only thing that settles it.
const baseCss = readdirSync('dist/assets')
  .filter((f) => /^index-.*\.css$/.test(f))
  .map((f) => readFileSync(join('dist/assets', f), 'utf8'))
  .join('\n');

const cells = classes
  .map((c) => `<div class="probe" data-cls="${c}">${markup(c)}</div>`)
  .join('\n');

writeFileSync('.vr/gallery.html', `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<title>Bootstrap class gallery</title>
<style>${baseCss}</style>
<!--STYLESHEET-->
<style>
  /* Neutral frame. Identical in both runs, so it cancels out of the comparison. */
  body { margin: 0; font-family: sans-serif; background: #fff; }
  .probe { display: block; width: 320px; margin: 4px; }
</style>
</head><body>
${cells}
</body></html>
`);
console.log(`gallery: ${classes.length} probes`);
