/* glyphborder.js — morphing ASCII panel borders (CH.02 PROJECTS gallery).
   Each panel's frame becomes a ring of monospace glyph cells that slowly
   breathe: a staggered, randomised subset refreshes every tick, cycling
   through glyph pools (box → kata → special → dots). Hovering a panel freezes
   its border ("I'm watching"); leaving resumes after an idle beat. Per-panel
   tick speed / pool period / idle delay are randomised so the grid doesn't
   pulse in lockstep.

   Each cell is a fixed-size box with the glyph centred + clipped, so katakana
   (full-width in CJK fonts) never breaks the grid and a textContent swap costs
   paint, not layout. Progressive: JS-injected — no-JS and reduced-motion keep
   the plain solid border. Touch gets a STATIC always-on frame (no hover to
   morph); fine pointers get the morph-on-hover behaviour. */

const POOLS = {
  box:     '─│┌┐└┘├┤╱╲╳═║'.split(''),
  kata:    'アカサタナハマヤラワ'.split(''),
  special: '◆◇★☆♦♣♠♥◉◎◊'.split(''),
  dots:    '·•°˙⁰¹²³⁴⁵'.split(''),
};
const ORDER = ['box', 'kata', 'special', 'dots'];

const CELL_W = 12, CELL_H = 14;        // px — must match the .gb-cell rules
const REFRESH = 0.18;                  // fraction of cells that morph per tick

const pick = arr => arr[(Math.random() * arr.length) | 0];

function buildStrips(panel, st){
  st.layer.textContent = '';
  const w = panel.clientWidth, h = panel.clientHeight;
  const nTop  = Math.max(2, Math.floor(w / CELL_W));
  const mSide = Math.max(0, Math.floor((h - 2 * CELL_H) / CELL_H));
  const cells = [];

  const strip = (cls, n) => {
    const el = document.createElement('div');
    el.className = 'gb-strip ' + cls;
    for (let i = 0; i < n; i++){
      const s = document.createElement('span');
      s.className = 'gb-cell';
      s.textContent = pick(POOLS.box);
      el.appendChild(s);
      cells.push(s);
    }
    st.layer.appendChild(el);
  };
  strip('gb-top', nTop);
  strip('gb-bottom', nTop);
  strip('gb-left', mSide);
  strip('gb-right', mSide);
  st.cells = cells;
}

function tick(st){
  if (st.frozen || !st.cells.length) return;
  if (++st.poolT >= st.poolEvery){ st.poolT = 0; st.poolIdx = (st.poolIdx + 1) % ORDER.length; }
  const pool = POOLS[ORDER[st.poolIdx]];
  const n = st.cells.length;
  const count = Math.max(1, (n * REFRESH) | 0);
  for (let k = 0; k < count; k++) st.cells[(Math.random() * n) | 0].textContent = pick(pool);
}

function initPanel(panel){
  const layer = document.createElement('div');
  layer.className = 'glyph-border';
  layer.setAttribute('aria-hidden', 'true');
  panel.appendChild(layer);
  // NOTE: the glyph frame only appears on hover — panels keep their plain
  // solid border at rest (.has-glyph-border is toggled on enter/leave).

  const st = {
    layer, cells: [],
    poolIdx: (Math.random() * ORDER.length) | 0,
    poolT: 0,
    poolEvery: 18 + (Math.random() * 14 | 0),   // pool change ~ every 2–4.5s
    frozen: true,                               // morphs only while hovered
    offT: 0, rebuildT: 0,
  };
  buildStrips(panel, st);
  setInterval(() => tick(st), 95 + (Math.random() * 60 | 0));   // ticks, but frozen until hover

  // hover / focus reveals the glyph frame and starts the morph; leaving hides it
  const activate   = () => { clearTimeout(st.offT); panel.classList.add('has-glyph-border'); st.frozen = false; };
  const deactivate = () => { st.frozen = true; st.offT = setTimeout(() => panel.classList.remove('has-glyph-border'), 140); };
  panel.addEventListener('pointerenter', activate);
  panel.addEventListener('pointerleave', deactivate);
  panel.addEventListener('focusin', activate);
  panel.addEventListener('focusout', deactivate);

  // rebuild on resize (debounced) so the ring always fits
  if ('ResizeObserver' in window){
    new ResizeObserver(() => {
      clearTimeout(st.rebuildT);
      st.rebuildT = setTimeout(() => buildStrips(panel, st), 200);
    }).observe(panel);
  }
}

// touch: no hover, so instead of the morphing-on-hover frame we paint a STATIC
// glyph ring that's always on — the signature ASCII border shows on phones too,
// just doesn't animate. Build the strips once, flip .has-glyph-border on, no tick.
function initPanelStatic(panel){
  const layer = document.createElement('div');
  layer.className = 'glyph-border';
  layer.setAttribute('aria-hidden', 'true');
  panel.appendChild(layer);

  const st = { layer, cells: [], rebuildT: 0 };
  buildStrips(panel, st);
  panel.classList.add('has-glyph-border');   // frame stays visible (no hover on touch)

  // refit on rotate / resize (debounced)
  if ('ResizeObserver' in window){
    new ResizeObserver(() => {
      clearTimeout(st.rebuildT);
      st.rebuildT = setTimeout(() => buildStrips(panel, st), 200);
    }).observe(panel);
  }
}

export function initGlyphBorders(){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // keep solid borders
  // phones: the static ring can't morph anyway (no hover) — it's just DOM weight
  // + visual noise on a small screen, so keep the plain solid border there.
  if (matchMedia('(max-width:700px)').matches) return;   // ponytail: solid border on phone
  // fine pointer → morph-on-hover; touch → static always-on frame (no hover)
  const build = matchMedia('(pointer: fine)').matches ? initPanel : initPanelStatic;
  document.querySelectorAll('.chapter .panel').forEach(build);
}
