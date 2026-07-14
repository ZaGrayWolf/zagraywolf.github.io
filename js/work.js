/* work.js — renders the CH.01 job "beat" pages (p.2…p.N) from data/work.json so
   adding an internship is a one-file edit. The cover, TL;DR skim, and the
   personal "establishing shot" page (p.1) stay static in work.html — they're
   the no-JS floor and aren't jobs. Folios auto-number (p.1 total included), so
   a new job never forces a manual renumber. Awaited in main.js BEFORE
   initPanels/glyphborder so the panel-enhancers find the rendered panels. */

const STALL = 'stall.html#recs-';

function leadHTML(job, pageNum){
  const crumb = job.crumb
    ? `<p class="anime-crumb"><a href="${STALL}${job.crumb.cat}">${job.crumb.title}</a>: ${job.crumb.note}</p>` : '';
  const meta = job.meta ? `<p class="mono">${job.meta}</p>` : '';
  return `<article class="panel panel--12 reveal" style="border-bottom:0; padding-bottom:var(--s-1)">
      <span class="panel-caption">P.${pageNum} — ${job.captionTail}</span>
      <h2>${job.title}</h2>
      ${crumb}${meta}<p>${job.lead}</p>
    </article>`;
}

function beatHTML(b){
  const size = b.wide ? 'panel--12' : 'panel--4';
  const cls = ['panel', size, b.class, 'reveal'].filter(Boolean).join(' ');
  const title = b.title ? `<h2>${b.title}</h2>` : '';
  const metric = b.metric ? `<span class="beat-metric">${b.metric}</span>` : '';
  return `<article class="${cls}">
      <span class="panel-caption">${b.caption}</span>
      ${title}<p>${b.body}</p>${metric}
    </article>`;
}

function pageHTML(job, i, total){
  const pageNum = i + 2;                              // p.1 is the static establishing page
  const last = i === total - 2;                       // total = 1 + jobs; last job → "— end"
  const folio = `p.${pageNum} / ${total}` + (last ? ' — end' : '');
  const sfx = job.sfx ? `<span class="sfx" style="${job.sfx.style}" aria-hidden="true">${job.sfx.text}</span>` : '';
  const beats = job.beats.map(beatHTML).join('');
  return `<section class="page page--beat" aria-label="${job.aria}"${job.sfx ? ' style="position:relative"' : ''} data-narrate="${job.narrate}">
    ${sfx}${leadHTML(job, pageNum)}
    ${beats}
    <article class="payoff reveal">
      <h2>${job.payoff.title}</h2>
      <p>${job.payoff.sub}</p>
    </article>
    <p class="folio panel--12" aria-hidden="true"><span>CH.01 — WORK</span><span>${folio}</span></p>
  </section>`;
}

export async function initWork(){
  const main = document.querySelector('main.chapter');
  const anchor = main?.querySelector('.about-sign');
  if (!anchor) return;
  let jobs;
  try {
    const res = await fetch('data/work.json');
    jobs = await res.json();
  } catch { return; }                                 // floor (cover + intro + TL;DR) stays
  const total = 1 + jobs.length;
  anchor.insertAdjacentHTML('beforebegin', jobs.map((j, i) => pageHTML(j, i, total)).join(''));
  // keep the static p.1 folio total in sync (it ships as "p.1 / 5")
  const est = main.querySelector('.page:not(.page--beat) .folio span:last-child');
  if (est) est.textContent = `p.1 / ${total}`;
}
