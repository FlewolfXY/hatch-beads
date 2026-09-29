import { chroma, deltaE, Lab, rgbToLab } from './color';
import { Dir, PhotoColor, PhotoInfo } from './genes';
import { BEADS, dE, lighter, darker, nearest, Pool } from './palette';
import { hashNums, mulberry32 } from './rng';

export interface LabeledPoint {
  x: number;
  y: number;
  label: string;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

export function thumb(img: HTMLImageElement, max = 520, quality = 0.8): string {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

function crop(img: HTMLImageElement, nx: number, ny: number, size = 120): string {
  const W = img.naturalWidth,
    H = img.naturalHeight;
  const side = Math.min(W, H) * 0.2;
  const sx = Math.max(0, Math.min(W - side, nx * W - side / 2));
  const sy = Math.max(0, Math.min(H - side, ny * H - side / 2));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d')!.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.82);
}

const POS_NAMES = [
  ['左上', '上方', '右上'],
  ['左边', '中间', '右边'],
  ['左下', '下方', '右下'],
];

export function posName(x: number, y: number) {
  return POS_NAMES[Math.min(2, Math.floor(y * 3))][Math.min(2, Math.floor(x * 3))];
}

export async function analyze(img: HTMLImageElement, pool: Pool, points?: LabeledPoint[]): Promise<PhotoInfo> {
  const max = 120;
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(8, Math.round(img.naturalWidth * s));
  const h = Math.max(8, Math.round(img.naturalHeight * s));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const N = w * h;
  const labs: Lab[] = new Array(N);
  let seed = 0x9e3779b9;
  let sumL = 0,
    sumC = 0,
    sumWarm = 0;
  for (let i = 0; i < N; i++) {
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2];
    const lab = rgbToLab([r, g, b]);
    labs[i] = lab;
    sumL += lab[0];
    sumC += chroma(lab);
    sumWarm += lab[2] * 0.7 + lab[1] * 0.3;
    if (i % 7 === 0) seed = hashNums(seed, r, g, b);
  }

  // k-means++ in Lab
  const K = 10;
  const rng = mulberry32(seed);
  const cents: Lab[] = [labs[Math.floor(rng() * N)]];
  const dist = new Float32Array(N);
  while (cents.length < K) {
    let total = 0;
    for (let i = 0; i < N; i++) {
      let m = Infinity;
      for (const ct of cents) {
        const d = (labs[i][0] - ct[0]) ** 2 + (labs[i][1] - ct[1]) ** 2 + (labs[i][2] - ct[2]) ** 2;
        if (d < m) m = d;
      }
      dist[i] = m;
      total += m;
    }
    let x = rng() * total;
    let idx = 0;
    for (; idx < N - 1; idx++) {
      x -= dist[idx];
      if (x <= 0) break;
    }
    cents.push([...labs[idx]] as Lab);
  }
  const assign = new Uint8Array(N);
  for (let it = 0; it < 10; it++) {
    const acc = cents.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < N; i++) {
      let best = 0,
        bd = Infinity;
      for (let k = 0; k < K; k++) {
        const ct = cents[k];
        const d = (labs[i][0] - ct[0]) ** 2 + (labs[i][1] - ct[1]) ** 2 + (labs[i][2] - ct[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      assign[i] = best;
      const a = acc[best];
      a[0] += labs[i][0];
      a[1] += labs[i][1];
      a[2] += labs[i][2];
      a[3]++;
    }
    for (let k = 0; k < K; k++) if (acc[k][3]) cents[k] = [acc[k][0] / acc[k][3], acc[k][1] / acc[k][3], acc[k][2] / acc[k][3]];
  }
  const counts = new Array(K).fill(0);
  for (let i = 0; i < N; i++) counts[assign[i]]++;

  // 聚类 → 豆
  interface Cl {
    ks: number[];
    lab: Lab;
    weight: number;
    bead: number;
  }
  let cls: Cl[] = cents
    .map((lab, k) => ({ ks: [k], lab, weight: counts[k] / N, bead: nearest(lab, pool) }))
    .filter((c) => c.weight > 0.008);
  // 同一颗豆，或者色差太小，就合并
  cls.sort((a, b) => b.weight - a.weight);
  const merged: Cl[] = [];
  for (const cl of cls) {
    const hit = merged.find((m) => m.bead === cl.bead || deltaE(m.lab, cl.lab) < 7);
    if (hit) {
      hit.ks.push(...cl.ks);
      hit.weight += cl.weight;
    } else merged.push(cl);
  }
  cls = merged;
  // 多样性选色：最多 5 种
  const chosen: Cl[] = [];
  const rest = [...cls];
  while (chosen.length < 5 && rest.length) {
    let bi = 0,
      bs = -1;
    rest.forEach((c, i) => {
      const md = chosen.length ? Math.min(...chosen.map((x) => dE(x.bead, c.bead))) : 50;
      const sc = Math.pow(c.weight, 0.6) * Math.pow(Math.max(md, 1), 1.1) * (1 + chroma(c.lab) / 32);
      if (sc > bs) {
        bs = sc;
        bi = i;
      }
    });
    const pickd = rest.splice(bi, 1)[0];
    if (chosen.length >= 3 && pickd.weight < 0.012) break;
    chosen.push(pickd);
  }

  // 每种颜色在照片里最“成片”的位置
  const colors: PhotoColor[] = chosen.map((cl) => {
    const ks = new Set(cl.ks);
    let best = 0,
      bs = -Infinity;
    for (let y = 2; y < h - 2; y += 1)
      for (let x = 2; x < w - 2; x += 1) {
        const i = y * w + x;
        if (!ks.has(assign[i])) continue;
        let same = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (ks.has(assign[(y + dy) * w + x + dx])) same++;
        const sc = same * 2 - deltaE(labs[i], cl.lab) * 0.6 - Math.abs(x / w - 0.5) * 3 - Math.abs(y / h - 0.5) * 3;
        if (sc > bs) {
          bs = sc;
          best = i;
        }
      }
    const nx = ((best % w) + 0.5) / w,
      ny = (Math.floor(best / w) + 0.5) / h;
    let label = posName(nx, ny);
    if (points?.length) {
      let bd = Infinity;
      for (const p of points) {
        const d = Math.hypot(p.x - nx, p.y - ny);
        if (d < bd && d < 0.3) {
          bd = d;
          label = p.label;
        }
      }
    }
    return { bead: cl.bead, weight: cl.weight, pos: [nx, ny] as [number, number], label, crop: crop(img, nx, ny) };
  });
  // 太单色的照片：补一颗深一点、一颗浅一点
  if (colors.length < 3) {
    const base = colors[0];
    const used = colors.map((c) => c.bead);
    const extra = [lighter(base.bead, pool, 22, used), darker(base.bead, pool, 22, used)];
    for (const b of extra) {
      if (colors.length >= 3) break;
      if (!colors.some((c) => c.bead === b)) colors.push({ bead: b, weight: 0.05, pos: base.pos, label: '补色', crop: base.crop, derived: true });
    }
  }

  // 线条方向与纹理（Sobel）
  const bins = [0, 0, 0, 0];
  let magSum = 0,
    strong = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const Lp = (xx: number, yy: number) => labs[yy * w + xx][0];
      const gx = Lp(x + 1, y - 1) + 2 * Lp(x + 1, y) + Lp(x + 1, y + 1) - Lp(x - 1, y - 1) - 2 * Lp(x - 1, y) - Lp(x - 1, y + 1);
      const gy = Lp(x - 1, y + 1) + 2 * Lp(x, y + 1) + Lp(x + 1, y + 1) - Lp(x - 1, y - 1) - 2 * Lp(x, y - 1) - Lp(x + 1, y - 1);
      const m = Math.hypot(gx, gy);
      magSum += m;
      if (m < 40) continue;
      strong++;
      // 线条方向垂直于梯度；y 轴向上计算
      let phi = (Math.atan2(-gy, gx) * 180) / Math.PI + 90;
      phi = ((phi % 180) + 180) % 180;
      const bin = Math.round(phi / 45) % 4;
      bins[bin] += m;
    }
  const totalBins = bins.reduce((a, b) => a + b, 0) || 1;
  let edgeDir: Dir = 0;
  bins.forEach((v, i) => {
    if (v > bins[edgeDir]) edgeDir = i as Dir;
  });
  // 0: 横 1: / 2: 竖 3: \
  const share = bins[edgeDir] / totalBins;
  const edgeStrength = Math.max(0, (share - 0.25) / 0.75) * Math.min(1, strong / (N * 0.06));
  const texture = Math.min(1, magSum / N / 90);
  void BEADS;
  return {
    colors,
    bright: sumL / N,
    sat: sumC / N,
    warm: sumWarm / N,
    edgeDir,
    edgeStrength,
    texture,
    seed,
  };
}
