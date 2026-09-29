import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../ctx';
import { encode } from '../lib/code';
import { mirrorRaster, rasterize, remap } from '../lib/creature';
import { SizeIdx } from '../lib/genes';
import { BEADS } from '../lib/palette';
import { drawSheet } from '../lib/sheet';
import { downloadCanvas } from '../lib/cert';
import { BeadStyle } from '../lib/render';
import { poolOf } from '../lib/store';
import { isLocalHost, loadNick, shareUrl, siteLabel } from '../lib/share';
import BeadView from './BeadView';
import { Steps } from './Extract';
import { TopBar } from './Home';
import { Box, Card, Download } from './icons';

export default function SheetView({ id }: { id: string }) {
  const app = useApp();
  const c = app.get(id)!;
  const [mirror, setMirror] = useState(false);
  const [ring, setRing] = useState(false);
  const [mine, setMine] = useState(app.box.mode === 'mine');
  const [tab, setTab] = useState<'sheet' | 'preview'>('sheet');
  const [style, setStyle] = useState<BeadStyle>('full');
  const cvRef = useRef<HTMLCanvasElement>(null);

  const minePool = useMemo(() => poolOf({ mode: 'mine', mine: app.box.mine }), [app.box.mine]);
  const hasMine = app.box.mine.length >= 8;
  const base = useMemo(() => rasterize(c.genes, app.pool), [c.genes, app.pool]);
  const ras = useMemo(() => {
    let r = mine && hasMine ? remap(base, minePool) : base;
    if (mirror) r = mirrorRaster(r);
    return r;
  }, [base, mine, hasMine, minePool, mirror]);

  const [wx, setWx] = useState(false);
  const source = useMemo(
    () => (wx ? { qr: shareUrl({ code: encode(c.genes), name: c.name, owner: loadNick() || undefined }), site: siteLabel() || undefined } : {}),
    [wx, c.genes, c.name],
  );

  useEffect(() => {
    if (tab !== 'sheet' || !cvRef.current) return;
    drawSheet(cvRef.current, ras, { name: c.name, code: encode(c.genes), mirror, ring, ...source });
  }, [ras, c.name, c.genes, mirror, ring, tab, source]);

  const changed = mine && hasMine ? base.colors.filter((x) => !minePool.includes(x.bead)).length : 0;
  const setSize = (s: SizeIdx) => app.put({ ...c, genes: { ...c.genes, size: s } });

  const save = () => {
    const cv = document.createElement('canvas');
    drawSheet(cv, ras, { name: c.name, code: encode(c.genes), mirror, ring, scale: 3, ...source });
    downloadCanvas(cv, `孵豆图纸-${c.name}-${ras.n}x${ras.n}${wx ? '-微信' : ''}.png`);
    app.toast(wx ? '图纸已保存' : '图纸已保存，发笔记时把豆码写进正文就好');
  };

  return (
    <div className="screen">
      <TopBar onBack={app.back} title={`${c.name}的图纸`} />
      <Steps at={2} />
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={tab === 'sheet' ? 'on' : ''} onClick={() => setTab('sheet')}>
          图纸
        </button>
        <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>
          烫好的样子
        </button>
      </div>

      {tab === 'sheet' ? (
        <canvas ref={cvRef} className="sheet-canvas" />
      ) : (
        <>
          <div className="preview-stage">
            <BeadView ras={ras} size={Math.min(320, window.innerWidth - 80)} style={style} animate={style === 'bead'} board={style === 'bead'} pad={style === 'bead' ? 0 : 14} />
          </div>
          <div className="seg" style={{ marginTop: 12 }}>
            {(
              [
                ['bead', '在豆板上'],
                ['full', '平烫'],
                ['hole', '轻烫留孔'],
              ] as [BeadStyle, string][]
            ).map(([k, t]) => (
              <button key={k} className={style === k ? 'on' : ''} onClick={() => setStyle(k)}>
                {t}
              </button>
            ))}
          </div>
          <p className="sub center" style={{ marginTop: 8 }}>
            示意渲染，实际效果取决于熨烫温度和时间
          </p>
        </>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b style={{ fontSize: 14 }}>尺寸</b>
          <span className="sub" style={{ fontSize: 12 }}>
            {ras.total} 颗 · {ras.colors.length} 色
          </span>
        </div>
        <div className="seg" style={{ marginTop: 10 }}>
          {(['迷你 16', '小挂件 20', '挂件 24'] as const).map((t, i) => (
            <button key={t} className={c.genes.size === i ? 'on' : ''} onClick={() => setSize(i as SizeIdx)}>
              {t}
            </button>
          ))}
        </div>
        <div className="toggles">
          <button className="toggle" onClick={() => setMirror((v) => !v)}>
            <span className="t">
              镜像施工图
              <small>在背面拼、翻过来烫的时候用</small>
            </span>
            <span className={`switch ${mirror ? 'on' : ''}`} />
          </button>
          <button className="toggle" onClick={() => setWx((v) => !v)}>
            <span className="t">
              印上二维码和网址
              <small>{wx ? (isLocalHost() ? '现在是本地预览网址，别人扫不开' : '发微信好友用；小红书笔记里别放二维码') : '发小红书时关着，图纸上只印豆码'}</small>
            </span>
            <span className={`switch ${wx ? 'on' : ''}`} />
          </button>
          <button className="toggle" onClick={() => setRing((v) => !v)}>
            <span className="t">
              围一圈透明豆
              <small>烫完外圈不会变圆，边缘更利落</small>
            </span>
            <span className={`switch ${ring ? 'on' : ''}`} />
          </button>
          <button
            className="toggle"
            onClick={() => {
              if (!hasMine) {
                app.openBox();
                return;
              }
              setMine((v) => !v);
            }}
          >
            <span className="t">
              只用我盒里的豆
              <small>
                {hasMine
                  ? mine
                    ? changed
                      ? `换掉了 ${changed} 种你没有的颜色`
                      : '全部都在你的豆盒里'
                    : `你的豆盒里有 ${app.box.mine.length} 种颜色`
                  : '先告诉我你有哪些豆'}
              </small>
            </span>
            {hasMine ? <span className={`switch ${mine ? 'on' : ''}`} /> : <Box size={20} />}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <b style={{ fontSize: 14 }}>要准备的豆</b>
        <div className="chips" style={{ marginTop: 10 }}>
          {ras.colors.map((x) => (
            <span key={x.bead} className="color-chip">
              <span className="bead" style={{ ['--c' as string]: BEADS[x.bead].hex }} />
              {BEADS[x.bead].code} × {x.count}
            </span>
          ))}
        </div>
      </div>

      <div className="bottom-bar">
        <div className="inner">
          <button className="btn btn-ghost" style={{ flex: '0 0 auto' }} onClick={save}>
            <Download size={18} />
            保存图纸
          </button>
          <button className="btn btn-primary" onClick={() => app.go({ k: 'cert', id })}>
            <Card size={18} />
            出生证
          </button>
        </div>
      </div>
    </div>
  );
}
