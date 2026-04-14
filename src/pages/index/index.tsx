import { View, Text } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useCallback, useState } from "react";
import { readPetData, syncPetData } from "../../utils/petStorage";
import { useUserDataChange } from "../../services/user-data/hooks/useUserDataChange";
import {
  readDashboardStats,
  readTrainingRecords,
  readTrainingSummary,
  recommendNextGame,
  type TrainingGameId,
  type TrainingRecord,
} from "../../utils/trainingStorage";
import { PetData, PetStorageData, PET_SKIN_EMOJI, MAX_HUNGER } from "../../pages/pet/types";
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

interface GameItem {
  id: TrainingGameId;
  title: string;
  badge: string;
  cardClass: string;
  url: string;
  summary: ScoreSummary;
}

const BASE_GAMES = [
  {
    id: "memory",
    title: "记忆图形",
    badge: "记忆",
    cardClass: "card-memory",
    url: "/pages/memory-challenge/index",
  },
  {
    id: "rps",
    title: "逆向猜拳",
    badge: "反应",
    cardClass: "card-rps",
    url: "/pages/rock-paper-scissors/index",
  },
  {
    id: "dual-task",
    title: "多任务处理",
    badge: "协作",
    cardClass: "card-dual",
    url: "/pages/dual-task/index",
  },
  {
    id: "mental-math",
    title: "速算挑战",
    badge: "计算",
    cardClass: "card-mental",
    url: "/pages/mental-math/index",
  },
  {
    id: "digit-span",
    title: "数字广度记忆",
    badge: "记忆",
    cardClass: "card-digit",
    url: "/pages/digit-span/index",
  },
  {
    id: "mot",
    title: "追踪任务",
    badge: "注意",
    cardClass: "card-mot",
    url: "/pages/multiple-object-tracking/index",
  },
  {
    id: "pattern",
    title: "找规律",
    badge: "推理",
    cardClass: "card-pattern",
    url: "/pages/pattern-completion/index",
  },
] as const;

const GAME_TITLES: Record<TrainingGameId, string> = {
  memory: "记忆图形",
  rps: "逆向猜拳",
  "dual-task": "多任务处理",
  "mental-math": "速算挑战",
  "digit-span": "数字广度记忆",
  mot: "追踪任务",
  pattern: "找规律",
};

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

