import { Input, View, Text } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useCallback, useEffect, useRef, useState } from "react";
import { readPetData, syncPetData } from "../../utils/petStorage";
import { useUserDataChange } from "../../services/user-data/hooks/useUserDataChange";
import { initializeCloudSync } from "../../services/user-data/sync/userDataSyncService";
import {
  readDashboardStats,
  readTrainingSummary,
  recommendNextGame,
  type TrainingGameId,
} from "../../utils/trainingStorage";
import { preloadGameAssets, type AssetPreloadProgress } from "../../utils/resourcePreloader";
import { usePageShare } from "../../utils/share";
import { MAX_HUNGER, PetData, PetStorageData } from "../../pages/pet/types";
import PetSprite from "../pet/components/PetSprite";
import type { PetSpriteMood } from "../pet/components/PetSprite/types";
import "./index.scss";

interface DashboardView {
  todaySessions: number;
  totalSessions: number;
  streakDays: number;
  activeDaysLast7: number;
  totalAwardedPoints: number;
}

interface ScoreSummary {
  best: number;
  recent: number;
  played: boolean;
  totalSessions: number;
}

type GameCategoryId = "daily" | "memory" | "advanced";

interface GameItem {
  id: TrainingGameId;
  title: string;
  badge: string;
  cardClass: string;
  url: string;
  category: GameCategoryId;
  duration: string;
  skill: string;
  level: "轻松" | "标准" | "进阶";
  summary: ScoreSummary;
}

const GAME_CATEGORIES: Array<{ id: GameCategoryId; title: string }> = [
  { id: "daily", title: "日常优先" },
  { id: "memory", title: "反应与记忆" },
  { id: "advanced", title: "进阶专注" },
];

const BASE_GAMES = [
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
  },
  {
    id: "twenty-four",
    title: "24 点",
    badge: "计算",
    cardClass: "card-twenty-four",
    url: "/pages/twenty-four/index",
    category: "daily",
    duration: "90 秒",
    skill: "算术组合",
    level: "标准",
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
  },
  {
    id: "memory-challenge",
    title: "记忆图形",
    badge: "记忆",
    cardClass: "card-memory",
    url: "/pages/memory-challenge/index",
    category: "memory",
    duration: "失误即止",
    skill: "N-back",
    level: "进阶",
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
  },
  {
    id: "dual-task",
    title: "多任务处理",
    badge: "双任务",
    cardClass: "card-dual",
    url: "/pages/dual-task/index",
    category: "advanced",
    duration: "60 秒",
    skill: "任务切换",
    level: "进阶",
  },
] satisfies Array<Omit<GameItem, "summary">>;

const GAME_TITLES: Record<TrainingGameId, string> = {
  memory: "记忆图形",
  "memory-challenge": "记忆图形",
  rps: "逆向猜拳",
  "rock-paper-scissors": "逆向猜拳",
  "dual-task": "多任务处理",
  "mental-math": "速算挑战",
  "twenty-four": "24 点",
  "digit-span": "数字广度记忆",
  mot: "追踪任务",
  "multiple-object-tracking": "追踪任务",
  pattern: "找规律",
  "pattern-completion": "找规律",
  "number-order": "星链回响",
  "head-count": "农场进出",
  "word-scramble": "词语拼盘",
  "bird-count": "农场清点",
};

const HOME_ASSET_LOADING_TIMEOUT_MS = 3500;
const HOME_ASSET_LOADING_MIN_MS = 520;
const DEFAULT_HOME_ASSET_PROGRESS: AssetPreloadProgress = {
  loaded: 0,
  total: 0,
  failed: 0,
};

let isHomeAssetPreloadComplete = false;
let homeAssetPreloadPromise: Promise<AssetPreloadProgress> | null = null;
let lastHomeAssetProgress: AssetPreloadProgress = DEFAULT_HOME_ASSET_PROGRESS;
const homeAssetProgressListeners = new Set<(progress: AssetPreloadProgress) => void>();

function formatPlayedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  const now = Date.now();
  const diffMinutes = Math.max(1, Math.floor((now - date.getTime()) / (1000 * 60)));
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

function waitForMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatHomeAssetProgressPercent(progress: AssetPreloadProgress) {
  if (progress.total <= 0) {
    return "0%";
  }

  const percent = Math.round((Math.min(progress.loaded, progress.total) / progress.total) * 100);
  return `${Math.max(0, Math.min(100, percent))}%`;
}

function publishHomeAssetProgress(progress: AssetPreloadProgress) {
  lastHomeAssetProgress = progress;
  homeAssetProgressListeners.forEach((listener) => listener(progress));
}

function ensureHomeAssetsPreloaded() {
  if (isHomeAssetPreloadComplete) {
    return Promise.resolve(lastHomeAssetProgress);
  }

  if (homeAssetPreloadPromise) {
    return homeAssetPreloadPromise;
  }

  homeAssetPreloadPromise = Promise.all([
    preloadGameAssets({
      timeoutMs: HOME_ASSET_LOADING_TIMEOUT_MS,
      onProgress: publishHomeAssetProgress,
    }),
    waitForMs(HOME_ASSET_LOADING_MIN_MS),
  ]).then(([progress]) => {
    publishHomeAssetProgress(progress);
    isHomeAssetPreloadComplete = true;
    return progress;
  }).finally(() => {
    homeAssetPreloadPromise = null;
  });

  return homeAssetPreloadPromise;
}

