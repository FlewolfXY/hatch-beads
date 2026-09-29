import { BEADS, C, dE, L, lighter, darker, nearest, Pool } from './palette';
import { Lab, mixLab, deltaE } from './color';
import { hashNums, mulberry32, pick, Rng, weighted } from './rng';

export const BODIES = ['mochi', 'bean', 'cat', 'bird', 'jelly', 'ghost', 'mush', 'dino'] as const;
export const TOPS = ['none', 'bunny', 'catear', 'sprout', 'antenna', 'horn', 'flower', 'ahoge'] as const;
export const EYES = ['dot', 'sparkle', 'sleepy', 'happy', 'wink'] as const;
export const MOUTHS = ['none', 'smile', 'w', 'o'] as const;
export const PATTERNS = ['none', 'stripes', 'dots', 'belly', 'heart', 'fade'] as const;
export const ACCS = ['none', 'scarf', 'bow', 'bell'] as const;
export const RARES = ['none', 'glass', 'glow', 'pearl'] as const;

export type Body = (typeof BODIES)[number];
export type Top = (typeof TOPS)[number];
export type Eyes = (typeof EYES)[number];
export type Mouth = (typeof MOUTHS)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Acc = (typeof ACCS)[number];
export type Rare = (typeof RARES)[number];
export type Dir = 0 | 1 | 2 | 3;

export const BODY_LABEL: Record<Body, string> = {
  mochi: '团子',
  bean: '豆豆',
  cat: '猫猫',
  bird: '小鸟',
  jelly: '水母',
  ghost: '幽灵',
  mush: '蘑菇',
  dino: '小恐龙',
};
export const TOP_LABEL: Record<Top, string> = {
  none: '光溜溜',
  bunny: '兔耳',
  catear: '猫耳',
  sprout: '叶芽',
  antenna: '触角',
  horn: '小角',
  flower: '小花',
  ahoge: '呆毛',
};
export const EYES_LABEL: Record<Eyes, string> = {
  dot: '豆豆眼',
  sparkle: '闪光眼',
  sleepy: '困困眼',
  happy: '眯眯眼',
  wink: '眨眼',
};
export const MOUTH_LABEL: Record<Mouth, string> = { none: '抿嘴', smile: '微笑', w: '猫猫嘴', o: '小o嘴' };
export const DIR_LABEL = ['横纹', '斜纹', '竖纹', '斜纹'];
export const PATTERN_LABEL: Record<Pattern, string> = {
  none: '纯色',
  stripes: '条纹',
  dots: '斑点',
  belly: '白肚皮',
  heart: '爱心',
  fade: '渐变',
};
export const ACC_LABEL: Record<Acc, string> = { none: '无', scarf: '小围巾', bow: '蝴蝶结', bell: '铃铛' };
export const RARE_LABEL: Record<Rare, string> = {
  none: '无',
  glass: '透明翅膀',
  glow: '夜光眼',
  pearl: '珠光肚皮',
};

export const SIZES = [16, 20, 24] as const;
export const SIZE_LABEL = ['迷你', '小挂件', '挂件'];
export type SizeIdx = 0 | 1 | 2;

export interface Colors {
  main: number;
  sub: number;
  pat: number;
  acc: number;
}

export interface Genes {
  size: SizeIdx;
  body: Body;
  top: Top;
  eyes: Eyes;
  mouth: Mouth;
  pattern: Pattern;
  dir: Dir;
  acc: Acc;
  rare: Rare;
  blush: boolean;
  hTop: Top;
  hPattern: Pattern;
  quirk: number;
  colors: Colors;
}

