// 音效引擎：全部用 Web Audio 实时合成（振荡器 + 噪声 + 滤波 + 包络），没有任何音频文件。
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = true;
    try { this.enabled = localStorage.getItem('toon-sfx') !== 'off'; this.musicOn = localStorage.getItem('toon-music') !== 'off'; } catch (e) { /* 隐私模式下忽略 */ }
    this.last = {};
    this.voices = 0;
    this.listener = null; // () => {x, z}，用于按距离衰减
    this.musicMode = null;
  }
  // 浏览器要求用户交互后才能出声，所以第一次点击/按键时再创建
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.enabled ? 1.4 : 0;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicOn ? 0.07 : 0; this.musicBus.connect(this.master);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.musicMode) this.startMusic(this.musicMode, true);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('toon-sfx', this.enabled ? 'on' : 'off'); } catch (e) { /* 忽略 */ }
    if (this.master) this.master.gain.value = this.enabled ? 1.4 : 0;
    return this.enabled;
  }
  toggleMusic() {
    this.musicOn = !this.musicOn;
    try { localStorage.setItem('toon-music', this.musicOn ? 'on' : 'off'); } catch (e) { /* 忽略 */ }
    if (this.musicBus) this.musicBus.gain.value = this.musicOn ? 0.07 : 0;
    return this.musicOn;
  }
  play(name, pos, vol = 1) {
    const c = this.ctx;
    if (!this.enabled || !c || c.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = c.currentTime;
    if (this.last[name] && now - this.last[name] < (THROTTLE[name] ?? 0.045)) return;
    if (this.voices > 28) return;
    if (pos && this.listener) {
      const l = this.listener();
      const d = Math.hypot(pos.x - l.x, pos.z - l.z);
      if (d > 42) return;
      vol *= Math.max(0.12, 1 - d / 42);
    }
    this.last[name] = now;
    this.voices++;
    setTimeout(() => this.voices--, 400);
    fn(this, now + 0.005, vol);
  }

  // ---------- 基础音色 ----------
  env(t, dur, vol, attack = 0.005, dest) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest || this.sfxBus);
    return g;
  }
  tone(t, type, f0, f1, dur, vol, o = {}) {
    const c = this.ctx, osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * (o.slide ?? 1));
    let node = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    if (o.vib) {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = o.vib; lg.gain.value = f0 * (o.vibAmt ?? 0.03);
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    node.connect(this.env(t, dur, vol, o.attack, o.dest));
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  noise(t, dur, vol, o = {}) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = dur > 0.9;
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    f.Q.value = o.q ?? 1;
    src.connect(f); f.connect(this.env(t, dur, vol, o.attack, o.dest));
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  notes(t, list, type, step, dur, vol) { list.forEach((n, i) => this.tone(t + i * step, type, NOTE(n), 0, dur, vol)); }

  // ---------- 背景音乐：轻快的五声音阶拨弦小循环 ----------
  startMusic(mode, force = false) {
    if (this.musicMode === mode && !force && this.musicTimer) return;
    this.musicMode = mode;
    if (!this.ctx) return;
    clearInterval(this.musicTimer);
    const c = this.ctx;
    const bpm = mode === 'game' ? 104 : 88, beat = 60 / bpm / 2;
    // 和弦进行：C - Am - F - G（五声音阶旋律）
    const chords = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62]];
    const scale = [72, 74, 76, 79, 81, 84, 86, 88];
    let step = 0, next = c.currentTime + 0.1, mel = 3;
    this.musicTimer = setInterval(() => {
      if (!this.musicOn || c.state !== 'running') { next = c.currentTime + 0.1; return; }
      while (next < c.currentTime + 0.3) {
        const bar = Math.floor(step / 8) % 4, ch = chords[bar], k = step % 8;
        const dest = this.musicBus;
        if (k === 0) this.tone(next, 'sine', NOTE(ch[0] - 12), 0, beat * 7, 0.5, { dest, attack: 0.02 });
        if (k === 4) this.tone(next, 'sine', NOTE(ch[0] - 5), 0, beat * 3, 0.3, { dest, attack: 0.02 });
        this.tone(next, 'triangle', NOTE(ch[1 + (k % 3)]), 0, beat * 1.6, 0.18, { dest });
        if ((k % 2 === 0 && Math.random() < 0.75) || Math.random() < 0.2) {
          mel = Math.max(0, Math.min(scale.length - 1, mel + Math.floor(Math.random() * 5) - 2));
          this.tone(next, 'square', NOTE(scale[mel]), 0, beat * 1.4, 0.07, { dest, lp: 2200 });
        }
        if (mode === 'game' && k % 2 === 1) this.noise(next, 0.05, 0.1, { type: 'highpass', f: 7000, dest });
        next += beat; step++;
      }
    }, 100);
  }
}