export default function Index() {
  usePageShare("pages/index/index");

  const [games, setGames] = useState<GameItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardView>({
    todaySessions: 0,
    totalSessions: 0,
    streakDays: 0,
    activeDaysLast7: 0,
    totalAwardedPoints: 0,
  });
  const [recommendedGameId, setRecommendedGameId] = useState<TrainingGameId>("memory");
  const [petData, setPetData] = useState<PetStorageData>(() => readPetData());
  const [isFloatingPetReady, setIsFloatingPetReady] = useState(false);
  const [isHomeAssetsReady, setIsHomeAssetsReady] = useState(isHomeAssetPreloadComplete);
  const [homeAssetProgress, setHomeAssetProgress] = useState<AssetPreloadProgress>(lastHomeAssetProgress);
  const [homePetMotion, setHomePetMotion] = useState<PetSpriteMood>("idle");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const homePetMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigateTo = (url: string) => {
    Taro.navigateTo({ url });
  };

  const navigateToPet = () => {
    navigateTo("/pages/pet/index");
  };

  const navigateToSettings = () => {
    navigateTo("/pages/settings/index");
  };

  const refreshDashboard = useCallback((options?: { syncPets?: boolean }) => {
    const nextPetData = options?.syncPets
      ? syncPetData({ markChanged: false })
      : readPetData();
    setPetData(nextPetData);

    setDashboard(readDashboardStats());
    const nextGames = BASE_GAMES.map((game) => {
      const summary = readTrainingSummary(game.id);
      return {
        ...game,
        summary: {
          best: summary.best,
          recent: summary.recent,
          played: summary.played,
          totalSessions: summary.totalSessions,
        },
      };
    });

    setGames(nextGames);
    setRecommendedGameId(recommendNextGame(BASE_GAMES.map((game) => game.id)));
  }, []);

  const refreshDashboardDeferred = useCallback(() => {
    refreshDashboard();
    setTimeout(() => {
      refreshDashboard({ syncPets: true });
    }, 300);
  }, [refreshDashboard]);

  useDidShow(() => {
    refreshDashboardDeferred();
  });

  useEffect(() => {
    let isCurrent = true;
    const handleAssetProgress = (progress: AssetPreloadProgress) => {
      if (isCurrent) {
        setHomeAssetProgress(progress);
      }
    };

    homeAssetProgressListeners.add(handleAssetProgress);
    void ensureHomeAssetsPreloaded().then((progress) => {
      if (!isCurrent) {
        return;
      }

      setHomeAssetProgress(progress);
      setIsHomeAssetsReady(true);
    });

    void initializeCloudSync()
      .then(() => {
        if (!isCurrent) {
          return;
        }

        refreshDashboard({ syncPets: true });
        setIsFloatingPetReady(true);
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        refreshDashboard({ syncPets: true });
        setIsFloatingPetReady(true);
      });

    return () => {
      isCurrent = false;
      homeAssetProgressListeners.delete(handleAssetProgress);
    };
  }, [refreshDashboard]);

  useUserDataChange(refreshDashboard);

  const activePet: PetData | null = petData.pets.find((pet) => pet.id === petData.activePetId) ?? null;
  const aliveCount = petData.pets.filter((pet) => pet.status !== "dead").length;

  useEffect(() => {
    if (homePetMotionTimerRef.current) {
      clearTimeout(homePetMotionTimerRef.current);
      homePetMotionTimerRef.current = null;
    }

    setHomePetMotion("idle");

    if (!activePet || activePet.status === "dead") {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setHomePetMotion("cuddle");
      homePetMotionTimerRef.current = setTimeout(() => {
        setHomePetMotion("idle");
        homePetMotionTimerRef.current = null;
      }, 900);
    }, 8000);

    return () => {
      clearInterval(intervalId);
      if (homePetMotionTimerRef.current) {
        clearTimeout(homePetMotionTimerRef.current);
        homePetMotionTimerRef.current = null;
      }
    };
  }, [activePet?.id, activePet?.status]);

  const petHungerPercent = activePet
    ? Math.max(0, Math.min(100, Math.round((activePet.hunger / MAX_HUNGER) * 100)))
    : 0;
  const petHungerColor =
    petHungerPercent <= 20 ? "#dc2626" : petHungerPercent <= 40 ? "#f59e0b" : "#1f9d72";
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleGames = normalizedSearchQuery
    ? games.filter((game) => {
        const categoryTitle = GAME_CATEGORIES.find((category) => category.id === game.category)?.title ?? "";
        return `${game.title} ${game.badge} ${game.skill} ${game.duration} ${game.level} ${categoryTitle}`
          .toLowerCase()
          .includes(normalizedSearchQuery);
      })
    : games;
  const groupedGames = GAME_CATEGORIES.map((category) => ({
    ...category,
    games: visibleGames.filter((game) => game.category === category.id),
  })).filter((category) => category.games.length > 0);

  return (
    <View className="game-hub">
      {!isHomeAssetsReady ? (
        <View className="home-resource-loading">
          <View className="home-resource-loading-mark" />
          <Text className="home-resource-loading-title">资源准备中</Text>
          <Text className="home-resource-loading-copy">
            {formatHomeAssetProgressPercent(homeAssetProgress)}
          </Text>
        </View>
      ) : null}
      <View className={`hub-shell ${isHomeAssetsReady ? "" : "hub-shell-loading"}`}>
        <View className="top-bar">
          <View>
            <Text className="page-eyebrow">Brain Yard</Text>
            <Text className="page-title">今日训练中枢</Text>
          </View>
          <View className="top-actions">
            <View
              className={`search-button ${searchOpen ? "search-button-active" : ""}`}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <Text className="search-icon">⌕</Text>
            </View>
            <View className="profile-button" onClick={navigateToSettings}>
              <Text className="profile-icon">≡</Text>
            </View>
          </View>
        </View>

        {searchOpen && (
          <View className="game-search-panel">
            <Input
              className="game-search-input"
              value={searchQuery}
              placeholder="搜索游戏"
              confirmType="search"
              onInput={(event) => setSearchQuery(String(event.detail.value ?? ""))}
            />
            {searchQuery ? (
              <View className="game-search-clear" onClick={() => setSearchQuery("")}>
                <Text className="game-search-clear-text">清除</Text>
              </View>
            ) : null}
          </View>
        )}

        <View className="overview-card">
          <View className="overview-head">
            <View>
              <Text className="overview-title">训练仪表盘</Text>
              <Text className="overview-subtitle">
                今天已训练 {dashboard.todaySessions} 次，最近 7 天活跃 {dashboard.activeDaysLast7} 天
              </Text>
            </View>
            <View className="overview-badge">
              <Text className="overview-badge-text">{dashboard.streakDays} 天连续</Text>
            </View>
          </View>

          <View className="overview-grid">
            <View className="overview-item overview-item-clickable" onClick={() => navigateTo("/pages/training-records/index")}>
              <View className="overview-item-main">
                <Text className="overview-value">{dashboard.totalSessions}</Text>
                <Text className="overview-label">累计训练</Text>
              </View>
              <View className="overview-item-entry">
                <Text className="overview-item-entry-text">查看</Text>
              </View>
            </View>
            <View className="overview-item">
              <Text className="overview-value">{dashboard.totalAwardedPoints}</Text>
              <Text className="overview-label">累计奖励</Text>
            </View>
            <View className="overview-item">
              <Text className="overview-value">{petData.balance}</Text>
              <Text className="overview-label">当前积分</Text>
            </View>
            <View className="overview-item">
              <Text className="overview-value">{aliveCount}</Text>
              <Text className="overview-label">宠物陪伴中</Text>
            </View>
          </View>
        </View>

        <View className="focus-card">
          <View className="section-header">
            <View>
              <Text className="section-title">下一练建议</Text>
              <Text className="section-subtitle">
                先从短时、低门槛项目开始，再逐步补齐进阶训练。
              </Text>
            </View>
          </View>

          <View className="focus-body">
            <View className="focus-main">
              <Text className="focus-name">{GAME_TITLES[recommendedGameId]}</Text>
              <Text className="focus-copy">
                推荐你先完成这一项，持续拉齐不同认知维度的训练记录。
              </Text>
            </View>
            <View
              className="focus-action"
              onClick={() => navigateTo(BASE_GAMES.find((game) => game.id === recommendedGameId)?.url || "/pages/index/index")}
            >
              <Text className="focus-action-text">立即开始</Text>
            </View>
          </View>
        </View>

        <View className="game-category-list">
          {groupedGames.map((category) => (
            <View key={category.id} className="game-category-section">
              <View className="game-category-header">
                <Text className="game-category-title">{category.title}</Text>
                <Text className="game-category-count">{category.games.length} 项</Text>
              </View>

              <View className="game-list">
                {category.games.map((game) => (
                  <View
                    key={game.id}
                    className={`game-card ${game.cardClass}`}
                    onClick={() => navigateTo(game.url)}
                  >
                    <View className="game-copy">
                      <Text className="game-title">{game.title}</Text>
                    </View>

                    <View className="game-meta">
                      <View className="game-badge-row">
                        <Text className="game-badge">{game.badge}</Text>
                        <Text className={`game-level game-level-${game.level === "进阶" ? "advanced" : game.level === "标准" ? "standard" : "easy"}`}>
                          {game.level}
                        </Text>
                      </View>
                      <Text className="game-detail-line">{game.duration} · {game.skill}</Text>
                      <Text className="score-line">{`最高分：${game.summary.best}`}</Text>
                      <Text className="score-line score-line-secondary">
                        {game.summary.played
                          ? `最近 ${game.summary.recent} · 共 ${game.summary.totalSessions} 次`
                          : "还没有新的统一记录"}
                      </Text>
                    </View>

                    <View className="game-footer">
                      <View className="enter-button">
                        <Text className="enter-button-text">开始游戏</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
          {groupedGames.length === 0 && (
            <View className="game-search-empty">
              <Text className="game-search-empty-title">没有找到游戏</Text>
              <Text className="game-search-empty-copy">换个关键词试试</Text>
            </View>
          )}
        </View>
      </View>

      {isHomeAssetsReady && isFloatingPetReady ? (
        <View
          className={`floating-pet ${activePet ? "" : "floating-pet-empty"}`}
          onClick={navigateToPet}
          aria-label={activePet ? "宠物饱食度，点击进入宠物页面" : "点击进入宠物页面领养宠物"}
        >
          <View className="floating-pet-avatar">
            <PetSprite
              skin={activePet?.skin ?? "cat"}
              size="sm"
              mood={activePet ? homePetMotion : "idle"}
              status={activePet?.status}
            />
          </View>
          <View className="floating-pet-info">
            {activePet ? (
              <View className="floating-pet-hunger-track">
                <View
                  className="floating-pet-hunger-fill"
                  style={{ width: `${petHungerPercent}%`, backgroundColor: petHungerColor }}
                />
              </View>
            ) : (
              <Text className="floating-pet-empty-text">领养</Text>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}
