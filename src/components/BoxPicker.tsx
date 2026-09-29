import { useState } from 'react';
import { useApp } from '../ctx';
import { BEADS, STANDARD } from '../lib/palette';
import { BoxMode } from '../lib/store';
import { Close } from './icons';

export default function BoxPicker({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [mode, setMode] = useState<BoxMode>(app.box.mode);
  const [mine, setMine] = useState<Set<string>>(new Set(app.box.mine));
  const [series, setSeries] = useState('A');
  const allSeries = [...new Set(BEADS.filter((b) => b.code !== 'T01').map((b) => b.series))];
  const list = BEADS.filter((b) => b.series === series);

  const toggle = (code: string) =>
    setMine((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });

  const save = () => {
    const m = mode === 'mine' && mine.size < 8 ? 'standard' : mode;
    app.setBox({ mode: m, mine: [...mine] });
    if (mode === 'mine' && mine.size < 8) app.toast('至少选 8 种颜色，先用标准色');
    else app.toast('豆盒已更新');
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="h2">我的豆盒</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <Close size={18} />
          </button>
        </div>
        <p className="sub" style={{ margin: '6px 0 12px' }}>
          孵化和图纸只会用这里的颜色。告诉我你手里有哪些豆，孵出来就能直接开拼。
        </p>
        <div className="seg">
          <button className={mode === 'standard' ? 'on' : ''} onClick={() => setMode('standard')}>
            标准色
            <small>MARD 221</small>
          </button>
          <button className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>
            全色
            <small>含扩展色 290</small>
          </button>
          <button className={mode === 'mine' ? 'on' : ''} onClick={() => setMode('mine')}>
            只用我有的
            <small>已选 {mine.size}</small>
          </button>
        </div>
        {mode === 'mine' && (
          <>
            <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 6 }}>
              {allSeries.map((s) => (
                <button key={s} className={`chip ${s === series ? '' : 'ghost'}`} onClick={() => setSeries(s)}>
                  {s}
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setMine(new Set([...mine, ...list.map((b) => b.code)]))}>
                这一列全选
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setMine(new Set(STANDARD.map((i) => BEADS[i].code)))}>
                选全部标准色
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setMine(new Set())}>
                清空
              </button>
            </div>
            <div className="bead-grid">
              {list.map((b) => (
                <button key={b.code} className={`bead-cell ${mine.has(b.code) ? 'on' : ''}`} onClick={() => toggle(b.code)}>
                  <span className="bead" style={{ ['--c' as string]: b.hex, width: 30, height: 30 }} />
                  {b.code}
                </button>
              ))}
            </div>
          </>
        )}
        <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={save}>
          好了
        </button>
      </div>
    </div>
  );
}
