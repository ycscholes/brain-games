import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useCallback, useState } from "react";
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
    for (let memoryDifficulty = 1; memoryDifficulty <= 4; memoryDifficulty += 1) {
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

export default function Index() {
  const [games, setGames] = useState<GameItem[]>([]);

  const navigateTo = (url: string) => {
    Taro.navigateTo({ url });
  };

  const refreshSummaries = useCallback(() => {
    setGames([
      {
        ...BASE_GAMES[0],
        summary: getMemorySummary(),
      },
      {
        ...BASE_GAMES[1],
        summary: getRpsSummary(),
      },
      {
        ...BASE_GAMES[2],
        summary: getDualTaskSummary(),
      },
    ]);
  }, []);

  useLoad(() => {
    refreshSummaries();
  });

  useDidShow(() => {
    refreshSummaries();
  });

  return (
    <View className="game-hub">
      <View className="ambient ambient-orange" />
      <View className="ambient ambient-blue" />

      <View className="hub-shell">
        <View className="top-bar">
          <Text className="page-title">小游戏实验室</Text>
          <View className="profile-button">
            <Text className="profile-icon">◔</Text>
          </View>
        </View>

        <View className="game-list">
          {games.map((game) => (
            <View key={game.id} className={`game-card ${game.cardClass}`} onClick={() => navigateTo(game.url)}>
              <View className="game-icon">
                <Text className="game-icon-text">{game.icon}</Text>
              </View>

              <View className="game-copy">
                <Text className="game-title">{game.title}</Text>
              </View>

              <View className="game-meta">
                <Text className="game-badge">{game.badge}</Text>
                <Text className="score-line">最高分：{game.summary.best} 🏆</Text>
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
