import type { TrainingGameId } from "../utils/trainingStorage";

export type GameCategoryId = "daily" | "memory" | "advanced";
export type GameLevel = "轻松" | "标准" | "进阶";

export interface GameCatalogItem {
  id: TrainingGameId;
  title: string;
  badge: string;
  cardClass: string;
  url: string;
  category: GameCategoryId;
  duration: string;
  skill: string;
  level: GameLevel;
  isHot: boolean;
  showInAllGames: boolean;
  canAppearInGauntlet: boolean;
  showBestScore: boolean;
  recommendationWeight: 1 | 2;
  gauntletModeWeight: number;
}

export const GAME_CATEGORIES: Array<{ id: GameCategoryId; title: string }> = [
  { id: "daily", title: "日常优先" },
  { id: "memory", title: "反应与记忆" },
  { id: "advanced", title: "进阶专注" },
];

export const GAME_GAUNTLET_ID = "game-gauntlet" as const;

export const GAME_CATALOG = [
  {
    id: "mental-math",
    title: "速算挑战",
    badge: "计算",
    cardClass: "card-mental",
    url: "/pages/mental-math/index",
    category: "daily",
    duration: "30 秒",
    skill: "计算速度",
    level: "轻松",
    isHot: true,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 2,
    gauntletModeWeight: 2,
  },
  {
    id: "pattern-completion",
    title: "找规律",
    badge: "逻辑",
    cardClass: "card-pattern",
    url: "/pages/pattern-completion/index",
    category: "daily",
    duration: "约 2 分钟",
    skill: "规律推理",
    level: "轻松",
    isHot: false,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 1,
    gauntletModeWeight: 1,
  },
  {
    id: "digit-span",
    title: "数字广度记忆",
    badge: "记忆",
    cardClass: "card-digit",
    url: "/pages/digit-span/index",
    category: "daily",
    duration: "1-3 分钟",
    skill: "短时记忆",
    level: "轻松",
    isHot: true,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 2,
    gauntletModeWeight: 1,
  },
  {
    id: "twenty-four",
    title: "24 点",
    badge: "计算",
    cardClass: "card-twenty-four",
    url: "/pages/twenty-four/index",
    category: "daily",
    duration: "60 秒",
    skill: "算术组合",
    level: "标准",
    isHot: true,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 2,
    gauntletModeWeight: 1,
  },
  {
    id: "rock-paper-scissors",
    title: "逆向猜拳",
    badge: "反应",
    cardClass: "card-rps",
    url: "/pages/rock-paper-scissors/index",
    category: "memory",
    duration: "1-2 分钟",
    skill: "抑制控制",
    level: "标准",
    isHot: true,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 2,
    gauntletModeWeight: 1,
  },
  {
    id: "color-trap",
    title: "颜色陷阱",
    badge: "注意",
    cardClass: "card-color-trap",
    url: "/pages/color-trap/index",
    category: "memory",
    duration: "约 1 分钟",
    skill: "选择注意",
    level: "标准",
    isHot: false,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 1,
    gauntletModeWeight: 1,
  },
  {
    id: "spatial-rotation",
    title: "旋影辨形",
    badge: "空间",
    cardClass: "card-spatial-rotation",
    url: "/pages/spatial-rotation/index",
    category: "memory",
    duration: "约 1 分钟",
    skill: "空间推理",
    level: "标准",
    isHot: false,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 1,
    gauntletModeWeight: 1,
  },
  {
    id: "number-order",
    title: "星链回响",
    badge: "记忆",
    cardClass: "card-number-order",
    url: "/pages/number-order/index",
    category: "memory",
    duration: "约 2 分钟",
    skill: "路径记忆",
    level: "标准",
    isHot: false,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 1,
    gauntletModeWeight: 1,
  },
  {
    id: "memory-challenge",
    title: "奇趣记忆",
    badge: "记忆",
    cardClass: "card-memory",
    url: "/pages/memory-challenge/index",
    category: "memory",
    duration: "失误即止",
    skill: "N-back",
    level: "进阶",
    isHot: true,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 2,
    gauntletModeWeight: 3,
  },
  {
    id: "multiple-object-tracking",
    title: "追踪任务",
    badge: "专注",
    cardClass: "card-mot",
    url: "/pages/multiple-object-tracking/index",
    category: "advanced",
    duration: "每轮 6 秒",
    skill: "视觉追踪",
    level: "进阶",
    isHot: false,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 1,
    gauntletModeWeight: 1,
  },
  {
    id: "word-scramble",
    title: "词语拼盘",
    badge: "语言",
    cardClass: "card-word-scramble",
    url: "/pages/word-scramble/index",
    category: "advanced",
    duration: "约 2 分钟",
    skill: "语言重组",
    level: "标准",
    isHot: false,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 1,
    gauntletModeWeight: 1,
  },
  {
    id: "bird-count",
    title: "农场清点",
    badge: "观察",
    cardClass: "card-bird-count",
    url: "/pages/bird-count/index",
    category: "advanced",
    duration: "约 2 分钟",
    skill: "动态计数",
    level: "标准",
    isHot: true,
    showInAllGames: true,
    canAppearInGauntlet: true,
    showBestScore: true,
    recommendationWeight: 2,
    gauntletModeWeight: 2,
  },
  {
    id: GAME_GAUNTLET_ID,
    title: "游戏大闯关",
    badge: "闯关",
    cardClass: "card-game-gauntlet",
    url: "/pages/game-gauntlet/index",
    category: "advanced",
    duration: "3 局连续",
    skill: "综合训练",
    level: "进阶",
    isHot: false,
    showInAllGames: true,
    canAppearInGauntlet: false,
    showBestScore: false,
    recommendationWeight: 1,
    gauntletModeWeight: 1,
  },
] satisfies GameCatalogItem[];

export const HOT_GAME_IDS = GAME_CATALOG
  .filter((game) => game.isHot)
  .map((game) => game.id);

export const ALL_GAME_ITEMS = GAME_CATALOG.filter((game) => game.showInAllGames);
export const HOT_GAME_ITEMS = GAME_CATALOG.filter((game) => game.isHot);
export const GAUNTLET_CANDIDATE_GAMES = GAME_CATALOG.filter((game) => game.canAppearInGauntlet);

export const GAME_TITLE_MAP: Record<TrainingGameId, string> = {
  memory: "奇趣记忆",
  "memory-challenge": "奇趣记忆",
  rps: "逆向猜拳",
  "rock-paper-scissors": "逆向猜拳",
  "mental-math": "速算挑战",
  "twenty-four": "24 点",
  "digit-span": "数字广度记忆",
  mot: "追踪任务",
  "multiple-object-tracking": "追踪任务",
  pattern: "找规律",
  "pattern-completion": "找规律",
  "number-order": "星链回响",
  "head-count": "农场清点",
  "word-scramble": "词语拼盘",
  "bird-count": "农场清点",
  "color-trap": "颜色陷阱",
  "spatial-rotation": "旋影辨形",
  "game-gauntlet": "游戏大闯关",
};

export function getGameById(gameId: TrainingGameId) {
  return GAME_CATALOG.find((game) => game.id === gameId) ?? null;
}
