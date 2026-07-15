/* alley.js — page module for `/` (A7).
   Pointer parallax over the layered scene, the one randomly-flickering
   sign, curator escort on sign hover/focus, and the dawn contact strip
   (bg lerp + signs switching off one by one). */

import { subscribe } from './ticker.js?v=4.54';
import { scramble, scrambleOnApproach } from './scramble.js?v=4.54';
import { holdNarration, forceNarrate } from './narrator.js?v=4.54';

/* current parallax offset at factor 1 (px) — flows.js reads this so canvas-
   drawn streams can track the signs layer as it drifts under the pointer */
export const parallax = { x: 0, y: 0 };

export function initAlley(curator){
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- visit counter (once per session) ---------------------------------
  try {
    if (!sessionStorage.getItem('zgw.counted')){
      const v = parseInt(localStorage.getItem('zgw.visits') || '0') + 1;
      localStorage.setItem('zgw.visits', String(v));
      sessionStorage.setItem('zgw.counted', '1');
    }
  } catch {}

  // ---- the name decodes out of the noise --------------------------------
  for (const span of document.querySelectorAll('.name-sign .name-en, .name-sign .name-tag')){
    scramble(span, 900);
  }
  scrambleOnApproach(document, '.layer-signs .sign');

  // ---- wayfinding: visited chapters rest ticked, the dying tube prefers
  // an unvisited sign (an invitation, not a malfunction) -------------------
  const signs = [...document.querySelectorAll('.layer-signs .sign')];
  let visited = [];
  try { visited = JSON.parse(sessionStorage.getItem('zgw.visited') || '[]'); } catch {}
  const isVisited = s => visited.includes(s.getAttribute('href').replace('.html', ''));
  for (const s of signs) if (isVisited(s)) s.classList.add('sign--visited');
  if (!reduced && signs.length){
    const pool = signs.filter(s => !isVisited(s));
    const pick = pool.length ? pool : signs;
    pick[(Math.random() * pick.length) | 0].classList.add('sign--flicker');
  }

  // ---- curator drifts toward whatever sign you consider -----------------
  if (curator){
    for (const sign of signs.concat([...document.querySelectorAll('.stall')])){
      sign.addEventListener('mouseenter', () => curator.escort(sign));
      sign.addEventListener('mouseleave', () => curator.release());
      sign.addEventListener('focus', () => curator.escort(sign));
      sign.addEventListener('blur', () => curator.release());
    }
  }

  // ---- pointer parallax (×factor from data-parallax) ---------------------
  const layers = [...document.querySelectorAll('[data-parallax]')].map(el => ({
    el, f: parseFloat(el.dataset.parallax)
  }));
  if (!reduced && matchMedia('(pointer: fine)').matches){
    const AMP = 26;                       // px at factor 1, screen edge
    let nx = 0, ny = 0, cx = 0, cy = 0;   // wanted / current, both -1..1
    addEventListener('pointermove', e => {
      nx = (e.clientX / innerWidth) * 2 - 1;
      ny = (e.clientY / innerHeight) * 2 - 1;
    });
    subscribe(() => {
      cx += (nx - cx) * .04;
      cy += (ny - cy) * .04;
      parallax.x = -cx * AMP;
      parallax.y = -cy * AMP * .5;
      if (Math.abs(nx - cx) + Math.abs(ny - cy) < .001) return;
      for (const { el, f } of layers){
        el.style.transform =
          `translate3d(${(parallax.x * f).toFixed(2)}px,${(parallax.y * f).toFixed(2)}px,0)`;
      }
    });
  }

  // ---- dawn: bg lerp on scroll -------------------------------------------
  const dawn = document.getElementById('contact');
  if (dawn){
    const onScroll = () => {
      const r = dawn.getBoundingClientRect();
      // 0 while the alley fills the screen → 1 once the strip is centered
      const mix = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * .9)));
      document.body.style.setProperty('--dawn-mix', mix.toFixed(3));
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // signs switch off one by one as they enter view; curator waves ノシ
    const dawnSigns = [...dawn.querySelectorAll('.dawn-sign')];
    // the whisper borrows the HUD line from the narrator, cycles its stats,
    // then hands it back (the narrator's next scroll reclaims it)
    function dawnWhisper(){
      const visits = parseInt(localStorage.getItem('zgw.visits') || '1');
      const pets   = parseInt(localStorage.getItem('zgw.cat.pets') || '0');
      const msgs   = [`[VISITS: ${visits}]`, `[PETS: ${pets}]`, '[HIRED: ?]', 'dawn breaks'];
      holdNarration(true);
      let i = 0;
      const tick = setInterval(() => {
        forceNarrate(msgs[i % msgs.length]);
        if (++i >= msgs.length){ clearInterval(tick); holdNarration(false); }
      }, 1400);
    }

    const io = new IntersectionObserver(entries => {
      for (const entry of entries){
        if (!entry.isIntersecting) continue;
        io.disconnect();
        scramble(dawn.querySelector('.dawn-title'), 700);
        dawnSigns.forEach((s, i) => {
          setTimeout(() => s.classList.add('is-off'), reduced ? 0 : 400 + i * 450);
        });
        if (!reduced) setTimeout(dawnWhisper, 1200);
      }
    }, { threshold: .4 });
    io.observe(dawn);

    if (curator){
      const ioWave = new IntersectionObserver(entries => {
        for (const entry of entries){
          curator.setFormation(entry.isIntersecting ? 'wave' : 'scatter');
        }
      }, { threshold: .5 });
      ioWave.observe(dawn);
    }
  }
}
