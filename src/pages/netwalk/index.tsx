import { useEffect, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { getTrainingDifficultyLabel, type TrainingDifficulty } from "../../utils/trainingStorage";
import { readGameGauntletModePreset } from "../../utils/gameGauntlet";
import { usePageShare } from "../../utils/share";
import { buildGameRouteQuery, readGameRouteParams } from "../../utils/gameRoute";
import { createNetwalkRun } from "./run";
import "./index.scss";

function readBest(difficulty: TrainingDifficulty) {
  const value = Number(Taro.getStorageSync(`netwalk_best_${difficulty}`) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getDifficultyCopy(difficulty: TrainingDifficulty) {
  return difficulty === "hard" ? "5×5 · 更深的分支网络" : "4×4 · 快速接通全网";
}

export default function NetwalkStart() {
  usePageShare("pages/netwalk/index");
  const preset = readGameGauntletModePreset();
  const isGauntletPreset = preset !== null;
  const [difficulty, setDifficulty] = useState<TrainingDifficulty>(preset?.difficulty ?? "normal");
  const [best, setBest] = useState(0);

  useEffect(() => setBest(readBest(difficulty)), [difficulty]);

  const startGame = () => {
    const run = createNetwalkRun(difficulty);
    const url = `/pages/netwalk/play?${buildGameRouteQuery(run.runId, readGameRouteParams())}`;
    void (isGauntletPreset ? Taro.redirectTo({ url }) : Taro.navigateTo({ url }));
  };

  useEffect(() => {
    if (isGauntletPreset) startGame();
    // Gauntlet enters a configured run without showing the normal start controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const difficultyCard = (value: TrainingDifficulty) => (
    <View
      className={`summary-item netwalk-difficulty-card ${difficulty === value ? "summary-item-active netwalk-difficulty-card-active" : ""}`}
      onClick={() => setDifficulty(value)}
    >
      <Text className="summary-value netwalk-difficulty-name">
        {getTrainingDifficultyLabel(value)}
      </Text>
      <Text className="summary-label netwalk-difficulty-copy">{getDifficultyCopy(value)}</Text>
    </View>
  );

  return (
    <View className="netwalk-page">
      <View className="netwalk-start start-screen">
        <View className="header-section netwalk-hero">
          <View className="netwalk-orbit netwalk-orbit-one" />
          <View className="netwalk-orbit netwalk-orbit-two" />
          <View className="netwalk-hero-server">
            <Text>●</Text>
          </View>
          <View className="logo-icon netwalk-kicker">
            <Text className="logo-emoji">⌘</Text>
          </View>
          <Text className="game-title netwalk-title">网络回路</Text>
          <Text className="game-subtitle netwalk-subtitle">旋转线路，让每个终端接回核心</Text>
          <View className="high-score-badge netwalk-best-pill">
            <Text className="high-score-label netwalk-best-label">当前难度最高</Text>
            <Text className="high-score-value netwalk-best-value">{best}</Text>
          </View>
        </View>
        <View className="rules-card netwalk-panel netwalk-rule-panel">
          <Text className="section-title netwalk-section-title">游戏规则</Text>
          <Text className="rule-item netwalk-rule">1. 点击蓝色线路节点，每次顺时针旋转 90°。</Text>
          <Text className="rule-item netwalk-rule">
            2. 接口必须两边同时对齐，才能点亮一条线路。
          </Text>
          <Text className="rule-item netwalk-rule">
            3. 全部节点接回琥珀服务器即通关；少旋转、少提示得分更高。
          </Text>
        </View>
        {!isGauntletPreset ? (
          <View className="summary-card netwalk-panel">
            <Text className="section-title netwalk-section-title">选择网络规模</Text>
            <View className="summary-grid netwalk-difficulty-grid">
              {difficultyCard("normal")}
              {difficultyCard("hard")}
            </View>
          </View>
        ) : null}
        <View className="floating-start-action netwalk-floating-start">
          <View className="primary-button netwalk-primary-button" onClick={startGame}>
            <Text className="primary-button-text netwalk-primary-button-text">接通网络</Text>
          </View>
        </View>
        <View className="floating-start-spacer netwalk-floating-spacer" />
      </View>
    </View>
  );
}
