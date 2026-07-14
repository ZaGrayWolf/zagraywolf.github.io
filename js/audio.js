/* audio.js — generative lo-fi for the alley (the hub only). Native Web Audio,
   no library, no files, nothing streamed — synthesised in-browser, so it boots
   the instant the toggle flips and weighs nothing. Three layers over an
   Am–F–C–G loop: sparse lo-fi drums, a warm sub-bass, and an FM-Rhodes lead,
   all under a synth-IR reverb + vinyl crackle. OFF by default, one HUD toggle,
   the choice persists to localStorage. Browsers block audio until a user
   gesture, so a saved "on" boots on the first interaction — and not at all
   under prefers-reduced-motion (we never auto-play when motion is reduced).

   MOOD is a config so the loop can later shift per chapter (the alley is the
   slow ~70 BPM hub); today only the alley runs it. */

const MOOD = {
  bpm: 70,
  master: 0.26,
  // one chord per bar, looped. bass = low root; tones = the Rhodes voicing.
  chords: [
    { bass: 110.00, tones: [220.00, 261.63, 329.63] }, // Am  (A2 · A3 C4 E4)
    { bass:  87.31, tones: [174.61, 220.00, 261.63] }, // F   (F2 · F3 A3 C4)
    { bass: 130.81, tones: [261.63, 329.63, 392.00] }, // C   (C3 · C4 E4 G4)
    { bass:  98.00, tones: [196.00, 246.94, 293.66] }, // G   (G2 · G3 B3 D4)
  ],
};

const AHEAD = 0.12;    // schedule this far ahead (s)
const LOOK  = 25;      // scheduler wake interval (ms)

let ctx = null;
let bus = null;        // warmth lowpass → master gain → destination
let masterGain = null;
let reverb = null;
let noiseBuf = null;
let crackleSrc = null;
let schedTimer = 0;
let step = 0, nextNoteTime = 0;
let started = false;

