import { expressedTop, Genes, SIZES } from './genes';
import { BEADS, dE, derive, nearest, Pool } from './palette';

export const EMPTY = 0,
  OUT = 1,
  MAIN = 2,
  SUB = 3,
  PAT = 4,
  ACC = 5,
  EYE = 6,
  HI = 7,
  BLUSH = 8,
  WING = 9;
export const FX_GLOW = 1,
  FX_PEARL = 2,
  FX_GLASS = 3;

export interface Raster {
  n: number;
  bead: Int16Array;
  role: Uint8Array;
  fx: Uint8Array;
  blink: Int16Array | null;
  total: number;
  colors: { bead: number; count: number }[];
}

type Fn = (px: number, py: number) => boolean;

class Work {
  w: number;
  role: Uint8Array;
  raw: Uint8Array;
  fx: Uint8Array;
  cx: number;
  c0: number;
  c1: number;
  constructor(w: number) {
    this.w = w;
    this.role = new Uint8Array(w * w);
    this.raw = new Uint8Array(w * w);
    this.fx = new Uint8Array(w * w);
    this.cx = w / 2;
    this.c0 = w / 2 - 1;
    this.c1 = w / 2;
  }
  inb(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.w;
  }
  get(x: number, y: number) {
    return this.inb(x, y) ? this.role[y * this.w + x] : EMPTY;
  }
  set(x: number, y: number, r: number, raw = false) {
    if (!this.inb(x, y)) return;
    const i = y * this.w + x;
    this.role[i] = r;
    this.raw[i] = raw ? 1 : 0;
  }
  sym(x: number, y: number, r: number, raw = false) {
    this.set(x, y, r, raw);
    this.set(this.w - 1 - x, y, r, raw);
  }
  fill(fn: Fn, r: number, only?: (cur: number) => boolean) {
    for (let y = 0; y < this.w; y++)
      for (let x = 0; x < this.w; x++) {
        const cur = this.role[y * this.w + x];
        if ((!only || only(cur)) && fn(x + 0.5, y + 0.5)) this.set(x, y, r);
      }
  }
  topAt(x: number) {
    for (let y = 0; y < this.w; y++) {
      const r = this.get(x, y);
      if (r !== EMPTY && r !== OUT) return y;
    }
    return -1;
  }
  bottomAt(x: number) {
    for (let y = this.w - 1; y >= 0; y--) {
      const r = this.get(x, y);
      if (r !== EMPTY && r !== OUT) return y;
    }
    return -1;
  }
  rowSpan(y: number): [number, number] {
    let a = -1,
      b = -1;
    for (let x = 0; x < this.w; x++) {
      const r = this.get(x, y);
      if (r !== EMPTY && r !== OUT) {
        if (a < 0) a = x;
        b = x;
      }
    }
    return [a, b];
  }
}

const isEmpty = (c: number) => c === EMPTY;
const isBody = (c: number) => c === MAIN || c === SUB || c === PAT;

function ellipse(cx: number, cy: number, rx: number, ry: number, p = 2): Fn {
  return (px, py) => Math.pow(Math.abs((px - cx) / rx), p) + Math.pow(Math.abs((py - cy) / ry), p) <= 1;
}

interface Anchor {
  eyeTop: number;
  k: number;
  neckY: number;
  bellyCy: number;
  bellyRx: number;
  bellyRy: number;
  fadeY: number;
  topMode: 'free' | 'cap' | 'none';
  capBottom?: number;
  beak?: boolean;
}

/* ---------------- 体型 ---------------- */

