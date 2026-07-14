/* main.js — per-page boot (C1).
   Reads <body data-page>, inits shared residents, then the page module,
   then removes .preboot. Everything here is progressive enhancement:
   with JS disabled the page is already fully readable. */

import { PAGES } from './config.js?v=4.43';
import { createCurator } from './curator.js?v=4.43';
import { createCat } from './cat.js?v=4.43';
import { initHUD } from './hud.js?v=4.43';
import { initTransitions } from './transition.js?v=4.43';
import { initTimeOfDay } from './timeofday.js?v=4.43';
import { initNarrator } from './narrator.js?v=4.43';
import { initAnalytics } from './analytics.js?v=4.43';
import { initPalette } from './palette.js?v=4.43';
import { initResumePreview, resolveResumePdf } from './resume-preview.js?v=4.43';
import { initPrefetch } from './prefetch.js?v=4.43';

const page = document.body.dataset.page;

// manga-bg: ~6 decorative backdrop photos per chapter that sit near-invisible at
// ~.05 opacity. Their src is held in data-src so nothing downloads until here —
// and we only opt in on wider screens, NEVER on phones, where it would cost
// ~600KB of mobile data for something you can't see. Decorative (aria-hidden),
// so no-JS / phone simply gets the clean paper with no backdrop.
if (!matchMedia('(max-width:700px)').matches){
  for (const img of document.querySelectorAll('.manga-bg img[data-src]')) img.src = img.dataset.src;
}

// privacy-aware visit beacons (no-ops until the Apps Script endpoint is set,
// or if Do-Not-Track is on). Fire-and-forget; never blocks boot.
initAnalytics();

// the curator's command line — "/" or ⌘K opens a palette to jump anywhere.
// Global (every page), lazy DOM, suppressed while typing in a field.
initPalette();

// dwell on the RESUME hatch for 3s and a live peek of resume.html fades in.
initResumePreview();

// warm the pages a visitor is likely to open next (idle + on hover/touch) so
// cross-page navigation feels instant. Progressive, honors Save-Data.
initPrefetch();

// the dawn "leave a note" form (index only) — posts to the backend, or falls
// back to mailto when it's dormant. Only loads on pages that have the form.
if (document.getElementById('contact-form')){
  const { initContact } = await import('./contact.js?v=4.43');
  initContact();
}

// the night world (alley/stall/404) tints itself to the visitor's real clock;
// the paper chapters stay on their fixed daylight ink
if (!document.body.classList.contains('world-paper')) initTimeOfDay();

// the curator narrates the journey in the HUD state line (scroll-driven on
// pages with data-narrate landmarks; stall.js drives it per order). Runs early
// so the line exists before stall.js / alley.js want to write to it.
initNarrator();

/* ---- boot veil — curator://waking ▮ -----------------------------------
   Once per session, ~1.1s, any input skips it. Not awaited: the residents
   boot underneath while it plays. */
(function bootOverlay(){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    if (sessionStorage.getItem('zgw.booted')) return;
    sessionStorage.setItem('zgw.booted', '1');
  } catch { return; }

  const veil = document.createElement('div');
  veil.className = 'boot-veil';
  veil.setAttribute('aria-hidden', 'true');
  veil.innerHTML = '<div class="boot-box"><p><span class="boot-text"></span><span class="boot-cursor">▎</span></p><p class="boot-bar"></p></div>';
  document.body.appendChild(veil);

  const text = veil.querySelector('.boot-text');
  const bar = veil.querySelector('.boot-bar');
  const MSG = 'curator://waking';
  const BAR_N = 16;
  let i = 0, dead = false, timer = 0;

  function done(){
    if (dead) return;
    dead = true;
    clearTimeout(timer);
    veil.classList.add('is-done');
    veil.addEventListener('transitionend', () => veil.remove(), { once: true });
    setTimeout(() => veil.remove(), 600);          // transitionend safety net
    removeEventListener('pointerdown', done, true);
    removeEventListener('keydown', done, true);
  }

  function drawBar(k){
    const fill = Math.round(k * BAR_N);
    const lip = fill < BAR_N ? '▓' : '';           // soft leading edge
    bar.textContent = '[' + '█'.repeat(fill) + lip
      + '░'.repeat(Math.max(0, BAR_N - fill - lip.length)) + '] '
      + Math.round(k * 100) + '%';
  }

  function step(){
    i++;
    text.textContent = MSG.slice(0, i);
    drawBar(i / MSG.length);
    if (i < MSG.length){
      timer = setTimeout(step, 30 + Math.random() * 45);   // organic cadence
    } else {
      timer = setTimeout(() => {                            // confirmation beat
        text.textContent = 'curator://awake';
        bar.textContent = '[' + '█'.repeat(BAR_N) + '] ok';
        timer = setTimeout(done, 280);
      }, 160);
    }
  }
  drawBar(0);
  timer = setTimeout(step, 120);

  // content is never hostage — any input skips
  addEventListener('pointerdown', done, true);
  addEventListener('keydown', done, true);
})();

