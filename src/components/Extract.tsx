import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../ctx';
import { analyze, crop, labelAt, LabeledPoint, loadImage, makeSampler, thumb } from '../lib/extract';
import { PhotoColor, PhotoInfo, readClues, SizeIdx } from '../lib/genes';
import { BEADS, nearest } from '../lib/palette';
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

interface Drag {
  i: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
  bead: number;
  moved: boolean;
}

const MAX_COLORS = 6;
const MANUAL_WEIGHT = 0.22;

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
  const [colors, setColors] = useState<PhotoColor[]>([]);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [phase, setPhase] = useState<'scan' | 'mark' | 'fly' | 'done'>('scan');
  const [landed, setLanded] = useState<Set<number>>(new Set());
  const [off, setOff] = useState<Set<number>>(new Set());
  const [flights, setFlights] = useState<Flight[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [edited, setEdited] = useState(false);
  const [size, setSize] = useState<SizeIdx>(1);
  const [note, setNote] = useState(note0 ?? '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sampler = useRef<ReturnType<typeof makeSampler> | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const im = await loadImage(src);
      const t0 = performance.now();
      const res = await analyze(im, app.pool, points);
      sampler.current = makeSampler(im);
      const wait = Math.max(0, 1100 - (performance.now() - t0));
      setTimeout(() => {
        if (!alive) return;
        setImg(im);
        setInfo(res);
        setColors(res.colors);
        setPhase('mark');
        pop();
      }, wait);
    })();
    return () => {
      alive = false;
    };
  }, [src, app.pool, points]);

  /** 照片上的显示坐标 ↔ 原图的归一化坐标（照片是 object-fit: cover） */
  const frame = () => {
    const el = imgRef.current;
    if (!el || !img) return null;
    const W = el.clientWidth,
      H = el.clientHeight;
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    return { W, H, s, ox: (W - img.naturalWidth * s) / 2, oy: (H - img.naturalHeight * s) / 2, iw: img.naturalWidth * s, ih: img.naturalHeight * s };
  };

  const markerPos = (p: [number, number]) => {
    const f = frame();
    if (!f) return { x: 0, y: 0 };
    return {
      x: Math.min(f.W - 20, Math.max(20, f.ox + p[0] * f.iw)),
      y: Math.min(f.H - 20, Math.max(20, f.oy + p[1] * f.ih)),
    };
  };

  const toImage = (clientX: number, clientY: number) => {
    const f = frame()!;
    const wr = wrapRef.current!.getBoundingClientRect();
    const x = Math.min(f.W - 2, Math.max(2, clientX - wr.left));
    const y = Math.min(f.H - 2, Math.max(2, clientY - wr.top));
    return { x, y, nx: (x - f.ox) / f.iw, ny: (y - f.oy) / f.ih };
  };

  const beadAt = (nx: number, ny: number) => nearest(sampler.current!(nx, ny), app.pool);

  useEffect(() => {
    if (phase !== 'mark' || !info) return;
    const t = setTimeout(() => {
      const wr = wrapRef.current!.getBoundingClientRect();
      const fl: Flight[] = info.colors.map((c, i) => {
        const m = markerPos(c.pos);
        const slot = slotRefs.current[i]?.querySelector('.bead-target')?.getBoundingClientRect();
        const x0 = wr.left + m.x - 18,
          y0 = wr.top + m.y - 18;
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
  const active = colors.filter((_, i) => !off.has(i));

  const toggle = (i: number) => {
    if (phase !== 'done') return;
    setOff((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else if (colors.length - n.size > 3) n.add(i);
      else app.toast('至少留 3 种颜色');
      return n;
    });
  };

  /* ---------- 拖动圆点换颜色 ---------- */
  const onMarkerDown = (i: number) => (e: React.PointerEvent) => {
    if (phase !== 'done') return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = toImage(e.clientX, e.clientY);
    setDrag({ i, ...p, bead: colors[i].bead, moved: false });
  };

  const onMarkerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toImage(e.clientX, e.clientY);
    const moved = drag.moved || Math.hypot(p.x - drag.x, p.y - drag.y) > 4;
    if (!moved) return;
    const bead = beadAt(p.nx, p.ny);
    if (bead !== drag.bead) tick(1.3);
    setDrag({ ...drag, ...p, bead, moved: true });
  };

  const onMarkerUp = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 50);
    if (!d.moved || !img) return;
    const nx = Math.min(1, Math.max(0, d.nx)),
      ny = Math.min(1, Math.max(0, d.ny));
    setColors((cs) =>
      cs.map((c, j) =>
        j === d.i ? { bead: d.bead, weight: Math.max(c.weight, MANUAL_WEIGHT), pos: [nx, ny], label: labelAt(nx, ny, points, d.bead), crop: crop(img, nx, ny), manual: true } : c,
      ),
    );
    setOff((s) => {
      const n = new Set(s);
      n.delete(d.i);
      return n;
    });
    setEdited(true);
    pop();
  };

  /* ---------- 点照片空白处加一种颜色 ---------- */
  const onPhotoClick = (e: React.MouseEvent) => {
    if (phase !== 'done' || !img || suppressClick.current) return;
    const p = toImage(e.clientX, e.clientY);
    const bead = beadAt(p.nx, p.ny);
    const dup = colors.findIndex((c) => c.bead === bead);
    if (dup >= 0) {
      setOff((s) => {
        const n = new Set(s);
        n.delete(dup);
        return n;
      });
      app.toast(`豆盘里已经有 ${BEADS[bead].code} 了`);
      return;
    }
    if (colors.length >= MAX_COLORS) {
      app.toast('最多 6 种颜色，拖动已有的圆点来换');
      return;
    }
    const nx = Math.min(1, Math.max(0, p.nx)),
      ny = Math.min(1, Math.max(0, p.ny));
    const idx = colors.length;
    setColors((cs) => [...cs, { bead, weight: MANUAL_WEIGHT, pos: [nx, ny], label: labelAt(nx, ny, points, bead), crop: crop(img, nx, ny), manual: true }]);
    setLanded((s) => new Set(s).add(idx));
    setEdited(true);
    tick(1.2);
  };

  const reset = () => {
    if (!info) return;
    setColors(info.colors);
    setOff(new Set());
    setLanded(new Set(info.colors.map((_, i) => i)));
    setEdited(false);
  };

  const next = () => {
    if (!info || !img) return;
    const seen = new Set<number>();
    const picked = active.filter((c) => (seen.has(c.bead) ? false : (seen.add(c.bead), true)));
    app.go({
      k: 'hatch',
      photo: { title, note: note.trim() || undefined, thumb: thumb(img), info: { ...info, colors: picked } },
      size,
      round: 0,
    });
  };

  const f = frame();
  const LOUPE = 92,
    ZOOM = 3;

  return (
    <div className="screen">
      <TopBar onBack={app.back} title={title} />
      <Steps at={0} />
      <div className={`photo-wrap ${phase === 'done' ? 'editable' : ''}`} ref={wrapRef} onClick={onPhotoClick}>
        <img ref={imgRef} src={src} alt="" draggable={false} />
        {phase === 'scan' && <div className="scan" />}
        {phase !== 'scan' &&
          colors.map((c, i) => {
            const dragging = drag?.i === i && drag.moved;
            const m = dragging ? { x: drag.x, y: drag.y } : markerPos(c.pos);
            const bead = dragging ? drag.bead : c.bead;
            return (
              <div
                key={i}
                className={`marker ${phase === 'done' ? 'grab' : ''} ${dragging ? 'dragging' : ''}`}
                style={{ left: m.x, top: m.y, background: BEADS[bead].hex, opacity: off.has(i) ? 0.35 : 1, animationDelay: `${i * 0.15}s` }}
                onPointerDown={onMarkerDown(i)}
                onPointerMove={onMarkerMove}
                onPointerUp={onMarkerUp}
                onPointerCancel={onMarkerUp}
                onClick={(e) => e.stopPropagation()}
              />
            );
          })}
        {drag?.moved && f && (
          <div
            className="loupe"
            style={{
              left: drag.x - LOUPE / 2,
              top: drag.y - LOUPE - 34 < 0 ? drag.y + 34 : drag.y - LOUPE - 34,
              width: LOUPE,
              height: LOUPE,
              backgroundImage: `url(${src})`,
              backgroundSize: `${f.iw * ZOOM}px ${f.ih * ZOOM}px`,
              backgroundPosition: `${-(drag.x - f.ox) * ZOOM + LOUPE / 2}px ${-(drag.y - f.oy) * ZOOM + LOUPE / 2}px`,
            }}
          >
            <span className="loupe-chip">
              <span className="bead" style={{ ['--c' as string]: BEADS[drag.bead].hex }} />
              {BEADS[drag.bead].code}
            </span>
          </div>
        )}
      </div>
      {phase === 'done' && (
        <div className="edit-hint">
          <span>拖动圆点换颜色 · 点照片加一种颜色</span>
          {edited && (
            <button className="link-btn" onClick={reset}>
              恢复自动
            </button>
          )}
        </div>
      )}

      <div className="tray">
        <div className="row" style={{ justifyContent: 'space-between', margin: '0 6px 10px' }}>
          <b style={{ fontSize: 14 }}>豆盘</b>
          <span className="sub" style={{ fontSize: 12 }}>
            {phase === 'scan' ? '正在从照片里挑颜色…' : phase === 'done' ? '点一颗豆，先拿掉它' : '颜色正在跳进豆盘'}
          </span>
        </div>
        <div className="tray-row">
          {(colors.length ? colors : Array.from({ length: 5 }, () => null)).map((c, i) => (
            <div key={i} ref={(el) => (slotRefs.current[i] = el)} className={`tray-slot ${off.has(i) ? 'off' : ''}`} onClick={() => toggle(i)}>
              <div className="bead-target" style={{ background: landed.has(i) ? 'transparent' : 'rgba(43,35,32,0.06)' }}>
                {c && landed.has(i) && <div key={c.bead} className="bead" style={{ ['--c' as string]: BEADS[c.bead].hex, animation: 'pop .4s cubic-bezier(.3,1.6,.5,1) both' }} />}
                {c?.manual && landed.has(i) && <span className="manual-dot" />}
              </div>
              {c && landed.has(i) ? (
                <>
                  <span className="code">{BEADS[c.bead].code}</span>
                  {c.crop && <img className="crop" src={c.crop} alt="" />}
                  <span className={`lbl ${c.manual ? 'mine' : ''}`}>{c.manual ? '你选的' : c.label}</span>
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

      {flights.map((fl) => (
        <div
          key={fl.i}
          className="flying"
          style={{ left: fl.x0, top: fl.y0, transform: fl.go ? `translate(${fl.dx}px, ${fl.dy}px)` : 'scale(1.3)', opacity: 1 }}
        >
          <div className="bead" style={{ ['--c' as string]: BEADS[colors[fl.i]?.bead ?? 0].hex, width: 36, height: 36 }} />
        </div>
      ))}

      {phase === 'done' && (
        <>
          <div className="section-head" style={{ marginTop: 22 }}>
            <h2 className="h2" style={{ fontSize: 16 }}>
              从照片里读到了
            </h2>
            <span className="sub">这些会写进崽的基因</span>
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