export type GeneKey = 'body' | 'top' | 'eyes' | 'mouth' | 'blush' | 'pattern' | 'acc' | 'colors' | 'rare';
export const GENE_KEYS: GeneKey[] = ['body', 'top', 'eyes', 'mouth', 'blush', 'pattern', 'acc', 'colors', 'rare'];
export const GENE_LABEL: Record<GeneKey, string> = {
  body: '体型',
  top: '头顶',
  eyes: '眼睛',
  mouth: '嘴巴',
  blush: '腮红',
  pattern: '花纹',
  acc: '配件',
  colors: '配色',
  rare: '罕见',
};
export type Pins = Partial<Record<GeneKey, boolean>>;

const TOP_OK: Partial<Record<Body, Top[]>> = {
  cat: ['none', 'sprout', 'flower', 'ahoge'],
  mush: ['none', 'sprout', 'flower'],
  dino: ['none'],
};
export const topFits = (body: Body, top: Top) => !TOP_OK[body] || TOP_OK[body]!.includes(top);
export const expressedTop = (g: Genes): Top => (topFits(g.body, g.top) ? g.top : 'none');

export function geneText(g: Genes, k: GeneKey): string {
  switch (k) {
    case 'body':
      return BODY_LABEL[g.body];
    case 'top': {
      if (g.body === 'dino') return '背刺';
      if (!topFits(g.body, g.top)) return `${TOP_LABEL[g.top]}（藏起来了）`;
      return g.body === 'cat' && g.top === 'none' ? '猫耳' : TOP_LABEL[g.top];
    }
    case 'eyes':
      return EYES_LABEL[g.eyes];
    case 'mouth':
      return g.body === 'bird' ? '小尖嘴' : MOUTH_LABEL[g.mouth];
    case 'blush':
      return g.blush ? '有' : '没有';
    case 'pattern':
      return g.pattern === 'stripes' ? DIR_LABEL[g.dir] : PATTERN_LABEL[g.pattern];
    case 'acc':
      return ACC_LABEL[g.acc];
    case 'colors':
      return ['main', 'sub', 'pat', 'acc'].map((r) => BEADS[g.colors[r as keyof Colors]].code).join(' ');
    case 'rare':
      return RARE_LABEL[g.rare];
  }
}

export function tags(g: Genes): string[] {
  const t = [BODY_LABEL[g.body]];
  const top = expressedTop(g);
  if (g.body === 'dino') t.push('背刺');
  else if (top !== 'none') t.push(TOP_LABEL[top]);
  if (g.pattern !== 'none') t.push(geneText(g, 'pattern'));
  if (g.acc !== 'none') t.push(ACC_LABEL[g.acc]);
  if (g.rare !== 'none') t.push(RARE_LABEL[g.rare]);
  return t;
}

/* ---------------- 照片读出来的“线索” ---------------- */

export interface PhotoColor {
  bead: number;
  weight: number;
  pos: [number, number];
  label?: string;
  crop?: string;
  derived?: boolean;
}

export interface PhotoInfo {
  colors: PhotoColor[];
  bright: number;
  sat: number;
  warm: number;
  edgeDir: Dir;
  edgeStrength: number;
  texture: number;
  seed: number;
}

export interface Clue {
  text: string;
  hint: string;
}

export function readClues(p: PhotoInfo): Clue[] {
  const out: Clue[] = [];
  const dirName = ['横向', '斜向', '竖直', '斜向'][p.edgeDir];
  if (p.edgeStrength > 0.18) out.push({ text: `${dirName}线条很多`, hint: `可能长${DIR_LABEL[p.edgeDir]}` });
  if (p.texture > 0.42) out.push({ text: '纹理细碎', hint: '可能长斑点' });
  if (p.bright < 42) out.push({ text: '画面偏暗', hint: '容易是困困眼' });
  else if (p.bright > 68) out.push({ text: '画面很亮', hint: '容易是闪光眼' });
  if (p.sat > 32) out.push({ text: '颜色很饱满', hint: '花纹会更明显' });
  else if (p.sat < 14) out.push({ text: '颜色很安静', hint: '更可能是纯色' });
  if (p.warm > 12) out.push({ text: '整体偏暖', hint: '容易孵出团子、猫猫' });
  else if (p.warm < 0) out.push({ text: '整体偏冷', hint: '容易孵出水母、幽灵' });
  return out.slice(0, 4);
}

