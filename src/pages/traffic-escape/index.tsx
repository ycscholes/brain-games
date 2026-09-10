import { useCallback, useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { getCurrentInstance, useDidShow, useLoad } from "@tarojs/taro";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { usePageShare } from "../../utils/share";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { createTrafficEscapeRun } from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "traffic_escape_best";
const readBestScore = (difficulty: TrainingDifficulty) =>
  Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0) || 0;
const getDifficultyCopy = (difficulty: TrainingDifficulty) =>
  difficulty === "hard" ? "6×6 · 十车深度车阵 · 8–12步" : "6×6 · 八车车阵";

function getForwardedGauntletQuery(runId: string) {
  const params = getCurrentInstance().router?.params ?? {};
  return Object.entries({ ...params, runId })
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
    .join("&");
}

export default function TrafficEscapeStart() {
  usePageShare("pages/traffic-escape/index");
  const gauntletPreset = readGameGauntletModePreset();
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(
    gauntletPreset?.difficulty ?? "normal",
  );
  const [best, setBest] = useState(0);
  useAmbientMusic(!gauntletPreset);
  const refreshBest = useCallback(() => setBest(readBestScore(difficulty)), [difficulty]);
  useLoad(refreshBest);
  useDidShow(refreshBest);
  useEffect(refreshBest, [refreshBest]);
  const startGame = useCallback(() => {
    const run = createTrafficEscapeRun(difficulty);
    const query = getForwardedGauntletQuery(run.runId);
    void (gauntletPreset ? Taro.redirectTo : Taro.navigateTo)({
      url: `/pages/traffic-escape/play?${query}`,
    });
  }, [difficulty, gauntletPreset]);
  useEffect(() => {
    if (gauntletPreset) startGame();
  }, [gauntletPreset, startGame]);
  return (
    <View className="traffic-escape-page">
      <View className="traffic-start start-screen">
        <View className="header-section traffic-hero">
          <View className="logo-icon traffic-kicker">
            <Text className="logo-emoji">🚗</Text>
          </View>
          <Text className="game-title traffic-title">车阵突围</Text>
          <Text className="game-subtitle traffic-subtitle">调度车流，为红车打开出口</Text>
          <View className="high-score-badge traffic-best-pill">
            <Text className="traffic-best-label">当前难度最高</Text>
            <Text className="traffic-best-value">{best}</Text>
          </View>
        </View>
        <View className="rules-card traffic-panel traffic-rule-panel">
          <Text className="section-title traffic-section-title">游戏规则</Text>
          <Text className="rule-item traffic-rule">1. 车辆只能沿朝向直线移动，不能转弯。</Text>
          <Text className="rule-item traffic-rule">2. 点选车辆后，用方向键腾出红车前方道路。</Text>
          <Text className="rule-item traffic-rule">
            3. 红车抵达右侧出口即通关；少移动、少提示得分更高。
          </Text>
        </View>
        {!gauntletPreset ? (
          <View className="summary-card traffic-panel">
            <Text className="section-title traffic-section-title">选择路线难度</Text>
            <View className="summary-grid traffic-difficulty-grid">
              {(["normal", "hard"] as const).map((value) => (
                <View
                  key={value}
                  className={`summary-item traffic-difficulty-card ${difficulty === value ? "traffic-difficulty-card-active" : ""}`}
                  onClick={() => setDifficulty(value)}
                >
                  <Text className="traffic-difficulty-name">
                    {getTrainingDifficultyLabel(value)}
                  </Text>
                  <Text className="traffic-difficulty-copy">{getDifficultyCopy(value)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <View className="floating-start-action traffic-floating-start">
          <View className="primary-button traffic-primary-button" onClick={startGame}>
            <Text className="traffic-primary-button-text">开始调度</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
