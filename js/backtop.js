/* backtop.js — a small "↑ TOP" affordance for the long paper chapters on phones.
   Injected on world-paper pages only; fades in after you scroll ~1.5 screens,
   taps scroll back to the top (instant under prefers-reduced-motion). Phone-only:
   gated by matchMedia here + a min-width hide in base.css, so desktop never sees
   it. Sits bottom-centre — clear of the curator:// line (bottom-left) and the
   companion cat (bottom-right). */
export function initBackTop(){
  if (!matchMedia('(max-width:700px)').matches) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'back-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.textContent = '↑ TOP';
  document.body.appendChild(btn);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  let shown = false;
  const onScroll = () => {
    const should = window.scrollY > innerHeight * 1.5;
    if (should !== shown){ shown = should; btn.classList.toggle('is-shown', should); }
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
