import { PRESETS, SHEETS, DPI, mmToPx, layoutSheet, initialCrop, clampCrop, cropRect, zoomCrop, panCrop, setPngDpi } from './core.js';
import { t, detectLang, STRINGS } from './i18n.js';

const $ = (id) => document.getElementById(id);
const state = { img: null, crop: null, preset: PRESETS[1], lang: 'en', bright: 100, contrast: 100 };

// ---------- i18n ----------
function applyLang(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  document.title = lang === 'ja' ? '証明写真メーカー' : 'ID Photo Maker - Passport Photo';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(lang, el.dataset.i18n); });
  const sel = $('preset'), cur = sel.value;
  sel.innerHTML = '';
  for (const p of PRESETS) sel.add(new Option(t(lang, 'p.' + p.id), p.id));
  sel.value = cur || state.preset.id;
  renderSheet();
}

// ---------- preset / crop ----------
function currentPreset() {
  const p = { ...PRESETS.find((x) => x.id === $('preset').value) };
  if (p.id === 'custom') {
    p.w = Math.min(100, Math.max(10, +$('cw').value || 35));
    p.h = Math.min(100, Math.max(10, +$('ch').value || 45));
  }
  return p;
}
const aspect = () => state.preset.w / state.preset.h;

function onPresetChange() {
  state.preset = currentPreset();
  $('customRow').hidden = $('preset').value !== 'custom';
  if (state.img) { state.crop = initialCrop(state.img.width, state.img.height, aspect()); $('zoom').value = 0; sync(); }
}

function sync() { renderPreview(); renderSheet(); }

function drawCropped(ctx, w, h) {
  const r = cropRect(state.crop, aspect());
  ctx.save();
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.filter = `brightness(${state.bright}%) contrast(${state.contrast}%)`;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(state.img, r.x, r.y, r.w, r.h, 0, 0, w, h);
  ctx.restore();
}

