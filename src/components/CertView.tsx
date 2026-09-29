import { useEffect, useMemo, useRef, useState } from 'react';
import { track } from '../lib/track';
import { useApp } from '../ctx';
import { downloadCanvas, drawCert, drawTriptych } from '../lib/cert';
import { rasterize } from '../lib/creature';
import { loadImage, normalizeUpload, thumb } from '../lib/extract';
import { chime } from '../lib/sound';
import { encode } from '../lib/code';
import { isLocalHost, loadNick, saveNick, shareUrl } from '../lib/share';
import { TopBar } from './Home';
import { Camera, Download, Image } from './icons';

export default function CertView({ id }: { id: string }) {
  const app = useApp();
  const c = app.get(id)!;
  const ras = useMemo(() => rasterize(c.genes, app.pool), [c.genes, app.pool]);
  const certRef = useRef<HTMLCanvasElement>(null);
  const triRef = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<'cert' | 'tri'>('cert');
  const [note, setNote] = useState(c.note ?? '');
  const [title, setTitle] = useState(c.photo?.title ?? '');
  const [channel, setChannel] = useState<'xhs' | 'wx'>('xhs');
  const [look, setLook] = useState<'full' | 'bead'>('full');
  const [nick, setNick] = useState(loadNick);
  const showPhoto = c.certPhoto ?? true;
  const local = isLocalHost();
  const link = channel === 'wx' ? shareUrl({ code: encode(c.genes), name: c.name, owner: nick.trim() || undefined }) : undefined;
  const draft = useMemo(
    () => ({ ...c, note: note.trim() || undefined, photo: c.photo ? { ...c.photo, title: title.trim() || c.photo.title } : undefined }),
    [c, note, title],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (tab === 'cert' && certRef.current) void drawCert(certRef.current, draft, ras, { photo: showPhoto, look, qr: link, owner: nick.trim() || undefined });
      if (tab === 'tri' && triRef.current) void drawTriptych(triRef.current, draft, ras);
    }, 60);
    return () => clearTimeout(t);
  }, [draft, ras, tab, showPhoto, look, link, nick]);

  const saveText = () => {
    if ((c.note ?? '') !== note.trim() || (c.photo && c.photo.title !== (title.trim() || c.photo.title))) app.put(draft);
  };

  const onMade = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    track('made-photo');
    const img = await loadImage(await normalizeUpload(f));
    app.put({ ...draft, madeAt: Date.now(), madePhoto: thumb(img, 720, 0.82) }, true);
    chime();
    app.toast(`${c.name}出生了`);
    setTab('tri');
  };

  const markMade = () => {
    track('made-mark');
    app.put({ ...draft, madeAt: Date.now() }, true);
    chime();
    app.toast(`${c.name}出生了`);
  };

  const save = () => {
    const cv = tab === 'cert' ? certRef.current : triRef.current;
    track(tab === 'cert' ? (channel === 'wx' ? 'save-cert-wx' : 'save-cert-xhs') : 'save-match');
    if (cv) downloadCanvas(cv, `孵豆-${c.name}-${tab === 'cert' ? (channel === 'wx' ? '出生证-微信' : '出生证-小红书') : '对色卡'}.png`);
    app.toast(tab === 'cert' && channel === 'xhs' ? '已保存，发笔记时记得把豆码也写进正文' : '已保存');
  };

  return (
    <div className="screen">
      <TopBar onBack={app.back} title={c.name} />
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={tab === 'cert' ? 'on' : ''} onClick={() => setTab('cert')}>
          出生证
        </button>
        <button className={tab === 'tri' ? 'on' : ''} onClick={() => setTab('tri')}>
          对色卡
        </button>
      </div>
      {tab === 'cert' && (
        <div className="share-opts">
          <div className="seg">
            <button className={channel === 'xhs' ? 'on' : ''} onClick={() => setChannel('xhs')}>
              发小红书
              <small>印豆码，不放二维码</small>
            </button>
            <button className={channel === 'wx' ? 'on' : ''} onClick={() => setChannel('wx')}>
              发给微信好友
              <small>带二维码，扫码配种</small>
            </button>
          </div>
        </div>
      )}
      {tab === 'cert' ? <canvas ref={certRef} className="cert-canvas" /> : <canvas ref={triRef} className="cert-canvas" />}

      {tab === 'cert' && (
        <>
          <p className="sub" style={{ marginTop: 10, lineHeight: 1.7 }}>
            {channel === 'xhs'
              ? '小红书笔记里放二维码容易被当成站外导流，所以这一版只印豆码。看到的人把豆码复制进孵豆，就能和你的崽配一窝。'
              : local
                ? '现在是本地预览的网址，别人扫了打不开。部署到网上以后再保存这一版。'
                : '朋友长按识别二维码，会直接打开和这只崽配种的页面。二维码里只有豆码和名字，没有照片。'}
          </p>
          <div className="card cert-form" style={{ marginTop: 12 }}>
            <div className="field">
              <span className="k">样子</span>
              <div className="seg" style={{ flex: 1 }}>
                <button className={look === 'full' ? 'on' : ''} onClick={() => setLook('full')} disabled={!!c.madeAt}>
                  烫好的
                </button>
                <button className={look === 'bead' ? 'on' : ''} onClick={() => setLook('bead')} disabled={!!c.madeAt}>
                  豆板上的
                </button>
              </div>
            </div>
            {channel === 'wx' && (
              <label className="field">
                <span className="k">昵称</span>
                <input
                  value={nick}
                  maxLength={8}
                  placeholder="印在二维码旁边，可以不填"
                  onChange={(e) => setNick(e.target.value)}
                  onBlur={() => saveNick(nick)}
                />
              </label>
            )}
          </div>
          <div className="section-head" style={{ marginTop: 20 }}>
            <h2 className="h2" style={{ fontSize: 16 }}>
              出生证上写什么
            </h2>
            <span className="sub">都可以不写</span>
          </div>
          <div className="card cert-form">
            {c.photo && (
              <label className="field">
                <span className="k">来自</span>
                <input value={title} maxLength={16} placeholder="比如：下课路上" onChange={(e) => setTitle(e.target.value)} onBlur={saveText} />
              </label>
            )}
            <label className="field">
              <span className="k">那天</span>
              <textarea rows={2} maxLength={40} placeholder="比如：下课了，雨还没停。" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveText} />
            </label>
            {c.photo?.thumb && (
              <button className="toggle" onClick={() => app.put({ ...draft, certPhoto: !showPhoto })}>
                <span className="t">
                  贴上原照片
                  <small>做成右下角的拍立得。照片里有人脸或位置的话，分享前可以关掉</small>
                </span>
                <span className={`switch ${showPhoto ? 'on' : ''}`} />
              </button>
            )}
          </div>
        </>
      )}
      {tab === 'tri' && (
        <p className="sub" style={{ marginTop: 12, lineHeight: 1.7 }}>
          {c.madePhoto
            ? '照片、屏幕里的崽、你手里的崽，放在一起。下次路过那个地方，可以带它回去拍一张对色照。'
            : c.photo
              ? '拼好以后拍一张，右边会换成你手里的实物。现在先用烫好的渲染图占个位。'
              : '这只崽是配种来的，没有照片。拼好以后拍一张，就能做成对色卡。'}
        </p>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row">
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 15 }}>{c.madeAt ? '它已经在你手里出生了' : '拼好了吗？'}</b>
            <div className="sub" style={{ marginTop: 2 }}>
              {c.madeAt ? '换一张实物照也可以' : '拍一张实物，它就在豆窝里被点亮'}
            </div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <label className="btn btn-red btn-sm upload grow">
            <Camera size={16} />
            {c.madePhoto ? '换一张实物照' : '拍拼好的它'}
            <input type="file" accept="image/*" onChange={onMade} />
          </label>
          {!c.madeAt && (
            <button className="btn btn-ghost btn-sm" onClick={markMade}>
              先点亮
            </button>
          )}
        </div>
      </div>

      <div className="bottom-bar">
        <div className="inner">
          <button className="btn btn-ghost" style={{ flex: '0 0 auto' }} onClick={() => app.go({ k: 'home' })}>
            <Image size={18} />
            回豆窝
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Download size={18} />
            {tab === 'cert' ? (channel === 'wx' ? '保存微信版' : '保存小红书版') : '保存对色卡'}
          </button>
        </div>
      </div>
    </div>
  );
}
