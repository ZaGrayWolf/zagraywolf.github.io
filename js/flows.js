/* flows.js — the ASCII flow system (A5), alley edition.
   The Helix: a rotating double-helix column dropping from the name sign
   toward the signs row — center-stage by owner request (A5 placed it in the
   right margin; that placement returns for chapter pages in P2).
   Streams: glyph rivers fanning from the helix base to each sign and the
   ▼ DAWN cue — the page's "explore" affordance.
   Budgets (C2): helix ≤160 cells, streams ≤240 glyphs. No shadowBlur.
   Hidden below 900px (A8). Zero deps. */

import { subscribe } from './ticker.js?v=4.46';
import { cssRGB } from './curator.js?v=4.46';
import { parallax } from './alley.js?v=4.46';

const SIGNS_F = .75;                 // parallax factor of .layer-signs
const CELL_H = 16;                   // helix row pitch (px) — bigger centerpiece
const R = 66;                        // helix radius (px) — enlarged (owner: bigger)
const MAX_ROWS = 64;                 // 2·64 strands + 16 rungs = 144 ≤ 160
const STREAM_SPACING = 13;           // px between stream cells
const STREAM_MAX = 40;               // 6 streams × 40 = 240
const TAIL = 6;                      // bright head length (cells)
const DOTS = ['·', '∘', '•', '●'];   // depth ramp, back → front
const STREAM_GLYPHS = '·∘•:+';
const DUST_N = 50;                   // ambient background motes
const FONT = '"MS Gothic","Noto Sans Mono CJK JP",monospace';
const rand = a => a[(Math.random() * a.length) | 0];

