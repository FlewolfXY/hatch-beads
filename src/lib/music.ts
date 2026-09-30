/**
 * 背景音乐：现场合成，不用音频文件。
 * 木琴主旋律 + 拨弦贝斯 + 反拍和弦 + 豆子沙锤，108 BPM 带一点摇摆，16 小节一轮，每轮有变化。
 */

export interface Music {
  start(): void;
  stop(now?: boolean): void;
  duck(on: boolean): void;
  /** 一次排好前 seconds 秒，给 OfflineAudioContext 导出试听用 */
  render(seconds: number): void;
}

const BPM = 108;
const EIGHTH = 60 / BPM / 2;
const SWING = 0.16;
const VOLUME = 0.55;

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Chord = { root: number; stab: number[] };
const C: Chord = { root: 48, stab: [64, 67, 72] };
const Am: Chord = { root: 45, stab: [64, 69, 72] };
const Dm: Chord = { root: 50, stab: [65, 69, 74] };
const Dm7: Chord = { root: 50, stab: [65, 69, 72] };
const G: Chord = { root: 43, stab: [62, 67, 71] };
const G7: Chord = { root: 43, stab: [62, 65, 71] };
const A7: Chord = { root: 45, stab: [61, 67, 69] };
const F: Chord = { root: 41, stab: [65, 69, 72] };
const Fm: Chord = { root: 41, stab: [65, 68, 72] };
const CHORDS: Chord[] = [C, Am, Dm, G, C, A7, Dm7, G7, F, Fm, C, A7, Dm, G, C, G7];

// 每小节 8 个八分音符：[位置, 音高, 长度]
type Note = [number, number, number];
const MELODY: Note[][] = [
  [[0, 76, 1], [1, 79, 1], [3, 84, 1], [4, 83, 1], [5, 79, 2]],
  [[0, 81, 1], [2, 76, 1], [3, 72, 1], [6, 76, 1], [7, 74, 1]],
  [[0, 77, 1], [1, 81, 1], [3, 86, 1], [4, 84, 1], [5, 81, 2]],
  [[0, 83, 1], [2, 79, 1], [3, 74, 1], [4, 77, 1], [5, 76, 1], [6, 74, 2]],
  [[0, 76, 1], [1, 79, 1], [3, 84, 1], [4, 83, 1], [5, 79, 2]],
  [[0, 85, 1], [1, 81, 1], [3, 79, 1], [4, 76, 1], [5, 73, 1], [6, 76, 2]],
  [[0, 77, 1], [1, 76, 1], [2, 74, 1], [4, 81, 2], [6, 84, 1], [7, 81, 1]],
  [[0, 79, 1], [2, 77, 1], [3, 74, 1], [4, 71, 1], [5, 74, 1], [6, 79, 1]],
  [[0, 81, 2], [2, 84, 1], [3, 81, 1], [4, 77, 2], [6, 79, 1], [7, 81, 1]],
  [[0, 80, 2], [2, 77, 1], [3, 72, 1], [4, 80, 1], [5, 79, 1], [6, 77, 2]],
  [[0, 79, 1], [1, 76, 1], [2, 72, 1], [4, 76, 1], [5, 79, 1], [6, 84, 2]],
  [[0, 85, 1], [1, 88, 1], [3, 85, 1], [4, 81, 2], [6, 79, 1], [7, 76, 1]],
  [[0, 77, 1], [1, 74, 1], [3, 81, 1], [4, 77, 1], [5, 86, 2], [7, 84, 1]],
  [[0, 83, 1], [1, 81, 1], [2, 79, 1], [3, 77, 1], [4, 74, 2], [6, 71, 1], [7, 74, 1]],
  [[0, 72, 1], [1, 76, 1], [2, 79, 1], [3, 84, 1], [4, 88, 2]],
  [[6, 79, 1], [7, 83, 1]],
];
const BARS = MELODY.length;
const TWINKLE = [84, 86, 88, 91, 93, 96];

