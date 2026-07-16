/* meteors.js — Tiamat's Comet from "Your Name" (Makoto Shinkai, 2016).
   Rendering pipeline per meteor (draw order):
     1. Outer bloom halo  — additive blend, 2.4× halfW, very transparent
     2. Blue outer shell  — normal blend, tapered polygon
     3. Warm inner core   — normal blend, 0.45× halfW, orange→yellow
     4. Bright spine      — additive blend, 0.20× halfW, white-blue
     5. Radial coma       — additive blend, radial gradient at the head
   Polygon edges use midpoint-quadratic bezier for smooth curves.
   Fragmentation: large comet splits at 25-40% of life; ~40% of small
   meteors split at 40-65% of life. */

import { subscribe } from './ticker.js?v=4.57';

export function initMeteors() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'meteor-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  const curator = document.getElementById('curator-canvas');
  if (curator) curator.insertAdjacentElement('beforebegin', canvas);
  else document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  function resize() {
    W = innerWidth; H = innerHeight;
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  let degraded = false;
  window.addEventListener('zgw:degrade', () => { degraded = true; }, { once: true });

  const meteors     = [];
  const splitBursts = [];
  let hasLarge  = false;
  let nextSmall = 4000  + Math.random() * 4000;
  let nextLarge = 36000 + Math.random() * 16000;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeVelocity(speed) {
    const pitchDeg = Math.atan2(H, W) * (180 / Math.PI);
    const baseDeg  = 180 - pitchDeg + rand(15, 24);
    const rad      = baseDeg * Math.PI / 180;
    return { vx: Math.cos(rad) * speed, vy: Math.sin(rad) * speed };
  }

  function makeOrigin() {
    return { x: W * rand(0.76, 1.05), y: H * rand(0.0, 0.13) };
  }

  function makeLife(speed) {
    return (Math.hypot(W, H) * rand(0.80, 0.92)) / speed;
  }

  // ── small meteors ─────────────────────────────────────────────────────────
  function spawnSmall(offsetMs, opts) {
    setTimeout(() => {
      if (!W) return;
      const speed   = opts?.speed  ?? rand(0.28, 0.42);
      const halfW   = opts?.halfW  ?? rand(5, 10);
      const maxLife = opts?.maxLife ?? makeLife(speed);
      const willSplit = !degraded && !opts?.noSplit && Math.random() < 0.40;
      const { vx, vy } = opts?.vel ?? makeVelocity(speed);
      const { x, y }   = opts?.pos ?? makeOrigin();
      meteors.push({
        type:    'small',
        x, y, vx, vy,
        ay:       rand(0.000060, 0.000140),
        elapsed:  0,
        maxLife,
        trailLen: rand(486, 840),
        halfW,
        trail:    [],
        split:    !willSplit,
        splitAt:  willSplit ? maxLife * rand(0.40, 0.65) : 0,
      });
    }, offsetMs);
  }

  function spawnCluster() {
    const n = degraded ? 2 : Math.floor(rand(2, 5));
    for (let i = 0; i < n; i++) spawnSmall(i * rand(100, 360));
  }

  // ── fragmentation helpers ─────────────────────────────────────────────────
  function emitBurst(x, y, count, warmRatio) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      splitBursts.push({
        x, y,
        vx:   Math.cos(angle) * rand(0.08, 0.48),
        vy:   Math.sin(angle) * rand(0.08, 0.48),
        r:    rand(1.2, 4.5),
        life: rand(0.50, 1.0),
        warm: Math.random() < warmRatio,
      });
    }
  }

  function triggerFragmentation(m) {
    emitBurst(m.x, m.y, degraded ? 8 : 22, 0.40);

    const devAngle = rand(-0.22, 0.22);
    const cs = Math.cos(devAngle), sn = Math.sin(devAngle);
    const fragSpeed = rand(0.72, 0.86);
    const remLife = m.maxLife - m.elapsed;

    meteors.push({
      type:    'fragment',
      x: m.x, y: m.y,
      vx: (m.vx * cs - m.vy * sn) * fragSpeed,
      vy: (m.vx * sn + m.vy * cs) * fragSpeed,
      ay:       m.ay * rand(0.90, 1.10),
      elapsed:  0,
      maxLife:  remLife * rand(0.60, 0.80),
      trailLen: rand(390, 650),
      halfW:    rand(10, 17),
      trail:    [],
      split:    true,
    });

    const shardCount = degraded ? 0 : Math.floor(rand(1, 3));
    for (let i = 0; i < shardCount; i++) {
      const sd = rand(-0.40, 0.40);
      const sc = Math.cos(sd), ss = Math.sin(sd);
      spawnSmall(0, {
        vel:     { vx: (m.vx * sc - m.vy * ss) * rand(0.55, 0.80), vy: (m.vx * ss + m.vy * sc) * rand(0.55, 0.80) },
        pos:     { x: m.x + rand(-20, 20), y: m.y + rand(-20, 20) },
        halfW:   rand(5, 8),
        maxLife: remLife * rand(0.35, 0.60),
        noSplit: true,
      });
    }
  }

  function triggerSmallFragmentation(m) {
    emitBurst(m.x, m.y, degraded ? 3 : 7, 0.50);
    const remLife = m.maxLife - m.elapsed;
    const count = Math.floor(rand(1, 3));
    for (let i = 0; i < count; i++) {
      const sd = rand(-0.35, 0.35);
      const cs = Math.cos(sd), sn = Math.sin(sd);
      const sp = rand(0.60, 0.84);
      spawnSmall(0, {
        vel:     { vx: (m.vx * cs - m.vy * sn) * sp, vy: (m.vx * sn + m.vy * cs) * sp },
        pos:     { x: m.x + rand(-10, 10), y: m.y + rand(-10, 10) },
        halfW:   m.halfW * rand(0.35, 0.55),
        maxLife: remLife * rand(0.40, 0.65),
        noSplit: true,
      });
    }
  }

  // ── large comet ───────────────────────────────────────────────────────────
  // Single blue comet enters frame, travels ~25-40% of its path, then splits
  // via triggerFragmentation: burst flash + orange fragment + blue shards.
  function spawnLargeComet() {
    if (hasLarge) return;
    hasLarge = true;
    const speed   = rand(0.18, 0.27);
    const { vx, vy } = makeVelocity(speed);
    const { x, y }   = makeOrigin();
    const maxLife     = makeLife(speed);

    meteors.push({
      type:     'large',
      x, y, vx, vy,
      ay:       rand(0.000022, 0.000055),
      elapsed:  0,
      maxLife,
      trailLen: rand(1070, 1490),
      halfW:    rand(23, 32),
      trail:    [],
      sparkles: [],
      split:    false,
      splitAt:  maxLife * rand(0.25, 0.40),
    });
  }

  // ── geometry helpers ──────────────────────────────────────────────────────
  // Compute normalised perpendicular at each trail point (once, reused across passes)
  function buildNormals(trail) {
    return trail.map((pt, i) => {
      let dx = 0, dy = 0;
      if (i > 0)              { dx += trail[i].x - trail[i-1].x; dy += trail[i].y - trail[i-1].y; }
      if (i < trail.length-1) { dx += trail[i+1].x - trail[i].x; dy += trail[i+1].y - trail[i].y; }
      const len = Math.hypot(dx, dy) || 1;
      return { nx: -dy / len, ny: dx / len };
    });
  }

  // Build offset edges at the given halfW using precomputed normals
  function edgesFromNormals(trail, normals, halfW) {
    const n = trail.length;
    const upper = new Array(n), lower = new Array(n);
    for (let i = 0; i < n; i++) {
      const w = halfW * (i / (n - 1));
      upper[i] = { x: trail[i].x + normals[i].nx * w, y: trail[i].y + normals[i].ny * w };
      lower[i] = { x: trail[i].x - normals[i].nx * w, y: trail[i].y - normals[i].ny * w };
    }
    return { upper, lower };
  }

  // Smooth polygon fill using midpoint-quadratic bezier (eliminates visible corners)
  function fillSmooth(upper, lower) {
    const n = upper.length;
    if (n < 2) return;
    ctx.beginPath();
    // upper edge: tail → head
    ctx.moveTo((upper[0].x + upper[1].x) / 2, (upper[0].y + upper[1].y) / 2);
    for (let i = 1; i < n - 1; i++) {
      const mx = (upper[i].x + upper[i+1].x) / 2;
      const my = (upper[i].y + upper[i+1].y) / 2;
      ctx.quadraticCurveTo(upper[i].x, upper[i].y, mx, my);
    }
    ctx.lineTo(upper[n-1].x, upper[n-1].y);
    // lower edge: head → tail
    ctx.lineTo(lower[n-1].x, lower[n-1].y);
    for (let i = n - 2; i > 0; i--) {
      const mx = (lower[i].x + lower[i-1].x) / 2;
      const my = (lower[i].y + lower[i-1].y) / 2;
      ctx.quadraticCurveTo(lower[i].x, lower[i].y, mx, my);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── drawing ───────────────────────────────────────────────────────────────
  function drawMeteor(m) {
    if (m.trail.length < 2) return;

    const n    = m.trail.length;
    const head = m.trail[n - 1];
    const tail = m.trail[0];
    const t    = m.elapsed / m.maxLife;
    const fadeIn  = Math.min(1, t / 0.12);
    const fadeOut = Math.max(0, 1 - t);
    const life    = fadeIn * fadeOut * (1 / 0.88);
    if (life <= 0.01) return;

    const hw      = m.halfW * Math.max(0.2, life);
    const normals = buildNormals(m.trail);

    ctx.save();

    // ── 1. OUTER BLOOM HALO (additive, 2.4× wide, very transparent) ──────────
    if (!degraded) {
      const { upper: hu, lower: hl } = edgesFromNormals(m.trail, normals, hw * 2.4);
      const haloGrad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      if (m.type === 'fragment') {
        haloGrad.addColorStop(0,   'rgba(0,0,0,0)');
        haloGrad.addColorStop(0.4, `rgba(255,100,0,${0.10 * life})`);
        haloGrad.addColorStop(1,   `rgba(255,200,50,${0.18 * life})`);
      } else {
        haloGrad.addColorStop(0,   'rgba(0,0,0,0)');
        haloGrad.addColorStop(0.4, `rgba(0,100,255,${0.10 * life})`);
        haloGrad.addColorStop(1,   `rgba(80,200,255,${0.18 * life})`);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = haloGrad;
      fillSmooth(hu, hl);
      ctx.globalCompositeOperation = 'source-over';
    }

    if (m.type === 'fragment') {
      // ── FRAGMENT: single warm layer ─────────────────────────────────────────
      ctx.shadowColor = `rgba(255,140,0,${0.95 * life})`;
      ctx.shadowBlur  = 36;
      const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      g.addColorStop(0,    'rgba(180,40,0,0)');
      g.addColorStop(0.14, `rgba(255,80,0,${0.36 * life})`);
      g.addColorStop(0.36, `rgba(255,140,0,${0.82 * life})`);
      g.addColorStop(0.60, `rgba(255,205,40,${0.96 * life})`);
      g.addColorStop(0.82, `rgba(255,235,130,${life})`);
      g.addColorStop(1,    `rgba(255,252,210,${life})`);
      ctx.fillStyle = g;
      const { upper, lower } = edgesFromNormals(m.trail, normals, hw);
      fillSmooth(upper, lower);

    } else {
      // ── 2. BLUE OUTER SHELL ─────────────────────────────────────────────────
      if (m.type === 'large') {
        ctx.shadowColor = `rgba(0,120,255,${0.95 * life})`;
        ctx.shadowBlur  = 54;
      } else {
        ctx.shadowColor = `rgba(0,150,255,${0.80 * life})`;
        ctx.shadowBlur  = 22;
      }
      const blue = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      if (m.type === 'large') {
        // film-accurate: deep indigo → cobalt → electric blue → ice-blue → white
        blue.addColorStop(0,    'rgba(0,5,80,0)');
        blue.addColorStop(0.12, `rgba(0,40,180,${0.28 * life})`);   // deep cobalt
        blue.addColorStop(0.32, `rgba(0,100,255,${0.68 * life})`);  // royal blue
        blue.addColorStop(0.55, `rgba(20,170,255,${0.90 * life})`); // electric blue
        blue.addColorStop(0.78, `rgba(120,220,255,${life})`);        // blue-white
        blue.addColorStop(1,    `rgba(220,245,255,${life})`);        // near-white nucleus
      } else {
        blue.addColorStop(0,    'rgba(0,30,180,0)');
        blue.addColorStop(0.20, `rgba(0,110,255,${0.26 * life})`);
        blue.addColorStop(0.52, `rgba(40,185,255,${0.76 * life})`);
        blue.addColorStop(0.82, `rgba(170,230,255,${0.95 * life})`);
        blue.addColorStop(1,    `rgba(230,248,255,${life})`);
      }
      ctx.fillStyle = blue;
      const { upper, lower } = edgesFromNormals(m.trail, normals, hw);
      fillSmooth(upper, lower);

      // ── 3. WARM INNER CORE (orange → amber → golden-yellow) ─────────────────
      const innerRatio = m.type === 'large' ? 0.40 : 0.50;
      const { upper: wu, lower: wl } = edgesFromNormals(m.trail, normals, hw * innerRatio);
      ctx.shadowBlur = 0;
      const warm = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      warm.addColorStop(0,    'rgba(200,50,0,0)');
      warm.addColorStop(0.25, `rgba(255,100,0,${0.44 * life})`);
      warm.addColorStop(0.55, `rgba(255,190,20,${0.76 * life})`);
      warm.addColorStop(0.82, `rgba(255,238,110,${0.92 * life})`);
      warm.addColorStop(1,    `rgba(255,252,200,${life})`);
      ctx.fillStyle = warm;
      fillSmooth(wu, wl);
    }

    // ── 4. BRIGHT INNER SPINE (additive) ─────────────────────────────────────
    // A very narrow, very bright strip down the centre creates the illusion
    // of a hot filament running through the comet trail.
    if (!degraded) {
      const { upper: su, lower: sl } = edgesFromNormals(m.trail, normals, hw * 0.14);
      const spineGrad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      if (m.type === 'fragment') {
        spineGrad.addColorStop(0,   'rgba(0,0,0,0)');
        spineGrad.addColorStop(0.3, `rgba(255,160,20,${0.30 * life})`);
        spineGrad.addColorStop(1,   `rgba(255,255,200,${0.70 * life})`);
      } else {
        spineGrad.addColorStop(0,   'rgba(0,0,0,0)');
        spineGrad.addColorStop(0.3, `rgba(100,200,255,${0.30 * life})`);
        spineGrad.addColorStop(1,   `rgba(240,252,255,${0.80 * life})`);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = spineGrad;
      fillSmooth(su, sl);
      ctx.globalCompositeOperation = 'source-over';
    }

    // ── 5. RADIAL COMA at the head (additive) ────────────────────────────────
    // The atmospheric halo around the nucleus — the most distinctive Shinkai
    // comet visual. A large radial gradient that adds light around the head.
    {
      const comaR = hw * (m.type === 'large' ? 3.5 : 2.8);
      const coma  = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, comaR);
      if (m.type === 'fragment') {
        coma.addColorStop(0,    `rgba(255,255,200,${0.90 * life})`);
        coma.addColorStop(0.12, `rgba(255,200,40,${0.70 * life})`);
        coma.addColorStop(0.35, `rgba(255,120,0,${0.30 * life})`);
        coma.addColorStop(1,    'rgba(0,0,0,0)');
      } else {
        coma.addColorStop(0,    `rgba(240,252,255,${0.90 * life})`);
        coma.addColorStop(0.12, `rgba(100,210,255,${0.60 * life})`);
        coma.addColorStop(0.35, `rgba(0,120,255,${0.25 * life})`);
        coma.addColorStop(1,    'rgba(0,0,0,0)');
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = coma;
      ctx.beginPath();
      ctx.arc(head.x, head.y, comaR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();

    // ── sparkles (large comet only, mix blue + warm, additive) ───────────────
    if (m.type === 'large' && m.sparkles) {
      for (const s of m.sparkles) s.life -= 0.016;
      if (Math.random() < 0.42) {
        m.sparkles.push({
          x:    head.x + rand(-40, 40),
          y:    head.y + rand(-40, 40),
          r:    rand(1.2, 4.0),
          life: rand(0.55, 1.0),
          warm: Math.random() < 0.45,
        });
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of m.sparkles) {
        if (s.life <= 0) continue;
        ctx.globalAlpha = s.life * 0.55 * life;
        ctx.fillStyle   = s.warm ? 'rgba(255,200,60,1)' : 'rgba(80,190,255,1)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      m.sparkles = m.sparkles.filter(s => s.life > 0);
    }
  }

  function drawSplitBursts() {
    if (!splitBursts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of splitBursts) {
      if (s.life <= 0) continue;
      ctx.globalAlpha = s.life * 0.70;
      ctx.fillStyle   = s.warm ? 'rgba(255,190,30,1)' : 'rgba(60,180,255,1)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── ticker ────────────────────────────────────────────────────────────────
  let idleCleared = false;
  const unsubscribe = subscribe((t, dt) => {
    // spawn timers advance every frame, even ones we skip drawing on
    nextSmall -= dt;
    if (nextSmall <= 0) {
      spawnCluster();
      nextSmall = (degraded ? 24000 : 11000) + rand(0, 10000);
    }
    nextLarge -= dt;
    if (nextLarge <= 0 && !hasLarge) {
      spawnLargeComet();
      nextLarge = rand(52000, 90000);
    }

    // meteors are on-screen only briefly, ~seconds out of every 11–90s. When the
    // canvas is empty and already wiped, skip the full-screen clear + draw loops
    // entirely — an empty canvas looks identical either way, so this is invisible
    // and saves a full-viewport op per idle frame on the alley + about.
    if (meteors.length === 0 && splitBursts.length === 0) {
      if (idleCleared) return;
      ctx.clearRect(0, 0, W, H);   // one last wipe to erase the final frame
      idleCleared = true;
      return;
    }
    idleCleared = false;

    ctx.clearRect(0, 0, W, H);

    for (const m of meteors) {
      m.elapsed += dt;
      m.vy      += m.ay * dt;
      m.x       += m.vx * dt;
      m.y       += m.vy * dt;
      m.trail.push({ x: m.x, y: m.y });

      while (m.trail.length > 2) {
        const dx = m.trail[m.trail.length - 1].x - m.trail[0].x;
        const dy = m.trail[m.trail.length - 1].y - m.trail[0].y;
        if (Math.hypot(dx, dy) > m.trailLen) m.trail.shift();
        else break;
      }

      if (m.type === 'large' && !m.split && m.elapsed >= m.splitAt) {
        m.split = true;
        triggerFragmentation(m);
      }
      if (m.type === 'small' && !m.split && m.splitAt && m.elapsed >= m.splitAt) {
        m.split = true;
        triggerSmallFragmentation(m);
      }

      if (m.elapsed < m.maxLife) drawMeteor(m);
    }

    for (const s of splitBursts) {
      s.x    += s.vx * dt;
      s.y    += s.vy * dt;
      s.life -= dt / 900;
    }
    drawSplitBursts();
    for (let i = splitBursts.length - 1; i >= 0; i--) {
      if (splitBursts[i].life <= 0) splitBursts.splice(i, 1);
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      if (meteors[i].elapsed >= meteors[i].maxLife) {
        if (meteors[i].type === 'large') hasLarge = false;
        meteors.splice(i, 1);
      }
    }
  });

  return {
    destroy() {
      unsubscribe();
      canvas.remove();
      window.removeEventListener('resize', resize);
    },
  };
}
