/* timeofday.js — the night world breathes with the visitor's real clock.
   Reads the local hour and tags <body data-tod="phase">; tokens.css maps each
   phase to a night-sky tint (--tod-bg / --tod-haze) built ENTIRELY from design
   tokens — no colors live here, only logic. A faint clock is etched into the
   corner so the awareness is legible, not just felt. Progressive: with JS off
   data-tod is unset and --tod-bg falls back to --bg (deep night) — exactly as
   the site looked before. Runs only in the night world (alley/stall/404). */

// [fromHour, id, label] — the alley is nocturnal even by day; the labels lean
// into that (it never admits it's morning, it calls daylight "borrowed").
const PHASES = [
  { from: 0,  id: 'dead-night', label: 'dead of night' },
  { from: 4,  id: 'predawn',    label: 'the hour before' },
  { from: 6,  id: 'dawn',       label: 'first light' },
  { from: 9,  id: 'day',        label: 'borrowed daylight' },
  { from: 16, id: 'dusk',       label: 'last light' },
  { from: 19, id: 'night',      label: 'neon hours' },
];

function phaseFor(hour){
  let p = PHASES[0];
  for (const cand of PHASES){ if (hour >= cand.from) p = cand; }
  return p;
}

const pad = n => (n < 10 ? '0' : '') + n;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/* daylight level 0..1 from the real clock — 0 = deep night, 1 = bright midday.
   Bright across the morning + day, smooth dawn (4.5–8) and dusk (17.5–21.5),
   dark at night. The alley sky + the "neon turns on after dark" effect read
   off this. Mornings sit high (~0.9) so the scene starts bright. */
function daylight(h){
  if (h <= 4.5 || h >= 21.5) return 0;
  if (h < 8)    return 0.95 * smooth((h - 4.5) / 3.5);             // dawn ramp
  if (h < 17.5) return 0.9 + 0.1 * Math.sin((h - 8) / 9.5 * Math.PI); // day arc, midday peak
  return 0.9 * smooth((21.5 - h) / 4);                             // dusk fall
}

export function initTimeOfDay(){
  const body = document.body;
  let clock = null;
  let lastPhase = null;

  function paint(){
    const now = new Date();
    const phase = phaseFor(now.getHours());
    if (phase.id !== lastPhase){
      body.dataset.tod = phase.id;
      lastPhase = phase.id;
    }
    // continuous daylight (alley day↔night cycle); minute precision.
    // The vibe stays DARK at every hour — DAY_SCALE compresses the range to a
    // narrow band so daytime is only a faint blue lift over the deep-night
    // black (enough to tell morning from night, never a bright sky).
    const DAY_SCALE = 0.2;
    const day = daylight(now.getHours() + now.getMinutes() / 60) * DAY_SCALE;
    body.style.setProperty('--tod-day', day.toFixed(3));
    if (!clock){
      clock = document.createElement('div');
      clock.className = 'tod-clock';
      clock.setAttribute('aria-hidden', 'true');
      body.appendChild(clock);
    }
    clock.innerHTML =
      '<span class="tod-time">' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + '</span>' +
      '<span class="tod-label">' + phase.label + '</span>';
  }

  paint();
  // keep the minute fresh and let the scene cross a phase boundary live
  setInterval(paint, 30000);
}
