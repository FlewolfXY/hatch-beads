import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../ctx';
import { analyze, LabeledPoint, loadImage, thumb } from '../lib/extract';
import { PhotoInfo, readClues, SizeIdx } from '../lib/genes';
import { BEADS } from '../lib/palette';
import { pop, tick } from '../lib/sound';
import { TopBar } from './Home';

interface Props {
  src: string;
  title: string;
  note?: string;
  points?: LabeledPoint[];
}

interface Flight {
  i: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  go: boolean;
}

export function Steps({ at }: { at: number }) {
  const s = ['取色', '孵化', '拼出来'];
  return (
    <div className="steps">
      {s.map((t, i) => (
        <span key={t} className={i === at ? 'on' : ''} style={{ gap: 4 }}>
          <i>{i + 1}</i>
          {t}
          {i < s.length - 1 && <span className="sep" style={{ marginLeft: 6 }} />}
        </span>
      ))}
    </div>
  );
}

export default function Extract({ src, title, note: note0, points }: Props) {
  const app = useApp();
  const [info, setInfo] = useState<PhotoInfo | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [phase, setPhase] = useState<'scan' | 'mark' | 'fly' | 'done'>('scan');
  const [landed, setLanded] = useState<Set<number>>(new Set());
  const [off, setOff] = useState<Set<number>>(new Set());
  const [flights, setFlights] = useState<Flight[]>([]);
  const [size, setSize] = useState<SizeIdx>(1);
  const [note, setNote] = useState(note0 ?? '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const im = await loadImage(src);
      const t0 = performance.now();
      const res = await analyze(im, app.pool, points);
      const wait = Math.max(0, 1100 - (performance.now() - t0));
      setTimeout(() => {
        if (!alive) return;
        setImg(im);
        setInfo(res);
        setPhase('mark');
        pop();
      }, wait);
    })();
    return () => {
      alive = false;
    };
  }, [src, app.pool, points]);

  const markerPos = (p: [number, number]) => {
    const el = imgRef.current;
    if (!el || !img) return { x: 0, y: 0 };
    const W = el.clientWidth,
      H = el.clientHeight;
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const ox = (W - img.naturalWidth * s) / 2,
      oy = (H - img.naturalHeight * s) / 2;
    return {
      x: Math.min(W - 20, Math.max(20, ox + p[0] * img.naturalWidth * s)),
      y: Math.min(H - 20, Math.max(20, oy + p[1] * img.naturalHeight * s)),
    };
  };

  useEffect(() => {
    if (phase !== 'mark' || !info) return;
    const t = setTimeout(() => {
      const wr = wrapRef.current!.getBoundingClientRect();
      const fl: Flight[] = info.colors.map((c, i) => {
        const m = markerPos(c.pos);
        const slot = slotRefs.current[i]?.querySelector('.bead-target')?.getBoundingClientRect();
        const x0 = wr.left + m.x - 19,
          y0 = wr.top + m.y - 19;
        return { i, x0, y0, dx: slot ? slot.left - x0 : 0, dy: slot ? slot.top - y0 : 0, go: false };
      });
      setFlights(fl);
      setPhase('fly');
      fl.forEach((f, k) => {
        setTimeout(() => {
          setFlights((cur) => cur.map((x) => (x.i === f.i ? { ...x, go: true } : x)));
        }, 80 + k * 240);
        setTimeout(() => {
          tick(1 + k * 0.08);
          setLanded((s) => new Set(s).add(f.i));
          setFlights((cur) => cur.filter((x) => x.i !== f.i));
          if (k === fl.length - 1) setTimeout(() => setPhase('done'), 200);
        }, 80 + k * 240 + 700);
      });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, info]);

  const clues = useMemo(() => (info ? readClues(info) : []), [info]);
  const active = info ? info.colors.filter((_, i) => !off.has(i)) : [];

  const toggle = (i: number) => {
    if (phase !== 'done') return;
    setOff((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else if (info!.colors.length - n.size > 3) n.add(i);
      else app.toast('至少留 3 种颜色');
      return n;
    });
  };

  const next = () => {
    if (!info || !img) return;
    app.go({
      k: 'hatch',
      photo: { title, note: note.trim() || undefined, thumb: thumb(img), info: { ...info, colors: active } },
      size,
      round: 0,
    });
  };

  return (
    <div className="screen">
      <TopBar onBack={app.back} title={title} />
      <Steps at={0} />
      <div className="photo-wrap" ref={wrapRef}>
        <img ref={imgRef} src={src} alt="" />
        {phase === 'scan' && <div className="scan" />}
        {info &&
          phase !== 'scan' &&
          info.colors.map((c, i) => {
            const m = markerPos(c.pos);
            return (
              <div
                key={i}
                className="marker"
                style={{ left: m.x, top: m.y, background: BEADS[c.bead].hex, opacity: off.has(i) ? 0.35 : 1, animationDelay: `${i * 0.15}s` }}
              />
            );
          })}
      </div>

      <div className="tray">
        <div className="row" style={{ justifyContent: 'space-between', margin: '0 6px 10px' }}>
          <b style={{ fontSize: 14 }}>豆盘</b>
          <span className="sub" style={{ fontSize: 12 }}>
            {phase === 'scan' ? '正在读照片里的颜色…' : phase === 'done' ? '点一颗可以拿掉它' : '颜色正在跳进豆盘'}
          </span>
        </div>
        <div className="tray-row">
          {(info?.colors ?? Array.from({ length: 5 }, () => null)).map((c, i) => (
            <div key={i} ref={(el) => (slotRefs.current[i] = el)} className={`tray-slot ${off.has(i) ? 'off' : ''}`} onClick={() => toggle(i)}>
              <div className="bead-target" style={{ width: 38, height: 38, borderRadius: 19, background: landed.has(i) ? 'transparent' : 'rgba(43,35,32,0.06)' }}>
                {c && landed.has(i) && <div className="bead" style={{ ['--c' as string]: BEADS[c.bead].hex, animation: 'pop .4s cubic-bezier(.3,1.6,.5,1) both' }} />}
              </div>
              {c && landed.has(i) ? (
                <>
                  <span className="code">{BEADS[c.bead].code}</span>
                  {c.crop && <img className="crop" src={c.crop} alt="" />}
                  <span className="lbl">{c.label}</span>
                </>
              ) : (
                <span className="code" style={{ color: 'var(--faint)' }}>
                  ···
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {flights.map((f) => (
        <div
          key={f.i}
          className="flying"
          style={{ left: f.x0, top: f.y0, transform: f.go ? `translate(${f.dx}px, ${f.dy}px)` : 'scale(1.3)', opacity: 1 }}
        >
          <div className="bead" style={{ ['--c' as string]: BEADS[info!.colors[f.i].bead].hex, width: 38, height: 38 }} />
        </div>
      ))}

      {phase === 'done' && (
        <>
          <div className="section-head" style={{ marginTop: 22 }}>
            <h2 className="h2" style={{ fontSize: 16 }}>
              照片告诉我…
            </h2>
            <span className="sub">这些线索会写进基因</span>
          </div>
          <div className="clues">
            {clues.map((c, i) => (
              <div key={i} className="clue" style={{ animationDelay: `${i * 0.08}s` }}>
                <b>{c.text}</b>
                <span className="arrow">→</span>
                <span>{c.hint}</span>
              </div>
            ))}
            {!clues.length && <div className="clue">这张照片很均衡 → 什么都有可能</div>}
          </div>

          <div className="section-head" style={{ marginTop: 22 }}>
            <h2 className="h2" style={{ fontSize: 16 }}>
              孵多大？
            </h2>
            <span className="sub">之后也能改</span>
          </div>
          <div className="seg">
            {(['迷你', '小挂件', '挂件'] as const).map((t, i) => (
              <button key={t} className={size === i ? 'on' : ''} onClick={() => setSize(i as SizeIdx)}>
                {t}
                <small>
                  {[16, 20, 24][i]}×{[16, 20, 24][i]} · 约 {[130, 200, 290][i]} 颗
                </small>
              </button>
            ))}
          </div>

          <div className="section-head" style={{ marginTop: 22 }}>
            <h2 className="h2" style={{ fontSize: 16 }}>
              那一刻，想留一句话吗？
            </h2>
            <span className="sub">会写在出生证上</span>
          </div>
          <textarea className="note" rows={2} maxLength={40} placeholder="比如：下课了，雨还没停。" value={note} onChange={(e) => setNote(e.target.value)} />
        </>
      )}

      <div className="bottom-bar">
        <div className="inner">
          <button className="btn btn-primary" disabled={phase !== 'done'} onClick={next}>
            放进孵蛋器 · {active.length || '…'} 种颜色
          </button>
        </div>
      </div>
    </div>
  );
}
