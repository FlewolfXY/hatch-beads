import { useEffect, useMemo, useRef, useState } from 'react';
import { BreedCtx, PhotoCtx, useApp } from '../ctx';
import { rasterize, Raster } from '../lib/creature';
import {
  Body,
  breed,
  FLAVOR_DESC,
  FLAVOR_LABEL,
  Flavor,
  Genes,
  GENE_LABEL,
  GeneKey,
  makeClutch,
  Pins,
  SizeIdx,
  tags,
} from '../lib/genes';
import { nameFor } from '../lib/names';
import { BEADS, derive, STANDARD } from '../lib/palette';
import { beadSprite, drawEgg, drawRaster, EggRaster, EggShape, EggStyle, makeEgg, Melt, MELT_MS, reduceMotion, setupCanvas } from '../lib/render';
import { hashNums, mulberry32, uid } from '../lib/rng';
import { chime, crack, tick } from '../lib/sound';
import { Creature } from '../lib/store';
import { tintOf } from './Detail';
import { Steps } from './Extract';
import { TopBar } from './Home';
import { Pin, Shuffle, Sparkle } from './icons';

interface Props {
  photo: PhotoCtx;
  size: SizeIdx;
  round: number;
  base?: Creature;
  pins?: Pins;
  breed?: BreedCtx;
}

const BODY_HINT: Record<Body, string> = {
  mochi: '软乎乎的，像刚出锅的麻薯',
  bean: '小小一颗，在里面翻了个身',
  cat: '里面好像传来一声“咪”',
  bird: '听见了啾啾啾',
  jelly: '晃起来咕噜咕噜的',
  ghost: '摸上去凉凉的，有点神秘',
  mush: '闻起来像下过雨的草地',
  dino: '硬硬的，好像长了小刺',
};

type Lean = 'a' | 'b' | 'mix';

interface Item {
  c: Creature;
  ras: Raster;
  egg: EggRaster;
  flavor?: Flavor;
  lean?: Lean;
  notes?: string[];
  newBead?: number;
}

const LEAN_LABEL: Record<Lean, [string, string]> = {
  a: ['随你', '眉眼里有你的影子'],
  b: ['随TA', '一看就是TA家的崽'],
  mix: ['混血款', '谁都不像，又谁都像'],
};

const eggShape = (b: Body): EggShape => (['mochi', 'cat', 'mush', 'dino'].includes(b) ? 'round' : ['bean', 'ghost', 'jelly'].includes(b) ? 'tall' : 'normal');

function eggStyleFor(g: Genes, taken: EggStyle[]): EggStyle {
  const pref: EggStyle[] =
    g.pattern === 'stripes'
      ? g.dir % 2 ? ['stripes', 'bands'] : ['bands', 'stripes']
      : g.pattern === 'dots'
        ? ['dots', 'speckle']
        : g.pattern === 'belly' || g.pattern === 'fade'
          ? ['cap', 'zigzag']
          : g.pattern === 'heart'
            ? ['speckle', 'dots']
            : ['zigzag', 'speckle'];
  const all: EggStyle[] = [...pref, 'zigzag', 'speckle', 'dots', 'bands', 'cap', 'stripes'];
  return all.find((s) => !taken.includes(s)) ?? 'zigzag';
}

const clutchCache = new Map<string, { items: Item[]; hatched: boolean[] }>();