function buildBody(w: Work, g: Genes, n: number, s: number): Anchor {
  const cx = w.cx;
  const yb = 4 + n - 1; // 连续坐标下身体底边
  const sz = n >= 24 ? 2 : n >= 20 ? 1 : 0;
  const k = [2, 3, 3][sz];
  const glass = g.rare === 'glass';
  switch (g.body) {
    case 'mochi': {
      const rx = 7.4 * s,
        ry = 5.9 * s,
        cy = yb - ry;
      w.fill((px, py) => {
        const u = Math.abs((px - cx) / rx),
          v = (py - cy) / ry;
        const p = v < 0 ? 2.25 : 3.4;
        return Math.pow(u, p) + Math.pow(Math.abs(v), p) <= 1;
      }, MAIN);
      const eyeTop = Math.floor(cy - 0.18 * ry);
      return { eyeTop, k, neckY: 0, bellyCy: cy + ry * 0.55, bellyRx: rx * 0.52, bellyRy: ry * 0.5, fadeY: Math.floor(cy + ry * 0.42), topMode: 'free' };
    }
    case 'bean': {
      const rx = 6.0 * s,
        ry = 7.0 * s,
        cy = yb - 1 - ry;
      w.fill((px, py) => {
        const v = (py - cy) / ry;
        const rxe = v < 0 ? rx * (1 + 0.14 * v) : rx;
        return Math.pow((px - cx) / rxe, 2) + v * v <= 1;
      }, MAIN);
      const by = w.bottomAt(w.c0);
      const [a] = w.rowSpan(by);
      const fx = Math.min(a + 1, w.c0 - 2);
      for (const x of [fx - 1, fx]) w.sym(x, by + 1, MAIN);
      const eyeTop = Math.floor(cy - 0.12 * ry);
      return { eyeTop, k, neckY: 0, bellyCy: cy + ry * 0.5, bellyRx: rx * 0.55, bellyRy: ry * 0.45, fadeY: Math.floor(cy + ry * 0.4), topMode: 'free' };
    }
    case 'cat': {
      const rx = 7.2 * s,
        ry = 5.9 * s,
        cy = yb - ry;
      w.fill((px, py) => {
        const u = Math.abs((px - cx) / rx),
          v = (py - cy) / ry;
        const p = v < 0 ? 2.35 : 3.2;
        return Math.pow(u, p) + Math.pow(Math.abs(v), p) <= 1;
      }, MAIN);
      const top = cy - ry;
      const h = 3.4 * s,
        base = top + 1.7 * s,
        hb = 2.0 * s;
      for (const ex of [cx - 0.52 * rx, cx + 0.52 * rx]) {
        w.fill((px, py) => {
          if (py > base || py < base - h) return false;
          const t = (base - py) / h;
          return Math.abs(px - ex) <= hb * (1 - t) + 0.3;
        }, MAIN, isEmpty);
        if (n >= 20)
          w.fill((px, py) => {
            if (py > top + 0.6 || py < base - h * 0.62) return false;
            const t = (base - 0.3 - py) / (h * 0.62);
            return Math.abs(px - ex) <= hb * 0.42 * (1 - t) + 0.2;
          }, BLUSH, (c) => c === MAIN);
      }
      // 尾巴
      const ty = w.bottomAt(w.c0) - 1;
      const [, xr] = w.rowSpan(ty);
      if (xr + 2 < w.w - 4 || n >= 20) {
        w.set(xr + 1, ty, MAIN);
        w.set(xr + 2, ty, MAIN);
        w.set(xr + 2, ty - 1, MAIN);
        w.set(xr + 2, ty - 2, g.quirk % 2 ? PAT : MAIN);
      }
      const eyeTop = Math.floor(cy - 0.12 * ry);
      return { eyeTop, k, neckY: 0, bellyCy: cy + ry * 0.55, bellyRx: rx * 0.5, bellyRy: ry * 0.48, fadeY: Math.floor(cy + ry * 0.42), topMode: 'free' };
    }
    case 'bird': {
      const rx = 6.4 * s,
        ry = 6.3 * s,
        cy = yb - 1 - ry;
      w.fill(ellipse(cx, cy, rx, ry, 2.1), MAIN);
      const wr = glass ? WING : SUB;
      for (const ex of [cx - rx + 0.2 * s, cx + rx - 0.2 * s]) w.fill(ellipse(ex, cy + 1.0 * s, 1.5 * s, 2.6 * s), wr, isEmpty);
      if (glass) for (let i = 0; i < w.fx.length; i++) if (w.role[i] === WING) w.fx[i] = FX_GLASS;
      const by = w.bottomAt(w.c0);
      w.sym(w.c0 - 1, by + 1, ACC, true);
      const eyeTop = Math.floor(cy - 0.2 * ry);
      return { eyeTop, k, neckY: 0, bellyCy: cy + ry * 0.5, bellyRx: rx * 0.5, bellyRy: ry * 0.45, fadeY: Math.floor(cy + ry * 0.4), topMode: 'free', beak: true };
    }
    case 'jelly': {
      const rx = 7.4 * s,
        ry = 7.2 * s,
        yd = yb - 4.3 * s;
      w.fill((px, py) => py <= yd && Math.pow(Math.abs((px - cx) / rx), 2.2) + Math.pow(Math.abs((py - yd) / ry), 2.2) <= 1, MAIN);
      const skirt = Math.floor(yd);
      const [a, b] = w.rowSpan(skirt - 1);
      for (let x = a; x <= b; x++) {
        const d = x <= w.c0 ? w.c0 - x : x - w.c1;
        if (d % 3 !== 2) w.set(x, skirt, MAIN);
      }
      const T = n >= 20 ? 3 : 2;
      const bottom = 4 + n - 2;
      for (let j = 0; j < T; j++) {
        const d = 1 + 2 * j;
        const len = bottom - (j === T - 1 ? 1 : 0) - (j === 0 && g.quirk % 3 === 0 ? 1 : 0);
        for (let y = skirt + 1; y <= len; y++) w.sym(w.c0 - d, y, j % 2 ? MAIN : SUB);
      }
      const eyeTop = Math.floor(yd - 0.62 * ry);
      return { eyeTop, k, neckY: skirt, bellyCy: yd - 1.8 * s, bellyRx: rx * 0.5, bellyRy: 1.8 * s, fadeY: Math.floor(yd - 1.5 * s), topMode: 'free' };
    }
    case 'ghost': {
      const rx = 6.1 * s,
        ry = 5.8 * s,
        yt = yb - 13.4 * s,
        cy = yt + ry;
      const amp = 0.95 * s;
      w.fill((px, py) => {
        if (py <= cy) return Math.pow((px - cx) / rx, 2) + Math.pow((py - cy) / ry, 2) <= 1;
        const hw = rx + 0.1 * (py - cy);
        if (Math.abs(px - cx) > hw) return false;
        const u = (px - cx) / hw;
        return py <= yb - amp - amp * Math.cos(u * Math.PI * 3);
      }, MAIN);
      for (const ex of [cx - rx - 0.5 * s, cx + rx + 0.5 * s]) w.fill(ellipse(ex, cy + 2.0 * s, 1.3 * s, 1.0 * s), MAIN, isEmpty);
      const eyeTop = Math.floor(cy - 0.3 * ry);
      return { eyeTop, k, neckY: 0, bellyCy: cy + ry * 0.9, bellyRx: rx * 0.5, bellyRy: ry * 0.5, fadeY: Math.floor(cy + ry * 0.75), topMode: 'free' };
    }
    case 'mush': {
      const rx = Math.min(8.7 * s, n / 2 + 0.2),
        ry = 4.8 * s,
        yt = yb - 12.9 * s,
        cy = yt + ry;
      w.fill((px, py) => (py <= cy && Math.pow(Math.abs((px - cx) / rx), 2.1) + Math.pow(Math.abs((py - cy) / ry), 2.1) <= 1) || (py > cy && py <= cy + 1 && Math.abs(px - cx) <= rx * 0.94), MAIN);
      const capBottom = Math.floor(cy + 0.5);
      const sw = 5.4 * s,
        st = capBottom + 1,
        sh = (yb - st) / 2,
        scy = st + sh;
      w.fill((px, py) => py > st && Math.pow(Math.abs((px - cx) / sw), 4) + Math.pow(Math.abs((py - scy) / sh), 4) <= 1, SUB);
      const eyeTop = st + (n >= 20 ? 1 : 0);
      return { eyeTop, k: k - 1, neckY: 0, bellyCy: cy - ry * 0.3, bellyRx: rx * 0.4, bellyRy: ry * 0.4, fadeY: Math.floor(cy - ry * 0.5), topMode: 'cap', capBottom };
    }
    case 'dino': {
      const rx = 6.4 * s,
        ry = 6.9 * s,
        cy = yb - ry;
      w.fill((px, py) => {
        const u = Math.abs((px - cx) / rx),
          v = (py - cy) / ry;
        const p = v < 0 ? 2.2 : 2.8;
        return Math.pow(u, p) + Math.pow(Math.abs(v), p) <= 1;
      }, MAIN);
      // 背刺
      const t0 = w.topAt(w.c0);
      for (let x = w.c0 - 1; x <= w.c1 + 1; x++) if (w.get(x, t0 - 1) === EMPTY) w.set(x, t0 - 1, ACC);
      w.set(w.c0, t0 - 2, ACC);
      w.set(w.c1, t0 - 2, ACC);
      const xs = w.c0 - Math.round(3.2 * s);
      const ts = w.topAt(xs);
      for (const x of [xs - 1, xs, xs + 1]) if (w.get(x, ts - 1) === EMPTY) w.sym(x, ts - 1, ACC);
      w.sym(xs, ts - 2, ACC);
      // 小手
      const ay = Math.floor(cy + 1.2 * s);
      const [la] = w.rowSpan(ay);
      w.sym(la - 1, ay, MAIN);
      // 尾巴
      const ty = w.bottomAt(w.c0) - 1;
      const [, xr] = w.rowSpan(ty);
      w.set(xr + 1, ty, MAIN);
      w.set(xr + 2, ty, MAIN);
      w.set(xr + 1, ty - 1, MAIN);
      const eyeTop = Math.floor(cy - 0.3 * ry);
      return { eyeTop, k, neckY: 0, bellyCy: cy + ry * 0.45, bellyRx: rx * 0.55, bellyRy: ry * 0.5, fadeY: Math.floor(cy + ry * 0.4), topMode: 'none' };
    }
  }
}

