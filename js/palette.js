/* palette.js — the curator's command line (C9). A dev-native command palette:
   press "/" (or ⌘K / Ctrl-K) anywhere to summon a terminal-styled overlay,
   type to fuzzy-filter, ↑↓ to move, ⏎ to go. Navigates with the site's own
   page transition (it clicks a real <a> so transition.js handles the veil),
   opens socials in a new tab, and can boot the game. Progressive enhancement:
   built lazily on first open, never touches the page until summoned, and the
   site is fully navigable without it. Suppressed while typing in a field so it
   never steals Casper's "/" or the converter's input. */

import { PAGES } from './config.js?v=4.46';

const HOST = 'https://zagraywolf.github.io/';

// nav targets — the current page is filtered out at render time
const NAV = PAGES.filter(p => p.nav).map(p => ({ label: p.label, keys: p.keys, url: p.href }));

const ACTIONS = [
  { label: 'Play NEKO CATCHER',     keys: 'game play arcade cat neko catch fun', run: () => dispatchEvent(new CustomEvent('nekocatcher:boot')) },
  { label: 'GitHub ↗',             keys: 'github code git source repos', url: 'https://github.com/ZaGrayWolf', ext: true },
  { label: 'LinkedIn ↗',           keys: 'linkedin connect network', url: 'https://www.linkedin.com/in/kunwar-abhuday-singh-280836284', ext: true },
  { label: 'Kaggle ↗',             keys: 'kaggle data notebooks', url: 'https://www.kaggle.com/abhuday7', ext: true },
  { label: 'Email Abhuday ✉',      keys: 'email mail contact hire reach hello talk', url: 'mailto:abhuday2656@gmail.com', mail: true },
];

let root = null, input = null, list = null;
let open = false, sel = 0, shown = [], lastFocus = null;

// subsequence fuzzy match: every char of q appears, in order, in hay
function matches(q, hay){
  if (!q) return true;
  let i = 0;
  for (const ch of hay){ if (ch === q[i]) i++; if (i === q.length) return true; }
  return i === q.length;
}

function here(){
  const p = location.pathname.replace(/\/$/, '/index.html');
  return p.slice(p.lastIndexOf('/') + 1) || 'index.html';
}

function commands(){
  const cur = here();
  return [...NAV.filter(c => c.url !== cur), ...ACTIONS];
}

function build(){
  root = document.createElement('div');
  root.className = 'cmdk';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Command palette');
  root.innerHTML =
    '<div class="cmdk-backdrop"></div>' +
    '<div class="cmdk-box">' +
      '<div class="cmdk-prompt"><span class="cmdk-caret">curator://</span>' +
      '<input class="cmdk-input" type="text" autocomplete="off" autocapitalize="off" ' +
      'spellcheck="false" placeholder="type a command… (try “work” or “github”)" ' +
      'aria-label="Command" aria-controls="cmdk-list" role="combobox" aria-expanded="true"></div>' +
      '<ul class="cmdk-list" id="cmdk-list" role="listbox"></ul>' +
      '<p class="cmdk-foot">↑↓ move · ⏎ go · esc close</p>' +
    '</div>';
  document.body.appendChild(root);
  input = root.querySelector('.cmdk-input');
  list  = root.querySelector('.cmdk-list');

  root.querySelector('.cmdk-backdrop').addEventListener('click', close);
  input.addEventListener('input', () => render());
  list.addEventListener('mousemove', e => {
    const li = e.target.closest('.cmdk-item');
    if (li){ sel = +li.dataset.i; paint(); }
  });
  list.addEventListener('click', e => {
    const li = e.target.closest('.cmdk-item');
    if (li){ sel = +li.dataset.i; run(); }
  });
}

function render(){
  const q = input.value.trim().toLowerCase();
  shown = commands().filter(c => matches(q, (c.label + ' ' + c.keys).toLowerCase()));
  sel = 0;
  if (!shown.length){
    list.innerHTML = '<li class="cmdk-empty">no command. try “work”, “resume”, “github”</li>';
    return;
  }
  list.innerHTML = shown.map((c, i) =>
    '<li class="cmdk-item" role="option" data-i="' + i + '">' +
      '<span>' + esc(c.label) + '</span>' +
      '<span class="cmdk-hint">' + (c.ext ? '↗' : c.mail ? '✉' : c.run ? '▶' : '⏎') + '</span>' +
    '</li>').join('');
  paint();
}

function paint(){
  [...list.children].forEach((li, i) => li.classList.toggle('is-sel', i === sel));
  list.children[sel]?.scrollIntoView({ block: 'nearest' });
}

function move(d){
  if (!shown.length) return;
  sel = (sel + d + shown.length) % shown.length;
  paint();
}

function run(){
  const c = shown[sel];
  if (!c) return;
  try { dispatchEvent(new CustomEvent('zgw:track', { detail: { event: 'command', props: { cmd: c.label } } })); } catch {}
  close();
  if (c.run){ c.run(); return; }
  if (c.ext){ window.open(c.url, '_blank', 'noopener'); return; }
  if (c.mail){ location.href = c.url; return; }
  // internal: click a real anchor so transition.js plays the veil
  const a = document.createElement('a');
  a.href = c.url;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openP(){
  seen();
  if (!root) build();
  if (open) return;
  open = true;
  lastFocus = document.activeElement;
  input.value = '';
  render();
  root.classList.add('is-open');
  requestAnimationFrame(() => input.focus());
}

function close(){
  if (!open) return;
  open = false;
  root.classList.remove('is-open');
  lastFocus?.focus?.();
}

function toggle(){ open ? close() : openP(); }

// persistent launcher chip — always visible so the palette is discoverable,
// and (crucially) the only way in on touch devices, where "/" and ⌘K don't
// exist. Themed as the curator's command line; docked by the HUD narrator line.
let fab = null;
const SEEN_KEY = 'zgw.cmdk';
function seen(){
  try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
  fab?.classList.add('is-used');
}
function launcher(){
  fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'cmdk-fab';
  fab.setAttribute('aria-label', 'cmds · open the command palette (press /)');
  fab.title = 'cmds ( / )';
  // the "/" glyph is drawn via CSS (::before) so the button's accessible name
  // stays just "cmds" — matches the visible label (WCAG 2.5.3)
  fab.innerHTML = '<span class="cmdk-fab-txt">cmds</span>';
  fab.addEventListener('click', openP);
  document.body.appendChild(fab);
  try { if (localStorage.getItem(SEEN_KEY)) fab.classList.add('is-used'); } catch {}
}

function esc(s){
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function initPalette(){
  addEventListener('keydown', e => {
    const k = e.key;
    if ((k === 'k' || k === 'K') && (e.metaKey || e.ctrlKey)){ e.preventDefault(); toggle(); return; }
    const el = e.target;
    const tag = (el?.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || el?.isContentEditable;
    if (!open){
      if (k === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey){ e.preventDefault(); openP(); }
      return;
    }
    if (k === 'Escape'){ e.preventDefault(); close(); }
    else if (k === 'ArrowDown'){ e.preventDefault(); move(1); }
    else if (k === 'ArrowUp'){ e.preventDefault(); move(-1); }
    else if (k === 'Enter'){ e.preventDefault(); run(); }
  });
  launcher();
}
