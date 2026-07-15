/* cat.js — Casper the white cat, v1 (C5). (Renamed from the plan's
   "Ookami" by owner request, 2026-06-11.)
   P1 placeholder sprite: 32×32 frames drawn programmatically onto a sheet
   canvas at boot (pixel maps below), used as background-image. Swap for
   assets/cat/sprite.png later without touching the FSM.
   FSM: idle → wander → chase (cursor < 260px & moving) → sit (10s idle)
        → groom (random from sit). Startled by curator:startle.
   Petting: click → ♡ floats, zgw.cat.pets++; every 7th dispatches
   nekocatcher:boot (no listener until P4 — by design). */

import { subscribe } from './ticker.js?v=4.54';

/* ---- placeholder sprite sheet --------------------------------------
   16×16 pixel maps scaled ×2 to 32×32. Legend:
   . transparent  W white fur  S shaded fur  P pink (ears/nose)
   A amber collar  E eye  T tail */
export const PX = {
  W: '#f6f4ef', S: '#c9c4b8', P: '#ff3da6', A: '#ffb347', E: '#11111f', T: '#e8e4da'
};

/* draw one 16×16 pixel map onto a 2d context (shared with game.js) */
export function drawPixelMap(ctx, map, ox, oy, scale = 1, mirror = false, palette = PX){
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++){
      const col = palette[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + (mirror ? 15 - x : x) * scale, oy + y * scale, scale, scale);
    }
  });
}

export const SIT_A = [
  '....S.S.........',  // wolf-ear tuft (the ZaGrayWolf gag — subtle)
  '....W.W.........',
  '...WPWPW........',
  '...WWWWW........',
  '...WEWEW........',
  '...WWPWW........',
  '....AAA.........',
  '...WWWWW........',
  '..WWWWWWW.......',
  '..WWWWWWW....T..',
  '..WWWWWWW...TT..',
  '..WWWWWWW..TT...',
  '..WWWWWWWTTT....',
  '..WWWWWWW.......',
  '..WS..SW........',
  '................'
];

const SIT_B = [
  '................',
  '....W.W.........',
  '...WPWPW........',
  '...WWWWW........',
  '...WEWEW........',
  '...WWPWW........',
  '....AAA.....T...',
  '...WWWWW....T...',
  '..WWWWWWW...T...',
  '..WWWWWWW..TT...',
  '..WWWWWWW..T....',
  '..WWWWWWWTT.....',
  '..WWWWWWW.......',
  '..WWWWWWW.......',
  '..WS..SW........',
  '................'
];

export const WALK_A = [
  '................',
  '............S.S.',  // wolf-ear tuft (walking)
  '............W.W.',
  '...........WPWPW',
  'T..........WWWWW',
  '.TT........WEWEW',
  '..TT.......WWPWW',
  '...TWWWWWWWWAAA.',
  '...WWWWWWWWWWW..',
  '...WWWWWWWWWWW..',
  '...WWWWWWWWWW...',
  '...WW......WW...',
  '...WW......WW...',
  '..SW........WS..',
  '................',
  '................'
];

export const WALK_B = [
  '................',
  '................',
  '............W.W.',
  '...........WPWPW',
  '.T.........WWWWW',
  '.TT........WEWEW',
  '.TT........WWPWW',
  '...TWWWWWWWWAAA.',
  '...WWWWWWWWWWW..',
  '...WWWWWWWWWWW..',
  '...WWWWWWWWWW...',
  '....WW....WW....',
  '...WW......WW...',
  '....WS....SW....',
  '................',
  '................'
];

const GROOM_A = [
  '................',
  '................',
  '................',
  '................',
  '....W.W.........',
  '...WPWPW........',
  '...WWWWW.....T..',
  '...WEWEW....TT..',
  '...WWPWW...TT...',
  '....AAA...TT....',
  '..WWWWWWWTT.....',
  '..WWWWWWWW......',
  '.WWWWWWWWW......',
  '..WS..SW........',
  '................',
  '................'
];

