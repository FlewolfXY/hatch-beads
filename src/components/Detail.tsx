import { useMemo, useState } from 'react';
import { PhotoCtx, useApp } from '../ctx';
import { encode } from '../lib/code';
import { minutesFor, rasterize } from '../lib/creature';
import { Colors, DIR_LABEL, GENE_KEYS, GENE_LABEL, GeneKey, geneText, palettesOf, Pins } from '../lib/genes';
import { BEADS } from '../lib/palette';
import { hexToRgb, rgbToHex, RGB } from '../lib/color';
import { Creature } from '../lib/store';
import BeadView from './BeadView';
import { TopBar } from './Home';
import { Card, Copy, Grid, Heart, Link, Pin, Shuffle } from './icons';

export function tintOf(hex: string, t: number) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t] as RGB);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function photoCtxOf(c: Creature): PhotoCtx {
  if (c.photo) return { title: c.photo.title, thumb: c.photo.thumb, note: c.note, info: { ...c.photo.info, colors: c.photo.colors } };
  return {
    title: c.name,
    note: c.note,
    info: { colors: palettesOf(c.genes), bright: 55, sat: 25, warm: 5, edgeDir: c.genes.dir, edgeStrength: 0.1, texture: 0.3, seed: c.genes.quirk * 7919 + c.genes.colors.main },
  };
}

const ROLE_LABEL: Record<keyof Colors, string> = { main: '主色', sub: '浅色', pat: '花纹', acc: '点缀' };

