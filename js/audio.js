// Soundtrack and SFX, generated live with the Web Audio API. Everything here is
// original and synthesised at runtime — no audio files, nothing to license.
// Retro-arcade space loop: 8 bars in A minor (Am F C G), square-wave arpeggio,
// detuned saw pads, a vibrato lead with echo, soft kick + hat. Starts on the
// first click (browser autoplay rules). Toggle persists in localStorage.
window.GameAudio = (function () {
  const KEY = 'spaceguessr.audio';
  const BPM = 108, STEP = 60 / BPM / 4, LOOP = 16 * 8;
  const hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  const CHORDS = [
    { bass: 45, tones: [57, 60, 64] },   // Am
    { bass: 41, tones: [53, 57, 60] },   // F
    { bass: 48, tones: [55, 60, 64] },   // C
    { bass: 43, tones: [55, 59, 62] }    // G
  ];
  const BASS_STEPS = [0, 3, 6, 8, 11, 14];
  const ARP = [0, 1, 2, 1, 0, 2, 1, 2, 0, 2, 1, 0, 2, 1, 2, 1];
  const LEAD = [ // [step, midi, length in steps] over 8 bars
    [0, 76, 3], [4, 79, 2], [6, 81, 4], [12, 76, 2], [16, 74, 4], [22, 72, 2], [24, 76, 6],
    [32, 81, 3], [36, 84, 2], [38, 81, 4], [44, 79, 2], [48, 76, 4], [54, 74, 2], [56, 72, 8],
    [64, 76, 3], [68, 79, 2], [70, 81, 4], [76, 84, 2], [80, 83, 4], [86, 81, 2], [88, 79, 6],
    [96, 81, 3], [100, 79, 2], [102, 76, 4], [108, 74, 2], [112, 72, 4], [118, 74, 2], [120, 76, 8]
  ];

  let ctx = null, master, musicBus, sfxBus, verb, echo, noiseBuf;
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* private mode */ }
  let playing = false, timer = null, nextT = 0, step = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = enabled ? 1 : 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.knee.value = 12;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(master);
    // reverb: exponentially decaying noise impulse
    const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb = ctx.createConvolver(); verb.buffer = ir;
    const verbGain = ctx.createGain(); verbGain.gain.value = 0.35; verb.connect(verbGain); verbGain.connect(master);
    // dotted-eighth echo for the lead
    echo = ctx.createDelay(1); echo.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.38; echo.connect(fb); fb.connect(echo);
    const echoOut = ctx.createGain(); echoOut.gain.value = 0.4; echo.connect(echoOut); echoOut.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // Generic voice: oscillator -> optional filter -> envelope gain -> dest
  function tone(o) {
    const osc = ctx.createOscillator(); osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, o.t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, o.t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    let node = osc;
    if (o.filter) { const f = ctx.createBiquadFilter(); f.type = o.filter.type || 'lowpass'; f.frequency.value = o.filter.freq; f.Q.value = o.filter.q || 0.8; osc.connect(f); node = f; }
    const g = ctx.createGain();
    const attack = o.attack || 0.006, rel = o.release || Math.max(0.03, o.dur * 0.5);
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(o.gain, o.t + attack);
    g.gain.setTargetAtTime(0.0001, o.t + o.dur, rel / 3);
    node.connect(g);
    (o.dest || sfxBus) && g.connect(o.dest || sfxBus);
    if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; g.connect(s); s.connect(verb); }
    if (o.echo) { const s = ctx.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(echo); }
    if (o.vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.6; lg.gain.value = o.vibrato; lfo.connect(lg); lg.connect(osc.detune);
      lfo.start(o.t); lfo.stop(o.t + o.dur + rel + 0.2);
    }
    osc.start(o.t); osc.stop(o.t + o.dur + rel + 0.3);
  }
  function noise(o) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.freq, o.t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, o.t + o.dur);
    f.Q.value = o.q || 0.7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(o.gain, o.t + (o.attack || 0.005));
    g.gain.setTargetAtTime(0.0001, o.t + o.dur, (o.release || 0.03) / 3);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(o.t); src.stop(o.t + o.dur + (o.release || 0.03) + 0.2);
  }

  // ---- sequencer ----
  function playStep(s, t) {
    const bar = Math.floor(s / 16) % 4, i = s % 16, ch = CHORDS[bar];
    if (i === 0 || i === 8) tone({ type: 'sine', freq: 140, glide: 42, t: t, dur: 0.16, gain: 0.5, dest: musicBus });              // kick
    if (i % 4 === 2) noise({ freq: 6500, t: t, dur: 0.03, gain: 0.08, dest: musicBus });                                             // hat
    if (BASS_STEPS.indexOf(i) >= 0) tone({ type: 'square', freq: hz(ch.bass), t: t, dur: STEP * 1.6, gain: 0.16, filter: { freq: 520 }, dest: musicBus });
    const arpNote = ch.tones[ARP[i] % 3] + (i % 8 >= 4 ? 12 : 0);
    tone({ type: 'square', freq: hz(arpNote), t: t, dur: STEP * 0.55, gain: 0.07, filter: { freq: 2600 }, dest: musicBus, send: 0.25 }); // arpeggio
    if (i === 0) ch.tones.forEach(function (m) {                                                                                          // pad
      [-7, 7].forEach(function (d) { tone({ type: 'sawtooth', freq: hz(m), detune: d, t: t, dur: STEP * 13, gain: 0.028, attack: 0.5, release: 0.7, filter: { freq: 900, q: 0.6 }, dest: musicBus, send: 0.5 }); });
    });
    LEAD.forEach(function (n) {
      if (n[0] === s) tone({ type: 'triangle', freq: hz(n[1]), t: t, dur: STEP * n[2] * 0.9, gain: 0.17, attack: 0.02, release: 0.12, vibrato: 7, dest: musicBus, echo: 0.5, send: 0.3 });
    });
  }
  function schedule() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.25) { playStep(step, nextT); nextT += STEP; step = (step + 1) % LOOP; }
  }
  function startMusic() {
    if (!ensure() || playing) return;
    playing = true; step = 0; nextT = ctx.currentTime + 0.08;
    timer = setInterval(schedule, 60);
  }
  function stopMusic() { playing = false; clearInterval(timer); timer = null; }

  // ---- SFX ----
  const SFX = {
    select: function () { tone({ type: 'square', freq: 660, glide: 990, t: now(), dur: 0.05, gain: 0.12 }); },
    pin: function () { tone({ type: 'sine', freq: 880, glide: 260, t: now(), dur: 0.12, gain: 0.22 }); },
    blip: function () { tone({ type: 'square', freq: 520, t: now(), dur: 0.04, gain: 0.1 }); },
    hint: function () { tone({ type: 'triangle', freq: 523, t: now(), dur: 0.09, gain: 0.18 }); tone({ type: 'triangle', freq: 659, t: now() + 0.1, dur: 0.14, gain: 0.18 }); },
    tick: function () { tone({ type: 'square', freq: 1400, t: now(), dur: 0.012, gain: 0.05 }); },
    launch: function () {
      const t = now();
      noise({ type: 'bandpass', freq: 180, sweep: 3200, q: 1.2, t: t, dur: 0.75, gain: 0.35, release: 0.2 });
      tone({ type: 'sawtooth', freq: 110, glide: 1100, t: t, dur: 0.7, gain: 0.12, filter: { freq: 1800 }, send: 0.3 });
    },
    land: function (points) {
      const t = now(), big = points >= 4000;
      const chord = big ? [69, 73, 76, 81] : [69, 72, 76, 79];
      chord.forEach(function (m, i) { tone({ type: 'square', freq: hz(m), t: t + i * 0.045, dur: 0.28, gain: 0.11, filter: { freq: 3000 }, send: 0.4 }); });
      [81, 84, 88, 93, 96].forEach(function (m, i) { tone({ type: 'triangle', freq: hz(m), t: t + 0.22 + i * 0.07, dur: 0.12, gain: 0.14, send: 0.4, echo: 0.3 }); });
      noise({ type: 'highpass', freq: 3000, t: t, dur: 0.12, gain: 0.18, release: 0.15 });
    },
    fail: function () {
      const t = now();
      tone({ type: 'sawtooth', freq: 300, glide: 70, t: t, dur: 0.6, gain: 0.16, filter: { freq: 1200 }, vibrato: 40, send: 0.3 });
      tone({ type: 'square', freq: 150, glide: 55, t: t + 0.1, dur: 0.5, gain: 0.08, filter: { freq: 800 } });
    },
    fanfare: function (total) {
      const t = now(), seq = total >= 15000 ? [69, 73, 76, 81, 76, 81, 88] : [69, 72, 76, 79, 81, 84];
      seq.forEach(function (m, i) { tone({ type: 'square', freq: hz(m), t: t + i * 0.11, dur: 0.16, gain: 0.13, filter: { freq: 3200 }, send: 0.45, echo: 0.35 }); });
      tone({ type: 'sawtooth', freq: hz(45), t: t, dur: 1.2, gain: 0.08, filter: { freq: 500 }, send: 0.3 });
    }
  };
  function now() { return ctx.currentTime + 0.001; }

  // ---- public ----
  function start() { if (!enabled) return; if (ensure()) startMusic(); }
  function sfx(name, arg) {
    if (!enabled || !ctx || !SFX[name]) return;
    try { SFX[name](arg); } catch (e) { /* never let audio break the game */ }
  }
  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
    if (enabled) { if (ensure()) { master.gain.setTargetAtTime(1, ctx.currentTime, 0.05); startMusic(); } }
    else if (ctx) { master.gain.setTargetAtTime(0, ctx.currentTime, 0.05); stopMusic(); }
  }
  function toggle() { setEnabled(!enabled); return enabled; }
  function isEnabled() { return enabled; }

  return { start: start, sfx: sfx, toggle: toggle, setEnabled: setEnabled, isEnabled: isEnabled, stopMusic: stopMusic };
})();
