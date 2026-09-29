import { useEffect, useRef } from 'react';
import { Raster } from '../lib/creature';
import { BeadStyle, drawRaster, Melt, MELT_MS, reduceMotion, setupCanvas } from '../lib/render';

export type ViewMode = 'bead' | 'fused';

interface Props {
  ras: Raster;
  size: number;
  board?: boolean;
  boardColor?: string;
  style?: BeadStyle;
  animate?: boolean;
  className?: string;
  pad?: number;
  /** 出场后多少毫秒自动“熨”成烫好的样子 */
  melt?: number;
  /** 点一下在豆板 / 烫好之间切换 */
  toggle?: boolean;
  onMode?: (m: ViewMode) => void;
}

export default function BeadView({ ras, size, board = false, boardColor, style = 'bead', animate = false, className, pad = 0, melt, toggle, onMode }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ mode: ViewMode; trans: { to: ViewMode; start: number } | null }>({ mode: 'bead', trans: null });
  const onModeRef = useRef(onMode);
  onModeRef.current = onMode;

  useEffect(() => {
    const cv = ref.current!;
    const { ctx } = setupCanvas(cv, size, size);
    const inner = size - pad * 2;
    const px = inner / ras.n;
    const meltable = melt !== undefined || toggle;
    const st = state.current;
    const now = performance.now();
    if (melt !== undefined) {
      if (reduceMotion()) {
        st.mode = 'fused';
        st.trans = null;
        onModeRef.current?.('fused');
      } else {
        st.mode = 'bead';
        st.trans = { to: 'fused', start: now + melt };
        onModeRef.current?.('bead');
      }
    }
    const fx = new Melt();
    const loops = animate || meltable;
    let raf = 0;
    let nextBlink = now + 1200 + Math.random() * 2500;
    let blinkUntil = 0;
    let nextHop = now + 3500 + Math.random() * 4000;
    let hopStart = -1;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, size, size);
      const o = { px, x0: pad, y0: pad, board, boardColor, t };
      const tr = st.trans;
      if (tr && t >= tr.start) {
        const k = Math.min(1, (t - tr.start) / MELT_MS);
        const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        fx.draw(ctx, ras, o, tr.to === 'fused' ? ease : 1 - ease, t, tr.to === 'fused');
        if (k >= 1) {
          st.mode = tr.to;
          st.trans = null;
          onModeRef.current?.(tr.to);
          nextBlink = t + 500;
        }
      } else {
        let offsetY = 0;
        if (animate) {
          if (t > nextBlink) {
            blinkUntil = t + 150;
            nextBlink = t + 2400 + Math.random() * 3200;
            if (Math.random() < 0.25) nextBlink = t + 320;
          }
          if (t > nextHop && !tr) {
            hopStart = t;
            nextHop = t + 5000 + Math.random() * 5000;
          }
          if (hopStart > 0) {
            const k = (t - hopStart) / 420;
            if (k >= 1) hopStart = -1;
            else offsetY = -Math.sin(k * Math.PI) * px * 0.9;
          }
        }
        const s: BeadStyle = meltable ? (st.mode === 'fused' ? 'full' : 'bead') : style;
        drawRaster(ctx, ras, { ...o, style: s, blink: animate && t < blinkUntil, offsetY });
      }
      if (loops) raf = requestAnimationFrame(draw);
    };
    draw(now);
    return () => cancelAnimationFrame(raf);
  }, [ras, size, board, boardColor, style, animate, pad, melt, toggle]);

  const onClick = toggle
    ? () => {
        const st = state.current;
        if (st.trans) return;
        st.trans = { to: st.mode === 'fused' ? 'bead' : 'fused', start: performance.now() };
      }
    : undefined;

  return <canvas ref={ref} className={className} onClick={onClick} style={toggle ? { cursor: 'pointer' } : undefined} />;
}
