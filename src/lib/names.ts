import { chroma, hueDeg } from './color';
import { Body, Genes } from './genes';
import { BEADS } from './palette';
import { mulberry32, pick, hashNums } from './rng';

interface ColorWord {
  one: string;
  long: string[];
}

export function colorWord(bead: number): ColorWord {
  const lab = BEADS[bead].lab;
  const [l] = lab;
  const c = chroma(lab);
  const h = hueDeg(lab);
  if (c < 9) {
    if (l > 88) return { one: '白', long: ['奶白', '棉花', '云朵'] };
    if (l > 60) return { one: '灰', long: ['雾灰', '海盐', '小灰'] };
    if (l > 30) return { one: '灰', long: ['石头', '铅笔'] };
    return { one: '墨', long: ['芝麻', '墨墨'] };
  }
  if (h < 25 || h >= 345) return l > 70 ? { one: '粉', long: ['樱花', '草莓奶'] } : l > 45 ? { one: '红', long: ['石榴', '山楂'] } : { one: '红', long: ['豆沙', '红豆'] };
  if (h < 60) {
    if (l < 50) return { one: '棕', long: ['可可', '栗子', '焦糖'] };
    return l > 75 ? { one: '杏', long: ['杏仁', '蜜桃'] } : { one: '橘', long: ['橘子', '柿子', '晚霞'] };
  }
  if (h < 95) {
    if (l < 55) return { one: '棕', long: ['焦糖', '麦芽'] };
    return l > 85 ? { one: '奶', long: ['奶黄', '布丁'] } : { one: '黄', long: ['柠檬', '芒果', '向日葵'] };
  }
  if (h < 125) return l > 75 ? { one: '芽', long: ['青柠', '嫩芽'] } : { one: '绿', long: ['抹茶', '青苹果'] };
  if (h < 170) return l > 75 ? { one: '绿', long: ['薄荷', '青提'] } : { one: '绿', long: ['抹茶', '苔藓', '竹叶'] };
  if (h < 215) return l > 70 ? { one: '青', long: ['汽水', '海盐'] } : { one: '青', long: ['湖水', '孔雀'] };
  if (h < 275) return l > 70 ? { one: '蓝', long: ['雾蓝', '天空'] } : { one: '蓝', long: ['深海', '靛青'] };
  if (h < 310) return l > 70 ? { one: '紫', long: ['芋泥', '丁香'] } : { one: '紫', long: ['葡萄', '紫薯'] };
  return l > 72 ? { one: '粉', long: ['蜜桃', '莓莓'] } : { one: '莓', long: ['树莓', '玫瑰'] };
}

/** 颜色的名字，比如“焦糖色”“奶白色” */
export const colorName = (bead: number) => colorWord(bead).long[0] + '色';

const POS = new Set(['左上', '上方', '右上', '左边', '中间', '右边', '左下', '下方', '右下', '补色']);

/** 颜色来源的说明：有具体位置（座椅、扶手）就用位置，否则用颜色的名字 */
export const sourceLabel = (p: { bead: number; label?: string }) => (p.label && !POS.has(p.label) ? p.label : colorName(p.bead));

/** 一组颜色的说明，颜色名重复时换一个近义的叫法 */
export function sourceLabels(list: { bead: number; label?: string }[]): string[] {
  const used = new Set<string>();
  return list.map((p) => {
    const names = colorWord(p.bead).long.map((w) => w + '色');
    if (p.label && !POS.has(p.label) && !names.includes(p.label)) return p.label;
    const pick = names.find((n) => !used.has(n)) ?? names[0];
    used.add(pick);
    return pick;
  });
}

const NOUN: Record<Body, string[]> = {
  mochi: ['团子', '麻薯', '汤圆'],
  bean: ['豆豆', '小豆'],
  cat: ['喵', '咪咪', '猫猫'],
  bird: ['啾啾', '小啾'],
  jelly: ['水母', '飘飘'],
  ghost: ['飘飘', '啵啵'],
  mush: ['菇菇', '蘑蘑'],
  dino: ['小龙', '嗷呜'],
};

export function nameFor(g: Genes, seed: number, title?: string): string {
  const r = mulberry32(hashNums(seed, g.colors.main, g.colors.pat, g.quirk));
  const a = colorWord(g.colors.main);
  const b = colorWord(g.colors.pat);
  const opts: string[] = [];
  if (a.one !== b.one) opts.push(a.one + b.one + b.one);
  opts.push(pick(r, a.long) + pick(r, NOUN[g.body]));
  opts.push(a.one + a.one + pick(r, NOUN[g.body]).slice(-1));
  if (title && title.length <= 5) opts.push(title);
  return pick(r, opts);
}

export function nameOptions(g: Genes, title?: string): string[] {
  const a = colorWord(g.colors.main);
  const b = colorWord(g.colors.pat);
  const set = new Set<string>();
  if (title) set.add(title);
  if (a.one !== b.one) set.add(a.one + b.one + b.one);
  for (const l of a.long) set.add(l + NOUN[g.body][0]);
  set.add(a.one + a.one);
  return [...set].slice(0, 6);
}