/* ---------------- 头顶 ---------------- */

function buildTop(w: Work, g: Genes, a: Anchor, n: number, s: number) {
  const top = expressedTop(g);
  if (top === 'none' || a.topMode === 'none') return;
  const { c0, c1, cx } = w;
  const topY = w.topAt(c0);
  const [ha, hb] = w.rowSpan(topY + 1);
  const headHalf = (hb - ha + 1) / 2;
  const small = n < 20;
  switch (top) {
    case 'bunny': {
      const erx = Math.max(1.1, 1.35 * s),
        ery = 3.5 * s;
      const off = Math.max(1.9 * s, headHalf * 0.4);
      for (const ex of [cx - off, cx + off]) {
        const ey = topY - ery * 0.62 + 0.9;
        w.fill(ellipse(ex, ey, erx, ery), MAIN, isEmpty);
        if (!small) w.fill(ellipse(ex, ey - 0.2, erx * 0.42, ery * 0.62), BLUSH, (c) => c === MAIN);
      }
      // 耳朵内侧只保留在头顶之上
      for (let y = topY; y < w.w; y++) for (let x = 0; x < w.w; x++) if (w.get(x, y) === BLUSH && y >= topY) w.set(x, y, MAIN);
      break;
    }
    case 'catear': {
      const h = 3.1 * s,
        base = topY + 1.4 * s,
        hb2 = 1.9 * s;
      for (const ex of [cx - Math.max(2.4 * s, headHalf * 0.55), cx + Math.max(2.4 * s, headHalf * 0.55)]) {
        w.fill((px, py) => {
          if (py > base || py < base - h) return false;
          const t = (base - py) / h;
          return Math.abs(px - ex) <= hb2 * (1 - t) + 0.3;
        }, MAIN, isEmpty);
        if (!small)
          w.fill((px, py) => {
            if (py > topY || py < base - h * 0.6) return false;
            const t = (base - 0.3 - py) / (h * 0.6);
            return Math.abs(px - ex) <= hb2 * 0.4 * (1 - t) + 0.2;
          }, BLUSH, (c) => c === MAIN);
      }
      break;
    }
    case 'sprout': {
      const x0 = c1;
      const t = w.topAt(x0);
      w.set(x0, t - 1, ACC);
      if (!small) w.set(x0, t - 2, ACC);
      const ly = small ? t - 2 : t - 3;
      [[-2, 0], [-1, 0], [-1, 1], [1, 0], [2, 0], [1, 1]].forEach(([dx, dy]) => {
        if (w.get(x0 + dx, ly + dy) === EMPTY) w.set(x0 + dx, ly + dy, ACC);
      });
      if (!small) w.set(x0 - 2, ly - 1, ACC);
      break;
    }
    case 'antenna': {
      const xs = c0 - (small ? 1 : 2);
      const t = w.topAt(xs);
      for (let i = 1; i <= (small ? 1 : 2); i++) w.sym(xs, t - i, OUT, true);
      const by = t - (small ? 2 : 3);
      w.sym(xs, by, ACC);
      w.sym(xs - 1, by, ACC);
      w.sym(xs, by - 1, ACC);
      w.sym(xs - 1, by - 1, ACC);
      break;
    }
    case 'horn': {
      const xs = c0 - Math.max(1, Math.round(headHalf * 0.45));
      const t = w.topAt(xs);
      w.sym(xs, t - 1, SUB);
      w.sym(xs - 1, t - 1, SUB);
      w.sym(xs - 1, t - 2, SUB);
      if (!small) w.sym(xs - 1, t - 3, SUB);
      break;
    }
    case 'flower': {
      const xs = a.topMode === 'cap' ? c1 + Math.round(2 * s) : c1 + Math.max(1, Math.round(headHalf * 0.4));
      const t = w.topAt(xs);
      const fy = t - 2;
      w.set(xs, t - 1, OUT, true);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (w.get(xs + dx, fy + dy) !== OUT) w.set(xs + dx, fy + dy, ACC);
      w.set(xs, fy, PAT);
      break;
    }
    case 'ahoge': {
      const t = w.topAt(c1);
      w.set(c1, t - 1, MAIN);
      w.set(c1, t - 2, MAIN);
      w.set(c1 + 1, t - 3, MAIN);
      if (!small) w.set(c1 + 2, t - 3, MAIN);
      break;
    }
  }
}

