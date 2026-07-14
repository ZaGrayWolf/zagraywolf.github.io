/* transition.js — fake-SPA continuity (C7), the ramen-shop feel in 2D.
   Leaving: the clicked sign flares, the curator dissolves into a viewport
   swarm, a night veil sweeps in (~0.5s) → navigate. Arriving: the veil is
   already up, the curator reforms into the page's formation as it lifts.
   Total perceived transition < 1s. Reduced motion: native instant nav. */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* field-notes photos that flash by as you move between chapters (Marvel-intro
   feel). A small fixed set of the optimized panels — never a content wall. */
const FLASH_PHOTOS = [
  'p-2024-09-20-01', 'p-2024-09-25-02', 'p-2024-11-08-04', 'p-2024-11-18-05',
  'p-2024-11-21-06', 'p-2024-11-26-08', 'p-2024-12-28-09', 'p-2025-02-25-10',
  'p-2025-03-01-11', 'p-2025-03-16-13', 'p-2025-03-17-14', 'p-2025-04-25-17',
  'p-2025-06-21-18', 'p-2025-06-22-19', 'p-2025-06-27-23', 'p-2025-06-28-24',
  'p-2025-07-19-25', 'p-2025-12-19-26', 'p-2026-03-14-27', 'p-2026-04-13-29',
  'p-2026-05-22-31', 'p-2026-05-23-33'
].map(n => `assets/img/panels/${n}.jpg`);

function makeVeil(on){
  const v = document.createElement('div');
  v.className = 'transition-veil' + (on ? ' is-on' : '');
  v.setAttribute('aria-hidden', 'true');
  document.body.appendChild(v);
  return v;
}

/* glyph-swarm portal — the ceremony for MINIMAP (fast-travel) nav. ~36 ASCII
   glyphs flick across the veil and scatter for ~0.5s; self-removing. The map is
   the curator's domain, so it gets glyphs (vs. the photo flash on content
   links). Same glyph DNA as the morphing panel borders. */
const SWARM_GLYPHS = '─│┌┐└┘├┤╱╲═║アカサタナハマヤラ◆◇★☆◉◎◊·•°'.split('');
function glyphSwarm(){
  const field = document.createElement('div');
  field.className = 'glyph-swarm';
  field.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 36; i++){
    const g = document.createElement('span');
    g.textContent = SWARM_GLYPHS[(i * 13 + 5) % SWARM_GLYPHS.length];
    g.style.left = ((i * 61 + 7) % 100) + '%';
    g.style.top  = ((i * 37 + 11) % 100) + '%';
    g.style.setProperty('--dx', (((i * 53) % 80) - 40) + 'px');
    g.style.setProperty('--dy', (((i * 29) % 80) - 40) + 'px');
    g.style.animationDelay = (i * 6) + 'ms';
    field.appendChild(g);
  }
  document.body.appendChild(field);
  setTimeout(() => field.remove(), 700);          // safety net past the 0.5s anim
}

/* fire 3 quick photo flashes layered above the veil; each fades through on its
   own animation, total ~600ms — they're decorative and self-removing. */
function flashPhotos(){
  const pool = [...FLASH_PHOTOS];
  for (let i = pool.length - 1; i > 0; i--){      // Fisher–Yates — genuinely random each time
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  pool.slice(0, 2).forEach((src, k) => {           // ~1.5 panels: two, quick + overlapping
    const img = document.createElement('img');
    img.className = 'transition-flash';
    img.src = src;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.style.animationDelay = (k * 70) + 'ms';
    img.addEventListener('animationend', () => img.remove(), { once: true });
    document.body.appendChild(img);
    setTimeout(() => img.remove(), 600);          // safety net
  });
}

export function initTransitions(curator){
  // ---- arrival ----------------------------------------------------------
  let arrived = false;
  try {
    arrived = sessionStorage.getItem('zgw.transition') === '1';
    sessionStorage.removeItem('zgw.transition');
  } catch {}
  if (arrived && !reduced){
    const veil = makeVeil(true);
    curator?.reform();
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('is-on')));
    veil.addEventListener('transitionend', () => veil.remove(), { once: true });
    setTimeout(() => veil.remove(), 1200);       // safety net
  }

  // ---- departure ----------------------------------------------------------
  let leaving = false;
  document.addEventListener('click', e => {
    if (reduced || leaving) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname) return;   // same-page anchors
    e.preventDefault();
    leaving = true;
    try { dispatchEvent(new CustomEvent('zgw:track', { detail: { event: 'nav', props: { to: url.pathname, via: a.closest('.hud-map') ? 'minimap' : 'link' } } })); } catch {}
    try { sessionStorage.setItem('zgw.transition', '1'); } catch {}
    a.classList.add('is-leaving');
    curator?.dissolve();
    const veil = makeVeil(false);
    requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.add('is-on')));
    // every departure flashes the field-notes photos (Marvel-intro beat);
    // minimap (fast-travel) departures ALSO get the glyph-swarm portal on top
    flashPhotos();
    if (a.closest('.hud-map')) glyphSwarm();
    setTimeout(() => { location.href = url.href; }, 460);   // snappier — ~1.5 quick flashes
  });

  // restored from bfcache with the veil baked in? clean up
  addEventListener('pageshow', e => {
    if (e.persisted){
      leaving = false;
      document.querySelectorAll('.transition-veil').forEach(v => v.remove());
    }
  });
}
