import { isLocalHost } from './share';

/** GoatCounter 站点代号，比如 hatchbeads（对应 hatchbeads.goatcounter.com）。留空就不统计。 */
const GC_CODE = '';

type GC = { count: (o: { path: string; title?: string; event?: boolean }) => void };
declare global {
  interface Window {
    goatcounter?: GC & { no_onload?: boolean };
  }
}

const queue: string[] = [];

export function initTrack() {
  if (!GC_CODE || isLocalHost() || typeof document === 'undefined') return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GC_CODE}.goatcounter.com/count`;
  s.onload = () => {
    while (queue.length) send(queue.shift()!);
  };
  document.head.appendChild(s);
}

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

function send(name: string) {
  window.goatcounter?.count({ path: name, title: TITLES[name] ?? name, event: true });
}

/** 记一次事件，只有名字，没有照片和个人信息 */
export function track(name: string) {
  if (!GC_CODE || isLocalHost()) return;
  if (window.goatcounter?.count) send(name);
  else if (queue.length < 50) queue.push(name);
}
