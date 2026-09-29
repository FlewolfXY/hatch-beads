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

export function beadSprite(hex: string, px: number, glass = false): HTMLCanvasElement {
  const size = Math.max(2, Math.round(px));
  const key = `${hex}|${size}|${glass ? 1 : 0}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const m = size / 2;
  const r = size * 0.46;
  if (size < 7) {
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.arc(m, m, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalAlpha = glass ? 0.75 : 1;
    ctx.fillStyle = 'rgba(70,45,25,0.16)';
    ctx.beginPath();
    ctx.arc(m, m + size * 0.04, r, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(size * 0.36, size * 0.32, 0, m, m, r * 1.15);
    g.addColorStop(0, shade(hex, 0.3));
    g.addColorStop(0.5, hex);
    g.addColorStop(1, shade(hex, -0.16));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(m, m, r, 0, Math.PI * 2);
    ctx.fill();
    // 孔
    const hr = size * 0.15;
    const hg = ctx.createRadialGradient(m - hr * 0.3, m - hr * 0.3, 0, m, m, hr);
    hg.addColorStop(0, shade(hex, -0.42));
    hg.addColorStop(1, shade(hex, -0.22));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(m, m, hr, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.globalAlpha = glass ? 0.9 : 0.55;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(size * 0.33, size * 0.27, size * 0.12, size * 0.07, -0.6, 0, Math.PI * 2);
    ctx.fill();
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

function drawFused(ctx: CanvasRenderingContext2D, ras: Raster, grid: Int16Array, o: DrawOpts) {
  const { px, x0 = 0, y0 = 0, style } = o;
  const n = ras.n;
  const off = document.createElement('canvas');
  off.width = off.height = Math.ceil(n * px + px * 2);
  const c = off.getContext('2d')!;
  const pad = px;
  const rr = style === 'full' ? px * 0.62 : px * 0.55;
  for (let i = 0; i < n * n; i++) {
    const b = grid[i];
    if (b < 0) continue;
    const x = pad + ((i % n) + 0.5) * px,
      y = pad + (((i / n) | 0) + 0.5) * px;
    c.fillStyle = BEADS[b].hex;
    c.beginPath();
    c.arc(x, y, rr, 0, Math.PI * 2);
    c.fill();
  }
  // 熔化后的细节
  for (let i = 0; i < n * n; i++) {
    const b = grid[i];
    if (b < 0) continue;
    const x = pad + ((i % n) + 0.5) * px,
      y = pad + (((i / n) | 0) + 0.5) * px;
    if (style === 'hole') {
      c.fillStyle = shade(BEADS[b].hex, -0.3);
      c.beginPath();
      c.arc(x, y, px * 0.14, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.beginPath();
      c.arc(x - px * 0.18, y - px * 0.2, px * 0.12, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillStyle = 'rgba(0,0,0,0.05)';
      c.beginPath();
      c.arc(x, y, px * 0.06, 0, Math.PI * 2);
      c.fill();
    }
  }
  // 整体塑料光泽
  c.globalCompositeOperation = 'source-atop';
  const g = c.createLinearGradient(0, 0, off.width, off.height);
  g.addColorStop(0, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.45, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.08)');
  c.fillStyle = g;
  c.fillRect(0, 0, off.width, off.height);
  ctx.save();
  ctx.shadowColor = 'rgba(80,50,30,0.22)';
  ctx.shadowBlur = px * 0.9;
  ctx.shadowOffsetY = px * 0.35;
  ctx.drawImage(off, x0 - pad, y0 - pad);
  ctx.restore();
}

/* ---------------- 蛋 ---------------- */

export type EggStyle = 'zigzag' | 'dots' | 'stripes' | 'split';

export interface EggRaster {
  n: number;
  bead: Int16Array;
  crack: number[];
}

export function makeEgg(n: number, main: number, pat: number, sub: number, style: EggStyle, pool: Pool, other?: number): EggRaster {
  const bead = new Int16Array(n * n).fill(-1);
  const d = derive(main, pool);
  const cx = n / 2,
    cy = n * 0.55,
    rx = n * 0.33,
    ry = n * 0.42;
  const inside = (x: number, y: number) => {
    const v = (y + 0.5 - cy) / ry;
    const rxe = v < 0 ? rx * (1 + 0.2 * v) : rx;
    return Math.pow((x + 0.5 - cx) / rxe, 2) + v * v <= 1;
  };
  const role = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (inside(x, y)) role[y * n + x] = 1;
  const mid = Math.round(cy);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (!role[i]) continue;
      let b = main;
      if (style === 'zigzag') {
        const z = mid + (x % 4 < 2 ? 0 : 1);
        if (y === z || y === z + 1) b = pat;
        if (y === z - 3 && x % 4 === 1) b = sub;
      } else if (style === 'dots') {
        if ((x + (y % 4 < 2 ? 0 : 2)) % 4 === 0 && y % 2 === 0) b = pat;
      } else if (style === 'stripes') {
        if ((x + y) % 5 < 2) b = pat;
      } else if (style === 'split' && other !== undefined) {
        const seam = cx + (y % 4 < 2 ? 0 : 1) - 0.5;
        b = x < seam ? main : other;
        if ((x * 7 + y * 3) % 11 === 0) b = pat;
      }
      bead[i] = b;
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

export function drawEgg(ctx: CanvasRenderingContext2D, egg: EggRaster, o: DrawOpts & { cracked?: number; angle?: number }) {
  const { px, x0 = 0, y0 = 0 } = o;
  const n = egg.n;
  ctx.save();
  const pivotX = x0 + (n * px) / 2,
    pivotY = y0 + n * px * 0.95;
  ctx.translate(pivotX, pivotY);
  ctx.rotate(o.angle ?? 0);
  ctx.translate(-pivotX, -pivotY);
  const crackSet = new Set(egg.crack.slice(0, o.cracked ?? 0));
  for (let i = 0; i < n * n; i++) {
    const b = egg.bead[i];
    if (b < 0) continue;
    const x = x0 + (i % n) * px,
      y = y0 + ((i / n) | 0) * px;
    if (crackSet.has(i)) {
      const g = ctx.createRadialGradient(x + px / 2, y + px / 2, 0, x + px / 2, y + px / 2, px * 1.2);
      g.addColorStop(0, 'rgba(255,248,220,1)');
      g.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - px * 0.7, y - px * 0.7, px * 2.4, px * 2.4);
      continue;
    }
    ctx.drawImage(beadSprite(BEADS[b].hex, px), x, y, px, px);
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
