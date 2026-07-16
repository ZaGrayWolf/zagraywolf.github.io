/* dynamic-menu.js — the HUD minimap becomes a conversation with the curator.
   The minimap ships as static HTML ("[#]─[1]─…", keyboard-reachable without
   JS). This module *enhances* it: it marks state, wires the curator escort,
   and re-lays-out the SAME anchors into a small constellation/route map so
   travel reads as moving through a place, not sliding along a straight line.
   Because it re-uses the existing <a> elements (hrefs, labels, listeners, ARIA
   all intact) the no-JS floor is untouched — JS just rearranges them.

   · Hover/focus a node → the curator (cyan) drifts toward it (curator.escort)
     and the HUD line reads "escorting to PROJECTS" — your intent is watched.
   · Visited chapters are marked amber and persist across reloads (localStorage),
     a breadcrumb trail you can see. The current chapter stays active (cyan).
   · Click is left to transition.js → the glyph-swarm portal (one nav path).

   Scales for free: add a chapter to the static minimap HTML, give it a COORD,
   and the constellation, state-tracking, and transition all pick it up. */

import { escortNarrate, endEscort } from './narrator.js?v=4.64';
import { PAGES } from './config.js?v=4.64';

const LABELS = Object.fromEntries(PAGES.filter(p => p.nav).map(p => [p.slug, p.mapLabel]));
// scattered star-chart coords (% of the map box), in chapter/DOM order —
// a meandering trail, deliberately non-collinear and evenly spread so no two
// nodes crowd (DOM order: alley, work, projects, papers, resume, stall).
const COORDS = [[5, 52], [23, 24], [41, 64], [59, 30], [77, 60], [98, 32]];
const SVG_NS = 'http://www.w3.org/2000/svg';
const SEEN_KEY = 'zgw.seen';

function loadSeen(){
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveSeen(set){
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])); } catch {}
}

function layoutConstellation(map, nodes){
  const pts = nodes.map((_, i) => COORDS[i] || [(i / Math.max(1, nodes.length - 1)) * 92 + 4, 48]);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'hud-lines');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const poly = document.createElementNS(SVG_NS, 'polyline');
  poly.setAttribute('points', pts.map(p => p.join(',')).join(' '));
  svg.appendChild(poly);

  // re-append the same anchors (listeners + state classes survive the move)
  map.replaceChildren(svg, ...nodes);
  nodes.forEach((a, i) => { a.style.left = pts[i][0] + '%'; a.style.top = pts[i][1] + '%'; });
  map.classList.add('is-constellation');
}

export function initDynamicMenu(curator){
  const map = document.querySelector('.hud-map');
  if (!map) return;
  const nodes = [...map.querySelectorAll('a')];
  if (!nodes.length) return;

  const page = document.body.dataset.page;
  const seen = loadSeen();
  if (page){ seen.add(page); saveSeen(seen); }     // arriving here marks it visited

  nodes.forEach(a => {
    const id = a.dataset.node;
    if (id === page) a.classList.add('is-active');            // current (also aria-current)
    else if (seen.has(id)) a.classList.add('is-visited');     // amber breadcrumb

    const label = LABELS[id] || id;
    const enter = () => { curator?.escort(a); escortNarrate('escorting to ' + label); };
    const leave = () => { curator?.release(); endEscort(); };
    a.addEventListener('pointerenter', enter);
    a.addEventListener('pointerleave', leave);
    a.addEventListener('focus', enter);
    a.addEventListener('blur', leave);
  });

  layoutConstellation(map, nodes);
}
