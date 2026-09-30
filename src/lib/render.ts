import { hexToRgb, rgbToHex, RGB } from './color';
import { FX_GLASS, FX_GLOW, FX_PEARL, Raster } from './creature';
import { BEADS, derive, Pool } from './palette';

export type BeadStyle = 'bead' | 'hole' | 'full';

const shade = (hex: string, t: number) => {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => (t >= 0 ? v + (255 - v) * t : v * (1 + t));
  return rgbToHex([f(r), f(g), f(b)] as RGB);
};

const sprites = new Map<string, HTMLCanvasElement>();

const DPR = () => Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

/** 拼豆是短圆柱：俯视是一个带孔的圆环，侧面露出一点厚度，孔里能看到豆板的钉子 */
export function beadSprite(hex: string, px: number, glass = false): HTMLCanvasElement {
  const S = Math.max(2, Math.round(px * DPR()));
  const key = `${hex}|${S}|${glass ? 1 : 0}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const m = S / 2;
  const R = S * 0.47;
  // 2.6mm 小豆的孔径大约是直径的一半
  const H = S * 0.23;
  const circle = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  };
  if (S < 12) {
    ctx.fillStyle = shade(hex, -0.25);
    circle(m, m + S * 0.05, R);
    ctx.fill();
    ctx.fillStyle = hex;
    circle(m, m - S * 0.01, R * 0.97);
    ctx.fill();
    if (S >= 6) {
      ctx.fillStyle = shade(hex, -0.24);
      circle(m, m, S * 0.22);
      ctx.fill();
      if (S >= 9) {
        ctx.fillStyle = 'rgba(244,238,229,0.55)';
        circle(m, m + S * 0.04, S * 0.1);
        ctx.fill();
      }
    }
  } else {
    ctx.globalAlpha = glass ? 0.72 : 1;
    // 侧面（圆柱的厚度）
    ctx.fillStyle = shade(hex, -0.3);
    circle(m, m + S * 0.055, R);
    ctx.fill();
    // 顶面
    const g = ctx.createLinearGradient(0, m - R, 0, m + R);
    g.addColorStop(0, shade(hex, 0.16));
    g.addColorStop(0.55, hex);
    g.addColorStop(1, shade(hex, -0.06));
    ctx.fillStyle = g;
    circle(m, m - S * 0.012, R * 0.985);
    ctx.fill();
    // 孔的内壁
    const hg = ctx.createLinearGradient(0, m - H, 0, m + H);
    hg.addColorStop(0, shade(hex, -0.55));
    hg.addColorStop(1, shade(hex, -0.22));
    ctx.fillStyle = hg;
    circle(m, m, H);
    ctx.fill();
    // 孔底的钉子
    if (S >= 18) {
      ctx.fillStyle = 'rgba(244,238,229,0.92)';
      circle(m, m + H * 0.22, H * 0.55);
      ctx.fill();
    }
    // 孔沿被照亮的一圈
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1, S * 0.03);
    ctx.beginPath();
    ctx.arc(m, m, H + S * 0.015, Math.PI * 0.05, Math.PI * 0.7);
    ctx.stroke();
    // 顶面左上的柔光
    ctx.globalAlpha = glass ? 0.85 : 0.42;
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineWidth = S * 0.075;
    ctx.beginPath();
    ctx.arc(m, m - S * 0.012, (R + H) / 2, Math.PI * 1.08, Math.PI * 1.45);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  sprites.set(key, c);
  return c;
}

export interface DrawOpts {
  px: number;
  x0?: number;
  y0?: number;
  style?: BeadStyle;
  board?: boolean;
  boardColor?: string;
  pegColor?: string;
  t?: number;
  blink?: boolean;
  offsetY?: number;
  alpha?: number;
}

export function drawBoard(ctx: CanvasRenderingContext2D, n: number, o: DrawOpts) {
  const { px, x0 = 0, y0 = 0 } = o;
  const W = n * px;
  ctx.save();
  ctx.fillStyle = o.boardColor ?? '#F4EEE6';
  roundRect(ctx, x0, y0, W, W, px * 0.9);
  ctx.fill();
  ctx.fillStyle = o.pegColor ?? 'rgba(120,96,70,0.13)';
  const pr = Math.max(0.8, px * 0.09);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      ctx.beginPath();
      ctx.arc(x0 + (x + 0.5) * px, y0 + (y + 0.5) * px, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawRaster(ctx: CanvasRenderingContext2D, ras: Raster, o: DrawOpts) {
  const { px, x0 = 0, y0 = 0, style = 'bead', t = 0 } = o;
  const n = ras.n;
  const grid = o.blink && ras.blink ? ras.blink : ras.bead;
  if (o.board) drawBoard(ctx, n, o);
  if (style !== 'bead') return drawFused(ctx, ras, grid, o);
  const oy = y0 + (o.offsetY ?? 0);
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  // 夜光：先画光晕
  for (let i = 0; i < n * n; i++) {
    if (ras.fx[i] !== FX_GLOW || grid[i] < 0) continue;
    const x = x0 + ((i % n) + 0.5) * px,
      y = oy + (((i / n) | 0) + 0.5) * px;
    const a = 0.35 + 0.25 * Math.sin(t / 380);
    const g = ctx.createRadialGradient(x, y, 0, x, y, px * 1.6);
    g.addColorStop(0, `rgba(150,255,200,${a})`);
    g.addColorStop(1, 'rgba(150,255,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - px * 1.6, y - px * 1.6, px * 3.2, px * 3.2);
  }
  for (let i = 0; i < n * n; i++) {
    const b = grid[i];
    if (b < 0) continue;
    const x = x0 + (i % n) * px,
      y = oy + ((i / n) | 0) * px;
    const fx = ras.fx[i];
    ctx.drawImage(beadSprite(BEADS[b].hex, px, fx === FX_GLASS), x, y, px, px);
    if (fx === FX_GLOW) {
      const a = 0.65 + 0.35 * Math.sin(t / 380);
      ctx.fillStyle = `rgba(150,255,205,${a})`;
      ctx.beginPath();
      ctx.arc(x + px / 2, y + px / 2, px * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fx === FX_PEARL && px >= 6) {
      const a = 0.18 + 0.18 * Math.sin(t / 500 + (i % n) * 0.7 + ((i / n) | 0) * 0.4);
      const g = ctx.createLinearGradient(x, y, x + px, y + px);
      g.addColorStop(0, `rgba(255,190,230,${a})`);
      g.addColorStop(0.5, `rgba(255,255,255,${a * 1.4})`);
      g.addColorStop(1, `rgba(170,230,255,${a})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + px / 2, y + px / 2, px * 0.44, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fx === FX_GLASS && px >= 6) {
      const a = 0.25 + 0.2 * Math.sin(t / 420 + i);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x + px * 0.62, y + px * 0.62, px * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

let noise: HTMLCanvasElement | null = null;
function noiseTile() {
  if (noise) return noise;
  noise = document.createElement('canvas');
  noise.width = noise.height = 96;
  const c = noise.getContext('2d')!;
  const img = c.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 255;
  }
  c.putImageData(img, 0, 0);
  return noise;
}

function cellPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, [tl, tr, br, bl]: number[]) {
  c.beginPath();
  c.moveTo(x + tl, y);
  c.lineTo(x + w - tr, y);
  if (tr) c.quadraticCurveTo(x + w, y, x + w, y + tr);
  c.lineTo(x + w, y + h - br);
  if (br) c.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  c.lineTo(x + bl, y + h);
  if (bl) c.quadraticCurveTo(x, y + h, x, y + h - bl);
  c.lineTo(x, y + tl);
  if (tl) c.quadraticCurveTo(x, y, x + tl, y);
  c.closePath();
}

/**
 * 烫好的样子。
 * 全熔：豆子融成一整片平整的像素，外轮廓只在凸角处稍微圆润，看得到薄片的厚度。
 * 留孔（半熔）：每颗豆被压成圆角小方块，彼此贴住，中间留着小孔。
 */
const fusedCache = new WeakMap<Raster, Map<string, HTMLCanvasElement>>();

function drawFused(ctx: CanvasRenderingContext2D, ras: Raster, grid: Int16Array, o: DrawOpts) {
  const { px, x0 = 0, y0 = 0, style = 'full' } = o;
  const pad = px * 1.5;
  const size = ras.n * px + pad * 2;
  const key = `${px.toFixed(3)}|${style}|${grid === ras.blink ? 1 : 0}|${DPR()}`;
  let byRas = fusedCache.get(ras);
  if (!byRas) fusedCache.set(ras, (byRas = new Map()));
  let off = byRas.get(key);
  if (!off) {
    off = renderFused(ras, grid, px, style);
    byRas.set(key, off);
  }
  ctx.save();
  ctx.shadowColor = 'rgba(80,50,30,0.25)';
  ctx.shadowBlur = px * 1.2;
  ctx.shadowOffsetY = px * 0.45;
  ctx.drawImage(off, x0 - pad, y0 - pad + (o.offsetY ?? 0), size, size);
  ctx.restore();
}

