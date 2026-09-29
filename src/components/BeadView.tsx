import { useEffect, useRef } from 'react';
import { Raster } from '../lib/creature';
import { BeadStyle, drawRaster, setupCanvas } from '../lib/render';

interface Props {
  ras: Raster;
  size: number;
  board?: boolean;
  boardColor?: string;
  style?: BeadStyle;
  animate?: boolean;
  className?: string;
  pad?: number;
}

export default function BeadView({ ras, size, board = false, boardColor, style = 'bead', animate = false, className, pad = 0 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const { ctx } = setupCanvas(cv, size, size);
    const inner = size - pad * 2;
    const px = inner / ras.n;
    let raf = 0;
    let nextBlink = performance.now() + 1200 + Math.random() * 2500;
    let blinkUntil = 0;
    let nextHop = performance.now() + 3500 + Math.random() * 4000;
    let hopStart = -1;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, size, size);
      let offsetY = 0;
      if (animate) {
        if (t > nextBlink) {
          blinkUntil = t + 150;
          nextBlink = t + 2400 + Math.random() * 3200;
          if (Math.random() < 0.25) nextBlink = t + 320;
        }
        if (t > nextHop && style === 'bead') {
          hopStart = t;
          nextHop = t + 5000 + Math.random() * 5000;
        }
        if (hopStart > 0) {
          const k = (t - hopStart) / 420;
          if (k >= 1) hopStart = -1;
          else offsetY = -Math.sin(k * Math.PI) * px * 0.9;
        }
      }
      drawRaster(ctx, ras, {
        px,
        x0: pad,
        y0: pad,
        style,
        board,
        boardColor,
        t,
        blink: animate && t < blinkUntil,
        offsetY,
      });
      if (animate) raf = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [ras, size, board, boardColor, style, animate, pad]);
  return <canvas ref={ref} className={className} />;
}