/* ---------------- 脸 ---------------- */

interface EyeSpec {
  w: number;
  h: number;
  cells: [number, number, number][];
  mirror: boolean;
  open: boolean;
}

function eyeSpec(type: string, sz: number): EyeSpec {
  const E = EYE,
    H = HI;
  switch (type) {
    case 'dot':
      return sz === 0
        ? { w: 1, h: 2, cells: [[0, 0, E], [0, 1, E]], mirror: false, open: true }
        : sz === 1
          ? { w: 2, h: 2, cells: [[0, 0, E], [1, 0, E], [0, 1, E], [1, 1, E]], mirror: false, open: true }
          : { w: 2, h: 3, cells: [[0, 0, E], [1, 0, E], [0, 1, E], [1, 1, E], [0, 2, E], [1, 2, E]], mirror: false, open: true };
    case 'sparkle':
      return sz === 0
        ? { w: 2, h: 2, cells: [[0, 0, H], [1, 0, E], [0, 1, E], [1, 1, E]], mirror: false, open: true }
        : sz === 1
          ? { w: 2, h: 3, cells: [[0, 0, H], [1, 0, E], [0, 1, E], [1, 1, E], [0, 2, E], [1, 2, E]], mirror: false, open: true }
          : {
              w: 3,
              h: 3,
              cells: [[0, 0, H], [1, 0, E], [2, 0, E], [0, 1, E], [1, 1, E], [2, 1, E], [0, 2, E], [1, 2, E], [2, 2, H]],
              mirror: false,
              open: true,
            };
    case 'sleepy':
      return { w: 3, h: 2, cells: [[0, 0, E], [1, 1, E], [2, 0, E]], mirror: true, open: false };
    case 'happy':
    default:
      return { w: 3, h: 2, cells: [[0, 1, E], [1, 0, E], [2, 1, E]], mirror: true, open: false };
  }
}