// visited-chapter trail (C3) — consumed by later phases
try {
  const visited = JSON.parse(sessionStorage.getItem('zgw.visited') || '[]');
  if (!visited.includes(page)) sessionStorage.setItem('zgw.visited', JSON.stringify([...visited, page]));
} catch { /* storage may be unavailable; purely decorative state */ }

// paper world: the curator follows you into the chapters as quiet ink
// (C4: ink palette, low density, no glow — zero neon on paper, A1/A8)
const PAPER_CURATOR = {
  formation: 'line', lineY: () => innerHeight * .9,
  density: .26,                                  // fewer glyphs — a light cursor-trail, not a cloud
  paletteNeon: '--ink-soft', paletteDim: '--ink-soft', paletteHot: '--ink',
  shadows: false
};

// the stall is the one non-paper chapter — the curator hangs warm in the steam
const STALL_CURATOR = {
  formation: 'line', lineY: () => innerHeight * .34, density: .5,
  paletteNeon: '--amber', paletteDim: '--amber', paletteHot: '--amber',
  shadows: false
};

const PAGE_CURATOR = {
  alley:    { formation: 'scatter', density: .8 },
  about:    { formation: 'scatter', density: .8 },
  notfound: { formation: null },
  work: PAPER_CURATOR, projects: PAPER_CURATOR, papers: PAPER_CURATOR,
  resume: PAPER_CURATOR, oneshot: PAPER_CURATOR, stall: STALL_CURATOR
};

let curator = null;
const canvas = document.getElementById('curator-canvas');
const isPhone = matchMedia('(max-width:700px)').matches;
// phones: on the paper READING chapters the curator is only faint ink that adds a
// per-frame canvas loop while you read — and it can't do its cursor-follow job on
// touch. Skip it there entirely (every consumer null-checks it: transition,
// dynamic-menu, the projects/papers hooks). It stays on the night-world hub +
// about and the stall scene, just calmer (reduced canvas opacity in CSS) and
// thinned (×0.45 density). Desktop is completely unchanged.
const PHONE_NO_CURATOR = new Set(['work', 'projects', 'papers', 'resume', 'oneshot']);
if (canvas && !(isPhone && PHONE_NO_CURATOR.has(page))){
  const cfg = { ...(PAGE_CURATOR[page] || {}) };
  if (isPhone && cfg.density) cfg.density *= 0.45;   // thin the cloud on phones
  curator = createCurator(canvas, cfg);
}

if (document.body.dataset.cat !== 'off') createCat();

// NEKO CATCHER (C8) — lazy: nothing loads until the 7th pet or the arcade
// cabinet asks for it
addEventListener('nekocatcher:boot', async () => {
  const { bootGame } = await import('./game.js?v=4.43');
  bootGame();
});
document.querySelector('.arcade')?.addEventListener('click', () => {
  dispatchEvent(new CustomEvent('nekocatcher:boot'));
});

initHUD();
initTransitions(curator);

// the HUD minimap becomes a curator conversation: hover escorts the swarm +
// narrates, visited chapters persist amber. Enhances the static map in place.
const { initDynamicMenu } = await import('./dynamic-menu.js?v=4.43');
initDynamicMenu(curator);

