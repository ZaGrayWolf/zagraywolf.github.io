/* asciify.js — image → ASCII core (C6).
   100% client-side: an <img>/canvas source is drawn to an offscreen canvas at
   cols × rows, per-pixel luminance is mapped to a ramp char. Nothing is ever
   uploaded — the file never leaves the browser.

   Char cells are ~2× taller than wide, so rows are scaled by CHAR_ASPECT to
   keep the picture from stretching vertically.

   Quality: luminance is auto-stretched between the 2nd/98th percentile before
   mapping, so real photos (which cluster in the midtones) use the whole ramp
   instead of coming out as a flat grey blob. */

const CHAR_ASPECT = 0.5;   // row height / col width for a monospace cell

// luminance ramps, dark → light (index 0 = darkest ink, last = lightest)
export const RAMPS = {
  dense:    '@%#*+=-:. ',
  blocks:   '█▓▒░ ',
  // density-ordered katakana-ish: heavy strokes → light strokes → space
  katakana: '畫鬱蘭厩薔翻鷹奥车人个十二一丶 '
};

/* Convert an image source (HTMLImageElement / HTMLCanvasElement / ImageBitmap)
   to an ASCII string.
   opts: { cols, ramp ('dense'|'blocks'|'katakana'), invert, autoContrast } */
export function imageToAscii(src, { cols = 100, ramp = 'dense', invert = false, autoContrast = true } = {}) {
  const ramps = RAMPS[ramp] || RAMPS.dense;
  const chars = [...ramps];                       // codepoint-safe (katakana)
  const n = chars.length - 1;

  const sw = src.naturalWidth  || src.width;
  const sh = src.naturalHeight || src.height;
  if (!sw || !sh) return '';

  cols = Math.max(8, Math.min(240, cols | 0));
  const rows = Math.max(1, Math.round(cols * (sh / sw) * CHAR_ASPECT));

  const cv = document.createElement('canvas');
  cv.width = cols; cv.height = rows;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, cols, rows);

  let data;
  try {
    data = ctx.getImageData(0, 0, cols, rows).data;
  } catch {
    return '';   // tainted canvas (cross-origin) — shouldn't happen for file input
  }

  // ---- pass 1: luminance per cell (transparent → lightest) -----------------
  const N = cols * rows;
  const lum = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    const a = data[i + 3] / 255;
    lum[p] = a < 0.04
      ? 1
      : (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }

  // ---- auto-contrast: stretch 2nd–98th percentile to 0..1 ------------------
  let lo = 0, hi = 1;
  if (autoContrast) {
    const sorted = Float32Array.from(lum).sort();
    lo = sorted[Math.floor(N * 0.02)];
    hi = sorted[Math.ceil(N * 0.98) - 1];
    if (!(hi - lo > 0.02)) { lo = 0; hi = 1; }   // flat image — skip stretch
  }
  const span = hi - lo || 1;

  // ---- pass 2: build the text ---------------------------------------------
  let out = '';
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) {
      let v = (lum[y * cols + x] - lo) / span;     // stretched
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      if (invert) v = 1 - v;
      // v 0 (dark) → darkest char (index 0); v 1 (light) → lightest (index n)
      line += chars[Math.round(v * n)];
    }
    out += line + '\n';
  }
  return out;
}

/* Load a File (from input/drop) into an HTMLImageElement.
   Returns { img, url } — caller revokes url when done (so the thumbnail can
   keep using it). Rejects on a non-image / decode failure. */
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('not an image'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}
