/* stall.js — CH.05 THE STALL: interactive yatai counter + Casper concierge.
   Fetches data/recs.json. The 4 lantern hotspots (real <button>s over the SVG)
   pick a category; picking a rec slides a warm card across the counter. Casper
   (concierge.js) answers free-form questions — recs route through the same
   card/lantern mechanic, about-Abhuday answers come as a speech bubble.
   Progressive enhancement: the static #stall-menu rec lists are the no-JS
   floor — this module takes that subtree over on boot. */

import { loadCasper, matchIntent } from './concierge.js?v=4.58';
import { narrate } from './narrator.js?v=4.58';

const CATS   = ['anime', 'manga', 'movies', 'books', 'shows'];   // fixed — skips recs.json "_note"
const LABELS = { anime: 'ANIME', manga: 'MANGA', movies: 'MOVIES', books: 'BOOKS', shows: 'SHOWS' };
const ORDER  = { anime: 'ordering anime…', manga: 'ordering manga…', movies: 'ordering a movie…', books: 'ordering a book…', shows: 'ordering a show…' };

let recs = null;
let activeCat = null;
let lastTrigger = null;       // rec button to restore focus to after Esc
let listEl = null, hintEl = null;   // module-scope so the concierge can drive them

export async function initStall() {
  const menu = document.getElementById('stall-menu');
  if (!menu) return;

  try {
    const res = await fetch('data/recs.json');
    if (!res.ok) throw new Error(res.status);
    recs = await res.json();
  } catch {
    // leave the static readable lists in place; just wire chef's choice off
    return;
  }

  // JS takes over: replace the static rec lists with one shared revealed list
  menu.innerHTML =
    '<p class="stall-menu-hint" id="stall-menu-hint">a lantern is lit · pick a title:</p>' +
    '<ul class="stall-menu-list" id="stall-menu-list" aria-label="recommendations"></ul>';
  hintEl = menu.querySelector('#stall-menu-hint');
  listEl = menu.querySelector('#stall-menu-list');
  hintEl.hidden = true;

  // wire the 4 hotspots
  document.querySelectorAll('.stall-hotspot').forEach(btn => {
    btn.addEventListener('click', () => selectCat(btn.dataset.cat, listEl, hintEl));
  });

  // chef's choice
  const chefBtn = document.querySelector('.chef-choice');
  if (chefBtn) chefBtn.addEventListener('click', () => chefChoice(listEl, hintEl));

  // Esc clears the card and returns focus
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') clearCard();
  });

  narrate('reading the menu…');     // the curator notes the visit in the HUD

  // Casper concierge (enhancement — stays hidden if its data fails to load)
  initConcierge();

  // deep-link: projects "pairs well with →" links land on stall.html#recs-<cat>
  // auto-light that lantern so the visitor arrives in the right section
  const hash = location.hash;
  if (hash.startsWith('#recs-')) {
    const cat = hash.slice(6);
    if (CATS.includes(cat)) selectCat(cat, listEl, hintEl);
  }
}

// ── Casper concierge ────────────────────────────────────────────────

