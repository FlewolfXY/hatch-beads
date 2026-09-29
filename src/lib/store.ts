import { Genes, PhotoColor, PhotoInfo } from './genes';
import { ALL, Pool, STANDARD, beadByCode } from './palette';

export interface CreaturePhoto {
  title: string;
  thumb?: string;
  colors: PhotoColor[];
  info: Omit<PhotoInfo, 'colors'>;
}

export interface Creature {
  id: string;
  genes: Genes;
  name: string;
  createdAt: number;
  flavor?: string;
  photo?: CreaturePhoto;
  parents?: { name: string; code: string }[];
  notes?: string[];
  newBead?: number;
  note?: string;
  madeAt?: number;
  madePhoto?: string;
}

const NEST = 'hatch-beads:nest:v1';
const BOX = 'hatch-beads:box:v1';

export function loadNest(): Creature[] {
  try {
    return JSON.parse(localStorage.getItem(NEST) || '[]');
  } catch {
    return [];
  }
}

export function saveNest(list: Creature[]) {
  let items = list.slice(0, 40);
  for (let i = 0; i < 5; i++) {
    try {
      localStorage.setItem(NEST, JSON.stringify(items));
      return true;
    } catch {
      // 空间不够：先丢掉旧的照片缩略图
      items = items.map((c, idx) => (idx > 8 ? { ...c, photo: c.photo ? { ...c.photo, thumb: undefined, colors: c.photo.colors.map((p) => ({ ...p, crop: undefined })) } : undefined } : c));
      if (i > 1) items = items.slice(0, items.length - 5);
    }
  }
  return false;
}

export type BoxMode = 'standard' | 'all' | 'mine';
export interface BoxSetting {
  mode: BoxMode;
  mine: string[];
}

export function loadBox(): BoxSetting {
  try {
    const v = JSON.parse(localStorage.getItem(BOX) || 'null');
    if (v && v.mode) return v;
  } catch {
    /* ignore */
  }
  return { mode: 'standard', mine: [] };
}

export function saveBox(b: BoxSetting) {
  localStorage.setItem(BOX, JSON.stringify(b));
}

export function poolOf(b: BoxSetting): Pool {
  if (b.mode === 'all') return ALL;
  if (b.mode === 'mine') {
    const ids = b.mine.map((c) => beadByCode(c)?.i).filter((x): x is number => x !== undefined);
    if (ids.length >= 8) return ids;
  }
  return STANDARD;
}
