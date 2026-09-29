import { hexToRgb, rgbToLab } from './color';
import { LabeledPoint } from './extract';
import { Genes } from './genes';
import { nearest, STANDARD } from './palette';

export interface Sample {
  id: string;
  title: string;
  src: string;
  note: string;
  points: LabeledPoint[];
  strip: string[];
}

export const SAMPLES: Sample[] = [
  {
    id: 'metro',
    title: '2号线末班车',
    src: 'samples/metro.jpg',
    note: '下课了，坐末班车回宿舍，突然觉得这些颜色很奇异。',
    strip: ['#EC7A2E', '#3FA06C', '#EADCB8', '#26393F'],
    points: [
      { x: 0.5, y: 0.66, label: '座椅' },
      { x: 0.5, y: 0.76, label: '座椅' },
      { x: 0.27, y: 0.5, label: '扶手' },
      { x: 0.73, y: 0.5, label: '扶手' },
      { x: 0.5, y: 0.05, label: '灯光' },
      { x: 0.3, y: 0.16, label: '扶手' },
      { x: 0.7, y: 0.16, label: '扶手' },
      { x: 0.5, y: 0.36, label: '车窗倒影' },
      { x: 0.5, y: 0.47, label: '车窗倒影' },
      { x: 0.88, y: 0.94, label: '地板' },
      { x: 0.12, y: 0.94, label: '地板' },
      { x: 0.12, y: 0.62, label: '车厢' },
      { x: 0.5, y: 0.555, label: '车厢' },
      { x: 0.9, y: 0.2, label: '车厢' },
      { x: 0.5, y: 0.93, label: '地板' },
    ],
  },
  {
    id: 'sunset',
    title: '放学的晚霞',
    src: 'samples/sunset.jpg',
    note: '最后一节课提前结束，绕操场走了一圈才回去。',
    strip: ['#AE92D6', '#F09DB2', '#FCB184', '#3B2A50'],
    points: [
      { x: 0.5, y: 0.1, label: '天空' },
      { x: 0.35, y: 0.3, label: '晚霞' },
      { x: 0.6, y: 0.45, label: '晚霞' },
      { x: 0.62, y: 0.68, label: '夕阳' },
      { x: 0.3, y: 0.85, label: '教学楼' },
      { x: 0.85, y: 0.78, label: '树影' },
    ],
  },
  {
    id: 'rain',
    title: '雨天的窗',
    src: 'samples/rain.jpg',
    note: '雨一直没停，窗外的灯都化开了。',
    strip: ['#94ABBA', '#F4B37A', '#E27A73', '#86B27A'],
    points: [
      { x: 0.6, y: 0.35, label: '路灯' },
      { x: 0.45, y: 0.55, label: '雨窗' },
      { x: 0.33, y: 0.45, label: '暖灯' },
      { x: 0.86, y: 0.52, label: '红灯' },
      { x: 0.04, y: 0.5, label: '窗框' },
      { x: 0.2, y: 0.84, label: '绿萝' },
      { x: 0.5, y: 0.96, label: '窗台' },
    ],
  },
];

const hex = (h: string) => nearest(rgbToLab(hexToRgb(h)), STANDARD);

export interface Friend {
  owner: string;
  name: string;
  genes: Genes;
}

export const FRIENDS: Friend[] = [
  {
    owner: '小满',
    name: '雾紫水母',
    genes: {
      size: 1,
      body: 'jelly',
      top: 'antenna',
      eyes: 'sparkle',
      mouth: 'smile',
      pattern: 'dots',
      dir: 0,
      acc: 'none',
      rare: 'none',
      blush: true,
      hTop: 'bunny',
      hPattern: 'heart',
      quirk: 5,
      colors: { main: hex('#B9A6E3'), sub: hex('#FFF7E8'), pat: hex('#F6A3C0'), acc: hex('#8FE0C8') },
    },
  },
  {
    owner: '阿柚',
    name: '薄荷猫猫',
    genes: {
      size: 1,
      body: 'cat',
      top: 'sprout',
      eyes: 'happy',
      mouth: 'w',
      pattern: 'stripes',
      dir: 1,
      acc: 'scarf',
      rare: 'none',
      blush: true,
      hTop: 'flower',
      hPattern: 'dots',
      quirk: 12,
      colors: { main: hex('#A8E0C8'), sub: hex('#FFF8EC'), pat: hex('#4FA99A'), acc: hex('#F7B08A') },
    },
  },
];

export const SHOWCASE: Genes[] = [
  {
    size: 1,
    body: 'cat',
    top: 'none',
    eyes: 'sparkle',
    mouth: 'w',
    pattern: 'stripes',
    dir: 2,
    acc: 'none',
    rare: 'none',
    blush: true,
    hTop: 'sprout',
    hPattern: 'dots',
    quirk: 3,
    colors: { main: hex('#EF8A3C'), sub: hex('#F4E6C4'), pat: hex('#3FA06C'), acc: hex('#F6D77A') },
  },
  {
    size: 1,
    body: 'mochi',
    top: 'bunny',
    eyes: 'happy',
    mouth: 'smile',
    pattern: 'belly',
    dir: 0,
    acc: 'bow',
    rare: 'none',
    blush: true,
    hTop: 'flower',
    hPattern: 'heart',
    quirk: 9,
    colors: { main: hex('#F4A8B8'), sub: hex('#FFF1DC'), pat: hex('#B394D6'), acc: hex('#AE92D6') },
  },
  {
    size: 1,
    body: 'ghost',
    top: 'ahoge',
    eyes: 'dot',
    mouth: 'o',
    pattern: 'dots',
    dir: 0,
    acc: 'none',
    rare: 'glow',
    blush: false,
    hTop: 'bunny',
    hPattern: 'belly',
    quirk: 20,
    colors: { main: hex('#B9CCD8'), sub: hex('#EEF3F5'), pat: hex('#F4B37A'), acc: hex('#E27A73') },
  },
];
