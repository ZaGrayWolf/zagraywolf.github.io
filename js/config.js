/* config.js — single source of truth for site structure.
   Pure data, zero side effects. Import PAGES in any module that needs page metadata.

   ADDING A PAGE:
   1. Add an entry to PAGES below (JS side done in one file).
   2. Add <a data-node="slug"> to .hud-map in ALL existing HTML files (unavoidable, no build step).
   3. Create the .html page + its JS module.
   4. Add a lazy import block in main.js's page-routing section. */

export const PAGES = [
  { slug: 'alley',    href: 'index.html',    label: 'The Alley · home',  mapLabel: 'the alley', nav: true,  chapter: false, keys: 'home hub start alley index begin' },
  { slug: 'about',    href: 'about.html',    label: 'About · CH.00',     mapLabel: 'ABOUT',     nav: true,  chapter: false, keys: 'about me bio story who is profile' },
  { slug: 'work',     href: 'work.html',     label: 'Work · CH.01',      mapLabel: 'WORK',      nav: true,  chapter: true,  keys: 'work experience jobs internship bookmyshow incubyte kliv robomanipal' },
  { slug: 'projects', href: 'projects.html', label: 'Projects · CH.02',  mapLabel: 'PROJECTS',  nav: true,  chapter: true,  keys: 'projects builds code repos rag ml' },
  { slug: 'oneshot',  href: 'oneshot.html',  label: 'One-Shot · Edge Benchmarks', mapLabel: 'ONE-SHOT', nav: true, chapter: false, keys: 'oneshot one-shot case study deep dive edge benchmark quantization int8 kliv' },
  { slug: 'papers',   href: 'papers.html',   label: 'Wins · CH.03',      mapLabel: 'WINS',      nav: true,  chapter: true,  keys: 'wins papers awards achievements honours robocup' },
  { slug: 'resume',   href: 'resume.html',   label: 'Résumé · CH.04',    mapLabel: 'RESUME',    nav: true,  chapter: true,  keys: 'resume cv hire download' },
  { slug: 'stall',    href: 'stall.html',    label: 'The Stall · recs',  mapLabel: 'THE STALL', nav: true,  chapter: true,  keys: 'stall recommendations casper anime manga movies books shows ask' },
  { slug: 'notfound', href: '404.html',      label: '404',               mapLabel: '404',       nav: false, chapter: false, keys: '' },
];