function renderFused(ras: Raster, grid: Int16Array, px: number, style: BeadStyle): HTMLCanvasElement {
  const n = ras.n;
  const dpr = DPR();
  const pad = px * 1.5;
  const size = n * px + pad * 2;
  const off = document.createElement('canvas');
  off.width = off.height = Math.ceil(size * dpr);
  const c = off.getContext('2d')!;
  c.scale(dpr, dpr);
  const has = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && grid[y * n + x] >= 0;
  const full = style === 'full';
  const T = px * (full ? 0.2 : 0.16);
  const r = px * (full ? 0.38 : 0.34);
  const seam = 0.6 / dpr;
  const jitter = (i: number) => (((i * 2654435761) >>> 0) % 7) / 7 - 0.5;

  const each = (fn: (x: number, y: number, hex: string, i: number) => void) => {
    for (let i = 0; i < n * n; i++) {
      const b = grid[i];
      if (b < 0) continue;
      fn(i % n, (i / n) | 0, BEADS[b].hex, i);
    }
  };
  const shape = (cx: number, cy: number, dy: number) => {
    const x = pad + cx * px,
      y = pad + cy * px + dy;
    if (full) {
      const L = has(cx - 1, cy),
        R = has(cx + 1, cy),
        U = has(cx, cy - 1),
        D = has(cx, cy + 1);
      cellPath(c, x, y, px + (R ? seam : 0), px + (D ? seam : 0), [!L && !U ? r : 0, !R && !U ? r : 0, !R && !D ? r : 0, !L && !D ? r : 0]);
    } else {
      const g = px * 0.035;
      cellPath(c, x + g, y + g, px - g * 2, px - g * 2, [r, r, r, r]);
    }
  };

  // 厚度（侧面）
  each((x, y, hex) => {
    c.fillStyle = shade(hex, -0.34);
    shape(x, y, T);
    c.fill();
  });
  // 顶面
  each((x, y, hex, i) => {
    c.fillStyle = shade(hex, jitter(i) * 0.05);
    shape(x, y, 0);
    c.fill();
  });
  if (!full) {
    // 半熔：孔被压小了，只剩一个颜色略深的小点
    each((x, y, hex) => {
      const cx = pad + (x + 0.5) * px,
        cy = pad + (y + 0.5) * px;
      c.fillStyle = shade(hex, -0.26);
      c.beginPath();
      c.arc(cx, cy, px * 0.11, 0, Math.PI * 2);
      c.fill();
    });
  } else {
    // 全熔后豆与豆之间只剩极淡的接缝
    c.strokeStyle = 'rgba(40,25,15,0.05)';
    c.lineWidth = 0.6;
    c.beginPath();
    each((x, y) => {
      if (has(x + 1, y)) {
        c.moveTo(pad + (x + 1) * px, pad + y * px + px * 0.12);
        c.lineTo(pad + (x + 1) * px, pad + y * px + px * 0.88);
      }
      if (has(x, y + 1)) {
        c.moveTo(pad + x * px + px * 0.12, pad + (y + 1) * px);
        c.lineTo(pad + x * px + px * 0.88, pad + (y + 1) * px);
      }
    });
    c.stroke();
  }
  // 薄片顶面的边缘受光
  c.strokeStyle = 'rgba(255,255,255,0.38)';
  c.lineWidth = Math.max(0.8, px * 0.07);
  c.lineCap = 'round';
  c.beginPath();
  each((x, y) => {
    const X = pad + x * px,
      Y = pad + y * px,
      e = px * (full ? 0.2 : 0.3),
      k = c.lineWidth / 2 + px * 0.03;
    if (full ? !has(x, y - 1) : true) {
      c.moveTo(X + e, Y + k);
      c.lineTo(X + px - e, Y + k);
    }
    if (full ? !has(x - 1, y) : false) {
      c.moveTo(X + k, Y + e);
      c.lineTo(X + k, Y + px - e);
    }
  });
  c.stroke();
  // 哑光塑料的细颗粒和柔光
  c.globalCompositeOperation = 'source-atop';
  c.globalAlpha = 0.07;
  c.fillStyle = c.createPattern(noiseTile(), 'repeat')!;
  c.fillRect(0, 0, size, size);
  c.globalAlpha = 1;
  const g = c.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, 'rgba(255,255,255,0.16)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(0,0,0,0.05)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  c.globalCompositeOperation = 'source-over';
  return off;
}

