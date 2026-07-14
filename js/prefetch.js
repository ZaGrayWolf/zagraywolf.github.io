/* prefetch.js — make page-to-page navigation feel instant on this multi-page
   site. Two cheap, progressive layers (no framework; honors Save-Data / slow
   links; each URL warmed at most once):

   1. IDLE — once the current page settles (requestIdleCallback), warm the pages
      a visitor most likely opens next, in priority order, plus (from the
      night-world hub) the shared paper-world CSS/JS every chapter needs. So the
      first click is already in cache.
   2. INTENT — on hover (desktop) / touchstart (mobile) of any internal link,
      warm its target right away; by the time the click lands (~200ms later) it's
      cached and transition.js's veil covers the rest.

   No prerender on purpose — that would execute the target's scripts and fire a
   premature analytics pageview. This only warms the HTTP cache. HTML pages carry
   no ?v=; versioned assets are warmed with the SAME ?v= the page uses (read live
   from the DOM) so the cache entry actually matches what navigation requests. */

// what each page most likely leads to, in priority order (home → CH.1 first)
const LIKELY = {
  alley:    ['work.html', 'oneshot.html', 'projects.html', 'resume.html'],
  about:    ['work.html', 'projects.html', 'resume.html'],
  work:     ['projects.html', 'oneshot.html', 'resume.html'],
  projects: ['oneshot.html', 'papers.html', 'resume.html'],
  papers:   ['resume.html', 'projects.html'],
  resume:   ['stall.html', 'projects.html'],
  oneshot:  ['projects.html', 'papers.html'],
  stall:    ['resume.html'],
};

// the ?v= this page is built with, lifted from any versioned <link> so warmed
// assets share the exact cache key navigation will ask for
const V = (document.querySelector('link[href*="?v="]')?.getAttribute('href')
          .match(/\?v=[0-9.]+/)?.[0]) || '';
// CSS/JS every paper chapter shares — warm once from the hub so the first
// chapter open doesn't wait on the heavy paper-world bundle
const PAPER_ASSETS = ['css/paper.css', 'css/panels.css', 'js/panels.js', 'js/companion.js']
  .map(u => u + V);

const here = location.pathname.split('/').pop() || 'index.html';
const seen = new Set([here]);   // never warm the page we're already on

function warm(url, as){
  if (!url || seen.has(url)) return;
  seen.add(url);
  const l = document.createElement('link');
  l.rel = 'prefetch';
  l.href = url;
  if (as) l.as = as;
  document.head.appendChild(l);
}

export function initPrefetch(){
  // honor data-savers and genuinely slow radios — don't spend their bandwidth
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return;

  const page = document.body.dataset.page;

  // 1. idle — warm likely-next pages, then the shared paper bundle from the hub
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
  idle(() => {
    (LIKELY[page] || []).forEach(u => warm(u, 'document'));
    if (page === 'alley' || page === 'about') PAPER_ASSETS.forEach(u => warm(u));
  });

  // 2. intent — warm a link's target the moment the pointer/finger lands on it
  const onIntent = e => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || /^(https?:|mailto:|tel:|#)/.test(href) || a.hasAttribute('download')) return;
    warm(href, 'document');
  };
  addEventListener('pointerover', onIntent, { passive: true });
  addEventListener('touchstart',  onIntent, { passive: true });
  addEventListener('focusin',     onIntent);
}