/* ---------------- 配色 ---------------- */

export type Flavor = 'steady' | 'cute' | 'wild';
export const FLAVOR_LABEL: Record<Flavor, string> = { steady: '原图色', cute: '软萌款', wild: '隐藏款' };
export const FLAVOR_DESC: Record<Flavor, string> = {
  steady: '最像你拍下的那一刻',
  cute: '可爱值又加了一点',
  wild: '拆开才知道是谁',
};

function liftMain(i: number, pool: Pool): number {
  if (L(i) >= 50) return i;
  const [l, a, b] = BEADS[i].lab;
  return nearest([Math.max(58, l + 26), a, b], pool);
}

function assignColors(flavor: Flavor, photo: PhotoColor[], r: Rng, pool: Pool, avoid: number[] = [], sat = 20): Colors {
  const all = photo.map((p) => p.bead);
  const fresh = all.filter((i) => !avoid.includes(i) && L(i) >= 42);
  const ents = fresh.length ? [...fresh, ...all.filter((i) => !fresh.includes(i))] : all;
  const mainPool = fresh.length ? fresh : all;
  const w = (i: number) => photo.find((p) => p.bead === i)?.weight ?? 0.05;
  const by = (arr: number[], f: (i: number) => number) => [...arr].sort((a, b) => f(b) - f(a));
  let main: number;
  if (flavor === 'steady') {
    const cand = mainPool.filter((i) => L(i) >= 45 && L(i) <= 93);
    const score = sat >= 16 ? (i: number) => Math.sqrt(w(i)) * Math.pow(0.2 + C(i) / 22, 1.3) : (i: number) => Math.pow(w(i), 0.8) * (0.5 + C(i) / 40);
    main = cand.length ? by(cand, score)[0] : liftMain(by(mainPool, w)[0], pool);
  } else if (flavor === 'cute') {
    const cand = mainPool.filter((i) => L(i) >= 58);
    main = cand.length ? by(cand, (i) => L(i) * 0.4 + C(i) * 0.9 + w(i) * 40)[0] : lighter(by(mainPool, w)[0], pool, 24);
  } else {
    const vivid = by(
      mainPool.filter((i) => L(i) >= 40 && C(i) >= 12),
      (i) => C(i) * Math.sqrt(w(i)),
    );
    const cand = vivid.length ? vivid.slice(0, 3) : by(mainPool, w).slice(0, 3);
    main = liftMain(cand[Math.floor(r() * cand.length)], pool);
  }
  main = liftMain(main, pool);
  const rest = ents.filter((i) => i !== main);
  let pat = by(
    rest.filter((i) => dE(i, main) >= 14),
    (i) => Math.pow(dE(i, main), 0.7) * Math.pow(w(i) + 0.05, 0.5) * (1 + C(i) / 40) * (L(i) < 30 ? 0.6 : 1) * (flavor === 'wild' ? 0.6 + r() : 1),
  )[0];
  if (pat === undefined) pat = darker(main, pool, 24);
  let sub: number;
  if (flavor === 'cute') {
    const [, a, b] = BEADS[main].lab;
    sub = nearest([95, a * 0.1, b * 0.14 + 3], pool, [main]);
  } else {
    const lights = rest.filter((i) => i !== pat && L(i) >= L(main) - 4 && dE(i, main) >= 8);
    sub = lights.length ? by(lights, (i) => L(i) + w(i) * 30)[0] : lighter(main, pool, 20, [pat]);
  }
  const accCand = rest.filter((i) => i !== pat && i !== sub && dE(i, main) >= 12);
  let acc = accCand.length ? by(accCand, (i) => C(i) + r() * 8)[0] : undefined;
  if (acc === undefined) {
    acc = flavor === 'cute' ? nearest(mixLab(BEADS[main].lab, [72, 40, 8], 0.8), pool, [main, sub]) : pat;
  }
  return { main, sub, pat, acc };
}

