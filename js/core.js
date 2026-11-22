// Pure logic (no DOM). Shared by the app and node --test.
export const DPI = 300;
export const MM_PER_INCH = 25.4;

export const mmToPx = (mm, dpi = DPI) => Math.round((mm / MM_PER_INCH) * dpi);
export const inchToMm = (i) => i * MM_PER_INCH;

// guide: fractions of photo height (head top line / chin line), from the top.
export const PRESETS = [
  { id: 'resume',   w: 30, h: 40, guide: { top: 0.12, chin: 0.84 } },
  { id: 'passport', w: 35, h: 45, guide: { top: 0.09, chin: 0.85 } },
  { id: 'license',  w: 24, h: 30, guide: { top: 0.10, chin: 0.84 } },
  { id: 'exam',     w: 30, h: 40, guide: { top: 0.12, chin: 0.84 } },
  { id: 'us',       w: inchToMm(2), h: inchToMm(2), guide: { top: 0.15, chin: 0.75 } },
  { id: 'custom',   w: 35, h: 45, guide: { top: 0.10, chin: 0.84 } },
];
// NOTE: w x h is width x height (portrait). "40x30mm" in Japanese notation is height x width.

export const SHEETS = {
  L:  { wmm: 127, hmm: 89 },
  A4: { wmm: 210, hmm: 297 },
};

export function presetSize(preset, dpi = DPI) {
  return { wPx: mmToPx(preset.w, dpi), hPx: mmToPx(preset.h, dpi) };
}

// Grid layout of identical photos on a sheet, centered, mm-based gaps, px output.
export function layoutSheet(sheet, photo, { marginMm = 5, gapMm = 2, dpi = DPI } = {}) {
  const sw = mmToPx(sheet.wmm, dpi), sh = mmToPx(sheet.hmm, dpi);
  const pw = mmToPx(photo.w, dpi), ph = mmToPx(photo.h, dpi);
  const m = mmToPx(marginMm, dpi), g = mmToPx(gapMm, dpi);
  const fit = (avail, size) => (avail < size ? 0 : Math.floor((avail - size) / (size + g)) + 1);
  const cols = fit(sw - 2 * m, pw), rows = fit(sh - 2 * m, ph);
  const positions = [];
  if (cols && rows) {
    const totalW = cols * pw + (cols - 1) * g, totalH = rows * ph + (rows - 1) * g;
    const x0 = Math.round((sw - totalW) / 2), y0 = Math.round((sh - totalH) / 2);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        positions.push({ x: x0 + c * (pw + g), y: y0 + r * (ph + g), w: pw, h: ph });
  }
  return { sheetW: sw, sheetH: sh, photoW: pw, photoH: ph, cols, rows, count: positions.length, positions };
}

// ---- Crop model: crop = { cx, cy, w } in source-image px; height derived from aspect (w/h).
export const cropHeight = (crop, aspect) => crop.w / aspect;

export function initialCrop(imgW, imgH, aspect) {
  // Largest aspect-correct rect that fits, centered slightly toward the top (heads sit high).
  let w = Math.min(imgW, imgH * aspect);
  return clampCrop({ cx: imgW / 2, cy: imgH / 2, w }, imgW, imgH, aspect);
}

export function clampCrop(crop, imgW, imgH, aspect) {
  const maxW = Math.min(imgW, imgH * aspect);
  const minW = maxW / 8;
  const w = Math.min(maxW, Math.max(minW, crop.w));
  const h = w / aspect;
  const cx = Math.min(imgW - w / 2, Math.max(w / 2, crop.cx));
  const cy = Math.min(imgH - h / 2, Math.max(h / 2, crop.cy));
  return { cx, cy, w };
}

export function cropRect(crop, aspect) {
  const h = cropHeight(crop, aspect);
  return { x: crop.cx - crop.w / 2, y: crop.cy - h / 2, w: crop.w, h };
}

// factor > 1 zooms in (smaller source region). Keeps the crop center fixed.
export function zoomCrop(crop, factor, imgW, imgH, aspect) {
  return clampCrop({ ...crop, w: crop.w / factor }, imgW, imgH, aspect);
}

// Preview pixel delta (drag) -> new crop. Dragging right moves the image right => crop center moves left.
export function panCrop(crop, dxView, dyView, viewW, imgW, imgH, aspect) {
  const k = crop.w / viewW; // source px per view px
  return clampCrop({ ...crop, cx: crop.cx - dxView * k, cy: crop.cy - dyView * k }, imgW, imgH, aspect);
}

// Preview point -> source image point.
export function viewToImage(px, py, crop, viewW, viewH, aspect) {
  const r = cropRect(crop, aspect);
  return { x: r.x + (px / viewW) * r.w, y: r.y + (py / viewH) * r.h };
}
export function imageToView(x, y, crop, viewW, viewH, aspect) {
  const r = cropRect(crop, aspect);
  return { x: ((x - r.x) / r.w) * viewW, y: ((y - r.y) / r.h) * viewH };
}

// ---- PNG: insert pHYs chunk so the file carries 300 dpi metadata.
let crcTable;
export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function setPngDpi(png, dpi = DPI) {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21); // len(4) type(4) data(9) crc(4)
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  // Insert after IHDR (8 sig + 25 IHDR); drop any existing pHYs.
  const out = new Uint8Array(png.length + 21);
  out.set(png.subarray(0, 33), 0);
  out.set(chunk, 33);
  out.set(png.subarray(33), 54);
  return out;
}
