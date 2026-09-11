import { useCallback, useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { createNumberOrderRun } from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "number_order_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function NumberOrderStart() {
  usePageShare("pages/number-order/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;
  const [rewardDifficulty, setRewardDifficulty] = useState<TrainingDifficulty>(
    gauntletPreset?.difficulty ?? "normal",
  );
  const [best, setBest] = useState(0);
  useAmbientMusic(!isGauntletPreset);
  const refreshBest = useCallback(
    () => setBest(readBestScore(rewardDifficulty)),
    [rewardDifficulty],
  );
  useLoad(refreshBest);
  useDidShow(refreshBest);
  useEffect(refreshBest, [refreshBest]);

  const startGame = useCallback(() => {
    const run = createNumberOrderRun(rewardDifficulty);
    const query = buildGameRouteQuery(run.runId, readGameRouteParams());
    void (isGauntletPreset ? Taro.redirectTo : Taro.navigateTo)({
      url: `/pages/number-order/play?${query}`,
    });
  }, [isGauntletPreset, rewardDifficulty]);

  useEffect(() => {
    if (isGauntletPreset) startGame();
  }, [isGauntletPreset, startGame]);

  const renderDifficultyCard = (difficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`summary-item ${rewardDifficulty === difficulty ? "summary-item-active" : ""}`}
      onClick={() => setRewardDifficulty(difficulty)}
    >
      <Text className="summary-value">{getTrainingDifficultyLabel(difficulty)}</Text>
      <Text className="summary-label">{copy}</Text>
    </View>
  );

  return (
    <View className="number-order-page">
      <View className="start-screen">
        <View className="header-section">
          <View className="logo-icon">
            <Text className="logo-emoji">1-4</Text>
          </View>
          <Text className="game-title">星链回响</Text>
          <Text className="game-subtitle">记住星点闪现的路径并按顺序连回</Text>
          <View className="high-score-badge">
            <Text className="high-score-label">当前难度最高</Text>
            <Text className="high-score-value">{best}</Text>
          </View>
        </View>
        <View className="rules-card">
          <Text className="section-title">游戏规则</Text>
          <Text className="rule-item">1. 观察星点依次闪现的路径。</Text>
          <Text className="rule-item">2. 回响结束后，按原顺序点亮星链。</Text>
          <Text className="rule-item">3. 错误后会回放正确路径和本题得分。</Text>
        </View>
        {!isGauntletPreset && (
          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid">
              {renderDifficultyCard("normal", "3-5 步星链 · 播放更舒缓")}
              {renderDifficultyCard("hard", "4-7 步星链 · 节奏更紧")}
            </View>
          </View>
        )}
        <View className="floating-start-action">
          <View className="primary-button" onClick={startGame}>
            <Text className="primary-button-text">开始训练</Text>
          </View>
        </View>
        <View className="floating-start-spacer" />
      </View>
    </View>
  );
}