const GROOM_B = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....W.W.........',
  '...WPWPW.....T..',
  '...W-W-W....TT..',  // eyes closed
  '...WWPWW...TT...',
  '....AAA...TT....',
  '..WWWWWWWTT.....',
  '..WWWWWWWW......',
  '.WWWWWWWWW......',
  '..WS..SW........',
  '................',
  '................'
];

export const STARTLE = [
  '....W.W.........',
  '...WPWPW........',
  '...WWWWW........',
  '...WEWEW........',
  '...WWPWW........',
  '....AAA.........',
  '...WWWW.....T...',
  '..WWWWWW...TT...',
  '..WWWWWWW.TT....',
  '..WWWWWWWTT.....',
  '..WWWWWW........',
  '..W..W..W.......',
  '..W..W..W.......',
  '.S...S...S......',
  '................',
  '................'
];

/* sheet layout: [sitA, sitB, walkA, walkB, groomA, groomB, startle] facing
   right; row 2 is the same mirrored (facing left). */
const MAPS = [SIT_A, SIT_B, WALK_A, WALK_B, GROOM_A, GROOM_B, STARTLE];
const FRAME = 32, SCALE = 2;

function buildSheet(){
  const sheet = document.createElement('canvas');
  sheet.width = FRAME * MAPS.length;
  sheet.height = FRAME * 2;
  const c = sheet.getContext('2d');
  MAPS.forEach((map, m) => {
    map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++){
        const col = PX[row[x]];
        if (!col) continue;
        // facing right
        c.fillStyle = col;
        c.fillRect(m * FRAME + x * SCALE, y * SCALE, SCALE, SCALE);
        // facing left (mirrored) on row 2
        c.fillRect(m * FRAME + (15 - x) * SCALE, FRAME + y * SCALE, SCALE, SCALE);
      }
    });
  });
  return sheet.toDataURL();
}

const F = { sitA: 0, sitB: 1, walkA: 2, walkB: 3, groomA: 4, groomB: 5, startle: 6 };