async function initConcierge() {
  const section = document.getElementById('stall-concierge');
  const form    = document.getElementById('casper-form');
  const input   = document.getElementById('casper-input');
  const bubble  = document.getElementById('casper-bubble');
  const chips   = document.getElementById('casper-chips');
  const cat     = document.getElementById('stall-cat');
  if (!section || !form || !input) return;

  let kb;
  try { kb = await loadCasper(); }
  catch { return; }                     // no data → chat stays hidden, static recs remain

  let awaitingName = false;             // opt-in identity: set after the say-hi prompt
  let lastIntent = null;                // last thing Casper answered — powers "tell me more"

  // bare continuations that mean "keep going on the last thing" — no keywords of
  // their own, so we intercept them before the matcher and re-run the last intent.
  const CONTINUE = new Set([
    'more','tell me more','more please','go on','continue','keep going','and',
    'else','what else','anything else','again','another','one more','next','same again'
  ]);

  // variety: intents/greeting/fallback may hold an array of phrasings. Pick one
  // per turn, never the same one twice in a row, so Casper doesn't sound taped.
  const lastPick = new Map();
  const oneOf = (v, key) => {
    if (!Array.isArray(v)) return v ?? '';
    if (v.length <= 1) return v[0] ?? '';
    let i = Math.floor(Math.random() * v.length);
    if (i === lastPick.get(key)) i = (i + 1) % v.length;   // no immediate repeat
    lastPick.set(key, i);
    return v[i];
  };

  section.hidden = false;

  // phones: when the input takes focus the on-screen keyboard covers the bottom
  // of the page (where the input lives). Nudge it into view once the keyboard
  // has opened so the visitor can see what they're typing. Touch-only.
  if (matchMedia('(pointer:coarse)').matches){
    input.addEventListener('focus', () => {
      setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    });
  }

  const MOODS = ['happy', 'proud', 'thinking', 'shy', 'sleepy', 'content'];

  function renderBubble(text, followups, asked, mood) {
    bubble.innerHTML =
      (asked ? '<span class="you-asked">you: ' + escHtml(asked) + '</span>' : '') +
      escHtml(text);
    requestAnimationFrame(() => bubble.classList.add('is-in'));
    if (cat) {
      MOODS.forEach(m => cat.classList.remove('mood-' + m));
      cat.classList.remove('is-speaking');
      void cat.offsetWidth;             // restart the nod + mood animations
      if (mood && MOODS.includes(mood)) cat.classList.add('mood-' + mood);
      cat.classList.add('is-speaking');
    }
    renderChips(followups);
  }

  // chips accept a plain string (re-asks it) or {label, run} (runs a handler).
  function renderChips(items) {
    chips.innerHTML = '';
    (items || []).forEach(item => {
      const label = typeof item === 'string' ? item : item.label;
      const li  = document.createElement('li');
      const b   = document.createElement('button');
      b.type = 'button';
      b.className = 'stall-rec-btn';
      b.textContent = label;
      b.addEventListener('click', () => {
        if (typeof item === 'object' && item.run) item.run();
        else { input.value = label; handleAsk(label); }
      });
      li.appendChild(b);
      chips.appendChild(li);
    });
  }

  // speak an intent's answer (one of its variants) + run any lantern/chef action.
  function answerIntent(it, asked) {
    if (it.id === 'say-hi') awaitingName = true;      // next message is their name
    lastIntent = it;                                  // remember for "tell me more"
    renderBubble(oneOf(it.answers ?? it.answer, it.id), it.followups, asked, it.mood);
    if (it.action?.type === 'rec')  selectCat(it.action.cat, listEl, hintEl);   // moves focus to titles
    else if (it.action?.type === 'chef') chefChoice(listEl, hintEl);            // moves focus to titles
    else input.focus();                  // about-Abhuday answer → stay in the input
  }

  function handleAsk(text) {
    const q = text.trim();
    if (!q) return;

    // opt-in identity: the previous turn was Casper asking for a name, so treat
    // this message as the visitor introducing themselves (logged, not answered)
    if (awaitingName) {
      awaitingName = false;
      try { dispatchEvent(new CustomEvent('zgw:track', { detail: { event: 'identify', props: { name: q.slice(0, 100) } } })); } catch {}
      renderBubble("*dips his head* Noted. I'll let him know you stopped by. Anything else?", kb.config.fallbackChips, q, 'content');
      input.focus();
      return;
    }

    // "tell me more" / "again" / "another" → continue the last thread instead of
    // dead-ending. Re-runs the last intent: a fresh answer variant, or (for recs)
    // another pick off the same shelf.
    const cont = q.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    if (lastIntent && CONTINUE.has(cont)) {
      answerIntent(lastIntent, q);
      return;
    }

    const r = matchIntent(q, kb);
    // analytics: the actual question asked + how Casper read it
    try { dispatchEvent(new CustomEvent('zgw:track', { detail: { event: 'ask', props: { q: q.slice(0, 120), intent: r.intent?.id || '', fallback: r.status === 'fallback', near: r.status === 'near' } } })); } catch {}

    if (r.status === 'fallback') {
      renderBubble(oneOf(kb.config.fallback, '_fallback'), kb.config.fallbackChips, q, 'shy');
      input.focus();                     // bubble-only → stay in the input
      return;
    }

    // near-miss: guess the likeliest intent and let them confirm with one tap,
    // instead of dead-ending on the generic fallback.
    if (r.status === 'near') {
      const it = r.intent;
      const asks = [
        "*tilts his head* not sure i caught that. were you asking about " + it.label + "?",
        "*whiskers twitch* hm. did you mean " + it.label + "?",
        "*one ear swivels* close. were you after " + it.label + "?"
      ];
      renderBubble(oneOf(asks, '_near:' + it.id), [
        { label: 'yes, ' + it.label, run: () => answerIntent(it, 'yes, ' + it.label) },
        ...kb.config.fallbackChips.slice(0, 2)
      ], q, 'thinking');
      input.focus();
      return;
    }

    answerIntent(r.intent, q);           // match or greeting → Casper speaks
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value;
    input.value = '';
    handleAsk(q);
  });

  // seed the greeting + starter chips
  renderBubble(oneOf(kb.config.greeting, '_greeting'), kb.config.fallbackChips, undefined, 'happy');
}