if (page === 'alley'){
  const { initAlley } = await import('./alley.js?v=4.43');
  initAlley(curator);
  // flows (the helix + glyph rivers) self-disables below 900px anyway — so on
  // phones don't even load/subscribe the module; it'd just be a no-op per frame.
  if (!isPhone){
    const { initFlows } = await import('./flows.js?v=4.43');
    initFlows();
  }
  // meteors: a subtle full-screen comet loop; skip on phones (battery + heat)
  if (!isPhone){
    const { initMeteors } = await import('./meteors.js?v=4.43');
    initMeteors();
  }
  // generative lo-fi lives only in the hub (off by default, one HUD toggle)
  const { initAmbient } = await import('./audio.js?v=4.43');
  initAmbient();
}

// the about page (CH.00) reuses the alley scene: parallax + cursor-reactive
// glyphs. No flows / ambient — those stay in the hub.
if (page === 'about'){
  const { initAbout } = await import('./about.js?v=4.43');
  initAbout(curator);
  if (!isPhone){
    const { initMeteors } = await import('./meteors.js?v=4.43');
    initMeteors();
  }
}

// WORK + PROJECTS: chapter panels render from data/*.json. Must finish BEFORE
// initPanels / glyphborder / curator-digest below, which query .panel at init.
if (page === 'work'){
  const { initWork } = await import('./work.js?v=4.43');
  await initWork();
}
if (page === 'projects'){
  const { initProjects } = await import('./projects.js?v=4.43');
  await initProjects();
}
if (page === 'papers'){
  const { initWins } = await import('./wins.js?v=4.43');
  await initWins();
}

if (document.querySelector('.chapter')){
  const { initPanels } = await import('./panels.js?v=4.43');
  initPanels();
}

// Casper pads in from the alley — continuity companion, paper chapters only
// (the alley has the real cat; the stall has the concierge)
if (document.body.classList.contains('world-paper')){
  const { initCompanion } = await import('./companion.js?v=4.43');
  initCompanion();
  const { initBackTop } = await import('./backtop.js?v=4.43');
  initBackTop();   // phone-only "↑ TOP" for the long chapters (self-gates)
}

if (page === 'stall'){
  const { initStall } = await import('./stall.js?v=4.43');
  initStall();
}

if (page === 'resume' && document.getElementById('converter')){
  const { initConverter } = await import('./converter.js?v=4.43');
  initConverter();
}

// résumé → PDF: the download CTA is a native <a download> to data/Resume.pdf
// (transition.js skips [download] links, so no veil). We only hook the click to
// fire the analytics beacon. Hover-peek of the same file lives in resume-preview.js.
if (page === 'resume'){
  const cta = document.getElementById('resume-print');
  if (cta){
    // point at whichever casing actually exists (falls back to the static href)
    resolveResumePdf().then(url => { cta.href = url; });
    cta.addEventListener('click', () => {
      try { dispatchEvent(new CustomEvent('zgw:track', { detail: { event: 'resume_pdf' } })); } catch {}
    });
  }
}

// PROJECTS: curator swarms inside panel when repo link is hovered or panel clicked
if (page === 'projects' && curator){
  document.querySelectorAll('.panel-links a').forEach(a => {
    a.addEventListener('mouseenter', () => {
      const panel = a.closest('.panel');
      if (panel) curator.digest(panel);
    });
  });
  document.querySelectorAll('.panel').forEach(panel => {
    panel.addEventListener('click', () => curator.digest(panel));
  });
}

// MANGA CHAPTERS: panel frames become morphing ASCII glyph rings (hover to
// freeze). Started on projects; now on every paper chapter (work/projects/
// papers/resume) — glyphborder targets `.chapter .panel` and self-gates on
// reduced-motion/touch, so it's safe wherever there are panels.
if (document.querySelector('.chapter .panel')){
  const { initGlyphBorders } = await import('./glyphborder.js?v=4.43');
  initGlyphBorders();
}