const THROTTLE = { hit: 0.06, zap: 0.06, minionDie: 0.05, coin: 0.05, swing: 0.05, pop: 0.12, boom: 0.1, step: 0.2 };

// ---------- 音效配方 ----------
const SFX = {
  click(s, t, v) { s.tone(t, 'triangle', 1400, 900, 0.05, 0.5 * v); },
  pop(s, t, v) { s.tone(t, 'sine', 500, 1100, 0.09, 0.35 * v); s.tone(t + 0.05, 'triangle', 1300, 1600, 0.08, 0.15 * v); },
  swing(s, t, v) { s.noise(t, 0.16, 0.9 * v, { f: 2600, f1: 700, q: 1.5 }); },
  whoosh(s, t, v) { s.noise(t, 0.32, 0.6 * v, { f: 500, f1: 2800, q: 2, attack: 0.08 }); },
  hit(s, t, v) { s.noise(t, 0.08, 0.5 * v, { type: 'lowpass', f: 1500 }); s.tone(t, 'triangle', 190, 70, 0.1, 0.4 * v); },
  zap(s, t, v) { s.tone(t, 'sawtooth', 900, 300, 0.1, 0.18 * v, { lp: 3000 }); s.noise(t, 0.06, 0.25 * v, { type: 'highpass', f: 3000 }); },
  hitHeavy(s, t, v) { s.noise(t, 0.2, 0.7 * v, { type: 'lowpass', f: 900 }); s.tone(t, 'square', 130, 40, 0.22, 0.3 * v, { lp: 800 }); },
  arrow(s, t, v) { s.tone(t, 'triangle', 260, 180, 0.14, 0.35 * v); s.noise(t + 0.02, 0.14, 0.35 * v, { type: 'highpass', f: 2500, f1: 6000 }); },
  gun(s, t, v) { s.noise(t, 0.22, 0.9 * v, { type: 'lowpass', f: 2600, f1: 300 }); s.tone(t, 'square', 110, 40, 0.14, 0.4 * v, { lp: 900 }); },
  orb(s, t, v) { s.tone(t, 'sine', 420, 880, 0.3, 0.3 * v, { vib: 18, vibAmt: 0.06 }); s.tone(t + 0.05, 'triangle', 1200, 1800, 0.18, 0.1 * v); },
  magic(s, t, v) { s.tone(t, 'sine', 600, 1300, 0.28, 0.28 * v); s.notes(t + 0.04, [88, 91, 95], 'triangle', 0.05, 0.12, 0.12 * v); },
  fire(s, t, v) { s.noise(t, 0.45, 0.8 * v, { type: 'lowpass', f: 1400, f1: 300, attack: 0.03 }); s.tone(t, 'sawtooth', 90, 55, 0.4, 0.2 * v, { lp: 500 }); },
  boom(s, t, v) { s.noise(t, 0.7, 1.0 * v, { type: 'lowpass', f: 600, f1: 80 }); s.tone(t, 'sine', 90, 30, 0.55, 0.8 * v); },
  slam(s, t, v) { s.noise(t, 0.4, 0.8 * v, { type: 'lowpass', f: 400, f1: 90 }); s.tone(t, 'sine', 70, 35, 0.35, 0.7 * v); },
  ice(s, t, v) { s.notes(t, [96, 100, 103, 108], 'triangle', 0.03, 0.2, 0.12 * v); s.noise(t, 0.3, 0.3 * v, { type: 'highpass', f: 5000 }); },
  heal(s, t, v) { s.notes(t, [72, 76, 79, 84], 'sine', 0.07, 0.3, 0.2 * v); },
  shield(s, t, v) { s.tone(t, 'sine', 300, 620, 0.35, 0.3 * v, { vib: 12 }); s.tone(t, 'triangle', 600, 1240, 0.3, 0.1 * v); },
  laser(s, t, v) { s.tone(t, 'sawtooth', 180, 1400, 0.9, 0.3 * v, { lp: 2500, attack: 0.05 }); s.noise(t, 0.9, 0.3 * v, { f: 3000, q: 0.7 }); },
  thunder(s, t, v) { s.noise(t, 0.35, 0.8 * v, { type: 'bandpass', f: 1800, q: 0.6 }); s.tone(t, 'square', 70, 40, 0.3, 0.2 * v, { lp: 600 }); },
  charm(s, t, v) { s.tone(t, 'sine', 700, 1050, 0.15, 0.3 * v); s.tone(t + 0.12, 'sine', 900, 1400, 0.2, 0.3 * v); },
  roar(s, t, v) { s.tone(t, 'sawtooth', 110, 70, 0.8, 0.35 * v, { lp: 700, vib: 9, vibAmt: 0.08, attack: 0.05 }); s.noise(t, 0.7, 0.5 * v, { type: 'lowpass', f: 700 }); },
  stun(s, t, v) { s.notes(t, [96, 100], 'triangle', 0.08, 0.15, 0.18 * v); },
  flash(s, t, v) { s.noise(t, 0.2, 0.5 * v, { type: 'highpass', f: 2000, f1: 8000 }); s.tone(t, 'sine', 1200, 2600, 0.15, 0.2 * v); },
  recall(s, t, v) {
    // 4 秒逐渐升高的嗡鸣 + 每拍一声铃音
    s.tone(t, 'sine', 220, 520, 4, 0.22 * v, { vib: 6, vibAmt: 0.04, attack: 0.4 });
    s.tone(t, 'triangle', 330, 780, 4, 0.08 * v, { attack: 0.8 });
    s.noise(t, 4, 0.08 * v, { type: 'highpass', f: 5000, f1: 9000, attack: 1 });
    [0, 1, 2, 3].forEach(i => s.notes(t + i * 0.95, [84 + i * 2, 91 + i * 2], 'sine', 0.06, 0.4, 0.1 * v));
  },
  recallDone(s, t, v) { s.noise(t, 0.4, 0.5 * v, { type: 'highpass', f: 1500, f1: 7000 }); s.notes(t, [72, 79, 84, 91, 96], 'triangle', 0.05, 0.35, 0.16 * v); s.tone(t, 'sine', 180, 60, 0.5, 0.4 * v); },
  levelup(s, t, v) { s.notes(t, [72, 76, 79, 84, 88], 'square', 0.07, 0.18, 0.12 * v); s.notes(t + 0.35, [91, 96], 'triangle', 0.05, 0.3, 0.15 * v); },
  coin(s, t, v) { s.tone(t, 'square', 1318, 0, 0.06, 0.1 * v, { lp: 5000 }); s.tone(t + 0.06, 'square', 1976, 0, 0.18, 0.1 * v, { lp: 5000 }); },
  buy(s, t, v) { SFX.coin(s, t, v); s.noise(t + 0.1, 0.25, 0.3 * v, { type: 'highpass', f: 6000 }); s.notes(t + 0.12, [84, 88, 91], 'triangle', 0.05, 0.15, 0.15 * v); },
  sell(s, t, v) { s.notes(t, [91, 84], 'square', 0.08, 0.12, 0.08 * v); },
  error(s, t, v) { s.tone(t, 'square', 180, 170, 0.09, 0.15 * v, { lp: 1200 }); s.tone(t + 0.12, 'square', 150, 140, 0.12, 0.15 * v, { lp: 1200 }); },
  death(s, t, v) { s.tone(t, 'sawtooth', 420, 70, 0.7, 0.25 * v, { lp: 1500 }); s.noise(t, 0.5, 0.3 * v, { type: 'lowpass', f: 800 }); },
  minionDie(s, t, v) { s.tone(t, 'sine', 900, 200, 0.12, 0.2 * v); },
  tower(s, t, v) { s.tone(t, 'sine', 220, 900, 0.18, 0.3 * v); s.noise(t, 0.15, 0.3 * v, { f: 2000, q: 3 }); },
  crumble(s, t, v) { s.noise(t, 1.3, 0.9 * v, { type: 'lowpass', f: 500, f1: 100 }); SFX.boom(s, t, v); },
  kill(s, t, v) { s.notes(t, [67, 74, 79], 'sawtooth', 0.09, 0.25, 0.1 * v); },
  victory(s, t, v) { s.notes(t, [72, 76, 79, 84, 79, 84, 88], 'square', 0.14, 0.3, 0.12 * v); },
  defeat(s, t, v) { s.notes(t, [72, 70, 67, 63, 60], 'triangle', 0.22, 0.4, 0.2 * v); },
  start(s, t, v) { SFX.whoosh(s, t, v); s.notes(t + 0.1, [60, 67, 72, 79], 'square', 0.08, 0.25, 0.1 * v); },
};