interface FaceOut {
  zone: (x: number, y: number) => boolean;
  under: Map<number, number>;
  openEyes: { x: number; y: number; w: number; h: number }[];
  mouthBottom: number;
}

function paintFace(w: Work, g: Genes, a: Anchor, n: number): FaceOut {
  const sz = n >= 24 ? 2 : n >= 20 ? 1 : 0;
  const { c0, c1 } = w;
  const under = new Map<number, number>();
  const put = (x: number, y: number, r: number) => {
    if (!w.inb(x, y)) return;
    const i = y * w.w + x;
    if (!under.has(i)) under.set(i, w.role[i]);
    w.set(x, y, r);
  };
  const L = eyeSpec(g.eyes === 'wink' ? 'happy' : g.eyes, sz);
  const R = eyeSpec(g.eyes === 'wink' ? 'sparkle' : g.eyes, sz);
  const eh = Math.max(L.h, R.h);
  const top = a.eyeTop;
  const lx = c0 - a.k - L.w + 1;
  const rx = c1 + a.k;
  const openEyes: FaceOut['openEyes'] = [];
  const ly = top + (eh - L.h);
  const ry = top + (eh - R.h);
  for (const [dx, dy, r] of L.cells) put(lx + dx, ly + dy, r);
  for (const [dx, dy, r] of R.cells) put(R.mirror ? rx + (R.w - 1 - dx) : rx + dx, ry + dy, r);
  if (L.open) openEyes.push({ x: lx, y: ly, w: L.w, h: L.h });
  if (R.open) openEyes.push({ x: rx, y: ry, w: R.w, h: R.h });
  const eyeBottom = top + eh - 1;
  let m0 = eyeBottom + 1;
  let mouthBottom = eyeBottom;
  if (a.beak) {
    put(c0, m0, ACC);
    put(c1, m0, ACC);
    mouthBottom = m0;
  } else {
    const mouth = g.mouth === 'w' && sz === 0 ? 'smile' : g.mouth;
    if (mouth === 'smile') {
      put(c0 - 1, m0, EYE);
      put(c1 + 1, m0, EYE);
      put(c0, m0 + 1, EYE);
      put(c1, m0 + 1, EYE);
      mouthBottom = m0 + 1;
    } else if (mouth === 'w') {
      put(c0 - 2, m0, EYE);
      put(c0, m0, EYE);
      put(c1, m0, EYE);
      put(c1 + 2, m0, EYE);
      put(c0 - 1, m0 + 1, EYE);
      put(c1 + 1, m0 + 1, EYE);
      mouthBottom = m0 + 1;
    } else if (mouth === 'o') {
      put(c0, m0, EYE);
      put(c1, m0, EYE);
      put(c0, m0 + 1, BLUSH);
      put(c1, m0 + 1, BLUSH);
      mouthBottom = m0 + 1;
    }
  }
  let blushL = lx - 1;
  if (g.blush) {
    const by = eyeBottom + 1;
    const bw = sz === 0 ? 2 : 2;
    for (let i = 0; i < bw; i++) {
      const x = lx - 1 + i;
      if (isBody(w.get(x, by))) put(x, by, BLUSH);
      const xr = w.w - 1 - x;
      if (isBody(w.get(xr, by))) put(xr, by, BLUSH);
    }
    blushL = lx - 2;
  }
  const zx0 = Math.min(blushL, lx - 1),
    zy0 = top - 1,
    zy1 = mouthBottom + 1;
  const zone = (x: number, y: number) => y >= zy0 && y <= zy1 && x >= zx0 && x <= w.w - 1 - zx0;
  return { zone, under, openEyes, mouthBottom };
}

/* ---------------- 花纹 / 配件 / 罕见 ---------------- */

