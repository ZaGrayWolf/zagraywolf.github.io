/* narrator.js — the curator narrates your journey in the HUD state line.
   Replaces a dumb progress bar with contextual narration: as you scroll, the
   line reads the data-narrate text of whichever landmark sits closest to the
   viewport centre — "curator://studying KLIV · the shrinking model". The line
   ships in the alley HTML; on the chapters/stall (which don't carry one) the
   narrator injects it. The stall isn't scroll-driven, so stall.js calls
   narrate() directly on each order; the minimap escort borrows the line on
   hover (escortNarrate) and hands it back on leave (endEscort). Progressive:
   JS-injected, so no-JS never sees it; it's text not motion, so reduced-motion
   still narrates (minus the flicker). */

let stateB = null;       // the <b> we write into
let held = false;        // the dawn whisper / minimap escort can borrow the line
let lastText = '';       // last ambient narration — restored when a borrow ends
let repick = null;       // re-run the scroll pick (set in initNarrator)

function ensureLine(){
  let line = document.querySelector('.hud-state');
  if (!line){
    line = document.createElement('p');
    line.className = 'hud-state';
    line.setAttribute('aria-live', 'off');     // decorative; not announced
    line.innerHTML = 'curator://<b></b>';
    document.body.appendChild(line);
  }
  stateB = line.querySelector('b') || line;
}

function flick(){
  stateB.classList.remove('is-narrate');
  void stateB.offsetWidth;                      // restart the flicker
  stateB.classList.add('is-narrate');
}

// the normal channel — scroll narration + stall orders. Respects holds.
export function narrate(text){
  if (!stateB || held) return;
  if (stateB.textContent === text) return;
  lastText = text;
  stateB.textContent = text;
  flick();
}

// the dawn whisper takes the line for its stat cycle, then gives it back
export function holdNarration(on){ held = !!on; }
export function forceNarrate(text){ if (stateB) stateB.textContent = text; }

// the minimap escort borrows the line on hover, restores on leave
export function escortNarrate(text){
  if (!stateB) return;
  held = true;
  if (stateB.textContent !== text){ stateB.textContent = text; flick(); }
}
export function endEscort(){
  held = false;
  if (repick) repick();              // scroll pages re-pick the centred landmark
  else if (stateB) stateB.textContent = lastText;   // stall etc.: restore last
}

export function initNarrator(){
  ensureLine();
  const anchors = [...document.querySelectorAll('[data-narrate]')];
  if (!anchors.length) return;                  // stall: stall.js drives it

  let ticking = false, lastFocus = '';
  function pick(){
    ticking = false;
    if (held) return;
    const mid = innerHeight / 2;
    let best = null, bestDist = Infinity;
    for (const el of anchors){
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;     // off-screen
      const d = Math.abs((r.top + r.height / 2) - mid);
      if (d < bestDist){ bestDist = d; best = el; }
    }
    if (best){
      narrate(best.dataset.narrate);             // none centred → hold last line
      if (best.dataset.narrate !== lastFocus){    // analytics: what they're reading
        lastFocus = best.dataset.narrate;
        try { dispatchEvent(new CustomEvent('zgw:track', { detail: { event: 'focus', props: { landmark: lastFocus } } })); } catch {}
      }
    }
  }
  repick = pick;
  const schedule = () => { if (!ticking){ ticking = true; requestAnimationFrame(pick); } };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  pick();
}
