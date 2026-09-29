import { useMemo, useState } from 'react';
import { useApp } from '../ctx';
import { rasterize } from '../lib/creature';
import { BODIES, BODY_LABEL, Body, Flavor, makeOne, PhotoInfo, SizeIdx, tags } from '../lib/genes';
import { mulberry32, pick } from '../lib/rng';
import BeadView from './BeadView';

export default function Gallery() {
  const app = useApp();
  const [seed, setSeed] = useState(1);
  const [size, setSize] = useState<SizeIdx>(1);
  const [body, setBody] = useState<Body | 'all'>('all');
  const [big, setBig] = useState(false);
  const items = useMemo(() => {
    const r = mulberry32(seed * 999);
    return Array.from({ length: 30 }, (_, i) => {
      const colors = Array.from({ length: 5 }, () => ({ bead: pick(r, app.pool), weight: 0.1 + r() * 0.4, pos: [0.5, 0.5] as [number, number] }));
      const info: PhotoInfo = { colors, bright: 30 + r() * 50, sat: 10 + r() * 40, warm: -10 + r() * 30, edgeDir: Math.floor(r() * 4) as 0, edgeStrength: r() * 0.4, texture: r(), seed: seed * 1000 + i };
      const flavor = pick(r, ['steady', 'cute', 'wild'] as Flavor[]);
      let g = makeOne(flavor, { photo: info, size, round: 0, pool: app.pool });
      if (body !== 'all') g = { ...g, body, top: g.top };
      return { g, ras: rasterize(g, app.pool), flavor };
    });
  }, [seed, size, body, app.pool]);
  return (
    <div className="screen" style={{ paddingTop: 16 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setSeed((s) => s + 1)}>
          换一批
        </button>
        {[0, 1, 2].map((s) => (
          <button key={s} className={`chip ${size === s ? '' : 'ghost'}`} onClick={() => setSize(s as SizeIdx)}>
            {[16, 20, 24][s]}
          </button>
        ))}
        <button className={`chip ${big ? '' : 'ghost'}`} onClick={() => setBig((b) => !b)}>
          放大
        </button>
        <button className={`chip ${body === 'all' ? '' : 'ghost'}`} onClick={() => setBody('all')}>
          全部
        </button>
        {BODIES.map((b) => (
          <button key={b} className={`chip ${body === b ? '' : 'ghost'}`} onClick={() => setBody(b)}>
            {BODY_LABEL[b]}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${big ? 360 : 176}px, 1fr))`, gap: 10 }}>
        {items.map((it, i) => (
          <div key={i} className="card" style={{ padding: 8, textAlign: 'center' }}>
            <BeadView ras={it.ras} size={big ? 340 : 160} board />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {it.flavor} · {tags(it.g).join(' ')} · {it.ras.colors.length}色
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