/* ---------------- 熨烫：从豆板上的豆子变成烫好的薄片 ---------------- */

export const MELT_MS = 950;

export const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const bboxCache = new WeakMap<Raster, [number, number]>();
function colSpan(ras: Raster): [number, number] {
  let hit = bboxCache.get(ras);
  if (!hit) {
    let a = ras.n,
      b = -1;
    for (let i = 0; i < ras.bead.length; i++)
      if (ras.bead[i] >= 0) {
        a = Math.min(a, i % ras.n);
        b = Math.max(b, i % ras.n);
      }
    hit = [a, b];
    bboxCache.set(ras, hit);
  }
  return hit;
}

export class Melt {
  private puffs: { x: number; y: number; born: number; s: number }[] = [];

  /** p: 0 = 全是豆子，1 = 全部烫好 */
  draw(ctx: CanvasRenderingContext2D, ras: Raster, o: DrawOpts, p: number, t: number, steam = true) {
    const { px, x0 = 0, y0 = 0 } = o;
    const n = ras.n;
    const W = n * px;
    if (o.board) drawBoard(ctx, n, o);
    const sy = y0 - px + p * (W + px * 2);
    const base = { ...o, board: false, offsetY: 0 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - px * 3, sy, W + px * 6, W + px * 6);
    ctx.clip();
    drawRaster(ctx, ras, { ...base, style: 'bead' });
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - px * 3, y0 - px * 3, W + px * 6, sy - (y0 - px * 3));
    ctx.clip();
    drawRaster(ctx, ras, { ...base, style: 'full' });
    ctx.restore();
    if (p > 0 && p < 1) {
      const [ca, cb] = colSpan(ras);
      const band = px * 2.6;
      const g = ctx.createLinearGradient(0, sy - band, 0, sy + px * 0.8);
      g.addColorStop(0, 'rgba(255,200,140,0)');
      g.addColorStop(0.75, 'rgba(255,216,168,0.55)');
      g.addColorStop(1, 'rgba(255,246,232,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x0 + (ca - 0.6) * px, sy - band, (cb - ca + 2.2) * px, band + px * 0.8);
      if (steam && Math.random() < 0.7) {
        const row = Math.floor((sy - y0) / px);
        if (row >= 0 && row < n) {
          const cells: number[] = [];
          for (let x = 0; x < n; x++) if (ras.bead[row * n + x] >= 0) cells.push(x);
          if (cells.length) {
            const x = cells[Math.floor(Math.random() * cells.length)];
            this.puffs.push({ x: x0 + (x + 0.5) * px, y: sy, born: t, s: Math.random() * 6 });
          }
        }
      }
    }
    this.puffs = this.puffs.filter((f) => t - f.born < 900);
    for (const f of this.puffs) {
      const a = (t - f.born) / 900;
      const x = f.x + Math.sin(a * 4 + f.s) * px * 0.5,
        y = f.y - a * px * 3.4,
        r = px * (0.45 + a * 1.1);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${0.32 * (1 - a)})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
}

/* ---------------- 蛋 ---------------- */

export type EggStyle = 'zigzag' | 'dots' | 'stripes' | 'bands' | 'cap' | 'speckle' | 'spots' | 'marble';
export type EggShape = 'round' | 'normal' | 'tall';

export interface EggRaster {
  n: number;
  bead: Int16Array;
  crack: number[];
}

export interface EggOpts {
  main: number;
  pat: number;
  sub: number;
  style: EggStyle;
  pool: Pool;
  /** spots / marble 里的第二种底色 */
  other?: number;
  /** 撒在蛋壳上的新豆 */
  extra?: number;
  shape?: EggShape;
  seed?: number;
}

export function makeEgg(n: number, o: EggOpts): EggRaster {
  const { main, pat, sub, style, pool, other = pat, extra } = o;
  const bead = new Int16Array(n * n).fill(-1);
  const d = derive(main, pool);
  const [kx, ky] = o.shape === 'round' ? [0.36, 0.4] : o.shape === 'tall' ? [0.3, 0.44] : [0.33, 0.42];
  const cx = n / 2,
    cy = n * 0.55,
    rx = n * kx,
    ry = n * ky;
  const inside = (x: number, y: number) => {
    const v = (y + 0.5 - cy) / ry;
    const rxe = v < 0 ? rx * (1 + 0.2 * v) : rx;
    return Math.pow((x + 0.5 - cx) / rxe, 2) + v * v <= 1;
  };
  const role = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (inside(x, y)) role[y * n + x] = 1;
  const mid = Math.round(cy);
  let s = (o.seed ?? 7) >>> 0 || 7;
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s >>> 8) / 16777216;
  };
  const phase = Math.floor(rnd() * 4);
  const top = Math.round(cy - ry);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (!role[i]) continue;
      let b = main;
      if (style === 'zigzag') {
        const z = mid + ((x + phase) % 4 < 2 ? 0 : 1);
        if (y === z || y === z + 1) b = pat;
        if (y === z - 3 && (x + phase) % 4 === 1) b = sub;
      } else if (style === 'dots') {
        if ((x + phase + (y % 4 < 2 ? 0 : 2)) % 4 === 0 && y % 2 === 0) b = pat;
      } else if (style === 'stripes') {
        if ((x + y + phase) % 5 < 2) b = pat;
      } else if (style === 'bands') {
        if ((y - top + phase) % 4 < 2 && y > top + 1) b = pat;
      } else if (style === 'cap') {
        const edge = top + Math.round(ry * 0.75) + ((x + phase) % 4 < 2 ? 0 : 1);
        if (y < edge) b = pat;
        else if (y === edge + 1 && (x + phase) % 4 === 0) b = sub;
      } else if (style === 'marble') {
        const v = Math.sin(x * 0.55 + Math.sin(y * 0.42 + phase) * 2.2 + phase);
        b = v > 0.15 ? main : v < -0.15 ? other : sub;
      }
      bead[i] = b;
    }
  if (style === 'speckle' || style === 'spots') {
    const cells = [...role.keys()].filter((i) => role[i]);
    const count = Math.round(cells.length * (style === 'spots' ? 0.07 : 0.12));
    for (let k = 0; k < count; k++) {
      const i = cells[Math.floor(rnd() * cells.length)];
      const col = style === 'spots' ? other : rnd() < 0.6 ? pat : sub;
      bead[i] = col;
      // 斑块：往右和往下再长一颗
      if (style === 'spots') for (const j of [i + 1, i + n]) if (role[j] && rnd() < 0.8) bead[j] = col;
    }
  }
  if (extra !== undefined) {
    const cells = [...role.keys()].filter((i) => role[i]);
    for (let k = 0; k < Math.max(3, Math.round(cells.length * 0.03)); k++) bead[cells[Math.floor(rnd() * cells.length)]] = extra;
  }
  // 描边与高光
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (role[i]) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx,
          ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < n && ny < n && role[ny * n + nx] === 1;
      });
      if (nb) bead[i] = d.out;
    }
  const hx = Math.round(cx - rx * 0.45),
    hy = Math.round(cy - ry * 0.45);
  for (const [x, y] of [[hx, hy], [hx, hy + 1], [hx + 1, hy - 1]]) if (role[y * n + x]) bead[y * n + x] = d.hi;
  // 裂缝：一条之字线
  const crack: number[] = [];
  const cyr = mid - 1;
  for (let x = 0; x < n; x++) {
    const y = cyr + (x % 2 === 0 ? 0 : -1) + (x % 4 === 0 ? 1 : 0);
    const i = y * n + x;
    if (role[i]) crack.push(i);
  }
  return { n, bead, crack };
}

