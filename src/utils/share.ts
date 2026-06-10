import Taro, {
  useReady,
  useShareAppMessage,
  useShareTimeline,
  type ShareAppMessageReturnObject,
  type ShareTimelineReturnObject,
} from "@tarojs/taro";

export const SHARE_PAGE_PATHS = [
  "pages/index/index",
  "pages/memory-challenge/index",
  "pages/rock-paper-scissors/index",
  "pages/dual-task/index",
  "pages/mental-math/index",
  "pages/twenty-four/index",
  "pages/digit-span/index",
  "pages/multiple-object-tracking/index",
  "pages/pattern-completion/index",
  "pages/number-order/index",
  "pages/head-count/index",
  "pages/word-scramble/index",
  "pages/bird-count/index",
  "pages/pet/index",
  "pages/settings/index",
  "pages/training-records/index",
] as const;

export type SharePagePath = (typeof SHARE_PAGE_PATHS)[number];

interface SharePageContent {
  title: string;
  timelineTitle?: string;
}

const APP_SHARE_TITLE = "Cici的脑部锻炼";
const DEFAULT_SHARE_CONTENT: SharePageContent = {
  title: "来Cici的脑部锻炼做一组轻量训练",
  timelineTitle: "Cici的脑部锻炼：每天练一点",
};

export const SHARE_PAGE_CONTENT: Record<SharePagePath, SharePageContent> = {
  "pages/index/index": {
    title: APP_SHARE_TITLE,
    timelineTitle: "Cici的脑部锻炼：每天练一点",
  },
  "pages/memory-challenge/index": {
    title: "来挑战奇趣图形记忆",
    timelineTitle: "奇趣图形记忆训练",
  },
  "pages/rock-paper-scissors/index": {
    title: "来玩逆向猜拳，练反应和抑制力",
    timelineTitle: "逆向猜拳反应训练",
  },
  "pages/dual-task/index": {
    title: "来做双重任务，练多任务切换",
    timelineTitle: "双重任务脑力训练",
  },
  "pages/mental-math/index": {
    title: "来挑战速算，练心算反应",
    timelineTitle: "速算挑战脑力训练",
  },
  "pages/twenty-four/index": {
    title: "来解 24 点，练数字推理",
    timelineTitle: "24 点数字推理训练",
  },
  "pages/digit-span/index": {
    title: "来测数字广度记忆",
    timelineTitle: "数字广度记忆训练",
  },
  "pages/multiple-object-tracking/index": {
    title: "来做追踪任务，练专注观察",
    timelineTitle: "追踪任务专注训练",
  },
  "pages/pattern-completion/index": {
    title: "来找规律，练观察和推理",
    timelineTitle: "找规律推理训练",
  },
  "pages/number-order/index": {
    title: "来玩星链回响，练路径记忆",
    timelineTitle: "星链回响记忆训练",
  },
  "pages/head-count/index": {
    title: "来玩小剧场清点，练动态心算",
    timelineTitle: "小剧场清点脑力训练",
  },
  "pages/word-scramble/index": {
    title: "来玩词语拼盘，练语言重组",
    timelineTitle: "词语拼盘语言训练",
  },
  "pages/bird-count/index": {
    title: "来玩宠物速数，练快速观察",
    timelineTitle: "宠物速数观察训练",
  },
  "pages/pet/index": {
    title: "来看看我在Cici的脑部锻炼里养的宠物",
    timelineTitle: "Cici的脑部锻炼宠物养成",
  },
  "pages/settings/index": {
    title: APP_SHARE_TITLE,
    timelineTitle: "Cici的脑部锻炼：每天练一点",
  },
  "pages/training-records/index": {
    title: "来Cici的脑部锻炼记录每日训练",
    timelineTitle: "Cici的脑部锻炼训练记录",
  },
};

export function getShareContent(pagePath: SharePagePath) {
  return SHARE_PAGE_CONTENT[pagePath] ?? DEFAULT_SHARE_CONTENT;
}

export function createShareAppMessage(pagePath: SharePagePath): ShareAppMessageReturnObject {
  const content = getShareContent(pagePath);

  return {
    title: content.title,
    path: `/${pagePath}`,
  };
}

export function createShareTimeline(pagePath: SharePagePath): ShareTimelineReturnObject {
  const content = getShareContent(pagePath);

  return {
    title: content.timelineTitle ?? content.title,
  };
}

export function usePageShare(pagePath: SharePagePath) {
  useReady(() => {
    if (process.env.TARO_ENV !== "weapp") {
      return;
    }

    void Taro.showShareMenu({
      withShareTicket: true,
      showShareItems: ["shareAppMessage", "shareTimeline"],
    }).catch(() => {
      // Share menu support varies by host/client version; hooks below still provide share payloads.
    });
  });

  useShareAppMessage(() => createShareAppMessage(pagePath));
  useShareTimeline(() => createShareTimeline(pagePath));
}