// ── category selection ─────────────────────────────────────────────

function selectCat(cat, list, hint) {
  activeCat = cat;
  try { dispatchEvent(new CustomEvent('zgw:track', { detail: { event: 'rec_open', props: { cat } } })); } catch {}
  narrate(ORDER[cat] || 'reading the menu…');

  // hotspot + lantern lit state
  document.querySelectorAll('.stall-hotspot').forEach(b => {
    const on = b.dataset.cat === cat;
    b.setAttribute('aria-expanded', String(on));
  });
  CATS.forEach(c => {
    const lamp = document.getElementById('lamp-' + c);
    if (lamp) lamp.classList.toggle('is-lit', c === cat);
  });

  renderList(cat, list);
  hint.hidden = false;
  hint.textContent = LABELS[cat] + ' · pick a title:';
  clearCard();

  // move focus into the revealed list for keyboard users
  const first = list.querySelector('.stall-rec-btn');
  if (first) first.focus();
}

function renderList(cat, list) {
  list.innerHTML = '';
  (recs[cat] || []).forEach(item => {
    const li  = document.createElement('li');
    const btn = document.createElement('button');
    btn.className   = 'stall-rec-btn';
    btn.type        = 'button';
    btn.dataset.id  = item.id;
    btn.textContent = item.title;
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => showCard(item, btn, list));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

// ── card slide ──────────────────────────────────────────────────────

function showCard(item, triggerBtn, list) {
  list.querySelectorAll('.stall-rec-btn').forEach(b => {
    b.classList.remove('is-selected');
    b.setAttribute('aria-pressed', 'false');
  });
  if (triggerBtn) {
    triggerBtn.classList.add('is-selected');
    triggerBtn.setAttribute('aria-pressed', 'true');
    lastTrigger = triggerBtn;
  }

  const slot = document.getElementById('stall-card-slot');
  const prev = slot.querySelector('.stall-card.is-active');
  const card = buildCard(item);

  if (prev) {
    prev.classList.remove('is-active');
    prev.classList.add('is-exiting');
    prev.addEventListener('transitionend', () => prev.remove(), { once: true });
    setTimeout(() => {
      slot.appendChild(card);
      requestAnimationFrame(() => card.classList.add('is-active'));
    }, 60);
  } else {
    slot.appendChild(card);
    requestAnimationFrame(() => card.classList.add('is-active'));
  }
  slot.classList.add('has-card');
}

function clearCard() {
  const slot = document.getElementById('stall-card-slot');
  if (!slot) return;
  slot.innerHTML = '';
  slot.classList.remove('has-card');
  lastTrigger?.focus?.();
}

function buildCard(item) {
  const el = document.createElement('div');
  el.className = 'stall-card';
  let html =
    '<span class="stall-card-garnish" aria-hidden="true">' + (item.garnish || '◈') + '</span>' +
    '<p class="stall-card-title">' + escHtml(item.title) + '</p>' +
    '<p class="stall-card-write">' + escHtml(item.write) + '</p>';
  if (item.pairs) {
    html += '<p class="stall-card-pairs"><a href="projects.html">' + escHtml(item.pairs) + '</a></p>';
  }
  el.innerHTML = html;
  return el;
}

// ── chef's choice ───────────────────────────────────────────────────

function chefChoice(list, hint) {
  const all = CATS.flatMap(cat => (recs[cat] || []).map(item => ({ ...item, _cat: cat })));
  if (!all.length) return;
  const pick = all[(Math.random() * all.length) | 0];

  selectCat(pick._cat, list, hint);
  narrate("chef's choice…");

  setTimeout(() => {
    const btn = list.querySelector('.stall-rec-btn[data-id="' + pick.id + '"]');
    showCard(pick, btn, list);
    const chefBtn = document.querySelector('.chef-choice');
    if (chefBtn) {
      const bell = document.createElement('em');
      bell.className = 'stall-bell';
      bell.textContent = ' *ﾁﾘﾝ*';
      chefBtn.appendChild(bell);
      bell.addEventListener('animationend', () => bell.remove(), { once: true });
    }
  }, 60);
}

// ── util ────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
