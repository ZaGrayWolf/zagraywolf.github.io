/* companion.js — Casper follows you into the chapters (continuity layer).
   The same /ᐠ｡ꞈ｡ᐟ\ cat who walks the tab title and greets in the console pads
   into the paper world and drops ONE short, contextual line: he remembers the
   visit (sessionStorage zgw.visited / lifetime zgw.visits / zgw.cat.pets) and
   nudges toward what you haven't seen. Click him to hear the next thought.
   Paper-chapters only — the alley has the real cat, the stall has the
   concierge, so this is purely the bridge between night and day. Progressive:
   JS-injected, so no-JS never sees it; reduced-motion drops the pad-in. */

import { PAGES } from './config.js?v=4.41';
const CHAPTERS = PAGES.filter(p => p.chapter).map(p => p.slug);
// ponytail: NAMES is voice copy, not structure — kept local so Casper's phrasing stays independent of mapLabel
const NAMES = { work: 'WORK', projects: 'PROJECTS', papers: 'the WINS', resume: 'the RESUME', stall: 'the STALL' };

// Casper refers to the human in the third person (same voice as the stall +
// the console line) — he's his own entity, not Abhuday's mouthpiece.
const OPENERS = {
  work:     "his day jobs. each one taught him something the last couldn't.",
  projects: "what he builds when nobody's asking. my favorite floor.",
  papers:   "the wins. he won't brag about them, so i will, a little.",
  resume:   "the one-page him. there's a converter down here too; feed it a photo.",
  oneshot:  "the one-shot. one study told in full, breakage and all. he's proudest of the harness.",
};

const pageFromBody = () => document.body.dataset.page;

function readState(){
  let visited = [], visits = 0, pets = 0, met = false;
  try { visited = JSON.parse(sessionStorage.getItem('zgw.visited') || '[]'); } catch {}
  try { visits = parseInt(localStorage.getItem('zgw.visits') || '0') || 0; } catch {}
  try { pets = parseInt(localStorage.getItem('zgw.cat.pets') || '0') || 0; } catch {}
  try { met = sessionStorage.getItem('zgw.companion.met') === '1'; } catch {}
  return { visited, visits, pets, met };
}

// build the ordered thoughts for this page; first is shown, clicks cycle the rest
function buildLines({ visited, visits, pets, met }, page){
  const lines = [];
  if (!met) lines.push("oh, you came inside. i followed you in from the alley.");
  lines.push(OPENERS[page] || "another room. he's been busy.");
  // nudge toward the about page — he alternates his thoughts, so this surfaces
  // as you click through (about isn't in the minimap, so Casper is the way in)
  lines.push('want to know more about him? <a class="companion-link" href="about.html">go here →</a>');
  // same for the one-shot (also not on the minimap) — skipped when already there
  if (page !== 'oneshot') lines.push('he drew one whole study as a one-shot, breakage and all. <a class="companion-link" href="oneshot.html">read it →</a>');
  if (visits > 1) lines.push(`back again, that's ${visits} visits now. i'm keeping count.`);

  const unseen = CHAPTERS.filter(c => c !== page && !visited.includes(c));
  if (unseen.length) lines.push(`you still haven't seen ${NAMES[unseen[0]]}.`);
  else lines.push("that's the whole street, then. the stall's still warm, though.");

  if (pets > 0) lines.push(`i still feel that ear-scratch from the alley, ${pets} of them.`);
  return lines;
}

export function initCompanion(){
  const page = pageFromBody();
  const state = readState();
  const lines = buildLines(state, page);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wrap = document.createElement('div');
  wrap.className = 'companion';
  if (reduced) wrap.classList.add('is-ready');           // no pad-in; just present

  const bubble = document.createElement('div');
  bubble.className = 'companion-bubble';
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');

  const cat = document.createElement('button');
  cat.className = 'companion-cat';
  cat.type = 'button';
  // the ASCII cat is drawn by CSS (.companion-cat::before) so the button has no
  // DOM text and its accessible name is exactly this aria-label (label-in-name)
  cat.setAttribute('aria-label', 'Casper, click for another thought');

  wrap.append(bubble, cat);
  document.body.appendChild(wrap);

  let idx = 0;
  let cycleTimer = 0;
  // touch screens are small and the bubble is a fixed overlay — keep it brief and
  // dismissable there. Desktop keeps the leisurely auto-cycle.
  const touch = matchMedia('(pointer:coarse)').matches;
  const STEP = touch ? 4000 : 5500;

  function say(i){
    idx = ((i % lines.length) + lines.length) % lines.length;
    bubble.innerHTML = lines[idx];   // lines are our own strings; one carries an <a> to about
    requestAnimationFrame(() => bubble.classList.add('is-in'));
  }
  function hide(){ clearTimeout(cycleTimer); bubble.classList.remove('is-in'); }

  // Casper alternates his thoughts on his own (one pass) so the about nudge
  // surfaces without a click; the pointer pausing it keeps the about link
  // clickable; after the last thought he settles to just the cat.
  // On touch he settles after ONE line so the bubble never lingers over the
  // small screen — tap the cat to hear more (the about nudge is still reachable).
  function step(){
    clearTimeout(cycleTimer);
    cycleTimer = setTimeout(() => {
      if (touch || idx >= lines.length - 1){ hide(); return; }
      say(idx + 1); step();
    }, STEP);
  }

  wrap.addEventListener('pointerenter', () => clearTimeout(cycleTimer));
  wrap.addEventListener('pointerleave', () => { if (bubble.classList.contains('is-in')) step(); });

  // touch: a tap on the bubble dismisses it right away (a fixed overlay is
  // intrusive on a phone). Tapping the about link inside it still navigates.
  if (touch){
    bubble.addEventListener('click', e => { if (!e.target.closest('a')) hide(); });
  }

  cat.addEventListener('click', () => {
    // re-speak after he's settled, otherwise advance — then keep alternating
    if (!bubble.classList.contains('is-in')) say(idx);
    else say(idx + 1);
    step();
  });

  // pad in. On desktop Casper greets + auto-cycles his thoughts. On touch he
  // stays COLLAPSED — just the cat in the corner, no bubble over the small
  // screen — until you tap him (the cat click handler above speaks on demand).
  setTimeout(() => {
    wrap.classList.add('is-ready');
    if (!touch){
      say(0);
      step();
    }
    try { sessionStorage.setItem('zgw.companion.met', '1'); } catch {}
  }, reduced ? 0 : 900);
}
