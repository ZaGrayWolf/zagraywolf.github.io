/* game.js — NEKO CATCHER v1.1 (C8). Lazy-loaded on `nekocatcher:boot`.
   CRT overlay at --z-game; 320×240 logical canvas, integer-scaled; the page
   underneath is untouched — closing restores exactly where you were.

   Casper catches falling things at the bottom of the alley:
     GPU +1 · book +2 · ramen +3   (GOOD — cyan halo, catch them)
     bug   −1 life                 (BAD  — magenta halo + "!", dodge it)
   A READY screen teaches the rules first; catches pop, bugs flash + shake,
   consecutive good catches build a streak bonus. Sound: synth blips, only if
   localStorage zgw.sound === "on" (default off; toggle in the title bar).
   Colours are read from the design tokens (css/tokens.css) at boot. */

import { drawPixelMap, SIT_A, WALK_A, WALK_B, STARTLE } from './cat.js?v=4.46';

const LW = 320, LH = 240;            // logical size
const CAT_W = 32, CAT_Y = LH - 38;
const CATCH_Y = CAT_Y + 12;          // the line where Casper catches

/* ---- palette: read the canonical token hexes once (fallbacks if absent) ---- */
function readPalette(){
  const cs = getComputedStyle(document.documentElement);
  const tok = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
  return {
    bg:    tok('--bg',        '#07070c'),
    dim:   tok('--dim',       '#2a3142'),
    label: tok('--label',     '#8a93a8'),
    cyan:  tok('--neon-cyan', '#7df9ff'),
    mag:   tok('--neon-mag',  '#ff3da6'),
    amber: tok('--amber',     '#ffb347'),
    paper: tok('--paper',     '#f6f4ef'),
  };
}

/* 8×8 item maps (drawn ×2 → 16px). Legend per map. */
const ITEM_PX = {
  o: '#f6f4ef', n: '#2a3142', f: '#8a93a8', e: '#11111f',
  b: '#ffb347', r: '#f6f4ef', s: '#ff3da6', k: '#11111f', w: '#ffb347',
  g: '#1a3a1a'  // GPU PCB green
};
const GPU = [       // graphics card +1
  'gggggggg', 'gkkkkkkg', 'gkffffkg', 'gk.ff.kg',
  'gkffffkg', 'gkkkkkkg', 'bbbbbbbb', '........'
];
const BOOK = [      // closed book +2
  'kkkkkkkk', 'kooooooo', 'kooooooo', 'koonoooo',
  'kooooooo', 'koonoooo', 'kooooooo', 'kkkkkkkk'
];
const RAMEN = [     // bowl with steam +3 (stall tie-in)
  '.s..s...', '..s..s..', 'wwwwwwww', 'brrrrrrb',
  '.bbbbbb.', '.bbbbbb.', '..bbbb..', '........'
];
const BUG = [       // software bug −1 life (clearly red/magenta)
  '..s..s..', '.skkkks.', 'skssssks', 'kss..ssk',
  'skssssks', '.skkkks.', '..k..k..', '........'
];
const ITEMS = [
  { map: GPU,   pts: 1, weight: .36, bad: false },
  { map: BOOK,  pts: 2, weight: .28, bad: false },
  { map: RAMEN, pts: 3, weight: .16, bad: false },
  { map: BUG,   pts: 0, weight: .20, bad: true  }
];
function pickItem(){
  let r = Math.random();
  for (const it of ITEMS){ if ((r -= it.weight) <= 0) return it; }
  return ITEMS[0];
}