function paintPattern(w: Work, g: Genes, a: Anchor, n: number, s: number, zone: (x: number, y: number) => boolean) {
  const topY = w.topAt(w.c0);
  const capOnly = g.body === 'mush';
  const torso = (x: number, y: number) => {
    if (w.get(x, y) !== MAIN || zone(x, y)) return false;
    if (capOnly) return y <= (a.capBottom ?? 0);
    return y >= topY;
  };
  const { c0, c1 } = w;
  switch (g.pattern) {
    case 'stripes': {
      for (let y = 0; y < w.w; y++)
        for (let x = 0; x < w.w; x++) {
          if (!torso(x, y)) continue;
          const d = x <= c0 ? c0 - x : x - c1;
          let on = false;
          if (g.dir === 0) on = (y - topY) % 3 === 2;
          else if (g.dir === 2) on = d % 3 === 1;
          else if (g.dir === 1) on = (x + y) % 5 < 2;
          else on = (((x - y) % 5) + 5) % 5 < 2;
          if (on) w.set(x, y, PAT);
        }
      break;
    }
    case 'dots': {
      const sp = n >= 20 ? 4 : 3;
      const ds = n >= 24 ? 2 : 1;
      const col = g.body === 'mush' ? SUB : PAT;
      let row = 0;
      for (let y = topY + 1; y < w.w; y += sp, row++) {
        const off = (row % 2) * Math.floor(sp / 2) + (g.quirk % sp);
        for (let x = off; x < w.w; x += sp) {
          let ok = true;
          for (let dy = 0; dy < ds; dy++) for (let dx = 0; dx < ds; dx++) if (!torso(x + dx, y + dy) || !torso(x + dx - 1, y + dy) || !torso(x + dx + 1, y + dy)) ok = false;
          if (ok) for (let dy = 0; dy < ds; dy++) for (let dx = 0; dx < ds; dx++) w.set(x + dx, y + dy, col);
        }
      }
      break;
    }
    case 'belly': {
      const f = ellipse(w.cx, a.bellyCy, a.bellyRx, a.bellyRy);
      for (let y = 0; y < w.w; y++) for (let x = 0; x < w.w; x++) if (torso(x, y) && f(x + 0.5, y + 0.5)) w.set(x, y, SUB);
      break;
    }
    case 'heart': {
      const big = n >= 20;
      const cells = big
        ? [[1, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]]
        : [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
      const hw = big ? 5 : 3,
        hh = big ? 4 : 3;
      const x0 = c0 - Math.floor(hw / 2) + (big ? 0 : 1);
      const y0 = g.body === 'mush' ? Math.round(a.bellyCy - hh / 2) : Math.round(a.bellyCy - hh / 2 + 0.3 * s);
      if (cells.every(([dx, dy]) => torso(x0 + dx, y0 + dy))) for (const [dx, dy] of cells) w.set(x0 + dx, y0 + dy, PAT);
      else {
        const y1 = y0 - 1;
        if (cells.every(([dx, dy]) => torso(x0 + dx, y1 + dy))) for (const [dx, dy] of cells) w.set(x0 + dx, y1 + dy, PAT);
      }
      break;
    }
    case 'fade': {
      for (let y = 0; y < w.w; y++)
        for (let x = 0; x < w.w; x++) {
          if (!torso(x, y)) continue;
          const wave = Math.floor(x / 2) % 2;
          if (y >= a.fadeY + wave) w.set(x, y, SUB);
        }
      break;
    }
  }
}

function paintAcc(w: Work, g: Genes, a: Anchor, n: number, s: number, mouthBottom: number) {
  const neck = a.neckY || mouthBottom + (g.blush ? 1 : 1) + 1;
  const { c0, c1 } = w;
  const thick = n >= 20 ? 2 : 1;
  switch (g.acc) {
    case 'scarf': {
      for (let y = neck; y < neck + thick; y++)
        for (let x = 0; x < w.w; x++) if ([MAIN, SUB, PAT].includes(w.get(x, y))) w.set(x, y, ACC);
      for (let dy = 0; dy < thick; dy++)
        for (const x of [c1 + 2, c1 + 3]) if ([MAIN, SUB, PAT].includes(w.get(x, neck + thick + dy))) w.set(x, neck + thick + dy, ACC);
      break;
    }
    case 'bow': {
      const topY = w.topAt(c0);
      const y0 = topY + (n >= 20 ? 1 : 0);
      const [la] = w.rowSpan(y0 + 1);
      const x0 = la - 1;
      const cells = [[0, 0], [4, 0], [0, 1], [1, 1], [3, 1], [4, 1], [0, 2], [4, 2]];
      for (const [dx, dy] of cells) w.set(x0 + dx, y0 + dy, ACC);
      w.set(x0 + 2, y0 + 1, OUT);
      if (n >= 20) {
        w.set(x0 + 1, y0 + 2, ACC);
        w.set(x0 + 3, y0 + 2, ACC);
      }
      void s;
      break;
    }
    case 'bell': {
      if (g.body === 'jelly') break;
      for (let x = 0; x < w.w; x++) if ([MAIN, SUB, PAT].includes(w.get(x, neck))) w.set(x, neck, OUT);
      const cells: [number, number, number][] = [
        [c0, neck + 1, HI],
        [c1, neck + 1, ACC],
        [c0, neck + 2, ACC],
        [c1, neck + 2, ACC],
      ];
      for (const [x, y, r] of cells) if (w.get(x, y) !== EMPTY) w.set(x, y, r);
      break;
    }
  }
}

function paintRare(w: Work, g: Genes, a: Anchor, n: number, s: number, zone: (x: number, y: number) => boolean) {
  if (g.rare === 'glass' && g.body !== 'bird') {
    const topY = w.topAt(w.c0);
    const wy = topY + 2.6 * s;
    const [ra, rb] = w.rowSpan(Math.floor(wy));
    const half = (rb - ra + 1) / 2;
    for (const ex of [w.cx - half - 1.0 * s, w.cx + half + 1.0 * s]) w.fill(ellipse(ex, wy, 1.8 * s, 2.4 * s), WING, isEmpty);
    for (let i = 0; i < w.role.length; i++) if (w.role[i] === WING) w.fx[i] = FX_GLASS;
  }
  if (g.rare === 'pearl') {
    const f = ellipse(w.cx, a.bellyCy, a.bellyRx * 0.9, a.bellyRy * 0.9);
    for (let y = 0; y < w.w; y++)
      for (let x = 0; x < w.w; x++) {
        const r = w.get(x, y);
        if ((r === SUB || r === MAIN) && !zone(x, y) && f(x + 0.5, y + 0.5)) {
          w.set(x, y, SUB);
          w.fx[y * w.w + x] = FX_PEARL;
        }
      }
  }
  void n;
}

function outline(w: Work) {
  const add: number[] = [];
  for (let y = 0; y < w.w; y++)
    for (let x = 0; x < w.w; x++) {
      if (w.get(x, y) !== EMPTY) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx,
          ny = y + dy;
        if (!w.inb(nx, ny)) continue;
        const i = ny * w.w + nx;
        if (w.role[i] !== EMPTY && w.role[i] !== OUT && !w.raw[i]) {
          add.push(y * w.w + x);
          break;
        }
      }
    }
  for (const i of add) w.role[i] = OUT;
}