export default function Index() {
  const [games, setGames] = useState<GameItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardView>({
    todaySessions: 0,
    totalSessions: 0,
    streakDays: 0,
    activeDaysLast7: 0,
    totalAwardedPoints: 0,
  });
  const [recentRecords, setRecentRecords] = useState<TrainingRecord[]>([]);
  const [recommendedGameId, setRecommendedGameId] = useState<TrainingGameId>("memory");
  const [petData, setPetData] = useState<PetStorageData | null>(null);
  const [activePet, setActivePet] = useState<PetData | null>(null);
  const [aliveCount, setAliveCount] = useState<number>(0);

  const navigateTo = (url: string) => {
    Taro.navigateTo({ url });
  };

  const navigateToPet = () => {
    navigateTo("/pages/pet/index");
  };

  const navigateToSettings = () => {
    navigateTo("/pages/settings/index");
  };

  const getStatusLabel = (status: PetData["status"]): string => {
    switch (status) {
      case "alive":
        return "健康";
      case "hungry":
        return "饥饿";
      case "dead":
        return "已离开";
      default:
        return "";
    }
  };

  const getHungerColor = (hunger: number): string => {
    if (hunger > 40) return "#1f9d72";
    if (hunger > 20) return "#f59e0b";
    return "#dc2626";
  };

  const getStatusColor = (status: PetData["status"]): string => {
    switch (status) {
      case "alive":
        return "#1f9d72";
      case "hungry":
        return "#f59e0b";
      case "dead":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getStatusBgColor = (status: PetData["status"]): string => {
    switch (status) {
      case "alive":
        return "rgba(31, 157, 114, 0.16)";
      case "hungry":
        return "rgba(245, 158, 11, 0.16)";
      case "dead":
        return "rgba(107, 114, 128, 0.16)";
      default:
        return "rgba(107, 114, 128, 0.16)";
    }
  };

  const refreshDashboard = useCallback((options?: { syncPets?: boolean }) => {
    const nextPetData = options?.syncPets
      ? syncPetData({ markChanged: false })
      : readPetData();
    setPetData(nextPetData);
    setActivePet(nextPetData.pets.find((pet) => pet.id === nextPetData.activePetId) ?? null);
    setAliveCount(nextPetData.pets.filter((pet) => pet.status !== "dead").length);

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
    setRecentRecords(readTrainingRecords().slice(0, 3));
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

  useUserDataChange(refreshDashboard);

  const renderActivePet = () => {
    if (!activePet) return null;
    const hungerPercent = Math.round((activePet.hunger / MAX_HUNGER) * 100);
    const hungerColor = getHungerColor(activePet.hunger);
    const emoji = PET_SKIN_EMOJI[activePet.skin];

    return (
      <View className="pet-hero-content">
        <View className="pet-hero-header">
          <Text className="pet-emoji">{emoji}</Text>
          <View className="pet-info">
            <View className="pet-name-row">
              <Text className="pet-name">{activePet.name}</Text>
              <Text
                className="status-pill"
                style={{
                  backgroundColor: getStatusBgColor(activePet.status),
                  color: getStatusColor(activePet.status),
                }}
              >
                {getStatusLabel(activePet.status)}
              </Text>
            </View>
            <Text className="pet-level">Lv.{activePet.level}</Text>
          </View>
        </View>

        <View className="hunger-section">
          <View className="hunger-label">
            <Text className="hunger-label-text">饱食度</Text>
            <Text className="hunger-percent" style={{ color: hungerColor }}>
              {hungerPercent}%
            </Text>
          </View>
          <View className="hunger-bar-container">
            <View
              className="hunger-bar-fill"
              style={{
                width: `${hungerPercent}%`,
                backgroundColor: hungerColor,
              }}
            />
          </View>
        </View>

        <View className="pet-stats-row">
          <View className="pet-stat-item">
            <Text className="pet-stat-label">存活</Text>
            <Text className="pet-stat-value">
              {aliveCount}/{petData?.pets.length ?? 0}
            </Text>
          </View>
          <View className="pet-stat-item">
            <Text className="pet-stat-label">积分</Text>
            <Text className="pet-stat-value">{petData?.balance ?? 0}</Text>
          </View>
          <View className="pet-stat-item pet-stat-hint">
            <Text className="pet-stat-hint-text">前往喂食 →</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View className="pet-empty-state">
        <Text className="pet-empty-emoji">🐾</Text>
        <Text className="pet-empty-title">小院里还没有宠物</Text>
        <Text className="pet-empty-hint">点击领养第一只宠物（免费）</Text>
      </View>
    );
  };

  return (
    <View className="game-hub">
      <View className="ambient ambient-orange" />
      <View className="ambient ambient-blue" />

      <View className="hub-shell">
        <View className="top-bar">
          <View>
            <Text className="page-eyebrow">Brain Yard</Text>
            <Text className="page-title">今日训练中枢</Text>
          </View>
          <View className="profile-button" onClick={navigateToSettings}>
            <Text className="profile-icon">≡</Text>
          </View>
        </View>

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
            <View className="overview-item">
              <Text className="overview-value">{dashboard.totalSessions}</Text>
              <Text className="overview-label">累计训练</Text>
            </View>
            <View className="overview-item">
              <Text className="overview-value">{dashboard.totalAwardedPoints}</Text>
              <Text className="overview-label">累计奖励</Text>
            </View>
            <View className="overview-item">
              <Text className="overview-value">{petData?.balance ?? 0}</Text>
              <Text className="overview-label">当前积分</Text>
            </View>
            <View className="overview-item">
              <Text className="overview-value">{aliveCount}</Text>
              <Text className="overview-label">宠物陪伴中</Text>
            </View>
          </View>
        </View>

        <View className="pet-hero-banner" onClick={navigateToPet}>
          {activePet ? renderActivePet() : renderEmptyState()}
        </View>

        <View className="focus-card">
          <View className="section-header">
            <View>
              <Text className="section-title">下一练建议</Text>
              <Text className="section-subtitle">
                优先补齐最近少练或尚未开始的项目，保持训练面均衡。
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

        <View className="records-card">
          <View className="section-header">
            <View>
              <Text className="section-title">最近成绩</Text>
              <Text className="section-subtitle">统一记录每次训练的得分和奖励积分。</Text>
            </View>
          </View>

          {recentRecords.length > 0 ? (
            <View className="record-list">
              {recentRecords.map((record) => (
                <View key={record.id} className="record-item">
                  <View>
                    <Text className="record-title">{GAME_TITLES[record.gameId]}</Text>
                    <Text className="record-meta">
                      {record.outcome === "completed" ? "正常完成" : "中途返回"} · {formatPlayedAt(record.playedAt)}
                    </Text>
                  </View>
                  <View className="record-score-block">
                    <Text className="record-score">{record.score}</Text>
                    <Text className="record-points">+{record.awardedPoints} 积分</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="empty-records">
              <Text className="empty-records-title">还没有训练记录</Text>
              <Text className="empty-records-copy">从任意一项游戏开始，首页会自动汇总你的训练轨迹。</Text>
            </View>
          )}
        </View>

        <View className="game-list">
          {games.map((game) => (
            <View
              key={game.id}
              className={`game-card ${game.cardClass}`}
              onClick={() => navigateTo(game.url)}
            >
              <View className="game-copy">
                <Text className="game-title">{game.title}</Text>
              </View>

              <View className="game-meta">
                <Text className="game-badge">{game.badge}</Text>
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
    </View>
  );
}
