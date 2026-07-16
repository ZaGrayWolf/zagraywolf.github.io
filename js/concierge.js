/* concierge.js — Casper's brain (C9). Pure, DOM-free intent matcher over the
   hand-authored knowledge base in data/casper.json. No LLM, no network beyond
   the one static fetch — every answer is decided in-browser from curated data.

   The matcher: normalize → tokenize (+light stems) → score each intent by
   keyword/phrase overlap → pick the best above a threshold, else fall back. */

let cache = null;

export async function loadCasper(){
  if (cache) return cache;
  const res = await fetch('data/casper.json');
  if (!res.ok) throw new Error('casper.json ' + res.status);
  cache = await res.json();
  return cache;
}

// ---- text prep ----------------------------------------------------------
function normalize(s){
  return String(s).toLowerCase()
    .replace(/[^\p{L}\p{N}\s+#]/gu, ' ')   // keep + and # so c++ / c# survive
    .replace(/\s+/g, ' ').trim();
}

// crude, dependency-free stem: shave a common English suffix
function stem(w){
  if (w.length <= 4) return w;
  return w.replace(/(ing|ed|es|s)$/,'');
}

function tokenize(norm){
  const raw = norm.split(' ').filter(Boolean);
  const set = new Set(raw);
  for (const w of raw) set.add(stem(w));
  return { norm, set };
}

// ---- scoring ------------------------------------------------------------
function scoreIntent(input, intent){
  let score = 0, maxKw = 0;
  for (const kwRaw of intent.keywords){
    const kw = kwRaw.toLowerCase();
    let w = 0;
    if (kw.includes(' ')){
      // multi-word phrase → high signal if the input contains it
      if (input.norm.includes(kw)) w = 2.0;
    } else if (input.set.has(kw)){
      w = 1.0;
    } else if (input.set.has(stem(kw))){
      w = 0.6;
    }
    if (w > maxKw) maxKw = w;
    score += w;
  }
  return { score, maxKw, specificity: 1 / intent.keywords.length };
}

const GREETINGS = new Set(['hi','hello','hey','yo','sup','hiya','greetings','oi']);

/* matchIntent(rawText, kb) → one of:
   { status:'greeting', intent }   greeting short-circuit
   { status:'match',    intent }   best intent cleared the threshold
   { status:'near',     intent }   almost — below threshold but a real partial
                                   signal; offer it as a "did you mean" guess
   { status:'fallback', config }   nothing confident — offer chips     */
export function matchIntent(rawText, kb){
  const input = tokenize(normalize(rawText));
  const intents = kb.intents || [];

  // greeting short-circuit: the whole input is just a greeting word or two
  if (input.set.size && [...input.set].every(t => GREETINGS.has(t))){
    const g = intents.find(i => i.id === 'greeting');
    if (g) return { status: 'greeting', intent: g };
  }

  const ranked = intents
    .map(i => ({ intent: i, ...scoreIntent(input, i) }))
    .sort((a, b) =>
      b.score - a.score ||
      b.maxKw - a.maxKw ||
      b.specificity - a.specificity);

  const best = ranked[0];
  const cfg = kb.config || {};
  const threshold = cfg.threshold || 1.0;
  if (best && best.score >= threshold) return { status: 'match', intent: best.intent };
  // near-miss: a partial hit (e.g. only a stemmed keyword landed) — guess rather
  // than dead-end. Needs a `label` on the intent to phrase the "did you mean".
  const nearFloor = cfg.nearThreshold || 0.6;
  if (best && best.score >= nearFloor && best.intent.label){
    return { status: 'near', intent: best.intent };
  }
  return { status: 'fallback', config: cfg };
}
