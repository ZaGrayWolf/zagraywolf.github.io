/* panels.js — chapter-page scroll choreography (P2, vanilla).
   Two layers, both progressive (no-JS keeps every panel visible & still):
   1. Reveal: panels assemble as they enter view — sliding in from their grid
      side (--rvx) and settling out of a slight scale, via IntersectionObserver.
   2. Parallax: as you scroll, panels drift at a depth-based rate and the faded
      manga backdrop drifts slower behind them, giving the page real depth.
      Driven by the independent `translate` property so it never clobbers the
      tilt/reveal `transform`. */

const PANEL_DEPTH = 0.045;   // px of counter-drift per px from viewport center
const BG_DEPTH    = 0.06;    // backdrop drifts slower → reads as further away

export function initPanels(){
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;   // stay visible & still

  const panels = [...document.querySelectorAll('.reveal')];

  const io = new IntersectionObserver(entries => {
    for (const entry of entries){
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('is-pending');
      io.unobserve(entry.target);
    }
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });

  for (const el of panels){
    // assemble direction: panels on the right half slide in from the right,
    // the left half from the left — the spread "comes together" as you arrive
    const r = el.getBoundingClientRect();
    const fromRight = (r.left + r.width / 2) > innerWidth / 2;
    el.style.setProperty('--rvx', (fromRight ? 28 : -28) + 'px');

    // above-the-fold panels never wait on the observer — no flash, no
    // invisible content if IO is late
    if (r.top < innerHeight * .92) continue;
    el.classList.add('is-pending');
    io.observe(el);
  }

  // phones: skip the scroll-drift (a getBoundingClientRect loop + translate on
  // every panel each scroll frame) for smoother scrolling on mid-range devices.
  // The reveal still plays; panels just sit still instead of parallaxing.
  if (!matchMedia('(max-width:700px)').matches) initParallax(panels);
}

function initParallax(panels){
  const bg = document.querySelector('.manga-bg');
  let ticking = false;

  function frame(){
    ticking = false;
    const mid = innerHeight / 2;
    for (const el of panels){
      const r = el.getBoundingClientRect();
      // distance of the panel's center from the viewport center, in px
      const dist = (r.top + r.height / 2) - mid;
      el.style.setProperty('--py', (-dist * PANEL_DEPTH).toFixed(1) + 'px');
    }
    if (bg) bg.style.translate = '0 ' + (scrollY * BG_DEPTH).toFixed(1) + 'px';
  }

  addEventListener('scroll', () => {
    if (!ticking){ ticking = true; requestAnimationFrame(frame); }
  }, { passive: true });
  addEventListener('resize', () => { if (!ticking){ ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  frame();
}