/* ---------------- 主流程 ---------------- */

const BUDGET = [7, 8, 9];

export function rasterize(g: Genes, pool: Pool): Raster {
  const n = SIZES[g.size];
  let scale = n / 20;
  let dropTop = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = tryRaster(g, n, scale, dropTop, pool);
    if (res) return res;
    if (attempt === 2) dropTop = true;
    scale *= 0.93;
  }
  return tryRaster(g, n, scale * 0.8, true, pool, true)!;
}

function tryRaster(g: Genes, n: number, s: number, dropTop: boolean, pool: Pool, force = false): Raster | null {
  const W = n + 10;
  const w = new Work(W);
  const a = buildBody(w, g, n, s);
  if (!dropTop) buildTop(w, g, a, n, s);
  // 先占位脸部区域，再画花纹
  const sz = n >= 24 ? 2 : n >= 20 ? 1 : 0;
  const tmpEye = eyeSpec(g.eyes === 'wink' ? 'sparkle' : g.eyes, sz);
  const ew = Math.max(tmpEye.w, g.eyes === 'wink' ? 3 : 0);
  const [ea, eb] = w.rowSpan(a.eyeTop + 1);
  const half = (eb - ea + 1) / 2;
  a.k = Math.max(1, Math.min(a.k, Math.floor(half - ew - (g.blush ? 1 : 0) - 1)));
  const lx = w.c0 - a.k - tmpEye.w + 1;
  const mouthH = a.beak ? 1 : g.mouth === 'none' ? 0 : 2;
  const eyeBottom = a.eyeTop + Math.max(tmpEye.h, 2) - 1;
  const zoneEst = (x: number, y: number) => y >= a.eyeTop - 1 && y <= eyeBottom + mouthH + 1 && x >= lx - 2 && x <= W - 1 - (lx - 2);
  paintPattern(w, g, a, n, s, zoneEst);
  paintRare(w, g, a, n, s, zoneEst);
  const face = paintFace(w, g, a, n);
  paintAcc(w, g, a, n, s, face.mouthBottom);
  if (g.rare === 'glow') for (let i = 0; i < w.role.length; i++) if (w.role[i] === EYE && face.under.has(i)) w.fx[i] = FX_GLOW;
  outline(w);

  // 边界
  let minX = W,
    minY = W,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++)
      if (w.role[y * W + x] !== EMPTY) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  const bw = maxX - minX + 1,
    bh = maxY - minY + 1;
  if (!force && (bw > n || bh > n)) return null;
  const ox = Math.floor((n - bw) / 2) - minX;
  const oy = Math.floor((n - bh) / 2) - minY;

  const role = new Uint8Array(n * n);
  const fx = new Uint8Array(n * n);
  const blinkRole = new Uint8Array(n * n);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const r = w.role[y * W + x];
      if (r === EMPTY) continue;
      const nx = x + ox,
        ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      role[ny * n + nx] = r;
      fx[ny * n + nx] = w.fx[y * W + x];
      blinkRole[ny * n + nx] = r;
    }
  // 眨眼帧
  let hasBlink = false;
  for (const e of face.openEyes) {
    hasBlink = true;
    for (let dy = 0; dy < e.h; dy++)
      for (let dx = 0; dx < e.w; dx++) {
        const sx = e.x + dx,
          sy = e.y + dy;
        const nx = sx + ox,
          ny = sy + oy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const under = face.under.get(sy * W + sx) ?? MAIN;
        blinkRole[ny * n + nx] = dy === e.h - 1 ? EYE : under;
      }
  }

  keepLargest(role, n, blinkRole);

  // 角色 → 豆
  const d = derive(g.colors.main, pool);
  const map = (r: number): number => {
    switch (r) {
      case OUT:
        return d.out;
      case MAIN:
        return g.colors.main;
      case SUB:
        return g.colors.sub;
      case PAT:
        return g.colors.pat;
      case ACC:
        return g.colors.acc;
      case EYE:
        return d.eye;
      case HI:
        return d.hi;
      case BLUSH:
        return d.blush;
      case WING:
        return d.wing;
      default:
        return -1;
    }
  };
  const bead = new Int16Array(n * n).fill(-1);
  const blink = hasBlink ? new Int16Array(n * n).fill(-1) : null;
  for (let i = 0; i < n * n; i++) {
    if (role[i]) bead[i] = map(role[i]);
    if (blink && blinkRole[i]) blink[i] = map(blinkRole[i]);
  }
  const protectedB = new Set([d.out, d.eye, d.hi, g.colors.main]);
  tidyColors(bead, blink, role, BUDGET[g.size], protectedB);
  return finalize(n, bead, role, fx, blink);
}