export function createMusic(ctx: AudioContext, out: AudioNode): Music {
  const bus = ctx.createGain();
  bus.gain.value = 0;
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 6500;
  bus.connect(soft).connect(out);

  // 一点点回声，让木琴有空间感
  const echo = ctx.createDelay(1);
  echo.delayTime.value = EIGHTH * 1.5;
  const fb = ctx.createGain();
  fb.gain.value = 0.24;
  const wet = ctx.createGain();
  wet.gain.value = 0.2;
  echo.connect(fb).connect(echo);
  echo.connect(wet).connect(bus);

  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  let seed = 20260930;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return (seed >>> 8) / 16777216;
  };

  const env = (g: GainNode, t: number, peak: number, attack: number, dur: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };

  /** 木琴：基音 + 一个很快消失的高泛音 */
  const mallet = (m: number, t: number, dur: number, vel: number, send = 0.5) => {
    const f = hz(m);
    const g = ctx.createGain();
    env(g, t, 0.16 * vel, 0.004, dur);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g);
    const g2 = ctx.createGain();
    env(g2, t, 0.05 * vel, 0.002, 0.09);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 4.01;
    o2.connect(g2).connect(g);
    g.connect(bus);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(echo);
    }
    for (const x of [o, o2]) {
      x.start(t);
      x.stop(t + dur + 0.05);
    }
  };

  /** 钟琴：高一个八度，亮一点、轻一点 */
  const glock = (m: number, t: number, vel: number) => {
    const g = ctx.createGain();
    env(g, t, 0.045 * vel, 0.002, 0.7);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(m + 12);
    o.connect(g).connect(bus);
    const s = ctx.createGain();
    s.gain.value = 0.6;
    g.connect(s).connect(echo);
    o.start(t);
    o.stop(t + 0.75);
  };

  /** 拨弦贝斯，外加高八度的影子，手机小喇叭也听得见 */
  const bass = (m: number, t: number, vel: number) => {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    const g = ctx.createGain();
    env(g, t, 0.24 * vel, 0.008, 0.32);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(m);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = hz(m + 12);
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    o.connect(f);
    o2.connect(g2).connect(f);
    f.connect(g).connect(bus);
    for (const x of [o, o2]) {
      x.start(t);
      x.stop(t + 0.36);
    }
  };

  /** 反拍上轻轻一下的和弦 */
  const stab = (notes: number[], t: number, vel: number) => {
    for (const m of notes) {
      const g = ctx.createGain();
      env(g, t, 0.032 * vel, 0.006, 0.2);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(m);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.22);
    }
  };

  /** 豆子在盒子里沙沙响 */
  const shaker = (t: number, vel: number) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6500;
    const g = ctx.createGain();
    env(g, t, 0.05 * vel, 0.003, 0.045);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + 0.06);
  };

  /** 豆子落下的“哒”，和孵化音效是同一个声音 */
  const bead = (m: number, t: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(hz(m), t);
    o.frequency.exponentialRampToValueAtTime(hz(m) * 0.5, t + 0.05);
    env(g, t, 0.05, 0.002, 0.07);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.08);
  };

  /** “啵嘤”：往上一滑，带点颤 */
  const boing = (t: number) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(330, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.16);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 22;
    const depth = ctx.createGain();
    depth.gain.value = 18;
    lfo.connect(depth).connect(o.frequency);
    const g = ctx.createGain();
    env(g, t, 0.06, 0.01, 0.3);
    o.connect(g).connect(bus);
    for (const x of [o, lfo]) {
      x.start(t);
      x.stop(t + 0.32);
    }
  };

  const playStep = (step: number, t: number) => {
    const loop = Math.floor(step / (BARS * 8));
    const bar = Math.floor(step / 8) % BARS;
    const pos = step % 8;
    const ch = CHORDS[bar];
    const next = CHORDS[(bar + 1) % BARS];
    const phraseA = bar < 8;
    const rest = phraseA && loop % 3 === 2;

    // 贝斯：一、三拍，偶尔在小节末尾半音爬到下一个和弦
    if (pos === 0) bass(ch.root, t, 1);
    else if (pos === 4) bass(ch.root + 7, t, 0.75);
    else if (pos === 3 && bar % 4 === 1) bass(ch.root + 12, t, 0.5);
    else if (pos === 7 && bar % 2 === 1) bass(next.root - 1, t, 0.55);

    // 二、四拍上的和弦
    if (pos === 2 || pos === 6) stab(ch.stab, t, pos === 6 ? 1 : 0.8);
    if (pos === 7 && bar % 4 === 3) stab(ch.stab, t, 0.5);

    // 沙锤：反拍重一点，带一点点人手的不齐
    shaker(t + (rnd() - 0.5) * 0.008, (pos % 2 ? 1 : 0.55) * (0.8 + rnd() * 0.3));

    // 主旋律
    for (const [p, m, len] of MELODY[bar]) {
      if (p !== pos) continue;
      const dur = Math.max(0.28, len * EIGHTH * 1.6);
      if (rest) {
        if (p === 0) glock(m - 12, t, 0.8);
        continue;
      }
      // 偶尔从下面半音滑进来，俏皮一下
      if ((len >= 2 || p === 0) && rnd() < 0.22) mallet(m - 13, t - 0.05, 0.12, 0.45, 0);
      mallet(m - 12, t, dur, pos % 2 ? 0.85 : 1);
      if (loop % 2 === 1) glock(m - 12, t, 0.7);
    }

    // 零星落豆
    if (rnd() < 0.1) bead(TWINKLE[Math.floor(rnd() * TWINKLE.length)], t + EIGHTH * 0.5);

    if (pos === 6 && (bar === 15 || (bar === 7 && loop % 2 === 1))) boing(t);
  };

  let timer = 0;
  let step = 0;
  let nextAt = 0;
  let playing = false;
  let ducked = false;

  const level = () => (ducked ? 0 : VOLUME);

  const tick = () => {
    const horizon = ctx.currentTime + 0.18;
    while (nextAt < horizon) {
      playStep(step, nextAt + (step % 2 ? EIGHTH * SWING : 0));
      nextAt += EIGHTH;
      step++;
    }
  };

  const fade = (to: number, secs: number, delay = 0) => {
    const t = ctx.currentTime + delay;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(to, t + secs);
  };

  return {
    start() {
      if (playing) return;
      playing = true;
      nextAt = ctx.currentTime + 0.08;
      tick();
      timer = window.setInterval(tick, 40);
      fade(level(), 2.5);
    },
    stop(now = false) {
      if (!playing) return;
      playing = false;
      window.clearInterval(timer);
      fade(0, now ? 0.05 : 0.6);
    },
    duck(on: boolean) {
      if (ducked === on) return;
      ducked = on;
      if (playing) fade(level(), on ? 0.5 : 1.8, on ? 0 : 1.2);
    },
    render(seconds: number) {
      step = 0;
      nextAt = 0.05;
      while (nextAt < seconds) {
        playStep(step, nextAt + (step % 2 ? EIGHTH * SWING : 0));
        nextAt += EIGHTH;
        step++;
      }
      bus.gain.setValueAtTime(0, 0);
      bus.gain.linearRampToValueAtTime(VOLUME, 2.5);
    },
  };
}