// ── buffers ──────────────────────────────────────────────────────────
function whiteNoise(sec){
  const b = ctx.createBuffer(1, (ctx.sampleRate * sec) | 0, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function crackleBuffer(sec){
  const b = ctx.createBuffer(1, (ctx.sampleRate * sec) | 0, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() < 0.0009) ? (Math.random() * 2 - 1) * 0.6 : 0;
  return b;
}
function impulse(sec, decay){
  const len = (ctx.sampleRate * sec) | 0;
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++){
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

// connect a voice's output to the dry bus + a wet send to reverb
function send(node, wet){
  node.connect(bus);
  if (wet > 0){ const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(reverb); }
}

// ── voices ───────────────────────────────────────────────────────────
function kick(t){
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g); send(g, 0.04);
  o.start(t); o.stop(t + 0.18);
}
function snare(t){
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.42, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  s.connect(bp); bp.connect(g); send(g, 0.22);
  s.start(t); s.stop(t + 0.2);
}
function hat(t, vel){
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  s.connect(hp); hp.connect(g); send(g, 0.12);
  s.start(t); s.stop(t + 0.09);
}
function bass(t, freq, dur){
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
  g.gain.setValueAtTime(0.5, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(lp); lp.connect(g); send(g, 0.05);
  o.start(t); o.stop(t + dur + 0.05);
}
// FM bell/Rhodes-ish tone
function rhodes(t, freq, dur, vel){
  const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq;
  const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * 2;
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(freq * 1.4, t);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.2 + 0.001, t + dur * 0.5);
  mod.connect(modGain); modGain.connect(car.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  car.connect(g); send(g, 0.42);
  car.start(t); mod.start(t);
  car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
}

// ── sequencer ────────────────────────────────────────────────────────
function scheduleStep(stp, time){
  const beat = 60 / MOOD.bpm;
  const swing = 0.055 * beat;
  const chord = MOOD.chords[Math.floor(stp / 16) % MOOD.chords.length];
  const s = stp % 16;

  if (s === 0 || s === 8) kick(time);                       // beats 1 & 3
  if (s === 4 || s === 12) snare(time);                     // backbeat
  if (s === 2 || s === 6 || s === 10 || s === 14)           // offbeat hats, swung
    hat(time + swing, 0.07 + Math.random() * 0.06);

  if (s === 0){
    bass(time, chord.bass, beat * 3.4);
    chord.tones.forEach((f, i) => rhodes(time + i * 0.014, f, 2.2, 0.10));   // soft block chord
  }
  if (s === 10){                                            // one sparse lead note up top
    const f = chord.tones[(stp >> 4) % chord.tones.length] * 2;
    rhodes(time + swing, f, 1.4, 0.12);
  }
}

function scheduler(){
  const sixteenth = (60 / MOOD.bpm) / 4;
  while (nextNoteTime < ctx.currentTime + AHEAD){
    scheduleStep(step, nextNoteTime);
    nextNoteTime += sixteenth;
    step++;
  }
}

// ── transport ────────────────────────────────────────────────────────
function buildGraph(){
  masterGain = ctx.createGain(); masterGain.gain.value = 0.0001;
  bus = ctx.createBiquadFilter(); bus.type = 'lowpass'; bus.frequency.value = 6500;   // warmth
  bus.connect(masterGain); masterGain.connect(ctx.destination);

  reverb = ctx.createConvolver(); reverb.buffer = impulse(2.6, 2.2);
  reverb.connect(bus);

  noiseBuf = whiteNoise(1);

  crackleSrc = ctx.createBufferSource();
  crackleSrc.buffer = crackleBuffer(4); crackleSrc.loop = true;
  const cg = ctx.createGain(); cg.gain.value = 0.06;
  const cbp = ctx.createBiquadFilter(); cbp.type = 'bandpass'; cbp.frequency.value = 2600; cbp.Q.value = 0.5;
  crackleSrc.connect(cbp); cbp.connect(cg); cg.connect(bus);
  crackleSrc.start();
}

export function start(){
  if (started) return;
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  ctx.resume();
  buildGraph();
  step = 0;
  nextNoteTime = ctx.currentTime + 0.1;
  schedTimer = setInterval(scheduler, LOOK);
  masterGain.gain.exponentialRampToValueAtTime(MOOD.master, ctx.currentTime + 1.5);   // fade in
  started = true;
}

export function stop(){
  if (!started || !ctx) return;
  started = false;
  clearInterval(schedTimer); schedTimer = 0;
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  try { crackleSrc.stop(t + 0.75); } catch {}
  setTimeout(() => { if (!started && ctx) ctx.suspend(); }, 800);
}

export function isPlaying(){ return started; }

// ── HUD toggle ───────────────────────────────────────────────────────
export function initAmbient(){
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saved = (() => { try { return localStorage.getItem('zgw.ambient') === 'on'; } catch { return false; } })();

  const btn = document.createElement('button');
  btn.className = 'hud-audio';
  btn.type = 'button';
  document.body.appendChild(btn);

  function label(on){
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Ambient sound on · click to mute' : 'Ambient sound off · click to play');
    btn.textContent = on ? '♪ ambient' : '♪ ambient ⏸';
  }
  label(saved && !reduced);

  btn.addEventListener('click', () => {
    if (isPlaying()){ stop(); label(false); try { localStorage.setItem('zgw.ambient', 'off'); } catch {} }
    else { start(); label(true); try { localStorage.setItem('zgw.ambient', 'on'); } catch {} }
  });

  // saved-on returns: browsers need a gesture, so boot on the first one.
  // Never auto-boot under reduced motion — a manual click still works.
  if (saved && !reduced){
    const boot = () => {
      removeEventListener('pointerdown', boot, true);
      removeEventListener('keydown', boot, true);
      if (!isPlaying()){ start(); label(true); }
    };
    addEventListener('pointerdown', boot, true);
    addEventListener('keydown', boot, true);
  }
}
