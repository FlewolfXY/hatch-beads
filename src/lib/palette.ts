import { MARD_RAW } from './mard';
import { chroma, deltaE, hexToRgb, Lab, mixLab, rgbToLab, RGB } from './color';

export interface Bead {
  i: number;
  code: string;
  hex: string;
  rgb: RGB;
  lab: Lab;
  series: string;
}

export const BEADS: Bead[] = MARD_RAW.map(([code, hex], i) => {
  const rgb = hexToRgb(hex);
  return { i, code, hex, rgb, lab: rgbToLab(rgb), series: code.replace(/\d+$/, '') };
});

const STANDARD_SERIES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M']);

/** 标准 221 色（A–H + M） */
export const STANDARD: number[] = BEADS.filter((b) => STANDARD_SERIES.has(b.series)).map((b) => b.i);
export const ALL: number[] = BEADS.filter((b) => b.code !== 'T01').map((b) => b.i);

export type Pool = readonly number[];

const codeIndex = new Map(BEADS.map((b) => [b.code, b.i]));
export const beadByCode = (code: string) => {
  const i = codeIndex.get(code);
  return i === undefined ? undefined : BEADS[i];
};

export function nearest(lab: Lab, pool: Pool, exclude?: ReadonlySet<number> | number[]): number {
  const ex = Array.isArray(exclude) ? new Set(exclude) : exclude;
  let best = pool[0];
  let bd = Infinity;
  for (const i of pool) {
    if (ex && ex.has(i)) continue;
    const d = deltaE(lab, BEADS[i].lab);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

export const dE = (a: number, b: number) => deltaE(BEADS[a].lab, BEADS[b].lab);
export const L = (i: number) => BEADS[i].lab[0];
export const C = (i: number) => chroma(BEADS[i].lab);

export interface Derived {
  out: number;
  eye: number;
  hi: number;
  blush: number;
  wing: number;
}

const cache = new Map<string, Derived>();

/** 由主色推出描边、眼睛、高光、腮红、透明翅膀这些“通用豆” */
export function derive(main: number, pool: Pool): Derived {
  const key = main + ':' + pool.length + ':' + pool[0] + ':' + pool[pool.length - 1];
  const hit = cache.get(key);
  if (hit) return hit;
  const [l, a, b] = BEADS[main].lab;
  let out = main;
  for (const drop of [30, 38, 46, 56]) {
    const target: Lab = [Math.max(10, l - (l > 82 ? drop + 6 : drop)), a * 1.08, b * 1.08];
    out = nearest(target, pool, [main]);
    if (dE(out, main) >= 16 && L(out) < l - 14) break;
  }
  const eye = nearest([15, a * 0.12 + 2, b * 0.12 + 2], pool);
  const hi = nearest([99, 0, 0], pool);
  let blush = main;
  for (const t of [0.62, 0.78, 0.92]) {
    blush = nearest(mixLab([l, a, b], [70, 42, 10], t), pool, [main]);
    if (dE(blush, main) >= 10) break;
  }
  const wing = nearest(mixLab([l, a, b], [97, 0, -2], 0.72), pool, [main]);
  const d = { out, eye, hi, blush, wing };
  cache.set(key, d);
  return d;
}

export function lighter(i: number, pool: Pool, dl = 18, exclude: number[] = []): number {
  const [l, a, b] = BEADS[i].lab;
  return nearest([Math.min(97, l + dl), a * 0.7, b * 0.7], pool, [i, ...exclude]);
}

export function darker(i: number, pool: Pool, dl = 20, exclude: number[] = []): number {
  const [l, a, b] = BEADS[i].lab;
  return nearest([Math.max(12, l - dl), a * 1.05, b * 1.05], pool, [i, ...exclude]);
}

export function textOn(i: number): string {
  return L(i) > 62 ? '#2b2320' : '#ffffff';
}
