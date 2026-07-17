/* contact.js — the dawn "leave a note" form.
   JS enhancement over a plain mailto form: posts the note to the owner-run
   Apps Script backend (which emails it, see analytics/Code.gs). If that backend
   isn't deployed yet, we fall back to the mailto: the form already carries — so
   the button is never dead. Honeypot-only spam guard (ponytail: add a captcha
   only if real bots show up). */

import { submitContact } from './analytics.js?v=4.65';

const MAILTO = 'abhuday2656@gmail.com';

export function initContact(){
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = form.querySelector('#cf-status');

  // phones: the form sits at the foot of the alley; when a field takes focus the
  // on-screen keyboard covers it. Nudge the focused field into view once the
  // keyboard has opened. Touch-only (mirrors the stall chat input).
  if (matchMedia('(pointer:coarse)').matches){
    for (const field of form.querySelectorAll('input, textarea')){
      field.addEventListener('focus', () => {
        setTimeout(() => field.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
      });
    }
  }

  const say = (msg, ok) => { status.textContent = msg; status.classList.toggle('is-ok', !!ok); };

  const mailtoFallback = (name, email, message) => {
    const subject = 'Hello from the alley' + (name ? ' from ' + name : '');
    const body = message + (email ? '\n\n- ' + name + ' (' + email + ')' : '');
    location.href = 'mailto:' + MAILTO
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);
    say('opening your mail app…');
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    // NB: use elements.namedItem, not form.name — form.name is the <form>'s own
    // IDL name attribute (a string), it does NOT resolve to the "name" input.
    const val = n => (form.elements.namedItem(n)?.value || '').trim();
    if (val('website')) { say('sent, thanks!', true); form.reset(); return; } // honeypot: silently drop bots

    const name = val('name');
    const email = val('email');
    const message = val('message');
    if (!message) { say('add a message first.'); return; }

    // reached the backend? it'll email the note. Otherwise open the mail client.
    if (submitContact({ name, email, message })) {
      say('sent. I’ll get back to you, thanks!', true);
      form.reset();
    } else {
      mailtoFallback(name, email, message);
    }
  });
}
