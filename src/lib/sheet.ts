import { minutesFor, Raster } from './creature';
import { BEADS, textOn } from './palette';
import { roundRect } from './render';
import { drawQR } from './share';

export const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
export const MONO = '"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace';

export interface SheetOpts {
  name: string;
  code: string;
  mirror: boolean;
  ring: boolean;
  scale?: number;
  /** 发微信时印二维码 */
  qr?: string;
  /** 发微信时印网址 */
  site?: string;
}

export interface SheetResult {
  width: number;
  height: number;
  list: { bead: number; count: number }[];
  ringCount: number;
  total: number;
}

function ringCells(r: Raster): Set<number> {
  const n = r.n;
  const s = new Set<number>();
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (r.bead[y * n + x] >= 0) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx,
          ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < n && ny < n && r.bead[ny * n + nx] >= 0;
      });
      if (near) s.add(y * n + x);
    }
  return s;
}

export function drawSheet(canvas: HTMLCanvasElement, r: Raster, o: SheetOpts): SheetResult {
  const n = r.n;
  const cs = n <= 16 ? 34 : n <= 20 ? 30 : 26;
  const pad = 28,
    axis = 22,
    header = 92;
  const gridW = n * cs;
  const ring = o.ring ? ringCells(r) : new Set<number>();
  const list = r.colors;
  const cols = Math.max(2, Math.floor((gridW + axis) / 150));
  const legendRows = Math.ceil((list.length + (ring.size ? 1 : 0)) / cols);
  const width = pad * 2 + axis + gridW;
  const height = pad + header + axis + gridW + 36 + 30 + legendRows * 34 + 56;
  const scale = o.scale ?? 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#FFFDF9';
  ctx.fillRect(0, 0, width, height);

  // 头部
  ctx.fillStyle = '#2B2320';
  ctx.font = `700 22px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(o.name, pad, pad + 26);
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = '#8A7F76';
  const total = r.total + ring.size;
  ctx.fillText(`${n}×${n} · ${total} 颗 · ${list.length + (ring.size ? 1 : 0)} 色 · 约 ${minutesFor(total)} 分钟 · MARD 色号`, pad, pad + 50);
  ctx.font = `12px ${MONO}`;
  ctx.fillText(`豆码 ${o.code}`, pad, pad + 72);
  const qs = 84;
  if (o.qr) {
    drawQR(ctx, o.qr, width - pad - qs, pad - 6, qs);
    ctx.fillStyle = '#A99D92';
    ctx.font = `600 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('扫码和它配一窝', width - pad - qs / 2, pad - 6 + qs + 14);
    ctx.textAlign = 'left';
  }
  if (o.mirror) {
    const tag = '镜像施工图 · 拼好翻面烫';
    ctx.font = `600 12px ${FONT}`;
    const tw = ctx.measureText(tag).width + 18;
    const tx = width - pad - tw - (o.qr ? qs + 12 : 0);
    ctx.fillStyle = '#FFE9EC';
    roundRect(ctx, tx, pad + 8, tw, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#E0314B';
    ctx.fillText(tag, tx + 9, pad + 24);
  }

  const gx = pad + axis,
    gy = pad + header + axis;
  // 坐标
  ctx.fillStyle = '#A99D92';
  ctx.font = `600 9px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    ctx.fillText(String(i + 1), gx + (i + 0.5) * cs, gy - axis / 2);
    ctx.fillText(String(i + 1), pad + axis / 2, gy + (i + 0.5) * cs);
  }
  // 格子
  ctx.fillStyle = '#FBF7F1';
  ctx.fillRect(gx, gy, gridW, gridW);
  ctx.font = `700 ${cs >= 30 ? 10 : 9}px ${MONO}`;
  for (let i = 0; i < n * n; i++) {
    const x = gx + (i % n) * cs,
      y = gy + ((i / n) | 0) * cs;
    const b = r.bead[i];
    if (b >= 0) {
      ctx.fillStyle = BEADS[b].hex;
      ctx.fillRect(x, y, cs, cs);
      ctx.fillStyle = textOn(b);
      ctx.globalAlpha = 0.85;
      ctx.fillText(BEADS[b].code, x + cs / 2, y + cs / 2 + 0.5);
      ctx.globalAlpha = 1;
    } else if (ring.has(i)) {
      ctx.strokeStyle = '#9BB8C9';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(x + cs / 2, y + cs / 2, cs * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#7F9DB0';
      ctx.fillText('透', x + cs / 2, y + cs / 2 + 0.5);
    }
  }
  // 网格线
  for (let i = 0; i <= n; i++) {
    const major = i % 5 === 0 || i === n;
    ctx.strokeStyle = major ? 'rgba(43,35,32,0.35)' : 'rgba(43,35,32,0.1)';
    ctx.lineWidth = major ? 1 : 0.6;
    ctx.beginPath();
    ctx.moveTo(gx + i * cs, gy);
    ctx.lineTo(gx + i * cs, gy + gridW);
    ctx.moveTo(gx, gy + i * cs);
    ctx.lineTo(gx + gridW, gy + i * cs);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,46,77,0.55)';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gx + gridW / 2, gy);
  ctx.lineTo(gx + gridW / 2, gy + gridW);
  ctx.moveTo(gx, gy + gridW / 2);
  ctx.lineTo(gx + gridW, gy + gridW / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 用豆清单
  let ly = gy + gridW + 36;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#2B2320';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText('用豆清单', pad, ly);
  ctx.fillStyle = '#A99D92';
  ctx.font = `12px ${FONT}`;
  ctx.fillText('括号里是建议备用量', pad + 66, ly);
  ly += 16;
  const cw = (width - pad * 2) / cols;
  const items: { hex: string; code: string; count: number; clear?: boolean }[] = list.map((c) => ({
    hex: BEADS[c.bead].hex,
    code: BEADS[c.bead].code,
    count: c.count,
  }));
  if (ring.size) items.push({ hex: '#EAF3F8', code: '透明豆', count: ring.size, clear: true });
  items.forEach((it, idx) => {
    const x = pad + (idx % cols) * cw,
      y = ly + Math.floor(idx / cols) * 34;
    ctx.fillStyle = it.hex;
    ctx.beginPath();
    ctx.arc(x + 10, y + 13, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.stroke();
    ctx.fillStyle = '#2B2320';
    ctx.font = `700 13px ${MONO}`;
    ctx.fillText(it.code, x + 26, y + 18);
    const cwid = ctx.measureText(it.code).width;
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = '#5B514A';
    ctx.fillText(`× ${it.count}`, x + 32 + cwid, y + 18);
    const w2 = ctx.measureText(`× ${it.count}`).width;
    ctx.fillStyle = '#B3A89E';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(`(${Math.ceil(it.count * 1.08) + 1})`, x + 36 + cwid + w2, y + 18);
  });
  ctx.fillStyle = '#B3A89E';
  ctx.font = `11px ${o.site ? MONO : FONT}`;
  ctx.fillText(o.site ? `孵豆 · ${o.site} · 色值为屏幕近似色，以实物豆为准` : '孵豆 · 屏幕里孵，手里出生 · 色值为屏幕近似色，以实物豆为准', pad, height - 22);
  return { width, height, list, ringCount: ring.size, total };
}
