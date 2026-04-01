import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useCallback, useState } from "react";
import { readPetData } from "../../utils/petStorage";
import { PetData, PetStorageData, PET_SKIN_EMOJI, MAX_HUNGER } from "../../pages/pet/types";
import "./index.scss";

interface ScoreSummary {
  best: number;
  recent: number;
  played: boolean;
}

interface GameItem {
  id: string;
  title: string;
  badge: string;
  icon: string;
  cardClass: string;
  url: string;
  summary: ScoreSummary;
}

const BASE_GAMES = [
  {
    id: "memory",
    title: "记忆图形",
    badge: "记忆",
    icon: "◫",
    cardClass: "card-memory",
    url: "/pages/memory-challenge/index",
  },
  {
    id: "rps",
    title: "逆向猜拳",
    badge: "反应",
    icon: "✋",
    cardClass: "card-rps",
    url: "/pages/rock-paper-scissors/index",
  },
  {
    id: "dual-task",
    title: "多任务处理",
    badge: "协作",
    icon: "◉",
    cardClass: "card-dual",
    url: "/pages/dual-task/index",
  },
  {
    id: "mental-math",
    title: "速算挑战",
    badge: "计算",
    icon: "🧮",
    cardClass: "card-mental",
    url: "/pages/mental-math/index",
  },
  {
    id: "digit-span",
    title: "数字广度记忆",
    badge: "记忆",
    icon: "123",
    cardClass: "card-digit",
    url: "/pages/digit-span/index",
  },
  {
    id: "mot",
    title: "追踪任务",
    badge: "注意",
    icon: "◎",
    cardClass: "card-mot",
    url: "/pages/multiple-object-tracking/index",
  },
  {
    id: "pattern",
    title: "找规律",
    badge: "推理",
    icon: "△",
    cardClass: "card-pattern",
    url: "/pages/pattern-completion/index",
  },
  {
    id: "pet",
    title: "我的宠物",
    badge: "养成",
    icon: "🐾",
    cardClass: "card-pet",
    url: "/pages/pet/index",
  },
] as const;

function readJSONScore(key: string) {
  const raw = Taro.getStorageSync(key);
  if (!raw) return 0;

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.score === "number" ? parsed.score : 0;
  } catch {
    return 0;
  }
}

function readNumberScore(key: string) {
  const raw = Number(Taro.getStorageSync(key) || 0);
  return Number.isFinite(raw) ? raw : 0;
}

function hasStorageValue(key: string) {
  const raw = Taro.getStorageSync(key);
  return raw !== "" && raw !== null && raw !== undefined;
}

function getMemorySummary(): ScoreSummary {
  let best = 0;
  let played = hasStorageValue("memory_last_score");

  for (let timeDifficulty = 1; timeDifficulty <= 4; timeDifficulty += 1) {
    for (
      let memoryDifficulty = 1;
      memoryDifficulty <= 4;
      memoryDifficulty += 1
    ) {
      const key = `memory_highscore_T${timeDifficulty}M${memoryDifficulty}`;
      best = Math.max(best, readJSONScore(key));
      played = played || hasStorageValue(key);
    }
  }

  return {
    best,
    recent: readNumberScore("memory_last_score"),
    played,
  };
}

function getRpsSummary(): ScoreSummary {
  let best = 0;
  let played = hasStorageValue("rps_last_score");

  for (let difficulty = 1; difficulty <= 4; difficulty += 1) {
    const key = `rps_highscore_D${difficulty}`;
    best = Math.max(best, readJSONScore(key));
    played = played || hasStorageValue(key);
  }

  return {
    best,
    recent: readNumberScore("rps_last_score"),
    played,
  };
}

function getDualTaskSummary(): ScoreSummary {
  const modes = ["alternating", "simultaneous", "stroop"];
  let best = 0;
  let recent = 0;
  let played = false;

  modes.forEach((mode) => {
    const bestKey = `dual_task_best_${mode}`;
    const lastKey = `dual_task_last_${mode}`;

    best = Math.max(best, readNumberScore(bestKey));
    recent = Math.max(recent, readNumberScore(lastKey));
    played = played || hasStorageValue(bestKey) || hasStorageValue(lastKey);
  });

  return { best, recent, played };
}

function getMentalMathSummary(): ScoreSummary {
  const bestTimed = readJSONScore("mental_math_high_score_timed");
  const bestDeath = readJSONScore("mental_math_high_score_death");
  const best = Math.max(bestTimed, bestDeath);
  const recent = readNumberScore("mental_math_last_score");
  const played = hasStorageValue("mental_math_high_score_timed") || hasStorageValue("mental_math_high_score_death");
  return { best, recent, played };
}

function getDigitSpanSummary(): ScoreSummary {
  const best = readNumberScore("digit_span_best");
  const played = hasStorageValue("digit_span_best");
  return { best, recent: 0, played };
}

function getMotSummary(): ScoreSummary {
  const best = readNumberScore("mot_best");
  const played = hasStorageValue("mot_best");
  return { best, recent: 0, played };
}

function getPatternCompletionSummary(): ScoreSummary {
  const best = readNumberScore("pattern_completion_best");
  const played = hasStorageValue("pattern_completion_best");
  return { best, recent: 0, played };
}

function getPetSummary(): ScoreSummary {
  const data = readPetData();
  let best = data.balance;
  let recent = data.pets.length;
  let played = data.pets.length > 0;
  return { best, recent, played };
}

export default function Index() {
  const [games, setGames] = useState<GameItem[]>([]);
  const [petData, setPetData] = useState<PetStorageData | null>(null);
  const [activePet, setActivePet] = useState<PetData | null>(null);
  const [aliveCount, setAliveCount] = useState<number>(0);

  const navigateTo = (url: string) => {
    Taro.navigateTo({ url });
  };

  const navigateToPet = () => {
    navigateTo("/pages/pet/index");
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

  const refreshSummaries = useCallback(() => {
    // Load full pet data for hero banner
    const data = readPetData();
    setPetData(data);
    const pet = data.pets.find(p => p.id === data.activePetId) ?? null;
    setActivePet(pet);
    const alive = data.pets.filter(p => p.status !== "dead").length;
    setAliveCount(alive);

    // Filter pet out of grid since it's now in hero banner
    const gameList = BASE_GAMES.filter(g => g.id !== "pet").map(game => ({
      ...game,
      summary: (() => {
        switch (game.id) {
          case "memory":
            return getMemorySummary();
          case "rps":
            return getRpsSummary();
          case "dual-task":
            return getDualTaskSummary();
          case "mental-math":
            return getMentalMathSummary();
          case "digit-span":
            return getDigitSpanSummary();
          case "mot":
            return getMotSummary();
          case "pattern":
            return getPatternCompletionSummary();
          default:
            return { best: 0, recent: 0, played: false };
        }
      })(),
    }));
    setGames(gameList);
  }, []);

  useLoad(() => {
    refreshSummaries();
  });

  useDidShow(() => {
    refreshSummaries();
  });

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
          <Text className="page-title">脑力游戏实验室</Text>
          <View className="profile-button">
            <Text className="profile-icon">◔</Text>
          </View>
        </View>

        <View
          className="pet-hero-banner card-pet"
          onClick={navigateToPet}
        >
          {activePet ? renderActivePet() : renderEmptyState()}
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
                <Text className="score-line">
                  {`最高分：${game.summary.best}`}
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
