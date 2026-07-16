/* converter.js — the resume page's pic→ASCII converter UI (C6).
   "this is how the curator sees you." Wires the drop-zone / file input and
   the live controls (width / charset / invert) to asciify.js. All in-browser;
   the image is never uploaded.

   The output font auto-fits: it's sized so `cols` characters exactly fill the
   output box, so the art is always legible regardless of the width setting. */

import { imageToAscii, fileToImage } from './asciify.js?v=4.55';

const CHAR_W_RATIO = 0.6;   // monospace advance width ≈ 0.6em

export function initConverter() {
  const root = document.getElementById('converter');
  if (!root) return;

  const drop    = root.querySelector('.conv-drop');
  const input   = root.querySelector('#conv-file');
  const thumb   = root.querySelector('#conv-thumb');
  const widthEl = root.querySelector('#conv-width');
  const widthOut= root.querySelector('#conv-width-out');
  const rampEl  = root.querySelector('#conv-ramp');
  const invertEl= root.querySelector('#conv-invert');
  const out     = root.querySelector('#conv-out');
  const copyBtn = root.querySelector('#conv-copy');
  const dlBtn   = root.querySelector('#conv-download');
  const status  = root.querySelector('#conv-status');

  let currentImg = null;
  let currentUrl = null;
  let currentCols = +widthEl.value;

  // size the <pre> font so `cols` chars fill the output box width
  function fitFont() {
    const boxW = out.clientWidth - 8;            // minus padding
    if (boxW <= 0 || !currentCols) return;
    const fs = boxW / (currentCols * CHAR_W_RATIO);
    out.style.fontSize = Math.max(2, Math.min(14, fs)) + 'px';
  }

  function render() {
    if (!currentImg) return;
    currentCols = +widthEl.value;
    const ascii = imageToAscii(currentImg, {
      cols:   currentCols,
      ramp:   rampEl.value,
      invert: invertEl.checked
    });
    out.textContent = ascii;
    fitFont();
    const has = ascii.trim().length > 0;
    copyBtn.disabled = dlBtn.disabled = !has;
    out.setAttribute('aria-label', has ? 'ASCII rendering of your image' : 'no output');
  }

  async function load(file) {
    status.textContent = 'reading…';
    try {
      const { img, url } = await fileToImage(file);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentImg = img;
      currentUrl = url;
      thumb.src = url;
      thumb.hidden = false;
      status.textContent = 'the curator sees you. adjust the dials.';
      render();
    } catch {
      status.textContent = 'that file did not decode as an image. try a jpg or png.';
      currentImg = null;
      out.textContent = '';
      thumb.hidden = true;
      copyBtn.disabled = dlBtn.disabled = true;
    }
  }

  // ---- file input ------------------------------------------------------
  input.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) load(f);
  });

  // ---- drag & drop -----------------------------------------------------
  ['dragenter', 'dragover'].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(ev =>
    drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', e => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) load(f);
  });

  // ---- live controls ---------------------------------------------------
  widthEl.addEventListener('input', () => { widthOut.textContent = widthEl.value; render(); });
  rampEl.addEventListener('change', render);
  invertEl.addEventListener('change', render);
  widthOut.textContent = widthEl.value;

  // keep the art filling the box as the layout reflows
  if ('ResizeObserver' in window) new ResizeObserver(fitFont).observe(out);
  else addEventListener('resize', fitFont);

  // ---- copy / download -------------------------------------------------
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(out.textContent);
      copyBtn.textContent = 'copied ✓';
      setTimeout(() => { copyBtn.textContent = 'copy'; }, 1400);
    } catch {
      status.textContent = 'clipboard blocked. select the text and copy manually.';
    }
  });

  dlBtn.addEventListener('click', () => {
    const blob = new Blob([out.textContent], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'curator-view.txt';
    a.click();
    URL.revokeObjectURL(url);
  });
}
