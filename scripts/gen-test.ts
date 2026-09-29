import { ACCS, BODIES, EYES, Genes, MOUTHS, PATTERNS, RARES, SizeIdx, TOPS, topFits } from '../src/lib/genes';
import { rasterize, EYE } from '../src/lib/creature';
import { encode, decode } from '../src/lib/code';
import { STANDARD, BEADS } from '../src/lib/palette';
import { mulberry32, pick } from '../src/lib/rng';

const r = mulberry32(42);
const pool = STANDARD;
const budget = [7, 8, 9];

function randomGenes(): Genes {
  const body = pick(r, BODIES);
  let top = pick(r, TOPS);
  if (!topFits(body, top)) top = 'none';
  return {
    size: Math.floor(r() * 3) as SizeIdx,
    body,
    top,
    eyes: pick(r, EYES),
    mouth: pick(r, MOUTHS),
    pattern: pick(r, PATTERNS),
    dir: Math.floor(r() * 4) as 0 | 1 | 2 | 3,
    acc: pick(r, ACCS),
    rare: r() < 0.2 ? pick(r, RARES) : 'none',
    blush: r() < 0.5,
    hTop: pick(r, TOPS),
    hPattern: pick(r, PATTERNS),
    quirk: Math.floor(r() * 64),
    colors: { main: pick(r, pool), sub: pick(r, pool), pat: pick(r, pool), acc: pick(r, pool) },
  };
}

function connected(bead: Int16Array, n: number) {
  const start = bead.findIndex((b) => b >= 0);
  if (start < 0) return false;
  const seen = new Uint8Array(n * n);
  const st = [start];
  seen[start] = 1;
  let c = 0;
  while (st.length) {
    const i = st.pop()!;
    c++;
    const x = i % n,
      y = (i / n) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = ny * n + nx;
      if (bead[j] >= 0 && !seen[j]) {
        seen[j] = 1;
        st.push(j);
      }
    }
  }
  return c === bead.filter((b) => b >= 0).length;
}

let fail = 0;
const t0 = performance.now();
for (let k = 0; k < 1000; k++) {
  const g = randomGenes();
  const ras = rasterize(g, pool);
  const code = encode(g);
  const back = decode(code);
  const errs: string[] = [];
  if (!connected(ras.bead, ras.n)) errs.push('not connected');
  if (ras.colors.length > budget[g.size]) errs.push(`colors ${ras.colors.length}`);
  if (!ras.role.some((x) => x === EYE)) errs.push('no eyes');
  if (JSON.stringify(back) !== JSON.stringify(g)) errs.push('code mismatch');
  if (errs.length) {
    fail++;
    if (fail < 8) console.log(k, g.body, g.size, errs.join(', '), code);
  }
}
console.log(`1000 genes, ${fail} failures, ${(performance.now() - t0).toFixed(0)}ms`);

if (process.argv.includes('--show')) {
  const chars = ' #MSPAEH*W';
  const body = process.argv[process.argv.indexOf('--show') + 1] as Genes['body'] | undefined;
  for (let k = 0; k < 6; k++) {
    const g = randomGenes();
    if (body && BODIES.includes(body)) {
      g.body = body;
      if (!topFits(g.body, g.top)) g.top = 'none';
    }
    const ras = rasterize(g, pool);
    console.log(`\n${g.body} ${g.top} ${g.eyes} ${g.mouth} ${g.pattern} ${g.acc} ${g.rare} n=${ras.n} beads=${ras.total} colors=${ras.colors.length} ${ras.colors.map((c) => BEADS[c.bead].code).join(',')}`);
    for (let y = 0; y < ras.n; y++) {
      let line = '';
      for (let x = 0; x < ras.n; x++) line += chars[ras.role[y * ras.n + x]] + ' ';
      console.log(line);
    }
  }
}