export default function Hatch({ photo, size, round, base, pins, breed: br }: Props) {
  const app = useApp();
  const cacheKey = br ? `b:${br.seed}:${round}:${size}` : `p:${photo.info.seed}:${round}:${size}:${base?.id ?? ''}:${JSON.stringify(pins ?? {})}`;
  const cached = clutchCache.get(cacheKey);
  const items: Item[] = useMemo(() => {
    if (cached) return cached.items;
    const n = [16, 20, 24][size];
    if (br) {
      const kids = breed(br.a.genes, br.b, br.seed + round * 101, app.pool, br.a.name, br.bName);
      return kids.map((k, i) => {
        const g = { ...k.genes, size } as Genes;
        const c: Creature = {
          id: uid() + i,
          genes: g,
          name: nameFor(g, br.seed + i + round),
          createdAt: Date.now(),
          flavor: '配种',
          parents: [
            { name: br.a.name, code: '' },
            { name: br.bOwner ? `${br.bOwner}的${br.bName}` : br.bName, code: '' },
          ],
          notes: k.notes,
          newBead: k.newBead,
        };
        const lean: Lean = (['a', 'b', 'mix'] as const)[i];
        const [baseCol, otherCol] = lean === 'b' ? [br.b.colors.main, br.a.genes.colors.main] : [br.a.genes.colors.main, br.b.colors.main];
        const egg = makeEgg(n, {
          main: baseCol,
          other: otherCol,
          pat: g.colors.pat,
          sub: g.colors.sub,
          style: lean === 'mix' ? 'marble' : 'spots',
          extra: k.newBead,
          shape: eggShape(g.body),
          seed: br.seed + i * 131 + round,
          pool: app.pool,
        });
        return { c, ras: rasterize(g, app.pool), egg, lean, notes: k.notes, newBead: k.newBead };
      });
    }
    const clutch = makeClutch({ photo: photo.info, size, round, pool: app.pool, base: base?.genes, pins });
    const flavors: Flavor[] = ['steady', 'cute', 'wild'];
    const taken: EggStyle[] = [];
    return clutch.map((g, i) => {
      const style = eggStyleFor(g, taken);
      taken.push(style);
      const { colors, ...rest } = photo.info;
      const c: Creature = {
        id: uid() + i,
        genes: g,
        name: nameFor(g, photo.info.seed + round * 3 + i, photo.title),
        createdAt: Date.now(),
        flavor: FLAVOR_LABEL[flavors[i]],
        photo: { title: photo.title, thumb: photo.thumb, colors, info: rest },
        note: photo.note,
      };
      const egg = makeEgg(n, {
        main: g.colors.main,
        pat: g.colors.pat,
        sub: g.colors.sub,
        style,
        shape: eggShape(g.body),
        seed: photo.info.seed + round * 17 + i,
        pool: app.pool,
      });
      return { c, ras: rasterize(g, app.pool), egg, flavor: flavors[i] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [hatched, setHatched] = useState<boolean[]>(() => cached?.hatched ?? [false, false, false]);
  const [trigger, setTrigger] = useState<number[]>([0, 0, 0]);
  const [initial] = useState(() => cached?.hatched ?? [false, false, false]);
  const all = hatched.every(Boolean);
  useEffect(() => {
    clutchCache.set(cacheKey, { items, hatched });
  }, [cacheKey, items, hatched]);

  const hatchAll = () => {
    let k = 0;
    hatched.forEach((h, i) => {
      if (h) return;
      setTimeout(() => setTrigger((t) => t.map((v, j) => (j === i ? v + 1 : v))), k * 650);
      k++;
    });
  };

  const onDone = (i: number) => {
    setHatched((h) => h.map((v, j) => (j === i ? true : v)));
    app.put(items[i].c);
  };

  const open = (i: number) => {
    if (!hatched[i]) return;
    app.go({ k: 'detail', id: items[i].c.id });
  };

  const again = () => {
    app.go({ k: 'hatch', photo, size, round: round + 1, base, pins, breed: br }, true);
  };

  const pinned = pins ? (Object.keys(pins) as GeneKey[]).filter((k) => pins[k]) : [];

  return (
    <div className="screen">
      <TopBar onBack={app.back} title={br ? '配种' : photo.title} />
      {!br && <Steps at={1} />}
      <h1 className="h1" style={{ fontSize: 24, margin: '4px 2px 6px' }}>
        {br ? `${br.a.name} × ${br.bName}` : base ? `从「${base.name}」再孵一窝` : round === 0 ? '同一窝，三只崽' : `第 ${round + 1} 窝`}
      </h1>
      <p className="lead" style={{ margin: '0 2px 14px', fontSize: 14 }}>
        {br ? '两只崽的颜色混在一起了，说不定会冒出一颗你们俩都没有的豆。' : '同一组颜色，三种长相。按住蛋壳不放，它就会破壳。'}
      </p>
      {pinned.length > 0 && (
        <div className="pinned-bar">
          <Pin size={14} />
          锁住了
          {pinned.map((k) => (
            <span key={k} className="chip">
              {GENE_LABEL[k]}
            </span>
          ))}
          <span>其余在变</span>
        </div>
      )}
      <div className="clutch">
        {items.map((it, i) => (
          <HatchCard key={it.c.id} item={it} index={i} trigger={trigger[i]} hatched={hatched[i]} born={initial[i]} onDone={() => onDone(i)} onOpen={() => open(i)} />
        ))}
      </div>
      <div className="inline-actions">
        {all ? (
          <button className="btn btn-ghost" onClick={again}>
            <Shuffle size={18} />
            {pinned.length ? '锁住的不变，再孵一窝' : '不满意？再孵一窝'}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={hatchAll}>
            <Sparkle size={18} />
            {hatched.some(Boolean) ? '剩下的也一起孵' : '三颗一起孵'}
          </button>
        )}
      </div>
      {all && <p className="sub center" style={{ marginTop: 10 }}>点一只崽，看看它的基因和图纸</p>}
    </div>
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hex: string;
  rot: number;
}

function HatchCard({
  item,
  index,
  trigger,
  hatched,
  born,
  onDone,
  onOpen,
}: {
  item: Item;
  index: number;
  trigger: number;
  hatched: boolean;
  born: boolean;
  onDone: () => void;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const holding = useRef(false);
  const auto = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [melted, setMelted] = useState(born);
  const meltedRef = useRef(born);

  useEffect(() => {
    if (trigger > 0) auto.current = true;
  }, [trigger]);

  useEffect(() => {
    const S = 156;
    const cv = ref.current!;
    const { ctx } = setupCanvas(cv, S, S);
    const { egg, ras } = item;
    const n = ras.n;
    const pad = 6;
    const px = (S - pad * 2) / n;
    let phase: 'idle' | 'burst' | 'done' = born ? 'done' : 'idle';
    const melt = new Melt();
    const still = reduceMotion();
    let charge = 0;
    let last = performance.now();
    let burstAt = 0;
    let particles: Particle[] = [];
    const rng = mulberry32(hashNums(ras.total, index, 77));
    const delays = new Float32Array(n * n);
    let maxDelay = 0;
    for (let i = 0; i < n * n; i++) {
      const y = (i / n) | 0;
      delays[i] = (n - 1 - y) * 34 + rng() * 90;
      if (ras.bead[i] >= 0) maxDelay = Math.max(maxDelay, delays[i]);
    }
    const landedSet = new Uint8Array(n * n);
    let nextBlink = 0,
      blinkUntil = 0;
    let raf = 0;
    const FALL = 300;
    const POUR_START = 220;

    const loop = (t: number) => {
      const dt = Math.min(400, t - last);
      last = t;
      ctx.clearRect(0, 0, S, S);
      if (phase === 'idle') {
        if (holding.current || auto.current) charge += dt / (auto.current ? 700 : 950);
        else charge = Math.max(0, charge - dt / 400);
        // 影子
        ctx.fillStyle = 'rgba(110,80,50,0.12)';
        ctx.beginPath();
        ctx.ellipse(S / 2, pad + n * px * 0.96, n * px * 0.3, px * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        const idle = Math.pow(Math.max(0, Math.sin(t / 650 + index * 1.7)), 12) * Math.sin(t / 70) * 0.06;
        const angle = charge > 0 ? Math.sin(t / 38) * (0.03 + 0.13 * charge) : idle;
        drawEgg(ctx, egg, { px, x0: pad, y0: pad, angle, cracked: Math.floor(charge * egg.crack.length) });
        if (charge > 0) {
          ctx.strokeStyle = 'rgba(43,35,32,0.8)';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(S / 2, S / 2, S / 2 - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, charge));
          ctx.stroke();
          if (Math.random() < charge * 0.3) tick(0.6 + charge * 0.6);
        }
        if (charge >= 1) {
          phase = 'burst';
          burstAt = t;
          auto.current = false;
          crack();
          const cx = S / 2,
            cy = S / 2;
          particles = [];
          for (let i = 0; i < n * n; i++) {
            const b = egg.bead[i];
            if (b < 0) continue;
            const x = pad + ((i % n) + 0.5) * px,
              y = pad + (((i / n) | 0) + 0.5) * px;
            const ang = Math.atan2(y - cy, x - cx);
            const sp = 1.5 + Math.random() * 3.2;
            particles.push({ x, y, vx: Math.cos(ang) * sp + (Math.random() - 0.5), vy: Math.sin(ang) * sp - 2.2 - Math.random() * 2, hex: BEADS[b].hex, rot: 0 });
          }
        }
      } else if (phase === 'burst') {
        const e = t - burstAt;
        // 闪光
        if (e < 360) {
          const a = 1 - e / 360;
          const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.6);
          g.addColorStop(0, `rgba(255,248,225,${a})`);
          g.addColorStop(1, 'rgba(255,248,225,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, S, S);
        }
        // 豆子落进豆板
        let landedAll = true;
        for (let i = 0; i < n * n; i++) {
          const b = ras.bead[i];
          if (b < 0) continue;
          const k = (e - POUR_START - delays[i]) / FALL;
          if (k <= 0) {
            landedAll = false;
            continue;
          }
          const kk = Math.min(1, k);
          if (kk < 1) landedAll = false;
          const ease = 1 - Math.pow(1 - kk, 3);
          const bounce = kk < 1 ? Math.sin(kk * Math.PI) * 0.18 : 0;
          const x = pad + (i % n) * px,
            y = pad + ((i / n) | 0) * px - (1 - ease) * px * 4 - bounce * px;
          ctx.globalAlpha = Math.min(1, kk * 2.5);
          ctx.drawImage(beadSprite(BEADS[b].hex, px), x, y, px, px);
          if (kk >= 1 && !landedSet[i]) {
            landedSet[i] = 1;
            tick(0.8 + (1 - ((i / n) | 0) / n) * 0.7);
          }
        }
        ctx.globalAlpha = 1;
        // 蛋壳碎片
        const pe = Math.min(1, e / 900);
        for (const p of particles) {
          p.vy += 0.28;
          p.x += p.vx;
          p.y += p.vy;
          if (pe >= 1) continue;
          ctx.globalAlpha = 1 - pe;
          ctx.drawImage(beadSprite(p.hex, px), p.x - px / 2, p.y - px / 2, px, px);
        }
        ctx.globalAlpha = 1;
        if (landedAll && e > POUR_START + maxDelay + FALL) {
          phase = 'done';
          burstAt = t;
          chime();
          doneRef.current();
          nextBlink = t + 900;
        }
      } else {
        const e = t - burstAt;
        if (t > nextBlink) {
          blinkUntil = t + 150;
          nextBlink = t + 2500 + Math.random() * 3000;
        }
        // 落定、蹦一下，停一拍，再熨成烫好的样子
        const meltAt = born || still ? -Infinity : burstAt + 1100;
        const k = (t - meltAt) / MELT_MS;
        if (k < 0) {
          const hop = e < 480 ? -Math.sin((e / 480) * Math.PI) * px * 1.4 : 0;
          drawRaster(ctx, ras, { px, x0: pad, y0: pad, t, blink: t < blinkUntil, offsetY: hop });
        } else if (k < 1) {
          const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          melt.draw(ctx, ras, { px, x0: pad, y0: pad }, ease, t);
        } else {
          if (!meltedRef.current) {
            meltedRef.current = true;
            setMelted(true);
            nextBlink = t + 400;
          }
          const hop = k < 1.5 ? -Math.sin(((k - 1) / 0.5) * Math.PI) * px * 0.8 : 0;
          drawRaster(ctx, ras, { px, x0: pad, y0: pad, t, style: 'full', blink: t < blinkUntil, offsetY: hop });
        }
        if (e < 900) {
          const a = 1 - e / 900;
          for (let s = 0; s < 6; s++) {
            const ang = (s / 6) * Math.PI * 2 + e / 600;
            const r = S * 0.3 + (e / 900) * S * 0.18;
            const x = S / 2 + Math.cos(ang) * r,
              y = S / 2 + Math.sin(ang) * r;
            ctx.fillStyle = `rgba(255,200,90,${a})`;
            star(ctx, x, y, 4 + 3 * a);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [item, index]);

  const g = item.c.genes;
  return (
    <div className="hcard" style={{ animationDelay: `${index * 0.08}s`, cursor: hatched ? 'pointer' : 'default' }} onClick={onOpen}>
      <div
        className="stage"
        onPointerDown={(e) => {
          if (hatched) return;
          e.preventDefault();
          holding.current = true;
        }}
        onPointerUp={() => (holding.current = false)}
        onPointerLeave={() => (holding.current = false)}
        onPointerCancel={() => (holding.current = false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={ref} />
        {melted && <span className="stage-tag">烫好的样子</span>}
      </div>
      <div className="info">
        <div className="flavor">
          <span className="flavor-pill" style={{ background: tintOf(BEADS[g.colors.main].hex, 0.72), color: BEADS[derive(g.colors.main, STANDARD).out].hex }}>
            {item.flavor ? FLAVOR_LABEL[item.flavor] : LEAN_LABEL[item.lean ?? 'mix'][0]}
          </span>
          {item.flavor ? FLAVOR_DESC[item.flavor] : LEAN_LABEL[item.lean ?? 'mix'][1]}
        </div>
        {hatched ? (
          <>
            <div className="nm">{item.c.name}</div>
            <div className="chips">
              {tags(g)
                .slice(0, 3)
                .map((t) => (
                  <span key={t} className="chip ghost">
                    {t}
                  </span>
                ))}
            </div>
            {item.newBead !== undefined && (
              <div className="new-bead">
                <span className="bead" style={{ ['--c' as string]: BEADS[item.newBead].hex }} />
                新豆 {BEADS[item.newBead].code}：你们俩都没有
              </div>
            )}
            <div className="stats">
              {item.ras.total} 颗豆 · {item.ras.colors.length} 种颜色
            </div>
          </>
        ) : (
          <>
            <p className="hint">摇一摇：{BODY_HINT[g.body]}</p>
            <div className="stats">按住蛋壳，等它破壳</div>
          </>
        )}
      </div>
    </div>
  );
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 ? r * 0.35 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