// WINS: bracket scrolls into view → glyph '?' hold 900ms → '!'
if (page === 'papers' && curator){
  const bracket = document.getElementById('wins-bracket');
  if (bracket){
    let fired = false;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !fired){
        fired = true;
        io.disconnect();
        curator.glyphShape('?');
        setTimeout(() => curator.glyphShape('!'), 900);
        setTimeout(() => curator.setFormation('line'), 3100);
      }
    }, { threshold: .3 });
    io.observe(bracket);
  }
}

document.body.classList.remove('preboot');

/* ---- for the ones who open the console --------------------------------- */
console.log(
  '%c /ᐠ｡ꞈ｡ᐟ\\   casper saw you open the console.\n' +
  ' curator://the source is hand-written. no framework, no build step.\n' +
  ' https://github.com/ZaGrayWolf',
  'font-family:monospace;color:#7df9ff;background:#07070c;padding:8px 12px;line-height:1.7'
);

/* ---- ? keyboard shortcut overlay --------------------------------------- */
{
  const CHAPTERS = PAGES.filter(p => p.chapter).map(p => p.href);
  const overlay = document.createElement('div');
  overlay.className = 'key-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Keyboard shortcuts');
  overlay.setAttribute('tabindex', '-1');
  overlay.hidden = true;
  overlay.innerHTML =
    '<p class="key-overlay-title">KEYS</p>' +
    '<ul>' +
    '<li><kbd>g</kbd> open github</li>' +
    '<li><kbd>p</kbd> play NEKO CATCHER</li>' +
    '<li><kbd>r</kbd> random chapter</li>' +
    '<li><kbd>?</kbd> this overlay</li>' +
    '<li><kbd>Esc</kbd> close</li>' +
    '</ul>';
  document.body.appendChild(overlay);

  let prevFocus = null;
  const openOverlay  = () => { if (overlay.hidden){ prevFocus = document.activeElement; overlay.hidden = false; overlay.focus(); } };
  const closeOverlay = () => { if (!overlay.hidden){ overlay.hidden = true; prevFocus?.focus?.(); } };

  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!overlay.hidden){ if (e.key === 'Escape') closeOverlay(); return; }
    if (e.key === '?'){ e.preventDefault(); openOverlay(); return; }
    if (e.key === 'g'){ open('https://github.com/ZaGrayWolf', '_blank', 'noopener'); return; }
    if (e.key === 'p'){ dispatchEvent(new CustomEvent('nekocatcher:boot')); return; }
    if (e.key === 'r'){ location.href = CHAPTERS[(Math.random() * CHAPTERS.length) | 0]; }
  });
}

/* ---- Konami code boots the arcade --------------------------------------- */
{
  const CODE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let pos = 0;
  addEventListener('keydown', e => {
    pos = e.key === CODE[pos] ? pos + 1 : (e.key === CODE[0] ? 1 : 0);
    if (pos === CODE.length){ pos = 0; dispatchEvent(new CustomEvent('nekocatcher:boot')); }
  });
}

/* ---- casper walks the tab title while you're away ------------------------ */
{
  const original = document.title;
  const frames = ['/ᐠ｡ꞈ｡ᐟ\\ · casper waits', '/ᐠ –ꞈ–ᐟ\\ zzz · ' + original];
  let walk = 0, i = 0;
  document.addEventListener('visibilitychange', () => {
    clearInterval(walk);
    if (document.hidden){
      walk = setInterval(() => { document.title = frames[i++ % frames.length]; }, 1500);
    } else {
      document.title = original;
    }
  });
}

/* ---- #debug: fps + degrade readout in the state line --------------------- */
if (location.hash === '#debug'){
  const { subscribe, perf } = await import('./ticker.js?v=4.43');
  const line = document.querySelector('.hud-state');
  if (line){
    const out = document.createElement('span');
    line.appendChild(out);
    let fps = 60, shown = 0;
    subscribe((t, dt) => {
      fps += (1000 / Math.max(dt, 1) - fps) * .05;
      if (t - shown > 500){
        shown = t;
        out.textContent = ` · ${fps | 0}fps${perf.degraded ? ' · degraded' : ''}`;
      }
    });
  }
}
