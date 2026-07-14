/* ticker.js — the one shared requestAnimationFrame loop (C2).
   Subscribers receive (t, dt). Pauses when the tab is hidden.
   Auto-degrade: if frame-time p95 > 28ms for 3 consecutive seconds,
   sets perf.degraded and dispatches "zgw:degrade" once — subscribers
   halve ambient counts / kill shadowBlur. */

const subscribers = new Set();
let rafId = 0;
let last = 0;

export const perf = { degraded: false };

const SAMPLE_MAX = 120;            // ~2s of frames
const samples = [];
let badSince = 0;

function p95(arr){
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, (s.length * 0.95) | 0)];
}

function checkBudget(t, dt){
  if (perf.degraded) return;
  samples.push(dt);
  if (samples.length > SAMPLE_MAX) samples.shift();
  if (samples.length < 60) return;
  if (p95(samples) > 28){
    if (!badSince) badSince = t;
    if (t - badSince > 3000){
      perf.degraded = true;
      dispatchEvent(new CustomEvent('zgw:degrade'));
    }
  } else {
    badSince = 0;
  }
}

function frame(t){
  rafId = requestAnimationFrame(frame);
  const raw = t - last || 16;
  last = t;
  checkBudget(t, raw);                 // raw dt judges the budget
  const dt = Math.min(32, raw);        // clamped dt drives simulation
  for (const fn of subscribers) fn(t, dt);
}

function start(){
  if (rafId || !subscribers.size) return;
  last = performance.now();
  rafId = requestAnimationFrame(frame);
}

function stop(){
  cancelAnimationFrame(rafId);
  rafId = 0;
}

export function subscribe(fn){
  subscribers.add(fn);
  start();
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size) stop();
  };
}

document.addEventListener('visibilitychange', () => {
  document.hidden ? stop() : start();
});
