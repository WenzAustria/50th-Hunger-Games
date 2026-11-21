'use strict';
/* Procedural sound effects (WebAudio) – no audio files needed */
const SFX = (() => {
  let ctx = null, master = null, muted = false, noiseBuf = null, windGain = null;
  const init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // ambient wind
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    windGain = ctx.createGain(); windGain.gain.value = 0.05;
    src.connect(f); f.connect(windGain); windGain.connect(master); src.start();
  };
  const tone = (freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) => {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  };
  const noise = (dur, vol = 0.2, f0 = 1200, f1 = null, type = 'lowpass', delay = 0) => {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  };
  // v = distance volume (0..1)
  const lib = {
    swing:   v => noise(0.18, 0.12 * v, 2500, 500, 'bandpass'),
    hit:     v => { noise(0.14, 0.35 * v, 900, 200); tone(120, 0.15, 'sine', 0.35 * v, 50); },
    blood:   v => noise(0.22, 0.18 * v, 700, 150, 'bandpass', 0.03),
    arrow:   v => { noise(0.25, 0.16 * v, 3200, 900, 'bandpass'); tone(220, 0.12, 'triangle', 0.1 * v, 90); },
    dart:    v => noise(0.12, 0.1 * v, 4000, 2000, 'highpass'),
    sling:   v => { noise(0.14, 0.12 * v, 1800, 400, 'bandpass'); },
    thud:    v => tone(90, 0.12, 'sine', 0.25 * v, 40),
    pickup:  v => { tone(660, 0.1, 'triangle', 0.18 * v); tone(990, 0.14, 'triangle', 0.16 * v, null, 0.07); },
    drink:   v => { for (let i = 0; i < 3; i++) tone(300 + Math.random() * 200, 0.08, 'sine', 0.12 * v, 600, i * 0.09); },
    eat:     v => { for (let i = 0; i < 3; i++) noise(0.06, 0.2 * v, 1800, 800, 'bandpass', i * 0.1); },
    heal:    v => { tone(520, 0.2, 'sine', 0.2 * v); tone(780, 0.3, 'sine', 0.18 * v, null, 0.12); },
    dash:    v => noise(0.2, 0.15 * v, 1800, 300, 'bandpass'),
    hurt:    v => tone(180, 0.2, 'sawtooth', 0.2 * v, 70),
    cannon:  v => { tone(90, 1.4, 'sine', 0.7 * v, 28); noise(1.2, 0.55 * v, 700, 60); tone(55, 1.8, 'sine', 0.5 * v, 24, 0.05); },
    boom:    v => { tone(70, 1.0, 'sine', 0.6 * v, 25); noise(0.9, 0.5 * v, 1400, 80); },
    rumble:  v => { noise(3.2, 0.45 * v, 200, 60); tone(42, 3.2, 'sawtooth', 0.12 * v, 28); },
    tick:    v => tone(880, 0.12, 'square', 0.12 * v),
    tickHi:  v => tone(1320, 0.3, 'square', 0.18 * v),
    gong:    v => { tone(110, 2.4, 'sine', 0.5 * v); tone(221, 2.0, 'sine', 0.25 * v); tone(331, 1.6, 'sine', 0.15 * v); noise(0.3, 0.2 * v, 3000, 800); },
    zone:    v => { tone(300, 0.6, 'sawtooth', 0.14 * v, 150); tone(310, 0.6, 'sawtooth', 0.14 * v, 150, 0.7); },
    alert:   v => { tone(520, 0.18, 'square', 0.12 * v); tone(520, 0.18, 'square', 0.12 * v, null, 0.25); },
    platform:v => { tone(60, 5.5, 'sawtooth', 0.12 * v, 110); noise(5.5, 0.12 * v, 200, 700); },
    toxic:   v => noise(0.5, 0.08 * v, 900, 300, 'bandpass'),
    victor:  v => {
      // short brass-like fanfare
      const seq = [[392, 0], [392, 0.25], [523, 0.5], [659, 0.9], [784, 1.3], [659, 1.7], [784, 2.1]];
      seq.forEach(([f, t]) => { tone(f, 0.5, 'sawtooth', 0.14 * v, null, t); tone(f / 2, 0.5, 'triangle', 0.12 * v, null, t); });
    },
    anthem:  v => {
      // slow, solemn memorial tune
      const seq = [[294, 0], [349, 0.7], [440, 1.4], [392, 2.1], [349, 2.9], [294, 3.6], [330, 4.5], [294, 5.3]];
      seq.forEach(([f, t]) => { tone(f, 0.9, 'sawtooth', 0.09 * v, null, t); tone(f / 2, 1.0, 'sine', 0.12 * v, null, t); });
    }
  };
  return {
    init,
    play(name, vol = 1) { if (!ctx || muted) return; const f = lib[name]; if (f) f(vol); },
    at(name, dist, ref = 40) { const v = Math.max(0, 1 - dist / ref); if (v > 0.02) this.play(name, v); },
    toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; return muted; },
    isMuted: () => muted,
    wind(v) { if (windGain) windGain.gain.value = v; }
  };
})();
