import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createTentsCampRun } from "./run";
import "./index.scss";

function readBest(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`tents_camp_best_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

export default function TentsCampStart() {
  usePageShare("pages/tents-camp/index");
  const preset = readGameGauntletModePreset();
  const isGauntletPreset = preset !== null;
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(preset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);

  useEffect(() => setBest(readBest(difficulty)), [difficulty]);

  const startGame = () => {
    const run = createTentsCampRun(difficulty);
    const url = `/pages/tents-camp/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (isGauntletPreset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };

  useEffect(() => {
    if (isGauntletPreset) startGame();
    // Gauntlet enters a configured run without showing the normal start controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderDifficultyCard = (value: TrainingDifficulty, copy: string) => (
    <View
      className={`summary-item ${difficulty === value ? "summary-item-active" : ""}`}
      onClick={() => setDifficulty(value)}
    >
      <Text className="summary-value">{getTrainingDifficultyLabel(value)}</Text>
      <Text className="summary-label">{copy}</Text>
    </View>
  );

  return (
    <View className="tents-page">
      <View className="tents-start start-screen">
        <View className="header-section">
          <View className="logo-icon">
            <Text className="logo-emoji">T</Text>
          </View>
          <Text className="game-title">帐篷营地</Text>
          <Text className="game-subtitle">根据树和行列数字布置帐篷</Text>
          <View className="high-score-badge">
            <Text className="high-score-label">当前难度最高</Text>
            <Text className="high-score-value">{best}</Text>
          </View>
        </View>
        <View className="rules-card">
          <Text className="section-title">游戏规则</Text>
          <Text className="rule-item">1. 每棵树旁边要有一个帐篷，帐篷只能放在上下左右相邻格。</Text>
          <Text className="rule-item">2. 帐篷之间不能相邻，包含斜向相邻。</Text>
          <Text className="rule-item">3. 边缘数字表示该行或该列需要的帐篷数量。</Text>
        </View>
        {!isGauntletPreset ? (
          <View className="summary-card">
            <Text className="section-title">难度</Text>
            <View className="summary-grid">
              {renderDifficultyCard("normal", "6x6 · 5 顶帐篷")}
              {renderDifficultyCard("hard", "7x7 · 6 顶帐篷")}
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
