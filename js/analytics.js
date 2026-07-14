/* analytics.js — privacy-aware visit beacons for the weekly digest.
   Fire-and-forget events to a Google Apps Script Web App (the free backend;
   see analytics/SETUP.md for the 5-min deploy). No cookies, no third-party
   tracker, no hardened fingerprint — the visitor id is a random, clearable
   localStorage value. Honors Do-Not-Track. The whole site stays fully
   functional if this no-ops: ENDPOINT unset, DNT on, or beacon blocked.

   Other modules emit events through a decoupled bus (no imports, no globals):
     dispatchEvent(new CustomEvent('zgw:track', {detail:{event, props}}))
   so load order never matters and a missing analytics module is harmless. */

// ── config ────────────────────────────────────────────────────────────────
// Paste the Apps Script Web App /exec URL here after deploying (SETUP.md).
// Until then everything below silently no-ops.
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzge1rbf8cRerKuDCxLevIgEwydUuL89GFPDTwA1SIdAZjvHCX-f9Re8aK85JWuwBz3/exec';
// Public bot-deterrent that the Apps Script checks — NOT a secret (it ships in
// client source); it only filters drive-by POSTs, not a determined actor.
const TOKEN = 'zgw-2026';

const DNT =
  navigator.doNotTrack === '1' || window.doNotTrack === '1' ||
  navigator.msDoNotTrack === '1' || navigator.globalPrivacyControl === true;

let vid = '', sid = '', page = '', geo = {};
let started = 0, maxScroll = 0, sentDwell = false;

const uuid = () => {
  try { return crypto.randomUUID(); }
  catch { return 'v-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
};

function send(payload){
  if (!ENDPOINT) return;                         // not deployed yet → no-op
  try {
    const body = JSON.stringify({
      ...payload, token: TOKEN, vid, sid, page,
      ref: document.referrer || '', ts: new Date().toISOString(), ...geo,
    });
    if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, body);
    else fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, body });
  } catch { /* analytics must never break the page */ }
}

export function track(event, props = {}){
  if (DNT) return;
  send({ t: event, ...props });
}

// contact form: user-INITIATED (not tracking), so it sends even under DNT and
// even before initAnalytics enriches geo. Returns true if it reached the
// backend, false when dormant (no ENDPOINT) so the caller falls back to mailto.
export function submitContact({ name, email, message }){
  if (!ENDPOINT) return false;
  try {
    const body = JSON.stringify({
      t: 'contact', name, email, message,
      token: TOKEN, vid, sid,
      page: page || document.body.dataset.page || '',
      ref: document.referrer || '', ts: new Date().toISOString(), ...geo,
    });
    // real fetch (not sendBeacon): keepalive survives the tab, no ack needed
    fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, body });
    return true;
  } catch { return false; }
}

async function enrich(){
  try {
    const cached = sessionStorage.getItem('zgw.geo');
    if (cached){ geo = JSON.parse(cached); return; }
    const d = await (await fetch('https://ipwho.is/')).json();
    geo = {
      city: d.city || '', region: d.region || '', country: d.country || '',
      org: d.connection?.org || '', isp: d.connection?.isp || '',
    };
    sessionStorage.setItem('zgw.geo', JSON.stringify(geo));
  } catch { geo = {}; }
}

function device(){
  const ua = navigator.userAgent;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg/.test(ua) ? 'Edge' : /OPR|Opera/.test(ua) ? 'Opera'
    : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari' : 'other';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux' : 'other';
  return { device: mobile ? 'mobile' : 'desktop', browser, os,
           screen: innerWidth + 'x' + innerHeight, lang: navigator.language || '' };
}

export async function initAnalytics(){
  if (DNT) return;
  page = document.body.dataset.page || 'unknown';

  let hadVid = false;
  try { vid = localStorage.getItem('zgw.vid') || ''; hadVid = !!vid;
        if (!vid){ vid = uuid(); localStorage.setItem('zgw.vid', vid); } }
  catch { vid = uuid(); }
  try { sid = sessionStorage.getItem('zgw.sid') || '';
        if (!sid){ sid = uuid(); sessionStorage.setItem('zgw.sid', sid); } }
  catch { sid = uuid(); }

  // the event bus: any module can fire without importing/awaiting this file
  addEventListener('zgw:track', e => {
    try { track(e.detail.event, e.detail.props || {}); } catch {}
  });

  if (ENDPOINT) await enrich();                  // skip the IP lookup when dormant
  started = performance.now();
  track('pageview', { ...device(), returning: hadVid });

  // deepest scroll reached (a "how far did they read" signal)
  addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    const d = h > 0 ? Math.min(100, Math.round((scrollY / h) * 100)) : 100;
    if (d > maxScroll) maxScroll = d;
  }, { passive: true });

  // time-on-page, sent once when the tab hides or unloads
  const dwell = () => {
    if (sentDwell) return; sentDwell = true;
    track('dwell', { sec: Math.round((performance.now() - started) / 1000), scroll: maxScroll });
  };
  addEventListener('pagehide', dwell);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') dwell(); });

  // outbound + mail clicks (internal nav is logged by transition.js instead)
  addEventListener('click', e => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    let url; try { url = new URL(a.getAttribute('href'), location.href); } catch { return; }
    if (url.protocol === 'mailto:' || url.origin !== location.origin){
      track('outbound', { href: url.href, text: (a.textContent || '').trim().slice(0, 40) });
    }
  }, { capture: true });
}
