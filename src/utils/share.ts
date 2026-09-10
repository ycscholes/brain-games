import Taro, {
  useReady,
  useShareAppMessage,
  useShareTimeline,
  type ShareAppMessageReturnObject,
  type ShareTimelineReturnObject,
} from "@tarojs/taro";

export const SHARE_PAGE_PATHS = [
  "pages/index/index",
  "pages/all-games/index",
  "pages/game-gauntlet/index",
  "pages/memory-challenge/index",
  "pages/memory-challenge/result",
  "pages/rock-paper-scissors/index",
  "pages/rock-paper-scissors/result",
  "pages/mental-math/index",
  "pages/mental-math/result",
  "pages/twenty-four/index",
  "pages/twenty-four/result",
  "pages/digit-span/index",
  "pages/digit-span/result",
  "pages/multiple-object-tracking/index",
  "pages/pattern-completion/index",
  "pages/number-order/index",
  "pages/head-count/index",
  "pages/word-scramble/index",
  "pages/bird-count/index",
  "pages/bird-count/result",
  "pages/color-trap/index",
  "pages/spatial-rotation/index",
  "pages/hidato/index",
  "pages/hidato/result",
  "pages/tents-camp/index",
  "pages/tents-camp/result",
  "pages/sumplete-grid/index",
  "pages/traffic-escape/index",
  "pages/traffic-escape/result",
  "pages/music-theory/index",
  "pages/netwalk/index",
  "pages/netwalk/result",
  "pages/loop-line/index",
  "pages/loop-line/result",
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
  "pages/all-games/index": {
    title: "来看看Cici的脑部锻炼全部游戏",
    timelineTitle: "Cici的脑部锻炼全部训练",
  },
  "pages/game-gauntlet/index": {
    title: "来挑战游戏大闯关，一次玩 3 个脑力游戏",
    timelineTitle: "游戏大闯关综合训练",
  },
  "pages/memory-challenge/index": {
    title: "来挑战奇趣记忆",
    timelineTitle: "奇趣记忆 N-Back 训练",
  },
  "pages/memory-challenge/result": {
    title: "我完成了一局奇趣记忆，来挑战我的分数",
    timelineTitle: "奇趣记忆训练成绩",
  },
  "pages/rock-paper-scissors/index": {
    title: "来玩逆向猜拳，练反应和抑制力",
    timelineTitle: "逆向猜拳反应训练",
  },
  "pages/rock-paper-scissors/result": {
    title: "我完成了一局逆向猜拳，来挑战我的分数",
    timelineTitle: "逆向猜拳训练成绩",
  },
  "pages/mental-math/index": {
    title: "来挑战速算，练心算反应",
    timelineTitle: "速算挑战脑力训练",
  },
  "pages/mental-math/result": {
    title: "我完成了一局速算挑战，来挑战我的分数",
    timelineTitle: "速算挑战训练成绩",
  },
  "pages/twenty-four/index": {
    title: "来解 24 点，练数字推理",
    timelineTitle: "24 点数字推理训练",
  },
  "pages/twenty-four/result": {
    title: "我完成了一局 24 点，来挑战我的分数",
    timelineTitle: "24 点训练成绩",
  },
  "pages/digit-span/index": {
    title: "来测数字广度记忆",
    timelineTitle: "数字广度记忆训练",
  },
  "pages/digit-span/result": {
    title: "我完成了一局数字广度记忆，来挑战我的分数",
    timelineTitle: "数字广度记忆训练成绩",
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
  "pages/bird-count/result": {
    title: "我完成了一局农场清点，来挑战我的分数",
    timelineTitle: "农场清点训练成绩",
  },
  "pages/color-trap/index": {
    title: "来玩颜色陷阱，练选择注意",
    timelineTitle: "颜色陷阱注意力训练",
  },
  "pages/spatial-rotation/index": {
    title: "来玩旋影辨形，练空间推理",
    timelineTitle: "旋影辨形空间训练",
  },
  "pages/hidato/index": {
    title: "来玩连数迷阵，练逻辑路径推理",
    timelineTitle: "连数迷阵逻辑训练",
  },
  "pages/hidato/result": {
    title: "我完成了一局连数迷阵，来挑战我的分数",
    timelineTitle: "连数迷阵训练成绩",
  },
  "pages/tents-camp/index": {
    title: "来玩帐篷营地，练空间约束推理",
    timelineTitle: "帐篷营地逻辑训练",
  },
  "pages/tents-camp/result": {
    title: "我完成了一局帐篷营地，来挑战我的分数",
    timelineTitle: "帐篷营地训练成绩",
  },
  "pages/sumplete-grid/index": {
    title: "来玩删数求和，练数字约束推理",
    timelineTitle: "删数求和数理训练",
  },
  "pages/traffic-escape/index": {
    title: "来玩车阵突围，练空间规划",
    timelineTitle: "车阵突围空间规划训练",
  },
  "pages/traffic-escape/result": {
    title: "我完成了一局车阵突围，来挑战我的分数",
    timelineTitle: "车阵突围训练成绩",
  },
  "pages/music-theory/index": {
    title: "来玩音符小探险，认识节拍和五线谱",
    timelineTitle: "音符小探险乐理训练",
  },
  "pages/netwalk/index": {
    title: "来玩网络回路，练连通规划",
    timelineTitle: "网络回路空间推理训练",
  },
  "pages/netwalk/result": {
    title: "我完成了一局网络回路，来挑战我的分数",
    timelineTitle: "网络回路训练成绩",
  },
  "pages/loop-line/index": {
    title: "来玩环线谜踪，练约束推理",
    timelineTitle: "环线谜踪逻辑训练",
  },
  "pages/loop-line/result": {
    title: "我完成了一局环线谜踪，来挑战我的分数",
    timelineTitle: "环线谜踪训练成绩",
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