/* ---- synth blips — silent unless zgw.sound === "on" -------------------- */
let actx = null;
function blip(freq, dur = .07, type = 'square'){
  try {
    if (localStorage.getItem('zgw.sound') !== 'on') return;
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(.04, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch { /* audio unavailable — game stays silent */ }
}

let open = false;

export function bootGame(){
  if (open) return;
  open = true;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = readPalette();
  const prevFocus = document.activeElement;

  // ---- CRT window ------------------------------------------------------
  const crt = document.createElement('div');
  crt.className = 'crt';
  crt.setAttribute('role', 'dialog');
  crt.setAttribute('aria-modal', 'true');
  crt.setAttribute('aria-label', 'NEKO CATCHER: help Casper catch GPUs, books and ramen for points; dodge the bugs. Arrow keys or drag to move, Escape to close.');
  const soundOn = localStorage.getItem('zgw.sound') === 'on';
  crt.innerHTML =
    '<div class="crt-window">' +
      '<div class="crt-bar"><span>NEKO CATCHER v1.1</span>' +
        '<button class="crt-sound" aria-pressed="' + soundOn + '" aria-label="Toggle sound">' +
          (soundOn ? '♪ on' : '♪ off') + '</button>' +
        '<button class="crt-close" aria-label="Close game">✕</button></div>' +
      '<div class="crt-screen"><canvas width="320" height="240"></canvas><div class="crt-scan" aria-hidden="true"></div></div>' +
      '<p class="crt-hint">←/→ or A/D or drag · Esc closes</p>' +
    '</div>';
  document.body.appendChild(crt);
  if (!reduced) crt.querySelector('.crt-screen').classList.add('crt-on');   // power-on flicker

  const soundBtn = crt.querySelector('.crt-sound');
  soundBtn.addEventListener('click', () => {
    const on = localStorage.getItem('zgw.sound') !== 'on';
    localStorage.setItem('zgw.sound', on ? 'on' : 'off');
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.textContent = on ? '♪ on' : '♪ off';
    if (on) blip(660);
  });

  const canvas = crt.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function scale(){
    const k = Math.max(1, Math.min(((innerWidth * .9) / LW) | 0, ((innerHeight * .72) / LH) | 0));
    // integer upscale on desktop; on small screens fit the viewport (fractional ok)
    let w = LW * k;
    const maxW = Math.min(innerWidth * 0.94, innerHeight * 0.78 * (LW / LH));
    if (w > maxW) w = maxW;
    canvas.style.width = Math.round(w) + 'px';
    canvas.style.height = Math.round(w * LH / LW) + 'px';
  }
  scale();
  addEventListener('resize', scale);

  // fixed starfield + skyline (decorative backdrop, deterministic)
  const stars = Array.from({ length: 26 }, (_, i) => ({
    x: (i * 53 + 11) % LW, y: (i * 29 + 7) % 150, p: (i * 0.7) % 6.28
  }));
  const sky = [];
  for (let x = -4, i = 0; x < LW; i++){
    const w = 16 + (i * 7) % 22, h = 18 + (i * 13) % 46;
    sky.push({ x, w, h }); x += w + 2;
  }

  // ---- state ------------------------------------------------------------
  let state = 'ready';                  // 'ready' | 'playing' | 'over'
  const cat = { x: LW / 2, facing: 1, moving: false };
  let items = [], parts = [], floats = [];
  let score = 0, lives = 3, streak = 0, best = 0;
  let spawnAt = 0, raf = 0, shakeT = 0, flashT = 0, catchBob = 0;
  const keys = new Set();
  let hi = +(localStorage.getItem('zgw.game.highscore') || 0);

  function startGame(){
    state = 'playing';
    try { dispatchEvent(new CustomEvent('zgw:track', { detail: { event: 'game_start' } })); } catch {}
    items = []; parts = []; floats = [];
    score = 0; lives = 3; streak = 0; best = 0;
    shakeT = 0; flashT = 0; catchBob = 0;
    spawnAt = performance.now() + 600;
  }

  // ---- input --------------------------------------------------------------
  const MOVE_KEYS = ['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'];
  function onKey(e){
    if (e.key === 'Escape'){ close(); return; }
    if (e.key === 'Tab' && e.type === 'keydown'){
      e.preventDefault();
      const btns = [soundBtn, crt.querySelector('.crt-close')];
      const at = btns.indexOf(document.activeElement);
      btns[e.shiftKey ? (at <= 0 ? btns.length - 1 : at - 1) : (at + 1) % btns.length].focus();
      return;
    }
    if (e.type === 'keydown'){
      if (state === 'ready' && !e.metaKey && !e.ctrlKey && !e.altKey){ startGame(); return; }
      if (state === 'over' && (e.key === 'Enter' || e.key === 'r' || e.key === 'R')){ startGame(); return; }
    }
    if (MOVE_KEYS.includes(e.key)){
      e.preventDefault();
      e.type === 'keydown' ? keys.add(e.key) : keys.delete(e.key);
    }
  }
  addEventListener('keydown', onKey, true);
  addEventListener('keyup', onKey, true);

  let dragging = false;
  canvas.addEventListener('pointerdown', e => {
    if (state !== 'playing'){ startGame(); return; }
    dragging = true; drag(e);
  });
  addEventListener('pointermove', drag);
  addEventListener('pointerup', () => { dragging = false; });
  function drag(e){
    if (!dragging || state !== 'playing') return;
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width * LW;
    cat.facing = nx > cat.x ? 1 : -1;
    cat.x = Math.max(CAT_W / 2, Math.min(LW - CAT_W / 2, nx));
    cat.moving = true;
  }

  crt.querySelector('.crt-close').addEventListener('click', close);
  crt.querySelector('.crt-close').focus();

  function close(){
    open = false;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true);
    removeEventListener('keyup', onKey, true);
    removeEventListener('pointermove', drag);
    removeEventListener('resize', scale);
    crt.remove();
    prevFocus?.focus?.();
  }

  // ---- effects helpers ----------------------------------------------------
  function burst(x, y, color){
    if (reduced) return;
    for (let i = 0; i < 9; i++){
      const a = (i / 9) * 6.28, sp = .6 + Math.random() * 1.4;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - .6, life: 1, color });
    }
  }
  function floatText(x, y, text, color){ floats.push({ x, y, text, color, life: 1 }); }

  function haloItem(o, t){
    const cx = o.x + 8, cy = o.y + 8;
    const col = o.it.bad ? C.mag : C.cyan;
    const pulse = o.it.bad ? (0.5 + 0.5 * Math.sin(t * .012)) : 1;
    ctx.save();
    ctx.globalAlpha = (o.it.bad ? .26 : .20) * pulse;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 6.28); ctx.fill();
    ctx.globalAlpha = (o.it.bad ? .16 : .12) * pulse;
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 6.28); ctx.fill();
    ctx.restore();
    drawPixelMap(ctx, o.it.map, o.x, o.y, 2, false, ITEM_PX);
    if (o.it.bad){                                  // danger "!" so it screams AVOID
      ctx.fillStyle = C.mag; ctx.textAlign = 'center';
      ctx.font = 'bold 11px "MS Gothic",monospace';
      ctx.fillText('!', cx, o.y - 3);
    }
  }

  function drawBackdrop(t){
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, LW, LH);
    for (const s of stars){                          // twinkling stars
      ctx.globalAlpha = reduced ? .5 : (.3 + .4 * (0.5 + 0.5 * Math.sin(t * .003 + s.p)));
      ctx.fillStyle = C.label; ctx.fillRect(s.x, s.y, 1, 1);
    }
    ctx.globalAlpha = 1;
    for (const b of sky){                            // faint skyline silhouette
      ctx.fillStyle = C.dim;
      ctx.fillRect(b.x, LH - 8 - b.h, b.w, b.h);
    }
    ctx.fillStyle = C.dim; ctx.fillRect(0, LH - 8, LW, 8);   // street
  }

  function drawCat(t){
    const bob = catchBob > 0 ? -3 : 0;
    const map = state === 'over' ? STARTLE
              : shakeT > 0 ? STARTLE
              : cat.moving ? (((t / 120) | 0) % 2 ? WALK_A : WALK_B)
              : SIT_A;
    drawPixelMap(ctx, map, cat.x - CAT_W / 2, CAT_Y + bob, 2, cat.facing < 0);
  }

  // legend chip used on the READY screen
  function legendChip(x, y, map, labelText, bad){
    ctx.save();
    ctx.globalAlpha = bad ? .24 : .18;
    ctx.fillStyle = bad ? C.mag : C.cyan;
    ctx.beginPath(); ctx.arc(x + 8, y + 8, 12, 0, 6.28); ctx.fill();
    ctx.restore();
    drawPixelMap(ctx, map, x, y, 2, false, ITEM_PX);
    ctx.fillStyle = bad ? C.mag : C.cyan;
    ctx.textAlign = 'center';
    ctx.font = '9px "MS Gothic",monospace';
    ctx.fillText(labelText, x + 8, y + 28);
  }

  // ---- loop ---------------------------------------------------------------
  function frame(t){
    raf = requestAnimationFrame(frame);
    const dt = Math.min(40, t - (frame.last || t)); frame.last = t;
    if (catchBob > 0) catchBob -= dt;

    if (state === 'playing'){
      const dir = (keys.has('ArrowRight') || keys.has('d') || keys.has('D') ? 1 : 0)
                - (keys.has('ArrowLeft') || keys.has('a') || keys.has('A') ? 1 : 0);
      if (dir){
        cat.x = Math.max(CAT_W / 2, Math.min(LW - CAT_W / 2, cat.x + dir * .18 * dt));
        cat.facing = dir; cat.moving = true;
      } else if (!dragging) cat.moving = false;

      if (t > spawnAt){
        spawnAt = t + Math.max(900 - score * 6, 360);
        items.push({ x: 12 + Math.random() * (LW - 40), y: -16, it: pickItem() });
      }

      const speed = (1.2 + score * .01) * dt / 16.6;
      for (const o of items) o.y += speed;
      items = items.filter(o => {
        if (o.y > LH) return true;
        const caught = o.y + 14 >= CATCH_Y && o.y <= CATCH_Y + 18 &&
                       o.x + 14 >= cat.x - CAT_W / 2 + 4 && o.x <= cat.x + CAT_W / 2 - 4;
        if (!caught) return true;
        if (o.it.bad){
          lives--; streak = 0;
          flashT = reduced ? 0 : 240; shakeT = reduced ? 0 : 260;
          burst(o.x + 8, CATCH_Y, C.mag); floatText(o.x, CATCH_Y - 6, '−♥', C.mag);
          blip(110, .16);
          if (lives <= 0){
            state = 'over';
            hi = Math.max(hi, score);
            localStorage.setItem('zgw.game.highscore', hi);
            try { dispatchEvent(new CustomEvent('zgw:track', { detail: { event: 'game_over', props: { score, hi } } })); } catch {}
            blip(82, .3);
          }
        } else {
          score += o.it.pts; streak++; catchBob = 160;
          burst(o.x + 8, CATCH_Y, C.cyan); floatText(o.x, CATCH_Y - 6, '+' + o.it.pts, C.cyan);
          blip(620 + o.it.pts * 120);
          if (streak > 0 && streak % 5 === 0){       // streak bonus
            score += 5; floatText(cat.x, CAT_Y - 16, 'STREAK +5', C.amber); blip(990, .12);
          }
        }
        return false;
      });
    }

    // update effects
    for (const p of parts){ p.x += p.vx * dt / 16.6; p.y += p.vy * dt / 16.6; p.vy += .08 * dt / 16.6; p.life -= dt / 520; }
    parts = parts.filter(p => p.life > 0);
    for (const f of floats){ f.y -= dt / 28; f.life -= dt / 800; }
    floats = floats.filter(f => f.life > 0);
    if (shakeT > 0) shakeT -= dt;
    if (flashT > 0) flashT -= dt;

    // ---- draw -------------------------------------------------------------
    ctx.save();
    if (shakeT > 0){ const m = shakeT / 260 * 3; ctx.translate((Math.random() - .5) * m, (Math.random() - .5) * m); }

    drawBackdrop(t);

    // catch-zone hint line at Casper's level
    ctx.globalAlpha = .35; ctx.strokeStyle = C.cyan; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, CATCH_Y + 9); ctx.lineTo(LW, CATCH_Y + 9); ctx.stroke();
    ctx.globalAlpha = 1;

    if (state !== 'ready') for (const o of items) haloItem(o, t);

    drawCat(t);

    // particles + floating text
    for (const p of parts){ ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2); }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.font = '10px "MS Gothic",monospace';
    for (const f of floats){ ctx.globalAlpha = Math.max(0, f.life); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;

    // HUD
    ctx.font = '10px "MS Gothic",monospace';
    ctx.fillStyle = C.label; ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + score, 8, 14);
    ctx.fillStyle = C.mag;
    ctx.fillText('♥'.repeat(Math.max(0, lives)) + '·'.repeat(3 - Math.max(0, lives)), 8, 28);
    if (state === 'playing' && streak >= 2){
      ctx.fillStyle = C.amber; ctx.fillText('x' + streak, 64, 28);
    }
    ctx.fillStyle = C.label; ctx.textAlign = 'right';
    ctx.fillText('HI ' + hi, LW - 8, 14);

    ctx.restore();

    // ---- overlays (drawn unshaken) ---------------------------------------
    if (flashT > 0){ ctx.globalAlpha = flashT / 240 * .35; ctx.fillStyle = C.mag; ctx.fillRect(0, 0, LW, LH); ctx.globalAlpha = 1; }

    if (state === 'ready') drawReady(t);
    if (state === 'over')  drawOver();
  }

  function drawReady(t){
    ctx.globalAlpha = .82; ctx.fillStyle = C.bg; ctx.fillRect(0, 24, LW, LH - 24); ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = C.amber; ctx.font = '18px "MS Gothic",monospace';
    ctx.fillText('NEKO CATCHER', LW / 2, 56);
    ctx.fillStyle = C.paper; ctx.font = '10px "MS Gothic",monospace';
    ctx.fillText('catch the good stuff · dodge the bugs', LW / 2, 78);

    // legend row: GPU +1 · BOOK +2 · RAMEN +3 · BUG AVOID
    const ly = 104;
    legendChip(40,  ly, GPU,   '+1',    false);
    legendChip(104, ly, BOOK,  '+2',    false);
    legendChip(168, ly, RAMEN, '+3',    false);
    legendChip(248, ly, BUG,   'AVOID', true);

    ctx.fillStyle = C.label; ctx.font = '10px "MS Gothic",monospace'; ctx.textAlign = 'center';
    ctx.fillText('move:  ← →   ·   A / D   ·   drag', LW / 2, 172);
    if (Math.floor(t / 500) % 2){
      ctx.fillStyle = C.cyan;
      ctx.fillText('press any key  ·  tap to start', LW / 2, 196);
    }
  }

  function drawOver(){
    ctx.globalAlpha = .55; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, LW, LH); ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = C.mag; ctx.font = '16px "MS Gothic",monospace';
    ctx.fillText('GAME OVER', LW / 2, LH / 2 - 14);
    ctx.fillStyle = C.cyan; ctx.font = '10px "MS Gothic",monospace';
    ctx.fillText('score ' + score + '  ·  hi ' + hi, LW / 2, LH / 2 + 6);
    ctx.fillStyle = C.label;
    ctx.fillText('[Enter] play again   ·   [Esc] back to the alley', LW / 2, LH / 2 + 26);
  }

  raf = requestAnimationFrame(frame);
}
