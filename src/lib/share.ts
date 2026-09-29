import { encode as encodeQR } from 'uqr';
import { decode, encode } from './code';

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

/** 页面打开时读一次：扫码进来的链接 */
export const initialShare = typeof location !== 'undefined' ? parseShare(location.hash) : null;

export function qrMatrix(text: string) {
  return encodeQR(text, { ecc: 'M', border: 0 });
}
