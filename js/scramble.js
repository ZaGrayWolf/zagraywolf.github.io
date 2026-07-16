/* scramble.js — text decodes out of glyph noise (the monospace signature
   move). A frontier sweeps left→right: resolved chars are final, the next
   few churn through random glyphs. Accessible names are protected by
   aria-label on the element (set here if absent). Reduced-motion: instant. */

import { subscribe } from './ticker.js?v=4.62';

const NOISE = 'アカサタナハマヤラ░▒▓┌┐└┘╱╲╳<>+*';
const rand = () => NOISE[(Math.random() * NOISE.length) | 0];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const running = new WeakMap();   // el → unsubscribe (restart-safe)

export function scramble(el, duration = 600){
  const target = el.dataset.text ?? (el.dataset.text = el.textContent);
  if (!el.closest('[aria-label]') && !el.getAttribute('aria-hidden')){
    el.setAttribute('aria-label', target);
  }
  if (reduced){ el.textContent = target; return; }

  running.get(el)?.();
  const t0 = performance.now();
  let lastStep = 0;

  const stop = subscribe(t => {
    if (t - lastStep < 50) return;             // ~20fps churn is plenty
    lastStep = t;
    // clamp low too: the first rAF timestamp can precede the t0 captured
    // mid-frame, and a negative k turns slice(0, frontier) destructive
    const k = Math.max(0, Math.min(1, (t - t0) / duration));
    const frontier = Math.floor(k * target.length);
    let out = target.slice(0, frontier);
    for (let i = frontier; i < target.length; i++){
      out += target[i] === ' ' ? ' ' : (i - frontier < 3 ? rand() : target[i]);
    }
    el.textContent = out;
    if (k >= 1){ el.textContent = target; stop(); running.delete(el); }
  });
  running.set(el, stop);
}

/* decode on hover/focus — wired by page modules */
export function scrambleOnApproach(container, selector){
  for (const host of container.querySelectorAll(selector)){
    const el = host.querySelector('[data-scramble]') || host;
    host.addEventListener('mouseenter', () => scramble(el, 400));
    host.addEventListener('focus', () => scramble(el, 400));
  }
}