export function initFlows(){
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.id = 'flows-canvas';
  canvas.className = 'fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  const DIM = cssRGB('--dim');
  const NEON = cssRGB('--neon-cyan');
  const lerpC = (k, a) => {
    const r = DIM[0] + (NEON[0] - DIM[0]) * k,
          g = DIM[1] + (NEON[1] - DIM[1]) * k,
          b = DIM[2] + (NEON[2] - DIM[2]) * k;
    return `rgba(${r|0},${g|0},${b|0},${a.toFixed(2)})`;
  };

  let W, H, DPR, active = false;

  // ---- layout (page coordinates; drawn at pageY − scrollY) -------------
  const helix = { cx: 0, top: 0, rows: 0, phases: [] };
  let streams = [];

  function layout(){
    active = innerWidth >= 900;
    if (!active){ ctx.clearRect(0, 0, W, H); return; }

    const hero = document.querySelector('.name-sign');
    const signsRow = document.querySelector('.layer-signs');
    if (!hero || !signsRow){ active = false; return; }

    const hr = hero.getBoundingClientRect();
    const sr = signsRow.getBoundingClientRect();
    // signs layer rect includes its current parallax transform — remove it
    const srTop = sr.top - parallax.y * SIGNS_F;

    helix.cx = hr.left + hr.width / 2;
    helix.top = hr.bottom + scrollY + 12;
    helix.rows = Math.min(MAX_ROWS, Math.max(0, ((srTop + scrollY - 16 - helix.top) / CELL_H) | 0));
    if (helix.phases.length !== helix.rows){
      helix.phases = Array.from({ length: helix.rows }, () => Math.random());
    }

    buildStreams(sr, signsRow);
  }

  function buildStreams(sr, signsRow){
    const baseY = helix.top + helix.rows * CELL_H;
    const B = { x: helix.cx, y: baseY };
    const targets = [];
    for (const el of signsRow.querySelectorAll('.sign')){
      const r = el.getBoundingClientRect();
      targets.push({
        x: r.left + r.width / 2 - parallax.x * SIGNS_F,
        y: r.top + scrollY - parallax.y * SIGNS_F - 6,
        track: true                                   // moves with signs layer
      });
    }
    const down = document.querySelector('.alley-down');
    if (down){
      const r = down.getBoundingClientRect();
      targets.push({ x: r.left + r.width / 2, y: r.top + scrollY - 8, track: false });
    }

    streams = targets.map(T => {
      const C = { x: B.x + (T.x - B.x) * .5, y: B.y + 30 };   // gentle fan-out
      const cells = [];
      let prev = B, walked = 0;
      for (let s = 1; s <= 200; s++){
        const t = s / 200;
        const u = 1 - t;
        const p = {
          x: u * u * B.x + 2 * u * t * C.x + t * t * T.x,
          y: u * u * B.y + 2 * u * t * C.y + t * t * T.y
        };
        walked += Math.hypot(p.x - prev.x, p.y - prev.y);
        prev = p;
        if (walked >= STREAM_SPACING && cells.length < STREAM_MAX){
          walked = 0;
          cells.push({ x: p.x, y: p.y, ch: rand(STREAM_GLYPHS), mutAt: Math.random() * 4000 });
        }
      }
      // bounding box (page coords) for region clears
      let x0 = B.x, x1 = B.x, y0 = B.y, y1 = B.y;
      for (const c of cells){
        x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x);
        y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y);
      }
      return {
        cells, track: T.track,
        head: Math.random() * cells.length,
        stallUntil: 0,
        box: { x: x0 - 14, y: y0 - 14, w: x1 - x0 + 28, h: y1 - y0 + 28 }
      };
    });
  }

  // ---- scroll velocity modulates ω and stream rate (A5) ------------------
  let vel = 0, lastScrollY = scrollY;
  addEventListener('scroll', () => {
    vel += (scrollY - lastScrollY) * .15;
    lastScrollY = scrollY;
  }, { passive: true });

  // ---- degrade (C2) -------------------------------------------------------
  let rungs = true, tail = TAIL;
  let dustCount = DUST_N;
  addEventListener('zgw:degrade', () => { rungs = false; tail = 3; dustCount = DUST_N / 2 | 0; });

  // ---- ambient dust — slow motes drifting up through the whole scene ------
  // (these cover the viewport, so frames clear full-canvas; the fillText
  // count, not the clear, is the real cost)
  const dust = [];
  function buildDust(){
    dust.length = 0;
    for (let i = 0; i < DUST_N; i++) dust.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .008,
      vy: -(.004 + Math.random() * .014),
      size: 8 + Math.random() * 7,
      a: .05 + Math.random() * .09,
      depth: Math.random()
    });
  }

  function drawDust(dt){
    for (let i = 0; i < dustCount; i++){
      const p = dust[i];
      if (!reduced){
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y < -10){ p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
      }
      ctx.font = (p.size | 0) + 'px ' + FONT;
      ctx.fillStyle = lerpC(p.depth * .35, p.a);
      ctx.fillText(DOTS[(p.depth * 3) | 0], p.x, p.y);
    }
  }

  function drawHelix(t){
    const om = t * (.0006 + Math.min(.0014, Math.abs(vel) * .00004));
    const breath = R + 3 * Math.sin(t * .0004);            // the spine breathes
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let row = 0; row < helix.rows; row++){
      const yv = helix.top + row * CELL_H - scrollY;
      if (yv < -20 || yv > H + 20) continue;
      const a1 = om + row * .42;
      const s1 = Math.sin(a1), s2 = Math.sin(a1 + Math.PI);
      const seph = Math.abs(s1 - s2) / 2;                  // 0..1 separation
      for (const s of [s1, s2]){
        const depth = (s + 1) / 2;                          // 0 back, 1 front
        const x = helix.cx + s * breath;
        ctx.font = (13 + depth * 10 | 0) + 'px ' + FONT;
        ctx.fillStyle = lerpC(depth * .9, .15 + depth * .7);
        ctx.fillText(DOTS[Math.min(3, (depth * 4) | 0)], x, yv);
      }
      if (rungs && row % 4 === 0 && seph > .85){
        const rung = seph > .97 ? '⋯' : '··';
        ctx.font = '13px ' + FONT;
        ctx.fillStyle = lerpC(.3, .3);
        ctx.fillText(rung, helix.cx + (s1 + s2) / 2 * R, yv);
      }
    }
  }

  function drawStreams(t, dt){
    const rate = 4 + Math.min(10, Math.abs(vel) * .05);
    for (const s of streams){
      const n = s.cells.length;
      if (!n) continue;
      if (t > s.stallUntil){
        s.head = (s.head + dt / 1000 * rate) % n;
        // idle drips: random stalls when nothing is scrolling (A5)
        if (Math.abs(vel) < .5 && Math.random() < dt * .0004){
          s.stallUntil = t + 400 + Math.random() * 800;
        }
      }
      const px = s.track ? parallax.x * SIGNS_F : 0;
      const py = s.track ? parallax.y * SIGNS_F : 0;
      for (let i = 0; i < n; i++){
        const c = s.cells[i];
        if (t > c.mutAt){ c.ch = rand(STREAM_GLYPHS); c.mutAt = t + 2000 + Math.random() * 6000; }
        const yv = c.y + py - scrollY;
        if (yv < -20 || yv > H + 20) continue;
        const d = (i - s.head + n) % n;                    // distance behind head
        const lit = d < tail ? 1 - d / tail : 0;
        ctx.font = (lit ? 12 : 10) + 'px ' + FONT;
        ctx.fillStyle = lit ? lerpC(.2 + lit * .8, .18 + lit * .65) : lerpC(0, .16);
        ctx.fillText(c.ch, c.x + px, yv);
      }
    }
  }

  function frame(t, dt){
    if (!active) return;
    vel *= .92;
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    drawDust(dt);
    drawHelix(t);
    drawStreams(t, dt);
  }

  // ---- lifecycle -----------------------------------------------------------
  function resize(){
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildDust();
    layout();
    if (reduced && active){ frameStatic(); }
  }

  function frameStatic(){
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    drawDust(0);
    drawHelix(1200);
    drawStreams(1200, 0);
  }

  let debounce = 0;
  addEventListener('resize', () => {
    clearTimeout(debounce);
    debounce = setTimeout(resize, 150);
  });

  resize();
  // the mono font reflows the hero once loaded — re-anchor
  document.fonts?.ready.then(() => { layout(); if (reduced && active) frameStatic(); });

  let unsubscribe = null;
  if (!reduced) unsubscribe = subscribe(frame);

  return {
    destroy(){
      unsubscribe && unsubscribe();
      canvas.remove();
    }
  };
}
