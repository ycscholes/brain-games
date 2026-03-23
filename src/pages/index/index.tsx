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
  subtitle: string;
  badge: string;
  emoji: string;
  accent: string;
  glow: string;
  url: string;
  summary: ScoreSummary;
}

const BASE_GAMES = [
  {
    id: "memory",
    title: "奇趣图形记忆",
    subtitle: "短时记忆 + 图形辨识，适合先热身。",
    badge: "记忆训练",
    emoji: "◐",
    accent: "linear-gradient(135deg, #ffd36f 0%, #ff8f6b 100%)",
    glow: "rgba(255, 143, 107, 0.28)",
    url: "/pages/memory-challenge/index",
  },
  {
    id: "rps",
    title: "逆向猜拳",
    subtitle: "根据目标结果倒推答案，重点训练反应和逆向判断。",
    badge: "反应速度",
    emoji: "✊",
    accent: "linear-gradient(135deg, #ff9f6a 0%, #ff7a59 52%, #ff5e5b 100%)",
    glow: "rgba(255, 122, 89, 0.3)",
    url: "/pages/rock-paper-scissors/index",
  },
  {
    id: "dual-task",
    title: "双重任务",
    subtitle: "同时处理两条信息流，考验切换与专注分配。",
    badge: "多任务控制",
    emoji: "◎",
    accent: "linear-gradient(135deg, #5f8dff 0%, #365fd9 100%)",
    glow: "rgba(95, 141, 255, 0.26)",
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
      <View className="mesh-grid" />

      <View className="hub-shell">
        <View className="hero-card">
          <View className="hero-mark">
            <Text className="hero-mark-text">脑力</Text>
          </View>
          <Text className="hero-eyebrow">MINI GAME LAB</Text>
          <Text className="hero-title">小游戏练习站</Text>
          <Text className="hero-subtitle">
            面向移动端的轻量训练入口，把记忆、反应和注意力练习集中到一个更顺手的首页里。
          </Text>

          <View className="hero-stats">
            <View className="hero-stat">
              <Text className="hero-stat-value">3</Text>
              <Text className="hero-stat-label">可玩项目</Text>
            </View>
            <View className="hero-stat">
              <Text className="hero-stat-value">实时刷新</Text>
              <Text className="hero-stat-label">成绩摘要</Text>
            </View>
          </View>
        </View>

        <View className="section-header">
          <Text className="section-kicker">选择训练</Text>
          <Text className="section-title">按今天想练的能力进入</Text>
        </View>

        <View className="game-list">
          {games.map((game) => (
            <View
              key={game.id}
              className="game-card"
              onClick={() => navigateTo(game.url)}
              style={{ boxShadow: `0 18px 34px ${game.glow}` }}
            >
              <View className="game-card-top">
                <View className="game-icon" style={{ background: game.accent }}>
                  <Text className="game-icon-text">{game.emoji}</Text>
                </View>
                <View className="game-card-tags">
                  <Text className={`play-state-pill ${game.summary.played ? "is-played" : "is-unplayed"}`}>
                    {game.summary.played ? "已玩" : "未玩"}
                  </Text>
                  <Text className="game-badge">{game.badge}</Text>
                </View>
              </View>

              <View className="game-copy">
                <Text className="game-title">{game.title}</Text>
                <Text className="game-subtitle">{game.subtitle}</Text>
              </View>

              <View className="game-meta game-meta-grid">
                <View className="score-pill">
                  <Text className="score-pill-label">最佳得分</Text>
                  <Text className="score-pill-value">{game.summary.best}</Text>
                </View>
                <View className="score-pill score-pill-secondary">
                  <Text className="score-pill-label">最近成绩</Text>
                  <Text className="score-pill-value">{game.summary.recent}</Text>
                </View>
              </View>

              <View className="game-footer">
                <View className="enter-button" style={{ background: game.accent }}>
                  <Text className="enter-button-text">进入游戏</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
