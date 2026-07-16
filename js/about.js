/* about.js — page module for /about (CH.00).
   Mirrors the alley's pointer parallax, decodes the name, and adds the one
   behaviour the alley doesn't have: the strewn glyph characters scatter away
   from the cursor as it passes over them, then drift back. Progressive
   enhancement — the scene composes correctly with JS off, and everything is
   gated on a fine pointer + not prefers-reduced-motion. */

import { subscribe } from './ticker.js?v=4.60';
import { scramble } from './scramble.js?v=4.60';

export function initAbout(curator){
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- the name decodes out of the noise --------------------------------
  for (const span of document.querySelectorAll('.name-sign .name-en, .name-sign .name-tag')){
    scramble(span, 900);
  }

  if (reduced || !matchMedia('(pointer: fine)').matches) return;

  // ---- pointer parallax (×factor from data-parallax) --------------------
  const layers = [...document.querySelectorAll('[data-parallax]')].map(el => ({
    el, f: parseFloat(el.dataset.parallax)
  }));
  const AMP = 26;                       // px at factor 1, screen edge
  let nx = 0, ny = 0, cx = 0, cy = 0;   // wanted / current, both -1..1
  let px = 0, py = 0;                    // current parallax offset at factor 1

  // ---- cursor-reactive glyphs -------------------------------------------
  // each strewn span is nudged away from the pointer within RADIUS, with a
  // distance falloff, then eased back to rest. The repel offset is applied as
  // an extra translate appended to the centering transform so it stacks with
  // the layer's parallax (the parent moves; the glyph also dodges).
  const RADIUS = 130;                   // px — the cursor's "personal space"
  const PUSH   = 46;                    // px — max shove at point-blank range
  const glyphs = [...document.querySelectorAll('.layer-glyphs span')].map(el => ({
    el, dx: 0, dy: 0, tx: 0, ty: 0      // current (dx,dy) eased toward target (tx,ty)
  }));
  let mx = -9999, my = -9999;           // pointer in viewport px

  addEventListener('pointermove', e => {
    nx = (e.clientX / innerWidth) * 2 - 1;
    ny = (e.clientY / innerHeight) * 2 - 1;
    mx = e.clientX; my = e.clientY;
  }, { passive: true });

  subscribe(() => {
    // smooth the parallax target
    cx += (nx - cx) * .04;
    cy += (ny - cy) * .04;
    px = -cx * AMP;
    py = -cy * AMP * .5;
    for (const { el, f } of layers){
      el.style.transform = `translate3d(${(px * f).toFixed(2)}px,${(py * f).toFixed(2)}px,0)`;
    }

    // READ pass — measure every glyph's centre in one batch. Interleaving these
    // getBoundingClientRect reads with the transform writes below forced a
    // synchronous reflow PER glyph (~130 a frame) and was the main-thread stall
    // that made this page feel heavy. Batched: the first read flushes one reflow,
    // the rest are free. Same values, so the motion is identical.
    for (const g of glyphs){
      const r = g.el.getBoundingClientRect();
      g.gx = r.left + r.width / 2;
      g.gy = r.top + r.height / 2;
    }
    // WRITE pass — compute each dodge target, ease toward it, apply. No reads here.
    for (const g of glyphs){
      const ddx = g.gx - mx, ddy = g.gy - my;
      const dist = Math.hypot(ddx, ddy);
      if (dist < RADIUS && dist > 0.01){
        const force = (1 - dist / RADIUS) * PUSH;   // 0 at edge → PUSH at centre
        g.tx = (ddx / dist) * force;
        g.ty = (ddy / dist) * force;
      } else {
        g.tx = 0; g.ty = 0;                          // out of range → drift home
      }
      g.dx += (g.tx - g.dx) * .12;
      g.dy += (g.ty - g.dy) * .12;
      // keep the original -50%,-50% centering, then add the dodge
      g.el.style.transform =
        `translate(-50%,-50%) translate(${g.dx.toFixed(2)}px,${g.dy.toFixed(2)}px)`;
    }
  });
}