/* ---------------- 一窝三只 ---------------- */

const WARM_BODIES: [Body, number][] = [
  ['mochi', 3],
  ['cat', 3],
  ['bean', 2],
  ['bird', 1.5],
  ['mush', 1],
  ['dino', 1],
  ['ghost', 0.6],
  ['jelly', 0.6],
];
const COOL_BODIES: [Body, number][] = [
  ['jelly', 3],
  ['ghost', 3],
  ['bird', 2],
  ['bean', 1.5],
  ['mochi', 1],
  ['cat', 1],
  ['dino', 1],
  ['mush', 1],
];

function pickTop(r: Rng, body: Body, flavor: Flavor): Top {
  const pref: [Top, number][] =
    flavor === 'cute'
      ? [['bunny', 3], ['catear', 2.5], ['sprout', 2], ['flower', 2], ['none', 1], ['ahoge', 1]]
      : flavor === 'wild'
        ? [['antenna', 3], ['horn', 3], ['ahoge', 2], ['sprout', 1.5], ['bunny', 1], ['none', 1]]
        : [['none', 2], ['sprout', 2], ['catear', 2], ['bunny', 1.5], ['ahoge', 1.5], ['flower', 1], ['horn', 1], ['antenna', 1]];
  const ok = pref.filter(([t]) => topFits(body, t));
  return ok.length ? weighted(r, ok) : 'none';
}

export interface ClutchOpts {
  photo: PhotoInfo;
  size: SizeIdx;
  round: number;
  pool: Pool;
  base?: Genes;
  pins?: Pins;
}

export function makeOne(flavor: Flavor, o: ClutchOpts, avoidBodies: Body[] = [], avoidMains: number[] = []): Genes {
  const { photo: p, pool } = o;
  const r = mulberry32(hashNums(p.seed, o.round, ['steady', 'cute', 'wild'].indexOf(flavor), 17));
  const warm = p.warm > 6;
  let body: Body;
  if (flavor === 'steady') body = weighted(r, (warm ? WARM_BODIES : COOL_BODIES).filter(([b]) => !avoidBodies.includes(b)));
  else if (flavor === 'cute')
    body = weighted(
      r,
      ([['mochi', 3], ['cat', 3], ['bean', 2], ['bird', 2], ['ghost', 1.2]] as [Body, number][]).filter(
        ([b]) => !avoidBodies.includes(b),
      ),
    );
  else
    body = weighted(
      r,
      ([['jelly', 2.5], ['mush', 2.5], ['dino', 2.5], ['ghost', 1.5], ['bird', 1], ['bean', 1]] as [Body, number][]).filter(
        ([b]) => !avoidBodies.includes(b),
      ),
    );

  let eyes: Eyes;
  if (flavor === 'steady') eyes = p.bright < 42 ? 'sleepy' : p.bright > 68 ? 'sparkle' : pick(r, ['dot', 'sparkle', 'dot'] as Eyes[]);
  else if (flavor === 'cute') eyes = weighted(r, [['sparkle', 6], ['happy', 2.5], ['dot', 1.5]] as [Eyes, number][]);
  else eyes = pick(r, EYES);

  const mouth: Mouth =
    flavor === 'cute'
      ? weighted(r, [['w', 3], ['smile', 3], ['o', 1.5]] as [Mouth, number][])
      : weighted(r, [['smile', 3], ['w', 2], ['none', 1.5], ['o', 1]] as [Mouth, number][]);

  let pattern: Pattern;
  let dir: Dir = p.edgeDir;
  if (flavor === 'steady') {
    if (p.edgeStrength > 0.18) pattern = 'stripes';
    else if (p.texture > 0.42) pattern = 'dots';
    else pattern = p.sat < 14 ? pick(r, ['none', 'belly'] as Pattern[]) : pick(r, ['belly', 'fade', 'dots'] as Pattern[]);
  } else if (flavor === 'cute') {
    pattern = weighted(r, [['belly', 3], ['heart', 2.5], ['dots', 1.5], ['none', 1]] as [Pattern, number][]);
  } else {
    pattern = weighted(r, [['stripes', 3], ['dots', 2], ['fade', 2], ['heart', 0.8], ['none', 0.6]] as [Pattern, number][]);
    dir = pick(r, [0, 1, 2, 3] as Dir[]);
  }
  if (body === 'mush' && (pattern === 'belly' || pattern === 'fade')) pattern = 'dots';

  const accP = flavor === 'cute' ? 0.5 : flavor === 'wild' ? 0.4 : 0.28;
  const acc: Acc = r() < accP ? pick(r, ['scarf', 'bow', 'bell'] as Acc[]) : 'none';
  const rareP = flavor === 'wild' ? 0.2 : 0.03;
  const rare: Rare = r() < rareP ? pick(r, ['glass', 'glow', 'pearl'] as Rare[]) : 'none';
  const blush = flavor === 'cute' ? true : r() < (flavor === 'steady' ? 0.5 : 0.3);

  const g: Genes = {
    size: o.size,
    body,
    top: pickTop(r, body, flavor),
    eyes,
    mouth,
    pattern,
    dir,
    acc,
    rare,
    blush,
    hTop: pick(r, TOPS.slice(1)),
    hPattern: pick(r, PATTERNS.slice(1)),
    quirk: Math.floor(r() * 64),
    colors: assignColors(flavor, p.colors, r, pool, avoidMains, p.sat),
  };
  return applyPins(g, o.base, o.pins);
}

