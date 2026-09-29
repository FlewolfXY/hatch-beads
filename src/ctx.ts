import { createContext, useContext } from 'react';
import { LabeledPoint } from './lib/extract';
import { Genes, Pins, PhotoInfo, SizeIdx } from './lib/genes';
import { Pool } from './lib/palette';
import { BoxSetting, Creature } from './lib/store';

export interface PhotoCtx {
  title: string;
  thumb?: string;
  note?: string;
  info: PhotoInfo;
}

export interface BreedCtx {
  a: Creature;
  b: Genes;
  bName: string;
  bOwner?: string;
  seed: number;
}

export type Screen =
  | { k: 'home' }
  | { k: 'extract'; src: string; title: string; note?: string; points?: LabeledPoint[] }
  | { k: 'hatch'; photo: PhotoCtx; size: SizeIdx; round: number; base?: Creature; pins?: Pins; breed?: BreedCtx }
  | { k: 'detail'; id: string }
  | { k: 'sheet'; id: string }
  | { k: 'cert'; id: string }
  | { k: 'breed'; aId?: string; code?: string }
  | { k: 'gallery' };

export interface AppCtx {
  pool: Pool;
  box: BoxSetting;
  setBox: (b: BoxSetting) => void;
  nest: Creature[];
  drafts: Record<string, Creature>;
  get: (id: string) => Creature | undefined;
  put: (c: Creature, keep?: boolean) => void;
  keep: (id: string) => void;
  kept: (id: string) => boolean;
  sound: boolean;
  toggleSound: () => void;
  toast: (m: string) => void;
  go: (s: Screen, replace?: boolean) => void;
  back: () => void;
  openBox: () => void;
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
