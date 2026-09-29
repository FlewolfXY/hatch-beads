import { encode } from './code';
import { Raster } from './creature';
import { tags } from './genes';
import { BEADS, L } from './palette';
import { beadSprite, drawBoard, drawRaster, roundRect } from './render';
import { FONT, MONO } from './sheet';
import { Creature } from './store';
import { loadImage } from './extract';
import { hexToRgb, rgbToHex, RGB } from './color';

const INK = '#2B2320';
const MUTED = '#8A7F76';
const PAPER = '#FBF6EE';

export const fmtDate = (t: number, withTime = false) => {
  const d = new Date(t);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}${withTime ? ` ${p(d.getHours())}:${p(d.getMinutes())}` : ''}`;
};
const shortDate = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

function tint(hex: string, t: number) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t] as RGB);
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, gap: number, align: 'center' | 'left' = 'center') {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let cx = align === 'center' ? x - total / 2 : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + gap;
  });
  ctx.textAlign = prev;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW) {
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number, focus: [number, number] = [0.5, 0.5]) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s,
    sh = h / s;
  const sx = Math.max(0, Math.min(img.naturalWidth - sw, focus[0] * img.naturalWidth - sw / 2));
  const sy = Math.max(0, Math.min(img.naturalHeight - sh, focus[1] * img.naturalHeight - sh / 2));
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
  return { s, ox: x - sx * s, oy: y - sy * s };
}

function corners(ctx: CanvasRenderingContext2D, c: Creature, W: number, H: number) {
  const cols = [c.genes.colors.main, c.genes.colors.pat, c.genes.colors.acc, c.genes.colors.sub];
  const px = 18;
  const shape = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]];
  const put = (ox: number, oy: number, fx: number, fy: number) =>
    shape.forEach(([x, y], i) => ctx.drawImage(beadSprite(BEADS[cols[i % cols.length]].hex, px), ox + x * px * fx, oy + y * px * fy, px, px));
  put(58, 58, 1, 1);
  put(W - 58 - px, 58, -1, 1);
  put(58, H - 58 - px, 1, -1);
  put(W - 58 - px, H - 58 - px, -1, -1);
}

function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, date: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.2);
  ctx.strokeStyle = 'rgba(224,49,75,0.85)';
  ctx.fillStyle = 'rgba(224,49,75,0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText('已出生', 0, 10);
  ctx.font = `600 18px ${MONO}`;
  ctx.fillText(date, 0, 44);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText('在你手里', 0, -34);
  ctx.restore();
}

export async function drawCert(canvas: HTMLCanvasElement, c: Creature, ras: Raster) {
  const W = 1080,
    H = 1440;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const main = BEADS[c.genes.colors.main].hex;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  roundRect(ctx, 36, 36, W - 72, H - 72, 40);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(43,35,32,0.35)';
  roundRect(ctx, 50, 50, W - 100, H - 100, 30);
  ctx.stroke();
  corners(ctx, c, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `800 64px ${FONT}`;
  spaced(ctx, '出生证', W / 2, 150, 18);
  ctx.font = `600 18px ${FONT}`;
  ctx.fillStyle = MUTED;
  spaced(ctx, 'BIRTH CERTIFICATE · 孵豆', W / 2, 188, 5);
  ctx.font = `500 20px ${MONO}`;
  ctx.fillText(`No. ${encode(c.genes)}`, W / 2, 222);

  // 豆板
  const bs = 540,
    bx = (W - bs) / 2,
    by = 252;
  ctx.fillStyle = tint(main, 0.86);
  roundRect(ctx, bx, by, bs, bs, 44);
  ctx.fill();
  const px = Math.floor((bs * 0.84) / ras.n);
  const gw = px * ras.n;
  drawBoard(ctx, ras.n, { px, x0: bx + (bs - gw) / 2, y0: by + (bs - gw) / 2, boardColor: 'rgba(255,255,255,0.35)', pegColor: 'rgba(90,70,50,0.12)' });
  drawRaster(ctx, ras, { px, x0: bx + (bs - gw) / 2, y0: by + (bs - gw) / 2 });
  if (c.madeAt) stamp(ctx, bx + bs - 40, by + bs - 50, fmtDate(c.madeAt));

  // 名字
  ctx.fillStyle = INK;
  ctx.font = `800 60px ${FONT}`;
  ctx.fillText(c.name, W / 2, by + bs + 88);
  // 标签
  const tg = tags(c.genes);
  ctx.font = `600 22px ${FONT}`;
  const tw = tg.map((t) => ctx.measureText(t).width + 36);
  let tx = W / 2 - (tw.reduce((a, b) => a + b, 0) + 12 * (tg.length - 1)) / 2;
  const ty = by + bs + 118;
  tg.forEach((t, i) => {
    ctx.fillStyle = tint(main, 0.8);
    roundRect(ctx, tx, ty, tw[i], 40, 20);
    ctx.fill();
    ctx.fillStyle = L(c.genes.colors.main) > 40 ? INK : main;
    ctx.fillText(t, tx + tw[i] / 2, ty + 28);
    tx += tw[i] + 12;
  });

  // 信息行
  const x1 = 130,
    x2 = 270;
  let y = ty + 104;
  const row = (label: string, value: string, color = INK) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = MUTED;
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(label, x1, y);
    ctx.fillStyle = color;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(value, x2, y);
    y += 58;
  };
  row('孵化', `${fmtDate(c.createdAt, true)} · 在屏幕里`);
  row('出生', c.madeAt ? `${fmtDate(c.madeAt)} · 在你手里` : '等你亲手拼好的那天', c.madeAt ? INK : '#B3A89E');
  if (c.parents?.length) row('爸妈', c.parents.map((p) => p.name).join(' × '));
  else if (c.photo) row('来自', c.photo.title);

  // 颜色来源
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText('颜色', x1, y);
  const order = [c.genes.colors.main, c.genes.colors.pat, c.genes.colors.sub, c.genes.colors.acc];
  const rank = (b: number) => (order.indexOf(b) < 0 ? 9 : order.indexOf(b));
  const sources = (c.photo?.colors.filter((p) => !p.derived) ?? []).sort((a, b) => rank(a.bead) - rank(b.bead)).slice(0, 4);
  const beadsShown = sources.length
    ? sources.map((s) => ({ bead: s.bead, label: s.label ?? '', crop: s.crop }))
    : [c.genes.colors.main, c.genes.colors.pat, c.genes.colors.acc].map((b) => ({ bead: b, label: '', crop: undefined as string | undefined }));
  let cx = x2;
  for (const s of beadsShown) {
    if (s.crop) {
      try {
        const img = await loadImage(s.crop);
        cover(ctx, img, cx, y - 34, 46, 46, 12);
      } catch {
        /* ignore */
      }
      ctx.drawImage(beadSprite(BEADS[s.bead].hex, 30), cx + 30, y - 10, 30, 30);
    } else ctx.drawImage(beadSprite(BEADS[s.bead].hex, 40), cx, y - 30, 40, 40);
    ctx.fillStyle = INK;
    ctx.font = `700 20px ${MONO}`;
    ctx.fillText(BEADS[s.bead].code, cx + 68, y - 8);
    ctx.fillStyle = MUTED;
    ctx.font = `500 17px ${FONT}`;
    if (s.label) ctx.fillText(s.label, cx + 68, y + 16);
    cx += 170;
    if (cx > W - 200) break;
  }
  y += 74;

  // 那天的一句话
  ctx.fillStyle = MUTED;
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText('那天', x1, y);
  ctx.font = `500 26px ${FONT}`;
  if (c.note) {
    ctx.fillStyle = INK;
    const lines = wrap(ctx, `“${c.note}”`, W - x2 - 130).slice(0, 2);
    lines.forEach((ln, i) => ctx.fillText(ln, x2, y + i * 38));
  } else {
    ctx.fillStyle = '#C9BFB5';
    ctx.fillText('写一句那天的话（可选）', x2, y);
  }

  // 底部
  ctx.fillStyle = '#B3A89E';
  ctx.font = `500 20px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${ras.n}×${ras.n} · ${ras.total} 颗 · ${ras.colors.length} 色`, 110, H - 92);
  ctx.textAlign = 'right';
  ctx.fillText('孵豆 · 屏幕里孵，手里出生', W - 110, H - 92);
}

export async function drawTriptych(canvas: HTMLCanvasElement, c: Creature, ras: Raster) {
  const W = 1080,
    H = 1440;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const main = BEADS[c.genes.colors.main].hex;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText('它的颜色，来自这里', 64, 108);
  ctx.fillStyle = MUTED;
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(`${c.photo?.title ?? c.name} · ${fmtDate(c.createdAt)}`, 64, 150);

  // 照片
  const px0 = 64,
    py0 = 180,
    pw = W - 128,
    ph = 760;
  if (c.photo?.thumb) {
    const img = await loadImage(c.photo.thumb);
    const key = c.photo.colors.filter((p) => !p.derived && (p.bead === c.genes.colors.main || p.bead === c.genes.colors.pat));
    const focus: [number, number] = key.length
      ? [key.reduce((a, p) => a + p.pos[0], 0) / key.length, key.reduce((a, p) => a + p.pos[1], 0) / key.length]
      : [0.5, 0.5];
    const { s, ox, oy } = cover(ctx, img, px0, py0, pw, ph, 32, focus);
    ctx.save();
    roundRect(ctx, px0, py0, pw, ph, 32);
    ctx.clip();
    const used = new Set(Object.values(c.genes.colors));
    for (const col of c.photo.colors.filter((p) => !p.derived && used.has(p.bead)).slice(0, 5)) {
      const x = ox + col.pos[0] * img.naturalWidth * s,
        y = oy + col.pos[1] * img.naturalHeight * s;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(beadSprite(BEADS[col.bead].hex, 36), x - 18, y - 18, 36, 36);
      const label = `${BEADS[col.bead].code}${col.label ? ' · ' + col.label : ''}`;
      ctx.font = `700 22px ${FONT}`;
      const lw = ctx.measureText(label).width + 28;
      const lx = Math.min(px0 + pw - lw - 12, x + 30);
      ctx.fillStyle = 'rgba(43,35,32,0.78)';
      roundRect(ctx, lx, y - 20, lw, 40, 20);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, lx + 14, y + 8);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = tint(main, 0.8);
    roundRect(ctx, px0, py0, pw, ph, 32);
    ctx.fill();
  }

  // 两个小框
  const bw = 436,
    bh = 380,
    by = 972;
  const lx = 64,
    rx = W - 64 - bw;
  ctx.fillStyle = tint(main, 0.86);
  roundRect(ctx, lx, by, bw, bh, 32);
  ctx.fill();
  const px = Math.floor((bh * 0.78) / ras.n);
  const gw = px * ras.n;
  const gy = by + (bh - gw) / 2 - 16;
  drawBoard(ctx, ras.n, { px, x0: lx + (bw - gw) / 2, y0: gy, boardColor: 'rgba(255,255,255,0.4)' });
  drawRaster(ctx, ras, { px, x0: lx + (bw - gw) / 2, y0: gy });

  let rightLabel: string;
  if (c.madePhoto) {
    const img = await loadImage(c.madePhoto);
    cover(ctx, img, rx, by, bw, bh, 32);
    rightLabel = `${shortDate(c.madeAt ?? Date.now())} 在手里出生`;
  } else {
    ctx.fillStyle = '#EFE7DC';
    roundRect(ctx, rx, by, bw, bh, 32);
    ctx.fill();
    drawRaster(ctx, ras, { px, x0: rx + (bw - gw) / 2, y0: gy, style: 'hole' });
    rightLabel = '烫好以后 · 渲染图';
  }
  const pill = (text: string, cx: number) => {
    ctx.font = `700 22px ${FONT}`;
    const tw = ctx.measureText(text).width + 32;
    ctx.fillStyle = 'rgba(43,35,32,0.82)';
    roundRect(ctx, cx - tw / 2, by + bh - 52, tw, 38, 19);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, by + bh - 26);
  };
  pill(`${shortDate(c.createdAt)} 在屏幕里孵化`, lx + bw / 2);
  pill(rightLabel, rx + bw / 2);
  // 箭头
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const ax = W / 2,
    ay = by + bh / 2;
  ctx.beginPath();
  ctx.moveTo(ax - 18, ay);
  ctx.lineTo(ax + 16, ay);
  ctx.moveTo(ax + 4, ay - 12);
  ctx.lineTo(ax + 18, ay);
  ctx.lineTo(ax + 4, ay + 12);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(`${c.name} · ${encode(c.genes)}`, 64, H - 40);
  ctx.textAlign = 'right';
  ctx.fillText('孵豆 · 屏幕里孵，手里出生', W - 64, H - 40);
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}
