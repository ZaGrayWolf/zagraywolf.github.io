/* curator.js — the ASCII entity (C4), ported from reference/ascii-curator-demo.html.
   The demo's feel (lag, states, glyph mutation, startle physics) is approved —
   keep its constants. Added on top of demo v0.1:
     escort(targetEl)   drift toward a hovered sign (alley)
     formation 'line'   idle shape: rest along the street level
     'wave'             contact strip ノシ-ish drift (slow horizontal undulation)
   Pure module, zero deps. createCurator(canvas, config) */

import { subscribe, perf } from './ticker.js?v=4.46';

const KATA = 'アカサタナハマヤラワヰンｱｲｳｴｵｶｷｸｹｺｼﾂﾈﾐ';
const SOFT = '·.:¨ﾟ°+';
const BOX  = '─│┌┐└┘├┤╱╲╳';
const rand = a => a[(Math.random() * a.length) | 0];

/* tokens.css is the only color source — resolve hex vars to rgb triples.
   Read from <body> (not :root) so per-page token overrides (e.g. the alley's
   blue/white neon) reach the canvas-drawn helix + curator too. */
export function cssRGB(name){
  const hex = getComputedStyle(document.body).getPropertyValue(name).trim();
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

export function createCurator(canvas, config = {}){
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const density = config.density ?? 1;

  const DIM  = cssRGB(config.paletteDim || '--dim');
  const NEON = cssRGB(config.paletteNeon || '--neon-cyan');
  const HOT  = cssRGB(config.paletteHot || '--neon-mag');

  let W, H, DPR;
  function resize(){
    DPR = Math.min(devicePixelRatio || 1, 2);   // DPR cap (C2)
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (reduced) renderStatic();
  }

  // ---- particles (caps per C2: curator 130, ambient 110) -------------
  const ENTITY_N = Math.round(130 * density), AMBIENT_N = Math.round(110 * density);
  const ambient = [], entity = [];
  W = innerWidth; H = innerHeight;

  for (let i = 0; i < AMBIENT_N; i++) ambient.push({
    x: Math.random() * W, y: Math.random() * H,
    dx: (Math.random() - .5) * .12, dy: (Math.random() - .5) * .12,
    ch: rand(SOFT + KATA), size: 9 + Math.random() * 4,
    a: .12 + Math.random() * .22, mutAt: Math.random() * 6000
  });

  for (let i = 0; i < ENTITY_N; i++) entity.push({
    x: W / 2 + (Math.random() - .5) * 200, y: H / 2 + (Math.random() - .5) * 200,
    vx: 0, vy: 0,
    ch: rand(KATA + BOX), size: 10 + Math.random() * 6,
    phase: Math.random() * Math.PI * 2,        // position in formation
    lag: .035 + Math.random() * .05,           // individuality
    mutAt: Math.random() * 3000,
    hot: 0                                      // 0..1, magenta excitement
  });

  // ---- pointer --------------------------------------------------------
  const mouse = { x: W / 2, y: H / 2, px: W / 2, py: H / 2, vx: 0, vy: 0, lastMove: -9999, seen: false };
  let now = 0;
  function point(x, y){
    mouse.px = mouse.x; mouse.py = mouse.y;
    mouse.x = x; mouse.y = y;
    mouse.lastMove = now; mouse.seen = true;
  }
  addEventListener('pointermove', e => point(e.clientX, e.clientY));
  addEventListener('touchmove', e => { const t = e.touches[0]; point(t.clientX, t.clientY); }, { passive: true });

  // ---- brain ----------------------------------------------------------
  // states: wander | idle(formation) | follow | attend | startle | escort
  let state = 'waking', stateUntil = 0, clicks = 0;
  let formation = config.formation || null;
  let escortEl = null;
  let digestRect = null, glyphTargets = [], glyphLockUntil = 0;
  const head = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2, wanderAt: 0 };
  const stateListeners = new Set();

  const LABELS = {
    wander:  'wandering . . .',
    idle:    'loitering',
    follow:  'following you',
    attend:  'attending',
    escort:  'escorting',
    startle: '!!!',
    digest:  'studying…'
  };
  // long-idle small talk — proof somebody lives here
  const BORED = [
    'counting moths', 'rearranging glyphs', 'humming quietly',
    'watching casper', 'reading the signs again', 'practicing kanji'
  ];
  let boredNext = 0;

  function notify(label, hot){
    for (const fn of stateListeners) fn(label, hot);
  }

  function setState(s){
    if (state === s) return;
    state = s;
    boredNext = now + 20000;
    notify(s === 'startle' && clicks >= 5 ? 'dizzy ﾟ◦°' : LABELS[s], s === 'startle');
  }

  addEventListener('pointerdown', e => {
    point(e.clientX, e.clientY);
    clicks++;
    setState('startle');
    stateUntil = now + 700;
    dispatchEvent(new CustomEvent('curator:startle', { detail: { x: e.clientX, y: e.clientY } }));
    for (const p of entity){
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = 14 * Math.exp(-d / 160);
      p.vx += (dx / d) * f + (Math.random() - .5) * 4;
      p.vy += (dy / d) * f + (Math.random() - .5) * 4;
      p.hot = 1;
      p.ch = rand(BOX);
    }
  });

  function think(){
    if (state === 'dissolve' || state === 'digest') return;
    if (formation === 'glyph' && now < glyphLockUntil) return;
    if (state === 'startle' && now < stateUntil) return;

    if (escortEl){
      setState('escort');
      const r = escortEl.getBoundingClientRect();
      head.tx = r.left + r.width / 2;
      head.ty = r.top + r.height / 2;
    } else {
      const idleFor = now - mouse.lastMove;
      const speed = Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);

      if (!mouse.seen || idleFor > 6000){
        if (idleFor > 26000 && now > boredNext){
          notify(rand(BORED), false);
          boredNext = now + 9000 + Math.random() * 7000;
        }
        if (formation){
          setState('idle');           // rest in the page's formation
        } else {
          setState('wander');
          if (now > head.wanderAt){
            head.tx = 60 + Math.random() * (W - 120);
            head.ty = 60 + Math.random() * (H - 120);
            head.wanderAt = now + 2500 + Math.random() * 2500;
          }
        }
      } else if (idleFor > 1400 && speed < .5){
        setState('attend');
        head.tx = mouse.x; head.ty = mouse.y;
      } else {
        setState('follow');
        head.tx = mouse.x; head.ty = mouse.y;
      }
    }
    // the head trails its target lazily — the entity has weight
    head.x += (head.tx - head.x) * .045;
    head.y += (head.ty - head.y) * .045;
  }

  // ---- formation targets ----------------------------------------------
  function lineY(){ return (config.lineY ? config.lineY() : H * .82); }

  function targetFor(p, i, t){
    if (state === 'dissolve'){
      return [p.sx, p.sy];                       // swarm the viewport (C7)
    }
    if (state === 'digest' && digestRect){
      const dr = digestRect;
      const ox = (Math.sin(p.phase * 1.3 + t * .0008) * .45 + .5);
      const oy = (Math.cos(p.phase * 1.7 + t * .0011) * .45 + .5);
      return [dr.left + ox * dr.width, dr.top + oy * dr.height];
    }
    if (state === 'idle' && formation === 'glyph' && glyphTargets.length){
      const gt = glyphTargets[i % glyphTargets.length];
      const scale = Math.min(W, H) * .55;
      return [W / 2 + (gt.x - .5) * scale,
              H / 2 + (gt.y - .5) * scale];
    }
    if (state === 'idle' && formation === 'scatter'){
      // a field of glyphs strewn across the whole scene, each drifting gently
      // (stable per-particle position from index + phase, golden-ratio spread)
      const fx = (i * 0.61803398875 + p.phase * 0.37) % 1;
      const fy = (i * 0.41421356237 + p.phase * 0.61) % 1;
      return [W * (0.05 + fx * 0.90) + 12 * Math.sin(t * .00035 + p.phase * 6.28),
              H * (0.10 + fy * 0.80) + 10 * Math.cos(t * .00045 + p.phase * 6.28)];
    }
    if (state === 'idle' && formation === 'line'){
      // rest as a loose double row along the street, breathing slightly
      const n = entity.length;
      const x = W * .08 + (i / (n - 1)) * W * .84;
      const row = i % 2 ? 10 : -6;
      return [x + 8 * Math.sin(t * .0005 + p.phase),
              lineY() + row + 5 * Math.sin(t * .0011 + p.phase)];
    }
    if (state === 'idle' && formation === 'wave'){
      // slow ノシ undulation across the lower third
      const n = entity.length;
      const x = W * .15 + (i / (n - 1)) * W * .7;
      return [x, H * .6 + 36 * Math.sin(t * .0009 + (i / n) * Math.PI * 3)];
    }
    if (state === 'attend' || state === 'escort'){
      // slow halo; two rings (escort hugs a touch tighter)
      const tight = state === 'escort' ? .8 : 1;
      const ring = (i % 2 ? 56 : 92) * tight;
      const a = p.phase + t * (i % 2 ? .00045 : -.0003);
      const breathe = 6 * Math.sin(t * .0016 + p.phase);
      return [head.x + Math.cos(a) * (ring + breathe),
              head.y + Math.sin(a) * (ring + breathe)];
    }
    // comet / school-of-fish cloud behind the head
    const spread = state === 'wander' ? 120 : 70;
    const a = p.phase + t * .0006;
    const r = (i % 5 + 1) / 5 * spread;
    const trail = state === 'follow' ? Math.min(60, Math.hypot(mouse.vx, mouse.vy) * 6) : 0;
    return [head.x + Math.cos(a) * r - mouse.vx * trail * (i % 7) / 7,
            head.y + Math.sin(a) * r * .8 - mouse.vy * trail * (i % 7) / 7];
  }

  // ---- render -----------------------------------------------------------
  let ambientCount = ambient.length;
  let shadows = config.shadows !== false;
  // adaptive quality: the per-particle shadowBlur glow is the heaviest per-frame
  // op. On low-power devices (few cores / little RAM) skip it from the start so
  // the scene stays responsive; capable devices keep the full glow unchanged.
  // Missing APIs (Safari/FF have no deviceMemory) fall back to "capable" (|| 8),
  // so we never dim the glow on an unknown device.
  if ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4){
    shadows = false;
  }
  addEventListener('zgw:degrade', () => {        // C2 kill switch
    ambientCount = Math.ceil(ambient.length / 2);
    shadows = false;
  });

  function draw(t, dt){
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // ambient field — quiet weather
    for (let i = 0; i < ambientCount; i++){
      const p = ambient[i];
      if (!reduced){ p.x += p.dx * dt * .06; p.y += p.dy * dt * .06; }
      if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
      if (t > p.mutAt){ p.ch = rand(SOFT + KATA); p.mutAt = t + 3000 + Math.random() * 8000; }
      ctx.font = p.size + 'px ' + FONT;
      ctx.fillStyle = `rgba(${DIM[0]},${DIM[1]},${DIM[2]},${p.a})`;
      ctx.fillText(p.ch, p.x, p.y);
    }

    // the entity
    if (shadows) ctx.shadowBlur = 8;
    for (let i = 0; i < entity.length; i++){
      const p = entity[i];
      const [tx, ty] = targetFor(p, i, t);
      if (!reduced){
        p.vx += (tx - p.x) * p.lag; p.vy += (ty - p.y) * p.lag;
        p.vx *= .86; p.vy *= .86;
        p.x += p.vx * dt * .06; p.y += p.vy * dt * .06;
      } else { p.x = tx; p.y = ty; }

      if (t > p.mutAt){ p.ch = rand(KATA + BOX); p.mutAt = t + 800 + Math.random() * 2600; }
      p.hot *= .94;

      const d = Math.hypot(p.x - head.x, p.y - head.y);
      const glow = state === 'dissolve' ? .9 : Math.max(.25, 1 - d / 240);
      const r = NEON[0] + p.hot * (HOT[0] - NEON[0]),
            g = NEON[1] + p.hot * (HOT[1] - NEON[1]),
            b = NEON[2] + p.hot * (HOT[2] - NEON[2]);
      ctx.font = p.size + 'px ' + FONT;
      if (shadows) ctx.shadowColor = `rgba(${r|0},${g|0},${b|0},.8)`;
      ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${(.35 + glow * .6).toFixed(2)})`;
      ctx.fillText(p.ch, p.x, p.y);
    }
    ctx.shadowBlur = 0;
  }

  const FONT = '"MS Gothic","Noto Sans Mono CJK JP",monospace';

  function renderStatic(){
    // prefers-reduced-motion: one composed frame (A8)
    state = formation ? 'idle' : 'wander';
    head.x = W / 2; head.y = H / 2;
    draw(1200, 16);
  }

  resize();
  addEventListener('resize', resize);

  let unsubscribe = null;
  if (reduced){
    renderStatic();
  } else {
    unsubscribe = subscribe((t, dt) => {
      now = t;
      mouse.vx = (mouse.x - mouse.px) / Math.max(dt, 1);
      mouse.vy = (mouse.y - mouse.py) / Math.max(dt, 1);
      mouse.px = mouse.x; mouse.py = mouse.y;
      think();
      draw(t, dt);
    });
  }

  return {
    escort(el){ escortEl = el; },
    release(){ escortEl = null; },
    setFormation(name){ formation = name; },
    onState(fn){ stateListeners.add(fn); fn(LABELS.wander, false); },
    /* C7 transition API */
    dissolve(){
      escortEl = null;
      for (const p of entity){
        p.sx = Math.random() * W; p.sy = Math.random() * H;
        const d = Math.hypot(p.sx - p.x, p.sy - p.y) || 1;
        p.vx += (p.sx - p.x) / d * 6;            // outward kick
        p.vy += (p.sy - p.y) / d * 6;
      }
      state = 'dissolve';
      notify('dissolving', false);
    },
    reform(){
      for (const p of entity){
        p.x = Math.random() * W; p.y = Math.random() * H;
        p.vx = p.vy = 0;
      }
      mouse.seen = false; mouse.lastMove = -9999;  // settle into formation
      state = 'waking';
      think();
    },
    /* curator witnesses a DOM element — particles swarm inside its rect ~1.2s */
    digest(el){
      if (!el) return;
      digestRect = el.getBoundingClientRect();
      state = 'digest';
      notify(LABELS.digest, false);
      setTimeout(() => {
        if (state === 'digest'){
          digestRect = null;
          state = 'wander';
          notify(LABELS.wander, false);
        }
      }, 1200);
    },
    /* form the entity into a glyph shape — '?' or '!' */
    glyphShape(char){
      const SIZE = 180;
      const oc = Object.assign(document.createElement('canvas'), {width: SIZE, height: SIZE});
      const ox = oc.getContext('2d');
      ox.fillStyle = '#fff';
      ox.fillRect(0, 0, SIZE, SIZE);
      ox.fillStyle = '#000';
      ox.font = `bold ${Math.round(SIZE * .72)}px ${FONT}`;
      ox.textAlign = 'center';
      ox.textBaseline = 'middle';
      ox.fillText(char, SIZE / 2, SIZE / 2);
      const d = ox.getImageData(0, 0, SIZE, SIZE).data;
      const pts = [];
      for (let y = 0; y < SIZE; y += 2){
        for (let x = 0; x < SIZE; x += 2){
          if (d[(y * SIZE + x) * 4] < 100) pts.push({x: x / SIZE, y: y / SIZE});
        }
      }
      if (pts.length > 130){
        const step = pts.length / 130;
        glyphTargets = [];
        for (let k = 0; k < 130; k++) glyphTargets.push(pts[Math.floor(k * step)]);
      } else {
        glyphTargets = pts.length ? pts : [{x: .5, y: .5}];
      }
      formation = 'glyph';
      state = 'idle';
      glyphLockUntil = now + (char === '?' ? 950 : 2000);
      if (char === '!') for (const p of entity) p.hot = 1;
      notify(char === '?' ? 'oh.' : 'OH!', char === '!');
    },
    destroy(){ unsubscribe && unsubscribe(); }
  };
}
