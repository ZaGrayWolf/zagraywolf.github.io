/* resume-preview.js — dwell-to-peek (C1).
   Hover the RESUME hatch for 2s and a small THUMBNAIL of the résumé fades in.
   Click it to open the full PDF in a new tab. Pure enhancement: the hatch link
   still navigates to CH.04.
   The peek is a pre-rendered PNG, NOT a live PDF iframe: Safari's native PDF
   viewer paints its zoom/download strip on a plugin layer that escapes
   overflow:hidden, and Chrome's #toolbar=0 is Chrome-only. An image has no
   chrome anywhere.

   To replace the résumé: drop the new file as data/Resume.pdf OR data/resume.pdf
   (resolveResumePdf() probes both), regenerate the thumbnail
     sips -s format png --resampleWidth 480 data/Resume.pdf --out assets/img/resume-thumb.png
   and bump ?v= site-wide. */

const DWELL = 2000;
const THUMB = '/assets/img/resume-thumb.png';   // root-absolute: works from 404.html too
// Pages is case-sensitive, so try both casings and use whichever exists.
// root-absolute so it resolves from 404.html too; ?v busts the cache on swap.
const CANDIDATES = ['/data/Resume.pdf', '/data/resume.pdf'];
const VER = '?v=4.40';

// resolve the real PDF url once (memoized). Shared by the peek + the download CTA.
let resolved;
export function resolveResumePdf(){
  return resolved ??= (async () => {
    for (const p of CANDIDATES){
      try { if ((await fetch(p + VER, { method:'HEAD' })).ok) return p + VER; } catch {}
    }
    return CANDIDATES[0] + VER; // probing failed (offline/file://) — assume canonical
  })();
}

export function initResumePreview(){
  // pointless on the resume page itself; hover is a no-op on touch
  if (document.body.dataset.page === 'resume') return;
  if (!window.matchMedia('(hover:hover)').matches) return;

  const links = document.querySelectorAll('.hud-resume');
  if (!links.length) return;

  let card, openTimer, hideTimer, armed = false;

  const show = async () => {
    if (card) return;
    const pdf = await resolveResumePdf();
    if (!armed || card) return;                    // pointer left during resolve, or already shown
    card = document.createElement('a');            // the whole thumbnail is the link to the full PDF
    card.className = 'resume-peek';
    card.href = pdf;
    card.target = '_blank';
    card.rel = 'noopener';
    card.setAttribute('aria-label', 'Open the full résumé (PDF, new tab)');
    card.innerHTML =
      '<img src="' + THUMB + VER + '" alt="" loading="lazy">' +
      '<span class="resume-peek-hint">OPEN ↗</span>';
    // staying on the card keeps it alive; leaving it closes
    card.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    card.addEventListener('mouseleave', hide);
    card.addEventListener('click', hide);
    document.body.appendChild(card);
    requestAnimationFrame(() => card.classList.add('is-on'));
  };

  const hide = () => {
    clearTimeout(openTimer);
    // brief grace so the pointer can travel from the hatch onto the card
    hideTimer = setTimeout(() => { if (card){ card.remove(); card = null; } }, 140);
  };

  links.forEach(a => {
    a.addEventListener('mouseenter', () => {
      clearTimeout(hideTimer);
      armed = true;
      resolveResumePdf();                          // prime the probe so it's ready by dwell's end
      openTimer = setTimeout(show, DWELL);
    });
    a.addEventListener('mouseleave', () => { armed = false; hide(); });
    a.addEventListener('blur', () => { armed = false; hide(); });
    a.addEventListener('click', () => { armed = false; clearTimeout(openTimer); clearTimeout(hideTimer); if (card){ card.remove(); card = null; } });
  });
}