export default function Detail({ id }: { id: string }) {
  const app = useApp();
  const c = app.get(id);
  const [pins, setPins] = useState<Pins>({});
  const ras = useMemo(() => (c ? rasterize(c.genes, app.pool) : null), [c, app.pool]);
  if (!c || !ras) return <div className="screen">找不到这只崽了</div>;
  const g = c.genes;
  const code = encode(g);
  const kept = app.kept(id);
  const main = BEADS[g.colors.main].hex;
  const boardSize = Math.min(340, window.innerWidth - 72);
  const pinCount = Object.values(pins).filter(Boolean).length;

  const togglePin = (k: GeneKey) => setPins((p) => ({ ...p, [k]: !p[k] }));
  const rehatch = () => {
    app.go({ k: 'hatch', photo: photoCtxOf(c), size: g.size, round: 1 + Math.floor(Math.random() * 900), base: c, pins });
  };

  // 它为什么长这样
  const why: { img?: string; bead?: number; text: string; from: string }[] = [];
  if (c.photo) {
    const seen = new Set<number>();
    for (const role of ['main', 'pat', 'sub', 'acc'] as (keyof Colors)[]) {
      const b = g.colors[role];
      const pc = c.photo.colors.find((p) => p.bead === b && !p.derived);
      if (!pc || seen.has(b)) continue;
      seen.add(b);
      why.push({ img: pc.crop, bead: b, text: `${ROLE_LABEL[role]} ${BEADS[b].code}`, from: `来自照片里的${pc.label ?? '颜色'}` });
    }
    const inf = c.photo.info;
    if (g.pattern === 'stripes' && inf.edgeStrength > 0.18 && g.dir === inf.edgeDir) why.push({ text: DIR_LABEL[g.dir], from: '照片里这个方向的线条很多' });
    if (g.pattern === 'dots' && inf.texture > 0.42) why.push({ text: '斑点', from: '照片的纹理很细碎' });
    if (g.eyes === 'sleepy' && inf.bright < 42) why.push({ text: '困困眼', from: '照片偏暗' });
    if (g.eyes === 'sparkle' && inf.bright > 68) why.push({ text: '闪光眼', from: '照片很亮' });
  }
  const notes = c.notes ?? [];

  return (
    <div className="screen">
      <TopBar onBack={app.back} title="" />
      <div className="big-board" style={{ background: `linear-gradient(160deg, ${tintOf(main, 0.9)}, ${tintOf(main, 0.78)})` }}>
        <BeadView ras={ras} size={boardSize} board animate boardColor="rgba(255,255,255,0.5)" />
        {c.madeAt && (
          <span className="chip" style={{ position: 'absolute', top: 14, right: 14, background: 'var(--red)', color: '#fff' }}>
            已出生
          </span>
        )}
      </div>
      <div className="name-row">
        <input value={c.name} maxLength={10} onChange={(e) => app.put({ ...c, name: e.target.value })} aria-label="名字" />
        {c.flavor && <span className="chip">{c.flavor}</span>}
      </div>
      <div className="stat-row">
        <span>
          <b>{ras.n}×{ras.n}</b>
        </span>
        <span>
          <b>{ras.total}</b> 颗
        </span>
        <span>
          <b>{ras.colors.length}</b> 色
        </span>
        <span>
          约 <b>{minutesFor(ras.total)}</b> 分钟拼完
        </span>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 className="h2" style={{ fontSize: 16 }}>
            基因
          </h2>
          <span className="sub" style={{ fontSize: 12 }}>
            钉住喜欢的，再孵只变没钉住的
          </span>
        </div>
        <div className="genes">
          {GENE_KEYS.filter((k) => k !== 'rare' || g.rare !== 'none').map((k) => (
            <div className="gene" key={k}>
              <span className="k">{GENE_LABEL[k]}</span>
              <span className="v">
                {k === 'colors'
                  ? (Object.keys(ROLE_LABEL) as (keyof Colors)[]).map((r) => (
                      <span key={r} className="color-chip" title={ROLE_LABEL[r]}>
                        <span className="bead" style={{ ['--c' as string]: BEADS[g.colors[r]].hex }} />
                        {BEADS[g.colors[r]].code}
                      </span>
                    ))
                  : geneText(g, k)}
                {k === 'rare' && <span className="chip" style={{ background: '#FFE4EF', color: '#C2185B' }}>罕见</span>}
              </span>
              <button className={`pin ${pins[k] ? 'on' : ''}`} onClick={() => togglePin(k)} aria-label={`钉住${GENE_LABEL[k]}`}>
                <Pin size={17} />
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={rehatch}>
          <Shuffle size={18} />
          {pinCount ? `锁住 ${pinCount} 项，再孵一窝` : '用这组颜色再孵一窝'}
        </button>
      </div>

      {(why.length > 0 || notes.length > 0) && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 className="h2" style={{ fontSize: 16, marginBottom: 12 }}>
            它为什么长这样
          </h2>
          <div className="why">
            {why.map((w, i) => (
              <div key={i} className="why-item">
                {w.img ? <img src={w.img} alt="" /> : <span style={{ width: 34, textAlign: 'center', color: 'var(--faint)' }}>·</span>}
                {w.bead !== undefined && <span className="bead" style={{ ['--c' as string]: BEADS[w.bead].hex }} />}
                <b>{w.text}</b>
                <span className="from">← {w.from}</span>
              </div>
            ))}
            {notes.map((n, i) => (
              <div key={'n' + i} className="why-item">
                <span style={{ width: 22, textAlign: 'center', color: 'var(--faint)' }}>·</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-head">
        <h2 className="h2" style={{ fontSize: 16 }}>
          豆码
        </h2>
        <span className="sub">只有基因，没有照片</span>
      </div>
      <div className="code-box">
        <span className="mono">{code}</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            await copyText(code);
            app.toast('豆码已复制，发给朋友配种吧');
          }}
        >
          <Copy size={16} />
          复制
        </button>
      </div>

      <div className="actions">
        <button className="btn btn-ghost" onClick={() => app.go({ k: 'breed', aId: id })}>
          <Link size={18} />
          配种
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (!kept) {
              app.keep(id);
              app.toast('收进豆窝了');
            }
          }}
        >
          <Heart size={18} filled={kept} />
          {kept ? '在豆窝里' : '收进豆窝'}
        </button>
      </div>

      <div className="bottom-bar">
        <div className="inner">
          <button
            className="btn btn-ghost"
            style={{ flex: '0 0 auto' }}
            onClick={() => {
              if (!kept) app.keep(id);
              app.go({ k: 'cert', id });
            }}
          >
            <Card size={18} />
            出生证
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!kept) app.keep(id);
              app.go({ k: 'sheet', id });
            }}
          >
            <Grid size={18} />
            看图纸，拼出来
          </button>
        </div>
      </div>
    </div>
  );
}
