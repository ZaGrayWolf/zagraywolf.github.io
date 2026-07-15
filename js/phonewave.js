/* phonewave.js — phones have no cursor, so the curator's follow-your-mouse job is
   dead weight on the home hub. We retire the swarm there and replace it with two
   calm ambient pieces on the same canvas: a few dim kanji drifting in the deep
   bg, and a cyan sine wave of glyphs breathing across the lower screen — proof
   the entity's still alive, just resting. Phone + home only; night-world canvas.
   Reduced-motion draws one static frame and stops (no loop, no battery drain).
   ponytail: ~16 floaters + ~18 wave cells + one rAF; browsers pause rAF in bg. */

const WAVE_G  = 'アカサタナハ·•°ﾟｦｧ018'.split('');
const KANJI   = '夜光影星夢雨森猫路灯静音'.split('');
const FONT    = '13px "MS Gothic","Osaka-Mono",ui-monospace,monospace';
const cssRGB  = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const pick    = a => a[(Math.random() * a.length) | 0];

export function initPhoneWave(canvas){
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NEON = cssRGB('--neon-cyan') || '#7df9ff';
  const DIM  = cssRGB('--dim') || '#2a3142';
  const STEP = 22;                              // px between glyphs along the crest
  const K = 0.016, SPEED = 0.0016;             // wavelength + drift

  let W, H, cells = [], floaters = [];
  function build(){
    const DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // wave cells along the lower crest
    const n = Math.ceil(W / STEP) + 2;
    cells = Array.from({ length: n }, () => ({ ch: pick(WAVE_G), next: Math.random() * 4000 }));
    // dim kanji adrift in the background
    floaters = Array.from({ length: 28 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      dx: (Math.random() - .5) * .12, dy: (Math.random() - .5) * .12,
      ch: pick(KANJI), size: 14 + Math.random() * 16,
      a: .16 + Math.random() * .2, next: Math.random() * 6000,
    }));
  }
  build();
  addEventListener('resize', build, { passive: true });

  // the wave lives in the bottom fifth; a soft second harmonic keeps it organic
  const yAt = (x, t) => {
    const by = H * 0.82, a = Math.min(46, H * 0.06);
    return by + a * Math.sin(K * x - t * SPEED) + a * 0.35 * Math.sin(K * 2.3 * x + t * SPEED * 0.6);
  };

  function draw(t){
    ctx.clearRect(0, 0, W, H);

    // ---- background kanji drift (dim) ----
    ctx.fillStyle = DIM;
    for (const f of floaters){
      if (!reduced){
        f.x += f.dx; f.y += f.dy;
        if (f.x < -20) f.x = W + 20; else if (f.x > W + 20) f.x = -20;
        if (f.y < -20) f.y = H + 20; else if (f.y > H + 20) f.y = -20;
        if (t > f.next){ f.ch = pick(KANJI); f.next = t + 5000 + Math.random() * 6000; }
      }
      ctx.globalAlpha = f.a;
      ctx.font = f.size + 'px "MS Gothic","Osaka-Mono",ui-monospace,monospace';
      ctx.fillText(f.ch, f.x, f.y);
    }

    // ---- the sine wave (cyan) ----
    ctx.fillStyle = NEON; ctx.font = FONT;
    for (let i = 0; i < cells.length; i++){
      const c = cells[i], x = i * STEP;
      if (!reduced && t > c.next){ c.ch = pick(WAVE_G); c.next = t + 2500 + Math.random() * 4000; }
      const crest = 0.55 + 0.45 * Math.sin(K * x - t * SPEED);   // brighter on the up-crest
      const edge = Math.min(1, Math.min(x, W - x) / 60);         // fade into the side edges
      ctx.globalAlpha = 0.10 + 0.28 * crest * edge;
      ctx.fillText(c.ch, x, yAt(x, t));
    }
    ctx.globalAlpha = 1;
  }

  if (reduced){ draw(0); return; }             // static frame, no animation loop
  (function loop(t){ draw(t); requestAnimationFrame(loop); })(0);
}
