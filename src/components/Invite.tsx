import { useMemo, useState } from 'react';
import { useApp } from '../ctx';
import { decode, encode } from '../lib/code';
import { rasterize } from '../lib/creature';
import { tags } from '../lib/genes';
import { nameFor } from '../lib/names';
import { BEADS } from '../lib/palette';
import { uid } from '../lib/rng';
import BeadView, { ViewMode } from './BeadView';
import { tintOf } from './Detail';
import { Logo } from './Home';
import { Camera, Heart, Link } from './icons';

/** 扫了朋友的二维码以后先落到这里 */
export default function Invite({ code, name, owner }: { code: string; name?: string; owner?: string }) {
  const app = useApp();
  const genes = useMemo(() => decode(code)!, [code]);
  const ras = useMemo(() => rasterize(genes, app.pool), [genes, app.pool]);
  const nm = name || nameFor(genes, 3);
  const [mode, setMode] = useState<ViewMode>('bead');
  const already = app.nest.find((c) => encode(c.genes) === encode(genes));
  const [kept, setKept] = useState(!!already);
  const main = BEADS[genes.colors.main].hex;
  const mine = app.nest.filter((c) => encode(c.genes) !== encode(genes));

  const keep = () => {
    if (kept) return;
    app.put({ id: uid(), genes, name: nm, createdAt: Date.now(), flavor: '朋友的崽', from: owner || '朋友' }, true);
    setKept(true);
    app.toast('收进豆窝了，随时可以拿它配种');
  };

  return (
    <div className="screen">
      <div className="topbar">
        <div className="logo">
          <Logo />
          孵豆
          <small>HATCH BEADS</small>
        </div>
      </div>
      <p className="sub" style={{ margin: '4px 2px 10px' }}>
        {owner ? `${owner} 发来一张豆崽卡` : '朋友发来一张豆崽卡'}
      </p>
      <div className="big-board" style={{ background: `linear-gradient(160deg, ${tintOf(main, 0.9)}, ${tintOf(main, 0.78)})` }}>
        <BeadView ras={ras} size={Math.min(300, window.innerWidth - 90)} board animate melt={700} toggle onMode={setMode} boardColor="rgba(255,255,255,0.5)" />
        <span className="board-tag" key={mode}>
          {mode === 'fused' ? '烫好的样子 · 点一下看豆板' : '豆板上 · 点一下看烫好'}
        </span>
      </div>
      <h1 className="h1" style={{ fontSize: 26, margin: '24px 2px 6px' }}>
        {owner ? `${owner}的「${nm}」` : `「${nm}」`}
        <br />
        想和你的崽配一窝
      </h1>
      <div className="chips" style={{ margin: '6px 2px 14px' }}>
        {tags(genes).map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
        <span className="chip ghost">
          {ras.total} 颗 · {ras.colors.length} 色
        </span>
      </div>

      <button className="btn btn-primary btn-block" onClick={() => app.go({ k: 'breed', code, name: nm, owner })}>
        <Link size={18} />
        {mine.length ? '选我的崽，配一窝' : '先用示例崽配一窝试试'}
      </button>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-ghost grow" onClick={keep}>
          <Heart size={18} filled={kept} />
          {kept ? '已经收下了' : '收下这张卡'}
        </button>
        <button className="btn btn-ghost grow" onClick={() => app.go({ k: 'home' })}>
          <Camera size={18} />
          孵我自己的
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <b style={{ fontSize: 15 }}>孵豆是什么？</b>
        <p className="sub" style={{ margin: '6px 0 0', lineHeight: 1.7 }}>
          拍一张今天看见的照片，颜色变成基因，孵出一只世界上还没有的拼豆崽。和朋友的崽配种，偶尔会冒出一颗你们俩都没有的豆。每只崽都有图纸，可以照着亲手拼出来。
        </p>
      </div>
      <div className="foot">照片只在你的手机里处理，豆码里只有基因</div>
    </div>
  );
}
