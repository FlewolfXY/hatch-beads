import { isLocalHost } from './share';

/** GoatCounter 站点代号，对应 flewolf.goatcounter.com。留空就不统计。 */
const GC_CODE = 'flewolf';

// 不加载 gc.zgo.at 上的 count.js：国内经常连不上。直接把一次访问或事件发给统计接口。
const ENDPOINT = `https://${GC_CODE}.goatcounter.com/count`;

const TITLES: Record<string, string> = {
  'open-invite': '扫码进入落地页',
  'pick-sample': '选了示例照片',
  'upload-photo': '上传了自己的照片',
  'edit-color': '手动调了颜色',
  'to-hatch': '放进孵蛋器',
  'hatched': '孵出一窝',
  'hatched-breed': '配种孵出一窝',
  'rehatch': '再孵一窝',
  'open-detail': '点开崽详情',
  'copy-code': '复制豆码',
  'save-sheet-xhs': '保存图纸（小红书）',
  'save-sheet-wx': '保存图纸（微信）',
  'save-cert-xhs': '保存出生证（小红书）',
  'save-cert-wx': '保存出生证（微信）',
  'save-match': '保存对色卡',
  'made-photo': '拼好了，上传实物照',
  'made-mark': '拼好了，先点亮',
  'scan-ok': '从图片认出二维码',
  'breed-start': '开始配种',
  'invite-keep': '收下朋友的卡',
};

const enabled = () => !!GC_CODE && typeof window !== 'undefined' && !isLocalHost();

function hit(params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, rnd: Math.random().toString(36).slice(2) });
  const url = `${ENDPOINT}?${q.toString()}`;
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url)) return;
  } catch {
    /* 退回用图片请求 */
  }
  new Image().src = url;
}

/** 记一次打开网页 */
export function initTrack() {
  if (!enabled()) return;
  hit({
    p: location.pathname || '/',
    t: document.title,
    r: document.referrer,
    s: `${screen.width},${screen.height},${window.devicePixelRatio || 1}`,
  });
}

/** 记一次事件，只有名字，没有照片和个人信息 */
export function track(name: string) {
  if (!enabled()) return;
  hit({ p: name, t: TITLES[name] ?? name, e: 'true' });
}
