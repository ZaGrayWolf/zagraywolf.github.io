/* hud.js — minimap highlight (A7).
   The minimap itself is static HTML (keyboard-reachable without JS); this
   module only marks the current node. The HUD state line is now owned by
   js/narrator.js (the curator narrates the journey, not its internal state
   name), so the old curator.onState → state-line binding is gone. */

export function initHUD(){
  const page = document.body.dataset.page;
  document.querySelectorAll('.hud-map a').forEach(a => {
    if (a.dataset.node === page) a.setAttribute('aria-current', 'page');
  });
}