export function applyPins(g: Genes, base?: Genes, pins?: Pins): Genes {
  if (!base || !pins) return g;
  const out = { ...g, colors: { ...g.colors } };
  if (pins.body) out.body = base.body;
  if (pins.top) out.top = base.top;
  if (pins.eyes) out.eyes = base.eyes;
  if (pins.mouth) out.mouth = base.mouth;
  if (pins.blush) out.blush = base.blush;
  if (pins.pattern) {
    out.pattern = base.pattern;
    out.dir = base.dir;
  }
  if (pins.acc) out.acc = base.acc;
  if (pins.rare) out.rare = base.rare;
  if (pins.colors) out.colors = { ...base.colors };
  if (!topFits(out.body, out.top) && !pins.top) out.top = 'none';
  if (out.body === 'mush' && (out.pattern === 'belly' || out.pattern === 'fade') && !pins.pattern) out.pattern = 'dots';
  return out;
}

export function makeClutch(o: ClutchOpts): Genes[] {
  const flavors: Flavor[] = ['steady', 'cute', 'wild'];
  const used: Body[] = [];
  const mains: number[] = [];
  return flavors.map((f) => {
    const g = makeOne(f, o, o.pins?.body ? [] : used, o.pins?.colors ? [] : mains);
    used.push(g.body);
    mains.push(g.colors.main);
    return g;
  });
}

/* ---------------- 配种 ---------------- */

export interface Child {
  genes: Genes;
  notes: string[];
  newBead?: number;
}

