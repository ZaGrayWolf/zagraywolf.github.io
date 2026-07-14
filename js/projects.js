/* projects.js — renders the CH.02 project panels from data/projects.json so
   adding a project is a one-file edit (no HTML surgery). The static TL;DR +
   GitHub payoff are the no-JS floor; with JS the panels render here, then
   panels.js / glyphborder.js / the curator-digest in main.js enhance them.
   MUST run (and be awaited) before those inits so they find the panels. */

const STALL = 'stall.html#recs-';

// confidence 0–5 → ▰▰▰▰▱ (same glyphs the static panels used)
function bar(n){
  const f = Math.max(0, Math.min(5, n | 0));
  return '▰'.repeat(f) + '▱'.repeat(5 - f);
}

function panelHTML(p){
  const cls = ['panel', p.class, 'reveal'].filter(Boolean).join(' ');
  const tags = (p.tags || []).map(t => `<li>${t}</li>`).join('');
  const links = (p.links || []).map(l => `<a href="${l.href}">${l.label}</a>`).join(' · ');
  const conf = p.confidence
    ? `<p class="confidence"><span class="bar">${bar(p.confidence)}</span> &nbsp;confidence</p>` : '';
  const pairs = p.pairs
    ? `<p class="pairs-with">pairs well with → <a href="${STALL}${p.pairs.cat}">${p.pairs.title}</a></p>` : '';
  // desc is the owner's own copy (may carry inline markup, e.g. <span class="mono">)
  return `<article class="${cls}"${p.narrate ? ` data-narrate="${p.narrate}"` : ''}>
    <span class="panel-caption">${p.caption}</span>
    <h2>${p.title}</h2>
    <p>${p.desc}</p>
    ${tags ? `<ul class="tags">${tags}</ul>` : ''}
    ${links ? `<p class="panel-links">${links}</p>` : ''}
    ${conf}${pairs}
  </article>`;
}

export async function initProjects(){
  const page = document.querySelector('.page[data-projects]');
  if (!page) return;                       // not the projects page / already static
  let data;
  try {
    const res = await fetch('data/projects.json');
    data = await res.json();
  } catch { return; }                      // fetch failed → TL;DR + payoff remain the floor
  const html = data.map(panelHTML).join('');
  const payoff = page.querySelector('.payoff');
  payoff ? payoff.insertAdjacentHTML('beforebegin', html)
         : page.insertAdjacentHTML('beforeend', html);
}