const warmSprites = new Map<string, HTMLCanvasElement>();
const WARM_STEP = 0.04;

/** 被孵蛋灯照暖的豆子：原贴图上罩一层暖光，按档位缓存 */
function warmSprite(hex: string, px: number, level: number): HTMLCanvasElement {
  const base = beadSprite(hex, px);
  if (level <= 0) return base;
  const key = `${hex}|${base.width}|${level}`;
  const hit = warmSprites.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = base.width;
  const g = c.getContext('2d')!;
  g.drawImage(base, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = `rgba(255,241,210,${level * WARM_STEP})`;
  g.fillRect(0, 0, c.width, c.height);
  warmSprites.set(key, c);
  return c;
}

export function drawEgg(
  ctx: CanvasRenderingContext2D,
  egg: EggRaster,
  o: DrawOpts & { cracked?: number; angle?: number; /** 0–1，按住蓄力时暖光从蛋底往上灌到哪 */ warm?: number },
) {
  const { px, x0 = 0, y0 = 0 } = o;
  const n = egg.n;
  ctx.save();
  const pivotX = x0 + (n * px) / 2,
    pivotY = y0 + n * px * 0.95;
  ctx.translate(pivotX, pivotY);
  ctx.rotate(o.angle ?? 0);
  ctx.translate(-pivotX, -pivotY);
  const crackSet = new Set(egg.crack.slice(0, o.cracked ?? 0));
  const warm = o.warm ?? 0;
  let top = n,
    bottom = -1;
  if (warm > 0)
    for (let i = 0; i < n * n; i++)
      if (egg.bead[i] >= 0) {
        const r = (i / n) | 0;
        top = Math.min(top, r);
        bottom = Math.max(bottom, r);
      }
  const front = bottom + 1 - warm * (bottom + 1 - top);
  for (let i = 0; i < n * n; i++) {
    const b = egg.bead[i];
    if (b < 0) continue;
    const row = (i / n) | 0;
    const x = x0 + (i % n) * px;
    let y = y0 + row * px;
    let level = 0;
    if (warm > 0) {
      const d = row + 0.5 - front;
      let glow = d > 0 ? 0.06 + 0.04 * warm : 0;
      const near = 1 - Math.abs(d) / 1.5;
      if (near > 0) {
        glow = Math.max(glow, 0.34 * near);
        y -= px * 0.3 * Math.sin(near * Math.PI * 0.5);
      }
      level = Math.round(glow / WARM_STEP);
    }
    if (crackSet.has(i)) {
      const g = ctx.createRadialGradient(x + px / 2, y + px / 2, 0, x + px / 2, y + px / 2, px * 1.2);
      g.addColorStop(0, 'rgba(255,248,220,1)');
      g.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - px * 0.7, y - px * 0.7, px * 2.4, px * 2.4);
      continue;
    }
    ctx.drawImage(warmSprite(BEADS[b].hex, px, level), x, y, px, px);
  }
  ctx.restore();
}

export function setupCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, dpr };
}

export function rasterToDataURL(ras: Raster, px = 16, style: BeadStyle = 'bead', board = false): string {
  const c = document.createElement('canvas');
  const pad = style === 'bead' ? 0 : px;
  c.width = c.height = ras.n * px + pad * 2;
  const ctx = c.getContext('2d')!;
  drawRaster(ctx, ras, { px, x0: pad, y0: pad, style, board });
  return c.toDataURL('image/png');
}
