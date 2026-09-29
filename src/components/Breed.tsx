import { useMemo, useState } from 'react';
import { track } from '../lib/track';
import { useApp } from '../ctx';
import { decode, encode } from '../lib/code';
import { rasterize } from '../lib/creature';
import { Genes } from '../lib/genes';
import { nameFor } from '../lib/names';
import { FRIENDS, SHOWCASE } from '../lib/samples';
import { hashStr } from '../lib/rng';
import { Creature } from '../lib/store';
import BeadView from './BeadView';
import { photoCtxOf } from './Detail';
import { TopBar } from './Home';
import { Image, Sparkle } from './icons';
import { parseShare, scanImage, ShareLink } from '../lib/share';
import { loadImage, normalizeUpload } from '../lib/extract';

const DEMO: Creature = { id: 'demo-metro', genes: SHOWCASE[0], name: '末班车', createdAt: Date.now() };

export default function Breed({ aId, code: code0, name: name0, owner: owner0 }: { aId?: string; code?: string; name?: string; owner?: string }) {
  const app = useApp();
  const invited = code0 ? decode(code0) : null;
  const options = useMemo(() => {
    const list: Creature[] = [];
    const a = aId ? app.get(aId) : undefined;
    if (a) list.push(a);
    const same = (c: Creature) => invited && encode(c.genes) === encode(invited);
    // 自己孵的排前面，朋友送的排后面，不和对方那只自己配
    for (const c of [...app.nest.filter((x) => !x.from), ...app.nest.filter((x) => x.from)]) if (!list.some((x) => x.id === c.id) && !same(c)) list.push(c);
    if (!list.length) list.push(DEMO);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aId, app]);
  const [aSel, setASel] = useState(options[0].id);
  const [code, setCode] = useState(code0 ?? '');
  const a = options.find((x) => x.id === aSel) ?? options[0];
  const friendCodes = useMemo(() => FRIENDS.map((f) => ({ ...f, code: encode(f.genes) })), []);
  const b: Genes | null = useMemo(() => decode(code), [code]);
  const [scanned, setScanned] = useState<ShareLink | null>(null);
  const [scanning, setScanning] = useState(false);
  const fromLink = !!(b && invited && encode(b) === encode(invited));
  const fromScan = !!(b && scanned && encode(b) === scanned.code);
  const friendFound = friendCodes.find((f) => b && encode(b) === f.code);
  const friend = fromLink && name0 ? { name: name0, owner: owner0 } : fromScan && scanned?.name ? { name: scanned.name, owner: scanned.owner } : friendFound;
  const bName = friend ? friend.name : b ? nameFor(b, 3) : '';
  const rasA = useMemo(() => rasterize(a.genes, app.pool), [a.genes, app.pool]);
  const rasB = useMemo(() => (b ? rasterize({ ...b, size: a.genes.size }, app.pool) : null), [b, a.genes.size, app.pool]);

  // 粘进来的可能是豆码，也可能是整条分享链接
  const take = (text: string) => {
    const t = text.trim();
    const link = t.includes('#b=') ? parseShare(t.slice(t.indexOf('#'))) : null;
    if (link) {
      setScanned(link);
      setCode(link.code);
    } else setCode(t);
  };

  const paste = async () => {
    try {
      take(await navigator.clipboard.readText());
    } catch {
      app.toast('没法读剪贴板，手动粘贴一下吧');
    }
  };

  const scan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setScanning(true);
    try {
      const img = await loadImage(await normalizeUpload(f));
      const link = await scanImage(img);
      if (link) {
        setScanned(link);
        setCode(link.code);
        track('scan-ok');
        app.toast(link.name ? `认出来了：${link.owner ? link.owner + '的' : ''}「${link.name}」` : '认出来了');
      } else app.toast('这张图里没找到二维码，可以手动输入图上的豆码');
    } catch {
      app.toast('这张图读不出来，换一张试试');
    } finally {
      setScanning(false);
    }
  };

  const go = () => {
    if (!b) return;
    track('breed-start');
    app.go({
      k: 'hatch',
      photo: photoCtxOf(a),
      size: a.genes.size,
      round: 0,
      breed: { a, b: { ...b, size: a.genes.size }, bName, bOwner: friend?.owner, seed: hashStr(encode(a.genes) + encode(b)) },
    });
  };

  const valid = !!b;
  const typed = code.replace(/[^0-9A-Za-z]/g, '').length;

  return (
    <div className="screen">
      <TopBar onBack={app.back} title="配种" />
      <h1 className="h1" style={{ fontSize: 24, margin: '4px 2px 6px' }}>
        你身上，会有我的颜色
      </h1>
      <p className="lead" style={{ fontSize: 14 }}>
        粘贴朋友发来的豆码，或者选一张带二维码的图，两只崽的基因会混在一起。豆码里只有基因，没有照片。
      </p>

      <div className="parents">
        <div className="parent">
          <BeadView ras={rasA} size={112} animate />
          <div className="nm">{a.name}</div>
          <div className="ow">{a.id === DEMO.id ? '示例崽' : '你的崽'}</div>
        </div>
        <svg width="26" height="26" viewBox="0 0 16 16">
          {[
            [4, 5],
            [7, 3],
            [9, 3],
            [12, 5],
            [3, 8],
            [13, 8],
            [5, 11],
            [11, 11],
            [8, 13],
            [8, 6],
            [6, 8],
            [10, 8],
            [8, 10],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.3" fill="#F06292" />
          ))}
        </svg>
        <div className="parent" style={{ opacity: valid ? 1 : 0.6 }}>
          {rasB ? (
            <>
              <BeadView ras={rasB} size={112} animate />
              <div className="nm">{bName}</div>
              <div className="ow">
                {fromLink || fromScan ? (friend?.owner ? `${friend.owner}的崽` : '朋友的崽') : friendFound ? `${friendFound.owner}的崽（示例）` : 'TA 的崽'}
              </div>
            </>
          ) : (
            <div className="sub" style={{ padding: 10 }}>
              {typed > 0 && typed < 16 ? '豆码还没输完' : typed >= 16 ? '这串豆码好像不对' : '等一个豆码'}
            </div>
          )}
        </div>
      </div>

      {options.length > 1 && (
        <>
          <div className="section-head">
            <h2 className="h2" style={{ fontSize: 16 }}>
              用哪只崽？
            </h2>
          </div>
          <div className="pick-row">
            {options.map((o) => (
              <PickItem key={o.id} c={o} on={o.id === aSel} onClick={() => setASel(o.id)} />
            ))}
          </div>
        </>
      )}

      <div className="section-head">
        <h2 className="h2" style={{ fontSize: 16 }}>
          朋友的豆码
        </h2>
      </div>
      <div className="code-input">
        <input value={code} onChange={(e) => take(e.target.value)} placeholder="HD-XXXX-XXXX-XXXX-XXXX" spellCheck={false} autoCapitalize="characters" />
        <button className="btn btn-ghost btn-sm" onClick={paste}>
          粘贴
        </button>
      </div>
      <label className="btn btn-ghost btn-block upload" style={{ marginTop: 10 }}>
        <Image size={18} />
        {scanning ? '正在认二维码…' : '从相册选一张带二维码的出生证或图纸'}
        <input type="file" accept="image/*" onChange={scan} disabled={scanning} />
      </label>
      <div className="sub" style={{ margin: '12px 2px 8px' }}>
        还没有朋友的豆码？先试试这些示例：
      </div>
      <div className="chips">
        {friendCodes.map((f) => (
          <button key={f.code} className="chip ghost" style={{ height: 32, padding: '0 12px' }} onClick={() => setCode(f.code)}>
            {f.owner}的「{f.name}」
          </button>
        ))}
      </div>

      <div className="bottom-bar">
        <div className="inner">
          <button className="btn btn-primary" disabled={!valid} onClick={go}>
            <Sparkle size={18} />
            孵一窝
          </button>
        </div>
      </div>
    </div>
  );
}

function PickItem({ c, on, onClick }: { c: Creature; on: boolean; onClick: () => void }) {
  const app = useApp();
  const ras = useMemo(() => rasterize(c.genes, app.pool), [c.genes, app.pool]);
  return (
    <button className={`pick ${on ? 'on' : ''}`} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <BeadView ras={ras} size={60} />
      </div>
      <div style={{ marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
    </button>
  );
}
