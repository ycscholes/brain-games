import { View, Text } from "@tarojs/components";
import Taro, { getCurrentInstance, useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { GAME_TITLE_MAP, getGameById } from "../../config/gameCatalog";
import {
  GAUNTLET_LEG_COUNT,
  clearGameGauntletSession,
  createGameGauntletSession,
  finalizeGameGauntletSession,
  getGauntletGameUrl,
  readGameGauntletSession,
  startGameGauntletSession,
  type GameGauntletSession,
} from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import "./index.scss";

type PageStatus = "ready" | "active" | "complete";

function getDifficultyLabel(difficulty: GameGauntletSession["difficulty"]) {
  return difficulty === "hard" ? "进阶难度" : "标准难度";
}

export default function GameGauntlet() {
  usePageShare("pages/game-gauntlet/index");

  const [session, setSession] = useState<GameGauntletSession | null>(null);
  const [completedSession, setCompletedSession] = useState<GameGauntletSession | null>(null);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [status, setStatus] = useState<PageStatus>("ready");

  const enterLeg = (nextSession: GameGauntletSession) => {
    const legIndex = nextSession.results.filter(Boolean).length;
    const gameId = nextSession.gameIds[legIndex];
    Taro.navigateTo({
      url: getGauntletGameUrl(gameId, nextSession.id, legIndex),
    });
  };

  const prepareNewPreview = () => {
    clearGameGauntletSession();
    setSession(createGameGauntletSession());
    setCompletedSession(null);
    setAwardedPoints(0);
    setStatus("ready");
  };

  const refreshSession = () => {
    const params = getCurrentInstance().router?.params ?? {};
    const routeSessionId = typeof params.sessionId === "string" ? params.sessionId : "";

    if (!routeSessionId) {
      prepareNewPreview();
      return;
    }

    const nextSession = readGameGauntletSession(routeSessionId);
    if (!nextSession) {
      prepareNewPreview();
      return;
    }

    if (nextSession.status === "completed") {
      const totalPoints = nextSession.results.reduce((sum, result) => sum + result.awardedPoints, 0);
      finalizeGameGauntletSession(nextSession.id);
      setCompletedSession(nextSession);
      setAwardedPoints(totalPoints);
      setSession(null);
      setStatus("complete");
      return;
    }

    if (nextSession.results.filter(Boolean).length > 0) {
      setSession(nextSession);
      setStatus("active");
      enterLeg(nextSession);
      return;
    }

    setSession(nextSession);
    setStatus("active");
  };

  useDidShow(() => {
    refreshSession();
  });

  const startGauntlet = () => {
    const nextSession = startGameGauntletSession(session ?? undefined);
    setSession(nextSession);
    setStatus("active");
    enterLeg(nextSession);
  };

  const displayedSession = completedSession ?? session;
  const completedCount = displayedSession?.results.filter(Boolean).length ?? 0;

  return (
    <View className="gauntlet-page">
      <View className="gauntlet-shell">
        <View className="gauntlet-header">
          <View className="back-button" onClick={() => Taro.navigateBack()}>
            <Text className="back-icon">‹</Text>
          </View>
          <View className="header-copy">
            <Text className="page-eyebrow">Gauntlet</Text>
            <Text className="page-title">游戏大闯关</Text>
          </View>
        </View>

        <View className="gauntlet-hero">
          <Text className="hero-kicker">本轮直接开局</Text>
          <Text className="hero-title">连闯 3 局，拿下总积分</Text>
          <Text className="hero-copy">退出后会重新抽取，从第一关开始。</Text>
          {displayedSession ? (
            <View className="difficulty-strip">
              <Text className="difficulty-label">本次选择</Text>
              <Text className="difficulty-value">{getDifficultyLabel(displayedSession.difficulty)}</Text>
            </View>
          ) : null}
        </View>

        {displayedSession ? (
          <View className="gauntlet-route">
            {displayedSession.gameIds.map((gameId, index) => {
              const game = getGameById(gameId);
              const result = displayedSession.results[index];
              const isCurrent = status === "active" && index === completedCount;
              return (
                <View
                  key={`${gameId}-${index}`}
                  className={`route-step ${result ? "route-step-done" : ""} ${isCurrent ? "route-step-current" : ""}`}
                >
                  <View className="route-index">
                    <Text className="route-index-text">{index + 1}</Text>
                  </View>
                  <View className="route-copy">
                    <Text className="route-title">{game?.title ?? GAME_TITLE_MAP[gameId]}</Text>
                    <Text className="route-meta">
                      {result ? `得分 ${result.score} · 计入 ${result.awardedPoints} 积分` : `${game?.duration ?? ""} · ${game?.skill ?? ""}`}
                    </Text>
                    <Text className="route-difficulty">{getDifficultyLabel(displayedSession.difficulty)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {status === "complete" ? (
          <View className="gauntlet-result">
            <Text className="result-label">本次闯关获得</Text>
            <Text className="result-value">{awardedPoints}</Text>
            <Text className="result-copy">积分已计入总积分。</Text>
          </View>
        ) : null}

        <View className="gauntlet-actions">
          {status === "active" ? (
            <View className="primary-action primary-action-disabled">
              <Text className="primary-action-text">正在进入第 {completedCount + 1} 关</Text>
            </View>
          ) : (
            <View className="primary-action" onClick={startGauntlet}>
              <Text className="primary-action-text">{status === "complete" ? "再闯一次" : "开始闯关"}</Text>
            </View>
          )}
          <Text className="action-note">每次随机抽取 {GAUNTLET_LEG_COUNT} 个不同单项游戏</Text>
        </View>
      </View>
    </View>
  );
}