function keepLargest(role: Uint8Array, n: number, blinkRole: Uint8Array) {
  const seen = new Int32Array(n * n).fill(-1);
  let best = -1,
    bestSize = 0,
    id = 0;
  for (let i = 0; i < n * n; i++) {
    if (!role[i] || seen[i] >= 0) continue;
    const stack = [i];
    seen[i] = id;
    let size = 0;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const x = c % n,
        y = (c / n) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx;
        if (role[j] && seen[j] < 0) {
          seen[j] = id;
          stack.push(j);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
    id++;
  }
  for (let i = 0; i < n * n; i++)
    if (role[i] && seen[i] !== best) {
      role[i] = 0;
      blinkRole[i] = 0;
    }
}

function counts(bead: Int16Array) {
  const m = new Map<number, number>();
  for (const b of bead) if (b >= 0) m.set(b, (m.get(b) ?? 0) + 1);
  return m;
}

function replaceBead(bead: Int16Array, blink: Int16Array | null, from: number, to: number) {
  for (let i = 0; i < bead.length; i++) {
    if (bead[i] === from) bead[i] = to;
    if (blink && blink[i] === from) blink[i] = to;
  }
}

function tidyColors(bead: Int16Array, blink: Int16Array | null, role: Uint8Array, budget: number, keep: Set<number>) {
  void role;
  for (let guard = 0; guard < 12; guard++) {
    const m = counts(bead);
    if (blink) for (const b of blink) if (b >= 0 && !m.has(b)) m.set(b, 1);
    const used = [...m.keys()];
    let victim = -1;
    const tiny = used.filter((b) => !keep.has(b) && (m.get(b) ?? 0) < 3);
    if (tiny.length && used.length > 5) victim = tiny.sort((a, b) => m.get(a)! - m.get(b)!)[0];
    else if (used.length > budget) victim = used.filter((b) => !keep.has(b)).sort((a, b) => m.get(a)! - m.get(b)!)[0] ?? -1;
    if (victim < 0) return;
    const others = used.filter((b) => b !== victim);
    const to = others.sort((a, b) => dE(a, victim) - dE(b, victim))[0];
    replaceBead(bead, blink, victim, to);
  }
}

function finalize(n: number, bead: Int16Array, role: Uint8Array, fx: Uint8Array, blink: Int16Array | null): Raster {
  const m = counts(bead);
  const colors = [...m.entries()].map(([b, count]) => ({ bead: b, count })).sort((a, b) => b.count - a.count);
  const total = colors.reduce((s, c) => s + c.count, 0);
  return { n, bead, role, fx, blink, total, colors };
}

/** 只用我盒子里的豆：把每种用到的豆换成盒子里最接近的 */
export function remap(r: Raster, pool: Pool): Raster {
  const set = new Set(pool);
  const cache = new Map<number, number>();
  const to = (b: number) => {
    if (b < 0 || set.has(b)) return b;
    if (!cache.has(b)) cache.set(b, nearest(BEADS[b].lab, pool));
    return cache.get(b)!;
  };
  const bead = r.bead.map(to) as Int16Array;
  const blink = r.blink ? (r.blink.map(to) as Int16Array) : null;
  return finalize(r.n, bead, r.role, r.fx, blink);
}

export function mirrorRaster(r: Raster): Raster {
  const n = r.n;
  const flip = <T extends Int16Array | Uint8Array>(a: T): T => {
    const out = a.slice() as T;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = a[y * n + (n - 1 - x)];
    return out;
  };
  return { ...r, bead: flip(r.bead), role: flip(r.role), fx: flip(r.fx), blink: r.blink ? flip(r.blink) : null };
}

export const minutesFor = (count: number) => Math.max(5, Math.round(count / 12 + 5));