function renderPreview() {
  if (!state.img) return;
  const cv = $('preview');
  const h = 450, w = Math.round(h * aspect());
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  drawCropped(ctx, w, h);
  if (!$('guides').checked) return;
  const g = state.preset.guide;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,40,40,.9)';
  ctx.setLineDash([6, 4]);
  for (const f of [g.top, g.chin]) { ctx.beginPath(); ctx.moveTo(0, f * h); ctx.lineTo(w, f * h); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(0,120,255,.9)';
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
  // head oval between the lines
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath(); ctx.ellipse(w / 2, ((g.top + g.chin) / 2) * h, ((g.chin - g.top) * h) * 0.36, ((g.chin - g.top) * h) / 2, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// ---------- sheet ----------
export function buildSheet(withMarks = true) {
  const layout = layoutSheet(SHEETS[$('paper').value], state.preset);
  const cv = $('sheet');
  cv.width = layout.sheetW; cv.height = layout.sheetH;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!state.img || !layout.count) return layout;
  // render one photo at full resolution, then tile it
  const tile = document.createElement('canvas');
  tile.width = layout.photoW; tile.height = layout.photoH;
  drawCropped(tile.getContext('2d'), tile.width, tile.height);
  for (const p of layout.positions) ctx.drawImage(tile, p.x, p.y);
  if (withMarks && $('cutlines').checked) {
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
    for (const p of layout.positions) ctx.strokeRect(p.x - 0.5, p.y - 0.5, p.w + 1, p.h + 1);
  }
  return layout;
}

function renderSheet() {
  const layout = buildSheet();
  $('sheetInfo').textContent = layout.count
    ? t(state.lang, 'sheetInfo', { n: layout.count, c: layout.cols, r: layout.rows, w: layout.sheetW, h: layout.sheetH })
    : t(state.lang, 'sheetNone');
}

function sheetBlob() {
  return new Promise((res) => $('sheet').toBlob(async (b) => {
    const bytes = setPngDpi(new Uint8Array(await b.arrayBuffer()), DPI);
    res(new Blob([bytes], { type: 'image/png' }));
  }, 'image/png'));
}

async function savePng() {
  const blob = await sheetBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `id-photo-${state.preset.id}-${$('paper').value}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return blob;
}

async function printSheet() {
  const blob = await sheetBlob();
  const sh = SHEETS[$('paper').value];
  const img = $('printImg');
  if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
  img.dataset.url = URL.createObjectURL(blob);
  img.style.width = sh.wmm + 'mm'; img.style.height = sh.hmm + 'mm';
  let st = $('pageStyle');
  if (!st) { st = document.createElement('style'); st.id = 'pageStyle'; document.head.appendChild(st); }
  st.textContent = `@page{size:${sh.wmm}mm ${sh.hmm}mm;margin:0}`;
  img.onload = () => window.print();
  img.src = img.dataset.url;
}

// ---------- loading ----------
async function loadFile(file) {
  if (!file) return;
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try { // fallback: <img> applies EXIF orientation by default in modern browsers
      const url = URL.createObjectURL(file);
      bmp = await new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ng; i.src = url; });
    } catch { alert(t(state.lang, 'loadError')); return; }
  }
  state.img = bmp;
  state.img.width; // ImageBitmap & HTMLImageElement both expose width/height
  state.preset = currentPreset();
  state.crop = initialCrop(bmp.width, bmp.height, aspect());
  $('zoom').value = 0;
  $('dropzone').hidden = true; $('editor').hidden = false;
  sync();
}

// ---------- interaction ----------
function setup() {
  const dz = $('dropzone');
  $('pick').onclick = () => $('file').click();
  dz.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') $('file').click(); };
  $('file').onchange = (e) => loadFile(e.target.files[0]);
  for (const ev of ['dragenter', 'dragover']) window.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); });
  for (const ev of ['dragleave', 'drop']) window.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); });
  window.addEventListener('drop', (e) => loadFile(e.dataTransfer?.files?.[0]));

  $('preset').onchange = onPresetChange;
  $('cw').oninput = $('ch').oninput = onPresetChange;
  $('paper').onchange = renderSheet;
  $('cutlines').onchange = renderSheet;
  $('guides').onchange = renderPreview;
  $('bright').oninput = (e) => { state.bright = +e.target.value; sync(); };
  $('contrast').oninput = (e) => { state.contrast = +e.target.value; sync(); };
  $('lang').onchange = (e) => { localStorage.setItem('lang', e.target.value); applyLang(e.target.value); };
  $('save').onclick = savePng;
  $('print').onclick = printSheet;

  // zoom slider: 0..100 -> w from max down to max/8 (log scale)
  const setZoom = (z) => { // z in [0,1]
    const { width: iw, height: ih } = state.img, a = aspect();
    const maxW = Math.min(iw, ih * a);
    state.crop = clampCrop({ ...state.crop, w: maxW / Math.pow(8, z) }, iw, ih, a);
    sync();
  };
  const zoomFromW = () => {
    const { width: iw, height: ih } = state.img, maxW = Math.min(iw, ih * aspect());
    return Math.log(maxW / state.crop.w) / Math.log(8);
  };
  $('zoom').oninput = (e) => setZoom(+e.target.value / 100);

  const cv = $('preview');
  let drag = null;
  cv.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); };
  cv.onpointermove = (e) => {
    if (!drag || !state.img) return;
    const k = cv.width / cv.getBoundingClientRect().width; // css px -> canvas px
    state.crop = panCrop(state.crop, (e.clientX - drag.x) * k, (e.clientY - drag.y) * k, cv.width, state.img.width, state.img.height, aspect());
    drag = { x: e.clientX, y: e.clientY };
    sync();
  };
  cv.onpointerup = cv.onpointercancel = () => { drag = null; cv.classList.remove('drag'); };
  cv.onwheel = (e) => {
    if (!state.img) return;
    e.preventDefault();
    state.crop = zoomCrop(state.crop, e.deltaY < 0 ? 1.08 : 1 / 1.08, state.img.width, state.img.height, aspect());
    $('zoom').value = Math.round(zoomFromW() * 100);
    sync();
  };
}

setup();
$('lang').value = detectLang(localStorage.getItem('lang'), navigator.language);
applyLang($('lang').value);
state.preset = currentPreset();
window.__idphoto = { state, loadFile, buildSheet, STRINGS }; // test hook

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
