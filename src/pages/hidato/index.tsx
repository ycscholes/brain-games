import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createHidatoRun } from "./run";
import "./index.scss";

function readBest(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`hidato_best_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function HidatoStart() {
  usePageShare("pages/hidato/index");
  const preset = readGameGauntletModePreset();
  const isGauntletPreset = preset !== null;
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(preset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);

  useEffect(() => setBest(readBest(difficulty)), [difficulty]);

  const startGame = () => {
    const run = createHidatoRun(difficulty);
    const url = `/pages/hidato/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (isGauntletPreset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };

  useEffect(() => {
    if (isGauntletPreset) startGame();
    // Gauntlet enters a configured run without showing the normal start controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderDifficultyCard = (value: TrainingDifficulty) => (
    <View
      className={`summary-item ${difficulty === value ? "summary-item-active" : ""}`}
      onClick={() => setDifficulty(value)}
    >
      <Text className="summary-value">{getTrainingDifficultyLabel(value)}</Text>
      <Text className="summary-label">
        {value === "normal" ? "5 × 5 · 25 格" : "6 × 6 · 更多干扰"}
      </Text>
    </View>
  );

  return (
    <View className="hidato-page">
      <View className="hidato-start start-screen">
        <View className="header-section">
          <View className="logo-icon">
            <Text className="logo-emoji">1N</Text>
          </View>
          <Text className="game-title">连数迷阵</Text>
          <Text className="game-subtitle">从 1 出发，按顺序点击相邻格</Text>
          <View className="high-score-badge">
            <Text className="high-score-label">当前难度最高</Text>
            <Text className="high-score-value">{best}</Text>
          </View>
        </View>
        <View className="rules-card">
          <Text className="section-title">游戏规则</Text>
          <Text className="rule-item">1. 从 1 出发，按顺序点击相邻格。</Text>
          <Text className="rule-item">2. 正确路径会自动连线，错误和提示会扣分。</Text>
          <Text className="rule-item">3. 连接到最大数字 N 即通关。</Text>
        </View>
        {!isGauntletPreset ? (
          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid">
              {renderDifficultyCard("normal")}
              {renderDifficultyCard("hard")}
            </View>
          </View>
        ) : null}
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
