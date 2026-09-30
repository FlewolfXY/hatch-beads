import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppCtx, Ctx, Screen } from './ctx';
import { BoxSetting, Creature, loadBox, loadNest, poolOf, saveBox, saveNest } from './lib/store';
import { loadSoundPref, setSound } from './lib/sound';
import Home from './components/Home';
import Extract from './components/Extract';
import Hatch from './components/Hatch';
import Detail from './components/Detail';
import SheetView from './components/SheetView';
import CertView from './components/CertView';
import Breed from './components/Breed';
import BoxPicker from './components/BoxPicker';
import Gallery from './components/Gallery';
import Invite from './components/Invite';
import { initialShare } from './lib/share';

export default function App() {
  const [stack, setStack] = useState<Screen[]>(() => {
    if (location.hash === '#gallery') return [{ k: 'gallery' }];
    return initialShare ? [{ k: 'home' }, { k: 'invite', ...initialShare }] : [{ k: 'home' }];
  });

  useEffect(() => {
    if (!initialShare || history.state?.d === 1) return;
    // 扫码进来：把链接参数从地址栏收起来，首页垫在下面，返回时留在站内
    history.replaceState(null, '', location.pathname + location.search);
    history.pushState({ d: 1 }, '');
  }, []);
  const [nest, setNest] = useState<Creature[]>(loadNest);
  const [drafts, setDrafts] = useState<Record<string, Creature>>({});
  const [box, setBoxState] = useState<BoxSetting>(loadBox);
  const [sound, setSoundState] = useState(() => {
    const on = loadSoundPref();
    setSound(on, false);
    return on;
  });
  const [toastMsg, setToast] = useState<{ m: string; k: number } | null>(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const nestRef = useRef(nest);
  nestRef.current = nest;

  const pool = useMemo(() => poolOf(box), [box]);
  const screen = stack[stack.length - 1];

  useEffect(() => {
    const onPop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((s: Screen, replace = false) => {
    setStack((st) => (replace ? [...st.slice(0, -1), s] : [...st, s]));
    if (!replace) history.pushState({ d: Date.now() }, '');
    window.scrollTo({ top: 0 });
  }, []);

  const back = useCallback(() => {
    if (stack.length > 1) history.back();
    else setStack([{ k: 'home' }]);
  }, [stack.length]);

  const toast = useCallback((m: string) => setToast({ m, k: Date.now() }), []);

  const put = useCallback((c: Creature, keepIt = false) => {
    const inNest = nestRef.current.some((x) => x.id === c.id);
    if (inNest || keepIt) {
      setNest((list) => {
        const next = [c, ...list.filter((x) => x.id !== c.id)];
        if (inNest) {
          const idx = list.findIndex((x) => x.id === c.id);
          const copy = [...list];
          copy[idx] = c;
          saveNest(copy);
          return copy;
        }
        saveNest(next);
        return next;
      });
      if (keepIt)
        setDrafts((d) => {
          const n = { ...d };
          delete n[c.id];
          return n;
        });
    } else setDrafts((d) => ({ ...d, [c.id]: c }));
  }, []);

  const get = useCallback((id: string) => nest.find((x) => x.id === id) ?? drafts[id], [nest, drafts]);
  const kept = useCallback((id: string) => nest.some((x) => x.id === id), [nest]);
  const keep = useCallback(
    (id: string) => {
      const c = drafts[id];
      if (c) put(c, true);
    },
    [drafts, put],
  );

  const setBox = useCallback((b: BoxSetting) => {
    setBoxState(b);
    saveBox(b);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundState((s) => {
      setSound(!s);
      return !s;
    });
  }, []);

  const ctx: AppCtx = {
    pool,
    box,
    setBox,
    nest,
    drafts,
    get,
    put,
    keep,
    kept,
    sound,
    toggleSound,
    toast,
    go,
    back,
    openBox: () => setBoxOpen(true),
  };

  let view: React.ReactNode = null;
  const key = stack.length + ':' + screen.k;
  switch (screen.k) {
    case 'home':
      view = <Home key={key} />;
      break;
    case 'extract':
      view = <Extract key={key} {...screen} />;
      break;
    case 'hatch':
      view = <Hatch key={key + ':' + screen.round} {...screen} />;
      break;
    case 'detail':
      view = <Detail key={key + screen.id} id={screen.id} />;
      break;
    case 'sheet':
      view = <SheetView key={key} id={screen.id} />;
      break;
    case 'cert':
      view = <CertView key={key} id={screen.id} />;
      break;
    case 'breed':
      view = <Breed key={key} aId={screen.aId} code={screen.code} name={screen.name} owner={screen.owner} />;
      break;
    case 'invite':
      view = <Invite key={key} code={screen.code} name={screen.name} owner={screen.owner} />;
      break;
    case 'gallery':
      view = <Gallery key={key} />;
      break;
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className="app" style={screen.k === 'gallery' ? { maxWidth: 1180 } : undefined}>
        {view}
      </div>
      {boxOpen && <BoxPicker onClose={() => setBoxOpen(false)} />}
      {toastMsg && (
        <div className="toast" key={toastMsg.k}>
          {toastMsg.m}
        </div>
      )}
    </Ctx.Provider>
  );
}