export function createCat(){
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const el = document.createElement('div');
  el.className = 'cat';
  el.setAttribute('aria-hidden', 'true');     // decorative resident
  el.title = 'Casper';                        // his name tag, for the curious
  el.style.backgroundImage = `url(${buildSheet()})`;
  document.body.appendChild(el);

  // phones: raise Casper's ground line so he clears the bottom HUD band
  // (curator:// line + ♪ ambient toggle + clock) instead of wandering over it —
  // the crowded-corner collision. Desktop unchanged.
  const GROUND = matchMedia('(max-width:700px)').matches ? 90 : 48;

  const cat = {
    x: innerWidth * .7, y: innerHeight - GROUND,
    tx: 0, ty: 0,
    facing: 1,                                 // 1 right, -1 left
    state: 'sit', stateAt: 0, lastMoveAt: 0,
    frame: F.sitA, stepAt: 0
  };

  const mouse = { x: -1e4, y: -1e4, movedAt: -1e4 };
  addEventListener('pointermove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.movedAt = performance.now();
  });

  function setFrame(f){
    cat.frame = f;
    const row = cat.facing === 1 ? 0 : 1;
    el.style.backgroundPosition = `${-f * FRAME}px ${-row * FRAME}px`;
  }

  function place(){
    el.style.transform = `translate3d(${(cat.x - 16) | 0}px,${(cat.y - 16) | 0}px,0)`;
  }

  function floorY(){ return innerHeight - GROUND; }     // street level band (raised on phones)

  function pickWaypoint(){
    cat.tx = 40 + Math.random() * (innerWidth - 80);
    cat.ty = floorY() - Math.random() * 40;
  }

  function enter(s, now){
    cat.state = s; cat.stateAt = now;
    if (s === 'wander') pickWaypoint();
  }

  // ---- petting (C5) ---------------------------------------------------
  let pets = +(localStorage.getItem('zgw.cat.pets') || 0);
  el.addEventListener('click', () => {
    pets++;
    localStorage.setItem('zgw.cat.pets', pets);
    const h = document.createElement('span');
    h.className = 'cat-heart';
    h.textContent = '♡';
    h.style.left = (cat.x - 6) + 'px';
    h.style.top = (cat.y - 28) + 'px';
    h.addEventListener('animationend', () => h.remove());
    document.body.appendChild(h);
    if (pets % 7 === 0) dispatchEvent(new CustomEvent('nekocatcher:boot'));
  });

  // startled by the curator's startle (C5)
  addEventListener('curator:startle', e => {
    if (reduced) return;
    // a click on the cat itself is a pet, not a scare
    const d = Math.hypot(e.detail.x - cat.x, e.detail.y - cat.y);
    if (d < 40) return;
    enter('startle', performance.now());
    cat.facing = e.detail.x > cat.x ? -1 : 1;        // run away from it
    cat.tx = Math.max(20, Math.min(innerWidth - 20, cat.x + cat.facing * 200));
    cat.ty = cat.y;
  });

  // ---- FSM on the shared ticker (10fps sprite stepper) ----------------
  function tick(t, dt){
    // sprite stepper
    const animDt = cat.state === 'startle' || cat.state === 'chase' ? 70 : 100;
    const step = t - cat.stepAt > animDt;
    if (step) cat.stepAt = t;

    const cursorNear = Math.hypot(mouse.x - cat.x, mouse.y - cat.y) < 260;
    const cursorMoving = t - mouse.movedAt < 300;

    switch (cat.state){
      case 'sit':
        if (step) setFrame(Math.floor(t / 400) % 4 === 3 ? F.sitB : F.sitA); // tail flick
        if (cursorNear && cursorMoving) enter('chase', t);
        else if (t - cat.stateAt > 10000 && Math.random() < .3) enter('groom', t);
        else if (t - cat.stateAt > 6000 && Math.random() < .002 * dt) enter('wander', t);
        break;

      case 'groom':
        if (step) setFrame(Math.floor(t / 300) % 2 ? F.groomA : F.groomB);
        if (cursorNear && cursorMoving) enter('chase', t);
        else if (t - cat.stateAt > 4000) enter('sit', t);
        break;

      case 'wander':
      case 'chase':
      case 'startle': {
        if (cat.state === 'chase'){
          if (!cursorNear || !cursorMoving){ enter('sit', t); break; }
          cat.tx = mouse.x; cat.ty = Math.min(mouse.y, floorY());
        }
        const dx = cat.tx - cat.x, dy = cat.ty - cat.y;
        const d = Math.hypot(dx, dy);
        const speed = (cat.state === 'wander' ? .07 : .18) * dt;
        if (d < (cat.state === 'chase' ? 48 : 6)){
          if (cat.state !== 'chase') enter('sit', t);
          if (step) setFrame(F.sitA);
          break;
        }
        cat.facing = dx >= 0 ? 1 : -1;
        cat.x += dx / d * Math.min(speed, d);
        cat.y += dy / d * Math.min(speed, d);
        if (step) setFrame(cat.state === 'startle' ? F.startle
                          : (Math.floor(t / 140) % 2 ? F.walkA : F.walkB));
        if (cat.state === 'startle' && d < 8) enter('sit', t);
        place();
        break;
      }
    }
    if (cat.state === 'sit' || cat.state === 'groom') place();
  }

  place();
  setFrame(F.sitA);

  let unsubscribe = null;
  if (!reduced) unsubscribe = subscribe(tick);   // static sit pose otherwise

  addEventListener('resize', () => {
    cat.x = Math.min(cat.x, innerWidth - 20);
    cat.y = Math.min(cat.y, floorY());
    place();
  });

  return { destroy(){ unsubscribe && unsubscribe(); el.remove(); } };
}
