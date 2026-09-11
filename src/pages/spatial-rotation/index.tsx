import { useCallback, useEffect, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { usePageShare } from "../../utils/share";
import { useAmbientMusic } from "../../hooks/useAmbientMusic";
import { createSpatialRotationRun } from "./run";
import "./index.scss";

const STORAGE_KEY_PREFIX = "spatial_rotation_best";

function readBestScore(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`${STORAGE_KEY_PREFIX}_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function SpatialRotationStart() {
  usePageShare("pages/spatial-rotation/index");
  const gauntletPreset = readGameGauntletModePreset();
  const isGauntletPreset = gauntletPreset !== null;
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(
    gauntletPreset?.difficulty ?? "normal",
  );
  const [best, setBest] = useState(0);
  useAmbientMusic(!isGauntletPreset);

  const refreshBest = useCallback(() => setBest(readBestScore(difficulty)), [difficulty]);
  useLoad(refreshBest);
  useDidShow(refreshBest);
  useEffect(refreshBest, [refreshBest]);

  const startGame = useCallback(() => {
    const run = createSpatialRotationRun(difficulty);
    const query = buildGameRouteQuery(run.runId, readGameRouteParams());
    void (isGauntletPreset ? Taro.redirectTo : Taro.navigateTo)({
      url: `/pages/spatial-rotation/play?${query}`,
    });
  }, [difficulty, isGauntletPreset]);

  useEffect(() => {
    if (isGauntletPreset) startGame();
  }, [isGauntletPreset, startGame]);

  const renderDifficultyCard = (nextDifficulty: TrainingDifficulty, copy: string) => (
    <View
      className={`difficulty-card ${difficulty === nextDifficulty ? "difficulty-card-active" : ""}`}
      onClick={() => setDifficulty(nextDifficulty)}
    >
      <Text className="difficulty-name">{getTrainingDifficultyLabel(nextDifficulty)}</Text>
      <Text className="difficulty-copy">{copy}</Text>
    </View>
  );

  return (
    <View className="spatial-rotation-page">
      <View className="rotation-start start-screen">
        <View className="header-section">
          <View className="logo-icon">
            <Text className="logo-emoji">◇</Text>
          </View>
          <Text className="game-title">旋影辨形</Text>
          <Text className="game-subtitle">在旋转候选里找出同一个形状</Text>
          <View className="high-score-badge">
            <Text className="high-score-label">当前难度最高</Text>
            <Text className="high-score-value">{best}</Text>
          </View>
        </View>
        <View className="rules-card">
          <Text className="section-title">游戏规则</Text>
          <Text className="rule-item">1. 每局 8 题，目标图形可以旋转但不能镜像。</Text>
          <Text className="rule-item">2. 选择和目标完全相同的一项。</Text>
          <Text className="rule-item">3. 快速答对和连续答对会获得额外得分。</Text>
        </View>
        {!isGauntletPreset && (
          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid">
              {renderDifficultyCard("normal", "时间宽松 · 干扰较少")}
              {renderDifficultyCard("hard", "节奏更快 · 镜像干扰更强")}
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
