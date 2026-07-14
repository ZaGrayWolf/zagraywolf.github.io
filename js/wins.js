/* wins.js — renders the CH.03 scoreboard panels from data/wins.json so adding a
   win is a one-file edit. The static .tldr skim + the .payoff are the no-JS
   floor. Sibling of projects.js (win panels carry a beat-metric instead of a
   confidence bar / pairs-with). Awaited in main.js BEFORE initPanels/glyphborder
   so the panel-enhancers find the rendered panels. */

function panelHTML(w){
  const cls = ['panel', w.class, 'reveal'].filter(Boolean).join(' ');
  const tags = (w.tags || []).map(t => `<li>${t}</li>`).join('');
  const links = (w.links || []).map(l => `<a href="${l.href}">${l.label}</a>`).join(' · ');
  const metric = w.metric ? `<span class="beat-metric">${w.metric}</span>` : '';
  return `<article class="${cls}"${w.narrate ? ` data-narrate="${w.narrate}"` : ''}>
    <span class="panel-caption">${w.caption}</span>
    <h2>${w.title}</h2>
    <p>${w.body}</p>
    ${metric}${tags ? `<ul class="tags">${tags}</ul>` : ''}${links ? `<p class="panel-links">${links}</p>` : ''}
  </article>`;
}

export async function initWins(){
  const page = document.querySelector('.page[data-wins]');
  if (!page) return;
  let data;
  try {
    const res = await fetch('data/wins.json');
    data = await res.json();
  } catch { return; }                      // .tldr + .payoff remain the floor
  const html = data.map(panelHTML).join('');
  const payoff = page.querySelector('.payoff');
  payoff ? payoff.insertAdjacentHTML('beforebegin', html)
         : page.insertAdjacentHTML('beforeend', html);
}
