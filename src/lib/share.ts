import { encode as encodeQR } from 'uqr';
import { decode, encode } from './code';
import { roundRect } from './render';

export interface ShareLink {
  code: string;
  name?: string;
  owner?: string;
}

const NICK = 'hatch-beads:nick:v1';

export const loadNick = () => localStorage.getItem(NICK) ?? '';
export const saveNick = (n: string) => localStorage.setItem(NICK, n.trim().slice(0, 8));

/** 本地预览的地址（localhost、局域网）别人扫了打不开 */
export const isLocalHost = () => /^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);

// 中文名用 UTF-8 + base64url，比 %E6%A9%98 这种写法短一半，二维码的点更稀、更好扫
const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (s: string) => {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return undefined;
  }
};

/** 分享链接指向“当前打开的这个网站”，部署在哪里就指向哪里 */
export function shareUrl(l: ShareLink): string {
  let h = 'b=' + l.code.replace(/[^0-9A-Z]/gi, '').replace(/^HD(?=.{16}$)/i, '');
  if (l.name) h += '&n=' + b64(l.name.slice(0, 8));
  if (l.owner) h += '&o=' + b64(l.owner.slice(0, 8));
  return `${location.origin}${location.pathname}#${h}`;
}

export function parseShare(hash: string): ShareLink | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const b = p.get('b');
  if (!b) return null;
  const g = decode(b);
  if (!g) return null;
  const n = p.get('n'),
    o = p.get('o');
  return { code: encode(g), name: (n && unb64(n)) || undefined, owner: (o && unb64(o)) || undefined };
}

/** 从一张保存下来的图片里找二维码或豆码，找到就返回豆码 */
export async function scanImage(img: HTMLImageElement): Promise<ShareLink | null> {
  const { default: jsQR } = await import('jsqr');
  const W = img.naturalWidth,
    H = img.naturalHeight;
  // 先整张图认，认不出来再放大下半部分（出生证和图纸的二维码在底部或右上）
  const tries: [number, number, number, number][] = [
    [0, 0, W, H],
    [0, H * 0.55, W, H * 0.45],
    [W * 0.5, 0, W * 0.5, H * 0.3],
  ];
  for (const [sx, sy, sw, sh] of tries) {
    const s = Math.min(1, 1400 / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * s);
    c.height = Math.round(sh * s);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const hit = jsQR(d.data, c.width, c.height);
    if (!hit) continue;
    const text = hit.data;
    const hash = text.includes('#') ? text.slice(text.indexOf('#')) : '';
    const link = hash ? parseShare(hash) : null;
    if (link) return link;
    const g = decode(text);
    if (g) return { code: encode(g) };
  }
  return null;
}

/** 页面打开时读一次：扫码进来的链接 */
export const initialShare = typeof location !== 'undefined' ? parseShare(location.hash) : null;

export function qrMatrix(text: string) {
  return encodeQR(text, { ecc: 'M', border: 0 });
}

/** 网站地址的短写法，印在图片上：flewolfxy.github.io/hatch-beads */
export const siteLabel = () => (isLocalHost() ? '' : (location.host + location.pathname).replace(/\/$/, ''));

/** 二维码：定位角画成圆角框，其余的点画成圆角小方块，像烫好的豆子 */
export function drawQR(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  const qr = qrMatrix(text);
  const n = qr.size;
  const pad = 10;
  const m = (size - pad * 2) / n;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, x, y, size, size, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(43,35,32,0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const ox = x + pad,
    oy = y + pad;
  ctx.fillStyle = '#2B2320';
  const finder = (fx: number, fy: number) => fx < 7 && fy < 7;
  const isFinder = (i: number, j: number) => finder(i, j) || finder(n - 1 - i, j) || finder(i, n - 1 - j);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      if (!qr.data[j][i] || isFinder(i, j)) continue;
      roundRect(ctx, ox + i * m + m * 0.06, oy + j * m + m * 0.06, m * 0.88, m * 0.88, m * 0.3);
      ctx.fill();
    }
  for (const [fx, fy] of [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ]) {
    const X = ox + fx * m,
      Y = oy + fy * m;
    ctx.lineWidth = m;
    ctx.strokeStyle = '#2B2320';
    roundRect(ctx, X + m / 2, Y + m / 2, m * 6, m * 6, m * 1.6);
    ctx.stroke();
    roundRect(ctx, X + m * 2, Y + m * 2, m * 3, m * 3, m * 0.8);
    ctx.fill();
  }
  ctx.restore();
}

