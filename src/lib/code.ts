import { ACCS, BODIES, Dir, EYES, Genes, MOUTHS, PATTERNS, RARES, SizeIdx, TOPS } from './genes';
import { BEADS } from './palette';

const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = 1;

type Field = [number, number];

function fields(g: Genes): Field[] {
  return [
    [VERSION, 2],
    [g.size, 2],
    [BODIES.indexOf(g.body), 3],
    [TOPS.indexOf(g.top), 3],
    [EYES.indexOf(g.eyes), 3],
    [MOUTHS.indexOf(g.mouth), 2],
    [PATTERNS.indexOf(g.pattern), 3],
    [g.dir, 2],
    [ACCS.indexOf(g.acc), 2],
    [RARES.indexOf(g.rare), 2],
    [g.blush ? 1 : 0, 1],
    [TOPS.indexOf(g.hTop), 3],
    [PATTERNS.indexOf(g.hPattern), 3],
    [g.quirk & 63, 6],
    [g.colors.main, 9],
    [g.colors.sub, 9],
    [g.colors.pat, 9],
    [g.colors.acc, 9],
  ];
}

function checksum(bits: number[]): number {
  let h = 0x2f;
  for (let i = 0; i < bits.length; i++) h = ((h * 31) ^ (bits[i] * (i + 7))) & 0x7f;
  return h;
}

export function encode(g: Genes): string {
  const bits: number[] = [];
  for (const [v, n] of fields(g)) for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1);
  const cs = checksum(bits);
  for (let i = 6; i >= 0; i--) bits.push((cs >> i) & 1);
  let s = '';
  for (let i = 0; i < 80; i += 5) {
    let v = 0;
    for (let j = 0; j < 5; j++) v = (v << 1) | bits[i + j];
    s += ALPHA[v];
  }
  return `HD-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}

export function decode(input: string): Genes | null {
  let s = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.length === 18 && s.startsWith('HD')) s = s.slice(2);
  s = s.replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
  if (s.length !== 16) return null;
  const bits: number[] = [];
  for (const ch of s) {
    const v = ALPHA.indexOf(ch);
    if (v < 0) return null;
    for (let j = 4; j >= 0; j--) bits.push((v >> j) & 1);
  }
  const body = bits.slice(0, 73);
  let cs = 0;
  for (let i = 73; i < 80; i++) cs = (cs << 1) | bits[i];
  if (checksum(body) !== cs) return null;
  let p = 0;
  const read = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | body[p++];
    return v;
  };
  const ver = read(2);
  if (ver !== VERSION) return null;
  const size = read(2);
  const g: Genes = {
    size: Math.min(2, size) as SizeIdx,
    body: BODIES[read(3)],
    top: TOPS[read(3)],
    eyes: EYES[read(3)] ?? 'dot',
    mouth: MOUTHS[read(2)],
    pattern: PATTERNS[read(3)] ?? 'none',
    dir: read(2) as Dir,
    acc: ACCS[read(2)],
    rare: RARES[read(2)],
    blush: read(1) === 1,
    hTop: TOPS[read(3)],
    hPattern: PATTERNS[read(3)] ?? 'none',
    quirk: read(6),
    colors: { main: read(9), sub: read(9), pat: read(9), acc: read(9) },
  };
  const max = BEADS.length - 1;
  if ([g.colors.main, g.colors.sub, g.colors.pat, g.colors.acc].some((c) => c > max)) return null;
  return g;
}
