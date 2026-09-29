import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../ctx';
import { rasterize } from '../lib/creature';
import { fileToDataURL } from '../lib/extract';
import { SAMPLES, SHOWCASE } from '../lib/samples';
import BeadView from './BeadView';
import { Box, Camera, Link, SoundOff, SoundOn } from './icons';
import { BEADS } from '../lib/palette';

export function Logo() {
  const c = ['#EF8A3C', '#3FA06C', '#F4E6C4', '#F4A8B8', '#8FA7B6'];
  const dots = [
    [7, 3, 0],
    [11, 3, 2],
    [4, 7, 1],
    [8, 7, 3],
    [12, 7, 0],
    [4, 11, 2],
    [8, 11, 4],
    [12, 11, 1],
    [8, 15, 0],
  ];
  return (
    <svg width="26" height="26" viewBox="0 0 16 19">
      {dots.map(([x, y, i], k) => (
        <circle key={k} cx={x} cy={y} r="1.85" fill={c[i]} />
      ))}
    </svg>
  );
}

export function TopBar({ title, onBack }: { title?: string; onBack?: () => void }) {
  const app = useApp();
  return (
    <div className="topbar">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="返回">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      ) : (
        <div className="logo">
          <Logo />
          孵豆
          <small>HATCH BEADS</small>
        </div>
      )}
      {title !== undefined && <div className="nav-title">{title}</div>}
      <div className="row" style={{ gap: 8 }}>
        <button className="icon-btn" onClick={app.toggleSound} aria-label="声音">
          {app.sound ? <SoundOn size={19} /> : <SoundOff size={19} />}
        </button>
        {!onBack && (
          <button className="icon-btn" onClick={app.openBox} aria-label="我的豆盒">
            <Box size={19} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const app = useApp();
  const shows = useMemo(() => SHOWCASE.map((g) => rasterize(g, app.pool)), [app.pool]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % shows.length), 3600);
    return () => clearInterval(t);
  }, [shows.length]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const src = await fileToDataURL(f);
    const d = new Date();
    app.go({ k: 'extract', src, title: `${d.getMonth() + 1}月${d.getDate()}日看见的` });
  };

  const labels = ['2号线末班车', '放学的晚霞', '雨天的窗'];
  const decor = [
    { x: '8%', y: '18%', c: '#EF8A3C', d: 0 },
    { x: '86%', y: '12%', c: '#3FA06C', d: 1.2 },
    { x: '12%', y: '72%', c: '#F4A8B8', d: 2.1 },
    { x: '84%', y: '66%', c: '#8FA7B6', d: 0.6 },
    { x: '72%', y: '86%', c: '#F6D77A', d: 1.7 },
  ];

  return (
    <div className="screen">
      <TopBar />
      <div className="hero">
        {decor.map((d, i) => (
          <div key={i} className="floaty" style={{ left: d.x, top: d.y, animationDelay: `${d.d}s` }}>
            <div className="bead" style={{ ['--c' as string]: d.c, width: 16, height: 16 }} />
          </div>
        ))}
        <div className="hero-board">
          <div key={idx} style={{ animation: 'pop .55s cubic-bezier(.3,1.5,.5,1) both' }}>
            <BeadView ras={shows[idx]} size={216} board animate boardColor="rgba(255,255,255,0.55)" pad={0} />
          </div>
        </div>
        <div className="hero-cap">
          <span>
            来自「{labels[idx]}」· {shows[idx].total} 颗豆 · {shows[idx].colors.length} 色
          </span>
          <div className="hero-dots">
            {shows.map((_, i) => (
              <i key={i} className={i === idx ? 'on' : ''} />
            ))}
          </div>
        </div>
      </div>

      <h1 className="h1" style={{ marginTop: 26 }}>
        你今天看见的颜色，
        <br />
        会孵出什么崽？
      </h1>
      <p className="lead">
        拍一张照片，颜色变成基因，孵出一只世界上还没有的拼豆崽。每一颗像素都是一颗真实的豆，照着图纸就能亲手拼出来。
      </p>

      <label className="btn btn-primary btn-block upload">
        <Camera size={20} />
        选一张今天拍的照片
        <input type="file" accept="image/*" onChange={onFile} />
      </label>
      <div className="sub center" style={{ marginTop: 8, fontSize: 12 }}>
        照片只在你的手机里处理，不会上传
      </div>

      <div className="section-head">
        <h2 className="h2">手边没照片？先拿这些试试</h2>
      </div>
      <div className="samples">
        {SAMPLES.map((s) => (
          <button key={s.id} className="sample" onClick={() => app.go({ k: 'extract', src: s.src, title: s.title, note: s.note, points: s.points })}>
            <img src={s.src} alt={s.title} />
            <div className="meta">
              <div className="t">{s.title}</div>
              <div className="strip">
                {s.strip.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      <button className="card breed-cta" style={{ width: '100%', textAlign: 'left' }} onClick={() => app.go({ k: 'breed' })}>
        <div className="icon-btn" style={{ background: '#FFE4EF', color: '#C2185B', boxShadow: 'none' }}>
          <Link size={19} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="t">朋友发来了豆码？</div>
          <div className="sub">粘贴过来，和你的崽配一窝</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="section-head">
        <h2 className="h2">我的豆窝</h2>
        <span className="sub">
          {app.nest.length ? `${app.nest.length} 只 · ${app.nest.filter((c) => c.madeAt).length} 只已出生` : ''}
        </span>
      </div>
      {app.nest.length ? (
        <div className="nest">
          {app.nest.map((c) => (
            <NestItem key={c.id} id={c.id} />
          ))}
        </div>
      ) : (
        <div className="empty">
          孵出来的崽会住在这里
          <br />
          拼好的崽会被点亮
        </div>
      )}
      <div className="foot">
        孵豆 · 屏幕里孵，手里出生
        <br />
        色号使用 MARD 291 色，屏幕颜色为近似色
      </div>
    </div>
  );
}

function NestItem({ id }: { id: string }) {
  const app = useApp();
  const c = app.get(id)!;
  const ras = useMemo(() => rasterize(c.genes, app.pool), [c.genes, app.pool]);
  return (
    <button className={`nest-item ${c.madeAt ? '' : 'unmade'}`} onClick={() => app.go({ k: 'detail', id })}>
      {c.madeAt && <span className="born">已出生</span>}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <BeadView ras={ras} size={88} />
      </div>
      <div className="nm">{c.name}</div>
      <div className="st">{c.madeAt ? '在你手里' : `待拼 · ${ras.total} 颗`}</div>
      <div className="strip" style={{ justifyContent: 'center' }}>
        {[c.genes.colors.main, c.genes.colors.pat, c.genes.colors.acc].map((b, i) => (
          <i key={i} style={{ background: BEADS[b].hex, width: 8, height: 8 }} />
        ))}
      </div>
    </button>
  );
}
