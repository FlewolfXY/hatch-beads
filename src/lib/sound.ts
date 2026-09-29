let ctx: AudioContext | null = null;
let enabled = false;
let lastTick = 0;

export function setSound(on: boolean) {
  enabled = on;
  if (on && !ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (on && ctx?.state === 'suspended') void ctx.resume();
}

export const soundOn = () => enabled;

function env(g: GainNode, t: number, peak: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** 豆子落进豆板的“哒” */
export function tick(pitch = 1) {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  if (now - lastTick < 0.028) return;
  lastTick = now;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(1500 * pitch, now);
  o.frequency.exponentialRampToValueAtTime(700 * pitch, now + 0.05);
  env(g, now, 0.12, 0.07);
  o.connect(g).connect(ctx.destination);
  o.start(now);
  o.stop(now + 0.08);
}

export function crack() {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  const len = 0.18;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = 0.35;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(now);
}

export function chime() {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  [1046.5, 1318.5, 1568, 2093].forEach((fr, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = 'sine';
    o.frequency.value = fr;
    env(g, now + i * 0.07, 0.09, 0.5);
    o.connect(g).connect(ctx!.destination);
    o.start(now + i * 0.07);
    o.stop(now + i * 0.07 + 0.55);
  });
}

export function pop() {
  if (!enabled || !ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(420, now);
  o.frequency.exponentialRampToValueAtTime(900, now + 0.08);
  env(g, now, 0.15, 0.12);
  o.connect(g).connect(ctx.destination);
  o.start(now);
  o.stop(now + 0.14);
}
