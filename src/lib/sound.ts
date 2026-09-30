import { createMusic, Music } from './music';

let ctx: AudioContext | null = null;
let sfx: GainNode | null = null;
let music: Music | null = null;
let enabled = false;
let hatching = false;
let lastTick = 0;

const PREF = 'hatch-beads:sound:v1';

/** 默认开着；用户关过就记住 */
export function loadSoundPref(): boolean {
  try {
    return localStorage.getItem(PREF) !== '0';
  } catch {
    return true;
  }
}

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  sfx = ctx.createGain();
  sfx.connect(master);
  music = createMusic(ctx, master);
  music.duck(hatching);
  return ctx;
}

function sync() {
  if (!ctx) return;
  if (enabled && !document.hidden) {
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    music?.start();
  } else music?.stop();
}

// 浏览器要等用户碰过屏幕才让出声：第一次点哪里都算
function unlock() {
  if (!enabled) return;
  if (ensure()) sync();
}

if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      music?.stop(true);
      void ctx.suspend().catch(() => undefined);
    } else sync();
  });
  // 微信内置浏览器可以借这个接口，不等点击就出声
  type WX = { invoke?: (name: string, args: object, cb: () => void) => void };
  const wx = () => (window as unknown as { WeixinJSBridge?: WX }).WeixinJSBridge?.invoke?.('getNetworkType', {}, unlock);
  if ((window as unknown as { WeixinJSBridge?: WX }).WeixinJSBridge) wx();
  else document.addEventListener('WeixinJSBridgeReady', wx, false);
}

export function setSound(on: boolean, persist = true) {
  enabled = on;
  if (persist)
    try {
      localStorage.setItem(PREF, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  if (on) unlock();
  else sync();
}

export const soundOn = () => enabled;

/** 孵豆的时候背景音乐让开，孵完再回来 */
export function setHatching(on: boolean) {
  hatching = on;
  music?.duck(on);
}

const out = () => sfx!;

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
  o.connect(g).connect(out());
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
  src.connect(f).connect(g).connect(out());
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
    o.connect(g).connect(out());
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
  o.connect(g).connect(out());
  o.start(now);
  o.stop(now + 0.14);
}