export function breed(a: Genes, b: Genes, seed: number, pool: Pool, nameA = '你的崽', nameB = 'TA 的崽'): Child[] {
  const parentColors = new Set([...Object.values(a.colors), ...Object.values(b.colors)]);
  const mid: Lab = mixLab(BEADS[a.colors.main].lab, BEADS[b.colors.main].lab, 0.5);
  let mix = nearest(mid, pool, parentColors);
  if (deltaE(BEADS[mix].lab, mid) > 18) {
    const alt = mixLab(BEADS[a.colors.pat].lab, BEADS[b.colors.main].lab, 0.5);
    mix = nearest(alt, pool, parentColors);
  }
  const kids: Child[] = [];
  for (let k = 0; k < 3; k++) {
    const r = mulberry32(hashNums(seed, k, 991));
    const biasA = k === 0 ? 0.72 : k === 1 ? 0.28 : 0.5;
    const from = () => (r() < biasA ? a : b);
    const notes: string[] = [];
    const src = (x: Genes) => (x === a ? nameA : nameB);
    const bodyP = k === 0 ? a : k === 1 ? b : from();
    const g: Genes = {
      size: a.size,
      body: bodyP.body,
      top: from().top,
      eyes: from().eyes,
      mouth: from().mouth,
      pattern: 'none',
      dir: 0,
      acc: from().acc,
      rare: r() < 0.5 ? a.rare : b.rare,
      blush: from().blush,
      hTop: from().hTop,
      hPattern: from().hPattern,
      quirk: Math.floor(r() * 64),
      colors: { ...a.colors },
    };
    const patP = from();
    g.pattern = patP.pattern;
    g.dir = patP.dir;
    notes.push(`${BODY_LABEL[g.body]}的身体来自${src(bodyP)}`);
    if (g.pattern !== 'none') notes.push(`${geneText(g, 'pattern')}来自${src(patP)}`);

    const mainP = from();
    const other = mainP === a ? b : a;
    g.colors = {
      main: mainP.colors.main,
      sub: r() < 0.5 ? a.colors.sub : b.colors.sub,
      pat: other.colors.main !== mainP.colors.main && dE(other.colors.main, mainP.colors.main) > 12 ? other.colors.main : other.colors.pat,
      acc: r() < 0.5 ? other.colors.acc : mainP.colors.acc,
    };
    notes.push(`主色 ${BEADS[g.colors.main].code} 来自${src(mainP)}`);

    let newBead: number | undefined;
    if (k === 2 || r() < 0.4) {
      if (k === 2 || r() < 0.5) g.colors.pat = mix;
      else g.colors.acc = mix;
      if (g.pattern === 'none') g.pattern = r() < 0.5 ? 'dots' : 'belly';
      if (g.colors.acc !== mix && g.pattern === 'belly') g.colors.sub = mix;
      newBead = mix;
      notes.push(`新豆 ${BEADS[mix].code}：你们俩都没有`);
    }

    if (r() < 0.25) {
      const holder = r() < 0.5 ? a : b;
      if (topFits(g.body, holder.hTop) && holder.hTop !== g.top) {
        g.top = holder.hTop;
        notes.push(`隔代冒出来的${TOP_LABEL[holder.hTop]}（藏在${src(holder)}的基因里）`);
      }
    }
    if (r() < 0.08) {
      g.rare = pick(r, ['glass', 'glow', 'pearl'] as Rare[]);
      notes.push(`突变：${RARE_LABEL[g.rare]}`);
    }
    if (!topFits(g.body, g.top)) g.top = 'none';
    if (g.body === 'mush' && (g.pattern === 'belly' || g.pattern === 'fade')) g.pattern = 'dots';
    if (g.colors.pat === g.colors.main) g.colors.pat = darker(g.colors.main, pool, 22);
    kids.push({ genes: g, notes, newBead });
  }
  return kids;
}

/** 把两只崽的颜色合成“照片”上下文，供配种后“再孵一窝”使用 */
export function palettesOf(...gs: Genes[]): PhotoColor[] {
  const seen = new Map<number, number>();
  gs.forEach((g) =>
    (['main', 'pat', 'sub', 'acc'] as (keyof Colors)[]).forEach((k, idx) => {
      const i = g.colors[k];
      seen.set(i, (seen.get(i) ?? 0) + [0.4, 0.25, 0.2, 0.15][idx]);
    }),
  );
  return [...seen.entries()].map(([bead, weight]) => ({ bead, weight, pos: [0.5, 0.5] as [number, number] }));
}
